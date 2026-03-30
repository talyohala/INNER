import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import toast from 'react-hot-toast';
import { Users, Lock, Flame, Sparkles, Target, MessageCircle, ArrowUpRight, Heart, Share2, Bell, X, Reply, UserCircle, Edit2, Trash2, Video } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

type Circle = { id: string; slug: string; name: string; description?: string | null; cover_url?: string | null; members_count?: number | null; vip_price?: number | null; created_at?: string | null; };
type FeedResponse = Circle[] | { items?: Circle[]; circles?: Circle[]; data?: Circle[]; };
type FeedTab = 'hot' | 'new' | 'foryou';

const TABS = [
  { key: 'hot', label: 'חם עכשיו', icon: Flame, color: 'text-orange-400' },
  { key: 'new', label: 'חדשים', icon: Sparkles, color: 'text-blue-400' },
  { key: 'foryou', label: 'בשבילך', icon: Target, color: 'text-purple-400' },
] as const;

export const FeedPage: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FeedTab>('hot');
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // מגירות (Bottom Sheets)
  const descDragControls = useDragControls();
  const commentsDragControls = useDragControls();
  const [activeDescPost, setActiveDescPost] = useState<any | null>(null);
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  
  // מערכת תגובות
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [editingComment, setEditingComment] = useState<any | null>(null);

  // הפונקציה המקורית והמנצחת שלך לחילוץ נתונים
  const normalizeItems = (payload: FeedResponse): Circle[] => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray((payload as any)?.items)) return (payload as any).items;
    if (Array.isArray((payload as any)?.data)) return (payload as any).data;
    if (Array.isArray((payload as any)?.circles)) return (payload as any).circles;
    return [];
  };

  const loadFeed = async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) setCurrentUserId(authData.user.id);

      // 1. קריאה לשרת למועדונים (בדיוק כפי שהיה אצלך)
      const result = await apiFetch<FeedResponse>('/api/feed');
      const circles = normalizeItems(result);
      
      const mappedCircles = circles.map((c: any) => ({
        id: c.id || c.slug,
        is_circle: true,
        slug: c.slug,
        media_type: 'image',
        media_url: c.cover_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop',
        content: c.description || 'היכנס כדי לראות את הקהילה',
        created_at: c.created_at || new Date().toISOString(),
        members_count: c.members_count || 0,
        vip_price: c.vip_price || 0,
        profiles: { username: c.name, full_name: c.name, avatar_url: c.cover_url },
        post_likes: [],
        post_comments: []
      }));

      // 2. קריאה לסרטונים מ-Supabase (וידאו אמיתי)
      let mappedPosts: any[] = [];
      try {
        const { data: dbPosts } = await supabase
          .from('posts')
          .select(`*, profiles(id, username, full_name, avatar_url), post_likes(user_id), post_comments(id)`);
        mappedPosts = dbPosts || [];
      } catch (e) {}

      // מיזוג של הסרטונים והמועדונים הישנים יחד!
      setItems([...mappedPosts, ...mappedCircles]);
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בטעינת הפיד');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFeed(); }, []);

  const createDemoPost = async () => {
    triggerFeedback('pop');
    const tid = toast.loading('מעלה סרטון דמו...');
    try {
      const { error } = await supabase.from('posts').insert({
        user_id: currentUserId,
        content: 'הסרטון הראשון באפליקציה! טיקטוק סטייל 🚀',
        media_url: 'https://cdn.pixabay.com/video/2020/05/24/40061-424553805_tiny.mp4',
        media_type: 'video'
      });
      if (error) throw error;
      toast.success('עלה בהצלחה!', { id: tid });
      loadFeed();
    } catch (e: any) {
      toast.error('שגיאה', { id: tid });
    }
  };

  // הסידור המקורי שלך
  const sortedItems = useMemo(() => {
    const arr = [...items];
    if (activeTab === 'new') return arr.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    if (activeTab === 'foryou') return arr.sort(() => Math.random() - 0.5);
    // חם עכשיו:
    return arr.sort((a, b) => {
      const scoreA = (Number(a.members_count) || 0) * 2 + (Number(a.vip_price) || 0) + (a.post_likes?.length || 0);
      const scoreB = (Number(b.members_count) || 0) * 2 + (Number(b.vip_price) || 0) + (b.post_likes?.length || 0);
      if (scoreA === scoreB) return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      return scoreB - scoreA;
    });
  }, [items, activeTab]);

  const handleLikePost = async (postId: string, isLiked: boolean, isCircle: boolean) => {
    if (isCircle) return toast('לייקים למועדונים בקרוב!', { icon: '✨', style: {background: '#111', color: '#fff'} });
    triggerFeedback('pop');
    
    setItems(items.map(p => {
      if (p.id === postId) {
        const safeLikes = p.post_likes || [];
        return { ...p, post_likes: isLiked ? safeLikes.filter((l:any) => l.user_id !== currentUserId) : [...safeLikes, { user_id: currentUserId }] };
      }
      return p;
    }));

    if (isLiked) {
      await supabase.from('post_likes').delete().match({ post_id: postId, user_id: currentUserId });
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: currentUserId });
    }
  };

  // ================== מערכת תגובות מול סופאבייס ==================
  const openComments = async (postId: string, isCircle: boolean) => {
    if (isCircle) return toast('תגובות למועדונים בקרוב!', { icon: '💬', style: {background: '#111', color: '#fff'} });
    triggerFeedback('pop');
    setActiveCommentsPostId(postId);
    setLoadingComments(true);
    setComments([]);
    setReplyingTo(null);
    setEditingComment(null);

    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select(`*, profiles(id, username, full_name, avatar_url), comment_likes(user_id)`)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setComments(data || []);
    } catch (err) {} finally {
      setLoadingComments(false);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim() || !activeCommentsPostId) return;
    const text = commentText.trim();
    setCommentText('');
    triggerFeedback('pop');

    try {
      if (editingComment) {
        const { data, error } = await supabase.from('post_comments').update({ content: text, updated_at: new Date().toISOString() })
          .eq('id', editingComment.id).select('*, profiles(id, username, full_name, avatar_url), comment_likes(user_id)').single();
        if (error) throw error;
        setComments(comments.map(c => c.id === editingComment.id ? data : c));
        setEditingComment(null);
      } else {
        const { data, error } = await supabase.from('post_comments').insert({
            post_id: activeCommentsPostId, user_id: currentUserId, content: text, parent_id: replyingTo ? replyingTo.id : null
        }).select('*, profiles(id, username, full_name, avatar_url), comment_likes(user_id)').single();
        if (error) throw error;
        setComments([...comments, data]);
        setReplyingTo(null);
        setItems(items.map(p => p.id === activeCommentsPostId ? { ...p, post_comments: [...(p.post_comments||[]), {id: data.id}] } : p));
      }
    } catch (err) { toast.error('שגיאה בשליחת תגובה'); }
  };

  const handleLikeComment = async (commentId: string, isLiked: boolean) => {
    triggerFeedback('pop');
    setComments(comments.map(c => {
      if (c.id === commentId) {
        const safeLikes = c.comment_likes || [];
        return { ...c, comment_likes: isLiked ? safeLikes.filter((l:any) => l.user_id !== currentUserId) : [...safeLikes, { user_id: currentUserId }] };
      }
      return c;
    }));
    if (isLiked) {
      await supabase.from('comment_likes').delete().match({ comment_id: commentId, user_id: currentUserId });
    } else {
      await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: currentUserId });
    }
  };

  const deleteComment = async (commentId: string) => {
    triggerFeedback('error');
    setComments(comments.filter(c => c.id !== commentId && c.parent_id !== commentId));
    await supabase.from('post_comments').delete().eq('id', commentId);
  };

  const topLevelComments = comments.filter(c => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter(c => c.parent_id === parentId);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white/20 font-black animate-pulse text-xl tracking-widest uppercase">SCANNING...</div>;

  return (
    <FadeIn className="bg-black font-sans overflow-hidden" dir="rtl">
      
      {/* הדר טיקטוק צף למעלה + פעמון לבן */}
      <div className="fixed top-12 left-0 right-0 z-50 flex items-center justify-center pointer-events-none px-5">
        <button onClick={() => triggerFeedback('pop')} className="absolute left-5 w-10 h-10 rounded-full flex items-center justify-center pointer-events-auto active:scale-95 transition-all">
          <Bell size={24} className="text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]" />
        </button>

        <div className="flex items-center gap-5 pointer-events-auto drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
          {TABS.map((tab) => (
            <button 
              key={tab.key}
              onClick={() => { triggerFeedback('pop'); setActiveTab(tab.key as FeedTab); }}
              className={`text-[15px] transition-all duration-300 pb-1 ${activeTab === tab.key ? 'font-black text-white border-b-2 border-white' : 'font-bold text-white/60'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide pb-[80px]">
        {sortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <Flame size={40} className="text-white/20" />
            <h2 className="text-white font-black text-xl">אין תוכן עדיין</h2>
            <Button onClick={createDemoPost} className="h-12 px-6 mt-4 bg-white text-black font-black text-[13px] uppercase rounded-full">
              העלה סרטון דמו
            </Button>
          </div>
        ) : (
          sortedItems.map((post) => {
            const isLiked = (post.post_likes || []).some((l: any) => l.user_id === currentUserId);
            const isCircle = post.is_circle;
            
            return (
              <div key={post.id} className="relative w-full h-[100dvh] bg-black snap-center">
                
                {/* התוכן: מקצה לקצה 100% */}
                {post.media_type === 'video' ? (
                  <video src={post.media_url} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0" />
                ) : (
                  <div className="absolute inset-0 w-full h-full bg-cover bg-center z-0" style={{ backgroundImage: `url(${post.media_url})` }} />
                )}

                {/* הצללה תחתונה עמוקה כדי שהכפתורים והטקסט תמיד יבלטו */}
                <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-black via-black/40 to-transparent z-10 pointer-events-none" />

                {/* תצוגת הכפתורים והטקסט (בדיוק מעל התפריט התחתון) */}
                <div className="absolute bottom-[90px] left-0 right-0 z-20 px-4 flex items-end justify-between pointer-events-none">
                  
                  {/* מידע משתמש ותיאור - צד ימין (RTL) - מקסימום 75% רוחב כדי לא לדרוס את הכפתורים */}
                  <div className="flex flex-col gap-2 max-w-[75%] pointer-events-auto">
                    
                    {/* כפתור לקהילות ישנות */}
                    {isCircle && (
                      <button onClick={() => navigate(`/circle/${post.slug}`)} className="mb-2 w-max px-4 py-2 bg-[#2196f3] rounded-full flex items-center gap-1.5 text-white font-black text-[12px] uppercase tracking-widest shadow-[0_0_20px_rgba(33,150,243,0.4)] active:scale-95 transition-transform">
                        <Users size={14} />
                        היכנס לקהילה
                      </button>
                    )}

                    <div className="flex items-center gap-2">
                      <span className="text-white font-black text-[16px] drop-shadow-md">
                        {post.profiles?.full_name || `@${post.profiles?.username}`}
                      </span>
                    </div>
                    
                    {/* תיאור שנפתח במגירה */}
                    {post.content && (
                      <div onClick={() => { triggerFeedback('pop'); setActiveDescPost(post); }} className="cursor-pointer group mt-1">
                        <p className="text-white/90 text-[14px] font-medium leading-snug line-clamp-2 drop-shadow-md">
                          {post.content}
                        </p>
                        <span className="text-white/60 text-[12px] font-bold mt-1 inline-block">קרא עוד...</span>
                      </div>
                    )}
                  </div>

                  {/* כפתורי פעולות - צד שמאל באנך */}
                  <div className="flex flex-col gap-4 items-center pointer-events-auto pb-4">
                    
                    <div className="w-12 h-12 rounded-full border-2 border-white overflow-hidden shadow-lg bg-black mb-1">
                      {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={24} className="text-white w-full h-full p-1.5" />}
                    </div>

                    <button onClick={() => handleLikePost(post.id, isLiked, isCircle)} className="flex flex-col items-center gap-1 active:scale-75 transition-all">
                      <div className="drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                        <Heart size={34} className={isLiked ? 'text-red-500 fill-red-500' : 'text-white fill-white/20'} />
                      </div>
                      <span className="text-white font-bold text-[12px] drop-shadow-md">{post.post_likes?.length || 0}</span>
                    </button>

                    <button onClick={() => openComments(post.id, isCircle)} className="flex flex-col items-center gap-1 active:scale-75 transition-all">
                      <div className="drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                        <MessageCircle size={34} className="text-white fill-white/20" />
                      </div>
                      <span className="text-white font-bold text-[12px] drop-shadow-md">{post.post_comments?.length || 0}</span>
                    </button>

                    <button onClick={() => { triggerFeedback('pop'); toast('הועתק ללוח!'); }} className="flex flex-col items-center gap-1 active:scale-75 transition-all">
                      <div className="drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                        <Share2 size={34} className="text-white fill-white/20" />
                      </div>
                      <span className="text-white font-bold text-[12px] drop-shadow-md">שתף</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ================== חלונות צפים ================== */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <>
          {/* מגירת תיאור */}
          <AnimatePresence>
            {activeDescPost && (
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setActiveDescPost(null)} />
                <motion.div
                  drag="y" dragControls={descDragControls} dragListener={false} dragConstraints={{ top: 0 }} dragElastic={0.2}
                  onDragEnd={(e, { offset, velocity }) => { if (offset.y > 100 || velocity.y > 400) setActiveDescPost(null); }}
                  initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="bg-[#111] border-t border-white/10 rounded-t-[36px] max-h-[80vh] min-h-[40vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.9)] relative overflow-hidden"
                >
                  <div onPointerDown={(e) => descDragControls.start(e)} style={{ touchAction: 'none' }} className="w-full flex flex-col items-center pt-5 pb-4 cursor-grab active:cursor-grabbing bg-white/[0.02]">
                    <div className="w-16 h-1.5 bg-white/20 rounded-full mb-4 pointer-events-none"></div>
                    <div className="px-6 flex items-center justify-between w-full">
                      <h3 className="text-[16px] font-black text-white">תיאור מלא</h3>
                      <button onClick={() => setActiveDescPost(null)} className="text-white/40 hover:text-white"><X size={20} /></button>
                    </div>
                  </div>
                  <div className="p-6 overflow-y-auto scrollbar-hide text-white/90 text-[15px] leading-loose whitespace-pre-wrap pb-20">
                    {activeDescPost.content}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* מגירת תגובות מלאה כולל עריכה ותת-תגובות */}
          <AnimatePresence>
            {activeCommentsPostId && (
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setActiveCommentsPostId(null)} />
                <motion.div
                  drag="y" dragControls={commentsDragControls} dragListener={false} dragConstraints={{ top: 0 }} dragElastic={0.2}
                  onDragEnd={(e, { offset, velocity }) => { if (offset.y > 100 || velocity.y > 400) setActiveCommentsPostId(null); }}
                  initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="bg-[#111] border-t border-white/10 rounded-t-[36px] h-[85vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.9)] relative overflow-hidden"
                >
                  <div onPointerDown={(e) => commentsDragControls.start(e)} style={{ touchAction: 'none' }} className="w-full flex flex-col items-center pt-5 pb-2 cursor-grab active:cursor-grabbing bg-white/[0.02]">
                    <div className="w-16 h-1.5 bg-white/20 rounded-full mb-4 pointer-events-none"></div>
                    <div className="px-6 flex items-center justify-between w-full">
                      <h3 className="text-[16px] font-black text-white">{comments.length} תגובות</h3>
                      <button onClick={() => setActiveCommentsPostId(null)} className="text-white/40 hover:text-white p-2 -mr-2"><X size={20} /></button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 scrollbar-hide pb-32">
                    {loadingComments ? (
                      <div className="flex justify-center pt-20"><Loader2 className="animate-spin text-white/20" /></div>
                    ) : comments.length === 0 ? (
                      <div className="text-center pt-20 text-white/30 font-bold text-[14px]">אין תגובות עדיין. היה הראשון!</div>
                    ) : (
                      topLevelComments.map(comment => {
                        const isLiked = (comment.comment_likes || []).some((l:any) => l.user_id === currentUserId);
                        const replies = getReplies(comment.id);
                        const isMyComment = comment.user_id === currentUserId;

                        return (
                          <div key={comment.id} className="flex flex-col gap-3">
                            <div className="flex items-start gap-3 group">
                              <div className="w-9 h-9 rounded-full bg-black border border-white/10 overflow-hidden shrink-0 mt-1">
                                {comment.profiles?.avatar_url ? <img src={comment.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={20} className="text-white/50 w-full h-full p-1" />}
                              </div>
                              <div className="flex flex-col flex-1 gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-white/60 text-[12px] font-black">{comment.profiles?.username || 'משתמש'}</span>
                                  <span className="text-white/30 text-[10px]">{new Date(comment.created_at).toLocaleDateString('he-IL')}</span>
                                </div>
                                <p className="text-white text-[14px] leading-relaxed">{comment.content}</p>
                                
                                <div className="flex items-center gap-4 mt-1 text-white/40 text-[11px] font-bold">
                                  <button onClick={() => setReplyingTo(comment)} className="hover:text-white flex items-center gap-1"><Reply size={12}/> הגב</button>
                                  {isMyComment && (
                                    <>
                                      <button onClick={() => { setEditingComment(comment); setCommentText(comment.content); }} className="hover:text-white flex items-center gap-1"><Edit2 size={12}/> ערוך</button>
                                      <button onClick={() => deleteComment(comment.id)} className="hover:text-red-400 flex items-center gap-1"><Trash2 size={12}/> מחק</button>
                                    </>
                                  )}
                                </div>
                              </div>
                              <button onClick={() => handleLikeComment(comment.id, isLiked)} className="flex flex-col items-center gap-1 pt-2 shrink-0">
                                <Heart size={14} className={isLiked ? 'text-red-500 fill-red-500' : 'text-white/30 hover:text-white'} />
                                {(comment.comment_likes?.length || 0) > 0 && <span className="text-white/40 text-[9px]">{comment.comment_likes.length}</span>}
                              </button>
                            </div>

                            {/* תת-תגובות מיושרות שמאלה */}
                            {replies.length > 0 && (
                              <div className="mr-12 flex flex-col gap-4 border-r-2 border-white/10 pr-4">
                                {replies.map(reply => {
                                  const isReplyLiked = (reply.comment_likes || []).some((l:any) => l.user_id === currentUserId);
                                  const isMyReply = reply.user_id === currentUserId;
                                  return (
                                    <div key={reply.id} className="flex items-start gap-3">
                                      <div className="w-7 h-7 rounded-full bg-black border border-white/10 overflow-hidden shrink-0 mt-0.5">
                                        {reply.profiles?.avatar_url ? <img src={reply.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={16} className="text-white/50 w-full h-full p-1" />}
                                      </div>
                                      <div className="flex flex-col flex-1 gap-0.5">
                                        <span className="text-white/60 text-[11px] font-black">{reply.profiles?.username || 'משתמש'}</span>
                                        <p className="text-white/90 text-[13px]">{reply.content}</p>
                                        <div className="flex items-center gap-3 mt-1 text-white/40 text-[10px] font-bold">
                                          {isMyReply && (
                                            <>
                                              <button onClick={() => { setEditingComment(reply); setCommentText(reply.content); }} className="hover:text-white">ערוך</button>
                                              <button onClick={() => deleteComment(reply.id)} className="hover:text-red-400">מחק</button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      <button onClick={() => handleLikeComment(reply.id, isReplyLiked)} className="flex flex-col items-center gap-1 pt-1 shrink-0">
                                        <Heart size={12} className={isReplyLiked ? 'text-red-500 fill-red-500' : 'text-white/30 hover:text-white'} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* אזור כתיבת תגובה קבוע למטה */}
                  <div className="absolute bottom-0 left-0 right-0 bg-[#111] border-t border-white/10 p-4 pb-8 flex flex-col gap-2 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
                    {(replyingTo || editingComment) && (
                      <div className="flex items-center justify-between px-2 text-[11px] text-[#2196f3] font-bold">
                        <span>{editingComment ? 'עורך תגובה...' : `מגיב ל-@${replyingTo.profiles?.username || 'משתמש'}`}</span>
                        <button onClick={() => { setReplyingTo(null); setEditingComment(null); setCommentText(''); }}><X size={14}/></button>
                      </div>
                    )}
                    <div className="flex items-center gap-3 relative">
                      <input 
                        type="text" 
                        value={commentText} 
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="הוסף תגובה..." 
                        dir="rtl"
                        className="flex-1 h-12 bg-white/5 border border-white/10 rounded-full px-5 text-white text-[14px] focus:outline-none focus:border-white/30 transition-all placeholder:text-white/30"
                      />
                      <button 
                        onClick={submitComment}
                        disabled={!commentText.trim()}
                        className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center disabled:opacity-50 active:scale-95 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                      >
                        <Send size={18} className="-ml-1" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>,
        document.body
      )}
    </FadeIn>
  );
};
