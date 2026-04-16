import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

// קבלת נתוני קהילה לעריכה
router.get('/circles/:slug/edit', async (req, res) => {
  const { slug } = req.params;
  const userId = req.headers['x-user-id'] as string;
  
  const { data: circle } = await supabase.from('circles').select('*').eq('slug', slug).single();
  if (!circle || circle.owner_id !== userId) return res.status(403).json({ error: 'Not authorized' });
  
  res.json({ circle });
});

// עדכון נתוני קהילה
router.patch('/circles/:slug', async (req, res) => {
  const { slug } = req.params;
  const userId = req.headers['x-user-id'] as string;
  const updates = req.body;
  
  const { data: circle } = await supabase.from('circles').select('id, owner_id').eq('slug', slug).single();
  if (!circle || circle.owner_id !== userId) return res.status(403).json({ error: 'Not authorized' });

  const { error } = await supabase.from('circles').update(updates).eq('id', circle.id);
  if (error) return res.status(500).json({ error: error.message });
  
  res.json({ success: true });
});

// שמירת פרטי חשבון בנק למשיכה
router.put('/finance/payout-account', async (req, res) => {
  // בגרסת ייצור יש לשמור זאת בטבלה נפרדת ומוצפנת
  res.json({ success: true });
});

// בקשת משיכת כספים
router.post('/finance/payout-request', async (req, res) => {
  res.json({ success: true, message: 'Request sent to admins' });
});

export default router;
