import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

router.get('/', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: profile } = await supabase.from('profiles').select('crd_balance').eq('id', userId).single();
    const { data: transactions } = await supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    
    res.json({ credits: profile?.crd_balance || 0, transactions: transactions || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/add', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const { amount } = req.body;
  if (!userId || !amount) return res.status(400).json({ error: 'Invalid data' });

  try {
    const { data: profile } = await supabase.from('profiles').select('crd_balance').eq('id', userId).single();
    const newBalance = (profile?.crd_balance || 0) + amount;
    
    await supabase.from('profiles').update({ crd_balance: newBalance }).eq('id', userId);
    await supabase.from('transactions').insert([{ user_id: userId, type: 'deposit', amount, description: 'רכישת קרדיטים בחנות' }]);
    
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
    const { data: receiver } = await supabase.from('profiles').select('id, crd_balance').eq('username', toUsername).single();
    if (!receiver) return res.status(404).json({ error: 'שם המשתמש לא נמצא במערכת' });
    if (receiver.id === senderId) return res.status(400).json({ error: 'לא ניתן להעביר לעצמך' });

    const { data: sender } = await supabase.from('profiles').select('crd_balance, username').eq('id', senderId).single();
    if (!sender || sender.crd_balance < amount) return res.status(400).json({ error: 'אין לך מספיק יתרה' });

    const newSenderBalance = sender.crd_balance - amount;
    await supabase.from('profiles').update({ crd_balance: newSenderBalance }).eq('id', senderId);

    const newReceiverBalance = (receiver.crd_balance || 0) + amount;
    await supabase.from('profiles').update({ crd_balance: newReceiverBalance }).eq('id', receiver.id);

    await supabase.from('transactions').insert([
      { user_id: senderId, type: 'withdrawal', amount: -amount, description: `העברה ל-@${toUsername}` },
      { user_id: receiver.id, type: 'deposit', amount, description: `העברה מ-@${sender.username}` }
    ]);

    res.json({ success: true, newBalance: newSenderBalance });
  } catch (err) {
    res.status(500).json({ error: 'שגיאת שרת בביצוע ההעברה' });
  }
});

export default router;
