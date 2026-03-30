import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Loader2, Heart, MessageCircle, Share2, Bell, X, Reply, UserCircle, Users, ArrowUpRight, Flame, Sparkles, Target, Edit2, Trash2, Video } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

type FeedTab = 'hot' | 'new' | 'foryou';

const TABS = [
  { key: 'hot', label: 'חם עכשיו', icon: Flame, color: 'text-orange-400' },
  { key: 'new', label: 'חדשים', icon: Sparkles, color: 'text-blue-400' },
  { key: 'foryou', label: 'בשבילך', icon: Target, color: 'text-purple-400' },
] as const;

export const FeedPage: React.FC = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<FeedTab>('hot');

  const descDragControls = useDragControls();
  const commentsDragControls = useDragControls();
  
  const [activeDescPost, setActiveDescPost] = useState<any | null>(null);
  
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [editingComment, setEditingComment] = useState<any | null>(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) setCurrentUserId(authData.user.id);

      // 1. שליפה ישירה מ-Supabase של הסרטונים החדשים
      let newPosts: any[] = [];
      try {
        const { data, error } = await supabase
          .from('posts')
          .select(`*, profiles(id, username, full_name, avatar_url), post_likes(user_id), post_comments(id)`);
        if (!error && data) newPosts = data;
      } catch (e) {
        console.error('No posts table found', e);
      }

      // 2. שליפה ישירה מ-Supabase של הקהילות (המועדונים הישנים) - בלי שרת באמצע!
      let oldItems: any[] = [];
      try {
        const { data: circlesData, error: circlesError } = await supabase
          .from('circles')
          .select('*');
          
        if (!circlesError && circlesData) {
          oldItems = circlesData.map((c: any) => ({
            id: c.id || c.slug,
            is_circle: true,
            slug: c.slug,
            media_type: 'image',
            media_url: c.cover_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop',
            content: c.description || 'לחץ כדי להצטרף לקהילה!',
            created_at: c.created_at || new Date().toISOString(),
            members_count: c.members_count || 0,
            vip_price: c.vip_price || 0,
            profiles: { username: c.name, full_name: c.name, avatar_url: c.cover_url },
            post_likes: [],
            post_comments: []
          }));
        }
      } catch (e) {
        console.error('Failed fetching circles directly from Supabase', e);
      }

      // 3. מיזוג של הכל ביחד וסידור
      const combinedPosts = [...newPosts, ...oldItems];
      setPosts(combinedPosts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createDemoPost = async () => {
    triggerFeedback('pop');
    const tid = toast.loading('מעלה סרטון דמו ישירות לסופאבייס...');
    try {
      const { error } = await supabase.from('posts').insert({
        user_id: currentUserId,
        content: 'זה הסרטון הראשון שלי באפליקציה החדשה! 🔥 בואו נראה איך עובדות התגובות והלייקים...',
        media_url: 'https://cdn.pixabay.com/video/2020/05/24/40061-424553805_tiny.mp4',
        media_type: 'video'
      });
      if (error) throw error;
      toast.success('הסרטון באוויר!', { id: tid });
      fetchPosts();
    } catch (e: any) {
      toast.error('שגיאה בהעלאה: ' + e.message, { id: tid });
    }
  };

  // סידור הפיד
  const sortedItems = useMemo(() => {
    const arr = [...posts];
    if (activeTab === 'new') return arr.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    if (activeTab === 'foryou') return arr.sort(() => Math.random() - 0.5);
    return arr.sort((a, b) => {
      const scoreB = (Number(b.members_count) || 0) * 2 + (Number(b.vip_price) || 0) + (b.post_likes?.length || 0);
      const scoreA = (Number(a.members_count) || 0) * 2 + (Number(a.vip_price) || 0) + (a.post_likes?.length || 0);
      if (scoreA === scoreB) return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      return scoreB - scoreA;
    });
  }, [posts, activeTab]);

  const handleLikePost = async (postId: string, isLiked: boolean, isCircle: boolean) => {
    if (isCircle) return toast('לייקים למועדונים יתווספו בקרוב!', { icon: '✨', style: {background: '#111', color: '#fff'} });
    
    triggerFeedback('pop');
    setPosts(posts.map(p => {
      if (p.id === postId) {
        const safeLikes = p.post_likes || [];
        const newLikes = isLiked 
          ? safeLikes.filter((l: any) => l.user_id !== currentUserId)
          : [...safeLikes, { user_id: currentUserId }];
        return { ...p, post_likes: newLikes };
      }
      return p;
    }));

    if (isLiked) {
      await supabase.from('post_likes').delete().match({ post_id: postId, user_id: currentUserId });
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: currentUserId });
    }
  };

  const openComments = async (postId: string, isCircle: boolean) => {
    if (isCircle) return toast('תגובות למועדונים יפתחו בקרוב!', { icon: '💬', style: {background: '#111', color: '#fff'} });
    
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
    } catch (err) {
      console.error(err);
    } finally {
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
        const { data, error } = await supabase
          .from('post_comments')
          .update({ content: text, updated_at: new Date().toISOString() })
          .eq('id', editingComment.id)
          .select('*, profiles(id, username, full_name, avatar_url), comment_likes(user_id)').single();
          
        if (error) throw error;
        setComments(comments.map(c => c.id === editingComment.id ? data : c));
        setEditingComment(null);
        toast.success('התגובה עודכנה');
      } else {
        const { data, error } = await supabase
          .from('post_comments')
          .insert({
            post_id: activeCommentsPostId,
            user_id: currentUserId,
            content: text,
            parent_id: replyingTo ? replyingTo.id : null
          })
          .select('*, profiles(id, username, full_name, avatar_url), comment_likes(user_id)').single();

        if (error) throw error;
        setComments([...comments, data]);
        setReplyingTo(null);
        setPosts(posts.map(p => p.id === activeCommentsPostId ? { ...p, post_comments: [...(p.post_comments||[]), {id: data.id}] } : p));
      }
    } catch (err) {
      toast.error('שגיאה בשליחת התגובה');
    }
  };

  const handleLikeComment = async (commentId: string, isLiked: boolean) => {
    triggerFeedback('pop');
    setComments(comments.map(c => {
      if (c.id === commentId) {
        const safeLikes = c.comment_likes || [];
        const newLikes = isLiked 
          ? safeLikes.filter((l: any) => l.user_id !== currentUserId)
          : [...safeLikes, { user_id: currentUserId }];
        return { ...c, comment_likes: newLikes };
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
    toast.success('התגובה נמחקה');
  };

  const topLevelComments = comments.filter(c => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter(c => c.parent_id === parentId);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  return (
    <FadeIn className="bg-black font-sans overflow-hidden" dir="rtl">
      
      {/* הדר טיקטוק צף למעלה */}
      <div className="fixed top-10 left-0 right-0 z-50 flex items-center justify-center pointer-events-none px-5">
        <button onClick={() => triggerFeedback('pop')} className="absolute right-5 w-10 h-10 rounded-full flex items-center justify-center pointer-events-auto active:scale-95 transition-all">
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

      <div className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide pb-16">
        {sortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 px-8 text-center pt-20">
            <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
              <Video size={40} className="text-white/30" />
            </div>
            <div>
              <h2 className="text-white font-black text-[22px] mb-2">הפיד ריק!</h2>
              <p className="text-white/40 text-[13px] font-medium leading-relaxed">אין כרגע סרטונים או קהילות במסד הנתונים.</p>
            </div>
            <Button onClick={createDemoPost} className="h-14 px-8 mt-4 bg-white text-black font-black text-[14px] uppercase tracking-widest rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)]">
              הזרק סרטון דמו
            </Button>
          </div>
        ) : (
          sortedItems.map(post => {
            const isLiked = (post.post_likes || []).some((l: any) => l.user_id === currentUserId);
            const isCircle = post.is_circle;
            
            return (
              <div key={post.id} className="relative w-full h-[100dvh] bg-black snap-center">
                
                {post.media_type === 'video' ? (
                  <video src={post.media_url} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0" />
                ) : (
                  <div className="absolute inset-0 w-full h-full bg-cover bg-center z-0" style={{ backgroundImage: `url(${post.media_url})` }} />
                )}

                <div className="absolute bottom-0 left-0 right-0 h-2/3 z-10 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

                <div className="absolute bottom-[90px] left-0 right-0 z-20 px-4 flex items-end justify-between pointer-events-none">
                  
                  <div className="flex flex-col gap-2 max-w-[75%] pointer-events-auto">
                    {isCircle && (
                      <button onClick={() => navigate(`/circle/${post.slug}`)} className="mb-1 w-max px-4 py-2 bg-[#2196f3] rounded-full flex items-center gap-1.5 text-white font-black text-[12px] uppercase tracking-widest shadow-[0_0_20px_rgba(33,150,243,0.4)] active:scale-95 transition-transform">
                        <Users size={14} />
                        היכנס לקהילה
                        <ArrowUpRight size={14} />
                      </button>
                    )}

                    <span className="text-white font-black text-[16px] drop-shadow-md">
                      {post.profiles?.full_name || `@${post.profiles?.username}`}
                    </span>
                    
                    {post.content && (
                      <div onClick={() => { triggerFeedback('pop'); setActiveDescPost(post); }} className="cursor-pointer group">
                        <p className="text-white/90 text-[14px] font-medium leading-snug line-clamp-2 drop-shadow-md">
                          {post.content}
                        </p>
                        <span className="text-white/50 text-[12px] font-bold mt-1 inline-block">קרא עוד...</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-4 items-center pointer-events-auto">
                    <div className="w-12 h-12 rounded-full border-2 border-white overflow-hidden shadow-lg bg-black mb-2">
                      {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={24} className="text-white w-full h-full p-1.5" />}
                    </div>

                    <button onClick={() => handleLikePost(post.id, isLiked, isCircle)} className="flex flex-col items-center gap-1 active:scale-75 transition-all">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                        <Heart size={32} className={isLiked ? 'text-red-500 fill-red-500' : 'text-white fill-white/20'} />
                      </div>
                      <span className="text-white font-bold text-[12px] drop-shadow-md">{post.post_likes?.length || 0}</span>
                    </button>

                    <button onClick={() => openComments(post.id, isCircle)} className="flex flex-col items-center gap-1 active:scale-75 transition-all">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                        <MessageCircle size={32} className="text-white fill-white/20" />
                      </div>
                      <span className="text-white font-bold text-[12px] drop-shadow-md">{post.post_comments?.length || 0}</span>
                    </button>

                    <button onClick={() => { triggerFeedback('pop'); toast('הועתק ללוח!'); }} className="flex flex-col items-center gap-1 active:scale-75 transition-all">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                        <Share2 size={32} className="text-white fill-white/20" />
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
          <AnimatePresence>
            {activeDescPost && (
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setActiveDescPost(null)} />
                <motion.div
                  drag="y" dragControls={descDragControls} dragListener={false} dragConstraints={{ top: 0 }} dragElastic={0.2}
                  onDragEnd={(e, { offset, velocity }) => { if (offset.y > 100 || velocity.y > 400) setActiveDescPost(null); }}
                  initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="bg-[#111] border-t border-white/10 rounded-t-[36px] max-h-[80vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.9)] relative overflow-hidden"
                >
                  <div onPointerDown={(e) => descDragControls.start(e)} style={{ touchAction: 'none' }} className="w-full flex flex-col items-center pt-5 pb-4 cursor-grab active:cursor-grabbing bg-white/[0.02]">
                    <div className="w-16 h-1.5 bg-white/20 rounded-full mb-4 pointer-events-none"></div>
                    <div className="px-6 pb-2 flex items-center justify-start w-full">
                      <h3 className="text-[16px] font-black text-white">תיאור מלא</h3>
                    </div>
                  </div>
                  <div className="p-6 overflow-y-auto scrollbar-hide text-white/80 text-[14px] leading-loose whitespace-pre-wrap pb-20">
                    {activeDescPost.content}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

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
                              <div className="w-9 h-9 rounded-full bg-black border border-white/10 overflow-hidden shrink-0">
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

                            {replies.length > 0 && (
                              <div className="mr-12 flex flex-col gap-4 border-r-2 border-white/10 pr-4">
                                {replies.map(reply => {
                                  const isReplyLiked = (reply.comment_likes || []).some((l:any) => l.user_id === currentUserId);
                                  const isMyReply = reply.user_id === currentUserId;
                                  return (
                                    <div key={reply.id} className="flex items-start gap-3">
                                      <div className="w-7 h-7 rounded-full bg-black border border-white/10 overflow-hidden shrink-0">
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
