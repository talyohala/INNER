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
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
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
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [onlineUsers, setOnlineUsers] = useState(3420);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

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
    const interval = setInterval(() => setOnlineUsers(prev => prev + Math.floor(Math.random() * 5) - 2), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!fullScreenVideos) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const vid = entry.target as HTMLVideoElement;
        if (entry.isIntersecting) {
          vid.muted = false;
          vid.play().catch(() => {});
        } else {
          vid.pause();
          vid.muted = true;
        }
      });
    }, { threshold: 0.7 });

    const videos = document.querySelectorAll('.reels-video');
    videos.forEach(v => observer.observe(v));
    return () => observer.disconnect();
  }, [fullScreenVideos, currentVideoIndex]);

  // לוגיקת שיתוף מתקדמת
  const handleShare = async (post: any) => {
    triggerFeedback('pop');
    const url = `${window.location.origin}/#/`;
    const text = `${post.content ? post.content + '\n\n' : ''}צפה בזה ב-INNER!`;

    try {
      // 1. ניסיון שיתוף Native (עובד רק ב-APK)
      const canShareNative = await Share.canShare();
      if (canShareNative.value) {
        await Share.share({
          title: 'INNER',
          text: text,
          url: url,
          dialogTitle: 'שתף עם חברים'
        });
        return;
      }

      // 2. ניסיון שיתוף דפדפן (עובד רק ב-HTTPS)
      if (navigator.share) {
        await navigator.share({ title: 'INNER', text, url });
        return;
      }

      // 3. פולבאק אחרון למחשב / HTTP (העתקה)
      await navigator.clipboard.writeText(text + "\n" + url);
      toast.success('הקישור הועתק ללוח', { icon: '🔗' });
    } catch (e) {
      console.log('Share failed or canceled');
    }
  };

  const handlePost = async () => {
    if (!newPost.trim() && !selectedFile && !editingPost) return;
    setPosting(true);
    try {
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
        await supabase.from('posts').insert({ user_id: currentUserId, content: newPost.trim(), media_url, media_type, circle_id: null });
        closeOverlay();
      }
      setNewPost(''); setSelectedFile(null); setEditingPost(null); if (!editingPost) fetchData(true);
    } catch (err) { toast.error('שגיאה'); } finally { setPosting(false); }
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    triggerFeedback('pop');
    const update = (list: any[]) => list.map(p => p.id === postId ? { ...p, is_liked: !isLiked, likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1 } : p);
    setPosts(update(posts));
    if (fullScreenVideos) setFullScreenVideos(update(fullScreenVideos));
    try { 
      if (isLiked) await supabase.from('likes').delete().match({ post_id: postId, user_id: currentUserId });
      else await supabase.from('likes').insert({ post_id: postId, user_id: currentUserId });
    } catch (err) {}
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
          <div className="bg-[#111] p-2.5 rounded-full shadow-2xl border border-white/10 mt-6 backdrop-blur-xl"><RefreshCw size={22} className={`text-white ${refreshing ? 'animate-spin' : ''}`} /></div>
        </div>

        <div className="relative z-10 px-4">
          <div className="flex justify-between items-start mb-8 h-12">
            <div className="w-10"></div>
            <div className="absolute left-1/2 -translate-x-1/2 text-center">
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase">INNER</h1>
              <div className="flex items-center gap-1.5 mt-1 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                <span className="w-1.5 h-1.5 bg-[#8bc34a] rounded-full animate-pulse"></span>
                <span className="text-[10px] font-black text-white/80">{onlineUsers.toLocaleString()}</span>
              </div>
            </div>
            <button onClick={() => navigate('/notifications')} className="w-10 h-10 flex justify-center items-center bg-white/5 backdrop-blur-md border border-white/10 rounded-full"><Bell size={18} /></button>
          </div>

          <div className="mb-8">
            <div className="flex gap-4 overflow-x-auto scrollbar-hide -mx-4 px-4">
              {circles.map(c => (
                <div key={c.id} onClick={() => navigate(`/circle/${c.slug || c.id}`)} className="shrink-0 w-44 h-52 rounded-[32px] overflow-hidden relative border border-white/10 bg-white/5 flex flex-col justify-end p-4">
                  <div className="absolute inset-0 z-0">
                    {c.cover_url ? <img src={c.cover_url} className="w-full h-full object-cover opacity-60" /> : <div className="w-full h-full bg-[#111]" />}
                  </div>
                  <h2 className="relative z-10 text-white font-black text-sm drop-shadow-md">{c.name}</h2>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-[36px] mb-8 border border-white/10 bg-white/5 shadow-2xl cursor-pointer" onClick={() => openOverlay(() => setShowCreatePost(true))}>
            <div className="text-white/40 font-medium h-12 flex items-center">שדר משהו לכולם...</div>
          </div>
        </div>

        <div className="flex flex-col gap-6 relative z-10 px-4">
          {posts.map((post) => {
            const isVideo = post.media_url && post.media_url.match(/\.(mp4|webm|mov)$/i);
            return (
              <div key={post.id} className="flex flex-col rounded-[36px] bg-[#0A0A0A] border border-white/10 overflow-hidden shadow-2xl">
                {post.media_url && (
                  <div className="relative cursor-pointer" onClick={() => isVideo ? openOverlay(() => { 
                    const vids = posts.filter(p => p.media_url?.match(/\.(mp4|webm|mov)$/i));
                    setFullScreenVideos([post, ...vids.filter(v => v.id !== post.id).sort(()=>Math.random()-0.5)]);
                    setCurrentVideoIndex(0);
                  }) : null}>
                    {isVideo ? <video src={post.media_url} autoPlay loop muted playsInline className="w-full max-h-[500px] object-cover" /> : <img src={post.media_url} className="w-full max-h-[500px] object-cover" />}
                    <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/80 to-transparent flex items-end">
                      <p onClick={(e) => { e.stopPropagation(); openOverlay(() => setActiveDescPost(post)); }} className="text-white/90 text-sm leading-relaxed text-right line-clamp-2 w-full">{post.content}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between px-5 py-4 bg-[#0A0A0A]">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/profile/${post.user_id}`)}>
                    <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden">
                      {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full p-2 text-white/20" />}
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-white font-black text-sm">{post.profiles?.full_name || 'אנונימי'}</span>
                      <span className="text-white/30 text-[10px]">{new Date(post.created_at).toLocaleDateString('he-IL')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 flex-row-reverse">
                    {post.user_id === currentUserId && <button onClick={() => openOverlay(() => setOptionsMenuPost(post))} className="text-white/30"><MoreVertical size={18} /></button>}
                    <button onClick={() => openOverlay(() => { setActivePost(post); setActiveCommentsPostId(post.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at',{ascending:true}).then(r => {setComments(r.data||[]); setLoadingComments(false);}); })} className="flex items-center gap-1 text-white/30"><MessageSquare size={18} /><span className="text-xs">{post.comments_count}</span></button>
                    <button onClick={() => handleLike(post.id, post.is_liked)} className={`flex items-center gap-1 ${post.is_liked ? 'text-red-500' : 'text-white/30'}`}><Heart size={18} fill={post.is_liked ? "currentColor" : "none"} /><span className="text-xs">{post.likes_count}</span></button>
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
                        <Heart size={32} className={vid.is_liked ? 'text-red-500' : 'text-white'} fill={vid.is_liked ? 'currentColor' : 'none'} />
                        <span className="text-white text-xs font-bold">{vid.likes_count}</span>
                      </button>
                      <button onClick={() => openOverlay(() => { setActivePost(vid); setActiveCommentsPostId(vid.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', vid.id).order('created_at',{ascending:true}).then(r => {setComments(r.data||[]); setLoadingComments(false);}); })} className="flex flex-col items-center gap-1">
                        <MessageSquare size={32} className="text-white" />
                        <span className="text-white text-xs font-bold">{vid.comments_count}</span>
                      </button>
                      <button onClick={() => handleShare(vid)} className="flex flex-col items-center gap-1"><Share2 size={32} className="text-white" /></button>
                    </div>
                    <div className="absolute bottom-10 right-0 left-12 p-6 bg-gradient-to-t from-black/80 to-transparent">
                      <div className="flex items-center gap-3 mb-3 justify-start">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10" onClick={() => { closeOverlay(); navigate(`/profile/${vid.user_id}`); }}>
                          {vid.profiles?.avatar_url ? <img src={vid.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full p-2 text-white/20" />}
                        </div>
                        <span className="text-white font-black">{vid.profiles?.full_name}</span>
                      </div>
                      <p className="text-white text-sm line-clamp-3 text-right">{vid.content}</p>
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
                      <div className="w-10 h-10 rounded-full bg-white/10 shrink-0">
                        {c.profiles?.avatar_url && <img src={c.profiles.avatar_url} className="w-full h-full rounded-full object-cover" />}
                      </div>
                      <div className="flex flex-col bg-white/5 p-3 rounded-2xl flex-1">
                        <span className="text-white font-bold text-xs mb-1">{c.profiles?.full_name}</span>
                        <p className="text-white/80 text-sm">{c.content}</p>
                        {c.user_id === currentUserId && <button onClick={() => deleteComment(c.id)} className="text-red-500 text-[10px] mt-2 font-bold">מחק</button>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-white/5 flex gap-2">
                  <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="תגובה..." className="flex-1 bg-white/5 rounded-full px-4 text-white outline-none" />
                  <button onClick={submitComment} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black"><Send size={18} /></button>
                </div>
              </motion.div>
            </div>
          )}

          {optionsMenuPost && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60" onClick={closeOverlay} />
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-[#0A0A0A] rounded-t-[36px] p-6 flex flex-col gap-3">
                <button onClick={() => { closeOverlay(); handleShare(optionsMenuPost); }} className="w-full p-4 bg-white/5 rounded-2xl text-white font-bold flex justify-between">שתף פוסט <Share2 size={20} /></button>
                <button onClick={() => startEditingPost(optionsMenuPost)} className="w-full p-4 bg-white/5 rounded-2xl text-white font-bold flex justify-between">ערוך <Edit2 size={20} /></button>
                <button onClick={() => deletePost(optionsMenuPost.id)} className="w-full p-4 bg-red-500/10 rounded-2xl text-red-500 font-bold flex justify-between">מחק <Trash2 size={20} /></button>
              </motion.div>
            </div>
          )}

          {showCreatePost && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80" onClick={closeOverlay} />
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-[#0A0A0A] rounded-t-[36px] p-6 flex flex-col gap-4 pb-12">
                <h3 className="text-white font-black text-lg">{editingPost ? 'ערוך פוסט' : 'שידור חדש'}</h3>
                <textarea value={newPost} onChange={e => setNewPost(e.target.value)} placeholder="כתוב משהו..." className="h-32 bg-white/5 rounded-2xl p-4 text-white outline-none resize-none" />
                {!editingPost && (
                  <div onClick={() => fileInputRef.current?.click()} className="p-4 bg-white/5 rounded-2xl border-2 border-dashed border-white/10 text-center text-white/40">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />
                    {selectedFile ? selectedFile.name : 'צרף מדיה'}
                  </div>
                )}
                <Button onClick={handlePost} disabled={posting} className="h-14 bg-[#2196f3] text-white font-black rounded-2xl">{posting ? <Loader2 className="animate-spin"/> : 'פרסם'}</Button>
              </motion.div>
            </div>
          )}

          {activeDescPost && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60" onClick={closeOverlay} />
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-[#0A0A0A] rounded-t-[36px] p-8 max-h-[60vh] overflow-y-auto text-white text-right leading-relaxed">{activeDescPost.content}</motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
