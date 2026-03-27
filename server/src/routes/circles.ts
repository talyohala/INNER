import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

router.get('/', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  try {
    const { data, error } = await supabase.from('circles').select('*, circle_members(user_id)').order('created_at', { ascending: false });
    if (error) throw error;
    
    const formattedData = data.map((c: any) => ({
      ...c,
      members_count: c.circle_members?.length || 0,
      is_member: userId ? c.circle_members?.some((m: any) => m.user_id === userId) : false
    }));
    res.json(formattedData);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { name, description, cover_url, is_private, join_price } = req.body;
  
  if (!name) return res.status(400).json({ error: 'שם הקהילה חובה' });
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9א-ת]+/g, '-') + '-' + Math.floor(Math.random() * 1000);

  try {
    const { data: circle, error } = await supabase.from('circles').insert({ 
      name, 
      description, 
      slug, 
      cover_url, 
      owner_id: userId,
      is_private: is_private || false,
      join_price: join_price || 0
    }).select().maybeSingle();
    
    if (error) throw error;
    
    await supabase.from('circle_members').insert({ circle_id: circle.id, user_id: userId, role: 'admin' });
    res.json(circle);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/:slug', async (req, res) => {
  const { slug } = req.params;
  const userId = req.headers['x-user-id'] as string;

  try {
    const { data: circle, error } = await supabase.from('circles').select('*').eq('slug', slug).maybeSingle();
    if (error || !circle) return res.status(404).json({ error: 'Circle not found' });

    let isMember = false;
    if (userId) {
      const { data: member } = await supabase.from('circle_members').select('user_id').eq('circle_id', circle.id).eq('user_id', userId).maybeSingle();
      if (member) isMember = true;
    }

    const { data: posts } = await supabase.from('posts').select(`id, content, created_at, profiles!inner(id, full_name, username, avatar_url), likes (user_id), comments (id)`).eq('circle_id', circle.id).order('created_at', { ascending: false });
    
    const formattedPosts = (posts || []).map((post: any) => ({
      ...post,
      likes_count: post.likes?.length || 0,
      comments_count: post.comments?.length || 0,
      is_liked: post.likes?.some((like: any) => like.user_id === userId) || false
    }));

    res.json({ circle, isMember, posts: formattedPosts });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/:slug/join', async (req, res) => {
  const { slug } = req.params;
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // משיכת נתוני הקהילה (כולל slug עבור הקישור בהתראה)
    const { data: circle } = await supabase.from('circles').select('id, name, slug, is_private, join_price, owner_id').eq('slug', slug).maybeSingle();
    if (!circle) return res.status(404).json({ error: 'Circle not found' });

    const { data: existing } = await supabase.from('circle_members').select('user_id').eq('circle_id', circle.id).eq('user_id', userId).maybeSingle();

    if (existing) {
      // עזיבת הקהילה (ללא החזר כספי כרגע)
      await supabase.from('circle_members').delete().eq('circle_id', circle.id).eq('user_id', userId);
      return res.json({ joined: false });
    } else {
      
      // === לוגיקת חיוב CRD והתראות לקהילות סגורות ===
      if (circle.is_private && circle.join_price > 0) {
        
        // 1. בדיקת יתרת המשתמש + שליפת השם שלו (עבור ההתראה)
        const { data: profile } = await supabase.from('profiles').select('credits, full_name, username').eq('id', userId).single();
        if (!profile || profile.credits < circle.join_price) {
          return res.status(400).json({ error: `אין לך מספיק CRD בארנק. חסרים לך ${circle.join_price - (profile?.credits || 0)} קרדיטים.` });
        }
        
        const joinerName = profile.full_name || profile.username || 'משתמש חדש';

        // 2. חיוב המשתמש ותיעוד העסקה
        await supabase.from('profiles').update({ credits: profile.credits - circle.join_price }).eq('id', userId);
        await supabase.from('transactions').insert({
          user_id: userId,
          amount: -circle.join_price,
          type: 'purchase',
          description: `דמי כניסה למועדון: ${circle.name}`
        });

        // 3. העברת ה-CRD ליוצר הקהילה ושליחת התראה
        if (circle.owner_id && circle.owner_id !== userId) {
          const { data: owner } = await supabase.from('profiles').select('credits').eq('id', circle.owner_id).single();
          if (owner) {
            // הוספת ה-CRD לארנק היוצר
            await supabase.from('profiles').update({ credits: owner.credits + circle.join_price }).eq('id', circle.owner_id);
            await supabase.from('transactions').insert({
              user_id: circle.owner_id,
              amount: circle.join_price,
              type: 'deposit',
              description: `הכנסה מהצטרפות חבר למועדון: ${circle.name}`
            });

            // --- שליחת ההתראה (Notification) ליוצר ---
            await supabase.from('notifications').insert({
              user_id: circle.owner_id,
              type: 'membership',
              title: 'חבר חדש במועדון! 🎉',
              content: `${joinerName} הצטרף/ה לקהילה "${circle.name}" ושילם/ה ${circle.join_price} CRD.`,
              action_url: `/circle/${circle.slug}`
            });
            // ----------------------------------------
          }
        }
      }
      // ======================================

      const { error: insertError } = await supabase.from('circle_members').insert({ circle_id: circle.id, user_id: userId, role: 'member' });
      if (insertError) {
        console.error('[CIRCLES] שגיאת אבטחה בצירוף:', insertError.message);
        throw insertError;
      }
      return res.json({ joined: true });
    }
  } catch (err: any) { 
    res.status(500).json({ error: err.message }); 
  }
});

router.post('/:slug/posts', async (req, res) => {
  const { slug } = req.params;
  const userId = req.headers['x-user-id'] as string;
  const { content } = req.body;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: circle } = await supabase.from('circles').select('id').eq('slug', slug).maybeSingle();
    if (!circle) return res.status(404).json({ error: 'Circle not found' });

    const { data: post, error } = await supabase.from('posts').insert({ content, user_id: userId, circle_id: circle.id }).select().single();
    if (error) throw error;
    res.json(post);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
