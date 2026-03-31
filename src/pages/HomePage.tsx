import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { 
  Loader2, Bell, Users, Lock, Flame, Heart, MessageSquare, 
  Send, X, Paperclip, RefreshCw, UserCircle, Trash2, Edit2, Share2, MoreVertical
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
  
  const [mounted, setMounted] = useState(false);
  const [circles, setCircles] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newPost, setNewPost] = useState('');
  const [newPostMedia, setNewPostMedia] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  
  const [activePost, setActivePost] = useState<any>(null); 
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  
  const [optionsMenuPost, setOptionsMenuPost] = useState<any>(null);
  const [activeDescPost, setActiveDescPost] = useState<any>(null);

  const [fullScreenVideos, setFullScreenVideos] = useState<any[] | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const scrollTimeout = useRef<any>(null);

  const [onlineUsers, setOnlineUsers] = useState(3420);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pullStartY = useRef(0);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const stateRef = useRef({ comments: false, options: false, desc: false, create: false, fullscreen: false });
  stateRef.current = {
    comments: !!activeCommentsPostId,
    options: !!optionsMenuPost,
    desc: !!activeDescPost,
    create: showCreatePost,
    fullscreen: !!fullScreenVideos
  };

  useEffect(() => {
    const handlePopState = () => {
      const s = stateRef.current;
      if (s.comments) { setActiveCommentsPostId(null); setActivePost(null); }
      else if (s.options) { setOptionsMenuPost(null); }
      else if (s.desc) { setActiveDescPost(null); }
      else if (s.create) { setShowCreatePost(false); setEditingPost(null); }
      else if (s.fullscreen) { setFullScreenVideos(null); }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openOverlay = (action: () => void) => {
    window.history.pushState({ overlay: true }, ''); 
    action();
  };

  const closeOverlay = () => {
    window.history.back(); 
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

      const [rawPosts, rawCircles, rawMembers, rawProfiles, rawLikes, rawComments] = await Promise.all([
        supabase.from('posts').select('*').order('created_at', { ascending: false }).then(r => r.data || []),
        supabase.from('circles').select('*').then(r => r.data || []),
        supabase.from('circle_members').select('*').then(r => r.data || []),
        supabase.from('profiles').select('*').then(r => r.data || []),
        supabase.from('likes').select('*').then(r => r.data || []),
        supabase.from('comments').select('*').then(r => r.data || [])
      ]);

      const globalPosts = rawPosts.filter((p: any) => !p.circle_id);
      const fetchedPosts = globalPosts.map((p: any) => {
        const prof = rawProfiles.find((pr: any) => pr.id === p.user_id) || {};
        const pLikes = rawLikes.filter((l: any) => l.post_id === p.id);
        const pComments = rawComments.filter((c: any) => c.post_id === p.id);
        return { ...p, profiles: prof, likes_count: pLikes.length, comments_count: pComments.length, is_liked: !!uid && pLikes.some((l: any) => l.user_id === uid) };
      });

      const fetchedCircles = rawCircles.map((c: any) => ({ ...c, is_member: !!uid && rawMembers.some((m: any) => m.circle_id === c.id && m.user_id === uid) })).sort((a: any, b: any) => (b.members_count || 0) - (a.members_count || 0));

      setCircles(fetchedCircles);
      setPosts(fetchedPosts);
    } catch (err) {} finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    setMounted(true);
    fetchData(false);
    checkUnreadNotifications();
    const interval = setInterval(() => setOnlineUsers(prev => prev + Math.floor(Math.random() * 5) - 2), 5000);
    const channel = supabase.channel('global_feed').on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchData(true)).subscribe();
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!fullScreenVideos) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const vid = entry.target as HTMLVideoElement;
        if (entry.isIntersecting) {
          vid.muted = false;
          const playPromise = vid.play();
          if (playPromise !== undefined) playPromise.catch(() => {});
        } else {
          vid.pause();
          vid.muted = true;
          vid.currentTime = 0;
        }
      });
    }, { threshold: 0.6 });

    const videos = document.querySelectorAll('.reels-video');
    videos.forEach(v => observer.observe(v));
    return () => observer.disconnect();
  }, [fullScreenVideos, currentVideoIndex]);

  const handleTouchStart = (e: React.TouchEvent) => { if (window.scrollY <= 0) pullStartY.current = e.touches[0].clientY; };
  const handleTouchMove = (e: React.TouchEvent) => { if (pullStartY.current > 0 && window.scrollY <= 0) { const y = e.touches[0].clientY - pullStartY.current; if (y > 0) setPullY(Math.min(y, 120)); } };
  const handleTouchEnd = async () => { if (pullY > 60) { setRefreshing(true); setPullY(0); triggerFeedback('coin'); await fetchData(true); await checkUnreadNotifications(); } else { setPullY(0); } pullStartY.current = 0; };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) setSelectedFile(file);
    else if (file) toast.error('אנא בחר קובץ תמונה או וידאו תקין');
  };

  const handlePost = async () => {
    if (!newPost.trim() && !selectedFile && !editingPost) return;
    setPosting(true);
    try {
      const uid = currentUserId;
      if (editingPost) {
        await supabase.from('posts').update({ content: newPost.trim() }).eq('id', editingPost.id);
        setPosts(curr => curr.map(p => p.id === editingPost.id ? { ...p, content: newPost.trim() } : p));
        toast.success('עודכן'); closeOverlay();
      } else {
        let media_url = null; let media_type = 'text';
        if (selectedFile) {
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
          const { data } = await supabase.storage.from('feed_images').upload(fileName, selectedFile);
          media_url = supabase.storage.from('feed_images').getPublicUrl(data!.path).data.publicUrl;
          media_type = selectedFile.type.startsWith('video/') ? 'video' : 'image';
        }
        await supabase.from('posts').insert({ user_id: uid, content: newPost.trim(), media_url, media_type, circle_id: null });
        closeOverlay();
      }
      setNewPost(''); setSelectedFile(null); setEditingPost(null); if (!editingPost) fetchData(true);
    } catch (err: any) { toast.error('שגיאה בשמירה'); } finally { setPosting(false); }
  };

  const handleShare = async (post: any) => {
    triggerFeedback('pop');
    const url = `${window.location.origin}/#/`;
    const textToShare = `${post.content ? post.content + '\n\n' : ''}צפה בפוסט הזה ב-INNER!`;

    try {
      const isNativeApp = typeof window !== 'undefined' && !!(window as any).Capacitor && (window as any).Capacitor.isNativePlatform?.();
      if (isNativeApp) {
        await Share.share({ title: 'INNER - רשת חברתית', text: textToShare, url, dialogTitle: 'שתף עם חברים' });
        return;
      }
      if (navigator.share && window.isSecureContext) {
        await navigator.share({ title: 'INNER - רשת חברתית', text: textToShare, url });
        return;
      }
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(`${textToShare}\n${url}`);
        toast.success('הקישור הועתק ללוח', { icon: '🔗' });
        return;
      }
      const textArea = document.createElement('textarea');
      textArea.value = `${textToShare}\n${url}`;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success('הקישור הועתק ללוח', { icon: '🔗' });
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      toast.error('לא הצלחתי לפתוח את תפריט השיתוף');
    }
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    triggerFeedback('pop');
    setPosts(curr => curr.map(p => p.id === postId ? { ...p, is_liked: !isLiked, likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1 } : p));
    if (fullScreenVideos) setFullScreenVideos(curr => (curr||[]).map(p => p.id === postId ? { ...p, is_liked: !isLiked, likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1 } : p));
    try { 
      if (isLiked) await supabase.from('likes').delete().match({ post_id: postId, user_id: currentUserId });
      else await supabase.from('likes').insert({ post_id: postId, user_id: currentUserId });
    } catch (err) {}
  };

  const submitComment = async () => {
    if (!newComment.trim() || !activePost || !currentUserId) return;
    try {
      const { data } = await supabase.from('comments').insert({ post_id: activePost.id, user_id: currentUserId, content: newComment.trim(), parent_id: replyingTo ? replyingTo.id : null }).select('*, profiles(*)').single();
      setComments(prev => [...prev, data]); setNewComment('');
      setPosts(curr => curr.map(p => p.id === activePost.id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p));
      if (fullScreenVideos) setFullScreenVideos(curr => (curr||[]).map(p => p.id === activePost.id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p));
      triggerFeedback('coin');
    } catch (err) {}
  };

  const deletePost = async (postId: string) => {
    triggerFeedback('error');
    closeOverlay();
    setPosts(curr => curr.filter(p => p.id !== postId));
    if (fullScreenVideos) setFullScreenVideos(curr => (curr||[]).filter(p => p.id !== postId));
    try { await supabase.from('posts').delete().eq('id', postId); toast.success('הפוסט נמחק'); } catch (err) { toast.error('שגיאה במחיקה'); }
  };

  const deleteComment = async (commentId: string) => {
    triggerFeedback('error');
    setComments(curr => curr.filter(c => c.id !== commentId));
    try { await supabase.from('comments').delete().eq('id', commentId); } catch (err) {}
  };

  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (scrollTimeout.current) return;
    scrollTimeout.current = setTimeout(() => {
      scrollTimeout.current = null;
      const index = Math.round(target.scrollTop / target.clientHeight);
      if (index !== currentVideoIndex) setCurrentVideoIndex(index);
      if (target.scrollHeight - target.scrollTop <= target.clientHeight * 2) {
        const vids = posts.filter(p => p.media_type === 'video' || (p.media_url && p.media_url.match(/\.(mp4|webm|mov)$/i)));
        setFullScreenVideos(prev => [...(prev || []), ...[...vids].sort(()=>Math.random()-0.5).slice(0,3)]);
      }
    }, 150);
  };

  if (loading && posts.length === 0) return <div className="min-h-screen bg-[#030303] flex items-center justify-center"><Loader2 className="animate-spin text-white/30" /></div>;

  return (
    <>
      <FadeIn className="px-0 pt-8 pb-32 bg-[#030303] min-h-screen relative overflow-x-hidden touch-pan-y" dir="rtl" onTouchStart={e => { if (window.scrollY <= 0) pullStartY.current = e.touches[0].clientY; }} onTouchMove={e => { if (pullStartY.current > 0 && window.scrollY <= 0) { const y = e.touches[0].clientY - pullStartY.current; if (y > 0) setPullY(Math.min(y, 120)); } }} onTouchEnd={() => { if (pullY > 60) { setRefreshing(true); setPullY(0); fetchData(true); } else setPullY(0); pullStartY.current = 0; }}>
        
        <div className="fixed top-0 left-0 right-0 flex justify-center z-50 pointer-events-none transition-transform duration-200" style={{ transform: `translateY(${Math.max(pullY - 40, -40)}px)`, opacity: pullY / 60 }}>
          <div className="bg-[#111] p-2.5 rounded-full shadow-2xl border border-white/10 mt-6 backdrop-blur-xl"><RefreshCw size={22} className={`text-white ${refreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pullY * 2}deg)` }} /></div>
        </div>

        <div className="relative z-10 px-4">
          <div className="flex justify-between items-start mb-8 h-12 px-1">
            <div className="w-10"></div>
            <div className="absolute left-1/2 -translate-x-1/2 text-center">
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase">INNER</h1>
              <div className="flex items-center gap-1.5 mt-1 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                <span className="w-1.5 h-1.5 bg-[#8bc34a] rounded-full animate-pulse"></span>
                <span className="text-[10px] font-black text-white/80">{onlineUsers.toLocaleString()}</span>
              </div>
            </div>
            <button onClick={() => navigate('/notifications')} className="w-10 h-10 flex justify-center items-center bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-full shadow-lg active:scale-90 transition-transform relative">
              <Bell size={18} className="text-[#3f51b5]" />
              {unreadCount > 0 && <span className="absolute top-2 right-2.5 w-2 h-2 bg-[#e91e63] rounded-full border border-black animate-pulse"></span>}
            </button>
          </div>

          <div className="mb-8">
            <h3 className="text-white/40 text-[11px] font-black uppercase tracking-[0.2em] mb-4 px-2 flex items-center gap-1.5"><Flame size={14} className="text-[#f44336]" /> מועדונים</h3>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-4">
              {circles.map(circle => (
                <motion.div key={circle.id} whileTap={{ scale: 0.95 }} className="shrink-0 w-44">
                  <div onClick={() => navigate(`/circle/${circle.slug || circle.id}`)} className="p-1.5 rounded-[32px] overflow-hidden relative border border-white/10 cursor-pointer bg-white/[0.04] backdrop-blur-xl shadow-2xl h-52 flex flex-col justify-end">
                    <div className="absolute inset-0 z-0 rounded-[28px] overflow-hidden m-1.5">
                      <div className={`absolute inset-0 bg-black/40 z-10 ${circle.is_member ? 'opacity-0' : 'opacity-100'}`}></div>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/50 to-transparent z-10"></div>
                      {circle.cover_url ? <img src={circle.cover_url} className={`w-full h-full object-cover ${circle.is_member ? 'blur-none' : 'blur-[3px]'}`} /> : <div className="w-full h-full flex items-center justify-center bg-[#111]"><Users size={24} className="text-white/20" /></div>}
                    </div>
                    {!circle.is_member && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-lg"><Lock size={14} className="text-white/80" /></div>}
                    <div className="relative z-20 p-4"><h2 className="text-white font-black text-[15px] line-clamp-1">{circle.name}</h2></div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-[36px] mb-8 border border-white/10 bg-white/[0.04] backdrop-blur-3xl shadow-2xl relative z-10 cursor-pointer" onClick={() => openOverlay(() => setShowCreatePost(true))}>
            <div className="w-full bg-transparent border-none text-white/40 text-[16px] font-medium h-14 flex items-center px-1">שדר משהו לכולם...</div>
            <div className="flex justify-end items-center gap-4 border-t border-white/10 pt-4 mt-1 px-1">
              <div className="w-12 h-12 flex items-center justify-center text-white/40 rounded-full border border-white/10 shadow-inner"><Paperclip size={20} /></div>
              <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.2)]"><Send size={20} className="rtl:-scale-x-100 -ml-1 text-[#2196f3]" /></div>
            </div>
          </div>
        </div>

        {/* POSTS FEED */}
        <div className="flex flex-col gap-6 relative z-10 px-4">
          {posts.map((post) => {
            const isMyPost = post.user_id === currentUserId;
            const isVideo = post.media_type === 'video' || (post.media_url && post.media_url.match(/\.(mp4|webm|mov)$/i));
            
            return (
              <div key={post.id} className="flex flex-col rounded-[36px] bg-[#0A0A0A] border border-white/10 relative overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                {post.media_url && (
                  <div className={`w-full bg-[#050505] relative ${isVideo ? 'cursor-pointer' : ''}`} onClick={() => isVideo ? openOverlay(() => { const vids = posts.filter(p => p.media_url?.match(/\.(mp4|webm|mov)$/i)); setFullScreenVideos([post, ...vids.filter(v => v.id !== post.id).sort(()=>Math.random()-0.5)]); setCurrentVideoIndex(0); }) : null}>
                    {isVideo ? <video src={post.media_url} autoPlay loop muted playsInline className="w-full max-h-[500px] object-cover border-b border-white/5" /> : <img src={post.media_url} className="w-full max-h-[500px] object-cover border-b border-white/5" />}
                    {post.content && (
                      <div className="absolute bottom-0 left-0 right-0 p-5 pt-16 bg-gradient-to-t from-[#0A0A0A] via-black/60 to-transparent flex items-end pointer-events-none">
                        <p onClick={(e) => { e.stopPropagation(); openOverlay(() => setActiveDescPost(post)); }} className="text-white/90 text-sm leading-relaxed text-right line-clamp-2 w-full pr-2 pointer-events-auto cursor-pointer active:opacity-50">{post.content}</p>
                      </div>
                    )}
                  </div>
                )}
                {!post.media_url && post.content && (
                  <div className="p-6 pb-4 border-b border-white/5"><p onClick={() => openOverlay(() => setActiveDescPost(post))} className="text-white/90 text-[15px] leading-relaxed text-right line-clamp-3 cursor-pointer active:opacity-50">{post.content}</p></div>
                )}
                <div className="flex items-center justify-between px-5 py-4 bg-[#0A0A0A]">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/profile/${post.user_id}`)}>
                    <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden shrink-0 shadow-inner">
                      {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full p-2 text-white/20" />}
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-white font-black text-sm">{post.profiles?.full_name || 'אנונימי'}</span>
                      <span className="text-white/30 text-[10px]">{new Date(post.created_at).toLocaleDateString('he-IL')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 flex-row-reverse">
                    {isMyPost && <button onClick={() => openOverlay(() => setOptionsMenuPost(post))} className="text-white/30 hover:text-white active:scale-90 border-r border-white/10 pr-4"><MoreVertical size={18} /></button>}
                    <button onClick={() => openOverlay(() => { setActivePost(post); setActiveCommentsPostId(post.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at',{ascending:true}).then(r => {setComments(r.data||[]); setLoadingComments(false);}); })} className="flex items-center gap-1.5 text-white/30 hover:text-[#2196f3] active:scale-90"><MessageSquare size={18} /><span className="text-[12px] font-black">{post.comments_count}</span></button>
                    <button onClick={() => handleLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 active:scale-90 ${post.is_liked ? 'text-[#e91e63]' : 'text-white/30'}`}><Heart size={18} fill={post.is_liked ? "currentColor" : "none"} /><span className="text-[12px] font-black">{post.likes_count}</span></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </FadeIn>

      {/* PORTALS (Z-999999) */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {fullScreenVideos && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999999] bg-black">
              <div className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide" onScroll={handleContainerScroll}>
                {fullScreenVideos.map((vid, idx) => (
                  <div key={vid.id + idx} className="w-full h-screen snap-center relative bg-black flex items-center justify-center">
                    <video src={vid.media_url} loop playsInline className="w-full h-full object-cover reels-video" onClick={(e) => e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause()} />
                    <div className="absolute bottom-32 left-4 flex flex-col gap-6 items-center">
                      <button onClick={() => handleLike(vid.id, vid.is_liked)} className="flex flex-col items-center gap-1">
                        <Heart size={32} className={`${vid.is_liked ? 'text-[#e91e63]' : 'text-white'} drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]`} fill={vid.is_liked ? 'currentColor' : 'none'} strokeWidth={1.5} />
                        <span className="text-white text-xs font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{vid.likes_count}</span>
                      </button>
                      <button onClick={() => openOverlay(() => { setActivePost(vid); setActiveCommentsPostId(vid.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', vid.id).order('created_at',{ascending:true}).then(r => {setComments(r.data||[]); setLoadingComments(false);}); })} className="flex flex-col items-center gap-1">
                        <MessageSquare size={32} className="text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]" strokeWidth={1.5} />
                        <span className="text-white text-xs font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{vid.comments_count}</span>
                      </button>
                      <button onClick={() => handleShare(vid)} className="flex flex-col items-center gap-1">
                        <Share2 size={32} className="text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]" strokeWidth={1.5} />
                        <span className="text-white text-xs font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">שתף</span>
                      </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end">
                      <div className="flex items-center gap-3 mb-2 cursor-pointer w-fit pr-2" onClick={() => { closeOverlay(); navigate(`/profile/${vid.user_id}`); }}>
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-black border-2 border-white/20 shrink-0">
                          {vid.profiles?.avatar_url ? <img src={vid.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full p-2 text-white/20" />}
                        </div>
                        <span className="text-white font-black text-[17px] drop-shadow-md">{vid.profiles?.full_name || 'אנונימי'}</span>
                      </div>
                      <p className="text-white/90 text-[15px] font-medium drop-shadow-md line-clamp-3 text-right pr-2 w-5/6">{vid.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeCommentsPostId && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragControls={commentsDragControls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, { offset }) => offset.y > 100 && closeOverlay()} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25 }} className="bg-[#0A0A0A] rounded-t-[36px] h-[80vh] flex flex-col relative overflow-hidden pb-10">
                <div className="w-full py-4 flex justify-center cursor-grab" onPointerDown={e => commentsDragControls.start(e)}><div className="w-12 h-1.5 bg-white/20 rounded-full"/></div>
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                  {loadingComments ? <Loader2 className="animate-spin mx-auto text-white/20" /> : comments.map(c => (
                    <div key={c.id} className="flex gap-3">
                      <div className="w-10 h-10 rounded-[16px] bg-white/10 shrink-0 cursor-pointer overflow-hidden" onClick={() => { closeOverlay(); navigate(`/profile/${c.user_id}`); }}>
                        {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full p-2 text-white/20" />}
                      </div>
                      <div className="flex flex-col bg-white/5 p-3 rounded-2xl flex-1 rounded-tr-sm">
                        <span className="text-white font-bold text-xs mb-1 cursor-pointer" onClick={() => { closeOverlay(); navigate(`/profile/${c.user_id}`); }}>{c.profiles?.full_name || 'אנונימי'}</span>
                        <p className="text-white/80 text-sm">{c.content}</p>
                        {c.user_id === currentUserId && <button onClick={() => deleteComment(c.id)} className="text-red-500 text-[10px] mt-2 font-bold w-fit">מחק</button>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-white/5 flex gap-2">
                  <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="הוסף תגובה..." className="flex-1 bg-white/5 rounded-full px-4 text-white outline-none" />
                  <button onClick={submitComment} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black active:scale-95"><Send size={18} /></button>
                </div>
              </motion.div>
            </div>
          )}

          {optionsMenuPost && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragControls={optionsDragControls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, { offset }) => offset.y > 100 && closeOverlay()} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25 }} className="bg-[#0A0A0A] rounded-t-[36px] flex flex-col relative overflow-hidden pb-10">
                <div className="w-full py-4 flex justify-center cursor-grab" onPointerDown={e => optionsDragControls.start(e)}><div className="w-12 h-1.5 bg-white/20 rounded-full"/></div>
                <div className="flex flex-col p-6 gap-3">
                  <button onClick={() => { closeOverlay(); setTimeout(() => handleShare(optionsMenuPost), 100); }} className="w-full p-4 bg-white/5 rounded-2xl text-white font-bold flex justify-between items-center text-lg">שתף פוסט <Share2 size={20} className="text-[#2196f3]" /></button>
                  <button onClick={() => { closeOverlay(); setTimeout(() => openOverlay(() => { setEditingPost(optionsMenuPost); setNewPost(optionsMenuPost.content || ''); setShowCreatePost(true); }), 100); }} className="w-full p-4 bg-white/5 rounded-2xl text-white font-bold flex justify-between items-center text-lg">ערוך <Edit2 size={20} className="text-white/50" /></button>
                  <button onClick={() => deletePost(optionsMenuPost.id)} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 font-bold flex justify-between items-center text-lg mt-2">מחק <Trash2 size={20} /></button>
                </div>
              </motion.div>
            </div>
          )}

          {showCreatePost && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragControls={createPostDragControls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, { offset }) => offset.y > 100 && closeOverlay()} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25 }} className="bg-[#0A0A0A] rounded-t-[36px] p-6 flex flex-col gap-4 pb-12">
                <div className="w-full py-2 flex justify-center cursor-grab mb-2" onPointerDown={e => createPostDragControls.start(e)}><div className="w-12 h-1.5 bg-white/20 rounded-full"/></div>
                <div className="flex justify-between items-center mb-2"><h3 className="text-white font-black text-lg">{editingPost ? 'עריכת פוסט' : 'שידור חדש'}</h3><button onClick={closeOverlay} className="text-white/40"><X size={20} /></button></div>
                <textarea value={newPost} onChange={e => setNewPost(e.target.value)} placeholder="כתוב משהו..." className="h-32 bg-white/5 rounded-2xl p-4 text-white outline-none resize-none border border-white/10" />
                {!editingPost && (
                  <div onClick={() => fileInputRef.current?.click()} className="p-4 bg-white/5 rounded-2xl border-2 border-dashed border-white/10 text-center text-white/40 cursor-pointer">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />
                    {selectedFile ? selectedFile.name : 'צרף מדיה (תמונה/וידאו)'}
                  </div>
                )}
                <Button onClick={handlePost} disabled={posting || (!newPost.trim() && !selectedFile && !editingPost)} className="h-14 bg-[#2196f3] text-white font-black rounded-2xl mt-2">{posting ? <Loader2 className="animate-spin"/> : 'פרסם'}</Button>
              </motion.div>
            </div>
          )}

          {activeDescPost && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragControls={descDragControls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, { offset }) => offset.y > 100 && closeOverlay()} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25 }} className="bg-[#0A0A0A] rounded-t-[36px] flex flex-col overflow-hidden pb-10">
                <div className="w-full py-4 flex justify-center cursor-grab" onPointerDown={e => descDragControls.start(e)}><div className="w-12 h-1.5 bg-white/20 rounded-full"/></div>
                <div className="px-6 pb-4 border-b border-white/10"><h2 className="text-white font-black">תיאור מלא</h2></div>
                <div className="p-6 max-h-[60vh] overflow-y-auto"><p className="text-white/90 text-[15px] leading-relaxed text-right whitespace-pre-wrap">{activeDescPost.content}</p></div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
