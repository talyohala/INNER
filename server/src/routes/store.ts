import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

const createNotification = async (userId: string, type: string, title: string, content: string, actionUrl?: string) => {
  try {
    await supabase.from('notifications').insert({ user_id: userId, type, title, content, action_url: actionUrl, is_read: false });
  } catch (err) {}
};

// רכישת בוסט מחנות הסטטוס
router.post('/buy', async (req: Request, res: Response) => {
  const userId = req.headers['x-user-id'] as string;
  const { boost_id, price } = req.body;

  if (!userId || !boost_id || !price) return res.status(400).json({ error: 'Missing data' });

  try {
    // בדיקת יתרה
    const { data: profile } = await supabase.from('profiles').select('credits').eq('id', userId).single();
    if (!profile || profile.credits < price) return res.status(400).json({ error: 'אין לך מספיק CRD' });

    // ניכוי מהארנק
    await supabase.from('profiles').update({ credits: profile.credits - price }).eq('id', userId);
    
    // רישום בארנק
    await supabase.from('transactions').insert({
      user_id: userId,
      amount: -price,
      type: 'purchase',
      description: `רכישת שדרוג: ${boost_id}`
    });

    // התראה למשתמש על הרכישה
    await createNotification(userId, 'store', 'רכישה בוצעה בהצלחה! 🛍️', `רכשת בוסט סטטוס חדש במחיר ${price} CRD.`, `/wallet`);

    res.json({ success: true, newBalance: profile.credits - price });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
