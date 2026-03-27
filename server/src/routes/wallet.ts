import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

// קבלת יתרה והיסטוריה
router.get('/', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // משיכת יתרה נוכחית
    const { data: profile } = await supabase.from('profiles').select('credits').eq('id', userId).single();
    
    // משיכת 10 עסקאות אחרונות
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    res.json({ 
      credits: profile?.credits || 0, 
      transactions: transactions || [] 
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// סימולציית הוספת קרדיטים (טעינת ארנק)
router.post('/add', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const { amount } = req.body;

  try {
    // 1. בדיקת יתרה קיימת
    const { data: profile } = await supabase.from('profiles').select('credits').eq('id', userId).single();
    const newBalance = (profile?.credits || 0) + Number(amount);

    // 2. עדכון הפרופיל ביתרה החדשה
    await supabase.from('profiles').update({ credits: newBalance }).eq('id', userId);

    // 3. תיעוד הפעולה בהיסטוריה
    await supabase.from('transactions').insert({
      user_id: userId,
      amount: Number(amount),
      type: 'deposit',
      description: `טעינת ${amount} CRD לארנק`
    });

    res.json({ success: true, newBalance });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
