import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { FadeIn, Button } from '../components/ui';
import {
  Loader2,
  Bell,
  Users,
  Heart,
  MessageSquare,
  Send,
  X,
  Paperclip,
  RefreshCw,
  UserCircle,
  Trash2,
  Edit2,
  Share2,
  MoreVertical,
  ChevronLeft,
  Reply,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  Download,
  Link as LinkIcon,
  Bookmark,
  Crown
} from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { Share } from '@capacitor/share';

type AnyPost = any;
type AnyComment = any;

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pullStartY = useRef(0);
  const lastScrollY = useRef(0);
  const [mounted, setMounted] = useState(false);
  const [posts, setPosts] = useState<AnyPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingPost, setEditingPost] = useState<AnyPost | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [activePost, setActivePost] = useState<AnyPost | null>(null);
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<AnyComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<AnyComment | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});
  const [commentActionModal, setCommentActionModal] = useState<AnyComment | null>(null);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [optionsMenuPost, setOptionsMenuPost] = useState<AnyPost | null>(null);
  const [activeDescPost, setActiveDescPost] = useState<AnyPost | null>(null);
  const [fullScreenMedia, setFullScreenMedia] = useState<AnyPost[] | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState('');

  const [userCirclesModal, setUserCirclesModal] = useState<any[] | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const stateRef = useRef({
    comments: false,
    options: false,
    desc: false,
    create: false,
    fullscreen: false,
    commentAction: false,
    userCircles: false,
  });

  const mediaPosts = useMemo(() => posts.filter((p) => !!p.media_url), [posts]);

  const getRandomMediaBatch = (size = 6, excludeId?: string) => {
    const pool = mediaPosts.filter((p) => (excludeId ? p.id !== excludeId : true));
    if (pool.length === 0) return [];
    const batch: AnyPost[] = [];
    for (let i = 0; i < size; i += 1) {
      const picked = pool[Math.floor(Math.random() * pool.length)];
      batch.push({
        ...picked,
        _uid: `${picked.id}-${Math.random().toString(36).slice(2, 9)}`,
      });
    }
    return batch;
  };

  useEffect(() => {
    stateRef.current = {
      comments: !!activeCommentsPostId,
      options: !!optionsMenuPost,
      desc: !!activeDescPost,
      create: showCreatePost,
      fullscreen: !!fullScreenMedia,
      commentAction: !!commentActionModal,
      userCircles: !!userCirclesModal,
    };
  }, [
    activeCommentsPostId,
    optionsMenuPost,
    activeDescPost,
    showCreatePost,
    fullScreenMedia,
    commentActionModal,
    userCirclesModal,
  ]);

  useEffect(() => {
    const handlePopState = () => {
      const s = stateRef.current;
      if (s.commentAction) {
        setCommentActionModal(null);
      } else if (s.userCircles) {
        setUserCirclesModal(null);
      } else if (s.comments) {
        setActiveCommentsPostId(null);
        setActivePost(null);
        setReplyingTo(null);
        setEditingCommentId(null);
        setNewComment('');
      } else if (s.options) {
        setOptionsMenuPost(null);
      } else if (s.desc) {
        setActiveDescPost(null);
      } else if (s.create) {
        setShowCreatePost(false);
        setEditingPost(null);
        setSelectedFile(null);
        setNewPost('');
      } else if (s.fullscreen) {
        setFullScreenMedia(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY < lastScrollY.current && currentY > 300) setShowScrollTop(true);
      else setShowScrollTop(false);
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openOverlay = (action: () => void) => {
    window.history.pushState({ overlay: true }, '');
    action();
  };

  const closeOverlay = () => {
    window.history.back();
  };

  const isAnyModalOpen = () => Object.values(stateRef.current).some(Boolean);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const checkUnreadNotifications = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authData.user.id)
        .eq('is_read', false);
      setUnreadCount(count || 0);
    } catch {
      // ignore
    }
  };

  const fetchData = async (isSilentRefresh = false) => {
    if (!isSilentRefresh) setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id || '';
      if (uid) setCurrentUserId(uid);

      const [rawPosts, rawProfiles, rawLikes, rawComments, rawMembers, rawCircles] = await Promise.all([
        supabase.from('posts').select('*').order('created_at', { ascending: false }).then((r) => r.data || []),
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
          const userCircles = rawCircles.filter((c: any) =>
            rawMembers.some((m: any) => m.circle_id === c.id && m.user_id === p.user_id),
          );
          return {
            ...p,
            profiles: prof,
            likes_count: pLikes.length,
            comments_count: pComments.length,
            is_liked: !!uid && pLikes.some((l: any) => l.user_id === uid),
            user_circles: userCircles,
          };
        });

      setPosts(fetchedPosts);
    } catch {
      toast.error('שגיאה בטעינת הפיד');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchData(false);
    checkUnreadNotifications();
  }, []);

  useEffect(() => {
    const presenceChannel = supabase.channel('global_online');
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        let activeCount = 0;
        for (const key in state) activeCount += state[key].length;
        setOnlineUsers(activeCount > 0 ? activeCount : 1);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            online_at: new Date().toISOString(),
            user_id: currentUserId || 'guest',
          });
        }
      });
    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!fullScreenMedia) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const vid = entry.target as HTMLVideoElement;
          if (vid.tagName !== 'VIDEO') return;
          if (entry.isIntersecting) {
            vid.muted = false;
            vid.play().catch(() => {});
          } else {
            vid.pause();
            vid.muted = true;
            vid.currentTime = 0;
          }
        });
      },
      { threshold: 0.7 },
    );
    document.querySelectorAll('.full-media-item').forEach((v) => observer.observe(v));
    return () => observer.disconnect();
  }, [fullScreenMedia, currentMediaIndex]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAnyModalOpen()) return;
    if (window.scrollY <= 0) pullStartY.current = e.touches[0].clientY;
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
      setRefreshing(true);
      setPullY(0);
      triggerFeedback('coin');
      await fetchData(true);
      await checkUnreadNotifications();
    } else {
      setPullY(0);
    }
    pullStartY.current = 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      setSelectedFile(file);
    } else if (file) {
      toast.error('אנא בחר קובץ תמונה או וידאו תקין');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePost = async () => {
    if (!newPost.trim() && !selectedFile && !editingPost) return;
    setPosting(true);
    try {
      if (editingPost) {
        await supabase.from('posts').update({ content: newPost.trim() }).eq('id', editingPost.id);
        setPosts((curr) =>
          curr.map((p) =>
            p.id === editingPost.id ? { ...p, content: newPost.trim(), } : p,
          ),
        );
        toast.success('עודכן בהצלחה');
        closeOverlay();
        return;
      }

      let media_url: string | null = null;
      let media_type = 'text';

      if (selectedFile) {
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}_${selectedFile.name}`;
        const uploadRes = await supabase.storage.from('feed_images').upload(fileName, selectedFile);
        if (uploadRes.error) throw uploadRes.error;
        media_url = supabase.storage.from('feed_images').getPublicUrl(uploadRes.data.path).data.publicUrl;
        media_type = selectedFile.type.startsWith('video/') ? 'video' : 'image';
      }
      const insertRes = await supabase.from('posts').insert({
        user_id: currentUserId,
        content: newPost.trim(),
        media_url,
        media_type,
        circle_id: null,
      });
      if (insertRes.error) throw insertRes.error;
      setNewPost('');
      setSelectedFile(null);
      setEditingPost(null);
      await fetchData(true);
    } catch {
      toast.error('שגיאה בשמירה');
    } finally {
      setPosting(false);
    }
  };

  const handleShare = async (post: AnyPost) => {
    triggerFeedback('pop');
    const publicUrl = `https://inner-app.com/post/${post.id}`;
    const textToShare = `${post.content ? `${post.content}\n\n` : ''}צפה בפוסט הזה ב-INNER!`;

    try {
      const isNative =
        typeof window !== 'undefined' &&
        !!(window as any).Capacitor &&
        (window as any).Capacitor.isNativePlatform?.();

      if (isNative) {
        await Share.share({ title: 'INNER', text: textToShare, url: publicUrl, dialogTitle: 'שתף עם חברים' });
      } else if (navigator.share && window.isSecureContext) {
        await navigator.share({ title: 'INNER', text: textToShare, url: publicUrl });
      } else {
        await navigator.clipboard.writeText(`${textToShare}\n${publicUrl}`);
        toast.success('הקישור הועתק ללוח');
      }
    } catch {
      // ignore
    }
  };

  const handleCopyLink = async (post: AnyPost) => {
    const publicUrl = `https://inner-app.com/post/${post.id}`;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('הקישור הועתק ללוח', { icon: '🔗' });
    } catch {
      toast.error('שגיאה בהעתקה');
    }
    closeOverlay();
  };

  const handleDownloadMedia = async (mediaUrl: string) => {
    try {
      toast.loading('מוריד קובץ...', { id: 'dl' });
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `INNER_Media_${Date.now()}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('הקובץ נשמר בהצלחה', { id: 'dl' });
    } catch {
      toast.error('לא ניתן להוריד את הקובץ', { id: 'dl' });
    }
    closeOverlay();
  };

  const handleSavePost = async (post: AnyPost) => {
    try {
      await supabase.from('saved_posts').insert({
        user_id: currentUserId,
        post_id: post.id,
      });
      toast.success('הפוסט נשמר במועדפים!', { icon: '⭐' });
    } catch (e: any) {
      if (e?.code === '23505') {
        toast.success('הפוסט כבר שמור אצלך', { icon: '⭐' });
      } else {
        toast.error('שגיאה בשמירה');
      }
    }
    closeOverlay();
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    triggerFeedback('pop');
    const update = (list: AnyPost[]) =>
      list.map((p) =>
        p.id === postId
          ? {
              ...p,
              is_liked: !isLiked,
              likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1,
            }
          : p,
      );
    setPosts((prev) => update(prev));
    if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));
    try {
      await apiFetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'x-user-id': currentUserId },
      });
    } catch {
      fetchData(true);
    }
  };

  const submitComment = async () => {
    if (!newComment.trim() || !activePost) return;
    try {
      if (editingCommentId) {
        const updateRes = await supabase
          .from('comments')
          .update({ content: newComment.trim() })
          .eq('id', editingCommentId);

        if (updateRes.error) throw updateRes.error;
        setComments((prev) =>
          prev.map((c) =>
            c.id === editingCommentId ? { ...c, content: newComment.trim() } : c,
          ),
        );
        setEditingCommentId(null);
      } else {
        const data = await apiFetch(`/api/posts/${activePost.id}/comments`, {
          method: 'POST',
          headers: { 'x-user-id': currentUserId },
          body: JSON.stringify({
            content: newComment.trim(),
            parent_id: replyingTo?.id || null,
          }),
        });

        if (data) {
          setComments((prev) => [...prev, data]);
          const update = (list: AnyPost[]) =>
            list.map((p) =>
              p.id === activePost.id
                ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p,
            );
          setPosts((prev) => update(prev));
          if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));

          if (replyingTo) {
            setExpandedThreads((prev) => ({
              ...prev,
              [replyingTo.id]: true,
            }));
          }
          triggerFeedback('coin');
        }
      }
      setNewComment('');
      setReplyingTo(null);
    } catch {
      toast.error('שגיאה בשרת');
    }
  };

  const toggleCommentLike = (commentId: string) => {
    setLikedComments((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
    triggerFeedback('pop');
  };

  const deletePost = async (postId: string) => {
    triggerFeedback('error');
    closeOverlay();
    setPosts((curr) => curr.filter((p) => p.id !== postId));
    await supabase.from('posts').delete().eq('id', postId);
  };

  const deleteComment = async (commentId: string) => {
    triggerFeedback('error');
    setComments((curr) => curr.filter((c) => c && c.id !== commentId && c.parent_id !== commentId));
    const update = (list: AnyPost[]) =>
      list.map((p) =>
        p.id === activePost?.id
          ? { ...p, comments_count: Math.max(0, (p.comments_count || 0) - 1) } : p,
      );
    setPosts((prev) => update(prev));
    if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));

    try {
      await supabase.from('comments').delete().eq('id', commentId);
    } catch {
      // ignore
    }
  };

  const handleOpenFullscreen = (post: AnyPost) => {
    openOverlay(() => {
      setFullScreenMedia([
        { ...post, _uid: `${post.id}-${Math.random().toString(36).slice(2, 9)}` },
        ...getRandomMediaBatch(10, post.id),
      ]);
      setCurrentMediaIndex(0);
    });
  };

  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (scrollTimeout.current) return;

    scrollTimeout.current = setTimeout(() => {
      scrollTimeout.current = null;
      const index = Math.round(target.scrollTop / target.clientHeight);
      if (index !== currentMediaIndex) setCurrentMediaIndex(index);

      if (target.scrollHeight - target.scrollTop <= target.clientHeight * 2) {
        const more = getRandomMediaBatch(6);
        if (more.length) setFullScreenMedia((prev) => [...(prev || []), ...more]);
      }
    }, 120);
  };

  const renderCommentText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(@[\wא-ת]+)/g);
    return parts.map((part, i) =>
      part.startsWith('@') ? (
        <span key={i} className="text-accent-primary font-bold">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  };

  const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

  if (loading && posts.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 className="animate-spin text-accent-primary" />
      </div>
    );
  }

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,video/*"
      />

      <AnimatePresence>
        {showScrollTop && !isAnyModalOpen() && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            onClick={scrollToTop}
            className="fixed bottom-24 right-5 z-[80] w-12 h-12 bg-surface-card border border-surface-border rounded-full flex items-center justify-center shadow-lg active:scale-90"
          >
            <ArrowUp size={24} className="text-brand" />
          </motion.button>
        )}
      </AnimatePresence>

      <FadeIn
        className="px-4 pt-8 pb-32 bg-surface min-h-screen relative overflow-x-hidden touch-pan-y"
        dir="rtl"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull to refresh indicator */}
        <div
          className="fixed top-0 left-0 right-0 flex justify-center z-50 pointer-events-none transition-transform duration-200"
          style={{
            transform: `translateY(${Math.max(pullY - 40, -40)}px)`,
            opacity: pullY / 60,
          }}
        >
          <div className="bg-surface-card p-2.5 rounded-full shadow-lg border border-surface-border mt-6">
            <RefreshCw size={22} className={`text-brand ${refreshing ? 'animate-spin' : ''}`} />
          </div>
        </div>

        <div className="relative z-10">
          
          {/* 🔝 HEADER */}
          <div className="flex justify-between items-start mb-6 h-12 px-1">
            <div className="w-10" />
            <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2">
              <h1 className="text-3xl font-black text-brand tracking-widest drop-shadow-md">INNER</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]" />
                <span className="text-[10px] font-black text-brand-muted tracking-widest">
                  {onlineUsers.toLocaleString()} אונליין
                </span>
              </div>
            </div>

            <button
              onClick={() => navigate('/notifications')}
              className="w-10 h-10 flex justify-center items-center bg-surface-card border border-surface-border rounded-full active:scale-90 relative shadow-sm"
            >
              <Bell size={18} className="text-brand" />
              {unreadCount > 0 && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-surface animate-pulse" />
              )}
            </button>
          </div>

          {/* 📝 CREATE POST BOX */}
          <div className="-mx-4 mb-6 px-2">
            <div className="p-4 rounded-[32px] border border-surface-border bg-surface-card shadow-sm relative z-10 flex flex-col gap-3">
              {selectedFile && (
                <div className="relative w-full h-44 rounded-[20px] overflow-hidden bg-surface border border-surface-border flex items-center justify-center">
                  {selectedFile.type.startsWith('video/') ? (
                    <video src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover opacity-90" preload="metadata" playsInline />
                  ) : (
                    <img src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover opacity-90" loading="lazy" />
                  )}
                  <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="absolute top-3 right-3 w-8 h-8 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white z-10">
                    <X size={16} />
                  </button>
                </div>
              )}

              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="מה קורה, יש חדש?"
                className="w-full bg-transparent border-none text-brand text-[15px] font-medium outline-none resize-none placeholder:text-brand-muted px-2 min-h-[60px]"
                rows={Math.min(Math.max(newPost.split('\n').length, 2), 5)}
              />

              <div className="flex justify-between items-center border-t border-surface-border pt-3 mt-1">
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-brand-muted hover:text-brand px-2 py-1.5 rounded-full transition-colors">
                  <Paperclip size={18} />
                  <span className="text-[12px] font-bold">מדיה</span>
                </button>
                
                <button
                  onClick={handlePost}
                  disabled={posting || (!newPost.trim() && !selectedFile)}
                  className="px-6 h-10 rounded-full bg-white text-black font-black text-[13px] tracking-widest uppercase disabled:opacity-50 active:scale-95 transition-all shadow-md"
                >
                  {posting ? <Loader2 className="animate-spin w-4 h-4 mx-auto" /> : 'פרסם'}
                </button>
              </div>
            </div>
          </div>

          {/* 📰 FEED */}
          <div className="flex flex-col gap-5 relative z-10 px-0">
            {posts.map((post) => {
              const hasMedia = !!post.media_url;
              const isVideo = post.media_url?.match(/\.(mp4|webm|mov)$/i);
              const isCore = post.profiles?.role_label === 'CORE';

              return (
                <div key={post.id} className="-mx-4 px-2">
                  <div className="flex flex-col rounded-[32px] bg-surface-card border border-surface-border overflow-hidden shadow-sm">
                    
                    {/* Media Header */}
                    {hasMedia && (
                      <div className="w-full bg-surface relative cursor-pointer" onClick={() => handleOpenFullscreen(post)}>
                        {isVideo ? (
                          <video src={post.media_url} autoPlay loop muted playsInline preload="metadata" className="w-full max-h-[500px] object-cover opacity-95" />
                        ) : (
                          <img src={post.media_url} onError={(e) => { e.currentTarget.src = 'https://placehold.co/500x500/111/333?text=Media+Unavailable'; }} className="w-full max-h-[500px] object-cover opacity-95" loading="lazy" decoding="async" />
                        )}

                        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-24 bg-gradient-to-t from-surface-card via-surface-card/60 to-transparent">
                          {post.content && (
                            <p onClick={(e) => { e.stopPropagation(); openOverlay(() => setActiveDescPost(post)); }} className="text-brand text-sm leading-relaxed text-right line-clamp-2 cursor-pointer active:opacity-50 mb-4 drop-shadow-md">
                              {post.content}
                            </p>
                          )}

                          {post.user_circles && post.user_circles.length > 0 && (
                            <div className="flex gap-4 overflow-x-auto scrollbar-hide items-center mb-4">
                              {post.user_circles.slice(0, 10).map((circle: any) => (
                                <div key={circle.id} onClick={(e) => { e.stopPropagation(); navigate(`/circle/${circle.slug || circle.id}`); }} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform">
                                  <div className="w-12 h-12 rounded-full overflow-hidden bg-surface border border-surface-border shadow-sm">
                                    {circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover" loading="lazy" /> : <Users className="w-full h-full p-2.5 text-brand-muted" />}
                                  </div>
                                  <span className="text-[9px] text-brand-muted font-bold max-w-[55px] truncate text-center uppercase tracking-wider">{circle.name}</span>
                                </div>
                              ))}
                              {post.user_circles.length > 10 && (
                                <div onClick={(e) => { e.stopPropagation(); openOverlay(() => setUserCirclesModal(post.user_circles)); }} className="w-12 h-12 rounded-full bg-surface border border-surface-border flex items-center justify-center shrink-0 cursor-pointer active:scale-95 shadow-sm">
                                  <ChevronLeft size={16} className="text-brand-muted" />
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-3 mt-1">
                            
                            {/* User Info */}
                            <div className="flex items-center gap-3 cursor-pointer group" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${post.user_id}`); }}>
                              <div className="w-10 h-10 rounded-full bg-surface border border-surface-border overflow-hidden shrink-0">
                                {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" loading="lazy" /> : <UserCircle className="w-full h-full p-2 text-brand-muted" />}
                              </div>
                              <div className="flex flex-col text-right">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-brand font-black text-[14px]">{post.profiles?.full_name || 'אנונימי'}</span>
                                  {isCore && <Crown size={12} className="text-accent-primary" />}
                                </div>
                                <span className="text-brand-muted text-[10px]">{new Date(post.created_at).toLocaleDateString('he-IL')}</span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-4 flex-row-reverse">
                              <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setOptionsMenuPost(post)); }} className="text-brand-muted active:scale-90"><MoreVertical size={20} /></button>
                              <button onClick={(e) => { e.stopPropagation(); handleShare(post); }} className="flex items-center gap-1.5 text-brand-muted active:scale-90"><Share2 size={20} /></button>
                              <button onClick={(e) => { e.stopPropagation(); openOverlay(() => { setActivePost(post); setActiveCommentsPostId(post.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at', { ascending: true }).then((r) => { setComments(r.data || []); setLoadingComments(false); }); }); }} className="flex items-center gap-1.5 text-brand-muted active:scale-90">
                                <MessageSquare size={20} />
                                <span className="text-[13px] font-black">{post.comments_count}</span>
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleLike(post.id, post.is_liked); }} className={`flex items-center gap-1.5 active:scale-90 transition-transform ${post.is_liked ? 'text-red-500' : 'text-brand-muted'}`}>
                                <Heart size={20} fill={post.is_liked ? 'currentColor' : 'none'} />
                                <span className="text-[13px] font-black">{post.likes_count}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Text Only Post */}
                    {!hasMedia && (
                      <div className="p-5 flex flex-col gap-4">
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate(`/profile/${post.user_id}`)}>
                            <div className="w-10 h-10 rounded-full bg-surface border border-surface-border overflow-hidden shrink-0 flex items-center justify-center">
                              {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" loading="lazy" /> : <span className="text-brand-muted font-black text-sm">{(post.profiles?.full_name || 'א')[0]}</span>}
                            </div>
                            <div className="flex flex-col text-right">
                              <div className="flex items-center gap-1.5">
                                <span className="text-brand font-black text-[14px]">{post.profiles?.full_name || 'אנונימי'}</span>
                                {isCore && <Crown size={12} className="text-accent-primary" />}
                              </div>
                              <span className="text-brand-muted text-[10px]">{new Date(post.created_at).toLocaleDateString('he-IL')}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 flex-row-reverse">
                            <button onClick={() => openOverlay(() => setOptionsMenuPost(post))} className="text-brand-muted active:scale-90"><MoreVertical size={20} /></button>
                            <button onClick={() => handleShare(post)} className="flex items-center gap-1.5 text-brand-muted active:scale-90"><Share2 size={20} /></button>
                            <button onClick={() => openOverlay(() => { setActivePost(post); setActiveCommentsPostId(post.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at', { ascending: true }).then((r) => { setComments(r.data || []); setLoadingComments(false); }); })} className="flex items-center gap-1.5 text-brand-muted active:scale-90">
                              <MessageSquare size={20} />
                              <span className="text-[13px] font-black">{post.comments_count}</span>
                            </button>
                            <button onClick={() => handleLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 active:scale-90 transition-transform ${post.is_liked ? 'text-red-500' : 'text-brand-muted'}`}>
                              <Heart size={20} fill={post.is_liked ? 'currentColor' : 'none'} />
                              <span className="text-[13px] font-black">{post.likes_count}</span>
                            </button>
                          </div>
                        </div>

                        <div onClick={() => openOverlay(() => setActiveDescPost(post))} className={`bg-surface border border-surface-border rounded-[24px] px-5 py-6 cursor-pointer ${(post.content || '').length > 220 ? 'min-h-[220px]' : 'min-h-[120px]'} flex items-center justify-center shadow-inner`}>
                          <p className="text-brand text-[15px] font-medium leading-relaxed text-center whitespace-pre-wrap break-words">{post.content}</p>
                        </div>

                        {post.user_circles && post.user_circles.length > 0 && (
                          <div className="flex gap-4 overflow-x-auto scrollbar-hide items-center">
                            {post.user_circles.slice(0, 10).map((circle: any) => (
                              <div key={circle.id} onClick={() => navigate(`/circle/${circle.slug || circle.id}`)} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform">
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-surface border border-surface-border shadow-sm">
                                  {circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover" loading="lazy" /> : <Users className="w-full h-full p-2.5 text-brand-muted" />}
                                </div>
                                <span className="text-[9px] text-brand-muted font-bold max-w-[55px] truncate text-center uppercase tracking-widest">{circle.name}</span>
                              </div>
                            ))}
                            {post.user_circles.length > 10 && (
                              <div onClick={() => openOverlay(() => setUserCirclesModal(post.user_circles))} className="w-10 h-10 rounded-full bg-surface border border-surface-border flex items-center justify-center shrink-0 cursor-pointer active:scale-95 shadow-sm">
                                <ChevronLeft size={16} className="text-brand-muted" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </FadeIn>

      {/* OVERLAYS (All Dark Mode, Clean UI) */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          
          {/* FULL SCREEN MEDIA */}
          {fullScreenMedia && (
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed inset-0 z-[999999] bg-surface">
              <div className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide" onScroll={handleContainerScroll}>
                {fullScreenMedia.map((vid, idx) => {
                  const isVid = vid.media_url?.match(/\.(mp4|webm|mov)$/i);
                  return (
                    <div key={vid._uid || `${vid.id}-${idx}`} className="w-full h-screen snap-center relative bg-surface flex items-center justify-center">
                      {isVid ? (
                        <video src={vid.media_url} loop playsInline className="w-full h-full object-cover full-media-item" onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())} />
                      ) : (
                        <img src={vid.media_url} className="w-full h-full object-contain full-media-item" onError={(e) => { e.currentTarget.src = 'https://placehold.co/500x500/111/333?text=Media+Unavailable'; }} loading="lazy" />
                      )}
                      
                      <button onClick={(e) => { e.stopPropagation(); closeOverlay(); }} className="absolute top-6 left-4 z-[60] active:scale-90 transition-transform bg-surface-card border border-surface-border rounded-full p-2 shadow-md">
                        <X size={20} className="text-brand" />
                      </button>

                      <div className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-44 bg-gradient-to-t from-surface via-surface/80 to-transparent flex flex-col pointer-events-none">
                        {vid.content && (
                          <p className="text-brand text-[14px] font-medium text-right max-w-[85%] line-clamp-3 pointer-events-auto cursor-pointer mb-4 drop-shadow-md" onClick={(e) => { e.stopPropagation(); openOverlay(() => setActiveDescPost(vid)); }}>
                            {vid.content}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between pointer-events-auto">
                          <div className="flex items-center gap-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${vid.user_id}`), 50); }}>
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-surface border border-surface-border shrink-0 shadow-sm flex items-center justify-center">
                              {vid.profiles?.avatar_url ? <img src={vid.profiles.avatar_url} className="w-full h-full object-cover" loading="lazy" /> : <span className="text-brand-muted font-black text-lg">{(vid.profiles?.full_name || 'א')[0]}</span>}
                            </div>
                            <div className="flex flex-col text-right">
                              <span className="text-brand font-black text-[16px] drop-shadow-md">{vid.profiles?.full_name || 'אנונימי'}</span>
                              <span className="text-brand-muted text-[11px]">{new Date(vid.created_at).toLocaleDateString('he-IL')}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-5">
                            <button onClick={(e) => { e.stopPropagation(); handleLike(vid.id, vid.is_liked); }} className={`flex flex-col items-center gap-1 active:scale-90 transition-transform ${vid.is_liked ? 'text-red-500' : 'text-brand'}`}>
                              <Heart size={26} fill={vid.is_liked ? 'currentColor' : 'none'} />
                              <span className="text-[12px] font-black drop-shadow-md">{vid.likes_count}</span>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); openOverlay(() => { setActivePost(vid); setActiveCommentsPostId(vid.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', vid.id).order('created_at', { ascending: true }).then((r) => { setComments(r.data || []); setLoadingComments(false); }); }); }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform text-brand">
                              <MessageSquare size={26} />
                              <span className="text-[12px] font-black drop-shadow-md">{vid.comments_count}</span>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setOptionsMenuPost(vid)); }} className="active:scale-90 transition-transform text-brand"><MoreVertical size={26} /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* COMMENTS MODAL */}
          {activeCommentsPostId && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 400 }} className="relative z-10 bg-surface rounded-t-[40px] h-[80vh] flex flex-col overflow-hidden pb-10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border">
                <div className="w-full py-5 flex justify-center cursor-grab active:cursor-grabbing border-b border-surface-border"><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 scrollbar-hide">
                  {loadingComments ? <Loader2 className="animate-spin mx-auto text-brand-muted mt-10" /> : comments.filter((c) => c && !c.parent_id).length === 0 ? <div className="text-center text-brand-muted text-[13px] font-bold mt-10">אין תגובות עדיין</div> : comments.filter((c) => c && !c.parent_id).map((c) => {
                    const replies = comments.filter((r) => r && r.parent_id === c.id);
                    const isThreadExpanded = expandedThreads[c.id];
                    return (
                      <div key={c.id} className="flex flex-col gap-2">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 min-w-[40px] rounded-full bg-surface-card shrink-0 overflow-hidden cursor-pointer border border-surface-border flex items-center justify-center" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>
                            {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover object-center" loading="lazy" /> : <span className="text-brand-muted font-black text-sm">{(c.profiles?.full_name || 'א')[0]}</span>}
                          </div>
                          <div className="flex flex-col flex-1">
                            <div className="bg-surface-card p-4 rounded-[24px] rounded-tr-sm cursor-pointer shadow-sm border border-surface-border" onClick={() => openOverlay(() => setCommentActionModal(c))}>
                              <span className="text-brand font-black text-[13px] mb-1.5 inline-block" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>{c.profiles?.full_name || 'אנונימי'}</span>
                              <p className="text-brand text-[13px] whitespace-pre-wrap leading-relaxed">{renderCommentText(c.content)}</p>
                            </div>
                            <div className="flex items-center gap-4 mt-2 px-2">
                              <span className="text-[11px] text-brand-muted cursor-pointer font-bold hover:text-brand transition-colors" onClick={() => { setReplyingTo(c); setNewComment(`@${c.profiles?.full_name} `); }}>השב</span>
                              <button onClick={() => toggleCommentLike(c.id)} className={`ml-auto flex items-center gap-1 active:scale-90 transition-transform ${likedComments.has(c.id) ? 'text-red-500' : 'text-brand-muted'}`}>
                                <Heart size={14} fill={likedComments.has(c.id) ? 'currentColor' : 'none'} />
                              </button>
                            </div>
                            {replies.length > 0 && (
                              <button onClick={() => setExpandedThreads((prev) => ({ ...prev, [c.id]: !prev[c.id] }))} className="text-left text-[11px] font-black text-brand-muted hover:text-brand transition-colors mt-2 flex items-center gap-1">
                                <span className="flex-1 border-t border-surface-border mr-2" />
                                {isThreadExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {isThreadExpanded ? 'הסתר תגובות' : `צפה ב-${replies.length} תגובות`}
                              </button>
                            )}
                          </div>
                        </div>
                        {isThreadExpanded && replies.map((reply) => (
                          <div key={reply.id} className="flex gap-3 pr-10 mt-1 relative">
                            <div className="w-8 h-8 rounded-full bg-surface-card shrink-0 overflow-hidden cursor-pointer z-10 border border-surface-border flex items-center justify-center" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${reply.user_id}`), 50); }}>
                              {reply.profiles?.avatar_url ? <img src={reply.profiles.avatar_url} className="w-full h-full object-cover object-center" loading="lazy" /> : <span className="text-brand-muted font-black text-[10px]">{(reply.profiles?.full_name || 'א')[0]}</span>}
                            </div>
                            <div className="flex flex-col flex-1 z-10">
                              <div className="bg-surface-card p-3 rounded-[20px] rounded-tr-sm cursor-pointer border border-surface-border shadow-sm" onClick={() => openOverlay(() => setCommentActionModal(reply))}>
                                <span className="text-brand font-black text-[11px] mb-1 inline-block" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${reply.user_id}`), 50); }}>{reply.profiles?.full_name || 'אנונימי'}</span>
                                <p className="text-brand text-[12px] whitespace-pre-wrap leading-relaxed">{renderCommentText(reply.content)}</p>
                              </div>
                              <div className="flex items-center gap-4 mt-2 px-2">
                                <span className="text-[10px] text-brand-muted cursor-pointer font-bold hover:text-brand transition-colors" onClick={() => { setReplyingTo(c); setNewComment(`@${reply.profiles?.full_name} `); }}>השב</span>
                                <button onClick={() => toggleCommentLike(reply.id)} className={`ml-auto flex items-center gap-1 active:scale-90 transition-transform ${likedComments.has(reply.id) ? 'text-red-500' : 'text-brand-muted'}`}>
                                  <Heart size={12} fill={likedComments.has(reply.id) ? 'currentColor' : 'none'} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
                <div className="p-4 border-t border-surface-border flex flex-col gap-2 bg-surface">
                  {replyingTo && !editingCommentId && (
                    <div className="text-[11px] text-brand flex items-center justify-between px-3 py-1.5 bg-surface-card border border-surface-border rounded-lg w-fit mb-1 shadow-sm">
                      <span className="font-bold mr-1 flex items-center gap-1.5"><Reply size={12} className="rtl:-scale-x-100 text-brand-muted"/> משיב ל-@{replyingTo.profiles?.full_name}</span>
                      <X size={14} className="cursor-pointer text-brand-muted" onClick={() => { setReplyingTo(null); setNewComment(''); }} />
                    </div>
                  )}
                  {editingCommentId && (
                    <div className="text-[11px] text-accent-primary flex justify-between px-2 font-bold mb-1 uppercase tracking-widest">
                      <span>עורך תגובה...</span>
                      <span onClick={() => { setEditingCommentId(null); setNewComment(''); }} className="cursor-pointer text-brand-muted">ביטול</span>
                    </div>
                  )}
                  <div className="flex gap-2 items-center bg-surface-card rounded-full p-1 pl-2 border border-surface-border shadow-inner">
                    <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="הוסף תגובה..." className="flex-1 bg-transparent px-4 text-brand text-[14px] outline-none placeholder:text-brand-muted" />
                    <button onClick={submitComment} disabled={!newComment.trim()} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black active:scale-95 disabled:opacity-50 transition-all shadow-md">
                      <Send size={16} className="rtl:-scale-x-100 -ml-0.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* COMMENT ACTION MODAL */}
          {commentActionModal && (
            <div className="fixed inset-0 z-[99999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] p-6 flex flex-col gap-3 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border">
                <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>
                <button onClick={() => { closeOverlay(); setReplyingTo(commentActionModal.parent_id ? comments.find((c) => c?.id === commentActionModal.parent_id) : commentActionModal); setNewComment(`@${commentActionModal.profiles?.full_name} `); }} className="w-full p-4 bg-surface-card border border-surface-border rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-95 transition-all shadow-sm">
                  <span>השב לתגובה</span><Reply size={20} className="text-brand-muted" />
                </button>
                {commentActionModal.user_id === currentUserId && (
                  <>
                    <button onClick={() => { closeOverlay(); setEditingCommentId(commentActionModal.id); setNewComment(commentActionModal.content); }} className="w-full p-4 bg-surface-card border border-surface-border rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-95 transition-all shadow-sm mt-2">
                      <span>ערוך תגובה</span><Edit2 size={20} className="text-brand-muted" />
                    </button>
                    <button onClick={() => { if (window.confirm('למחוק תגובה?')) { closeOverlay(); deleteComment(commentActionModal.id); } }} className="w-full p-4 bg-surface-card border border-red-500/30 rounded-2xl text-red-500 font-black flex justify-between items-center text-[15px] active:scale-95 transition-all mt-2 shadow-sm">
                      <span>מחק תגובה</span><Trash2 size={20} />
                    </button>
                  </>
                )}
              </motion.div>
            </div>
          )}

          {/* USER CIRCLES MODAL */}
          {userCirclesModal && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] p-6 flex flex-col gap-3 pb-12 max-h-[70vh] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border">
                <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>
                <h2 className="text-brand font-black text-lg mb-4">מועדונים ({userCirclesModal.length})</h2>
                <div className="flex flex-col gap-3 overflow-y-auto pr-1" onPointerDown={stopPropagation} onTouchStart={stopPropagation}>
                  {userCirclesModal.map((c: any) => (
                    <div key={c.id} onClick={() => { closeOverlay(); navigate(`/circle/${c.slug || c.id}`); }} className="flex items-center gap-4 bg-surface-card p-4 rounded-2xl cursor-pointer border border-surface-border active:scale-[0.98] transition-transform shadow-sm">
                      <div className="w-12 h-12 rounded-full bg-surface overflow-hidden border border-surface-border shrink-0 flex items-center justify-center">
                        {c.cover_url ? <img src={c.cover_url} className="w-full h-full object-cover" loading="lazy" /> : <Users size={20} className="text-brand-muted" />}
                      </div>
                      <span className="text-brand font-black text-[15px]">{c.name}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}

          {/* OPTIONS MENU POST */}
          {optionsMenuPost && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] p-6 flex flex-col gap-3 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border text-center">
                <div className="w-full py-2 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>
                
                <button onClick={() => { closeOverlay(); setTimeout(() => handleShare(optionsMenuPost), 100); }} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>שתף פוסט</span><Share2 size={20} className="text-brand-muted" /></button>
                {optionsMenuPost.media_url && <button onClick={() => handleDownloadMedia(optionsMenuPost.media_url)} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>שמור למכשיר</span><Download size={20} className="text-brand-muted" /></button>}
                <button onClick={async () => { try { await supabase.from('saved_posts').insert({ user_id: currentUserId, post_id: optionsMenuPost.id }); toast.success('הפוסט נשמר במועדפים!'); } catch { toast.error('הפוסט כבר שמור אצלך'); } closeOverlay(); }} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>שמור במועדפים</span><Bookmark size={20} className="text-brand-muted" /></button>
                <button onClick={() => handleCopyLink(optionsMenuPost)} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>העתק קישור</span><LinkIcon size={20} className="text-brand-muted" /></button>

                {optionsMenuPost.user_id === currentUserId && (
                  <>
                    <button onClick={() => { closeOverlay(); setTimeout(() => { openOverlay(() => { setEditingPost(optionsMenuPost); setNewPost(optionsMenuPost.content || ''); setShowCreatePost(true); }); }, 100); }} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm mt-2"><span>ערוך פוסט</span><Edit2 size={20} className="text-brand-muted" /></button>
                    <button onClick={() => { if (window.confirm('למחוק פוסט?')) { deletePost(optionsMenuPost.id); } }} className="w-full p-4 bg-surface-card border border-red-500/30 rounded-2xl text-red-500 font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all mt-2"><span>מחק פוסט</span><Trash2 size={20} className="text-red-500" /></button>
                  </>
                )}
              </motion.div>
            </div>
          )}

          {/* CREATE/EDIT POST MODAL */}
          {showCreatePost && (
            <div className="fixed inset-0 z-[10000000] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] p-6 flex flex-col gap-4 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border">
                <div className="w-full py-2 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>
                
                <div className="flex justify-between items-center mb-2 px-2">
                  <h3 className="text-brand font-black text-xl tracking-widest uppercase">{editingPost ? 'עריכת פוסט' : 'פוסט חדש'}</h3>
                  <button onClick={closeOverlay} className="text-brand-muted hover:text-brand active:scale-95 transition-transform"><X size={24} /></button>
                </div>
                
                <textarea value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder="כתוב משהו..." className="h-32 bg-surface-card rounded-[24px] p-5 text-brand text-[15px] outline-none resize-none border border-surface-border placeholder:text-brand-muted shadow-inner leading-relaxed" onPointerDown={stopPropagation} onTouchStart={stopPropagation} />
                
                {!editingPost && (
                  <div onClick={() => fileInputRef.current?.click()} className="p-5 bg-surface-card rounded-[24px] border border-dashed border-surface-border text-center text-brand-muted font-bold cursor-pointer hover:bg-white/5 transition-colors shadow-inner flex items-center justify-center gap-2">
                    <Paperclip size={18} /> {selectedFile ? selectedFile.name : 'צרף מדיה (תמונה/וידאו)'}
                  </div>
                )}
                
                <Button onClick={handlePost} disabled={posting || (!newPost.trim() && !selectedFile && !editingPost)} className="h-16 bg-white text-black font-black text-[15px] uppercase tracking-widest rounded-2xl mt-2 shadow-lg active:scale-95 transition-all disabled:opacity-50">
                  {posting ? <Loader2 className="animate-spin text-black" /> : editingPost ? 'שמור עריכה' : 'פרסם'}
                </Button>
              </motion.div>
            </div>
          )}

          {/* DESC POST FULL */}
          {activeDescPost && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] flex flex-col overflow-hidden pb-10 max-h-[75vh] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border text-center">
                <div className="w-full py-5 flex justify-center cursor-grab active:cursor-grabbing border-b border-surface-border"><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>
                <div className="p-6 overflow-y-auto" onPointerDown={stopPropagation} onTouchStart={stopPropagation}>
                  <p className="text-brand text-[15px] leading-relaxed whitespace-pre-wrap">{activeDescPost.content}</p>
                </div>
              </motion.div>
            </div>
          )}

        </AnimatePresence>,
        document.body,
      )}
    </>
  );
};
