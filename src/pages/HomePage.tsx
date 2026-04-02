import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { FadeIn, GlassCard, Button, Input } from '../components/ui';
import { 
  Loader2, Bell, Users, Heart, MessageSquare, 
  Send, X, Paperclip, RefreshCw, UserCircle, Trash2, Edit2, Share2, MoreVertical, ChevronLeft, Reply, ChevronDown, ChevronUp, ArrowUp, Download, Link, Bookmark
} from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { Share } from '@capacitor/share';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const commentsDragControls = useDragControls();
  const optionsDragControls = useDragControls();
  const descDragControls = useDragControls();
  
  const [mounted, setMounted] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  
  const [activePost, setActivePost] = useState<any>(null); 
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});
  
  const [commentActionModal, setCommentActionModal] = useState<any | null>(null);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  
  const [optionsMenuPost, setOptionsMenuPost] = useState<any>(null);
  const [activeDescPost, setActiveDescPost] = useState<any>(null);
  
  const [fullScreenMedia, setFullScreenMedia] = useState<any[] | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const scrollTimeout = useRef<any>(null);
  
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pullStartY = useRef(0);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  
  const [showScrollTop, setShowScrollTop] = useState(false);
  const lastScrollY = useRef(0);
  
  const stateRef = useRef({ 
    comments: false, options: false, desc: false, 
    fullscreen: false, commentAction: false 
  });
  
  useEffect(() => {
    stateRef.current = {
      comments: !!activeCommentsPostId, options: !!optionsMenuPost, desc: !!activeDescPost,
      fullscreen: !!fullScreenMedia, commentAction: !!commentActionModal
    };
  }, [activeCommentsPostId, optionsMenuPost, activeDescPost, fullScreenMedia, commentActionModal]);

  useEffect(() => {
    const handlePopState = () => {
      const s = stateRef.current;
      if (s.commentAction) { setCommentActionModal(null); }
      else if (s.comments) { setActiveCommentsPostId(null); setActivePost(null); setReplyingTo(null); }
      else if (s.options) { setOptionsMenuPost(null); }
      else if (s.desc) { setActiveDescPost(null); }
      else if (s.fullscreen) { setFullScreenMedia(null); }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY < lastScrollY.current && currentY > 400) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openOverlay = (action: () => void) => { window.history.pushState({ overlay: true }, ''); action(); };
  const closeOverlay = () => { window.history.back(); };
  const isAnyModalOpen = () => Object.values(stateRef.current).some(Boolean);

  const scrollToTop = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const checkUnreadNotifications = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', authData.user.id).eq('is_read', false);
      setUnreadCount(count || 0);
    } catch (e) {}
  };

  const fetchData = async (isSilentRefresh = false) => {
    if (!isSilentRefresh) setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id;
      if (uid) setCurrentUserId(uid);

      const [rawPosts, rawProfiles, rawLikes, rawComments] = await Promise.all([
        supabase.from('posts').select('*').is('circle_id', null).order('created_at', { ascending: false }).limit(50).then(r => r.data || []),
        supabase.from('profiles').select('*').then(r => r.data || []),
        supabase.from('likes').select('*').then(r => r.data || []),
        supabase.from('comments').select('*').then(r => r.data || [])
      ]);

      const fetchedPosts = rawPosts.map((p: any) => {
        const prof = rawProfiles.find((pr: any) => pr.id === p.user_id) || {};
        const pLikes = rawLikes.filter((l: any) => l.post_id === p.id);
        const pComments = rawComments.filter((c: any) => c.post_id === p.id);
        return { 
            ...p, 
            profiles: prof, 
            likes_count: pLikes.length, 
            comments_count: pComments.length, 
            is_liked: !!uid && pLikes.some((l: any) => l.user_id === uid) 
        };
      });
      setPosts(fetchedPosts);
    } catch (err) { console.error(err); } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    setMounted(true); fetchData(false); checkUnreadNotifications();
    const presenceInt = setInterval(() => setOnlineUsers(Math.floor(Math.random() * 50) + 1200), 5000);
    return () => clearInterval(presenceInt);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => { if (isAnyModalOpen()) return; if (window.scrollY <= 0) pullStartY.current = e.touches[0].clientY; };
  const handleTouchMove = (e: React.TouchEvent) => { if (isAnyModalOpen()) return; if (pullStartY.current > 0 && window.scrollY <= 0) { const y = e.touches[0].clientY - pullStartY.current; if (y > 0) setPullY(Math.min(y, 120)); } };
  const handleTouchEnd = async () => { if (isAnyModalOpen()) return; if (pullY > 60) { setRefreshing(true); setPullY(0); triggerFeedback('coin'); await fetchData(true); await checkUnreadNotifications(); } else { setPullY(0); } pullStartY.current = 0; };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handlePost = async () => {
    if (!newPost.trim() && !selectedFile) return;
    setPosting(true);
    try {
      let media_url = null; let media_type = 'text';
      if (selectedFile) {
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const { data } = await supabase.storage.from('feed_images').upload(fileName, selectedFile);
        media_url = supabase.storage.from('feed_images').getPublicUrl(data!.path).data.publicUrl;
        media_type = selectedFile.type.startsWith('video/') ? 'video' : 'image';
      }
      await supabase.from('posts').insert({ user_id: currentUserId, content: newPost.trim(), media_url, media_type, circle_id: null });
      setNewPost(''); setSelectedFile(null); fetchData(true);
      triggerFeedback('success');
    } catch (err) { toast.error('שגיאה בשמירה'); } finally { setPosting(false); }
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    triggerFeedback('pop');
    setPosts(posts.map(p => p.id === postId ? { ...p, is_liked: !isLiked, likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1 } : p)); 
    try { await apiFetch(`/api/posts/${postId}/like`, { method: 'POST', headers: { 'x-user-id': currentUserId } }); } 
    catch (err) { fetchData(true); }
  };

  const handleShare = async (post: any) => {
    triggerFeedback('pop');
    const publicUrl = `https://inner-app.com/post/${post.id}`; 
    try {
      await Share.share({ title: 'INNER', text: post.content || 'צפה בפוסט ב-INNER', url: publicUrl });
    } catch (e) {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('הקישור הועתק');
    }
  };

  const submitComment = async () => {
    if (!newComment.trim() || !activePost) return;
    try {
      const { data } = await apiFetch(`/api/posts/${activePost.id}/comments`, { method: 'POST', headers: { 'x-user-id': currentUserId }, body: JSON.stringify({ content: newComment.trim() }) });
      if (data) {
        setComments(prev => [...prev, data]);
        setPosts(posts.map(p => p.id === activePost.id ? { ...p, comments_count: p.comments_count + 1 } : p));
        setNewComment(''); triggerFeedback('coin');
      }
    } catch (err) { toast.error('שגיאה בשליחה'); }
  };

  const stopPropagation = (e: any) => e.stopPropagation();

  if (loading && posts.length === 0) return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  return (
    <div className="relative min-h-screen bg-[#0A0A0A]" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <AnimatePresence>
        {showScrollTop && !isAnyModalOpen() && (
          <motion.button initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} onClick={scrollToTop} className="fixed bottom-24 left-6 z-[80] w-12 h-12 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center shadow-2xl active:scale-90">
            <ArrowUp size={24} className="text-white" />
          </motion.button>
        )}
      </AnimatePresence>

      <FadeIn className="px-4 pt-12 pb-32 relative overflow-x-hidden" dir="rtl">
        <div className="fixed top-0 left-0 right-0 flex justify-center z-[100] pointer-events-none transition-transform" style={{ transform: `translateY(${Math.max(pullY - 40, -40)}px)`, opacity: pullY / 60 }}>
          <div className="bg-[#111] p-2.5 rounded-full shadow-2xl border border-white/10 mt-6 backdrop-blur-xl"><RefreshCw size={20} className={`text-white ${refreshing ? 'animate-spin' : ''}`} /></div>
        </div>
        
        <div className="flex justify-between items-start mb-8 h-12 px-1">
          <div className="w-10"></div>
          <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2">
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase drop-shadow-md italic">INNER</h1>
            <div className="flex items-center gap-1.5 mt-1 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_#22c55e]"></span>
              <span className="text-[10px] font-black text-white/60 tracking-widest">{onlineUsers.toLocaleString()}</span>
            </div>
          </div>
          <button onClick={() => navigate('/notifications')} className="w-11 h-11 flex justify-center items-center bg-white/5 border border-white/10 rounded-[16px] active:scale-90 relative shadow-inner">
            <Bell size={20} className="text-white/80" />
            {unreadCount > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0A0A0A] shadow-[0_0_8px_#ef4444]"></span>}
          </button>
        </div>

        <GlassCard className="p-5 mb-8 flex flex-col gap-3">
          <div className="flex gap-4 items-start">
            <div className="w-11 h-11 rounded-[14px] bg-[#111] border border-white/10 shrink-0 overflow-hidden shadow-inner">
                {supabase.auth.getUser() ? <UserCircle className="w-full h-full p-2 text-white/10" /> : null}
            </div>
            <textarea value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder="מה קורה במעגל שלך?" className="flex-1 bg-transparent border-none text-white/90 text-[15px] font-medium outline-none resize-none placeholder:text-white/20 pt-2 min-h-[60px]"/>
          </div>
          {selectedFile && (
            <div className="relative mt-4 rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                <img src={URL.createObjectURL(selectedFile)} className="w-full h-32 object-cover opacity-60" />
                <button onClick={() => setSelectedFile(null)} className="absolute top-2 right-2 p-1 bg-black/60 backdrop-blur-md rounded-full text-white"><X size={14}/></button>
            </div>
          )}
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/5">
            <button onClick={() => fileInputRef.current?.click()} className="text-white/40 hover:text-white transition-colors">
                <Paperclip size={20} />
            </button>
            <Button size="sm" onClick={handlePost} disabled={posting || (!newPost.trim() && !selectedFile)} className="px-6 rounded-full">
              {posting ? <Loader2 size={16} className="animate-spin" /> : 'פרסם'}
            </Button>
          </div>
        </GlassCard>

        <div className="flex flex-col gap-6">
          {posts.map((post) => {
            const hasMedia = !!post.media_url;
            const isVideo = post.media_url?.match(/\.(mp4|webm|mov)$/i);
            return (
              <GlassCard key={post.id} className="p-0 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/[0.01]">
                  <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate(`/profile/${post.user_id}`)}>
                      <div className="w-10 h-10 rounded-[12px] bg-[#111] border border-white/10 overflow-hidden shadow-inner">
                          {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full p-2 text-white/10" />}
                      </div>
                      <div className="flex flex-col text-right">
                          <span className="text-white font-black text-[14px]">{post.profiles?.full_name || 'אנונימי'}</span>
                          <span className="text-white/30 text-[10px] tracking-widest">{new Date(post.created_at).toLocaleDateString('he-IL')}</span>
                      </div>
                  </div>
                  <button onClick={() => openOverlay(() => setOptionsMenuPost(post))} className="text-white/30 hover:text-white transition-colors"><MoreVertical size={20} /></button>
                </div>

                {hasMedia && (
                  <div className="w-full bg-black relative cursor-pointer" onClick={() => openOverlay(() => setFullScreenMedia([post]))}>
                      {isVideo ? <video src={post.media_url} autoPlay loop muted playsInline className="w-full max-h-[450px] object-cover" /> : <img src={post.media_url} className="w-full max-h-[450px] object-cover" />}
                  </div>
                )}

                {post.content && (
                  <div className="px-6 py-4">
                      <p className="text-white/90 text-[15px] leading-relaxed text-right whitespace-pre-wrap">{post.content}</p>
                  </div>
                )}

                <div className="flex items-center gap-6 px-6 py-4 border-t border-white/5 bg-white/[0.01]">
                  <button onClick={() => handleLike(post.id, post.is_liked)} className={`flex items-center gap-2 transition-all active:scale-90 ${post.is_liked ? 'text-red-500' : 'text-white/30 hover:text-red-400'}`}>
                      <Heart size={20} fill={post.is_liked ? "currentColor" : "none"} />
                      <span className="text-[13px] font-black">{post.likes_count}</span>
                  </button>
                  <button onClick={() => openOverlay(() => { setActivePost(post); setActiveCommentsPostId(post.id); })} className="flex items-center gap-2 text-white/30 hover:text-blue-400 active:scale-90 transition-all">
                      <MessageSquare size={20} />
                      <span className="text-[13px] font-black">{post.comments_count}</span>
                  </button>
                  <button onClick={() => handleShare(post)} className="flex items-center gap-2 text-white/30 hover:text-white mr-auto active:scale-90 transition-all">
                      <Share2 size={20} />
                  </button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </FadeIn>

      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {activeCommentsPostId && (
            <div className="fixed inset-0 z-[10000] flex flex-col justify-end">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="relative z-10 bg-[#0F0F0F] rounded-t-[32px] h-[80vh] flex flex-col border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)]" dir="rtl">
                <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-12 h-1 bg-white/20 rounded-full"/></div>
                <div className="px-6 pb-4 border-b border-white/5 flex justify-between items-center">
                    <h2 className="text-white font-black text-lg">תגובות</h2>
                    <button onClick={closeOverlay} className="text-white/40 hover:text-white"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-hide">
                    {comments.map((c, i) => (
                        <div key={i} className="flex gap-3">
                            <div className="w-10 h-10 rounded-[12px] bg-white/5 overflow-hidden shrink-0 border border-white/10">
                                {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={20} className="m-auto mt-2 text-white/20" />}
                            </div>
                            <div className="bg-white/5 p-3 rounded-2xl rounded-tr-sm border border-white/5 flex-1 text-right">
                                <span className="text-white font-black text-[13px] block mb-1">{c.profiles?.full_name || 'אנונימי'}</span>
                                <p className="text-white/70 text-sm leading-relaxed">{c.content}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-[#0A0A0A] border-t border-white/5 flex gap-2 pb-10">
                    <Input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="הוסף תגובה..." className="h-12 py-0" />
                    <Button onClick={submitComment} disabled={!newComment.trim()} className="w-12 h-12 p-0 rounded-full shrink-0">
                        <Send size={18} className="rtl:-scale-x-100 -ml-0.5" />
                    </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
