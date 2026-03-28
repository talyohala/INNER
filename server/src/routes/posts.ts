import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

// פונקציית עזר ליצירת התראה במסד הנתונים
const createNotification = async (receiverId: string, senderId: string, type: string, title: string, content: string, actionUrl: string) => {
  if (receiverId === senderId) return; // לא שולחים התראה לעצמך
  try {
    console.log(`[NOTIF] מנסה לייצר התראה עבור משתמש ${receiverId}`);
    const { error } = await supabase.from('notifications').insert({
      user_id: receiverId,
      type,
      title,
      content,
      action_url: actionUrl
    });
    if (error) console.error('[NOTIF] שגיאת Supabase בהתראה:', error.message);
    else console.log('[NOTIF] התראה נוצרה בהצלחה!');
  } catch (err) {
    console.error('[NOTIF] שגיאת קוד בהתראה:', err);
  }
};

// 1. מערכת הלייקים
router.post('/:postId/like', async (req, res) => {
  const { postId } = req.params;
  const userId = req.headers['x-user-id'] as string;
  
  if (!userId) {
    console.log('[LIKE] שגיאה: לא התקבל x-user-id מהאפליקציה');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log(`[LIKE] משתמש ${userId} מבצע פעולת לייק לפוסט ${postId}`);
    
    // בדיקה אם הלייק קיים
    const { data: existing, error: searchError } = await supabase
      .from('likes')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (searchError) throw searchError;

    if (existing) {
      console.log('[LIKE] מסיר לייק קיים...');
      const { error: delErr } = await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId);
      if (delErr) throw delErr;
      return res.json({ liked: false });
    } else {
      console.log('[LIKE] מוסיף לייק חדש...');
      const { error: insErr } = await supabase.from('likes').insert({ post_id: postId, user_id: userId });
      if (insErr) throw insErr;

      // משיכת פרטי הפוסט כדי לשלוח התראה
      const { data: post } = await supabase.from('posts').select('user_id').eq('id', postId).maybeSingle();
      if (post && post.user_id !== userId) {
        const { data: sender } = await supabase.from('profiles').select('full_name, username').eq('id', userId).maybeSingle();
        const senderName = sender?.full_name || sender?.username || 'משתמש';
        await createNotification(post.user_id, userId, 'like', 'לייק חדש! ❤️', `${senderName} אהב/ה את הפוסט שלך`, `/`);
      }

      return res.json({ liked: true });
    }
  } catch (err: any) {
    console.error("[LIKE] שגיאת שרת:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// 2. שליפת תגובות
router.get('/:postId/comments', async (req, res) => {
  const { postId } = req.params;
  try {
    const { data, error } = await supabase
      .from('comments')
      .select('id, content, created_at, profiles!inner(id, full_name, username, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// 3. פרסום תגובה
router.post('/:postId/comments', async (req, res) => {
  const { postId } = req.params;
  const userId = req.headers['x-user-id'] as string;
  const { content } = req.body;

  if (!userId || !content) return res.status(400).json({ error: 'Invalid data' });

  try {
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: userId, content })
      .select('id, content, created_at, profiles!inner(id, full_name, username, avatar_url)')
      .maybeSingle();
    
    if (error) throw error;

    const { data: post } = await supabase.from('posts').select('user_id').eq('id', postId).maybeSingle();
    if (post && post.user_id !== userId && data?.profiles) {
      const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
      const senderName = profile?.full_name || profile?.username || 'משתמש';
      await createNotification(post.user_id, userId, 'comment', 'תגובה חדשה 💬', `${senderName} הגיב/ה: "${content.substring(0, 20)}${content.length > 20 ? '...' : ''}"`, `/`);
    }

    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// 4. מתנות (Gifts)
router.post('/:postId/gift', async (req, res) => {
  const { postId } = req.params;
  const senderId = req.headers['x-user-id'] as string;
  const { amount } = req.body;

  if (!senderId || !amount) return res.status(400).json({ error: 'חסרים נתונים' });

  try {
    const { data: sender } = await supabase.from('profiles').select('credits, full_name, username').eq('id', senderId).maybeSingle();
    if (!sender || sender.credits < amount) return res.status(400).json({ error: 'אין מספיק קרדיטים' });

    const { data: post } = await supabase.from('posts').select('user_id').eq('id', postId).maybeSingle();
    if (!post) return res.status(404).json({ error: 'פוסט לא נמצא' });
    const receiverId = post.user_id;

    await supabase.from('profiles').update({ credits: sender.credits - amount }).eq('id', senderId);
    const { data: receiver } = await supabase.from('profiles').select('credits').eq('id', receiverId).maybeSingle();
    await supabase.from('profiles').update({ credits: (receiver?.credits || 0) + amount }).eq('id', receiverId);

    await supabase.from('transactions').insert([
      { user_id: senderId, amount: amount, type: 'purchase', description: 'שלחת מתנה' },
      { user_id: receiverId, amount: amount, type: 'deposit', description: 'קיבלת מתנה!' }
    ]);

    const senderName = sender?.full_name || sender?.username || 'משתמש';
    await createNotification(receiverId, senderId, 'gift', 'קיבלת מתנה! 🎁', `${senderName} שלח/ה לך ${amount} קרדיטים!`, `/`);

    res.json({ success: true, newBalance: sender.credits - amount });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
