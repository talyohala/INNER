import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
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
  const createPostDragControls = useDragControls();
  const circlesDragControls = useDragControls();
  const commentActionDragControls = useDragControls();
  
  const [mounted, setMounted] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  
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
  
  const [showAllCircles, setShowAllCircles] = useState<Record<string, boolean>>({});
  const [userCirclesModal, setUserCirclesModal] = useState<any[] | null>(null);
  
  const [showScrollTop, setShowScrollTop] = useState(false);
  const lastScrollY = useRef(0);
  
  const stateRef = useRef({ 
    comments: false, options: false, desc: false, create: false, 
    fullscreen: false, commentAction: false, userCircles: false 
  });
  
  useEffect(() => {
    stateRef.current = {
      comments: !!activeCommentsPostId, options: !!optionsMenuPost, desc: !!activeDescPost,
      create: showCreatePost, fullscreen: !!fullScreenMedia, commentAction: !!commentActionModal, userCircles: !!userCirclesModal
    };
  }, [activeCommentsPostId, optionsMenuPost, activeDescPost, showCreatePost, fullScreenMedia, commentActionModal, userCirclesModal]);

  useEffect(() => {
    const handlePopState = () => {
      const s = stateRef.current;
      if (s.commentAction) { setCommentActionModal(null); }
      else if (s.userCircles) { setUserCirclesModal(null); }
      else if (s.comments) { setActiveCommentsPostId(null); setActivePost(null); setReplyingTo(null); }
      else if (s.options) { setOptionsMenuPost(null); }
      else if (s.desc) { setActiveDescPost(null); }
      else if (s.create) { setShowCreatePost(false); setEditingPost(null); }
      else if (s.fullscreen) { setFullScreenMedia(null); }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY < lastScrollY.current && currentY > 300) {
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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'instant' }); 
  };

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

      const [rawPosts, rawProfiles, rawLikes, rawComments, rawMembers, rawCircles] = await Promise.all([
        supabase.from('posts').select('*').order('created_at', { ascending: false }).then(r => r.data || []),
        supabase.from('profiles').select('*').then(r => r.data || []),
        supabase.from('likes').select('*').then(r => r.data || []),
        supabase.from('comments').select('*').then(r => r.data || []),
        supabase.from('circle_members').select('*').then(r => r.data || []),
        supabase.from('circles').select('*').then(r => r.data || [])
      ]);

      const fetchedPosts = rawPosts.filter((p: any) => !p.circle_id).map((p: any) => {
        const prof = rawProfiles.find((pr: any) => pr.id === p.user_id) || {};
        const pLikes = rawLikes.filter((l: any) => l.post_id === p.id);
        const pComments = rawComments.filter((c: any) => c.post_id === p.id);
        const userCircles = rawCircles.filter((c: any) => rawMembers.some((m: any) => m.circle_id === c.id && m.user_id === p.user_id));
        return { ...p, profiles: prof, likes_count: pLikes.length, comments_count: pComments.length, is_liked: !!uid && pLikes.some((l: any) => l.user_id === uid), user_circles: userCircles };
      });
      setPosts(fetchedPosts);
    } catch (err) {} finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    setMounted(true); fetchData(false); checkUnreadNotifications();
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
          await presenceChannel.track({ online_at: new Date().toISOString(), user_id: currentUserId || 'guest' });
        }
      });
    return () => { supabase.removeChannel(presenceChannel); };
  }, [currentUserId]);

  useEffect(() => {
    if (!fullScreenMedia) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const vid = entry.target as HTMLVideoElement;
        if (vid.tagName !== 'VIDEO') return;
        if (entry.isIntersecting) { vid.muted = false; vid.play().catch(() => {}); } 
        else { vid.pause(); vid.muted = true; vid.currentTime = 0; }
      });
    }, { threshold: 0.7 });
    document.querySelectorAll('.full-media-item').forEach(v => observer.observe(v));
    return () => observer.disconnect();
  }, [fullScreenMedia, currentMediaIndex]);

  const handleTouchStart = (e: React.TouchEvent) => { if (isAnyModalOpen()) return; if (window.scrollY <= 0) pullStartY.current = e.touches[0].clientY; };
  const handleTouchMove = (e: React.TouchEvent) => { if (isAnyModalOpen()) return; if (pullStartY.current > 0 && window.scrollY <= 0) { const y = e.touches[0].clientY - pullStartY.current; if (y > 0) setPullY(Math.min(y, 120)); } };
  const handleTouchEnd = async () => { if (isAnyModalOpen()) return; if (pullY > 60) { setRefreshing(true); setPullY(0); triggerFeedback('coin'); await fetchData(true); await checkUnreadNotifications(); } else { setPullY(0); } pullStartY.current = 0; };

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
        setPosts(curr => curr.map(p => p.id === editingPost.id ? { ...p, content: newPost.trim() } : p));
        toast.success('עודכן בהצלחה'); closeOverlay();
      } else {
        let media_url = null; let media_type = 'text';
        if (selectedFile) {
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
          const { data } = await supabase.storage.from('feed_images').upload(fileName, selectedFile);
          media_url = supabase.storage.from('feed_images').getPublicUrl(data!.path).data.publicUrl;
          media_type = selectedFile.type.startsWith('video/') ? 'video' : 'image';
        }
        await supabase.from('posts').insert({ user_id: currentUserId, content: newPost.trim(), media_url, media_type, circle_id: null });
      }
      setNewPost(''); setSelectedFile(null); setEditingPost(null); fetchData(true);
    } catch (err) { toast.error('שגיאה בשמירה'); } finally { setPosting(false); }
  };

  const handleShare = async (post: any) => {
    triggerFeedback('pop');
    const publicUrl = `https://inner-app.com/post/${post.id}`; 
    const textToShare = `${post.content ? post.content + '\n\n' : ''}צפה בפוסט הזה ב-INNER!`;
    try {
      const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor && (window as any).Capacitor.isNativePlatform?.();
      if (isNative) { await Share.share({ title: 'INNER', text: textToShare, url: publicUrl, dialogTitle: 'שתף עם חברים' }); } 
      else if (navigator.share && window.isSecureContext) { await navigator.share({ title: 'INNER', text: textToShare, url: publicUrl }); } 
      else { await navigator.clipboard.writeText(`${textToShare}\n${publicUrl}`); toast.success('הקישור הועתק ללוח'); }
    } catch (e) {}
  };

  const handleCopyLink = async (post: any) => {
    const publicUrl = `https://inner-app.com/post/${post.id}`;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('הקישור הועתק ללוח', { icon: '🔗' });
    } catch (e) { toast.error('שגיאה בהעתקה'); }
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
    } catch (e) {
      toast.error('לא ניתן להוריד את הקובץ', { id: 'dl' });
    }
    closeOverlay();
  };

  const handleSavePost = async (post: any) => {
    try {
      await supabase.from('saved_posts').insert({ user_id: currentUserId, post_id: post.id });
      toast.success('הפוסט נשמר במועדפים!', { icon: '⭐' });
    } catch(e: any) {
      if(e.code === '23505') toast.success('הפוסט כבר שמור אצלך', { icon: '⭐' });
      else toast.error('שגיאה בשמירה');
    }
    closeOverlay();
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    triggerFeedback('pop');
    const update = (list: any[]) => list.map(p => p.id === postId ? { ...p, is_liked: !isLiked, likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1 } : p);
    setPosts(update(posts)); if (fullScreenMedia) setFullScreenMedia(update(fullScreenMedia));
    try { 
      if (isLiked) await supabase.from('likes').delete().match({ post_id: postId, user_id: currentUserId });
      else await supabase.from('likes').insert({ post_id: postId, user_id: currentUserId });
    } catch (err) {}
  };

  const submitComment = async () => {
    if (!newComment.trim() || !activePost) return;
    try {
      if (editingCommentId) {
        await supabase.from('comments').update({ content: newComment.trim() }).eq('id', editingCommentId);
        setComments(prev => prev.map(c => c.id === editingCommentId ? { ...c, content: newComment.trim() } : c));
        setEditingCommentId(null);
      } else {
        const payload: any = { post_id: activePost.id, user_id: currentUserId, content: newComment.trim() };
        if (replyingTo) { payload.parent_id = replyingTo.id; }
        const { data, error } = await supabase.from('comments').insert(payload).select('*, profiles(*)').single();
        if (error) throw error;
        if (data) {
          setComments(prev => [...prev, data]);
          const update = (list: any[]) => list.map(p => p.id === activePost.id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p);
          setPosts(update(posts)); if (fullScreenMedia) setFullScreenMedia(update(fullScreenMedia));
          if (replyingTo) { setExpandedThreads(prev => ({ ...prev, [replyingTo.id]: true })); }
          triggerFeedback('coin');
        }
      }
      setNewComment(''); setReplyingTo(null);
    } catch (err: any) { toast.error(`שגיאה בשרת: ${err.message}`); }
  };

  const toggleCommentLike = (commentId: string) => {
    setLikedComments(prev => { const next = new Set(prev); if (next.has(commentId)) next.delete(commentId); else next.add(commentId); return next; });
    triggerFeedback('pop');
  };

  const deletePost = async (postId: string) => {
    triggerFeedback('error'); closeOverlay();
    setPosts(curr => curr.filter(p => p.id !== postId));
    await supabase.from('posts').delete().eq('id', postId);
  };

  const deleteComment = async (commentId: string) => {
    triggerFeedback('error');
    setComments(curr => curr.filter(c => c && c.id !== commentId && c.parent_id !== commentId));
    const update = (list: any[]) => list.map(p => p.id === activePost?.id ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p);
    setPosts(update(posts)); if (fullScreenMedia) setFullScreenMedia(update(fullScreenMedia));
    try { await supabase.from('comments').delete().eq('id', commentId); } catch (err) {}
  };

  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (scrollTimeout.current) return;
    scrollTimeout.current = setTimeout(() => {
      scrollTimeout.current = null;
      const index = Math.round(target.scrollTop / target.clientHeight);
      if (index !== currentMediaIndex) setCurrentMediaIndex(index);
      if (target.scrollHeight - target.scrollTop <= target.clientHeight * 2 && fullScreenMedia) {
        const more = posts.filter(p => p.media_url).sort(()=>Math.random()-0.5).slice(0,3);
        setFullScreenMedia(prev => [...(prev || []), ...more]);
      }
    }, 150);
  };

  const renderCommentText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(@[\wא-ת]+)/g);
    return parts.map((part, i) => 
      part.startsWith('@') ? <span key={i} className="text-[#2196f3] font-bold">{part}</span> : <span key={i}>{part}</span>
    );
  };

  const stopPropagation = (e: any) => e.stopPropagation();
  const topLevelComments = comments.filter(c => c && !c.parent_id);

  if (loading && posts.length === 0) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

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
            className="fixed bottom-24 right-5 z-[80] w-12 h-12 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center shadow-[0_5px_15px_rgba(0,0,0,0.5)] active:scale-90"
          >
            <ArrowUp size={24} className="text-white drop-shadow-md" />
          </motion.button>
        )}
      </AnimatePresence>

      <FadeIn className="px-0 pt-8 pb-32 bg-[#030303] min-h-screen relative overflow-x-hidden touch-pan-y" dir="rtl" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <div className="fixed top-0 left-0 right-0 flex justify-center z-50 pointer-events-none transition-transform duration-200" style={{ transform: `translateY(${Math.max(pullY - 40, -40)}px)`, opacity: pullY / 60 }}><div className="bg-[#111] p-2.5 rounded-full shadow-2xl border border-white/10 mt-6"><RefreshCw size={22} className={`text-white ${refreshing ? 'animate-spin' : ''}`} /></div></div>
        
        <div className="relative z-10 px-4">
          <div className="flex justify-between items-start mb-8 h-12 px-1">
            <div className="w-10"></div>
            <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2">
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase drop-shadow-md">INNER</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 bg-[#8bc34a] rounded-full animate-pulse shadow-[0_0_8px_#8bc34a]"></span>
                <span className="text-[10px] font-black text-white/80 tracking-widest">{onlineUsers.toLocaleString()}</span>
              </div>
            </div>
            <button onClick={() => navigate('/notifications')} className="w-10 h-10 flex justify-center items-center bg-white/[0.04] border border-white/10 rounded-full active:scale-90 relative shadow-sm backdrop-blur-sm">
              <Bell size={18} className="text-white" />
              {unreadCount > 0 && <span className="absolute top-2 right-2.5 w-2 h-2 bg-[#e91e63] rounded-full border border-black animate-pulse"></span>}
            </button>
          </div>
          
          <div className="p-5 rounded-[36px] mb-8 border border-white/10 bg-white/[0.04] backdrop-blur-md shadow-2xl relative z-10 flex flex-col gap-3">
            {selectedFile && (
              <div className="relative w-full h-36 rounded-[24px] overflow-hidden bg-[#111] border border-white/10 flex items-center justify-center">
                {selectedFile.type.startsWith('video/') ? (
                   <video src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover opacity-80" />
                ) : (
                   <img src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover opacity-80" />
                )}
                <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white z-10"><X size={16}/></button>
              </div>
            )}
            <textarea value={!editingPost ? newPost : ''} onChange={(e) => { if(!editingPost) setNewPost(e.target.value); }} placeholder="שדר משהו לכולם..." className="w-full bg-transparent border-none text-white/90 text-[16px] font-medium outline-none resize-none placeholder:text-white/40 pt-1" rows={Math.min(Math.max(newPost.split('\n').length, 1), 5)} />
            <div className="flex justify-end items-center gap-4 border-t border-white/10 pt-4 mt-1">
              <div className="w-12 h-12 flex items-center justify-center text-white/40 rounded-full border border-white/10 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => fileInputRef.current?.click()}>
                <Paperclip size={20} />
              </div>
              <button onClick={handlePost} disabled={posting || (!newPost.trim() && !selectedFile)} className="w-12 h-12 rounded-full bg-white flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.1)] disabled:opacity-50 active:scale-95 transition-all">
                {posting ? <Loader2 className="animate-spin w-5 h-5 text-[#2196f3]"/> : <Send size={24} className="rtl:-scale-x-100 -ml-1 text-[#2196f3]" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 relative z-10 px-4">
          {posts.map((post) => {
            const isMyPost = post.user_id === currentUserId;
            const hasMedia = !!post.media_url;
            const isVideo = post.media_url?.match(/\.(mp4|webm|mov)$/i);
            const isExpanded = showAllCircles[post.id];
            const visibleCircles = isExpanded ? post.user_circles : post.user_circles?.slice(0, 10);
            return (
              <div key={post.id} className="flex flex-col rounded-[36px] bg-[#0A0A0A] border border-white/10 overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                {hasMedia && (
                  <div className="w-full bg-[#050505] relative cursor-pointer" onClick={() => openOverlay(() => { 
                    const vids = posts.filter(p => p.media_url);
                    setFullScreenMedia([post, ...vids.filter(v => v.id !== post.id).sort(()=>Math.random()-0.5)]);
                    setCurrentMediaIndex(0);
                  })}>
                    {isVideo ? <video src={post.media_url} autoPlay loop muted playsInline className="w-full max-h-[500px] object-cover" /> : <img src={post.media_url} onError={(e) => { e.currentTarget.src = 'https://placehold.co/500x500/111/333?text=Media+Unavailable'; }} className="w-full max-h-[500px] object-cover" />}
                    {post.content && (
                      <div className="absolute bottom-0 left-0 right-0 p-5 pt-16 bg-gradient-to-t from-[#0A0A0A] via-black/60 to-transparent flex items-end pointer-events-none">
                        <p onClick={(e) => { e.stopPropagation(); openOverlay(() => setActiveDescPost(post)); }} className="text-white/90 text-sm leading-relaxed text-right line-clamp-2 w-full pr-2 cursor-pointer active:opacity-50 pointer-events-auto">{post.content}</p>
                      </div>
                    )}
                  </div>
                )}
                {!hasMedia && post.content && ( <div className="p-6 pb-4 border-b border-white/5"><p onClick={() => openOverlay(() => setActiveDescPost(post))} className="text-white/90 text-[15px] leading-relaxed text-right line-clamp-3 cursor-pointer active:opacity-50">{post.content}</p></div> )}
                {post.user_circles && post.user_circles.length > 0 && (
                  <div className="px-5 py-4 border-b border-white/5 bg-[#050505]">
                    <h4 className="text-white/30 text-[10px] font-black mb-3 uppercase tracking-wider">שייך למועדונים:</h4>
                    <div className="flex gap-4 overflow-x-auto scrollbar-hide items-center">
                      {visibleCircles.map((circle: any) => (
                        <div key={circle.id} onClick={() => navigate(`/circle/${circle.slug || circle.id}`)} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform">
                          <div className="w-12 h-12 rounded-full border border-white/10 overflow-hidden bg-[#111]">{circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover" /> : <Users className="w-full h-full p-2.5 text-white/20"/>}</div>
                          <span className="text-[9px] text-white/60 font-bold max-w-[55px] truncate text-center">{circle.name}</span>
                        </div>
                      ))}
                      {!isExpanded && post.user_circles.length > 10 && (
                        <div onClick={() => openOverlay(() => setUserCirclesModal(post.user_circles))} className="w-12 h-12 rounded-full border border-white/10 bg-white/5 flex flex-col items-center justify-center shrink-0 cursor-pointer active:scale-95 mb-4"><ChevronLeft size={16} className="text-white/50" /></div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between px-5 py-4 bg-[#0A0A0A]">
                  <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate(`/profile/${post.user_id}`)}>
                    <div className="w-10 h-10 rounded-full bg-black border border-white/10 overflow-hidden shrink-0">{post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full p-2 text-white/20" />}</div>
                    <div className="flex flex-col text-right"><span className="text-white font-black text-[14px]">{post.profiles?.full_name || 'אנונימי'}</span><span className="text-white/30 text-[10px]">{new Date(post.created_at).toLocaleDateString('he-IL')}</span></div>
                  </div>
                  <div className="flex items-center gap-3 flex-row-reverse">
                    <button onClick={() => openOverlay(() => setOptionsMenuPost(post))} className="text-white/30 active:scale-90 border-r border-white/10 pr-3"><MoreVertical size={20} /></button>
                    <button onClick={() => openOverlay(() => { setActivePost(post); setActiveCommentsPostId(post.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at',{ascending:true}).then(r => {setComments(r.data||[]); setLoadingComments(false);}); })} className="flex items-center gap-1.5 text-white/30 active:scale-90"><MessageSquare size={20} /><span className="text-[13px] font-black">{post.comments_count}</span></button>
                    <button onClick={() => handleLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 active:scale-90 ${post.is_liked ? 'text-[#e91e63]' : 'text-white/30'}`}><Heart size={20} fill={post.is_liked ? "currentColor" : "none"} /><span className="text-[13px] font-black">{post.likes_count}</span></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </FadeIn>

      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {fullScreenMedia && (
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed inset-0 z-[999999] bg-black">
              <div className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide" onScroll={handleContainerScroll}>
                {fullScreenMedia.map((vid, idx) => {
                  const isVid = vid.media_url?.match(/\.(mp4|webm|mov)$/i);
                  return (
                    <div key={vid.id + idx} className="w-full h-screen snap-center relative bg-black flex items-center justify-center">
                      {isVid ? (
                        <video src={vid.media_url} loop playsInline className="w-full h-full object-cover full-media-item" onClick={(e) => e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause()} />
                      ) : (
                        <img src={vid.media_url} onError={(e) => { e.currentTarget.src = 'https://placehold.co/500x500/111/333?text=Media+Unavailable'; }} className="w-full h-full object-contain full-media-item" />
                      )}
                      
                      <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setOptionsMenuPost(vid)); }} className="absolute bottom-6 left-4 z-[60] active:scale-90 transition-transform drop-shadow-md">
                        <MoreVertical size={24} className="text-white" />
                      </button>

                      <div className="absolute bottom-48 left-4 flex flex-col gap-6 items-center z-50">
                        <button onClick={(e) => { e.stopPropagation(); handleLike(vid.id, vid.is_liked); }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform"><Heart size={30} className={vid.is_liked ? 'text-[#e91e63]' : 'text-white'} fill={vid.is_liked ? 'currentColor' : 'none'} strokeWidth={1.5} /><span className="text-white text-[13px] font-black drop-shadow-md">{vid.likes_count}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); openOverlay(() => { setActivePost(vid); setActiveCommentsPostId(vid.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', vid.id).order('created_at',{ascending:true}).then(r => {setComments(r.data||[]); setLoadingComments(false);}); }); }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform"><MessageSquare size={30} className="text-white" strokeWidth={1.5} /><span className="text-white text-[13px] font-black drop-shadow-md">{vid.comments_count}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); handleShare(vid); }} className="active:scale-90 transition-transform"><Share2 size={30} className="text-white" strokeWidth={1.5} /></button>
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end pointer-events-none">
                        {vid.user_circles && vid.user_circles.length > 0 && (
                          <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide pr-2 pointer-events-auto">
                            {vid.user_circles.slice(0, 5).map((c: any) => (
                              <div key={c.id} onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/circle/${c.slug||c.id}`), 50); }} className="w-8 h-8 rounded-full bg-black shrink-0 overflow-hidden border border-white/20 shadow-md cursor-pointer pointer-events-auto">{c.cover_url ? <img src={c.cover_url} className="w-full h-full object-cover"/> : <Users size={14} className="m-1.5 text-white/50"/>}</div>
                            ))}
                            {vid.user_circles.length > 5 && ( <div onClick={(e) => { e.stopPropagation(); openOverlay(() => setUserCirclesModal(vid.user_circles)); }} className="w-8 h-8 rounded-full border border-white/20 bg-white/10 flex flex-col items-center justify-center shrink-0 cursor-pointer active:scale-95 shadow-md pointer-events-auto"><ChevronLeft size={12} className="text-white" /></div> )}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mb-2 cursor-pointer w-fit pr-2 pointer-events-auto" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${vid.user_id}`), 50); }}>
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-black border-2 border-white/20 shrink-0 shadow-lg">{vid.profiles?.avatar_url ? <img src={vid.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={24} className="text-white/50 w-full h-full p-2" />}</div>
                          <span className="text-white font-black text-[17px] drop-shadow-md">{vid.profiles?.full_name || 'אנונימי'}</span>
                        </div>
                        <p className="text-white/90 text-[15px] font-medium text-right pr-2 w-5/6 line-clamp-3 pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); openOverlay(() => setActiveDescPost(vid)); }}>{vid.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {activeCommentsPostId && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 400 }} className="relative z-10 bg-white rounded-t-[36px] h-[80vh] flex flex-col overflow-hidden pb-10 shadow-[0_-10px_50px_rgba(0,0,0,0.1)]">
                <div className="w-full py-6 flex justify-center cursor-grab active:cursor-grabbing border-b border-black/5" onPointerDown={e => commentsDragControls.start(e)} style={{ touchAction: "none" }}><div className="w-16 h-1.5 bg-black/15 rounded-full"/></div>
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6" onPointerDown={stopPropagation} onTouchStart={stopPropagation}>
                  {loadingComments ? <Loader2 className="animate-spin mx-auto text-black/20 mt-4" /> : topLevelComments.map(c => {
                    const replies = comments.filter(r => r && r.parent_id === c.id);
                    const isThreadExpanded = expandedThreads[c.id];
                    return (
                      <div key={c.id} className="flex flex-col gap-2">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 min-w-[40px] rounded-full bg-black/5 shrink-0 overflow-hidden cursor-pointer border border-black/10 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>
                            {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover object-center" /> : <UserCircle className="w-full h-full p-2 text-black/20" />}
                          </div>
                          <div className="flex flex-col flex-1">
                            <div className="bg-black/5 p-3 rounded-2xl rounded-tr-sm cursor-pointer" onClick={() => openOverlay(() => setCommentActionModal(c))}>
                              <span className="text-black font-bold text-xs mb-1 inline-block" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>{c.profiles?.full_name || 'אנונימי'}</span>
                              <p className="text-black/80 text-sm whitespace-pre-wrap leading-relaxed">{renderCommentText(c.content)}</p>
                            </div>
                            <div className="flex items-center gap-4 mt-2 px-2">
                              <span className="text-[11px] text-black/40 cursor-pointer font-medium hover:text-black" onClick={() => { setReplyingTo(c); setNewComment(`@${c.profiles?.full_name} `); }}>השב</span>
                              <button onClick={() => toggleCommentLike(c.id)} className={`ml-auto flex items-center gap-1 ${likedComments.has(c.id) ? 'text-[#e91e63]' : 'text-black/30'}`}><Heart size={12} fill={likedComments.has(c.id) ? "currentColor" : "none"} /></button>
                            </div>
                            {replies.length > 0 && (
                              <button onClick={() => setExpandedThreads(prev => ({...prev, [c.id]: !prev[c.id]}))} className="text-left text-[11px] font-bold text-black/40 hover:text-black/70 mt-2 flex items-center gap-1">
                                <span className="flex-1 border-t border-black/10 mr-2"></span>
                                {isThreadExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                                {isThreadExpanded ? 'הסתר תגובות' : `צפה ב-${replies.length} תגובות`}
                              </button>
                            )}
                          </div>
                        </div>
                        {isThreadExpanded && replies.map(reply => (
                          <div key={reply.id} className="flex gap-3 pr-10 mt-2 relative">
                            <div className="absolute right-[20px] top-[-10px] bottom-6 border-r-2 border-black/10 rounded-br-xl w-4"></div>
                            <div className="w-8 h-8 min-w-[32px] rounded-full bg-black/5 shrink-0 overflow-hidden cursor-pointer z-10 border border-black/10 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${reply.user_id}`), 50); }}>
                              {reply.profiles?.avatar_url ? <img src={reply.profiles.avatar_url} className="w-full h-full object-cover object-center" /> : <UserCircle className="w-full h-full p-1.5 text-black/20" />}
                            </div>
                            <div className="flex flex-col flex-1 z-10">
                              <div className="bg-black/5 p-3 rounded-2xl rounded-tr-sm cursor-pointer" onClick={() => openOverlay(() => setCommentActionModal(reply))}>
                                <span className="text-black font-bold text-[11px] mb-1 inline-block" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${reply.user_id}`), 50); }}>{reply.profiles?.full_name || 'אנונימי'}</span>
                                <p className="text-black/80 text-[13px] whitespace-pre-wrap leading-relaxed">{renderCommentText(reply.content)}</p>
                              </div>
                              <div className="flex items-center gap-4 mt-2 px-2">
                                <span className="text-[10px] text-black/40 cursor-pointer font-medium hover:text-black" onClick={() => { setReplyingTo(c); setNewComment(`@${reply.profiles?.full_name} `); }}>השב</span>
                                <button onClick={() => toggleCommentLike(reply.id)} className={`ml-auto flex items-center gap-1 ${likedComments.has(reply.id) ? 'text-[#e91e63]' : 'text-black/30'}`}><Heart size={10} fill={likedComments.has(reply.id) ? "currentColor" : "none"} /></button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
                <div className="p-4 border-t border-black/10 flex flex-col gap-2 bg-white" onPointerDown={stopPropagation}>
                  {replyingTo && !editingCommentId && ( <div className="text-[11px] text-[#2196f3] flex items-center justify-between px-3 py-1 bg-[#2196f3]/10 rounded-full w-fit mb-1"><span className="font-bold mr-1">משיב ל-@{replyingTo.profiles?.full_name}</span><X size={12} className="cursor-pointer" onClick={() => {setReplyingTo(null); setNewComment('');}} /></div> )}
                  {editingCommentId && <div className="text-[10px] text-[#2196f3] flex justify-between px-2"><span>עורך תגובה...</span><span onClick={() => {setEditingCommentId(null); setNewComment('');}} className="cursor-pointer font-bold">ביטול</span></div>}
                  <div className="flex gap-2 items-center bg-black/5 rounded-full p-1 pl-2">
                    <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="הוסף תגובה..." className="flex-1 bg-transparent px-4 text-black text-sm outline-none placeholder:text-black/40" />
                    <button onClick={submitComment} disabled={!newComment.trim()} className="w-9 h-9 bg-[#2196f3] rounded-full flex items-center justify-center text-white active:scale-95 disabled:opacity-50 transition-opacity"><Send size={16} className="rtl:-scale-x-100 -ml-0.5" /></button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {commentActionModal && (
             <div className="fixed inset-0 z-[99999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
               <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative z-10 bg-white rounded-t-[36px] p-6 flex flex-col gap-3 pb-12 shadow-[0_-10px_50px_rgba(0,0,0,0.1)]">
                 <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-black/15 rounded-full"/></div>
                 <button onClick={() => { closeOverlay(); setReplyingTo(commentActionModal.parent_id ? comments.find(c => c?.id === commentActionModal.parent_id) : commentActionModal); setNewComment(`@${commentActionModal.profiles?.full_name} `); }} className="w-full p-4 bg-black/5 rounded-2xl text-black font-bold flex justify-between items-center text-lg hover:bg-black/10 transition-colors">השב לתגובה <Reply size={20} className="text-[#2196f3]" /></button>
                 {commentActionModal.user_id === currentUserId && (
                   <>
                     <button onClick={() => { closeOverlay(); setEditingCommentId(commentActionModal.id); setNewComment(commentActionModal.content); }} className="w-full p-4 bg-black/5 rounded-2xl text-black font-bold flex justify-between items-center text-lg hover:bg-black/10 transition-colors">ערוך תגובה <Edit2 size={20} className="text-black/40" /></button>
                     <button onClick={() => { if(window.confirm('למחוק תגובה?')){ closeOverlay(); deleteComment(commentActionModal.id); } }} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 font-bold flex justify-between items-center text-lg mt-2 hover:bg-red-500/20 transition-colors">מחק תגובה <Trash2 size={20} /></button>
                   </>
                 )}
               </motion.div>
             </div>
          )}

          {userCirclesModal && (
             <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm" onClick={closeOverlay} />
               <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative z-10 bg-white rounded-t-[36px] p-6 flex flex-col gap-3 pb-12 max-h-[70vh] shadow-[0_-10px_50px_rgba(0,0,0,0.1)]">
                 <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-black/15 rounded-full"/></div>
                 <h2 className="text-black font-black text-lg mb-4">מועדונים ({userCirclesModal.length})</h2>
                 <div className="flex flex-col gap-4 overflow-y-auto" onPointerDown={stopPropagation} onTouchStart={stopPropagation}>
                   {userCirclesModal.map((c: any) => (
                     <div key={c.id} onClick={() => { closeOverlay(); navigate(`/circle/${c.slug||c.id}`); }} className="flex items-center gap-4 bg-black/5 p-3 rounded-2xl cursor-pointer border border-black/5">
                        <div className="w-12 h-12 rounded-full bg-black/5 overflow-hidden border border-black/10 shrink-0">{c.cover_url ? <img src={c.cover_url} className="w-full h-full object-cover"/> : <Users size={20} className="m-3 text-black/30"/>}</div><span className="text-black font-bold">{c.name}</span>
                     </div>
                   ))}
                 </div>
               </motion.div>
             </div>
          )}

          {optionsMenuPost && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative z-10 bg-white rounded-t-[36px] p-6 flex flex-col gap-2 pb-12 shadow-[0_-10px_50px_rgba(0,0,0,0.1)]">
                <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-black/15 rounded-full"/></div>
                
                {optionsMenuPost.media_url && (
                  <button onClick={() => handleDownloadMedia(optionsMenuPost.media_url)} className="w-full p-4 bg-black/5 rounded-2xl text-black font-bold flex justify-between items-center text-lg active:bg-black/10 transition-colors">
                    שמור למכשיר <Download size={20} className="text-black/40" />
                  </button>
                )}
                
                <button onClick={() => handleSavePost(optionsMenuPost)} className="w-full p-4 bg-black/5 rounded-2xl text-black font-bold flex justify-between items-center text-lg active:bg-black/10 transition-colors">
                  שמור במועדפים <Bookmark size={20} className="text-black/40" />
                </button>
                
                <button onClick={() => handleCopyLink(optionsMenuPost)} className="w-full p-4 bg-black/5 rounded-2xl text-black font-bold flex justify-between items-center text-lg active:bg-black/10 transition-colors">
                  העתק קישור <Link size={20} className="text-black/40" />
                </button>

                <button onClick={() => { closeOverlay(); setTimeout(() => handleShare(optionsMenuPost), 100); }} className="w-full p-4 bg-[#2196f3]/10 rounded-2xl text-[#2196f3] font-bold flex justify-between items-center text-lg active:bg-[#2196f3]/20 transition-colors mt-2">
                  שתף פוסט <Share2 size={20} className="text-[#2196f3]" />
                </button>
                
                {optionsMenuPost.user_id === currentUserId && (
                  <>
                    <button onClick={() => { closeOverlay(); setTimeout(() => openOverlay(() => { setEditingPost(optionsMenuPost); setNewPost(optionsMenuPost.content || ''); setShowCreatePost(true); }), 100); }} className="w-full p-4 bg-black/5 rounded-2xl text-black font-bold flex justify-between items-center text-lg active:bg-black/10 transition-colors mt-4">
                      ערוך פוסט <Edit2 size={20} className="text-black/40" />
                    </button>
                    <button onClick={() => { if(window.confirm('למחוק פוסט?')){ deletePost(optionsMenuPost.id); } }} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 font-bold flex justify-between items-center text-lg mt-2 active:bg-red-500/20 transition-colors">
                      מחק פוסט <Trash2 size={20} />
                    </button>
                  </>
                )}
              </motion.div>
            </div>
          )}

          {showCreatePost && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative z-10 bg-white rounded-t-[36px] p-6 flex flex-col gap-4 pb-12 shadow-[0_-10px_50px_rgba(0,0,0,0.1)]">
                <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-black/15 rounded-full"/></div>
                <div className="flex justify-between items-center mb-2"><h3 className="text-black font-black text-lg">{editingPost ? 'עריכה' : 'חדש'}</h3><button onClick={closeOverlay} className="text-black/40"><X size={20} /></button></div>
                <textarea value={newPost} onChange={e => setNewPost(e.target.value)} placeholder="כתוב משהו..." className="h-32 bg-black/5 rounded-2xl p-4 text-black outline-none resize-none border border-black/10 placeholder:text-black/40" onPointerDown={stopPropagation} onTouchStart={stopPropagation} />
                {!editingPost && ( <div onClick={() => fileInputRef.current?.click()} className="p-4 bg-black/5 rounded-2xl border-2 border-dashed border-black/20 text-center text-black/50 cursor-pointer"><input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />{selectedFile ? selectedFile.name : 'צרף מדיה (תמונה/וידאו)'}</div> )}
                <Button onClick={handlePost} disabled={posting || (!newPost.trim() && !selectedFile && !editingPost)} className="h-14 bg-[#2196f3] text-white font-black rounded-2xl mt-2 shadow-md">{posting ? <Loader2 className="animate-spin"/> : 'שמור עריכה'}</Button>
              </motion.div>
            </div>
          )}

          {activeDescPost && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative z-10 bg-white rounded-t-[36px] flex flex-col overflow-hidden pb-10 max-h-[75vh] shadow-[0_-10px_50px_rgba(0,0,0,0.1)]">
                <div className="w-full py-6 flex justify-center cursor-grab active:cursor-grabbing border-b border-black/5"><div className="w-16 h-1.5 bg-black/15 rounded-full"/></div>
                <div className="px-6 py-4 border-b border-black/5"><h2 className="text-black font-black text-lg">תיאור מלא</h2></div>
                <div className="p-6 overflow-y-auto" onPointerDown={stopPropagation} onTouchStart={stopPropagation}><p className="text-black/80 text-[15px] leading-relaxed text-right whitespace-pre-wrap">{activeDescPost.content}</p></div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
