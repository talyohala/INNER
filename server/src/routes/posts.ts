import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

// פונקציית עזר עוצמתית ליצירת התראות
const createNotification = async (userId: string, actorId: string, type: string, title: string, content: string, actionUrl?: string) => {
  if (userId === actorId) return; // לא שולחים התראה לעצמך
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      actor_id: actorId, // מי עשה את הפעולה
      type,
      title,
      content,
      action_url: actionUrl,
      is_read: false
    });
  } catch (err) {
    console.error('❌ Error creating notification:', err);
  }
};

// 1. לייק לפוסט
router.post('/:postId/like', async (req: Request, res: Response) => {
  const { postId } = req.params;
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: existing } = await supabase.from('likes').select('*').eq('post_id', postId).eq('user_id', userId).maybeSingle();

    if (existing) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId);
      return res.json({ liked: false });
    } else {
      await supabase.from('likes').insert({ post_id: postId, user_id: userId });

      // שליחת התראה ליוצר הפוסט
      const { data: post } = await supabase.from('posts').select('user_id, content').eq('id', postId).maybeSingle();
      if (post && post.user_id !== userId) {
        const postPreview = post.content ? `"${post.content.substring(0, 20)}..."` : 'הפוסט שלך';
        await createNotification(post.user_id, userId, 'like', 'קיבלת לייק! ❤️', `מישהו אהב את ${postPreview}`, `/?post=${postId}`);
      }
      return res.json({ liked: true });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. תגובה לפוסט
router.post('/:postId/comments', async (req: Request, res: Response) => {
  const { postId } = req.params;
  const userId = req.headers['x-user-id'] as string;
  const { content } = req.body;

  if (!userId || !content) return res.status(400).json({ error: 'Invalid data' });

  try {
    const { data: comment, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: userId, content })
      .select('id, content, created_at, profiles!inner(id, full_name, username, avatar_url)')
      .single();
    
    if (error) throw error;

    // שליחת התראה ליוצר הפוסט
    const { data: post } = await supabase.from('posts').select('user_id').eq('id', postId).maybeSingle();
    if (post && post.user_id !== userId) {
      await createNotification(post.user_id, userId, 'comment', 'תגובה חדשה 💬', `הגיב/ה: "${content.substring(0, 30)}..."`, `/?post=${postId}`);
    }

    res.json(comment);
  } catch (err: any) { 
    res.status(500).json({ error: err.message }); 
  }
});

// 3. שליחת מתנה (Gift)
router.post('/:postId/gift', async (req: Request, res: Response) => {
  const { postId } = req.params;
  const senderId = req.headers['x-user-id'] as string;
  const { amount } = req.body;

  if (!senderId || !amount) return res.status(400).json({ error: 'Missing data' });

  try {
    const { data: sender } = await supabase.from('profiles').select('credits').eq('id', senderId).single();
    if (!sender || sender.credits < amount) return res.status(400).json({ error: 'Not enough CRD' });

    const { data: post } = await supabase.from('posts').select('user_id').eq('id', postId).single();
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const receiverId = post.user_id;

    // העברת הכספים
    await supabase.from('profiles').update({ credits: sender.credits - amount }).eq('id', senderId);
    
    const { data: receiver } = await supabase.from('profiles').select('credits').eq('id', receiverId).single();
    await supabase.from('profiles').update({ credits: (receiver?.credits || 0) + amount }).eq('id', receiverId);

    // כתיבת טרנזקציות
    await supabase.from('transactions').insert([
      { user_id: senderId, amount: -amount, type: 'purchase', description: 'שלחת מתנה' },
      { user_id: receiverId, amount: amount, type: 'deposit', description: 'קיבלת מתנה!' }
    ]);

    // התראה למקבל
    await createNotification(receiverId, senderId, 'gift', 'קיבלת מתנה! 🎁', `שלח/ה לך ${amount} CRD על הפוסט שלך!`, `/wallet`);

    res.json({ success: true, newBalance: sender.credits - amount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
