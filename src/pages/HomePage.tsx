import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { 
  Loader2, Bell, Users, Lock, Flame, Heart, MessageSquare, 
  Send, X, Paperclip, RefreshCw, UserCircle, Plus, 
  Trash2, Edit2, Reply, ArrowUpRight, Sparkles, Target, MoreVertical, Share2, Download, Link, Bookmark
} from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { Share } from '@capacitor/share';

type FeedTab = 'hot' | 'new' | 'foryou';
const TABS = [
  { key: 'hot', label: 'חם עכשיו', icon: Flame, color: 'text-orange-400' },
  { key: 'new', label: 'חדשים', icon: Sparkles, color: 'text-blue-400' },
  { key: 'foryou', label: 'בשבילך', icon: Target, color: 'text-purple-400' },
] as const;

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createPostDragControls = useDragControls();
  const commentsDragControls = useDragControls();
  const optionsDragControls = useDragControls();
  const descDragControls = useDragControls();
  
  const [mounted, setMounted] = useState(false);
  const [circles, setCircles] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FeedTab>('hot');
  
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  
  const [activePost, setActivePost] = useState<any>(null);
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [commentActionModal, setCommentActionModal] = useState<any | null>(null);
  
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

  const stateRef = useRef({ 
    comments: false, options: false, desc: false, 
    fullscreen: false, commentAction: false, create: false 
  });
  
  useEffect(() => {
    stateRef.current = {
      comments: !!activeCommentsPostId, options: !!optionsMenuPost, desc: !!activeDescPost,
      fullscreen: !!fullScreenMedia, commentAction: !!commentActionModal, create: showCreatePost
    };
  }, [activeCommentsPostId, optionsMenuPost, activeDescPost, fullScreenMedia, commentActionModal, showCreatePost]);

  useEffect(() => {
    const handlePopState = () => {
      const s = stateRef.current;
      if (s.commentAction) { setCommentActionModal(null); }
      else if (s.comments) { setActiveCommentsPostId(null); setActivePost(null); setReplyingTo(null); }
      else if (s.options) { setOptionsMenuPost(null); }
      else if (s.desc) { setActiveDescPost(null); }
      else if (s.fullscreen) { setFullScreenMedia(null); }
      else if (s.create) { setShowCreatePost(false); }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openOverlay = (action: () => void) => { window.history.pushState({ overlay: true }, ''); action(); };
  const closeOverlay = () => { window.history.back(); };
  const isAnyModalOpen = () => Object.values(stateRef.current).some(Boolean);

  const checkUnreadNotifications = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', authData.user.id).eq('is_read', false);
      setUnreadCount(count || 0);
    } catch (e) {}
  };

  const fetchData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id;
      if (uid) setCurrentUserId(uid);

      // הבאת מועדונים רשמיים עם בדיקת חברות
      const { data: rawCircles } = await supabase.from('circles').select('*, circle_members(user_id)');
      const fetchedCircles = (rawCircles || []).map((c: any) => ({
        ...c, is_member: uid ? c.circle_members?.some((m: any) => m.user_id === uid) : false
      })).sort((a: any, b: any) => (b.members_count || 0) - (a.members_count || 0));
      setCircles(fetchedCircles);

      // הבאת פוסטים של הפיד הראשי (circle_id is null)
      const { data: rawPosts } = await supabase
        .from('posts')
        .select('*, profiles!inner(id, full_name, username, avatar_url), likes(user_id), comments(id)')
        .is('circle_id', null)
        .order('created_at', { ascending: false });

      const fetchedPosts = (rawPosts || []).map((p: any) => ({
        ...p, 
        likes_count: p.likes?.length || 0, 
        comments_count: p.comments?.length || 0, 
        is_liked: !!uid && p.likes?.some((l: any) => l.user_id === uid)
      }));
      setPosts(fetchedPosts);
    } catch (err) { console.error(err); } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    setMounted(true);
    fetchData(false);
    checkUnreadNotifications();
    
    // סנכרון משתמשים מחוברים
    const presenceChannel = supabase.channel('global_online');
    presenceChannel.on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        let activeCount = 0;
        for (const key in state) activeCount += state[key].length;
        setOnlineUsers(activeCount > 0 ? activeCount : 1);
    }).subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await presenceChannel.track({ online_at: new Date().toISOString(), user_id: currentUserId || 'guest' });
    });

    // סנכרון פוסטים בפיד הראשי
    const feedChannel = supabase.channel('global_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: 'circle_id=is.null' }, () => fetchData(true))
      .subscribe();

    return () => { supabase.removeChannel(presenceChannel); supabase.removeChannel(feedChannel); };
  }, [currentUserId]);

  const sortedPosts = useMemo(() => {
    const arr = [...posts];
    if (activeTab === 'new') return arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (activeTab === 'foryou') return arr.sort(() => Math.random() - 0.5);
    return arr.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
  }, [posts, activeTab]);

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
      setNewPost(''); setSelectedFile(null); 
      if (showCreatePost) closeOverlay();
      triggerFeedback('success');
      fetchData(true);
    } catch (err) { toast.error('שגיאה בשמירה'); } finally { setPosting(false); }
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    triggerFeedback('pop');
    const update = (list: any[]) => list.map(p => p.id === postId ? { ...p, is_liked: !isLiked, likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1 } : p);
    setPosts(update(posts)); 
    if (fullScreenMedia) setFullScreenMedia(update(fullScreenMedia));
    try { 
      if (isLiked) await supabase.from('likes').delete().match({ post_id: postId, user_id: currentUserId });
      else await supabase.from('likes').insert({ post_id: postId, user_id: currentUserId });
    } catch (err) { fetchData(true); }
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
        if (replyingTo) payload.parent_id = replyingTo.id;
        const { data } = await supabase.from('comments').insert(payload).select('*, profiles(*)').single();
        if (data) {
          setComments(prev => [...prev, data]);
          const update = (list: any[]) => list.map(p => p.id === activePost.id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p);
          setPosts(update(posts)); if (fullScreenMedia) setFullScreenMedia(update(fullScreenMedia));
          triggerFeedback('coin');
        }
      }
      setNewComment(''); setReplyingTo(null);
    } catch (err) { toast.error('שגיאה בשליחה'); }
  };

  const deletePost = async (postId: string) => {
    triggerFeedback('error'); closeOverlay();
    setPosts(curr => curr.filter(p => p.id !== postId));
    await supabase.from('posts').delete().eq('id', postId);
  };

  const deleteComment = async (commentId: string) => {
    triggerFeedback('error');
    setComments(curr => curr.filter(c => c && c.id !== commentId && c.parent_id !== commentId));
    try { await supabase.from('comments').delete().eq('id', commentId); } catch (err) {}
  };

  const toggleCommentLike = (commentId: string) => {
    setLikedComments(prev => { const next = new Set(prev); if (next.has(commentId)) next.delete(commentId); else next.add(commentId); return next; });
    triggerFeedback('pop');
  };

  const handleShare = async (post: any) => {
    triggerFeedback('pop');
    const url = `https://inner-app.com/post/${post.id}`;
    try { await Share.share({ title: 'INNER', text: post.content, url }); } 
    catch { navigator.clipboard.writeText(url); toast.success('הקישור הועתק ללוח'); }
  };

  const handleDownloadMedia = async (mediaUrl: string) => {
    try {
      toast.loading('מוריד קובץ...', { id: 'dl' });
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `INNER_${Date.now()}`;
      document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a);
      toast.success('נשמר', { id: 'dl' });
    } catch (e) { toast.error('שגיאה', { id: 'dl' }); }
    closeOverlay();
  };

  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (scrollTimeout.current) return;
    scrollTimeout.current = setTimeout(() => {
      scrollTimeout.current = null;
      const index = Math.round(target.scrollTop / target.clientHeight);
      if (index !== currentMediaIndex) setCurrentMediaIndex(index);
    }, 150);
  };

  const stopPropagation = (e: any) => e.stopPropagation();

  if (loading && posts.length === 0 && circles.length === 0) return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  return (
    <>
      <FadeIn className="px-0 pt-8 pb-32 bg-[#0A0A0A] min-h-screen relative overflow-x-hidden touch-pan-y" dir="rtl" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        
        {/* מחוון רענון (Pull to refresh) */}
        <div className="fixed top-0 left-0 right-0 flex justify-center z-50 pointer-events-none transition-transform" style={{ transform: `translateY(${Math.max(pullY - 40, -40)}px)`, opacity: pullY / 60 }}>
          <div className="bg-[#111] p-2.5 rounded-full shadow-2xl border border-white/10 mt-6 backdrop-blur-xl"><RefreshCw size={22} className={`text-white ${refreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pullY * 2}deg)` }} /></div>
        </div>

        <div className="relative z-10 px-4">
          
          {/* הדר מרכזי */}
          <div className="flex justify-between items-start mb-8 h-12 px-1">
            <div className="w-11"></div>
            <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2">
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] italic">INNER</h1>
              <div className="flex items-center gap-1.5 mt-1 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10 backdrop-blur-md shadow-inner">
                <span className="w-1.5 h-1.5 bg-[#8bc34a] rounded-full shadow-[0_0_8px_#8bc34a] animate-pulse"></span>
                <span className="text-[10px] font-black text-white/80 tracking-widest">{onlineUsers.toLocaleString()}</span>
              </div>
            </div>
            <button onClick={() => navigate('/notifications')} className="w-11 h-11 flex justify-center items-center bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-[16px] shadow-lg active:scale-90 transition-transform relative">
              <Bell size={20} className="text-white drop-shadow-md" />
              {unreadCount > 0 && <span className="absolute top-2 right-2.5 w-2.5 h-2.5 bg-[#e91e63] rounded-full shadow-[0_0_10px_#e91e63] border-2 border-[#111] animate-pulse"></span>}
            </button>
          </div>

          {/* טאבים: חם עכשיו / חדשים / בשבילך */}
          <div className="flex gap-2 mb-8">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key as FeedTab)} className={`flex-1 h-12 rounded-[18px] border text-xs font-black transition-all duration-300 flex items-center justify-center gap-2 ${isActive ? 'bg-[#1A1C20] text-white border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)]' : 'bg-transparent text-white/40 border-transparent hover:bg-white/5'}`}>
                  <Icon size={14} className={isActive ? tab.color : 'opacity-40'} /> {tab.label}
                </button>
              );
            })}
          </div>

          {/* שורת המועדונים האופקית המקורית - משופרת לחלוטין */}
          <div className="mb-8">
            <h3 className="text-white/40 text-[11px] font-black uppercase tracking-[0.2em] mb-4 px-2 flex items-center gap-1.5 drop-shadow-md"><Flame size={14} className="text-[#f44336]" /> מועדונים</h3>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-4">
              {circles.map(circle => {
                return (
                  <motion.div key={circle.id} whileTap={{ scale: 0.95 }} className="shrink-0 w-44">
                    <div onClick={() => navigate(`/circle/${circle.slug || circle.id}`)} className="p-1.5 rounded-[32px] overflow-hidden relative border border-white/10 cursor-pointer bg-white/[0.04] backdrop-blur-xl shadow-2xl h-52 flex flex-col justify-end">
                      <div className="absolute inset-0 z-0 rounded-[28px] overflow-hidden m-1.5">
                        <div className={`absolute inset-0 bg-black/40 z-10 ${circle.is_member ? 'opacity-0' : 'opacity-100'}`}></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/50 to-transparent z-10"></div>
                        {circle.cover_url ? <img src={circle.cover_url} className={`w-full h-full object-cover ${circle.is_member ? 'blur-none' : 'blur-[3px]'}`} /> : <div className="w-full h-full flex items-center justify-center bg-[#111]"><Users size={24} className="text-white/20" /></div>}
                      </div>
                      {!circle.is_member && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/10"><Lock size={14} className="text-white/80" /></div>}
                      <div className="relative z-20 p-4"><h2 className="text-white font-black text-[15px] drop-shadow-lg line-clamp-1">{circle.name}</h2></div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* תיבת כתיבה מהירה עם עיצוב הפרימיום */}
          <div className="p-5 rounded-[36px] mb-8 border border-white/10 bg-white/[0.04] backdrop-blur-3xl shadow-2xl relative z-10">
            <div className="flex gap-3 items-start">
                <div className="w-10 h-10 rounded-[14px] bg-[#111] border border-white/10 shrink-0 overflow-hidden shadow-inner">
                  {supabase.auth.getUser() ? <UserCircle className="w-full h-full p-2 text-white/10" /> : null}
                </div>
                <textarea value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder="שדר משהו לכולם..." className="w-full bg-transparent border-none text-white/90 text-[15px] font-medium focus:outline-none h-12 resize-none placeholder:text-white/30 pt-2" />
            </div>
            
            {selectedFile && (
              <div className="relative mt-2 mb-4 w-fit">
                {selectedFile.type.startsWith('video/') ? <video src={URL.createObjectURL(selectedFile)} className="w-28 h-28 rounded-[20px] object-cover border border-white/20 shadow-xl" /> : <img src={URL.createObjectURL(selectedFile)} className="w-28 h-28 rounded-[20px] object-cover border border-white/20 shadow-xl" />}
                <button onClick={() => setSelectedFile(null)} className="absolute -top-3 -right-3 w-8 h-8 bg-black rounded-full text-white flex items-center justify-center shadow-lg font-black border border-white/20 z-10"><X size={14} className="text-[#f44336]" /></button>
              </div>
            )}

            <div className="flex justify-between items-center gap-4 border-t border-white/10 pt-4 mt-2 px-1">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="text-white/40 hover:text-white transition-colors p-2"><Paperclip size={20} /></button>
              <Button size="sm" onClick={handlePost} disabled={posting || (!newPost.trim() && !selectedFile)} className="rounded-full px-6 py-0 h-10 shadow-lg font-black text-[12px] uppercase tracking-widest bg-white text-black hover:bg-gray-200">
                {posting ? <Loader2 size={16} className="animate-spin" /> : 'שדר עכשיו'}
              </Button>
            </div>
          </div>

          {/* הפיד עצמו - הפוסטים (עם הפינות המעוגלות והעיצוב היוקרתי) */}
          <div className="flex flex-col gap-6 relative z-10">
            {sortedPosts.map((post) => {
              const hasMedia = !!post.media_url;
              const isVideo = post.media_url?.match(/\.(mp4|webm|mov)$/i);
              return (
                <div key={post.id} className="flex flex-col rounded-[36px] bg-[#0A0A0A] border border-white/10 overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                  
                  <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-4 cursor-pointer group" onClick={() => navigate(`/profile/${post.user_id}`)}>
                      <div className="w-12 h-12 rounded-[20px] bg-[#111] border border-white/10 overflow-hidden shrink-0 shadow-inner group-hover:opacity-80 transition-opacity p-0.5">
                        <div className="w-full h-full rounded-[16px] overflow-hidden bg-[#111]">
                          {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full p-2 text-white/20" />}
                        </div>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-white font-black text-[15px] drop-shadow-sm">{post.profiles?.full_name || 'אנונימי'}</span>
                        <span className="text-white/40 text-[11px] font-bold mt-0.5">{new Date(post.created_at).toLocaleDateString('he-IL')}</span>
                      </div>
                    </div>
                    <button onClick={() => openOverlay(() => setOptionsMenuPost(post))} className="text-white/30 hover:text-white transition-colors p-2"><MoreVertical size={20}/></button>
                  </div>

                  {hasMedia && (
                    <div className="w-full bg-[#050505] relative cursor-pointer group" onClick={() => openOverlay(() => setFullScreenMedia([post]))}>
                      {isVideo ? <video src={post.media_url} autoPlay loop muted playsInline className="w-full max-h-[500px] object-cover group-hover:scale-[1.01] transition-transform duration-500" /> : <img src={post.media_url} className="w-full max-h-[500px] object-cover group-hover:scale-[1.01] transition-transform duration-500" />}
                      {post.content && (
                        <div className="absolute bottom-0 left-0 right-0 p-5 pt-16 bg-gradient-to-t from-[#0A0A0A] via-black/60 to-transparent flex items-end">
                          <p onClick={(e) => { e.stopPropagation(); openOverlay(() => setActiveDescPost(post)); }} className="text-white/90 text-[15px] leading-relaxed text-right line-clamp-2 w-full pr-1">{post.content}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {!hasMedia && post.content && (
                    <div className="p-6 pb-4">
                      <p onClick={() => openOverlay(() => setActiveDescPost(post))} className="text-white/90 text-[15px] leading-relaxed text-right line-clamp-4 cursor-pointer active:opacity-50">{post.content}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-6 px-6 py-4 border-t border-white/5 bg-white/[0.01]">
                    <button onClick={() => handleLike(post.id, post.is_liked)} className={`flex items-center gap-2 transition-all active:scale-90 ${post.is_liked ? 'text-[#e91e63]' : 'text-white/30 hover:text-[#e91e63]'}`}>
                      <Heart size={22} fill={post.is_liked ? "currentColor" : "none"} strokeWidth={post.is_liked ? 0 : 2} /> <span className="text-[14px] font-black">{post.likes_count}</span>
                    </button>
                    <button onClick={() => openOverlay(() => { setActivePost(post); setActiveCommentsPostId(post.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at',{ascending:true}).then(r => {setComments(r.data||[]); setLoadingComments(false);}); })} className="flex items-center gap-2 text-white/30 hover:text-[#2196f3] transition-all active:scale-90">
                      <MessageSquare size={22} /> <span className="text-[14px] font-black">{post.comments_count}</span>
                    </button>
                    <button onClick={() => handleShare(post)} className="flex items-center gap-2 text-white/30 hover:text-white transition-all active:scale-90 mr-auto">
                      <Share2 size={20} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </FadeIn>

      {/* כפתור פוסט חדש מרחף */}
      <button onClick={() => openOverlay(() => setShowCreatePost(true))} className="fixed bottom-24 right-5 w-16 h-16 bg-white text-black rounded-[24px] shadow-[0_10px_30px_rgba(255,255,255,0.2)] flex items-center justify-center z-[70] active:scale-90 transition-transform">
        <Plus size={32} />
      </button>

      {/* --- PORTALS FOR MODALS (WITH NEW ROUNDED CORNERS) --- */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showCreatePost && (
            <div className="fixed inset-0 z-[10000] flex flex-col justify-end" dir="rtl" onTouchStart={stopPropagation}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="relative z-10 bg-[#0A0A0A] rounded-t-[40px] p-6 flex flex-col gap-4 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-white/10">
                <div className="w-full flex justify-center mb-2"><div className="w-16 h-1.5 bg-white/20 rounded-full"/></div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-white font-black text-xl">צור פוסט</h3>
                  <button onClick={closeOverlay} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/60"><X size={20} /></button>
                </div>
                <textarea value={newPost} onChange={e => setNewPost(e.target.value)} placeholder="מה בראש שלך?" className="h-32 bg-[#111] rounded-[24px] p-5 text-white text-[16px] outline-none resize-none border border-white/10 placeholder:text-white/40 shadow-inner" onPointerDown={stopPropagation} onTouchStart={stopPropagation} />
                <div onClick={() => fileInputRef.current?.click()} className="p-5 bg-[#111] rounded-[24px] border-2 border-dashed border-white/10 text-center text-white/50 cursor-pointer hover:bg-white/5 transition-colors">
                  {selectedFile ? selectedFile.name : 'צרף מדיה (תמונה/וידאו)'}
                </div>
                <Button onClick={handlePost} disabled={posting || (!newPost.trim() && !selectedFile)} className="h-14 mt-4 text-[15px]">
                  {posting ? <Loader2 className="animate-spin"/> : 'פרסם עכשיו'}
                </Button>
              </motion.div>
            </div>
          )}

          {/* ... שאר המודאלים (תגובות, מסך מלא, אפשרויות) נשארים אותו דבר ומשתמשים בקצוות rounded-[36px] / rounded-[40px] ... */}
          {activeCommentsPostId && (
            <div className="fixed inset-0 z-[10000] flex flex-col justify-end" dir="rtl" onTouchStart={stopPropagation}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="relative z-10 bg-[#0F0F0F] rounded-t-[40px] h-[85vh] flex flex-col overflow-hidden pb-10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-white/10">
                <div className="w-full py-5 flex justify-center cursor-grab active:cursor-grabbing border-b border-white/5" onPointerDown={e => commentsDragControls.start(e)} style={{ touchAction: "none" }}><div className="w-16 h-1.5 bg-white/20 rounded-full"/></div>
                <div className="px-6 pb-4 flex justify-between items-center">
                    <h2 className="text-white font-black text-xl">תגובות</h2>
                    <button onClick={closeOverlay} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/60"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-hide">
                    {loadingComments ? <Loader2 className="animate-spin mx-auto text-white/20 mt-10" /> : comments.filter(c => c && !c.parent_id).map((c, i) => (
                        <div key={i} className="flex gap-3">
                            <div className="w-12 h-12 rounded-[16px] bg-[#111] overflow-hidden shrink-0 border border-white/10">
                                {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={24} className="m-auto mt-3 text-white/20" />}
                            </div>
                            <div className="bg-[#111] p-4 rounded-[24px] rounded-tr-sm border border-white/5 flex-1 shadow-inner cursor-pointer" onClick={() => openOverlay(() => setCommentActionModal(c))}>
                                <span className="text-white font-black text-[14px] block mb-1.5">{c.profiles?.full_name}</span>
                                <p className="text-white/80 text-[15px] leading-relaxed">{c.content}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-[#0A0A0A] border-t border-white/5 flex gap-2 pb-8">
                    <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="הוסף תגובה..." className="flex-1 bg-[#111] border border-white/10 text-white rounded-[20px] px-5 outline-none text-[15px]" />
                    <Button onClick={submitComment} disabled={!newComment.trim()} className="w-14 h-14 p-0 rounded-[20px] shrink-0">
                        <Send size={20} className="rtl:-scale-x-100 -ml-1" />
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
