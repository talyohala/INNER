import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

// Middleware שמזהה מי המשתמש שפונה לשרת לפי הטוקן שלו
const authMiddleware = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'חסר טוקן אימות' });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'משתמש לא מורשה' });
  req.user = user;
  next();
};

// קבלת כל ההתראות של המשתמש
router.get('/', authMiddleware, async (req: any, res: any) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// סימון התראות שנקראו (מעלים את הנקודה האדומה)
router.post('/read', authMiddleware, async (req: any, res: any) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
