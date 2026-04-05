import express, { Request, Response } from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
console.log('🔥 INNER Server: UPGRADE ENGINE ACTIVATED');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const sendError = (res: Response, status: number, message: string) => res.status(status).json({ ok: false, error: message });

// --- ראדר, פיד וקהילות ---
app.get('/api/feed', async (_req, res) => {
  const { data } = await supabase.from('circles').select('*').order('created_at', { ascending: false });
  res.json({ ok: true, items: data || [] });
});

app.get('/api/discover', async (req, res) => {
  const q = String(req.query.q || '').trim();
  let query = supabase.from('circles').select('*');
  if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%,slug.ilike.%${q}%`);
  const { data } = await query;
  res.json({ ok: true, items: data || [] });
});

app.get('/api/circles/:slug', async (req, res) => {
  const slug = decodeURIComponent(String(req.params.slug)).trim();
  const userId = req.headers['x-user-id'] as string; // מקבלים את מזהה המשתמש מהבקשה

  const { data: circle } = await supabase.from('circles').select('*').ilike('slug', slug).maybeSingle();
  if (!circle) return sendError(res, 404, 'הקהילה לא נמצאה');

  // שליפת סטטוס המשתמש בקהילה (האם הוא CORE?)
  let membership = null;
  if (userId) {
    const { data: mem } = await supabase.from('memberships').select('*').eq('circle_id', circle.id).eq('user_id', userId).maybeSingle();
    membership = mem;
  }

  const { data: messages } = await supabase.from('circle_messages').select('*').eq('circle_id', circle.id).order('created_at', { ascending: false }).limit(50);
  res.json({ ok: true, circle, messages: (messages || []).reverse(), membership });
});

// --- מנוע ה-DROPS והשדרוגים (CORE) ---
app.get('/api/circles/:slug/drops', async (req, res) => {
  const slug = decodeURIComponent(String(req.params.slug)).trim();
  const { data: circle } = await supabase.from('circles').select('id').ilike('slug', slug).maybeSingle();
  if (!circle) return sendError(res, 404, 'קהילה לא נמצאה');

  const { data: drops } = await supabase.from('circle_drops').select('*').eq('circle_id', circle.id).order('created_at', { ascending: false });
  res.json({ ok: true, drops: drops || [] });
});

app.post('/api/circles/:slug/drops', async (req, res) => {
  const slug = decodeURIComponent(String(req.params.slug)).trim();
  const { image_url, caption } = req.body;
  const { data: circle } = await supabase.from('circles').select('id').ilike('slug', slug).maybeSingle();
  if (!circle) return sendError(res, 404, 'קהילה לא נמצאה');
  const { data: drop, error } = await supabase.from('circle_drops').insert({ circle_id: circle.id, image_url, caption, tier_required: 'CORE' }).select('*').single();
  if (error) return sendError(res, 500, 'שגיאה בהעלאת הדרוף');
  res.json({ ok: true, drop });
});

// שדרוג הסטטוס ל-CORE 🚀
app.post('/api/circles/:slug/upgrade', async (req, res) => {
  const slug = decodeURIComponent(String(req.params.slug)).trim();
  const { user_id } = req.body;
  if (!user_id) return sendError(res, 401, 'חסר זיהוי משתמש');

  // 1. מציאת הקהילה ומחיר ה-VIP
  const { data: circle } = await supabase.from('circles').select('*').ilike('slug', slug).maybeSingle();
  if (!circle) return sendError(res, 404, 'הקהילה לא נמצאה');
  const vipPrice = circle.vip_price || 50;

  // 2. בדיקת יתרת המשתמש
  const { data: profile } = await supabase.from('profiles').select('credits').eq('id', user_id).single();
  if (!profile || profile.credits < vipPrice) {
    return sendError(res, 400, 'אין לך מספיק CRD. טען את הארנק!');
  }

  // 3. ניכוי התשלום
  await supabase.from('profiles').update({ credits: profile.credits - vipPrice }).eq('id', user_id);
  await supabase.from('wallet_transactions').insert({ user_id, amount: -vipPrice, description: `שדרוג ל-CORE בקהילה: ${circle.name}` });

  // 4. עדכון/יצירת חברות מסוג CORE
  const { error } = await supabase.from('memberships').upsert({ user_id, circle_id: circle.id, tier: 'CORE' }, { onConflict: 'user_id, circle_id' });
  if (error) return sendError(res, 500, 'שגיאה בשדרוג הסטטוס');

  res.json({ ok: true, message: 'שודרגת בהצלחה ל-CORE!' });
});

// --- הודעות, ארנק וכו' (הקוד הרגיל נשאר) ---
app.post('/api/circles/:slug/messages', async (req, res) => {
  const slug = decodeURIComponent(String(req.params.slug)).trim();
  const { content, sender_name, is_highlighted } = req.body;
  const { data: circle } = await supabase.from('circles').select('id').ilike('slug', slug).maybeSingle();
  if (!circle) return sendError(res, 404, 'קהילה לא נמצאה');
  const { data: message, error } = await supabase.from('circle_messages').insert({ circle_id: circle.id, content, sender_name: sender_name || 'אורח', is_highlighted: is_highlighted || false }).select('*').single();
  if (error) return sendError(res, 500, 'שגיאה בשליחת הודעה');
  res.json({ ok: true, message });
});

app.post('/api/wallet/topup', async (req, res) => {
  const { amount, price, user_id } = req.body;
  if (user_id) {
    const { data: p } = await supabase.from('profiles').select('credits').eq('id', user_id).single();
    if (p) await supabase.from('profiles').update({ credits: p.credits + amount }).eq('id', user_id);
    await supabase.from('wallet_transactions').insert({ user_id, amount, description: `טעינת ${amount} CRD (₪${price})` });
  }
  res.json({ ok: true });
});
app.get('/api/wallet/history', async (req, res) => {
  const { data } = await supabase.from('wallet_transactions').select('*').order('created_at', { ascending: false }).limit(20);
  res.json({ ok: true, items: data || [] });
});
app.get('/api/me/collection', async (req, res) => res.json({ ok: true, memberships: [], ownedCircles: [] }));
app.put('/api/me', async (req, res) => res.json({ ok: true }));

const PORT = 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 INNER Server: UPGRADE ENGINE Active on port ${PORT}`));
