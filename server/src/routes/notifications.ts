import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

const authMiddleware = async (req: any, res: any, next: any) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'חסר טוקן אימות' });
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'משתמש לא מורשה' });
    }

    req.user = user;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: err?.message || 'שגיאת אימות' });
  }
};

router.get('/', authMiddleware, async (req: any, res: any) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'שגיאה בטעינת התראות' });
  }
});

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
    res.status(500).json({ error: err.message || 'שגיאה בסימון התראות כנקראו' });
  }
});

// זמנית: ראוט קיים כדי לא לשבור לקוחות קיימים,
// אבל בלי תלות ב-Firebase עד שנגדיר ספק פוש אמיתי.
router.post('/send-push', async (req: any, res: any) => {
  try {
    const { targetUserId, title, body, data } = req.body || {};

    if (!targetUserId || !title) {
      return res.status(400).json({ error: 'Missing push data' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, push_token')
      .eq('id', targetUserId)
      .maybeSingle();

    if (profileError) throw profileError;

    return res.json({
      success: true,
      queued: false,
      delivered: false,
      message: profile?.push_token
        ? 'push provider not configured yet'
        : 'user has no push token',
      debug: {
        targetUserId,
        title,
        body: body ?? '',
        hasPushToken: Boolean(profile?.push_token),
        data: data ?? null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'שגיאה בשליחת פוש' });
  }
});

export default router;
