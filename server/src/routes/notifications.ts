import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { sendPushNotification } from '../lib/firebase';

const router = Router();

const authMiddleware = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'חסר טוקן אימות' });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'משתמש לא מורשה' });
  req.user = user;
  next();
};

router.get('/', authMiddleware, async (req: any, res: any) => {
  try {
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(30);
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/read', authMiddleware, async (req: any, res: any) => {
  try {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', req.user.id).eq('is_read', false);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// הראוט החסר שמרסק את הראדר - שולח פוש לטלפון
router.post('/send-push', async (req: any, res: any) => {
  try {
    const { targetUserId, title, body, data } = req.body;
    if (!targetUserId || !title) return res.status(400).json({ error: 'Missing push data' });

    const { data: profile } = await supabase.from('profiles').select('push_token').eq('id', targetUserId).maybeSingle();
    
    if (profile?.push_token) {
      await sendPushNotification(profile.push_token, title, body, data);
    }
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
