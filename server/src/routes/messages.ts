import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';

const router = Router();

router.get('/:circleId', async (req, res) => {
  try {
    const { circleId } = req.params;

    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        body,
        is_highlighted,
        created_at,
        user_id,
        profile:user_id (
          id,
          full_name,
          username,
          avatar_url,
          role_label
        )
      `)
      .eq('circle_id', circleId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json(data || []);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load messages' });
  }
});

router.post('/:circleId', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { circleId } = req.params;
    const userId = req.user!.id;
    const { body, isHighlighted = false } = req.body || {};

    if (!body || !String(body).trim()) {
      return res.status(400).json({ error: 'Message body is required' });
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        circle_id: circleId,
        user_id: userId,
        body: String(body).trim(),
        is_highlighted: Boolean(isHighlighted)
      })
      .select(`
        id,
        body,
        is_highlighted,
        created_at,
        user_id,
        profile:user_id (
          id,
          full_name,
          username,
          avatar_url,
          role_label
        )
      `)
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to send message' });
  }
});

export default router;
