import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

const createNotification = async (userId: string, actorId: string, type: string, title: string, content: string, actionUrl?: string) => {
  if (userId === actorId) return;
  try {
    await supabase.from('notifications').insert({ user_id: userId, actor_id: actorId, type, title, content, action_url: actionUrl, is_read: false });
  } catch (err) {}
};

// עדכון פרופיל
router.put('/', async (req: Request, res: Response) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { full_name, username, bio, avatar_url, cover_url, zodiac, social_link, location, birth_date, relationship_status, education } = req.body;
  try {
    const updates: any = { full_name, username, bio, avatar_url, cover_url, zodiac, social_link, location, relationship_status, education };
    if (birth_date === '' || birth_date === null || birth_date === undefined) updates.birth_date = null;
    else updates.birth_date = birth_date;

    const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// פולואו (Follow / Unfollow)
router.post('/:targetId/follow', async (req: Request, res: Response) => {
  const followerId = req.headers['x-user-id'] as string;
  const { targetId } = req.params;
  
  if (!followerId || !targetId) return res.status(400).json({ error: 'Missing IDs' });

  try {
    const { data: existing } = await supabase.from('followers').select('*').eq('follower_id', followerId).eq('following_id', targetId).maybeSingle();

    if (existing) {
      await supabase.from('followers').delete().eq('follower_id', followerId).eq('following_id', targetId);
      return res.json({ following: false });
    } else {
      await supabase.from('followers').insert({ follower_id: followerId, following_id: targetId });
      
      // התראה למי שעקבו אחריו
      await createNotification(targetId, followerId, 'follow', 'עוקב חדש! 👤', `התחיל/ה לעקוב אחריך`, `/profile/${followerId}`);
      
      return res.json({ following: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
