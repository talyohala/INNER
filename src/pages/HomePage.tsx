import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { 
  Loader2, Bell, Users, Lock, Flame, Heart, MessageSquare, 
  Send, X, Paperclip, RefreshCw, UserCircle, Trash2, Edit2, Reply, MoreVertical
} from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

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
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  
  // Modals States
  const [activePost, setActivePost] = useState<any>(null); 
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  
  const [optionsMenuPost, setOptionsMenuPost] = useState<any>(null);
  const [activeDescPost, setActiveDescPost] = useState<any>(null);

  const [fullScreenVideos, setFullScreenVideos] = useState<any[] | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  const [onlineUsers, setOnlineUsers] = useState(3420);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pullStartY = useRef(0);
  const [currentUserId, setCurrentUserId] = useState<string>('');

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
        supabase.from('posts').select('*').order('created_at', { ascending: false }).then(r => r.data || []).catch(() => []),
        supabase.from('circles').select('*').then(r => r.data || []).catch(() => []),
        supabase.from('circle_members').select('*').then(r => r.data || []).catch(() => []),
        supabase.from('profiles').select('*').then(r => r.data || []).catch(() => []),
        supabase.from('likes').select('*').then(r => r.data || []).catch(() => []),
        supabase.from('comments').select('*').then(r => r.data || []).catch(() => [])
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
    } catch (err) { console.error(err); } finally { setLoading(false); setRefreshing(false); }
  };

  // מנגנון כפתור חזור של אנדרואיד / דפדפן
  useEffect(() => {
    const handlePopState = () => {
      // אם משהו מהחלונות פתוח, כפתור חזור פשוט יסגור אותו ולא יעזוב את העמוד
      setFullScreenVideos(null);
      setActiveCommentsPostId(null);
      setActivePost(null);
      setOptionsMenuPost(null);
      setActiveDescPost(null);
      setShowCreatePost(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openModal = (action: () => void) => {
    window.history.pushState({ modalOpen: true }, ''); // רושמים בהיסטוריה שנפתח חלון
    action();
  };

  const closeModal = () => {
    window.history.back(); // מפעיל את ה-popstate וסוגר את החלון בצורה טבעית
  };

  useEffect(() => {
    setMounted(true);
    fetchData(false);
    checkUnreadNotifications();
    const interval = setInterval(() => setOnlineUsers(prev => prev + Math.floor(Math.random() * 5) - 2), 5000);
    const channel = supabase.channel('global_feed').on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchData(true)).subscribe();
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, []);

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
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error('משתמש לא מחובר.');
      
      if (editingPost) {
        const { error } = await supabase.from('posts').update({ content: newPost.trim() }).eq('id', editingPost.id);
        if (error) throw error;
        setPosts(curr => curr.map(p => p.id === editingPost.id ? { ...p, content: newPost.trim() } : p));
        toast.success('הפוסט עודכן בהצלחה');
        closeModal(); // סוגר את חלון העריכה במידה ופתוח
      } else {
        let media_url = null;
        let media_type = 'text';

        if (selectedFile) {
          setUploadingImage(true);
          const fileExt = selectedFile.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { data: uploadData, error: uploadError } = await supabase.storage.from('feed_images').upload(fileName, selectedFile);
          if (uploadError) throw new Error(`שגיאת אחסון: ${uploadError.message}`);
          media_url = supabase.storage.from('feed_images').getPublicUrl(uploadData.path).data.publicUrl;
          media_type = selectedFile.type.startsWith('video/') ? 'video' : 'image';
          setUploadingImage(false);
        }
        
        const { error } = await supabase.from('posts').insert({ user_id: authData.user.id, content: newPost.trim() || null, media_url, media_type, circle_id: null });
        if (error) throw error;
        
        closeModal(); // סוגר את הבוטום שיט של היצירה
      }
      
      setNewPost(''); setSelectedFile(null); setEditingPost(null); triggerFeedback('pop'); 
      if (!editingPost) fetchData(true);
    } catch (err: any) { 
      setUploadingImage(false); toast.error(err.message || 'שגיאה בשמירה'); 
    } finally { setPosting(false); }
  };

  const startEditingPost = (post: any) => {
    triggerFeedback('pop');
    closeModal(); // סוגר את תפריט 3 הנקודות
    setTimeout(() => {
      openModal(() => {
        setEditingPost(post);
        setNewPost(post.content || '');
        setShowCreatePost(true); // פותח את חלון היצירה לעריכה
      });
    }, 100);
  };

  const deletePost = async (postId: string) => {
    triggerFeedback('error');
    closeModal();
    setPosts(posts.filter(p => p.id !== postId));
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) toast.error('שגיאה במחיקה');
    else toast.success('הפוסט נמחק');
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    if (!currentUserId) return;
    triggerFeedback('pop');
    setPosts(curr => curr.map(p => p.id === postId ? { ...p, is_liked: !isLiked, likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1 } : p));
    if (fullScreenVideos) setFullScreenVideos(curr => (curr||[]).map(p => p.id === postId ? { ...p, is_liked: !isLiked, likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1 } : p));
    
    try { 
      if (isLiked) await supabase.from('likes').delete().match({ post_id: postId, user_id: currentUserId });
      else await supabase.from('likes').insert({ post_id: postId, user_id: currentUserId });
    } catch (err) { fetchData(true); }
  };

  const openComments = async (post: any) => {
    triggerFeedback('pop'); 
    openModal(() => {
      setActivePost(post); setActiveCommentsPostId(post.id); setLoadingComments(true);
    });
    try {
      const { data } = await supabase.from('comments').select(`*, profiles(*)`).eq('post_id', post.id).order('created_at', { ascending: true });
      setComments(data || []);
    } catch (err) { toast.error('שגיאה בטעינת תגובות'); setComments([]); } finally { setLoadingComments(false); }
  };

  const submitComment = async () => {
    if (!newComment.trim() || !activePost || !currentUserId) return;
    try {
      const { data, error } = await supabase.from('comments').insert({ post_id: activePost.id, user_id: currentUserId, content: newComment.trim(), parent_id: replyingTo ? replyingTo.id : null }).select('*, profiles(*)').single();
      if (error) throw error;
      setComments(prev => [...prev, data]); setNewComment(''); setReplyingTo(null);
      setPosts(curr => curr.map(p => p.id === activePost.id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p)); triggerFeedback('coin');
    } catch (err) { toast.error('שגיאה בשליחת תגובה'); }
  };

  const deleteComment = async (commentId: string) => {
    triggerFeedback('error');
    setComments(comments.filter(c => c.id !== commentId && c.parent_id !== commentId));
    await supabase.from('comments').delete().eq('id', commentId);
  };

  const goToProfile = (userId: string | undefined) => {
    if (!userId) return;
    triggerFeedback('pop'); navigate(`/profile/${userId}`);
  };

  const openVideoFullscreen = (clickedPost: any) => {
    triggerFeedback('pop');
    openModal(() => {
      const allVideos = posts.filter(p => p.media_type === 'video' || (p.media_url && p.media_url.match(/\.(mp4|webm|mov)$/i)));
      const otherVideos = allVideos.filter(p => p.id !== clickedPost.id).sort(() => Math.random() - 0.5);
      setFullScreenVideos([clickedPost, ...otherVideos]);
      setCurrentVideoIndex(0);
    });
  };

  const handleVideoScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const index = Math.round(target.scrollTop / target.clientHeight);
    if (index !== currentVideoIndex) {
      setCurrentVideoIndex(index);
      triggerFeedback('pop');
    }
  };

  if (loading && posts.length === 0 && circles.length === 0) return <div className="min-h-screen bg-[#030303] flex items-center justify-center text-white/20 font-black animate-pulse text-xl tracking-widest uppercase">SCANNING...</div>;

  return (
    <>
      <FadeIn className="px-0 pt-8 pb-32 bg-[#030303] min-h-screen relative overflow-x-hidden touch-pan-y" dir="rtl" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        
        <div className="fixed top-0 left-0 right-0 flex justify-center z-50 pointer-events-none transition-transform duration-200" style={{ transform: `translateY(${Math.max(pullY - 40, -40)}px)`, opacity: pullY / 60 }}>
          <div className="bg-[#111] p-2.5 rounded-full shadow-2xl border border-white/10 mt-6 backdrop-blur-xl">
            <RefreshCw size={22} className={`text-white ${refreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pullY * 2}deg)` }} />
          </div>
        </div>

        {/* האדר עליון */}
        <div className="relative z-10 px-4">
          <div className="flex justify-between items-start mb-8 h-12 px-1">
            <div className="w-10"></div>
            <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2">
              <motion.h1 animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 4 }} className="text-3xl font-black text-white tracking-tighter uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">INNER</motion.h1>
              <div className="flex items-center gap-1.5 mt-1 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10 backdrop-blur-md shadow-inner">
                <span className="w-1.5 h-1.5 bg-[#8bc34a] rounded-full shadow-[0_0_8px_#8bc34a] animate-pulse"></span>
                <span className="text-[10px] font-black text-white/80 tracking-widest">{onlineUsers.toLocaleString()}</span>
              </div>
            </div>
            <button onClick={() => navigate('/notifications')} className="w-10 h-10 flex justify-center items-center bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-full shadow-lg active:scale-90 transition-transform relative">
              <Bell size={18} className="text-[#3f51b5] drop-shadow-[0_0_8px_rgba(63,81,181,0.5)]" />
              {unreadCount > 0 && <span className="absolute top-2 right-2.5 w-2 h-2 bg-[#e91e63] rounded-full shadow-[0_0_10px_#e91e63] border border-black animate-pulse"></span>}
            </button>
          </div>

          <div className="mb-8">
            <h3 className="text-white/40 text-[11px] font-black uppercase tracking-[0.2em] mb-4 px-2 flex items-center gap-1.5 drop-shadow-md">
              <Flame size={14} className="text-[#f44336]" /> מועדונים חמים
            </h3>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-4">
              {circles.map(circle => {
                const activeNow = Math.max(1, Math.ceil((circle.members_count || 1) * 0.15 + (Math.random() * 3)));
                return (
                  <motion.div key={circle.id} whileTap={{ scale: 0.95 }} className="shrink-0 w-44">
                    <div onClick={() => navigate(`/circle/${circle.slug || circle.id}`)} className="p-1.5 rounded-[32px] overflow-hidden relative border border-white/10 cursor-pointer bg-white/[0.04] backdrop-blur-xl shadow-2xl h-52 flex flex-col justify-end">
                      <div className="absolute inset-0 z-0 rounded-[28px] overflow-hidden m-1.5">
                        <div className={`absolute inset-0 bg-black/40 z-10 ${circle.is_member ? 'opacity-0' : 'opacity-100'}`}></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/50 to-transparent z-10"></div>
                        {circle.cover_url ? <img src={circle.cover_url} className={`w-full h-full object-cover ${circle.is_member ? 'blur-none' : 'blur-[3px]'}`} /> : <div className="w-full h-full flex items-center justify-center bg-[#111]"><Users size={24} className="text-white/20" /></div>}
                      </div>
                      {!circle.is_member && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-lg"><Lock size={14} className="text-white/80" /></div>}
                      <div className="relative z-20 p-4"><h2 className="text-white font-black text-[15px] drop-shadow-lg line-clamp-1">{circle.name}</h2></div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="p-5 rounded-[36px] mb-8 border border-white/10 bg-white/[0.04] backdrop-blur-3xl shadow-2xl relative z-10 transition-colors cursor-pointer" onClick={() => openModal(() => setShowCreatePost(true))}>
            <div className="w-full bg-transparent border-none text-white/40 text-[16px] font-medium h-14 flex items-center px-1">שדר משהו לכולם...</div>
            <div className="flex justify-end items-center gap-4 border-t border-white/10 pt-4 mt-1 px-1">
              <div className="w-12 h-12 flex items-center justify-center text-white/40 rounded-full border border-white/10 shadow-inner">
                <Paperclip size={20} />
              </div>
              <div className="w-12 h-12 p-0 rounded-full bg-white text-black flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                <Send size={20} className="rtl:-scale-x-100 -ml-1 text-[#2196f3]" />
              </div>
            </div>
          </div>
        </div>

        {/* פיד הפוסטים */}
        <div className="flex flex-col gap-6 relative z-10 px-4">
          {posts.length === 0 ? (
             <div className="text-center p-10 bg-white/5 border border-white/10 rounded-[24px] text-white/50 text-sm font-black shadow-inner">
                אין פוסטים בפיד. היה הראשון לשדר!
             </div>
          ) : (
            posts.map((post) => {
              const targetId = post.user_id || post.profiles?.id;
              const isMyPost = post.user_id === currentUserId;
              const isVideo = post.media_type === 'video' || (post.media_url && post.media_url.match(/\.(mp4|webm|mov)$/i));
              
              return (
                <div key={post.id} className="flex flex-col pt-0 pb-0 rounded-[36px] bg-[#0A0A0A] border border-white/10 relative overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                  
                  {/* 1. מדיה בקצה העליון - Edge to Edge */}
                  {post.media_url && (
                    <div className={`w-full bg-[#050505] relative ${isVideo ? 'cursor-pointer' : ''}`} onClick={() => isVideo ? openVideoFullscreen(post) : null}>
                      {isVideo ? (
                        <video src={post.media_url} autoPlay loop muted playsInline className="w-full max-h-[500px] object-cover" />
                      ) : (
                        <img src={post.media_url} alt="Media" className="w-full max-h-[500px] object-cover" />
                      )}
                      
                      {/* תיאור הפוסט יושב על המדיה למטה! */}
                      {post.content && (
                        <div className="absolute bottom-0 left-0 right-0 p-5 pt-16 bg-gradient-to-t from-[#0A0A0A] via-black/60 to-transparent flex items-end pointer-events-none">
                          <p onClick={(e) => { e.stopPropagation(); openModal(() => setActiveDescPost(post)); }} className="text-white/90 text-[14px] leading-relaxed font-medium text-right line-clamp-2 cursor-pointer active:opacity-50 transition-opacity pointer-events-auto drop-shadow-lg w-full">
                            {post.content}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* אם אין מדיה - התיאור יושב רגיל */}
                  {!post.media_url && post.content && (
                    <div className="p-6 pb-4 border-b border-white/5">
                      <p onClick={() => openModal(() => setActiveDescPost(post))} className="text-white/90 text-[15px] leading-relaxed font-medium text-right line-clamp-3 cursor-pointer active:opacity-50 transition-opacity">
                        {post.content}
                      </p>
                    </div>
                  )}
                  
                  {/* פס תחתון משולב - משתמש בימין, לייקים+הודעות+3 נקודות בשמאל */}
                  <div className={`flex items-center justify-between px-5 py-4 bg-[#0A0A0A]`}>
                    
                    {/* צד ימין: משתמש */}
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => goToProfile(targetId)}>
                      <div className="w-10 h-10 rounded-full bg-black border border-white/10 overflow-hidden shrink-0 shadow-inner group-hover:opacity-80 transition-opacity">
                        <div className="w-full h-full rounded-full overflow-hidden bg-[#111]">
                          {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><UserCircle size={18} className="text-white/20" /></div>}
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white font-black text-[14px] drop-shadow-sm group-hover:text-[#e5e4e2] transition-colors">{post.profiles?.full_name || 'אנונימי'}</span>
                        <span className="text-white/30 text-[10px] font-bold mt-0.5">{new Date(post.created_at || Date.now()).toLocaleDateString('he-IL')}</span>
                      </div>
                    </div>

                    {/* צד שמאל: אקשנים */}
                    <div className="flex items-center gap-4">
                      {isMyPost && (
                        <button onClick={() => openModal(() => setOptionsMenuPost(post))} className="flex items-center justify-center text-white/30 hover:text-white transition-colors active:scale-90 border-l border-white/10 pl-4">
                          <MoreVertical size={18} />
                        </button>
                      )}
                      
                      <button onClick={() => openComments(post)} className="flex items-center gap-1.5 text-white/30 hover:text-[#2196f3] transition-all active:scale-90">
                        <span className="text-[12px] font-black">{post.comments_count}</span> <MessageSquare size={18} />
                      </button>

                      <button onClick={() => handleLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 transition-all active:scale-90 ${post.is_liked ? 'text-[#e91e63] drop-shadow-[0_0_10px_rgba(233,30,99,0.5)]' : 'text-white/30 hover:text-[#e91e63]'}`}>
                        <span className="text-[12px] font-black">{post.likes_count}</span> <Heart size={18} fill={post.is_liked ? "currentColor" : "none"} /> 
                      </button>
                    </div>
                  </div>

                </div>
              );
            })
          )}
        </div>
      </FadeIn>

      {/* ============== PORTALS (Z-999999 OVER EVERYTHING) ================ */}
      
      {/* 1. FULL SCREEN REELS VIEWER - ללא איקס, סגירה עם חזור! */}
      {mounted && typeof document !== 'undefined' ? createPortal(
        <AnimatePresence>
          {fullScreenVideos && (
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed inset-0 z-[999999] bg-black flex flex-col" dir="rtl">
              
              <div className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide" onScroll={handleVideoScroll}>
                {fullScreenVideos.map((vid, idx) => {
                  const isActive = idx === currentVideoIndex;
                  return (
                    <div key={vid.id + idx} className="w-full h-screen snap-center relative bg-black flex items-center justify-center">
                      <video
                        src={vid.media_url}
                        loop
                        playsInline
                        className="w-full h-full object-cover"
                        ref={(el) => {
                          if (el) {
                            if (isActive) {
                              el.muted = false; // סאונד רק בסרטון הפעיל!
                              el.play().catch(() => {});
                            } else {
                              el.pause(); el.muted = true;
                            }
                          }
                        }}
                        onClick={(e) => { const v = e.currentTarget; if (v.paused) v.play(); else v.pause(); }}
                      />
                      
                      {/* TIKTOK STYLE BUTTONS - צד שמאל */}
                      <div className="absolute bottom-32 left-4 flex flex-col gap-6 items-center z-50 pointer-events-auto">
                        <button onClick={(e) => { e.stopPropagation(); handleLike(vid.id, vid.is_liked); }} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform">
                          <div className={`w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center ${vid.is_liked ? 'text-[#e91e63]' : 'text-white'}`}>
                            <Heart size={24} fill={vid.is_liked ? "currentColor" : "none"} />
                          </div>
                          <span className="text-white font-black text-sm drop-shadow-md">{vid.likes_count}</span>
                        </button>
                        
                        <button onClick={(e) => { e.stopPropagation(); openComments(vid); }} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform">
                          <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white">
                            <MessageSquare size={24} />
                          </div>
                          <span className="text-white font-black text-sm drop-shadow-md">{vid.comments_count}</span>
                        </button>
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-6 pb-12 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none flex flex-col gap-3 pr-20">
                         <div className="flex items-center gap-3">
                           <div className="w-12 h-12 rounded-full overflow-hidden bg-black border-2 border-white/20">
                              {vid.profiles?.avatar_url ? <img src={vid.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={24} className="text-white/50 w-full h-full p-2" />}
                           </div>
                           <div className="flex flex-col text-right">
                             <span className="text-white font-black text-lg drop-shadow-md">{vid.profiles?.full_name || 'אנונימי'}</span>
                           </div>
                         </div>
                         <p className="text-white/90 text-[15px] font-medium drop-shadow-md line-clamp-3 text-right">{vid.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      ) : null}

      {/* 2. בוטום שיט: יצירה / עריכה */}
      {mounted && typeof document !== 'undefined' ? createPortal(
        <AnimatePresence>
          {showCreatePost && (
            <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeModal} />
              <motion.div drag="y" dragControls={createPostDragControls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, { offset }) => { if (offset.y > 100) closeModal(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-[#0A0A0A] border-t border-white/10 rounded-t-[36px] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden pb-10 px-6 pt-6">
                <div className="w-full flex justify-center pb-6 cursor-grab active:cursor-grabbing bg-white/[0.02]" onPointerDown={(e) => createPostDragControls.start(e)} style={{ touchAction: "none" }}>
                  <div className="w-16 h-1.5 bg-white/20 rounded-full"></div>
                </div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-white font-black text-lg">{editingPost ? 'עריכת פוסט' : 'שידור חדש'}</h3>
                  <button onClick={closeModal} className="text-white/40"><X size={20} /></button>
                </div>
                <div className="flex flex-col gap-4">
                  <input type="text" value={newPostMedia} onChange={e => setNewPostMedia(e.target.value)} placeholder="קישור לוידאו או תמונה..." className="h-14 bg-white/5 border border-white/10 rounded-[20px] px-4 text-white text-sm focus:outline-none focus:border-[#2196f3]" dir="ltr" />
                  <textarea value={newPost} onChange={e => setNewPost(e.target.value)} placeholder="כתוב משהו..." className="h-28 bg-white/5 border border-white/10 rounded-[20px] p-4 text-white text-sm focus:outline-none focus:border-[#2196f3] resize-none" />
                  <Button onClick={handlePost} disabled={posting || (!newPost.trim() && !selectedFile && !editingPost)} className="h-14 bg-[#2196f3] text-white font-black rounded-[20px]">{posting ? <Loader2 className="animate-spin" /> : 'פרסם'}</Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      ) : null}

      {/* 3. בוטום שיט: עריכה / מחיקה */}
      {mounted && typeof document !== 'undefined' ? createPortal(
        <AnimatePresence>
          {optionsMenuPost && (
            <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeModal} />
              <motion.div drag="y" dragControls={optionsDragControls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, { offset }) => { if (offset.y > 50) closeModal(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-[#0A0A0A] border-t border-white/10 rounded-t-[36px] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden pb-10">
                <div className="w-full flex justify-center pt-5 pb-3 cursor-grab active:cursor-grabbing bg-white/[0.02]" onPointerDown={(e) => optionsDragControls.start(e)} style={{ touchAction: "none" }}>
                  <div className="w-16 h-1.5 bg-white/20 rounded-full"></div>
                </div>
                <div className="flex flex-col p-4 gap-2">
                  <button onClick={() => startEditingPost(optionsMenuPost)} className="flex items-center justify-between w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-white font-black text-lg border border-white/5">
                    <span>ערוך פוסט</span>
                    <Edit2 size={20} className="text-white/50" />
                  </button>
                  <button onClick={() => deletePost(optionsMenuPost.id)} className="flex items-center justify-between w-full p-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-500 font-black text-lg border border-red-500/20 mt-2">
                    <span>מחק פוסט</span>
                    <Trash2 size={20} />
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      ) : null}

      {/* 4. בוטום שיט: תיאור מורחב */}
      {mounted && typeof document !== 'undefined' ? createPortal(
        <AnimatePresence>
          {activeDescPost && (
            <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeModal} />
              <motion.div drag="y" dragControls={descDragControls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, { offset }) => { if (offset.y > 100) closeModal(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-[#0A0A0A] border-t border-white/10 rounded-t-[36px] max-h-[75vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden pb-10">
                <div className="w-full flex justify-center pt-5 pb-3 cursor-grab active:cursor-grabbing bg-white/[0.02]" onPointerDown={(e) => descDragControls.start(e)} style={{ touchAction: "none" }}>
                  <div className="w-16 h-1.5 bg-white/20 rounded-full"></div>
                </div>
                <div className="flex justify-start items-center px-6 pb-4 border-b border-white/10"><h2 className="text-white font-black text-[16px]">תיאור מלא</h2></div>
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide touch-pan-y" onPointerDown={(e) => { if (e.currentTarget.scrollTop > 0) e.stopPropagation(); }}>
                  <p className="text-white/90 text-[15px] leading-relaxed font-medium whitespace-pre-wrap text-right">
                    {activeDescPost.content}
                  </p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      ) : null}

      {/* 5. בוטום שיט: תגובות */}
      {mounted && typeof document !== 'undefined' ? createPortal(
        <AnimatePresence>
          {activeCommentsPostId && (
            <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeModal} />
              <motion.div drag="y" dragControls={commentsDragControls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, { offset }) => { if (offset.y > 100) closeModal(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-[#0A0A0A] border-t border-white/10 rounded-t-[36px] h-[85vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
                <div className="w-full flex justify-center pt-5 pb-3 cursor-grab active:cursor-grabbing bg-white/[0.02]" onPointerDown={(e) => commentsDragControls.start(e)} style={{ touchAction: "none" }}>
                  <div className="w-16 h-1.5 bg-white/20 rounded-full"></div>
                </div>
                <div className="flex justify-start items-center px-6 pb-4 border-b border-white/10"><h2 className="text-white font-black text-[16px]">תגובות ({activePost?.comments_count || 0})</h2></div>
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-hide touch-pan-y" onPointerDown={(e) => { if (e.currentTarget.scrollTop > 0) e.stopPropagation(); }}>
                  {loadingComments ? <Loader2 className="animate-spin mx-auto text-white/40 mt-10" /> : 
                    comments.map(comment => {
                      const targetId = comment.user_id || comment.profiles?.id;
                      const isMyComment = comment.user_id === currentUserId;
                      return (
                        <div key={comment.id} className="flex gap-4">
                          <div className="w-10 h-10 rounded-[16px] bg-black shrink-0 overflow-hidden border border-white/10 shadow-inner p-0.5 cursor-pointer" onClick={() => goToProfile(targetId)}>
                            <div className="w-full h-full rounded-[12px] overflow-hidden bg-[#111]">
                              {comment.profiles?.avatar_url ? <img src={comment.profiles.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><UserCircle size={18} className="text-white/20" /></div>}
                            </div>
                          </div>
                          <div className="flex flex-col flex-1 bg-white/[0.04] p-4 rounded-[24px] rounded-tr-sm border border-white/5 shadow-sm">
                            <span className="text-white font-black text-[13px] mb-1.5 text-right w-fit cursor-pointer hover:text-[#e5e4e2] transition-colors" onClick={() => goToProfile(targetId)}>{comment.profiles?.full_name || 'אנונימי'}</span>
                            <p className="text-white/80 text-[14px] text-right leading-relaxed">{comment.content}</p>
                            {isMyComment && <button onClick={() => deleteComment(comment.id)} className="text-red-400 text-[11px] font-bold mt-2 flex items-center gap-1 w-fit"><Trash2 size={12}/> מחק</button>}
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
                <div className="p-5 border-t border-white/10 bg-black/90 backdrop-blur-2xl mt-auto pb-8" onPointerDown={e => e.stopPropagation()}>
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full pr-2 pl-5 h-14 shadow-inner">
                    <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="הוסף תגובה..." className="flex-1 bg-transparent border-none text-white text-[15px] text-right outline-none placeholder:text-white/30" />
                    <button onClick={submitComment} disabled={!newComment.trim()} className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shrink-0 active:scale-95 disabled:opacity-50 transition-opacity shadow-[0_0_15px_rgba(255,255,255,0.2)]"><Send size={18} className="rtl:-scale-x-100 -ml-0.5 text-[#2196f3]" /></button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>, document.body
      ) : null}
    </>
  );
};
