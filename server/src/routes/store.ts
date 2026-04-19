import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

const createNotification = async (userId: string, type: string, title: string, content: string, actionUrl?: string) => {
  try {
    await supabase.from('notifications').insert({ user_id: userId, type, title, content, action_url: actionUrl, is_read: false });
  } catch (err) {}
};

router.post('/buy', async (req: Request, res: Response) => {
  const userId = req.headers['x-user-id'] as string;
  const { boost_id, price } = req.body;

  if (!userId || !boost_id || !price) return res.status(400).json({ error: 'Missing data' });

  try {
    const { data: profile } = await supabase.from('profiles').select('crd_balance').eq('id', userId).single();
    if (!profile || profile.crd_balance < price) return res.status(400).json({ error: 'אין לך מספיק CRD' });

    await supabase.from('profiles').update({ crd_balance: profile.crd_balance - price }).eq('id', userId);
    
    await supabase.from('transactions').insert({
      user_id: userId,
      amount: -price,
      type: 'purchase',
      description: `רכישת שדרוג: ${boost_id}`
    });

    await createNotification(userId, 'store', 'רכישה בוצעה בהצלחה! 🛍️', `רכשת בוסט סטטוס חדש במחיר ${price} CRD.`, `/wallet`);

    res.json({ success: true, newBalance: profile.crd_balance - price });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
