import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

router.get('/', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { data: profile } = await supabase.from('profiles').select('crd_balance').eq('id', userId).single();
  res.json({ credits: profile?.crd_balance || 0 });
});

// טעינת CRD (סימולציה לפי ה-UI הנוכחי)
router.post('/topup', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const { amount, price } = req.body;
  if (!userId || !amount) return res.status(400).json({ error: 'Invalid data' });

  try {
    const { data: profile } = await supabase.from('profiles').select('crd_balance').eq('id', userId).single();
    const newBalance = (profile?.crd_balance || 0) + amount;
    
    await supabase.from('profiles').update({ crd_balance: newBalance }).eq('id', userId);
    await supabase.from('transactions').insert([{ user_id: userId, type: 'top_up', amount, description: `טעינת ${amount} CRD (₪${price})` }]);
    
    res.json({ success: true, newBalance });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/transfer', async (req, res) => {
  const senderId = req.headers['x-user-id'] as string;
  const { toUsername, amount } = req.body;
  
  if (!senderId || !toUsername || !amount || amount <= 0) return res.status(400).json({ error: 'נתונים לא תקינים' });

  try {
    const { data: receiver } = await supabase.from('profiles').select('id').eq('username', toUsername).single();
    if (!receiver) return res.status(404).json({ error: 'משתמש לא נמצא' });

    // קריאה ל-RPC המאובטח שיצרנו ב-SQL!
    const { data: newBalance, error } = await supabase.rpc('transfer_credits', {
      sender_id: senderId,
      receiver_id: receiver.id,
      transfer_amount: amount
    });

    if (error) throw error;
    res.json({ success: true, newBalance });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'שגיאת שרת' });
  }
});

export default router;
