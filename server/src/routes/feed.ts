import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { rewardXP } from '../lib/gamification';

const router = Router();

router.get('/', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('id, content, created_at, profiles!inner (id, full_name, username, avatar_url), likes (user_id), comments (id)')
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
  const { content } = req.body;
  if (!userId || !content) return res.status(400).json({ error: 'שגיאה בנתונים' });

  try {
    const { data, error } = await supabase.from('posts').insert({ user_id: userId, content }).select().single();
    if (error) throw error;
    
    // מנוע ההתמכרות: מחלקים 50 XP על פרסום פוסט בלובי!
    const xpReward = await rewardXP(userId, 50);

    // מחזירים ללקוח גם את הפוסט וגם את הבונוס שקיבל
    res.json({ ...data, xpReward });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

export default router;
