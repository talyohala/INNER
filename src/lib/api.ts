const BASE_URL = 'http://127.0.0.1:8080';

export async function apiFetch<T>(endpoint: string, options: any = {}): Promise<T> {
  // חיפוש טוקן אימות אמיתי (Access Token) במקום רק ID
  const supabaseKey = Object.keys(localStorage).find(key => key.includes('auth-token'));
  const supabaseData = supabaseKey ? localStorage.getItem(supabaseKey) : null;
  
  let userId = null;
  let accessToken = null;

  if (supabaseData) {
    try {
      const parsed = JSON.parse(supabaseData);
      userId = parsed.user?.id || parsed.currentSession?.user?.id;
      accessToken = parsed.access_token || parsed.currentSession?.access_token;
    } catch (e) { console.error('Error parsing token:', e); }
  }

  // נפיל גיבוי ל-ID רגיל אם אין טוקן (כדי לא לשבור דברים קיימים)
  if (!userId) {
    const userStr = localStorage.getItem('inner_auth_user');
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        userId = parsed.id || parsed.user?.id || parsed;
      } catch (e) { userId = userStr; }
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // שליחת ה-ID המסורתי (עבור נתיבים ישנים)
  if (userId && userId !== 'undefined') {
    headers['x-user-id'] = userId;
  }
  
  // שליחת הטוקן המאובטח (לנתיבים החדשים - לייקים, התראות)
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Unauthorized');
  }

  return response.json();
}
