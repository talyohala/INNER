import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import toast from 'react-hot-toast';
import { Users, Lock, Flame, Sparkles, Target, MessageCircle, ArrowUpRight, Heart, Share2, Bell, X, Reply, UserCircle, Edit2, Trash2, Plus, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

type FeedItem = { id: string; is_circle: boolean; slug?: string; name: string; description?: string | null; cover_url?: string | null; media_type?: string; members_count?: number; vip_price?: number; created_at: string; post_likes?: any[]; post_comments?: any[]; profiles?: any; };
type FeedTab = 'hot' | 'new' | 'foryou';

const TABS = [
  { key: 'hot', label: 'מועדונים חמים', icon: Flame, color: 'text-orange-400' },
  { key: 'new', label: 'חדשים', icon: Sparkles, color: 'text-blue-400' },
  { key: 'foryou', label: 'בשבילך', icon: Target, color: 'text-purple-400' },
] as const;

const withTimeout = <T,>(promise: Promise<T>, ms: number = 5000): Promise<T> => {
  return Promise.race([ promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('זמן קריאה חלף')), ms)) ]);
};

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FeedTab>('hot');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [balance, setBalance] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Bottom Sheets Controls
  const descDragControls = useDragControls();
  const commentsDragControls = useDragControls();
  const createPostDragControls = useDragControls();

  const [activeDescPost, setActiveDescPost] = useState<FeedItem | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [newPostMedia, setNewPostMedia] = useState('');
  
  // Comments System
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [editingComment, setEditingComment] = useState<any | null>(null);

  const loadFeedAndWallet = async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        setCurrentUserId(authData.user.id);
        try {
          const w = await apiFetch<any>('/api/wallet', { headers: { 'x-user-id': authData.user.id }});
          setBalance(w.credits || 0);
        } catch(e){}
      }

      let mappedCircles: FeedItem[] = [];
      try {
        const { data: dbCircles } = await withTimeout(supabase.from('circles').select('*'));
        if (dbCircles) {
          mappedCircles = dbCircles.map((c: any) => ({
            id: c.id || c.slug, is_circle: true, slug: c.slug, name: c.name || 'קהילה ללא שם', description: c.description || 'אין תיאור לקהילה זו', cover_url: c.cover_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop', media_type: 'image', members_count: c.members_count || 0, vip_price: c.vip_price || 0, created_at: c.created_at || new Date().toISOString(), post_likes: [], post_comments: []
          }));
        }
      } catch (e) {}

      let mappedPosts: FeedItem[] = [];
      try {
        const { data: dbPosts } = await withTimeout(supabase.from('posts').select(`*, profiles(id, username, full_name, avatar_url), post_likes(user_id), post_comments(id)`));
        if (dbPosts) {
          mappedPosts = dbPosts.map(p => ({
            id: p.id, is_circle: false, name: p.profiles?.full_name || `@${p.profiles?.username}` || 'משתמש', description: p.content, cover_url: p.media_url, media_type: p.media_type || 'video', created_at: p.created_at, profiles: p.profiles, post_likes: p.post_likes || [], post_comments: p.post_comments || []
          }));
        }
      } catch (e) {}

      setItems([...mappedPosts, ...mappedCircles]);
    } catch (err: any) {
      toast.error('שגיאה בטעינת הפיד', { style: { background: '#111', color: '#ef4444' } });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setMounted(true); loadFeedAndWallet(); }, []);

  const sortedItems = useMemo(() => {
    const arr = [...items];
    if (activeTab === 'new') return arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (activeTab === 'foryou') return arr.sort(() => Math.random() - 0.5);
    return arr.sort((a, b) => {
      const scoreA = (Number(a.members_count) || 0) * 2 + (Number(a.vip_price) || 0) + (a.post_likes?.length || 0);
      const scoreB = (Number(b.members_count) || 0) * 2 + (Number(b.vip_price) || 0) + (b.post_likes?.length || 0);
      if (scoreA === scoreB) return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return scoreB - scoreA;
    });
  }, [items, activeTab]);

  const handleCreatePost = async () => {
    if (!newPostMedia.trim() && !newPostText.trim()) return toast.error('הזן קישור לסרטון או טקסט');
    triggerFeedback('pop');
    const tid = toast.loading('מעלה פוסט...', { style: { background: '#111', color: '#fff' } });
    try {
      const { error } = await supabase.from('posts').insert({
        user_id: currentUserId, content: newPostText.trim(), media_url: newPostMedia.trim() || null, media_type: newPostMedia.includes('.mp4') || newPostMedia.includes('video') ? 'video' : 'image'
      });
      if (error) throw error;
      toast.success('הפוסט באוויר!', { id: tid, style: { background: '#111', color: '#4ade80' } });
      setShowCreatePost(false); setNewPostText(''); setNewPostMedia(''); loadFeedAndWallet();
    } catch (e: any) { toast.error('שגיאה בהעלאה', { id: tid, style: { background: '#111', color: '#ef4444' } }); }
  };

  const handleLikePost = async (postId: string, isLiked: boolean, isCircle: boolean) => {
    if (isCircle) return toast('לייקים למועדונים בקרוב!', { icon: '✨', style: {background: '#111', color: '#fff'} });
    triggerFeedback('pop');
    setItems(items.map(p => {
      if (p.id === postId) {
        const safeLikes = p.post_likes || [];
        return { ...p, post_likes: isLiked ? safeLikes.filter((l: any) => l.user_id !== currentUserId) : [...safeLikes, { user_id: currentUserId }] };
      }
      return p;
    }));
    if (isLiked) await supabase.from('post_likes').delete().match({ post_id: postId, user_id: currentUserId });
    else await supabase.from('post_likes').insert({ post_id: postId, user_id: currentUserId });
  };

  const openComments = async (postId: string, isCircle: boolean) => {
    if (isCircle) return toast('תגובות למועדונים בקרוב!', { icon: '💬', style: {background: '#111', color: '#fff'} });
    triggerFeedback('pop');
    setActiveCommentsPostId(postId); setLoadingComments(true); setComments([]); setReplyingTo(null); setEditingComment(null);
    try {
      const { data, error } = await supabase.from('post_comments').select(`*, profiles(id, username, full_name, avatar_url), comment_likes(user_id)`).eq('post_id', postId).order('created_at', { ascending: true });
      if (!error && data) setComments(data);
    } catch (err) {} finally { setLoadingComments(false); }
  };

  const submitComment = async () => {
    if (!commentText.trim() || !activeCommentsPostId) return;
    const text = commentText.trim(); setCommentText(''); triggerFeedback('pop');
    try {
      if (editingComment) {
        const { data, error } = await supabase.from('post_comments').update({ content: text, updated_at: new Date().toISOString() }).eq('id', editingComment.id).select('*, profiles(id, username, full_name, avatar_url), comment_likes(user_id)').single();
        if (error) throw error;
        setComments(comments.map(c => c.id === editingComment.id ? data : c)); setEditingComment(null);
      } else {
        const { data, error } = await supabase.from('post_comments').insert({ post_id: activeCommentsPostId, user_id: currentUserId, content: text, parent_id: replyingTo ? replyingTo.id : null }).select('*, profiles(id, username, full_name, avatar_url), comment_likes(user_id)').single();
        if (error) throw error;
        setComments([...comments, data]); setReplyingTo(null);
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
    if (isLiked) await supabase.from('comment_likes').delete().match({ comment_id: commentId, user_id: currentUserId });
    else await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: currentUserId });
  };

  const deleteComment = async (commentId: string) => {
    triggerFeedback('error');
    setComments(comments.filter(c => c.id !== commentId && c.parent_id !== commentId));
    await supabase.from('post_comments').delete().eq('id', commentId);
  };

  const topLevelComments = comments.filter(c => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter(c => c.parent_id === parentId);

  if (loading) return <div className="min-h-screen bg-[#030303] flex items-center justify-center text-white/20 font-black animate-pulse text-xl tracking-widest uppercase">SCANNING...</div>;

  return (
    <FadeIn className="px-4 pt-10 pb-28 flex flex-col gap-6 bg-[#030303] min-h-screen font-sans relative" dir="rtl">
      
      {/* כותרת מותאמת אישית כמו בתמונה שלך! */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => { triggerFeedback('pop'); navigate('/notifications'); }} className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center active:scale-95 transition-all relative">
          <Bell size={20} className="text-white" />
          <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-[#030303]"></span>
        </button>

        <div className="flex flex-col items-center justify-center">
          <h1 className="text-[28px] font-black text-white tracking-tight drop-shadow-md leading-none mb-1.5">INNER</h1>
          <div className="bg-white/5 border border-white/10 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-inner cursor-pointer" onClick={() => navigate('/wallet')}>
            <span className="text-white/80 text-[11px] font-black">{balance.toLocaleString()}</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80] shadow-[0_0_5px_#4ade80]"></div>
          </div>
        </div>

        <div className="w-12 h-12"></div>
      </div>

      <div className="flex gap-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as FeedTab)} className={`flex-1 h-12 rounded-[18px] border text-xs font-black transition-all duration-300 flex items-center justify-center gap-2 ${ isActive ? 'bg-[#1A1C20] text-white border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)]' : 'bg-transparent text-white/40 border-transparent hover:bg-white/5' }`}>
              <Icon size={14} className={isActive ? tab.color : 'opacity-40'} /> {tab.label}
            </button>
          );
        })}
      </div>

      {sortedItems.length === 0 ? (
        <div className="bg-[#0A0A0A] border border-white/5 rounded-[32px] text-center py-20 flex flex-col items-center justify-center shadow-inner">
          <Flame size={40} className="text-white/10 mb-4" />
          <h3 className="text-xl font-black text-white/80 mb-2">אין תוכן בתדר הזה</h3>
          <p className="text-white/30 text-sm font-bold">תהיה הראשון להדליק את האור.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {sortedItems.map((item) => {
            const membersCount = item.members_count || 1;
            const activeNow = Math.max(1, Math.ceil(membersCount * 0.15 + (Math.random() * 3)));
            const chattingNow = Math.max(0, Math.ceil(activeNow * 0.3));
            const isLiked = (item.post_likes || []).some((l: any) => l.user_id === currentUserId);

            return (
              <div key={item.id} className="p-0 overflow-hidden rounded-[32px] bg-[#0A0A0A] border border-white/5 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.5)] flex flex-col">
                
                <div className="relative h-[380px] w-full bg-black group cursor-pointer" onClick={() => item.is_circle && navigate(`/circle/${encodeURIComponent(item.slug || item.id)}`)}>
                  {item.media_type === 'video' && item.cover_url ? (
                    <video src={item.cover_url} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                  ) : (
                    <div className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105" style={{ backgroundImage: `url(${item.cover_url || ''})` }} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-black/60 pointer-events-none" />

                  {!item.is_circle && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 z-10 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-black shrink-0">
                        {item.profiles?.avatar_url ? <img src={item.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={24} className="text-white/50" />}
                      </div>
                      <span className="text-white text-[12px] font-black">{item.name}</span>
                    </div>
                  )}

                  {item.is_circle && (
                    <div className="absolute top-4 right-4 px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-[10px] font-black text-white/90 flex items-center gap-1.5 backdrop-blur-md z-10">
                      <Lock size={12} className="text-white/50" /> VIP
                    </div>
                  )}

                  {item.is_circle && (
                    <div className="absolute bottom-5 right-5 left-5 z-10 flex flex-col gap-3">
                      <h3 className="text-white text-3xl font-black drop-shadow-2xl truncate leading-none">{item.name}</h3>
                      <div className="flex gap-2">
                        {chattingNow > 0 && <div className="px-3 py-1.5 rounded-[12px] bg-yellow-500/10 border border-yellow-500/20 text-[10px] font-black text-yellow-500 flex items-center gap-1.5 backdrop-blur-md"><MessageCircle size={12} /> {chattingNow} מדברים</div>}
                        <div className="px-3 py-1.5 rounded-[12px] bg-white/5 border border-white/10 text-[10px] font-black text-white/80 flex items-center gap-1.5 backdrop-blur-md"><Users size={12} className="text-green-400" /> {activeNow} אונליין</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-5 flex flex-col gap-4 border-t border-white/5 bg-[#050505] relative z-20">
                  {!item.is_circle && (
                    <div className="flex items-center gap-5 border-b border-white/5 pb-4">
                      <button onClick={(e) => { e.preventDefault(); handleLikePost(item.id, isLiked, item.is_circle); }} className="flex items-center gap-1.5 active:scale-90 transition-transform">
                        <Heart size={22} className={isLiked ? 'text-red-500 fill-red-500' : 'text-white/60'} />
                        <span className="text-white/80 text-[13px] font-bold">{item.post_likes?.length || 0}</span>
                      </button>
                      <button onClick={(e) => { e.preventDefault(); openComments(item.id, item.is_circle); }} className="flex items-center gap-1.5 active:scale-90 transition-transform">
                        <MessageCircle size={22} className="text-white/60" />
                        <span className="text-white/80 text-[13px] font-bold">{item.post_comments?.length || 0}</span>
                      </button>
                      <button onClick={(e) => { e.preventDefault(); triggerFeedback('pop'); toast('הועתק ללוח!', {style: {background: '#111', color: '#fff'}}); }} className="flex items-center gap-1.5 active:scale-90 transition-transform">
                        <Share2 size={18} className="text-white/60" />
                      </button>
                    </div>
                  )}

                  {item.description && (
                    <div onClick={(e) => { e.preventDefault(); triggerFeedback('pop'); setActiveDescPost(item); }} className="cursor-pointer group">
                      <p className="text-white/50 text-sm font-medium leading-relaxed line-clamp-2 text-right group-hover:text-white/80 transition-colors">{item.description}</p>
                      <span className="text-[#2196f3] text-[10px] font-black uppercase tracking-widest mt-2 block">קרא תיאור מלא</span>
                    </div>
                  )}

                  {item.is_circle && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-white/30 text-[9px] font-black uppercase tracking-widest">Premium Access</span>
                      <Link to={`/circle/${encodeURIComponent(item.slug || item.id)}`} className="w-12 h-12 bg-[#1A1C20] rounded-xl border border-white/5 active:scale-95 transition-all duration-300 flex items-center justify-center shadow-inner">
                        <ArrowUpRight size={22} className="text-white/60" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* כפתור פלוס מטורף להעלאת וידאו! בא להחליף את השורה המשעממת של "שדר משהו" */}
      <button 
        onClick={() => { triggerFeedback('pop'); setShowCreatePost(true); }}
        className="fixed bottom-24 right-5 w-14 h-14 bg-gradient-to-tr from-[#2196f3] to-blue-400 text-white rounded-full shadow-[0_10px_25px_rgba(33,150,243,0.5)] flex items-center justify-center z-40 active:scale-90 transition-all border border-white/30"
      >
        <Plus size={28} />
      </button>

      {mounted && typeof document !== 'undefined' && createPortal(
        <>
          <AnimatePresence>
            {showCreatePost && (
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowCreatePost(false)} />
                <motion.div drag="y" dragControls={createPostDragControls} dragListener={false} dragConstraints={{ top: 0 }} dragElastic={0.2} onDragEnd={(e, { offset, velocity }) => { if (offset.y > 100 || velocity.y > 400) setShowCreatePost(false); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="bg-[#111] border-t border-white/10 rounded-t-[36px] p-6 flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.9)] relative z-50 pb-12">
                  <div onPointerDown={(e) => createPostDragControls.start(e)} style={{ touchAction: 'none' }} className="w-full flex flex-col items-center pb-4 cursor-grab">
                    <div className="w-16 h-1.5 bg-white/20 rounded-full mb-4"></div>
                    <div className="flex justify-between items-center w-full"><h3 className="text-lg font-black text-white">העלה פוסט חדש</h3><button onClick={() => setShowCreatePost(false)}><X size={20} className="text-white/40"/></button></div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <input type="text" value={newPostMedia} onChange={e => setNewPostMedia(e.target.value)} placeholder="קישור לוידאו (.mp4) / תמונה..." className="h-14 bg-white/5 border border-white/10 rounded-[20px] px-4 text-white text-sm focus:outline-none focus:border-[#2196f3]" dir="ltr" />
                    <textarea value={newPostText} onChange={e => setNewPostText(e.target.value)} placeholder="כתוב משהו יפה..." className="h-28 bg-white/5 border border-white/10 rounded-[20px] p-4 text-white text-sm focus:outline-none focus:border-[#2196f3] resize-none" />
                    <Button onClick={handleCreatePost} className="h-14 bg-[#2196f3] text-white font-black rounded-[20px] text-[14px]">פרסם פוסט</Button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {activeDescPost && (
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setActiveDescPost(null)} />
                <motion.div drag="y" dragControls={descDragControls} dragListener={false} dragConstraints={{ top: 0 }} dragElastic={0.2} onDragEnd={(e, { offset, velocity }) => { if (offset.y > 100 || velocity.y > 400) setActiveDescPost(null); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="bg-[#111] border-t border-white/10 rounded-t-[36px] max-h-[80vh] min-h-[40vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.9)] relative">
                  <div onPointerDown={(e) => descDragControls.start(e)} style={{ touchAction: 'none' }} className="w-full flex flex-col items-center pt-5 pb-4 cursor-grab">
                    <div className="w-16 h-1.5 bg-white/20 rounded-full mb-4 pointer-events-none"></div>
                    <div className="px-6 flex items-center justify-between w-full"><h3 className="text-[16px] font-black text-white">תיאור מלא</h3><button onClick={() => setActiveDescPost(null)} className="text-white/40 hover:text-white"><X size={20} /></button></div>
                  </div>
                  <div className="p-6 overflow-y-auto scrollbar-hide text-white/90 text-[15px] leading-loose whitespace-pre-wrap pb-20">{activeDescPost.description}</div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {activeCommentsPostId && (
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setActiveCommentsPostId(null)} />
                <motion.div drag="y" dragControls={commentsDragControls} dragListener={false} dragConstraints={{ top: 0 }} dragElastic={0.2} onDragEnd={(e, { offset, velocity }) => { if (offset.y > 100 || velocity.y > 400) setActiveCommentsPostId(null); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="bg-[#111] border-t border-white/10 rounded-t-[36px] h-[85vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.9)] relative">
                  <div onPointerDown={(e) => commentsDragControls.start(e)} style={{ touchAction: 'none' }} className="w-full flex flex-col items-center pt-5 pb-2 cursor-grab">
                    <div className="w-16 h-1.5 bg-white/20 rounded-full mb-4"></div>
                    <div className="px-6 flex items-center justify-between w-full"><h3 className="text-[16px] font-black text-white">{comments.length} תגובות</h3><button onClick={() => setActiveCommentsPostId(null)} className="text-white/40 hover:text-white p-2 -mr-2"><X size={20} /></button></div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 scrollbar-hide pb-32">
                    {loadingComments ? <div className="flex justify-center pt-20"><Loader2 className="animate-spin text-white/20" /></div> : comments.length === 0 ? <div className="text-center pt-20 text-white/30 font-bold text-[14px]">אין תגובות עדיין. היו הראשונים!</div> : topLevelComments.map(comment => {
                        const isLiked = (comment.comment_likes || []).some((l:any) => l.user_id === currentUserId);
                        const replies = getReplies(comment.id);
                        const isMyComment = comment.user_id === currentUserId;

                        return (
                          <div key={comment.id} className="flex flex-col gap-3">
                            <div className="flex items-start gap-3 group">
                              <div className="w-9 h-9 rounded-full bg-black border border-white/10 overflow-hidden shrink-0 mt-1">{comment.profiles?.avatar_url ? <img src={comment.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={20} className="text-white/50 w-full h-full p-1" />}</div>
                              <div className="flex flex-col flex-1 gap-1">
                                <div className="flex items-center gap-2"><span className="text-white/60 text-[12px] font-black">{comment.profiles?.username || 'משתמש'}</span><span className="text-white/30 text-[10px]">{new Date(comment.created_at).toLocaleDateString('he-IL')}</span></div>
                                <p className="text-white text-[14px] leading-relaxed">{comment.content}</p>
                                <div className="flex items-center gap-4 mt-1 text-white/40 text-[11px] font-bold">
                                  <button onClick={() => setReplyingTo(comment)} className="hover:text-white flex items-center gap-1"><Reply size={12}/> הגב</button>
                                  {isMyComment && <><button onClick={() => { setEditingComment(comment); setCommentText(comment.content); }} className="hover:text-white flex items-center gap-1"><Edit2 size={12}/> ערוך</button><button onClick={() => deleteComment(comment.id)} className="hover:text-red-400 flex items-center gap-1"><Trash2 size={12}/> מחק</button></>}
                                </div>
                              </div>
                              <button onClick={() => handleLikeComment(comment.id, isLiked)} className="flex flex-col items-center gap-1 pt-2 shrink-0"><Heart size={14} className={isLiked ? 'text-red-500 fill-red-500' : 'text-white/30 hover:text-white'} />{(comment.comment_likes?.length || 0) > 0 && <span className="text-white/40 text-[9px]">{comment.comment_likes.length}</span>}</button>
                            </div>
                            {replies.length > 0 && <div className="mr-12 flex flex-col gap-4 border-r-2 border-white/10 pr-4">{replies.map(reply => {
                                  const isReplyLiked = (reply.comment_likes || []).some((l:any) => l.user_id === currentUserId);
                                  const isMyReply = reply.user_id === currentUserId;
                                  return (
                                    <div key={reply.id} className="flex items-start gap-3">
                                      <div className="w-7 h-7 rounded-full bg-black border border-white/10 overflow-hidden shrink-0 mt-0.5">{reply.profiles?.avatar_url ? <img src={reply.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={16} className="text-white/50 w-full h-full p-1" />}</div>
                                      <div className="flex flex-col flex-1 gap-0.5"><span className="text-white/60 text-[11px] font-black">{reply.profiles?.username || 'משתמש'}</span><p className="text-white/90 text-[13px]">{reply.content}</p><div className="flex items-center gap-3 mt-1 text-white/40 text-[10px] font-bold">{isMyReply && <><button onClick={() => { setEditingComment(reply); setCommentText(reply.content); }} className="hover:text-white">ערוך</button><button onClick={() => deleteComment(reply.id)} className="hover:text-red-400">מחק</button></>}</div></div>
                                      <button onClick={() => handleLikeComment(reply.id, isReplyLiked)} className="flex flex-col items-center gap-1 pt-1 shrink-0"><Heart size={12} className={isReplyLiked ? 'text-red-500 fill-red-500' : 'text-white/30 hover:text-white'} /></button>
                                    </div>
                                  );
                                })}</div>}
                          </div>
                        );
                      })
                    }
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 bg-[#111] border-t border-white/10 p-4 pb-8 flex flex-col gap-2 shadow-[0_-10px_20px_rgba(0,0,0,0.5)] z-20">
                    {(replyingTo || editingComment) && <div className="flex items-center justify-between px-2 text-[11px] text-[#2196f3] font-bold"><span>{editingComment ? 'עורך תגובה...' : `מגיב ל-@${replyingTo.profiles?.username || 'משתמש'}`}</span><button onClick={() => { setReplyingTo(null); setEditingComment(null); setCommentText(''); }}><X size={14}/></button></div>}
                    <div className="flex items-center gap-3 relative">
                      <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="הוסף תגובה..." dir="rtl" className="flex-1 h-12 bg-white/5 border border-white/10 rounded-full px-5 text-white text-[14px] focus:outline-none focus:border-[#2196f3] transition-all placeholder:text-white/30" />
                      <button onClick={submitComment} disabled={!commentText.trim()} className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center disabled:opacity-50 active:scale-95 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]"><Send size={18} className="-ml-1" /></button>
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
