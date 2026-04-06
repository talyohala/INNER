import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { FadeIn, Button } from '../components/ui';
import {
  Loader2, Bell, Users, Heart, MessageSquare, Send, X,
  Paperclip, RefreshCw, UserCircle, Trash2, Edit2, Share2,
  MoreVertical, ChevronLeft, Reply, ChevronDown, ChevronUp, ArrowUp, Download, Link as LinkIcon, Bookmark, ShieldAlert, Image as ImageIcon
} from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { Share } from '@capacitor/share';
import { useAuth } from '../context/AuthContext';

const FeedVideo = ({ src, className }: { src: string; className?: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          videoRef.current?.play().catch(() => {});
        } else {
          videoRef.current?.pause();
        }
      },
      { threshold: 0.4 }
    );
    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  return <video ref={videoRef} src={src} loop muted playsInline preload="metadata" className={className} />;
};

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile: myProfile } = useAuth();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const pullStartY = useRef(0);
  const lastScrollY = useRef(0);

  const [mounted, setMounted] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);

  const [page, setPage] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const POSTS_PER_PAGE = 15;
  const [loadingMore, setLoadingMore] = useState(false);

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

  const [onlineUsers, setOnlineUsers] = useState(0);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const [userCirclesModal, setUserCirclesModal] = useState<any[] | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const stateRef = useRef({
    comments: false, options: false, desc: false,
    create: false, fullscreen: false, commentAction: false, userCircles: false,
  });

  const mediaPosts = useMemo(() => posts.filter((p) => p.media_url), [posts]);

  const getRandomMediaBatch = (size = 6, excludeId?: string) => {
    const pool = mediaPosts.filter((p) => (excludeId ? p.id !== excludeId : true));
    if (pool.length === 0) return [];
    const batch: any[] = [];
    for (let i = 0; i < size; i += 1) {
      batch.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return batch;
  };

  useEffect(() => { setMounted(true); setPortalReady(true); }, []);

  useEffect(() => {
    stateRef.current = {
      comments: !!activeCommentsPostId, options: !!optionsMenuPost, desc: !!activeDescPost,
      create: showCreatePost, fullscreen: !!fullScreenMedia, commentAction: !!commentActionModal, userCircles: !!userCirclesModal,
    };
  }, [activeCommentsPostId, optionsMenuPost, activeDescPost, showCreatePost, fullScreenMedia, commentActionModal, userCirclesModal]);

  useEffect(() => {
    const handlePopState = () => {
      const s = stateRef.current;
      if (s.commentAction) { setCommentActionModal(null); }
      else if (s.userCircles) { setUserCirclesModal(null); }
      else if (s.comments) { setActiveCommentsPostId(null); setActivePost(null); setReplyingTo(null); setEditingCommentId(null); setNewComment(''); }
      else if (s.options) { setOptionsMenuPost(null); }
      else if (s.desc) { setActiveDescPost(null); }
      else if (s.create) { setShowCreatePost(false); setEditingPost(null); setSelectedFile(null); }
      else if (s.fullscreen) { setFullScreenMedia(null); }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY < lastScrollY.current && currentY > 300) { setShowScrollTop(true); } else { setShowScrollTop(false); }
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openOverlay = (action: () => void) => { window.history.pushState({ overlay: true }, ''); action(); };
  const closeOverlay = () => { window.history.back(); };
  const isAnyModalOpen = () => Object.values(stateRef.current).some(Boolean);
  const scrollToTop = () => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); };

  const checkUnreadNotifications = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', authData.user.id).eq('is_read', false);
      setUnreadCount(count || 0);
    } catch {}
  };

  const fetchFeed = useCallback(async (isLoadMore = false) => {
    if (!user) return;
    try {
      const currentPage = isLoadMore ? page + 1 : 0;
      if (!isLoadMore) setLoading(true);
      else setLoadingMore(true);

      const uid = user.id;
      setCurrentUserId(uid);

      const [rawPosts, rawProfiles, rawLikes, rawComments, rawMembers, rawCircles] = await Promise.all([
        supabase.from('posts').select('*').order('created_at', { ascending: false }).range(currentPage * POSTS_PER_PAGE, (currentPage + 1) * POSTS_PER_PAGE - 1).then((r) => r.data || []),
        supabase.from('profiles').select('*').then((r) => r.data || []),
        supabase.from('likes').select('*').then((r) => r.data || []),
        supabase.from('comments').select('*').then((r) => r.data || []),
        supabase.from('circle_members').select('*').then((r) => r.data || []),
        supabase.from('circles').select('*').then((r) => r.data || []),
      ]);

      const fetchedPosts = rawPosts
        .filter((p: any) => !p.circle_id)
        .map((p: any) => {
          const prof = rawProfiles.find((pr: any) => pr.id === p.user_id) || {};
          const pLikes = rawLikes.filter((l: any) => l.post_id === p.id);
          const pComments = rawComments.filter((c: any) => c.post_id === p.id);
          const userCircles = rawCircles.filter((c: any) => rawMembers.some((m: any) => m.circle_id === c.id && m.user_id === p.user_id));
          return {
            ...p,
            profiles: prof,
            likes_count: pLikes.length,
            comments_count: pComments.length,
            is_liked: !!uid && pLikes.some((l: any) => l.user_id === uid),
            user_circles: userCircles,
          };
        });

      if (isLoadMore) {
        setPosts((prev) => [...prev, ...fetchedPosts]);
        if (fetchedPosts.length < POSTS_PER_PAGE) setHasMorePosts(false);
      } else {
        setPosts(fetchedPosts);
        setHasMorePosts(fetchedPosts.length === POSTS_PER_PAGE);
      }
      setPage(currentPage);
    } catch (error) {
      toast.error('שגיאה בטעינת הפיד');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [user, page]);

  useEffect(() => {
    if (user) {
      fetchFeed();
      checkUnreadNotifications();
    }
  }, [user]);

  useEffect(() => {
    const presenceChannel = supabase.channel('global_online');
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        let activeCount = 0;
        for (const key in state) { activeCount += state[key].length; }
        setOnlineUsers(activeCount > 0 ? activeCount : 1);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ online_at: new Date().toISOString(), user_id: currentUserId || 'guest' });
        }
      });
    return () => { supabase.removeChannel(presenceChannel); };
  }, [currentUserId]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAnyModalOpen()) return;
    if (window.scrollY <= 0) { pullStartY.current = e.touches[0].clientY; }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isAnyModalOpen()) return;
    if (pullStartY.current > 0 && window.scrollY <= 0) {
      const y = e.touches[0].clientY - pullStartY.current;
      if (y > 0) setPullY(Math.min(y, 120));
    }
  };

  const handleTouchEnd = async () => {
    if (isAnyModalOpen()) return;
    if (pullY > 60) {
      setRefreshing(true); setPullY(0); triggerFeedback('coin');
      await fetchFeed(false); await checkUnreadNotifications();
    } else { setPullY(0); }
    pullStartY.current = 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      setSelectedFile(file);
    } else if (file) {
      toast.error('אנא בחר קובץ תמונה או וידאו תקין');
    }
    if (fileInputRef.current) { fileInputRef.current.value = ''; }
  };

  const handlePost = async () => {
    if (!newPost.trim() && !selectedFile && !editingPost) return;
    setPosting(true);
    try {
      if (editingPost) {
        await supabase.from('posts').update({ content: newPost.trim() }).eq('id', editingPost.id);
        setPosts((curr) => curr.map((p) => p.id === editingPost.id ? { ...p, content: newPost.trim() } : p));
        toast.success('עודכן בהצלחה'); closeOverlay(); return;
      }
      let media_url: string | null = null; let media_type = 'text';
      if (selectedFile) {
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}_${selectedFile.name}`;
        const uploadRes = await supabase.storage.from('feed_images').upload(fileName, selectedFile);
        if (uploadRes.error) throw uploadRes.error;
        media_url = supabase.storage.from('feed_images').getPublicUrl(uploadRes.data.path).data.publicUrl;
        media_type = selectedFile.type.startsWith('video/') ? 'video' : 'image';
      }
      const insertRes = await supabase.from('posts').insert({ user_id: currentUserId, content: newPost.trim(), media_url, media_type, circle_id: null }).select('*, profiles!user_id(*), likes(user_id), comments(id)').single();
      if (insertRes.error) throw insertRes.error;
      
      if (insertRes.data) {
        setPosts((curr) => [{ ...insertRes.data, likes_count: 0, comments_count: 0, is_liked: false, user_circles: [] }, ...curr]);
      }
      setNewPost(''); setSelectedFile(null); setEditingPost(null);
    } catch { toast.error('שגיאה בשמירה'); } finally { setPosting(false); }
  };

  const handleShare = async (post: any) => {
    triggerFeedback('pop');
    const publicUrl = `https://inner-app.com/post/${post.id}`;
    const textToShare = `${post.content ? `${post.content}\n\n` : ''}צפה בפוסט הזה ב-INNER!`;
    try {
      const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor && (window as any).Capacitor.isNativePlatform?.();
      if (isNative) { await Share.share({ title: 'INNER', text: textToShare, url: publicUrl, dialogTitle: 'שתף עם חברים' }); }
      else if (navigator.share && window.isSecureContext) { await navigator.share({ title: 'INNER', text: textToShare, url: publicUrl }); }
      else { await navigator.clipboard.writeText(`${textToShare}\n${publicUrl}`); toast.success('הקישור הועתק ללוח'); }
    } catch {}
  };

  const handleCopyLink = async (post: any) => {
    const publicUrl = `https://inner-app.com/post/${post.id}`;
    try { await navigator.clipboard.writeText(publicUrl); toast.success('הקישור הועתק ללוח', { icon: '🔗' }); } catch { toast.error('שגיאה בהעתקה'); }
    closeOverlay();
  };

  const handleDownloadMedia = async (mediaUrl: string) => {
    try {
      toast.loading('מוריד קובץ...', { id: 'dl' });
      const response = await fetch(mediaUrl); const blob = await response.blob(); const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `INNER_Media_${Date.now()}`;
      document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a);
      toast.success('הקובץ נשמר בהצלחה', { id: 'dl' });
    } catch { toast.error('לא ניתן להוריד את הקובץ', { id: 'dl' }); }
    closeOverlay();
  };

  const handleSavePost = async (post: any) => {
    try {
      await supabase.from('saved_posts').insert({ user_id: currentUserId, post_id: post.id });
      toast.success('הפוסט נשמר במועדפים!', { icon: '⭐' });
    } catch (e: any) {
      if (e?.code === '23505') { toast.success('הפוסט כבר שמור אצלך', { icon: '⭐' }); } else { toast.error('שגיאה בשמירה'); }
    }
    closeOverlay();
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    triggerFeedback('pop');
    const update = (list: any[]) => list.map((p) => p.id === postId ? { ...p, is_liked: !isLiked, likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1 } : p);
    setPosts((prev) => update(prev));
    if (fullScreenMedia) { setFullScreenMedia((prev) => (prev ? update(prev) : prev)); }
    try { await apiFetch(`/api/posts/${postId}/like`, { method: 'POST', headers: { 'x-user-id': currentUserId } }); } catch {}
  };

  const submitComment = async () => {
    if (!newComment.trim() || !activePost || !user) return;
    try {
      if (editingCommentId) {
        const updateRes = await supabase.from('comments').update({ content: newComment.trim() }).eq('id', editingCommentId);
        if (updateRes.error) throw updateRes.error;
        setComments((prev) => prev.map((c) => c.id === editingCommentId ? { ...c, content: newComment.trim() } : c));
        setEditingCommentId(null);
      } else {
        const data = await apiFetch(`/api/posts/${activePost.id}/comments`, { method: 'POST', headers: { 'x-user-id': currentUserId }, body: JSON.stringify({ content: newComment.trim(), parent_id: replyingTo?.id || null }) });
        if (data) {
          setComments((prev) => [...prev, data]);
          const update = (list: any[]) => list.map((p) => p.id === activePost.id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p);
          setPosts((prev) => update(prev));
          if (fullScreenMedia) { setFullScreenMedia((prev) => (prev ? update(prev) : prev)); }
          if (replyingTo) { setExpandedThreads((prev) => ({ ...prev, [replyingTo.id]: true })); }
          triggerFeedback('coin');
        }
      }
      setNewComment(''); setReplyingTo(null);
    } catch { toast.error('שגיאה בשרת'); }
  };

  const deletePost = async (postId: string) => {
    triggerFeedback('error'); closeOverlay();
    setPosts((curr) => curr.filter((p: any) => p.id !== postId));
    await supabase.from('posts').delete().eq('id', postId);
  };

  const deleteComment = async (commentId: string) => {
    triggerFeedback('error');
    setComments((curr) => curr.filter((c) => c && c.id !== commentId && c.parent_id !== commentId));
    const update = (list: any[]) => list.map((p) => p.id === activePost?.id ? { ...p, comments_count: Math.max(0, (p.comments_count || 0) - 1) } : p);
    setPosts((prev) => update(prev));
    if (fullScreenMedia) { setFullScreenMedia((prev) => (prev ? update(prev) : prev)); }
    try { await supabase.from('comments').delete().eq('id', commentId); } catch {}
  };

  const handleOpenFullscreen = (post: any) => {
    openOverlay(() => { setFullScreenMedia([post, ...getRandomMediaBatch(10, post.id)]); setCurrentMediaIndex(0); });
  };

  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (scrollTimeout.current) return;
    scrollTimeout.current = setTimeout(() => {
      scrollTimeout.current = null;
      const index = Math.round(target.scrollTop / target.clientHeight);
      if (index !== currentMediaIndex) { setCurrentMediaIndex(index); }
      if (target.scrollHeight - target.scrollTop <= target.clientHeight * 2) {
        const more = getRandomMediaBatch(6);
        if (more.length) { setFullScreenMedia((prev) => [...(prev || []), ...more]); }
      }
    }, 120);
  };

  const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

  if (loading && posts.length === 0) {
    return <div className="min-h-screen bg-[#030303] flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" /></div>;
  }


  const portalTarget = typeof document !== 'undefined' ? document.body || document.getElementById('root') : null;

  return (
    <>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />
      
      <AnimatePresence>
        {showScrollTop && !isAnyModalOpen() && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            onClick={scrollToTop}
            className="fixed bottom-24 right-5 z-[80] w-12 h-12 bg-surface-card border border-white/[0.05] rounded-full flex items-center justify-center shadow-[0_5px_15px_rgba(0,0,0,0.5)] active:scale-95 transition-transform"
          >
            <ArrowUp size={24} className="text-brand drop-shadow-md" />
          </motion.button>
        )}
      </AnimatePresence>

      <FadeIn
        className="bg-surface min-h-screen font-sans flex flex-col relative overflow-x-hidden pb-32"
        dir="rtl"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="fixed top-0 left-0 right-0 flex justify-center z-50 pointer-events-none transition-transform duration-200"
          style={{ transform: `translateY(${Math.max(pullY - 40, -40)}px)`, opacity: pullY / 60 }}
        >
          <div className="bg-surface-card p-2.5 rounded-full shadow-2xl border border-white/[0.05] mt-6 backdrop-blur-xl">
            <RefreshCw size={22} className={`text-brand ${refreshing ? 'animate-spin' : ''}`} />
          </div>
        </div>

        {/* סרגל עליון - הדר */}
        <div className="flex items-center justify-between px-5 pt-8 pb-4 sticky top-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-white/[0.05] h-20">
          <div className="flex items-center gap-1.5 bg-surface-card px-2.5 py-1 rounded-full border border-white/[0.05]">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
            <span className="text-[10px] font-black text-brand-muted tracking-widest">{onlineUsers.toLocaleString()}</span>
          </div>
          
          {/* לוגו באמצע */}
          <h1 className="absolute left-1/2 -translate-x-1/2 text-[22px] font-black text-brand tracking-tight uppercase drop-shadow-sm">INNER</h1>
          
          <button onClick={() => navigate('/notifications')} className="w-10 h-10 flex justify-center items-center bg-surface-card border border-white/[0.05] rounded-full active:scale-90 relative shadow-sm">
            <Bell size={18} className="text-brand" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-surface animate-pulse" />
            )}
          </button>
        </div>

        <div className="flex flex-col gap-6 w-full p-2 mt-2">
          
          {/* אזור יצירת פוסט */}
          <div className="px-1 mb-2">
            <div className="p-4 rounded-[28px] border border-white/[0.05] bg-surface-card shadow-lg relative z-10 flex flex-col gap-3">
              <div className="flex gap-3 items-start">
                <div className="w-10 h-10 rounded-full bg-surface border border-white/[0.05] shrink-0 overflow-hidden shadow-inner flex items-center justify-center cursor-pointer" onClick={() => navigate('/profile')}>
                  {myProfile?.avatar_url ? <img src={myProfile.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full p-2 text-brand-muted" />}
                </div>
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="שדר משהו לכולם..."
                  className="w-full bg-transparent border-none text-brand text-[15px] font-medium outline-none resize-none placeholder:text-brand-muted pt-2 min-h-[60px]"
                />
              </div>

              {selectedFile && (
                <div className="relative mt-2 mb-4 w-fit">
                  {selectedFile.type.startsWith('video/') ? (
                    <video src={URL.createObjectURL(selectedFile)} controls playsInline className="w-28 h-28 rounded-[20px] object-cover border border-white/[0.05] shadow-xl" />
                  ) : (
                    <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="w-28 h-28 rounded-[20px] object-cover border border-white/[0.05] shadow-xl" />
                  )}
                  <button onClick={() => setSelectedFile(null)} className="absolute -top-3 -right-3 w-8 h-8 bg-surface rounded-full text-brand flex items-center justify-center shadow-lg font-black border border-white/[0.05] z-10">
                    <X size={14} className="text-red-500" />
                  </button>
                </div>
              )}

              <div className="flex justify-end items-center gap-3 mt-2 border-t border-white/[0.05] pt-3">
                <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-brand-muted hover:text-brand border border-white/[0.05] transition-all active:scale-95 shadow-md">
                  <Paperclip size={18} />
                </button>
                {/* כפתור שליחה בצבע תכלת ואייקון לבן */}
                <button onClick={handlePost} disabled={posting || (!newPost.trim() && !selectedFile)} className="w-10 h-10 rounded-full bg-accent-primary flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-accent-primary/20">
                  {posting ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={16} className="rtl:-scale-x-100 -ml-0.5 text-white" />}
                </button>
              </div>
            </div>
          </div>

          {posts.length === 0 && !loading ? (
            <div className="text-center text-brand-muted mt-10 text-[14px]">אין פוסטים להצגה בפיד</div>
          ) : (
            <div className="flex flex-col gap-6 w-full -mx-1.5 px-1.5">
              {posts.map((post) => {
                const hasMedia = !!post.media_url;
                const isVideo = post.media_url?.match(/\.(mp4|webm|mov)$/i);
                const postCircle = post.circles ? post.circles : (post.user_circles && post.user_circles.length > 0 ? post.user_circles[0] : null);

                return (
                  <div key={post.id} className="flex flex-col bg-black border border-white/[0.05] overflow-hidden shadow-xl rounded-[28px] w-full relative">
                    
                    {/* התוכן העליון - תמונה מוקטנת טיפה ונוגעת בקצה */}
                    {hasMedia ? (
                      <div className="w-full relative cursor-pointer overflow-hidden bg-black flex flex-col" onClick={() => handleOpenFullscreen(post)}>
                        {isVideo ? (
                          <FeedVideo src={post.media_url} className="w-full max-h-[360px] aspect-[4/5] object-cover" />
                        ) : (
                          <img src={post.media_url} loading="lazy" className="w-full max-h-[360px] aspect-[4/5] object-cover" onError={(e) => { e.currentTarget.src = 'https://placehold.co/500x500/1E1F22/333?text=Media+Unavailable'; }} />
                        )}
                        
                        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none"></div>

                        {post.content && (
                          <div className="absolute bottom-0 left-0 right-0 p-4 pt-32 bg-gradient-to-t from-black via-black/30 to-transparent flex items-end pointer-events-none z-10">
                            <p onClick={(e) => { e.stopPropagation(); openOverlay(() => setActiveDescPost(post)); }} className="text-white text-[14px] font-medium leading-relaxed text-right line-clamp-2 w-full pr-1 cursor-pointer active:opacity-70 pointer-events-auto drop-shadow-md">
                              {post.content}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full p-5 pt-6 cursor-pointer bg-surface-card" onClick={() => openOverlay(() => setActiveDescPost(post))}>
                        <p className="text-white text-[16px] leading-relaxed text-right line-clamp-6 whitespace-pre-wrap">{post.content}</p>
                      </div>
                    )}

                    {/* שורה תחתונה */}
                    <div className={`flex items-center justify-between px-4 py-3 ${hasMedia ? 'bg-black' : 'bg-surface-card border-t border-white/[0.05]'}`}>
                      
                      {/* צד ימין: מועדון + משתמש מוצמדים לימין */}
                      <div className="flex flex-col items-start text-right cursor-pointer active:opacity-70 transition-opacity" onClick={() => navigate(`/profile/${post.user_id}`)}>
                        {postCircle && (
                           <div className="flex items-center gap-1.5 mb-1 text-accent-primary" onClick={(e) => { e.stopPropagation(); navigate(`/circle/${postCircle.slug}`); }}>
                             <span className="text-[10px] font-black tracking-wide uppercase">{postCircle.name}</span>
                           </div>
                        )}
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-full bg-surface-card border border-white/[0.05] overflow-hidden shrink-0">
                            {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" loading="lazy" /> : <UserCircle className="w-full h-full p-1.5 text-brand-muted" />}
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-white font-bold text-[13px] leading-tight">{post.profiles?.full_name || 'אנונימי'}</span>
                            <span className="text-brand-muted text-[10px]">{new Date(post.created_at).toLocaleDateString('he-IL')}</span>
                          </div>
                        </div>
                      </div>

                      {/* צד שמאל: פעולות + 3 נקודות יחד */}
                      <div className="flex items-center gap-3">
                        <button onClick={() => handleLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 transition-all active:scale-90 ${post.is_liked ? 'text-red-500' : 'text-brand-muted hover:text-red-400'}`}>
                          <Heart size={18} fill={post.is_liked ? 'currentColor' : 'none'} strokeWidth={post.is_liked ? 0 : 2} />
                          <span className="text-[13px] font-black text-white">{post.likes_count}</span>
                        </button>
                        <button onClick={() => openOverlay(() => { setActivePost(post); setActiveCommentsPostId(post.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at', { ascending: true }).then((r) => { setComments(r.data || []); setLoadingComments(false); }); })} className="flex items-center gap-1.5 text-brand-muted hover:text-accent-primary transition-all active:scale-90">
                          <MessageSquare size={18} />
                          <span className="text-[13px] font-black text-white">{post.comments_count}</span>
                        </button>
                        <button onClick={() => handleShare(post)} className="flex items-center gap-2 text-brand-muted hover:text-brand transition-all active:scale-90 ml-1">
                          <Share2 size={18} />
                        </button>
                        
                        <div className="w-px h-4 bg-white/[0.1] mx-0.5"></div>
                        
                        <button onClick={() => openOverlay(() => setOptionsMenuPost(post))} className="text-brand-muted hover:text-white transition-colors active:scale-90 p-1">
                          <MoreVertical size={20} strokeWidth={2} />
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasMorePosts && posts.length > 0 && (
             <div className="flex justify-center mt-2 mb-8">
               <button onClick={() => fetchFeed(true)} disabled={loadingMore} className="bg-surface-card border border-white/[0.05] rounded-full px-6 py-2.5 text-brand font-bold text-[13px] tracking-widest uppercase flex items-center gap-2 shadow-lg active:scale-95 transition-transform">
                 {loadingMore ? <Loader2 size={16} className="animate-spin text-accent-primary" /> : 'טען עוד פוסטים'}
               </button>
             </div>
          )}
        </div>
      </FadeIn>

      {/* OVERLAYS */}
      {portalReady && portalTarget && createPortal(
        <>
          <AnimatePresence>
            {/* מסך מדיה מלא */}
            {fullScreenMedia && (
              <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed inset-0 z-[999999] bg-[#000]">
                <div className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide" onScroll={handleContainerScroll}>
                  {fullScreenMedia.map((vid, idx) => {
                    const isVid = vid.media_url?.match(/\.(mp4|webm|mov)$/i);
                    const keyVal = vid._uid ? vid._uid : `${vid.id}-${idx}`;
                    const vidCircle = vid.circles ? vid.circles : (vid.user_circles && vid.user_circles.length > 0 ? vid.user_circles[0] : null);

                    return (
                      <div key={keyVal} className="w-full h-screen snap-center relative bg-[#000] flex items-center justify-center">
                        {isVid ? <video src={vid.media_url} loop playsInline className="w-full h-full object-cover full-media-item" onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())} /> : <img src={vid.media_url} className="w-full h-full object-contain full-media-item" onError={(e) => { e.currentTarget.src = 'https://placehold.co/500x500/111/333?text=Media+Unavailable'; }} />}
                        
                        {/* 3 נקודות - עובד פיקס ומוצמד לשמאל למטה */}
                        <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setOptionsMenuPost(vid)); }} className="absolute bottom-6 left-4 z-[70] p-2 active:scale-90 transition-transform drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] pointer-events-auto">
                           <MoreVertical size={28} strokeWidth={2.5} className="text-white" />
                        </button>
                        
                        <div className="absolute bottom-48 left-4 flex flex-col gap-6 items-center z-50 pointer-events-auto">
                          <button onClick={(e) => { e.stopPropagation(); handleLike(vid.id, vid.is_liked); }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform"><Heart size={30} className={vid.is_liked ? 'text-[#ff4757]' : 'text-white'} fill={vid.is_liked ? 'currentColor' : 'none'} strokeWidth={1.5} /><span className="text-white text-[13px] font-black drop-shadow-md">{vid.likes_count}</span></button>
                          <button onClick={(e) => { e.stopPropagation(); openOverlay(() => { setActivePost(vid); setActiveCommentsPostId(vid.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', vid.id).order('created_at', { ascending: true }).then((r) => { setComments(r.data || []); setLoadingComments(false); }); }); }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform"><MessageSquare size={30} className="text-white" strokeWidth={1.5} /><span className="text-white text-[13px] font-black drop-shadow-md">{vid.comments_count}</span></button>
                          <button onClick={(e) => { e.stopPropagation(); handleShare(vid); }} className="active:scale-90 transition-transform"><Share2 size={30} className="text-white" strokeWidth={1.5} /></button>
                        </div>

                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end pointer-events-none">
                          {/* משתמש ומועדונים צמודים לימין במסך המלא */}
                          <div className="flex flex-col items-end mb-2 w-full pr-2">
                             {vidCircle && (
                               <div className="flex items-center gap-1.5 mb-1 cursor-pointer pointer-events-auto text-accent-primary" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/circle/${vidCircle.slug}`), 50); }}>
                                 <span className="text-[11px] font-black tracking-wide uppercase drop-shadow-md">{vidCircle.name}</span>
                               </div>
                             )}
                             <div className="flex items-center gap-3 cursor-pointer pointer-events-auto" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${vid.user_id}`), 50); }}>
                               <span className="text-white font-black text-[17px] drop-shadow-md">{vid.profiles?.full_name || 'אנונימי'}</span>
                               <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-card border-2 border-white/[0.05] shrink-0 shadow-lg">{vid.profiles?.avatar_url ? <img src={vid.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={24} className="text-brand-muted w-full h-full p-2" />}</div>
                             </div>
                          </div>
                          
                          <p className="text-white text-[15px] font-medium text-right pr-2 w-[85%] ml-auto line-clamp-3 pointer-events-auto cursor-pointer drop-shadow-md" onClick={(e) => { e.stopPropagation(); openOverlay(() => setActiveDescPost(vid)); }}>{vid.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* מודאל תגובות בלבן نקי */}
            {activeCommentsPostId && (
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" dir="rtl" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="relative z-10 bg-white rounded-t-[40px] h-[85vh] flex flex-col overflow-hidden pb-10 shadow-[0_-20px_50px_rgba(0,0,0,0.15)] border-t border-black/[0.05]">
                  <div className="w-full py-5 flex justify-center cursor-grab active:cursor-grabbing border-b border-black/[0.05]" onPointerDown={(e) => commentsDragControls.start(e)} style={{ touchAction: 'none' }}><div className="w-16 h-1.5 bg-black/10 rounded-full" /></div>
                  <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-hide">
                    {loadingComments ? <Loader2 className="animate-spin mx-auto text-accent-primary mt-10" /> : comments.filter((c) => c && !c.parent_id).map((c) => {
                      const replies = comments.filter((r) => r && r.parent_id === c.id);
                      return (
                        <div key={c.id} className="flex flex-col gap-2">
                          <div className="flex gap-3">
                            <div className="w-10 h-10 min-w-[40px] rounded-full bg-neutral-100 shrink-0 overflow-hidden cursor-pointer border border-neutral-200 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>
                              {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover object-center" /> : <UserCircle className="w-full h-full p-2 text-neutral-400" />}
                            </div>
                            <div className="flex flex-col flex-1">
                              <div className="bg-neutral-100 p-3 rounded-[24px] rounded-tr-sm cursor-pointer" onClick={() => openOverlay(() => setCommentActionModal(c))}>
                                <span className="text-black font-bold text-xs mb-1 inline-block" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>{c.profiles?.full_name || 'אנונימי'}</span>
                                <p className="text-neutral-700 text-sm whitespace-pre-wrap leading-relaxed">{c.content}</p>
                              </div>
                            </div>
                          </div>
                          {replies.length > 0 && (
                            <div className="pr-10 flex flex-col gap-2">
                              {replies.map((reply) => (
                                <div key={reply.id} className="bg-neutral-50 rounded-[20px] p-3 border border-neutral-200">
                                  <div className="text-black text-xs font-bold mb-1">{reply.profiles?.full_name || 'אנונימי'}</div>
                                  <div className="text-neutral-600 text-sm">{reply.content}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="p-4 bg-white border-t border-neutral-200 flex gap-2 pb-8 items-center">
                    <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="הוסף תגובה..." className="flex-1 bg-neutral-100 border border-neutral-200 text-black rounded-full px-5 h-12 outline-none text-[15px] placeholder:text-neutral-400" />
                    {/* כפתור שליחת תגובה - תכלת עם אייקון לבן */}
                    <button onClick={submitComment} disabled={!newComment.trim()} className="w-12 h-12 rounded-full shrink-0 bg-accent-primary flex items-center justify-center shadow-md hover:bg-accent-primary/90 disabled:opacity-50 ml-2"><Send size={18} className="rtl:-scale-x-100 -ml-1 text-white" /></button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* מודאל אפשרויות פוסט בלבן נקי */}
            {optionsMenuPost && (
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-white rounded-t-[40px] p-6 flex flex-col gap-2 pb-12 shadow-[0_-10px_50px_rgba(0,0,0,0.15)] border-t border-black/[0.05]">
                  <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-black/10 rounded-full" /></div>
                  <button onClick={() => { closeOverlay(); setTimeout(() => handleShare(optionsMenuPost), 100); }} className="w-full p-4 bg-neutral-100 rounded-full text-black font-bold flex justify-between items-center text-lg active:bg-neutral-200 transition-colors border border-neutral-200/50"><span>שתף פוסט</span><Share2 size={20} className="text-neutral-500" /></button>
                  {optionsMenuPost.media_url && <button onClick={() => handleDownloadMedia(optionsMenuPost.media_url)} className="w-full p-4 bg-neutral-100 rounded-full text-black font-bold flex justify-between items-center text-lg active:bg-neutral-200 transition-colors mt-2 border border-neutral-200/50"><span>שמור למכשיר</span><Download size={20} className="text-neutral-500" /></button>}
                  <button onClick={async () => { try { await supabase.from('saved_posts').insert({ user_id: currentUserId, post_id: optionsMenuPost.id }); toast.success('הפוסט נשמר במועדפים!'); } catch { toast.error('הפוסט כבר שמור אצלך'); } closeOverlay(); }} className="w-full p-4 bg-neutral-100 rounded-full text-black font-bold flex justify-between items-center text-lg active:bg-neutral-200 transition-colors mt-2 border border-neutral-200/50"><span>שמור במועדפים</span><Bookmark size={20} className="text-neutral-500" /></button>
                  <button onClick={() => handleCopyLink(optionsMenuPost)} className="w-full p-4 bg-neutral-100 rounded-full text-black font-bold flex justify-between items-center text-lg active:bg-neutral-200 transition-colors mt-2 border border-neutral-200/50"><span>העתק קישור</span><LinkIcon size={20} className="text-neutral-500" /></button>
                  {optionsMenuPost.user_id === currentUserId && (
                    <>
                      <button onClick={() => { closeOverlay(); setTimeout(() => { openOverlay(() => { setEditingPost(optionsMenuPost); setNewPost(optionsMenuPost.content || ''); setShowCreatePost(true); }); }, 100); }} className="w-full p-4 bg-neutral-100 rounded-full text-black font-bold flex justify-between items-center text-lg active:bg-neutral-200 transition-colors mt-4 border border-neutral-200/50"><span>ערוך פוסט</span><Edit2 size={20} className="text-neutral-500" /></button>
                      <button onClick={() => { if (window.confirm('למחוק פוסט?')) { deletePost(optionsMenuPost.id); } }} className="w-full p-4 bg-red-50 border border-red-100 rounded-full text-red-500 font-bold flex justify-between items-center text-lg mt-2 active:bg-red-100 transition-colors"><span>מחק פוסט</span><Trash2 size={20} className="text-red-500" /></button>
                    </>
                  )}
                </motion.div>
              </div>
            )}

            {/* מודאל פעולות לתגובה בלבן נקי */}
            {commentActionModal && (
              <div className="fixed inset-0 z-[100000] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-white rounded-t-[40px] p-6 flex flex-col gap-3 pb-12 shadow-[0_-10px_50px_rgba(0,0,0,0.15)] border-t border-black/[0.05]">
                  <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-black/10 rounded-full" /></div>
                  <button onClick={() => { closeOverlay(); setReplyingTo(commentActionModal.parent_id ? comments.find((c) => c?.id === commentActionModal.parent_id) : commentActionModal); setNewComment(`@${commentActionModal.profiles?.full_name} `); }} className="w-full p-4 bg-neutral-100 rounded-full text-black font-bold flex justify-between items-center text-lg hover:bg-neutral-200 transition-colors border border-neutral-200/50"><span>השב לתגובה</span><Reply size={20} className="text-neutral-500" /></button>
                  {commentActionModal.user_id === currentUserId && (
                    <>
                      <button onClick={() => { closeOverlay(); setEditingCommentId(commentActionModal.id); setNewComment(commentActionModal.content); }} className="w-full p-4 bg-neutral-100 rounded-full text-black font-bold flex justify-between items-center text-lg hover:bg-neutral-200 transition-colors border border-neutral-200/50"><span>ערוך תגובה</span><Edit2 size={20} className="text-neutral-500" /></button>
                      <button onClick={() => { if (window.confirm('למחוק תגובה?')) { closeOverlay(); deleteComment(commentActionModal.id); } }} className="w-full p-4 bg-red-50 border border-red-100 rounded-full text-red-500 font-bold flex justify-between items-center text-lg mt-2 hover:bg-red-100 transition-colors"><span>מחק תגובה</span><Trash2 size={20} className="text-red-500" /></button>
                    </>
                  )}
                </motion.div>
              </div>
            )}
            
            {/* מודאל עריכת פוסט */}
            {showCreatePost && (
              <div className="fixed inset-0 z-[100000] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-white rounded-t-[40px] p-6 flex flex-col gap-4 pb-12 border-t border-black/[0.05] shadow-[0_-10px_50px_rgba(0,0,0,0.15)]">
                  <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-black/10 rounded-full" /></div>
                  <div className="flex justify-between items-center"><h3 className="text-black font-black text-lg">עריכת פוסט</h3><button onClick={closeOverlay} className="text-neutral-400 hover:text-black"><X size={20} /></button></div>
                  <textarea value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder="כתוב משהו..." className="h-36 bg-neutral-50 rounded-[20px] p-5 text-black text-[16px] outline-none resize-none border border-neutral-200 placeholder:text-neutral-400" />
                  <Button onClick={handlePost} disabled={!newPost.trim()} className="h-14 bg-accent-primary text-white font-black rounded-full mt-2 shadow-lg hover:bg-accent-primary/90">שמור עריכה</Button>
                </motion.div>
              </div>
            )}

            {/* מודאל תיאור פוסט מלא בלבן נקי */}
            {activeDescPost && (
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-white rounded-t-[40px] flex flex-col overflow-hidden pb-10 max-h-[75vh] shadow-[0_-10px_50px_rgba(0,0,0,0.15)] border-t border-black/[0.05]">
                  <div className="w-full py-6 flex justify-center cursor-grab active:cursor-grabbing border-b border-neutral-200/50"><div className="w-16 h-1.5 bg-black/10 rounded-full" /></div>
                  <div className="px-6 py-4 border-b border-neutral-200/50"><h2 className="text-black font-black text-lg text-center">תיאור מלא</h2></div>
                  <div className="p-6 overflow-y-auto" onPointerDown={stopPropagation} onTouchStart={stopPropagation}><p className="text-neutral-700 text-[15px] leading-relaxed text-right whitespace-pre-wrap">{activeDescPost.content}</p></div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>,
        portalTarget
      )}
    </>
  );
};
