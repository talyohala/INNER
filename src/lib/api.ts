import { supabase } from './supabase';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080';

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    let message = raw;
    try { message = JSON.parse(raw).error || raw; } catch {}
    throw new Error(message || `HTTP ${res.status}`);
  }

  const ct = res.headers.get('content-type') ?? '';
  return ct.includes('application/json') ? res.json() : (res.text() as any);
}
