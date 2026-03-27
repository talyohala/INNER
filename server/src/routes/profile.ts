import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

// שליפת נתוני הפרופיל (מה שעשינו קודם)
router.get('/collection', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    const { data: memberships } = await supabase.from('circle_members').select('circle:circles(*)').eq('user_id', userId).neq('role', 'admin');
    const { data: ownedCircles } = await supabase.from('circles').select('*').eq('owner_id', userId);

    res.json({ profile, memberships: memberships || [], ownedCircles: ownedCircles || [] });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// עדכון פרופיל (שם, יוזרניים, ביו, תמונה)
router.put('/', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { full_name, username, bio, avatar_url } = req.body;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name, username, bio, avatar_url })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
