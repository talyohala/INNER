import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { Loader2, Bell, Users, Lock, Flame, Heart, MessageSquare, Send, X, Paperclip, RefreshCw, UserCircle } from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

const PostSkeleton = () => (
  <div className="p-5 rounded-[32px] bg-white/[0.03] backdrop-blur-xl border border-white/5 relative overflow-hidden shadow-2xl mb-5 animate-pulse">
    <div className="flex items-center gap-4 mb-5">
      <div className="w-12 h-12 rounded-[20px] bg-white/10 shrink-0"></div>
      <div className="flex flex-col flex-1 gap-2.5">
        <div className="h-3.5 bg-white/10 rounded w-1/3"></div>
        <div className="h-2.5 bg-white/5 rounded w-1/5"></div>
      </div>
    </div>
    <div className="flex flex-col gap-2.5 mb-5">
      <div className="h-3.5 bg-white/10 rounded w-full"></div>
      <div className="h-3.5 bg-white/10 rounded w-5/6"></div>
      <div className="h-3.5 bg-white/10 rounded w-4/6"></div>
    </div>
    <div className="h-52 rounded-[24px] bg-white/5 w-full"></div>
  </div>
);

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragControls = useDragControls();
  const [mounted, setMounted] = useState(false);

  const [circles, setCircles] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const [activePost, setActivePost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  
  const [onlineUsers, setOnlineUsers] = useState(3420);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pullStartY = useRef(0);

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
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    setMounted(true);
    fetchData(false);
    checkUnreadNotifications();
    
    const interval = setInterval(() => setOnlineUsers(prev => prev + Math.floor(Math.random() * 5) - 2), 5000);
    
    const channel = supabase.channel('global_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: 'circle_id=is.null' }, () => fetchData(true))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => checkUnreadNotifications())
      .subscribe();
      
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, []);

  const fetchData = async (isSilentRefresh = false) => {
    if (!isSilentRefresh) setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const headers = authData.user ? { 'x-user-id': authData.user.id } : {};
      
      const [circlesData, postsData] = await Promise.all([
        apiFetch<any[]>('/api/circles', { headers }), 
        apiFetch<any[]>('/api/feed', { headers })
      ]);
      setCircles((Array.isArray(circlesData) ? circlesData : []).sort((a, b) => (b.members_count || 0) - (a.members_count || 0)));
      setPosts(Array.isArray(postsData) ? postsData : []);
    } catch (err) { } finally { setLoading(false); setRefreshing(false); }
  };

  const handleTouchStart = (e: React.TouchEvent) => { if (window.scrollY <= 0) pullStartY.current = e.touches[0].clientY; };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStartY.current > 0 && window.scrollY <= 0) {
      const y = e.touches[0].clientY - pullStartY.current;
      if (y > 0) setPullY(Math.min(y, 120));
    }
  };
  const handleTouchEnd = async () => {
    if (pullY > 60) {
      setRefreshing(true); setPullY(0); triggerFeedback('coin'); await fetchData(true); await checkUnreadNotifications();
    } else { setPullY(0); }
    pullStartY.current = 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) setSelectedFile(file);
    else if (file) toast.error('אנא בחר קובץ תמונה או וידאו תקין');
  };

  const handlePost = async () => {
    if (!newPost.trim() && !selectedFile) return;
    setPosting(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error('משתמש לא מחובר.');

      let media_url = null;
      if (selectedFile) {
        setUploadingImage(true);
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('feed_images').upload(fileName, selectedFile);
        if (uploadError) throw new Error(`שגיאת אחסון: ${uploadError.message}`);
        media_url = supabase.storage.from('feed_images').getPublicUrl(uploadData.path).data.publicUrl;
        setUploadingImage(false);
      }
      
      await apiFetch<any>('/api/feed', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'x-user-id': authData.user.id },
        body: JSON.stringify({ content: newPost.trim(), media_url }) 
      });
      
      setNewPost(''); setSelectedFile(null); triggerFeedback('pop'); fetchData(true);
    } catch (err: any) { setUploadingImage(false); toast.error(err.message || 'שגיאה בשליחה'); } finally { setPosting(false); }
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    triggerFeedback('pop');
    setPosts(curr => curr.map(p => p.id === postId ? { ...p, is_liked: !isLiked, likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1 } : p));
    try { 
      const { data: authData } = await supabase.auth.getUser();
      await apiFetch(`/api/posts/${postId}/like`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': authData.user?.id || '' }
      }); 
    } catch (err) { fetchData(true); }
  };

  const openComments = async (post: any) => {
    triggerFeedback('pop');
    setActivePost(post);
    setLoadingComments(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const data = await apiFetch<any[]>(`/api/posts/${post.id}/comments`, {
        headers: { 'x-user-id': authData.user?.id || '' }
      });
      setComments(Array.isArray(data) ? data : []);
    } catch (err) { toast.error('שגיאה בטעינת תגובות'); setComments([]); } finally { setLoadingComments(false); }
  };

  const submitComment = async () => {
    if (!newComment.trim() || !activePost) return;
    try {
      const { data: authData } = await supabase.auth.getUser();
      await apiFetch(`/api/posts/${activePost.id}/comments`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'x-user-id': authData.user?.id || '' },
        body: JSON.stringify({ content: newComment.trim() }) 
      });
      
      const fallbackComment = {
        id: Date.now().toString(),
        content: newComment.trim(),
        profiles: { full_name: 'אני', avatar_url: '', username: authData.user?.user_metadata?.username }
      };
      
      setComments(prev => [...prev, fallbackComment]);
      setNewComment('');
      setPosts(curr => curr.map(p => p.id === activePost.id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p));
      triggerFeedback('coin');
      fetchData(true);
    } catch (err) { toast.error('שגיאה בשליחת תגובה'); }
  };

  const goToProfile = (username: string | undefined) => {
    if (!username) return;
    triggerFeedback('pop');
    setActivePost(null); // במידה וזה הגיע מתוך הבוטום שיט, תסגור אותו
    navigate(`/profile/${username}`);
  };

  const commentsModal = (
    <AnimatePresence>
      {activePost && (
        <div className="fixed inset-0 z-[99999] flex flex-col justify-end" dir="rtl">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
            onClick={() => setActivePost(null)} 
          />
          
          <motion.div 
            drag="y" 
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }} 
            dragElastic={0.2} 
            onDragEnd={(e, { offset, velocity }) => { 
              if (offset.y > 100 || velocity.y > 400) setActivePost(null); 
            }} 
            initial={{ y: "100%" }} 
            animate={{ y: 0 }} 
            exit={{ y: "100%" }} 
            transition={{ type: "spring", damping: 25, stiffness: 200 }} 
            className="bg-[#0A0A0A] border-t border-white/10 rounded-t-[36px] h-[85vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden"
          >
            <div 
              className="w-full flex justify-center pt-5 pb-3 cursor-grab active:cursor-grabbing bg-white/[0.02]"
              onPointerDown={(e) => dragControls.start(e)}
              style={{ touchAction: "none" }}
            >
              <div className="w-16 h-1.5 bg-white/20 rounded-full"></div>
            </div>
            
            <div className="flex justify-start items-center px-6 pb-4 border-b border-white/10">
              <h2 className="text-white font-black text-[16px]">תגובות ({activePost?.comments_count || 0})</h2>
            </div>
            
            <div 
              className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-hide touch-pan-y"
              onPointerDown={(e) => { if (e.currentTarget.scrollTop > 0) e.stopPropagation(); }}
              onTouchStart={(e) => { if (e.currentTarget.scrollTop > 0) e.stopPropagation(); }}
            >
              {loadingComments ? <Loader2 className="animate-spin mx-auto text-white/40 mt-10" /> : 
                (Array.isArray(comments) ? comments : []).map((comment, idx) => {
                  const profile = comment?.profiles || {};
                  const avatarUrl = profile?.avatar_url;
                  const fullName = profile?.full_name || 'אנונימי';
                  const username = profile?.username;
                  
                  return (
                    <div key={comment?.id || idx} className="flex gap-4">
                      {/* הפיכת תמונת הפרופיל ושם המשתמש בתגובה ללחיצים */}
                      <div 
                        className="w-10 h-10 rounded-[16px] bg-black shrink-0 overflow-hidden border border-white/10 shadow-inner p-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => goToProfile(username)}
                      >
                        <div className="w-full h-full rounded-[12px] overflow-hidden bg-[#111]">
                          {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><UserCircle size={18} className="text-white/20" /></div>}
                        </div>
                      </div>
                      <div className="flex flex-col flex-1 bg-white/[0.04] p-4 rounded-[24px] rounded-tr-sm border border-white/5 shadow-sm">
                        <span 
                          className="text-white font-black text-[13px] mb-1.5 text-right w-fit cursor-pointer hover:text-[#e5e4e2] transition-colors"
                          onClick={() => goToProfile(username)}
                        >
                          {fullName}
                        </span>
                        <p className="text-white/80 text-[14px] text-right leading-relaxed">{comment?.content || ''}</p>
                      </div>
                    </div>
                  );
                })
              }
            </div>
            
            <div 
              className="p-5 border-t border-white/10 bg-black/90 backdrop-blur-2xl mt-auto pb-8"
              onPointerDown={e => e.stopPropagation()}
              onTouchStart={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full pr-2 pl-5 h-14 shadow-inner">
                <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="הוסף תגובה..." className="flex-1 bg-transparent border-none text-white text-[15px] text-right outline-none placeholder:text-white/30" />
                <button onClick={submitComment} disabled={!newComment.trim()} className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shrink-0 active:scale-95 disabled:opacity-50 transition-opacity shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                  <Send size={18} className="rtl:-scale-x-100 -ml-0.5 text-[#2196f3]" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div className="px-4 pt-8 pb-32 bg-black min-h-screen relative overflow-x-hidden touch-pan-y" dir="rtl" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        
        <div className="fixed top-0 left-0 right-0 flex justify-center z-50 pointer-events-none transition-transform duration-200" style={{ transform: `translateY(${Math.max(pullY - 40, -40)}px)`, opacity: pullY / 60 }}>
          <div className="bg-[#111] p-2.5 rounded-full shadow-2xl border border-white/10 mt-6 backdrop-blur-xl">
            <RefreshCw size={22} className={`text-white ${refreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pullY * 2}deg)` }} />
          </div>
        </div>

        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex justify-center">
          <div className="absolute top-[-5%] left-[-10%] w-[50%] h-[40%] bg-white/10 blur-[100px] rounded-full mix-blend-screen"></div>
        </div>

        <FadeIn className="relative z-10">
          <div className="flex justify-between items-start mb-8 h-12 px-1">
            <div className="w-10"></div>
            <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2">
              <motion.h1 animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 4 }} className="text-3xl font-black text-white tracking-tighter uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">INNER</motion.h1>
              <div className="flex items-center gap-1.5 mt-1 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10 backdrop-blur-md shadow-inner">
                <span className="w-1.5 h-1.5 bg-[#8bc34a] rounded-full shadow-[0_0_8px_#8bc34a] animate-pulse"></span>
                <span className="text-[10px] font-black text-white/80 tracking-widest">{onlineUsers.toLocaleString()}</span>
              </div>
            </div>
            
            <button onClick={() => { triggerFeedback('pop'); navigate('/notifications'); }} className="w-10 h-10 flex justify-center items-center bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-full shadow-lg active:scale-90 transition-transform relative">
              <Bell size={18} className="text-[#3f51b5] drop-shadow-[0_0_8px_rgba(63,81,181,0.5)]" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2.5 w-2 h-2 bg-[#e91e63] rounded-full shadow-[0_0_10px_#e91e63] border border-black animate-pulse"></span>
              )}
            </button>
          </div>

          <div className="mb-8 relative z-10">
            <h3 className="text-white/40 text-[11px] font-black uppercase tracking-[0.2em] mb-4 px-2 flex items-center gap-1.5 drop-shadow-md">
              <Flame size={14} className="text-[#f44336]" /> מועדונים חמים
            </h3>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-4">
              {circles.map((circle) => (
                <motion.div key={circle.id} whileTap={{ scale: 0.95 }} className="shrink-0 w-44">
                  <div onClick={() => { triggerFeedback('pop'); navigate(`/circle/${circle.slug}`); }} className="p-1.5 rounded-[32px] overflow-hidden relative border border-white/10 cursor-pointer bg-white/[0.04] backdrop-blur-xl shadow-2xl h-52 flex flex-col justify-end">
                    <div className="absolute inset-0 z-0 rounded-[28px] overflow-hidden m-1.5">
                      <div className={`absolute inset-0 bg-black/40 z-10 ${circle.is_member ? 'opacity-0' : 'opacity-100'}`}></div>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/50 to-transparent z-10"></div>
                      {circle.cover_url ? <img src={circle.cover_url} className={`w-full h-full object-cover ${circle.is_member ? 'blur-none' : 'blur-[3px]'}`} /> : <div className="w-full h-full flex items-center justify-center bg-[#111]"><Users size={24} className="text-white/20" /></div>}
                    </div>
                    {!circle.is_member && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-lg"><Lock size={14} className="text-white/80" /></div>}
                    <div className="relative z-20 p-4">
                      <h2 className="text-white font-black text-[15px] drop-shadow-lg line-clamp-1">{circle.name}</h2>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-[36px] mb-8 border border-white/10 bg-white/[0.04] backdrop-blur-3xl shadow-2xl relative z-10">
            <textarea value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder="שדר משהו לכולם..." className="w-full bg-transparent border-none text-white text-[16px] font-medium focus:outline-none h-14 resize-none placeholder:text-white/30 px-1 pt-1" />
            
            {selectedFile && (
              <div className="relative mt-2 mb-4 w-fit">
                {selectedFile.type.startsWith('video/') ? (
                  <video src={URL.createObjectURL(selectedFile)} controls playsInline className="w-28 h-28 rounded-[20px] object-cover border border-white/20 shadow-xl" />
                ) : (
                  <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="w-28 h-28 rounded-[20px] object-cover border border-white/20 shadow-xl" />
                )}
                <button onClick={() => setSelectedFile(null)} className="absolute -top-3 -right-3 w-8 h-8 bg-black rounded-full text-white flex items-center justify-center shadow-lg font-black border border-white/20 z-10"><X size={14} className="text-[#f44336]" /></button>
              </div>
            )}

            <div className="flex justify-end items-center gap-4 border-t border-white/10 pt-4 mt-1 px-1">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 flex items-center justify-center text-white/40 hover:text-[#00bcd4] hover:bg-white/5 transition-all rounded-full border border-white/10 shadow-inner">
                <Paperclip size={20} />
              </button>
              <Button onClick={handlePost} disabled={posting || uploadingImage || (!newPost.trim() && !selectedFile)} className="w-12 h-12 p-0 rounded-full bg-white text-black active:scale-95 disabled:bg-white/10 disabled:text-white/20 transition-all flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                {posting || uploadingImage ? <Loader2 size={22} className="animate-spin text-black" /> : <Send size={20} className="rtl:-scale-x-100 -ml-1 text-[#2196f3]" />}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-6 relative z-10">
            {loading ? (<><PostSkeleton /><PostSkeleton /><PostSkeleton /></>) : (
              posts.map((post) => (
                <div key={post.id} className="p-6 rounded-[36px] bg-white/[0.04] backdrop-blur-2xl border border-white/10 relative overflow-hidden shadow-2xl">
                  
                  {/* הפיכת תמונת הפרופיל והשם בפוסט ללחיצים */}
                  <div 
                    className="flex items-center gap-4 mb-5 cursor-pointer w-fit group"
                    onClick={() => goToProfile(post.profiles?.username)}
                  >
                    <div className="w-12 h-12 rounded-[20px] bg-black border border-white/10 overflow-hidden shrink-0 shadow-inner p-0.5 group-hover:opacity-80 transition-opacity">
                      <div className="w-full h-full rounded-[16px] overflow-hidden bg-[#111]">
                        {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><UserCircle size={24} className="text-white/20" /></div>}
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-white font-black text-[16px] drop-shadow-sm group-hover:text-[#e5e4e2] transition-colors">{post.profiles?.full_name || 'אנונימי'}</span>
                      <span className="text-white/40 text-[11px] font-bold mt-0.5">{new Date(post.created_at).toLocaleDateString('he-IL')}</span>
                    </div>
                  </div>
                  
                  {post.media_url && (
                    <div className="mb-5 rounded-[24px] overflow-hidden border border-white/10 bg-[#050505] shadow-inner">
                      {post.media_url.match(/\.(mp4|webm|mov)$/i) ? (
                        <video src={post.media_url} controls playsInline preload="metadata" className="w-full h-auto max-h-[450px] object-cover" />
                      ) : (
                        <img src={post.media_url} alt="Drop media" className="w-full h-auto object-cover max-h-[450px]" />
                      )}
                    </div>
                  )}

                  <p className="text-white/90 text-[15px] leading-relaxed font-medium mb-6 text-right px-1">{post.content}</p>
                  
                  <div className="flex items-center gap-6 pt-4 border-t border-white/5">
                    <button onClick={() => handleLike(post.id, post.is_liked)} className={`flex items-center gap-2 transition-all active:scale-90 ${post.is_liked ? 'text-[#e91e63] drop-shadow-[0_0_10px_rgba(233,30,99,0.5)]' : 'text-white/30 hover:text-[#e91e63]'}`}>
                      <Heart size={20} fill={post.is_liked ? "currentColor" : "none"} /> <span className="text-[13px] font-black">{post.likes_count}</span>
                    </button>
                    <button onClick={() => openComments(post)} className="flex items-center gap-2 text-white/30 hover:text-[#2196f3] transition-all active:scale-90">
                      <MessageSquare size={20} /> <span className="text-[13px] font-black">{post.comments_count}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </FadeIn>
      </div>

      {mounted && typeof document !== 'undefined' ? createPortal(commentsModal, document.body) : null}
    </>
  );
};
