import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { FadeIn, Button } from '../components/ui';
import { 
  Loader2, Bell, Users, MessageSquare, Send, X, Paperclip, 
  RefreshCw, UserCircle, Trash2, Edit2, Share2, MoreVertical, 
  ChevronLeft, Reply, ChevronDown, ChevronUp, ArrowUp, Download, 
  Link as LinkIcon, Bookmark, Crown, Lock, Timer, Flame, Diamond, Handshake, Heart, Coins, PlusCircle, Search 
} from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { Share } from '@capacitor/share';

// Types for enhanced feed content
type FeedPost = any & { type: 'post' };
type FeedClubRecommendation = any & { type: 'club_recommendation' };
type FeedItem = FeedPost | FeedClubRecommendation;

type AnyComment = any;

const SEAL_TYPES = [
  { id: 'fire', icon: <Flame size={24} />, label: 'אש', color: 'text-orange-500', xp: 15 },
  { id: 'diamond', icon: <Diamond size={24} />, label: 'יהלום', color: 'text-blue-400', xp: 50 },
  { id: 'alliance', icon: <Handshake size={24} />, label: 'ברית', color: 'text-emerald-400', xp: 100 }
];

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pullStartY = useRef(0);
  const lastScrollY = useRef(0);

  const [mounted, setMounted] = useState(false);
  
  // Mixed feed state
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'drops' | 'circles'>('all');

  // Creation State
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  
  // Drops state
  const [isDropMode, setIsDropMode] = useState(false);
  const [dropTarget, setDropTarget] = useState<number | ''>(500);
  const [contributeModal, setContributeModal] = useState<any | null>(null);
  const [contributeAmount, setContributeAmount] = useState<number | ''>(50);
  const [contributing, setContributing] = useState(false);

  // Comments & Actions state
  const [activePost, setActivePost] = useState<any | null>(null);
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<AnyComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<AnyComment | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});
  const [commentActionModal, setCommentActionModal] = useState<AnyComment | null>(null);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());

  // Modals & Context Menus
  const [optionsMenuPost, setOptionsMenuPost] = useState<any | null>(null);
  const [activeDescPost, setActiveDescPost] = useState<any | null>(null);
  const [fullScreenMedia, setFullScreenMedia] = useState<any[] | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [sealSelectorPost, setSealSelectorPost] = useState<any | null>(null);
  
  // General State
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState('');
  const [userCirclesModal, setUserCirclesModal] = useState<any[] | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Track modal open states for physical back button
  const stateRef = useRef({
    comments: false, options: false, desc: false, create: false, 
    fullscreen: false, commentAction: false, userCircles: false, contribute: false, seals: false
  });

  const mediaPosts = useMemo(() => feedItems.filter((item) => item.type === 'post' && !!item.media_url), [feedItems]);

  const getRandomMediaBatch = (size = 6, excludeId?: string) => {
    const pool = mediaPosts.filter((p) => (excludeId ? p.id !== excludeId : true));
    if (pool.length === 0) return [];
    const batch: any[] = [];
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
      comments: !!activeCommentsPostId, options: !!optionsMenuPost, desc: !!activeDescPost,
      create: showCreatePost, fullscreen: !!fullScreenMedia, commentAction: !!commentActionModal,
      userCircles: !!userCirclesModal, contribute: !!contributeModal, seals: !!sealSelectorPost
    };
  }, [activeCommentsPostId, optionsMenuPost, activeDescPost, showCreatePost, fullScreenMedia, commentActionModal, userCirclesModal, contributeModal, sealSelectorPost]);

  useEffect(() => {
    const handlePopState = () => {
      const s = stateRef.current;
      if (s.commentAction) setCommentActionModal(null);
      else if (s.userCircles) setUserCirclesModal(null);
      else if (s.contribute) setContributeModal(null);
      else if (s.seals) setSealSelectorPost(null);
      else if (s.comments) { setActiveCommentsPostId(null); setActivePost(null); setReplyingTo(null); setEditingCommentId(null); setNewComment(''); }
      else if (s.options) setOptionsMenuPost(null);
      else if (s.desc) setActiveDescPost(null);
      else if (s.create) { setShowCreatePost(false); setEditingPost(null); setSelectedFile(null); setNewPost(''); setIsDropMode(false); }
      else if (s.fullscreen) setFullScreenMedia(null);
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
    } catch {}
  };

  const fetchData = async (isSilentRefresh = false) => {
    if (!isSilentRefresh) setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id || null;
      if (uid) setCurrentUserId(uid);

      // 1. Fetch posts using the Smart Feed V2 RPC (connects to algorithm)
      // 2. Fetch Club Recommendations (Circles the user is NOT in)
      const [rawPosts, rawClubs, rawMembers] = await Promise.all([
        supabase.rpc('get_smart_feed_v2', { p_user_id: uid, p_limit: 30, p_offset: 0 }).then((r) => r.data || []),
        supabase.from('circles').select('*, profiles(full_name, avatar_url)').limit(5).then((r) => r.data || []),
        supabase.from('circle_members').select('circle_id').eq('user_id', uid).then((r) => r.data || [])
      ]);

      // Process Posts
      const myCircleIds = new Set(rawMembers.map((m: any) => m.circle_id));
      const processedPosts = rawPosts.map((p: any) => ({
        ...p,
        type: 'post' as const,
        profiles: {
          id: p.user_id,
          full_name: p.author_name,
          avatar_url: p.author_avatar,
          role_label: p.author_role,
          username: p.author_name
        }
      }));

      // Process Club Recommendations (Clubs user is not a member of)
      const processedClubs = rawClubs
        .filter((c: any) => !myCircleIds.has(c.id))
        .map((c: any) => ({
          ...c,
          type: 'club_recommendation' as const
        }));

      // --- SMART INJECTION LOGIC ---
      // Merge posts and inject a club recommendation every 5 posts
      let mixedFeed: FeedItem[] = [];
      let clubIdx = 0;

      processedPosts.forEach((post: FeedItem, idx: number) => {
        mixedFeed.push(post);
        if ((idx + 1) % 5 === 0 && processedClubs[clubIdx]) {
          mixedFeed.push(processedClubs[clubIdx]);
          clubIdx += 1;
        }
      });
      // -------------------------------

      setFeedItems(mixedFeed);
    } catch {
      toast.error('שגיאה בטעינת הפיד');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleQuickRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setPullY(0);
    triggerFeedback('pop');
    scrollToTop();
    await Promise.all([fetchData(true), checkUnreadNotifications()]);
    triggerFeedback('success');
  };

  useEffect(() => {
    setMounted(true);
    fetchData(false);
    checkUnreadNotifications();
  }, []);

  useEffect(() => {
    const presenceChannel = supabase.channel('global_online');
    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      let activeCount = 0;
      for (const key in state) activeCount += state[key].length;
      setOnlineUsers(activeCount > 0 ? activeCount : 1);
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({ online_at: new Date().toISOString(), user_id: currentUserId || 'guest' });
      }
    });
    return () => { supabase.removeChannel(presenceChannel); };
  }, [currentUserId]);

  useEffect(() => {
    if (!fullScreenMedia) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const vid = entry.target as HTMLVideoElement;
        if (vid.tagName !== 'VIDEO') return;
        if (entry.isIntersecting) { vid.muted = false; vid.play().catch(() => {}); }
        else { vid.pause(); vid.muted = true; vid.currentTime = 0; }
      });
    }, { threshold: 0.7 });
    document.querySelectorAll('.full-media-item').forEach((v) => observer.observe(v));
    return () => observer.disconnect();
  }, [fullScreenMedia, currentMediaIndex]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAnyModalOpen() || refreshing) return;
    if (window.scrollY <= 5) pullStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isAnyModalOpen() || refreshing) return;
    if (pullStartY.current > 0 && window.scrollY <= 0) {
      const y = e.touches[0].clientY - pullStartY.current;
      if (y > 0) {
        setPullY(Math.min(Math.pow(y, 0.85), 100));
      }
    }
  };

  const handleTouchEnd = async () => {
    if (isAnyModalOpen() || refreshing) return;
    if (pullY > 60) {
      handleQuickRefresh();
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
    if (isDropMode && (!dropTarget || dropTarget < 50)) return toast.error('יעד מינימלי לדרופ: 50 CRD');
    
    setPosting(true);
    triggerFeedback('pop');
    try {
      if (editingPost) {
        await supabase.from('posts').update({ content: newPost.trim() }).eq('id', editingPost.id);
        setFeedItems((curr) => curr.map((item) => (item.type === 'post' && item.id === editingPost.id) ? { ...item, content: newPost.trim() } : item));
        toast.success('עודכן בהצלחה');
        closeOverlay();
        return;
      }

      let media_url: string | null = null;
      let media_type = 'text';

      if (selectedFile) {
        const safeName = selectedFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}_${safeName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('feed_images').upload(fileName, selectedFile);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage.from('feed_images').getPublicUrl(uploadData.path);
        if (!publicUrl) throw new Error("Failed to get public URL");
        
        media_url = publicUrl;
        media_type = selectedFile.type.startsWith('video/') ? 'video' : 'image';
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const insertRes = await supabase.from('posts').insert({
        user_id: currentUserId,
        content: newPost.trim(),
        media_url,
        media_type,
        circle_id: null,
        is_reveal_drop: isDropMode,
        required_crd: isDropMode ? dropTarget : 0,
        drop_expires_at: isDropMode ? expiresAt.toISOString() : null,
        reveal_status: isDropMode ? 'locked' : 'revealed'
      });

      if (insertRes.error) throw insertRes.error;

      setNewPost('');
      setSelectedFile(null);
      setEditingPost(null);
      setIsDropMode(false);
      triggerFeedback('success');
      await fetchData(true);
    } catch (e: any) {
      toast.error(e.message || 'שגיאה בשמירה');
    } finally {
      setPosting(false);
    }
  };

  const handleJoinCircle = async (circleId: string) => {
    triggerFeedback('pop');
    try {
      const { error } = await supabase.from('circle_members').insert({ circle_id: circleId, user_id: currentUserId, role: 'member' });
      if (error) throw error;
      toast.success('הצטרפת למועדון! 🎉');
      setFeedItems((prev) => prev.filter((item) => !(item.type === 'club_recommendation' && item.id === circleId)));
      triggerFeedback('success');
    } catch (err) {
      toast.error('שגיאה בהצטרפות למועדון');
    }
  };

  const handleSeal = async (postId: string, sealType: string) => {
    triggerFeedback('pop');
    closeOverlay();
    
    const update = (list: FeedItem[]) => list.map((item) => (item.type === 'post' && item.id === postId) ? { ...item, has_sealed: true, seals_count: item.seals_count + 1 } : item);
    setFeedItems((prev) => update(prev));
    if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));
    
    try {
      const { error } = await supabase.from('post_seals').insert({ post_id: postId, user_id: currentUserId, seal_type: sealType });
      if (error) {
        if (error.code === '23505') toast.error('כבר נתת חותם לפוסט זה');
        else throw error;
        const revert = (list: FeedItem[]) => list.map((item) => (item.type === 'post' && item.id === postId) ? { ...item, has_sealed: false, seals_count: Math.max(0, item.seals_count - 1) } : item);
        setFeedItems((prev) => revert(prev));
      } else {
        triggerFeedback('success');
      }
    } catch (err) {
      toast.error('שגיאה בהענקת חותם');
    }
  };

  const handleContribute = async () => {
    if (!contributeModal || !contributeAmount || contributeAmount <= 0) return;
    setContributing(true);
    triggerFeedback('pop');
    try {
      const { error } = await supabase.rpc('contribute_to_drop', {
        p_post_id: contributeModal.id,
        p_amount: contributeAmount
      });
      
      if (error) throw error;
      toast.success('תרומתך התקבלה! 🎉');
      closeOverlay();
      await fetchData(true);
      triggerFeedback('coin');
    } catch (err: any) {
      triggerFeedback('error');
      toast.error(err.message || 'שגיאה בתרומה. בדוק יתרה בארנק.');
    } finally {
      setContributing(false);
    }
  };

  const handleShare = async (post: any) => {
    triggerFeedback('pop');
    const publicUrl = `https://inner-app.com/post/${post.id}`;
    const textToShare = `${post.content ? `${post.content}\n\n` : ''}צפה בפוסט הזה ב-INNER!`;
    try {
      const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor && (window as any).Capacitor.isNativePlatform?.();
      if (isNative) {
        await Share.share({ title: 'INNER', text: textToShare, url: publicUrl, dialogTitle: 'שתף עם חברים' });
      } else if (navigator.share && window.isSecureContext) {
        await navigator.share({ title: 'INNER', text: textToShare, url: publicUrl });
      } else {
        await navigator.clipboard.writeText(`${textToShare}\n${publicUrl}`);
        toast.success('הקישור הועתק ללוח');
      }
    } catch {}
  };

  const handleCopyLink = async (post: any) => {
    const publicUrl = `https://inner-app.com/post/${post.id}`;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('הקישור הועתק ללוח', { icon: '🔗' });    } catch { toast.error('שגיאה בהעתקה'); }
    closeOverlay();
  };

  const handleDownloadMedia = async (mediaUrl: string) => {
    try {
      toast.loading('מוריד קובץ...', { id: 'dl' });
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `INNER_Media_${Date.now()}`;
      document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a);
      toast.success('הקובץ נשמר בהצלחה', { id: 'dl' });      } catch { toast.error('לא ניתן להוריד את הקובץ', { id: 'dl' }); }
    closeOverlay();
  };

  const submitComment = async () => {
    if (!newComment.trim() || !activePost) return;
    try {
      if (editingCommentId) {
        const updateRes = await supabase.from('comments').update({ content: newComment.trim() }).eq('id', editingCommentId);
        if (updateRes.error) throw updateRes.error;
        setComments((prev) => prev.map((c) => c.id === editingCommentId ? { ...c, content: newComment.trim() } : c));
        setEditingCommentId(null);
      } else {
        const data = await apiFetch(`/api/posts/${activePost.id}/comments`, {
          method: 'POST',
          headers: { 'x-user-id': currentUserId },
          body: JSON.stringify({ content: newComment.trim(), parent_id: replyingTo?.id || null }),
        });
        if (data) {
          setComments((prev) => [...prev, data]);
          const update = (list: FeedItem[]) => list.map((item) => (item.type === 'post' && item.id === activePost.id) ? { ...item, comments_count: (item.comments_count || 0) + 1 } : item);
          setFeedItems((prev) => update(prev));
          if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));
          if (replyingTo) setExpandedThreads((prev) => ({ ...prev, [replyingTo.id]: true }));
          triggerFeedback('coin');
        }
      }
      setNewComment(''); setReplyingTo(null);
    } catch { toast.error('שגיאה בשרת'); }
  };

  const toggleCommentLike = (id: string) => {
    setLikedComments(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    triggerFeedback('pop');
  };

  const deletePost = async (postId: string) => {
    triggerFeedback('error'); closeOverlay();
    setFeedItems((curr) => curr.filter((item) => !(item.type === 'post' && item.id === postId)));
    await supabase.from('posts').delete().eq('id', postId);
  };

  const deleteComment = async (commentId: string) => {
    triggerFeedback('error');
    setComments((curr) => curr.filter((c) => c && c.id !== commentId && c.parent_id !== commentId));
    const update = (list: FeedItem[]) => list.map((item) => (item.type === 'post' && item.id === activePost?.id) ? { ...item, comments_count: Math.max(0, (item.comments_count || 0) - 1) } : item);
    setFeedItems((prev) => update(prev));
    if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));
    try { await supabase.from('comments').delete().eq('id', commentId); } catch {}
  };

  const handleOpenFullscreen = (post: any) => {
    if (post.is_reveal_drop && post.reveal_status === 'locked') {
      openOverlay(() => setContributeModal(post));
      return;
    }
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
    return parts.map((part, i) => part.startsWith('@') ? <span key={i} className="text-accent-primary font-bold">{part}</span> : <span key={i}>{part}</span>);
  };

  const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

  if (loading && feedItems.length === 0) {
    return <div className="min-h-screen bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" size={32} /></div>;
  }

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
            className="fixed bottom-24 right-5 z-[80] w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-[0_5px_20px_rgba(255,255,255,0.2)] active:scale-90 transition-transform"
          >
            <ArrowUp size={24} />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {refreshing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="fixed top-24 left-0 right-0 flex justify-center z-[999] pointer-events-none"
          >
            <div className="bg-surface-card/95 backdrop-blur-2xl border border-surface-border px-5 py-3 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center gap-3">
              <Loader2 size={16} className="animate-spin text-accent-primary" />
              <span className="text-[12px] font-black tracking-widest uppercase text-brand">מרענן נתונים...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <FadeIn className="pt-[env(safe-area-inset-top)] pb-32 bg-surface min-h-screen relative overflow-x-hidden touch-pan-y" dir="rtl" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        
        {!refreshing && pullY > 0 && (
          <div className="fixed top-0 left-0 right-0 flex justify-center z-[100] pointer-events-none" style={{ transform: `translateY(${pullY - 50}px)`, opacity: pullY / 60 }}>
            <div className="bg-surface-card p-3 rounded-full shadow-lg border border-surface-border mt-10">
              <RefreshCw size={20} className="text-brand-muted" style={{ transform: `rotate(${pullY * 3}deg)` }} />
            </div>
          </div>
        )}

        <div className="relative z-10 px-4">
          
          {/* HEADER (Centered & Clean) */}
          <div className="sticky top-0 z-[60] bg-surface/80 backdrop-blur-xl border-b border-surface-border pt-4 pb-3 flex justify-between items-center -mx-4 px-6 mb-6 shadow-sm">
            <div className="w-10" /> 
            <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2 text-center">
              <h1 className="text-2xl font-black text-white tracking-widest uppercase drop-shadow-[0_2px_10px_rgba(255,255,255,0.1)]">INNER</h1>
              <div className="flex items-center gap-1.5 mt-0.5 bg-surface-card border border-surface-border px-3 py-0.5 rounded-full shadow-inner">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]" />
                <span className="text-[10px] font-black text-brand-muted tracking-widest">{onlineUsers.toLocaleString()} אונליין</span>
              </div>
            </div>
            <button onClick={() => navigate('/notifications')} className="w-10 h-10 flex justify-center items-center bg-surface-card border border-surface-border rounded-full active:scale-90 relative shadow-sm transition-transform">
              <Bell size={18} className="text-brand" />
              {unreadCount > 0 && <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border border-surface animate-pulse shadow-[0_0_5px_#f43f5e]" />}
            </button>
          </div>

          {/* CREATE POST (Modernized & Clean) */}
          <div className="mb-8 p-1.5 bg-surface-card border border-surface-border rounded-[32px] shadow-sm relative z-10">
            <div className="p-5 rounded-[28px] bg-surface flex flex-col gap-4 shadow-inner border border-surface-border/50">
              
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="מה חדש, @אדם?"
                className="w-full bg-transparent border-none text-brand text-[17px] font-medium outline-none resize-none placeholder:text-brand-muted/60 min-h-[50px] scrollbar-hide"
                rows={Math.min(Math.max(newPost.split('\n').length, 1), 5)}
              />

              {selectedFile && (
                <div className="relative w-full h-48 rounded-[24px] overflow-hidden bg-surface-card border border-surface-border shadow-inner mt-2">
                  {selectedFile.type.startsWith('video/') ? (
                    <video src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover" preload="metadata" playsInline />
                  ) : (
                    <img src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover" loading="lazy" />
                  )}
                  <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="absolute top-3 right-3 w-8 h-8 bg-black/60 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white z-10 active:scale-90">
                    <X size={14} />
                  </button>
                </div>
              )}

              <AnimatePresence>
                {isDropMode && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 bg-surface-card border border-accent-primary/30 p-3.5 rounded-2xl mt-1">
                    <Lock size={20} className="text-accent-primary shrink-0"/>
                    <div className="flex flex-col flex-1">
                      <span className="text-[11px] font-black text-accent-primary tracking-widest uppercase mb-1">יעד פתיחה (CRD)</span>
                      <input type="number" value={dropTarget} onChange={(e) => setDropTarget(Number(e.target.value))} className="bg-transparent border-none text-brand font-black text-xl outline-none w-full" placeholder="500" dir="ltr" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex justify-between items-center border-t border-surface-border pt-4 mt-2">
                <div className="flex gap-1.5 items-center">
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center w-11 h-11 bg-surface-card border border-surface-border rounded-full text-brand-muted hover:text-brand active:scale-95 transition-all">
                    <Paperclip size={20} />
                  </button>
                  <button onClick={() => setIsDropMode(!isDropMode)} className={`flex items-center gap-2 h-11 px-5 rounded-full border transition-all active:scale-95 ${isDropMode ? 'text-accent-primary bg-accent-primary/10 border-accent-primary/30 shadow-[0_0_15px_rgba(34,211,238,0.1)]' : 'bg-surface-card border-surface-border text-brand-muted hover:text-brand'}`}>
                    <Lock size={18} /> <span className="text-[13px] font-black">Drop</span>
                  </button>
                </div>
                <button onClick={handlePost} disabled={posting || (!newPost.trim() && !selectedFile)} className="w-12 h-12 shrink-0 rounded-full bg-white text-black flex items-center justify-center disabled:opacity-50 active:scale-95 transition-all shadow-md group">
                  {posting ? <Loader2 size={18} className="animate-spin text-black" /> : <Send size={20} className="rtl:-scale-x-100 -ml-0.5 group-hover:translate-x-[-2px] transition-transform" />}
                </button>
              </div>
            </div>
          </div>

          {/* CATEGORY TABS (Styled exactly like the example horizontal scroll) */}
          <div className="px-1 mb-7 relative z-10 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-2 min-w-max pb-1" dir="rtl">
              <button onClick={() => { triggerFeedback('pop'); setActiveTab('all'); }} className={`px-5 py-2.5 rounded-full text-[13px] font-medium transition-all ${activeTab === 'all' ? 'bg-surface-card border border-indigo-400/30 text-indigo-300 shadow-[0_0_15px_rgba(165,180,252,0.1)]' : 'bg-surface-card border border-surface-border text-brand-muted hover:text-brand'}`}>הכל</button>
              <button onClick={() => { triggerFeedback('pop'); setActiveTab('drops'); }} className={`px-5 py-2.5 rounded-full text-[13px] font-medium transition-all ${activeTab === 'drops' ? 'bg-surface-card border border-indigo-400/30 text-indigo-300 shadow-[0_0_15px_rgba(165,180,252,0.1)]' : 'bg-surface-card border border-surface-border text-brand-muted hover:text-brand group'}`}>
                <Lock size={14} className="inline-block mr-1.5 -mt-0.5 text-indigo-400/80 group-hover:text-indigo-300"/> 🔥 דרופים לוהטים
              </button>
              <button onClick={() => { triggerFeedback('pop'); setActiveTab('circles'); }} className={`px-5 py-2.5 rounded-full text-[13px] font-medium transition-all ${activeTab === 'circles' ? 'bg-surface-card border border-indigo-400/30 text-indigo-300 shadow-[0_0_15px_rgba(165,180,252,0.1)]' : 'bg-surface-card border border-surface-border text-brand-muted hover:text-brand'}`}>
                <Users size={14} className="inline-block mr-1.5 -mt-0.5 text-indigo-400/80 group-hover:text-indigo-300"/> מועדונים
              </button>
            </div>
          </div>

          {/* 📰 SMART FEED (Mixed Content) */}
          <div className="flex flex-col gap-8 relative z-10 pb-10">
            {feedItems.map((item, index) => {
              
              // --- RENDER POST ITEM ---
              if (item.type === 'post') {
                const post = item;
                const hasMedia = !!post.media_url;
                const isVideo = post.media_url?.match(/\.(mp4|webm|mov)$/i);
                const isCore = post.profiles?.role_label === 'CORE';
                const isLockedDrop = post.is_reveal_drop && post.reveal_status === 'locked';

                return (
                  <div key={`post-${post.id}-${index}`} className="flex flex-col rounded-[32px] bg-surface-card border border-surface-border overflow-hidden shadow-sm">
                    {hasMedia && (
                      <div className="w-full relative cursor-pointer bg-surface" onClick={() => { if (!isLockedDrop) handleOpenFullscreen(post); }}>
                        {isVideo ? (
                          <video src={post.media_url} autoPlay loop muted playsInline preload="metadata" className={`w-full max-h-[550px] object-cover ${isLockedDrop ? 'blur-xl grayscale' : ''}`} />
                        ) : (
                          <img src={post.media_url} onError={(e) => { e.currentTarget.src = 'https://placehold.co/500x500/111/333?text=Media+Unavailable'; }} className={`w-full max-h-[550px] object-cover ${isLockedDrop ? 'blur-xl grayscale' : ''}`} loading="lazy" decoding="async" />
                        )}

                        {isLockedDrop && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-20 gap-3 p-6" onClick={(e) => { e.stopPropagation(); openOverlay(()=>setContributeModal(post)); }}>
                            <div className="w-16 h-16 rounded-full bg-surface/80 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-lg mb-2">
                              <Lock size={28} className="text-white" />
                            </div>
                            <span className="text-white font-black text-lg tracking-widest">דרופ נעול</span>
                            <div className="w-full max-w-[200px] flex flex-col gap-1 mt-2">
                              <div className="flex justify-between text-[11px] font-black text-white/80 tracking-widest uppercase">
                                <span>{post.current_crd} נאסף</span>
                                <span>{post.required_crd} יעד</span>
                              </div>
                              <div className="w-full h-2 bg-surface/50 rounded-full overflow-hidden border border-white/10">
                                <div className="h-full bg-accent-primary" style={{ width: `${Math.min(100, (post.current_crd / post.required_crd) * 100)}%` }} />
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-24 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex flex-col justify-end pointer-events-none">
                          {post.content && (
                            <p onClick={(e) => { e.stopPropagation(); if(isLockedDrop) openOverlay(()=>setContributeModal(post)); else openOverlay(() => setActiveDescPost(post)); }} className={`text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-[15px] font-medium text-right line-clamp-2 pointer-events-auto cursor-pointer mb- group-hover:mb-4 transition-all ${isLockedDrop ? 'select-none blur-sm opacity-50' : ''}`}>
                              {post.content}
                            </p>
                          )}
                          <div className="flex items-center justify-between gap-2 mt-1 pointer-events-auto">
                            <div className="flex items-center gap-2.5 cursor-pointer group" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${post.user_id}`); }}>
                              <div className="w-10 h-10 rounded-full border border-white/20 overflow-hidden shrink-0 shadow-sm bg-surface flex items-center justify-center shadow-inner">
                                {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" loading="lazy" /> : <span className="text-white font-black text-lg flex items-center justify-center leading-none">{(post.profiles?.full_name || 'א')[0]}</span>}
                              </div>
                              <div className="flex flex-col text-right">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-white font-black text-[14px] drop-shadow-md">{post.profiles?.full_name || 'אנונימי'}</span>
                                  {isCore && <Crown size={12} className="text-accent-primary drop-shadow-md" />}
                                </div>
                                <span className="text-white/80 text-[10px] font-bold drop-shadow-md">{new Date(post.created_at).toLocaleDateString('he-IL')}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3.5 flex-row-reverse mr-auto">
                              {!isLockedDrop && (
                                <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setOptionsMenuPost(post)); }} className="active:scale-90 text-white drop-shadow-md hover:text-white/80 transition-colors">
                                  <MoreVertical size={20} />
                                </button>
                              )}
                              {!isLockedDrop && (
                                <button onClick={(e) => { e.stopPropagation(); openOverlay(() => { setActivePost(post); setActiveCommentsPostId(post.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at', { ascending: true }).then((r) => { setComments(r.data || []); setLoadingComments(false); }); }); }} className="flex items-center gap-1.5 active:scale-90 text-white drop-shadow-md hover:text-white/80 transition-colors">
                                  <MessageSquare size={20} />
                                  <span className="text-[13px] font-black">{post.comments_count}</span>
                                </button>
                              )}
                              {!isLockedDrop && (
                                <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setSealSelectorPost(post)); }} className={`flex items-center gap-1.5 active:scale-90 transition-transform drop-shadow-md ${post.has_sealed ? 'text-orange-500' : 'text-white hover:text-orange-400'}`}>
                                  <Flame size={22} fill={post.has_sealed ? 'currentColor' : 'none'} />
                                  <span className="text-[13px] font-black">{post.seals_count || 0}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {!hasMedia && (
                      <div className="p-6 flex flex-col gap-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate(`/profile/${post.user_id}`)}>
                            <div className="w-10 h-10 rounded-full bg-surface border border-surface-border overflow-hidden shrink-0 flex items-center justify-center shadow-inner">
                              {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" loading="lazy" /> : <span className="text-brand-muted font-black text-sm flex items-center justify-center leading-none">{(post.profiles?.full_name || 'א')[0]}</span>}
                            </div>
                            <div className="flex flex-col text-right">
                              <div className="flex items-center gap-1.5">
                                <span className="text-brand font-black text-[14px]">{post.profiles?.full_name || 'אנונימי'}</span>
                                {isCore && <Crown size={12} className="text-accent-primary" />}
                              </div>
                              <span className="text-brand-muted text-[10px] font-bold">{new Date(post.created_at).toLocaleDateString('he-IL')}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3.5 flex-row-reverse mr-auto">
                            {!isLockedDrop && <button onClick={() => openOverlay(() => setOptionsMenuPost(post))} className="text-brand-muted active:scale-90"><MoreVertical size={20} className="hover:text-brand transition-colors" /></button>}
                            {!isLockedDrop && <button onClick={() => openOverlay(() => { setActivePost(post); setActiveCommentsPostId(post.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at', { ascending: true }).then((r) => { setComments(r.data || []); setLoadingComments(false); }); })} className="flex items-center gap-1.5 text-brand-muted active:scale-90 hover:text-brand transition-colors">
                              <MessageSquare size={20} />
                              <span className="text-[13px] font-black">{post.comments_count}</span>
                            </button>}
                            {!isLockedDrop && <button onClick={() => openOverlay(() => setSealSelectorPost(post))} className={`flex items-center gap-1.5 active:scale-90 transition-transform ${post.has_sealed ? 'text-orange-500' : 'text-brand-muted hover:text-orange-400'}`}>
                              <Flame size={20} fill={post.has_sealed ? 'currentColor' : 'none'} />
                              <span className="text-[13px] font-black">{post.seals_count || 0}</span>
                            </button>}
                          </div>
                        </div>

                        <div onClick={() => { if(isLockedDrop) openOverlay(()=>setContributeModal(post)); else openOverlay(() => setActiveDescPost(post)); }} className={`bg-surface border border-surface-border rounded-[24px] px-6 py-8 cursor-pointer ${(post.content || '').length > 220 ? 'min-h-[200px]' : 'min-h-[120px]'} flex items-center justify-center shadow-inner relative overflow-hidden`}>
                          {isLockedDrop && (
                            <div className="absolute inset-0 bg-surface/80 backdrop-blur-md flex flex-col items-center justify-center z-10 gap-2">
                              <Lock size={24} className="text-brand-muted" />
                              <span className="text-[12px] font-black tracking-widest uppercase">דרופ נעול</span>
                              <div className="w-[150px] bg-surface-card border border-surface-border rounded-full h-1.5 mt-1 overflow-hidden shadow-inner">
                                <div className="h-full bg-accent-primary" style={{ width: `${Math.min(100, (post.current_crd / post.required_crd) * 100)}%` }} />
                              </div>
                            </div>
                          )}
                          <p className={`text-brand text-[16px] font-medium leading-relaxed text-center whitespace-pre-wrap break-words ${isLockedDrop ? 'blur-sm opacity-50' : ''}`}>{post.content}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              // --- SMART RENDER: CLUB RECOMMENDATION (Marketing Card) ---
              if (item.type === 'club_recommendation') {
                const club = item;
                const membersCount = club.members_count || 0;

                return (
                  <div key={`club-rec-${club.id}-${index}`} className="relative p-0.5 bg-gradient-to-br from-indigo-500/30 via-surface-border/50 to-purple-500/20 rounded-[32px] shadow-lg overflow-hidden group">
                    <div className="absolute inset-0 bg-surface-card/90 backdrop-blur-xl rounded-[30px]" />
                    <div className="relative z-10 p-6 flex flex-col gap-5">
                      
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.25em] mb-1">מועדון מומלץ עבורך</span>
                          <h3 className="text-brand font-black text-xl tracking-tight leading-tight line-clamp-1">{club.name}</h3>
                        </div>
                        <div className="w-16 h-16 rounded-3xl overflow-hidden bg-surface border border-surface-border flex items-center justify-center shrink-0 shadow-lg">
                          {club.cover_url ? <img src={club.cover_url} className="w-full h-full object-cover" loading="lazy" /> : <Users className="w-8 h-8 text-brand-muted" />}
                        </div>
                      </div>

                      {club.description && (
                        <p className="text-brand-muted text-[13px] font-medium leading-relaxed line-clamp-2 bg-black/20 p-3 rounded-xl border border-white/5 shadow-inner">{club.description}</p>
                      )}

                      <div className="flex items-center justify-between gap-4 mt-1">
                        <div className="flex -space-x-3 space-x-reverse items-center">
                          {[...Array(Math.min(membersCount, 3))].map((_, i) => (
                            <div key={i} className="w-8 h-8 rounded-full bg-surface border-2 border-surface-card overflow-hidden shadow-md flex items-center justify-center">
                              {/* Future: Real member avatars */}
                              <UserCircle size={20} className="text-brand-muted" />
                            </div>
                          ))}
                          {membersCount > 3 && (
                            <span className="text-brand-muted text-[11px] font-bold mr-5">+{membersCount - 3} חברים</span>
                          )}
                          {membersCount === 0 && (
                            <span className="text-brand-muted text-[11px] font-bold">היה הראשון להצטרף</span>
                          )}
                        </div>
                        <button onClick={() => handleJoinCircle(club.id)} className="flex items-center gap-2 h-11 px-5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-full font-black text-[13px] tracking-widest uppercase active:scale-95 transition-all shadow-[0_5px_15px_rgba(79,70,229,0.3)]">
                          <PlusCircle size={18} /> הצטרף
                        </button>
                      </div>
                    </div>
                    {/* Shimmer Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
                  </div>
                );
              }

              return null; // Fallback
            })}
          </div>
        </div>
      </FadeIn>

      {/* OVERLAYS */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          
          {/* SEAL SELECTOR MODAL */}
          {sealSelectorPost && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end p-4" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div initial={{ y: '100%', scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: '100%', scale: 0.95 }} transition={{ type: 'spring', damping: 25, stiffness: 400 }} className="relative z-10 bg-surface border border-surface-border rounded-[40px] p-8 shadow-2xl flex flex-col items-center gap-6">
                <div className="w-12 h-1.5 bg-white/10 rounded-full mb-2" />
                <div className="text-center">
                  <h3 className="text-brand font-black text-xl tracking-tighter uppercase">הענק חותם יוקרה</h3>
                  <p className="text-brand-muted text-[13px] mt-2 font-medium">החותם יישאר לשבוע ויעניק ליוצר XP</p>
                </div>
                <div className="grid grid-cols-3 gap-4 w-full">
                  {SEAL_TYPES.map((type) => (
                    <button key={type.id} onClick={() => handleSeal(sealSelectorPost.id, type.id)} className="flex flex-col items-center gap-3 p-5 rounded-[28px] bg-surface-card border border-surface-border hover:bg-white/5 transition-all active:scale-95 shadow-sm">
                      <div className={`${type.color} drop-shadow-lg`}>{type.icon}</div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-brand font-black text-[12px] uppercase tracking-widest">{type.label}</span>
                        <span className="text-accent-primary bg-accent-primary/10 border border-accent-primary/20 px-2 py-0.5 rounded-md text-[10px] font-black tracking-widest">+{type.xp} XP</span>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          )}

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

                      {/* Header in Fullscreen */}
                      <div className="absolute top-0 left-0 right-0 p-6 pt-[calc(env(safe-area-inset-top)+24px)] flex justify-between items-center z-50 pointer-events-none" dir="rtl">
                        <button onClick={closeOverlay} className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-90 pointer-events-auto border border-white/10 shadow-lg">
                          <X size={20} />
                        </button>
                      </div>

                      {/* Action Buttons (Left) */}
                      <div className="absolute bottom-32 left-4 flex flex-col gap-6 items-center z-50 pointer-events-auto">
                        <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setSealSelectorPost(vid)); }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
                          <Flame size={32} className={vid.has_sealed ? 'text-orange-500' : 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]'} fill={vid.has_sealed ? 'currentColor' : 'none'} strokeWidth={1.5} />
                          <span className="text-white text-[13px] font-black drop-shadow-md">{vid.seals_count || 0}</span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); openOverlay(() => { setActivePost(vid); setActiveCommentsPostId(vid.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', vid.id).order('created_at', { ascending: true }).then((r) => { setComments(r.data || []); setLoadingComments(false); }); }); }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                          <MessageSquare size={32} strokeWidth={1.5} />
                          <span className="text-white text-[13px] font-black drop-shadow-md">{vid.comments_count}</span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setOptionsMenuPost(vid)); }} className="active:scale-90 transition-transform drop-shadow-md pointer-events-auto text-white hover:text-white/80 transition-colors">
                          <MoreVertical size={28} className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                        </button>
                      </div>

                      {/* Bottom Info Area */}
                      <div className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-32 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col pointer-events-none">
                        {vid.content && (
                          <p className="text-white drop-shadow-md text-[15px] font-medium text-right max-w-[85%] line-clamp-3 pointer-events-auto cursor-pointer mb-5" onClick={(e) => { e.stopPropagation(); openOverlay(() => setActiveDescPost(vid)); }}>
                            {vid.content}
                          </p>
                        )}
                        <div className="flex items-center justify-start pointer-events-auto gap-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${vid.user_id}`), 50); }}>
                          <div className="w-11 h-11 rounded-full border border-white/20 overflow-hidden shrink-0 shadow-sm bg-surface flex items-center justify-center shadow-inner">
                            {vid.profiles?.avatar_url ? <img src={vid.profiles.avatar_url} className="w-full h-full object-cover" loading="lazy" /> : <span className="text-white font-black text-lg flex items-center justify-center leading-none">{(vid.profiles?.full_name || 'א')[0]}</span>}
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-white font-black text-[15px] drop-shadow-md">{vid.profiles?.full_name || 'אנונימי'}</span>
                            <span className="text-white/80 text-[10px] font-bold drop-shadow-md">{new Date(vid.created_at).toLocaleDateString('he-IL')}</span>
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
                <div className="w-full py-5 flex justify-center cursor-grab active:cursor-grabbing border-b border-surface-border"><div className="w-16 h-1.5 bg-white/10 rounded-full pointer-events-none" /></div>
                
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 scrollbar-hide">
                  {loadingComments ? <Loader2 className="animate-spin mx-auto text-brand-muted mt-10" /> : comments.filter((c) => c && !c.parent_id).length === 0 ? <div className="text-center text-brand-muted text-[13px] font-bold mt-10 tracking-widest uppercase">אין תגובות עדיין</div> : comments.filter((c) => c && !c.parent_id).map((c) => {
                    const replies = comments.filter((r) => r && r.parent_id === c.id);
                    const isThreadExpanded = expandedThreads[c.id];
                    return (
                      <div key={c.id} className="flex flex-col gap-2">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 min-w-[40px] rounded-full bg-surface-card shrink-0 overflow-hidden cursor-pointer border border-surface-border flex items-center justify-center shadow-inner" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>
                            {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover object-center" loading="lazy" /> : <span className="text-brand-muted font-black text-sm flex items-center justify-center leading-none">{(c.profiles?.full_name || 'א')[0]}</span>}
                          </div>
                          <div className="flex flex-col flex-1">
                            <div className="bg-surface-card p-4 rounded-[24px] rounded-tr-sm cursor-pointer shadow-sm border border-surface-border" onClick={() => openOverlay(() => setCommentActionModal(c))}>
                              <span className="text-brand font-black text-[13px] mb-1.5 inline-block uppercase tracking-widest" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>{c.profiles?.full_name || 'אנונימי'}</span>
                              <p className="text-brand text-[14px] whitespace-pre-wrap leading-relaxed">{renderCommentText(c.content)}</p>
                            </div>
                            <div className="flex items-center gap-4 mt-2 px-2">
                              <span className="text-[11px] text-brand-muted cursor-pointer font-bold hover:text-brand transition-colors" onClick={() => { setReplyingTo(c); setNewComment(`@${c.profiles?.full_name} `); }}>השב</span>
                              <button onClick={() => toggleCommentLike(c.id)} className={`ml-auto flex items-center gap-1 active:scale-90 transition-transform ${likedComments.has(c.id) ? 'text-rose-500' : 'text-brand-muted hover:text-rose-400'}`}>
                                <Heart size={14} fill={likedComments.has(c.id) ? 'currentColor' : 'none'} />
                              </button>
                            </div>
                            {replies.length > 0 && (
                              <button onClick={() => setExpandedThreads((prev) => ({ ...prev, [c.id]: !prev[c.id] }))} className="text-left text-[11px] font-black text-brand-muted hover:text-brand transition-colors mt-2 flex items-center gap-1.5">
                                <span className="flex-1 border-t border-surface-border mr-2" />
                                {isThreadExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {isThreadExpanded ? 'הסתר תגובות' : `צפה ב-${replies.length} תגובות`}
                              </button>
                            )}
                          </div>
                        </div>
                        {isThreadExpanded && replies.map((reply) => (
                          <div key={reply.id} className="flex gap-3 pr-12 mt-1 relative">
                            <div className="w-8 h-8 rounded-full bg-surface-card shrink-0 overflow-hidden cursor-pointer z-10 border border-surface-border flex items-center justify-center shadow-inner" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${reply.user_id}`), 50); }}>
                              {reply.profiles?.avatar_url ? <img src={reply.profiles.avatar_url} className="w-full h-full object-cover object-center" loading="lazy" /> : <span className="text-brand-muted font-black text-[10px] flex items-center justify-center leading-none">{(reply.profiles?.full_name || 'א')[0]}</span>}
                            </div>
                            <div className="flex flex-col flex-1 z-10">
                              <div className="bg-surface/50 p-3 rounded-[20px] rounded-tr-sm cursor-pointer border border-surface-border shadow-sm" onClick={() => openOverlay(() => setCommentActionModal(reply))}>
                                <span className="text-brand font-black text-[11px] mb-1.5 inline-block tracking-widest uppercase" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${reply.user_id}`), 50); }}>{reply.profiles?.full_name || 'אנונימי'}</span>
                                <p className="text-brand text-[13px] whitespace-pre-wrap leading-relaxed">{renderCommentText(reply.content)}</p>
                              </div>
                              <div className="flex items-center gap-4 mt-2 px-2">
                                <span className="text-[10px] text-brand-muted cursor-pointer font-bold hover:text-brand transition-colors" onClick={() => { setReplyingTo(c); setNewComment(`@${reply.profiles?.full_name} `); }}>השב</span>
                                <button onClick={() => toggleCommentLike(reply.id)} className={`ml-auto flex items-center gap-1 active:scale-90 transition-transform ${likedComments.has(reply.id) ? 'text-rose-500' : 'text-brand-muted hover:text-rose-400'}`}>
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
                
                {/* Input Area */}
                <div className="p-4 border-t border-surface-border flex flex-col gap-2 bg-surface">
                  {replyingTo && !editingCommentId && (
                    <div className="text-[11px] text-brand flex items-center justify-between px-4 py-2 bg-surface-card border border-surface-border rounded-[12px] w-fit mb-1 shadow-sm gap-2">
                      <span className="font-bold mr-1.5 flex items-center gap-2"><Reply size={12} className="rtl:-scale-x-100 text-brand-muted"/> משיב ל-@{replyingTo.profiles?.full_name}</span>
                      <X size={14} className="cursor-pointer text-brand-muted hover:text-brand" onClick={() => { setReplyingTo(null); setNewComment(''); }} />
                    </div>
                  )}
                  {editingCommentId && (
                    <div className="text-[11px] text-accent-primary flex justify-between px-2 font-bold mb-1 uppercase tracking-widest">
                      <span>עורך תגובה...</span>
                      <span onClick={() => { setEditingCommentId(null); setNewComment(''); }} className="cursor-pointer text-brand-muted hover:text-brand">ביטול</span>
                    </div>
                  )}
                  <div className="flex gap-2 items-center bg-surface-card rounded-[24px] p-1.5 pl-2 border border-surface-border shadow-inner">
                    <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="הוסף תגובה..." className="flex-1 bg-transparent px-4 text-brand text-[14px] outline-none placeholder:text-brand-muted" />
                    <button
                      onClick={submitComment}
                      disabled={!newComment.trim()}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 disabled:opacity-30 ${newComment.trim() ? 'bg-white text-black opacity-100' : 'bg-surface-border text-brand-muted'}`}
                    >
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
                <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/10 rounded-full pointer-events-none" /></div>
                <button onClick={() => { closeOverlay(); setReplyingTo(commentActionModal.parent_id ? comments.find((c) => c?.id === commentActionModal.parent_id) : commentActionModal); setNewComment(`@${commentActionModal.profiles?.full_name} `); }} className="w-full p-4 bg-surface-card border border-surface-border rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-95 transition-all shadow-sm">
                  <span>השב לתגובה</span><Reply size={20} className="text-brand-muted" />
                </button>
                {commentActionModal.user_id === currentUserId && (
                  <>
                    <button onClick={() => { closeOverlay(); setEditingCommentId(commentActionModal.id); setNewComment(commentActionModal.content); }} className="w-full p-4 bg-surface-card border border-surface-border rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-95 transition-all shadow-sm mt-2">
                      <span>ערוך תגובה</span><Edit2 size={20} className="text-brand-muted" />
                    </button>
                    <button onClick={() => { if (window.confirm('למחוק תגובה?')) { closeOverlay(); deleteComment(commentActionModal.id); } }} className="w-full p-4 bg-surface-card border border-red-500/30 rounded-2xl text-red-500 font-black flex justify-between items-center text-[15px] active:scale-95 transition-all mt-2 shadow-sm">
                      <span>מחק תגובה</span><Trash2 size={20} className="text-red-500" />
                    </button>
                  </>
                )}
              </motion.div>
            </div>
          )}

          {/* OPTIONS MENU POST */}
          {optionsMenuPost && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] p-6 flex flex-col gap-3 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border text-center">
                <div className="w-full py-2 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/10 rounded-full pointer-events-none" /></div>
                <button onClick={() => { closeOverlay(); setTimeout(() => handleShare(optionsMenuPost), 100); }} className="w-full p-4 bg-surface-card rounded-[24px] text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>שתף פוסט</span><Share2 size={20} className="text-brand-muted" /></button>
                {optionsMenuPost.media_url && <button onClick={() => handleDownloadMedia(optionsMenuPost.media_url)} className="w-full p-4 bg-surface-card rounded-[24px] text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>שמור למכשיר</span><Download size={20} className="text-brand-muted" /></button>}
                <button onClick={async () => { try { await supabase.from('saved_posts').insert({ user_id: currentUserId, post_id: optionsMenuPost.id }); toast.success('הפוסט נשמר במועדפים!'); } catch { toast.error('הפוסט כבר שמור אצלך'); } closeOverlay(); }} className="w-full p-4 bg-surface-card rounded-[24px] text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>שמור במועדפים</span><Bookmark size={20} className="text-brand-muted" /></button>
                <button onClick={() => handleCopyLink(optionsMenuPost)} className="w-full p-4 bg-surface-card rounded-[24px] text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>העתק קישור</span><LinkIcon size={20} className="text-brand-muted" /></button>
                
                {optionsMenuPost.user_id === currentUserId && (
                  <>
                    <button onClick={() => { closeOverlay(); setTimeout(() => { openOverlay(() => { setEditingPost(optionsMenuPost); setNewPost(optionsMenuPost.content || ''); setShowCreatePost(true); }); }, 100); }} className="w-full p-4 bg-surface-card rounded-[24px] text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm mt-2"><span>ערוך פוסט</span><Edit2 size={20} className="text-brand-muted" /></button>
                    <button onClick={() => { if (window.confirm('למחוק פוסט?')) { deletePost(optionsMenuPost.id); } }} className="w-full p-4 bg-surface-card border border-rose-500/30 rounded-[24px] text-rose-500 font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all mt-2"><span>מחק פוסט</span><Trash2 size={20} className="text-rose-500" /></button>
                  </>
                )}
              </motion.div>
            </div>
          )}

          {/* DESC POST FULL */}
          {activeDescPost && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] flex flex-col overflow-hidden pb-10 max-h-[75vh] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border text-center">
                <div className="w-full py-5 flex justify-center cursor-grab active:cursor-grabbing border-b border-surface-border"><div className="w-16 h-1.5 bg-white/10 rounded-full pointer-events-none" /></div>
                <div className="p-6 overflow-y-auto" onPointerDown={stopPropagation} onTouchStart={stopPropagation}>
                  <p className="text-brand text-[15px] leading-relaxed whitespace-pre-wrap text-right">{activeDescPost.content}</p>
                </div>
              </motion.div>
            </div>
          )}

          {/* CONTRIBUTE MODAL */}
          {contributeModal && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] p-6 flex flex-col gap-4 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border text-center">
                <div className="w-full py-2 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/10 rounded-full pointer-events-none" /></div>
                
                <div className="flex flex-col items-center gap-2 mb-2">
                  <div className="w-16 h-16 bg-surface-card border border-surface-border rounded-3xl flex items-center justify-center shadow-inner mb-2">
                    <Lock size={28} className="text-accent-primary" />
                  </div>
                  <h2 className="text-xl font-black text-brand tracking-widest uppercase">שחרר את הדרופ</h2>
                  <p className="text-brand-muted text-[13px] font-medium leading-relaxed max-w-[250px]">
                    השקע CRD כדי לעזור לחשוף את הפוסט הזה לכולם.
                  </p>
                </div>

                <div className="bg-surface-card border border-surface-border p-4 rounded-2xl flex flex-col gap-2">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-[11px] font-black text-brand-muted tracking-widest uppercase">התקדמות</span>
                    <span className="text-[13px] font-black text-brand">{contributeModal.current_crd} / {contributeModal.required_crd} CRD</span>
                  </div>
                  <div className="w-full h-2.5 bg-surface rounded-full overflow-hidden border border-surface-border shadow-inner">
                    <div className="h-full bg-accent-primary rounded-full" style={{ width: `${Math.min(100, (contributeModal.current_crd / contributeModal.required_crd) * 100)}%` }} />
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-surface-card border border-surface-border rounded-2xl p-2 pl-4 mt-2">
                  <div className="w-12 h-12 bg-surface rounded-xl flex items-center justify-center shrink-0 border border-surface-border/50">
                    <Coins size={20} className="text-brand-muted" />
                  </div>
                  <input type="number" value={contributeAmount} onChange={(e) => setContributeAmount(Number(e.target.value))} placeholder="50" className="flex-1 bg-transparent border-none text-2xl font-black text-brand outline-none text-left" dir="ltr" />
                  <span className="text-brand-muted font-bold text-[13px] tracking-widest uppercase">CRD</span>
                </div>

                <Button onClick={handleContribute} disabled={contributing || !contributeAmount} className="h-14 bg-accent-primary text-white font-black text-[15px] uppercase tracking-widest rounded-full mt-2 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2">
                  {contributing ? <Loader2 className="animate-spin text-white" /> : <Lock size={18}/>}
                  {contributing ? 'מעבד...' : 'השקע בדרופ'}
                </Button>
              </motion.div>
            </div>
          )}
        
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
