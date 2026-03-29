import express, { Router } from 'express';
import { supabase } from '../lib/supabase';
import { rewardXP } from '../lib/gamification';

const router = Router();

// התיקון הקריטי: מכריחים את השרת לפענח JSON בכל בקשה שמגיעה לכאן!
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

router.get('/', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('id, content, media_url, created_at, profiles!inner (id, full_name, username, avatar_url), likes (user_id), comments (id)')
      .is('circle_id', null)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    const formattedData = data.map((post: any) => ({
      ...post,
      likes_count: post.likes?.length || 0,
      comments_count: post.comments?.length || 0,
      is_liked: post.likes?.some((like: any) => like.user_id === userId) || false
    }));

    res.json(formattedData);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'משתמש לא מחובר' });

  // שאיבת הנתונים אחרי שהם פוענחו בהצלחה
  let content = req.body?.content || '';
  let media_url = req.body?.media_url || null;

  // גיבוי קשוח: אם זה הגיע כטקסט מלוכלך, נפרסס את זה בכוח
  if (typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body);
      content = parsed.content || '';
      media_url = parsed.media_url || null;
    } catch (e) { console.error("Parse Error:", e); }
  }

  const cleanContent = content.trim();

  // אם השרת עדיין חושב שזה ריק, הוא ישלח לנו חזרה בדיוק מה הוא "ראה" כדי שנדע למה
  if (!cleanContent && !media_url) {
    return res.status(400).json({ 
      error: 'חובה להזין טקסט או תמונה',
      debug_body_received: req.body 
    });
  }

  try {
    const { data, error } = await supabase.from('posts').insert({ 
      user_id: userId, 
      content: cleanContent,
      media_url: media_url
    }).select().single();
    
    if (error) throw error;
    
    const xpReward = await rewardXP(userId, 50);
    res.json({ ...data, xpReward });
  } catch (err: any) { 
    res.status(500).json({ error: err.message || 'Server error' }); 
  }
});

export default router;
