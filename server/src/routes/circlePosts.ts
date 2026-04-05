import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

// פרסום פוסט בתוך קהילה
router.post('/:slug/posts', async (req, res) => {
  const { slug } = req.params;
  const userId = req.headers['x-user-id'] as string;
  const { content } = req.body;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!content) return res.status(400).json({ error: 'תוכן הפוסט ריק' });

  try {
    // 1. מציאת הקהילה לפי ה-slug
    const { data: circle, error: circleErr } = await supabase.from('circles').select('id').eq('slug', slug).single();
    if (circleErr || !circle) return res.status(404).json({ error: 'Circle not found' });

    // 2. בדיקה האם המשתמש באמת חבר בקהילה (אי אפשר לפרסם מבחוץ)
    const { data: member } = await supabase.from('circle_members').select('*').eq('circle_id', circle.id).eq('user_id', userId).single();
    if (!member) return res.status(403).json({ error: 'רק חברי קהילה יכולים לפרסם' });

    // 3. יצירת הפוסט
    const { data: post, error: postErr } = await supabase
      .from('posts')
      .insert({ user_id: userId, circle_id: circle.id, content })
      .select()
      .single();

    if (postErr) throw postErr;
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
