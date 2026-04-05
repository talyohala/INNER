import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';

const router = Router();

router.get('/profile', requireAuth, async (req: AuthedRequest, res) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', req.user!.id).single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.get('/collection', requireAuth, async (req: AuthedRequest, res) => {
  const { data: memberships } = await supabase
    .from('memberships')
    .select('id, tier, circle:circle_id(id, slug, name, cover_url, members_count)')
    .eq('user_id', req.user!.id);
    
  const { data: ownedCircles } = await supabase
    .from('circles')
    .select('id, slug, name, cover_url, members_count')
    .eq('creator_id', req.user!.id)
    .order('created_at', { ascending: false });

  res.json({ memberships: memberships || [], ownedCircles: ownedCircles || [] });
});

export default router;
