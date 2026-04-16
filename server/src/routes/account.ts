import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

router.delete('/', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // מחיקת המשתמש מה-Auth (דורש Service Role שיש לנו בשרת)
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;
    
    res.json({ success: true, message: 'Account deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
