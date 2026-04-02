import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion'; 
import { supabase } from '../lib/supabase';              
import { apiFetch } from '../lib/api';
import { FadeIn, GlassCard, Button, Input } from '../components/ui';
import { 
  Users, Loader2, ArrowRight, MessageSquare, Heart, Activity, 
  Send, Lock, X, UserCircle, Trash2, Edit2, Reply, MoreVertical, Paperclip, Share2, Download, Link, Bookmark
} from 'lucide-react';         
import { triggerFeedback } from '../lib/sound';          
import toast from 'react-hot-toast';
import { Share } from '@capacitor/share';

export const CirclePage: React.FC = () => {                
  const { slug } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const commentsDragControls = useDragControls();
  const optionsDragControls = useDragControls();
  const descDragControls = useDragControls();
  const createPostDragControls = useDragControls();
  const commentActionDragControls = useDragControls();

  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);           
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);

  const [joining, setJoining] = useState(false);                                                                    
  
  const [activePost, setActivePost] = useState<any>(null);                                                          
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [commentActionModal, setCommentActionModal] = useState<any | null>(null);

  const [optionsMenuPost, setOptionsMenuPost] = useState<any>(null);
  const [activeDescPost, setActiveDescPost] = useState<any>(null);
  const [fullScreenMedia, setFullScreenMedia] = useState<any[] | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const scrollTimeout = useRef<any>(null);

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
      else if (s.create) { setShowCreatePost(false); setEditingPost(null); }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openOverlay = (action: () => void) => { window.history.pushState({ overlay: true }, ''); action(); };
  const closeOverlay = () => { window.history.back(); };

  useEffect(() => {                                          
    setMounted(true);
    fetchCircleData();
    const channel = supabase.channel(`circle_${slug}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchCircleData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [slug]);                                                                                                       

  const fetchCircleData = async () => {                      
    try {                                                      
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id;
      if (uid) setCurrentUserId(uid);

      let { data: circle } = await supabase.from('circles').select('*').eq('slug', slug).single();
      if (!circle) {
        const { data: circleById } = await supabase.from('circles').select('*').eq('id', slug).single();
        circle = circleById;
      }
      if (!circle) throw new Error('מועדון לא נמצא');

      let isMember = false;
      if (uid) {
        const { data: memberData } = await supabase.from('circle_members').select('user_id').eq('circle_id', circle.id).eq('user_id', uid);
        isMember = memberData && memberData.length > 0;
      }

      let formattedPosts = [];
      const { data: pData } = await supabase.from('posts').select('*, profiles(*), likes(user_id), comments(id)').eq('circle_id', circle.id).order('created_at', { ascending: false });
      if (pData) {
        formattedPosts = pData.map(p => ({ 
          ...p, 
          likes_count: p.likes?.length || 0, 
          comments_count: p.comments?.length || 0, 
          is_liked: !!uid && p.likes?.some((l:any) => l.user_id === uid) 
        }));
      }

      setData({ circle, isMember, posts: formattedPosts });                                       
    } catch (err) { navigate('/'); } finally { setLoading(false); }                                                 
  };

  const handleJoin = async () => {
    if (!currentUserId) return toast.error('יש להתחבר תחילה');
    setJoining(true); triggerFeedback('pop');
    try {
      if (data.isMember) {
        await supabase.from('circle_members').delete().match({ circle_id: data.circle.id, user_id: currentUserId });
        setData((prev: any) => ({ ...prev, isMember: false, circle: { ...prev.circle, members_count: Math.max((prev.circle.members_count || 1) - 1, 0) } }));
      } else {
        const { error } = await supabase.rpc('secure_join_circle', {
          p_user_id: currentUserId,
          p_circle_id: data.circle.id,
          p_price: data.circle.is_private ? data.circle.join_price : 0,
          p_owner_id: data.circle.owner_id,
          p_circle_name: data.circle.name,
          p_user_name: 'משתמש'
        });
        
        if (error) throw error;
        
        setData((prev: any) => ({ ...prev, isMember: true, circle: { ...prev.circle, members_count: (prev.circle.members_count || 0) + 1 } }));                                    
        triggerFeedback('success'); toast.success('ברוך הבא למועדון!');  
        fetchCircleData(); 
      }                                                      
    } catch (err: any) { 
      toast.error(err.message.includes('Not enough') ? 'אין מספיק יתרה' : 'שגיאה בהצטרפות'); 
    } finally { setJoining(false); }
  };                                                                                                                

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      setSelectedFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePost = async () => {                           
    if (!newPost.trim() && !selectedFile && !editingPost) return;
    setPosting(true);                                        
    try {
      if (editingPost) {
        await supabase.from('posts').update({ content: newPost.trim() }).eq('id', editingPost.id);
        toast.success('עודכן בהצלחה'); closeOverlay();
      } else {
        let media_url = null; let media_type = 'text';
        if (selectedFile) {
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
          const { data: uploadData } = await supabase.storage.from('feed_images').upload(fileName, selectedFile);
          if (uploadData) {
            media_url = supabase.storage.from('feed_images').getPublicUrl(uploadData.path).data.publicUrl;
            media_type = selectedFile.type.startsWith('video/') ? 'video' : 'image';
          }
        }
        await supabase.from('posts').insert({ circle_id: data.circle.id, user_id: currentUserId, content: newPost.trim(), media_url, media_type });
      }
      setNewPost(''); setSelectedFile(null); setEditingPost(null); triggerFeedback('pop'); fetchCircleData();                                     
    } catch (err: any) { toast.error('שגיאה בשליחה'); } finally { setPosting(false); }               
  };
                                                           
  const handleLike = async (postId: string, isLiked: boolean) => {
    if (!currentUserId) return;
    triggerFeedback('pop');
    const update = (list: any[]) => list.map(p => p.id === postId ? { ...p, is_liked: !isLiked, likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1 } : p);
    setData((curr: any) => ({ ...curr, posts: update(curr.posts) }));
    if (fullScreenMedia) setFullScreenMedia(update(fullScreenMedia));                                         
    try { 
      if (isLiked) await supabase.from('likes').delete().match({ post_id: postId, user_id: currentUserId });
      else await supabase.from('likes').insert({ post_id: postId, user_id: currentUserId });
    } catch (err) { fetchCircleData(); }
  };                                                                                                                

  const openComments = async (post: any) => {                
    triggerFeedback('pop'); setActivePost(post); setActiveCommentsPostId(post.id); setLoadingComments(true);                                
    try {
      const { data: commentsData } = await supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at', { ascending: true });
      setComments(commentsData || []);
    } catch (err) { toast.error('שגיאה בתגובות'); } finally { setLoadingComments(false); }                                  
  };
                                                           
  const submitComment = async () => {                        
    if (!newComment.trim() || !activePost || !currentUserId) return;
    try {
      if (editingCommentId) {
        await supabase.from('comments').update({ content: newComment.trim() }).eq('id', editingCommentId);
        setComments(prev => prev.map(c => c.id === editingCommentId ? { ...c, content: newComment.trim() } : c));
        setEditingCommentId(null);
      } else {
        const payload: any = { post_id: activePost.id, user_id: currentUserId, content: newComment.trim() };
        if (replyingTo) { payload.parent_id = replyingTo.id; }
        
        const data = await apiFetch(`/api/posts/${activePost.id}/comments`, { method: 'POST', headers: { 'x-user-id': currentUserId }, body: JSON.stringify({ content: newComment.trim() }) });
        
        if (data) {
          setComments(prev => [...prev, data]);
          const update = (list: any[]) => list.map(p => p.id === activePost.id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p);
          setData((curr: any) => ({ ...curr, posts: update(curr.posts) }));
          if (fullScreenMedia) setFullScreenMedia(update(fullScreenMedia));
          if (replyingTo) { setExpandedThreads(prev => ({ ...prev, [replyingTo.id]: true })); }
          triggerFeedback('coin');
        }
      }
      setNewComment(''); setReplyingTo(null);
    } catch (err: any) { toast.error(`שגיאה בשרת`); }
  };

  const deleteComment = async (commentId: string) => {
    triggerFeedback('error');
    setComments(curr => curr.filter(c => c && c.id !== commentId && c.parent_id !== commentId));
    const update = (list: any[]) => list.map(p => p.id === activePost?.id ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p);
    setData((curr: any) => ({ ...curr, posts: update(curr.posts) }));
    if (fullScreenMedia) setFullScreenMedia(update(fullScreenMedia));
    try { await supabase.from('comments').delete().eq('id', commentId); } catch (err) {}
  };

  const deletePost = async (postId: string) => {
    triggerFeedback('error'); closeOverlay();
    setData((curr: any) => ({ ...curr, posts: curr.posts.filter((p: any) => p.id !== postId) }));
    await supabase.from('posts').delete().eq('id', postId);
  };

  const handleShare = async (post: any) => {
    triggerFeedback('pop');
    const publicUrl = `https://inner-app.com/post/${post.id}`; 
    try { await Share.share({ title: 'INNER', text: post.content || 'צפה בפוסט ב-INNER', url: publicUrl }); } 
    catch { navigator.clipboard.writeText(publicUrl); toast.success('הקישור הועתק'); }
  };

  const handleCopyLink = async (post: any) => {
    const url = `https://inner-app.com/post/${post.id}`;
    await navigator.clipboard.writeText(url);
    toast.success('הקישור הועתק ללוח', { icon: '🔗' });
    closeOverlay();
  };

  const handleDownloadMedia = async (mediaUrl: string) => {
    try {
      toast.loading('מוריד קובץ...', { id: 'dl' });
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `INNER_${Date.now()}`;
      document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a);
      toast.success('נשמר בהצלחה', { id: 'dl' });
    } catch (e) { toast.error('שגיאה בהורדה', { id: 'dl' }); }
    closeOverlay();
  };

  const toggleCommentLike = (commentId: string) => {
    setLikedComments(prev => { const next = new Set(prev); if (next.has(commentId)) next.delete(commentId); else next.add(commentId); return next; });
    triggerFeedback('pop');
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

  if (loading || !data) return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  const { circle, isMember, posts } = data;                
  const activeNow = Math.floor((circle.members_count || 1) * 0.4) + 1;
                                                           
  return (
    <FadeIn className="px-4 pt-8 pb-32 bg-[#0A0A0A] min-h-screen font-sans flex flex-col gap-6 relative overflow-x-hidden" dir="rtl">                                                              
      
      <div className="flex items-center justify-between relative z-10 px-1">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-white/80 bg-white/5 border border-white/10 rounded-full z-10 shadow-inner active:scale-90 transition-transform"><ArrowRight size={18} /></button>
        <div className="flex flex-col items-center w-full absolute left-0 right-0 pointer-events-none">
          <h1 className="text-[18px] font-black text-white tracking-tight drop-shadow-md truncate max-w-[200px]">{circle.name}</h1>
          <span className="text-[10px] text-green-400 font-bold flex items-center gap-1.5 mt-0.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></span> LIVE</span>                                 
        </div>                                                 
      </div>                                             
      
      <GlassCard className="p-0 flex flex-col items-center text-center relative overflow-hidden min-h-[260px] justify-center mt-2 border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-[36px]">                                                                
        {circle.cover_url ? (                                     
          <div className="absolute inset-0 z-0">
            <img src={circle.cover_url} className="w-full h-full object-cover opacity-50" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/40 to-transparent"></div>
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#2196f3]/20 to-transparent z-0"></div>
        )}                                                       
        <div className="relative z-10 flex flex-col items-center p-6 w-full mt-auto pb-8">                                       
          <h2 className="text-3xl font-black text-white drop-shadow-lg mb-3">{circle.name}</h2>                             
          <p className="text-white/80 text-[13px] font-medium max-w-[280px] mb-6 leading-relaxed drop-shadow-md">{circle.description}</p>                                                
          <div className="flex items-center gap-4 bg-black/60 backdrop-blur-xl rounded-[20px] py-3.5 px-8 w-fit text-white font-black text-[11px] justify-center uppercase tracking-widest border border-white/10 shadow-2xl">
            <span className="flex flex-col items-center gap-1.5 text-white/70"><Users size={16} className="text-white" /> {circle.members_count || 0} חברים</span>                       
            <div className="w-px h-8 bg-white/20 mx-2"></div>             
            <span className="flex flex-col items-center gap-1.5 text-green-400"><Activity size={16} /> {activeNow} אונליין</span>
          </div>                                                 
        </div>                                                 
      </GlassCard>                                                                                                      
      
      <div className="relative">
        {!isMember && (                                            
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center backdrop-blur-2xl bg-[#0A0A0A]/80 rounded-[36px] border border-white/5 p-6 h-[400px]">
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-5 shadow-inner">
              <Lock size={28} className="text-white/60" />
            </motion.div>
            <h2 className="text-white font-black text-2xl mb-2 tracking-tight">תוכן חסוי</h2>                                                 
            <p className="text-white/50 text-[13px] text-center mb-8 max-w-[250px] leading-relaxed">רק חברי המועדון יכולים לראות את הפוסטים, להשתתף בשיח ולהיחשף לדרופים.</p>                                                            
            <Button onClick={handleJoin} disabled={joining} className="w-full h-14 rounded-full text-sm uppercase tracking-widest bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]">
              {joining ? <Loader2 className="animate-spin" /> : circle.is_private && circle.join_price > 0 ? `הצטרף תמורת ${circle.join_price} CRD` : 'הצטרף עכשיו (חינם)'}
            </Button>                                                      
          </div>                                                 
        )}                                                                                                                
        
        <div className={`flex flex-col gap-6 ${!isMember ? 'opacity-10 pointer-events-none h-[400px] overflow-hidden' : ''}`}>                                                       
          
          {isMember && (
            <GlassCard className="p-5 rounded-[36px] border border-white/10 bg-white/[0.04] shadow-2xl relative z-10 flex flex-col gap-3">                  
              <div className="flex gap-3 items-start">
                <div className="w-10 h-10 rounded-[14px] bg-[#111] border border-white/10 shrink-0 overflow-hidden shadow-inner">
                  {supabase.auth.getUser() ? <UserCircle className="w-full h-full p-2 text-white/10" /> : null}
                </div>
                <textarea value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder="כתוב משהו למועדון..." className="w-full bg-transparent border-none text-white/90 text-[15px] font-medium outline-none resize-none placeholder:text-white/30 pt-2 min-h-[60px]" />                                            
              </div>

              {selectedFile && (
                <div className="relative mt-2 mb-4 w-fit">
                  {selectedFile.type.startsWith('video/') ? <video src={URL.createObjectURL(selectedFile)} controls playsInline className="w-28 h-28 rounded-[20px] object-cover border border-white/20 shadow-xl" /> : <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="w-28 h-28 rounded-[20px] object-cover border border-white/20 shadow-xl" />}
                  <button onClick={() => setSelectedFile(null)} className="absolute -top-3 -right-3 w-8 h-8 bg-black rounded-full text-white flex items-center justify-center shadow-lg font-black border border-white/20 z-10"><X size={14} className="text-[#f44336]" /></button>
                </div>
              )}

              <div className="flex justify-between items-center mt-2 border-t border-white/5 pt-3">                                  
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="text-white/40 hover:text-white transition-colors p-2"><Paperclip size={18}/></button>
                <Button onClick={handlePost} disabled={posting || (!newPost.trim() && !selectedFile)} size="sm" className="rounded-full px-6 py-0 h-10 shadow-lg font-black text-[12px] uppercase tracking-widest bg-white text-black hover:bg-gray-200">
                  {posting ? <Loader2 size={14} className="animate-spin" /> : 'שדר'}
                </Button>                 
              </div>
            </GlassCard>
          )}

          {posts?.map((post: any) => {
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
                  <button onClick={() => handleLike(post.id, post.is_liked)} className={`flex items-center gap-2 transition-all active:scale-90 ${post.is_liked ? 'text-red-500' : 'text-white/30 hover:text-red-400'}`}>
                    <Heart size={22} fill={post.is_liked ? "currentColor" : "none"} strokeWidth={post.is_liked ? 0 : 2} /> <span className="text-[14px] font-black">{post.likes_count}</span>
                  </button>
                  <button onClick={() => openOverlay(() => { setActivePost(post); setActiveCommentsPostId(post.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at',{ascending:true}).then(r => {setComments(r.data||[]); setLoadingComments(false);}); })} className="flex items-center gap-2 text-white/30 hover:text-[#2196f3] transition-all active:scale-90">
                    <MessageSquare size={22} /> <span className="text-[14px] font-black">{post.comments_count}</span>
                  </button>
                  <button onClick={() => handleShare(post)} className="flex items-center gap-2 text-white/30 hover:text-white mr-auto active:scale-90 transition-all">
                    <Share2 size={20} />
                  </button>
                </div>
              </div>
            );
          })}                                                    
        </div>
      </div>                                                                                                            
      
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
                        <img src={vid.media_url} className="w-full h-full object-contain full-media-item" onError={(e) => { e.currentTarget.src = 'https://placehold.co/500x500/111/333?text=Media+Unavailable'; }} />
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
            <div className="fixed inset-0 z-[10000] flex flex-col justify-end" dir="rtl" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
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
                    <Button onClick={submitComment} disabled={!newComment.trim()} className="w-14 h-14 p-0 rounded-[20px] shrink-0 bg-[#2196f3] text-white hover:bg-[#2196f3]/80 shadow-md">
                        <Send size={20} className="rtl:-scale-x-100 -ml-1" />
                    </Button>
                </div>
              </motion.div>
            </div>
          )}

          {optionsMenuPost && (
            <div className="fixed inset-0 z-[10000] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative z-10 bg-[#0A0A0A] rounded-t-[40px] p-6 flex flex-col gap-2 pb-12 shadow-[0_-10px_50px_rgba(0,0,0,0.8)] border-t border-white/10">
                <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/20 rounded-full"/></div>
                
                {optionsMenuPost.media_url && (
                  <button onClick={() => handleDownloadMedia(optionsMenuPost.media_url)} className="w-full p-4 bg-white/5 rounded-2xl text-white/90 font-bold flex justify-between items-center text-lg active:bg-white/10 transition-colors">
                    שמור למכשיר <Download size={20} className="text-white/40" />
                  </button>
                )}
                
                <button onClick={async () => {
                  try {
                    await supabase.from('saved_posts').insert({ user_id: currentUserId, post_id: optionsMenuPost.id });
                    toast.success('הפוסט נשמר במועדפים!', { icon: '⭐' });
                  } catch(e:any) { toast.error('הפוסט כבר שמור אצלך'); }
                  closeOverlay();
                }} className="w-full p-4 bg-white/5 rounded-2xl text-white/90 font-bold flex justify-between items-center text-lg active:bg-white/10 transition-colors">
                  שמור במועדפים <Bookmark size={20} className="text-white/40" />
                </button>

                <button onClick={() => handleCopyLink(optionsMenuPost)} className="w-full p-4 bg-white/5 rounded-2xl text-white/90 font-bold flex justify-between items-center text-lg active:bg-white/10 transition-colors">
                  העתק קישור <Link size={20} className="text-white/40" />
                </button>

                <button onClick={() => { closeOverlay(); setTimeout(() => handleShare(optionsMenuPost), 100); }} className="w-full p-4 bg-[#2196f3]/10 rounded-2xl text-[#2196f3] font-bold flex justify-between items-center text-lg active:bg-[#2196f3]/20 transition-colors mt-2">
                  שתף פוסט <Share2 size={20} className="text-[#2196f3]" />
                </button>
                
                {optionsMenuPost.user_id === currentUserId && (
                  <>
                    <button onClick={() => { closeOverlay(); setTimeout(() => openOverlay(() => { setEditingPost(optionsMenuPost); setNewPost(optionsMenuPost.content || ''); setShowCreatePost(true); }), 100); }} className="w-full p-4 bg-white/5 rounded-2xl text-white/90 font-bold flex justify-between items-center text-lg active:bg-white/10 transition-colors mt-4">
                      ערוך פוסט <Edit2 size={20} className="text-white/40" />
                    </button>
                    <button onClick={() => { if(window.confirm('למחוק פוסט?')){ deletePost(optionsMenuPost.id); } }} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 font-bold flex justify-between items-center text-lg mt-2 active:bg-red-500/20 transition-colors">
                      מחק פוסט <Trash2 size={20} />
                    </button>
                  </>
                )}
              </motion.div>
            </div>
          )}

          {commentActionModal && (
             <div className="fixed inset-0 z-[100000] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
               <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative z-10 bg-[#0A0A0A] rounded-t-[40px] p-6 flex flex-col gap-3 pb-12 shadow-[0_-10px_50px_rgba(0,0,0,0.8)] border-t border-white/10">
                 <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/20 rounded-full"/></div>
                 <button onClick={() => { closeOverlay(); setReplyingTo(commentActionModal.parent_id ? comments.find(c => c?.id === commentActionModal.parent_id) : commentActionModal); setNewComment(`@${commentActionModal.profiles?.full_name} `); }} className="w-full p-4 bg-white/5 rounded-2xl text-white/90 font-bold flex justify-between items-center text-lg hover:bg-white/10 transition-colors">השב לתגובה <Reply size={20} className="text-[#2196f3]" /></button>
                 {commentActionModal.user_id === currentUserId && (
                   <>
                     <button onClick={() => { closeOverlay(); setEditingCommentId(commentActionModal.id); setNewComment(commentActionModal.content); }} className="w-full p-4 bg-white/5 rounded-2xl text-white/90 font-bold flex justify-between items-center text-lg hover:bg-white/10 transition-colors">ערוך תגובה <Edit2 size={20} className="text-white/40" /></button>
                     <button onClick={() => { if(window.confirm('למחוק תגובה?')){ closeOverlay(); deleteComment(commentActionModal.id); } }} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 font-bold flex justify-between items-center text-lg mt-2 hover:bg-red-500/20 transition-colors">מחק תגובה <Trash2 size={20} /></button>
                   </>
                 )}
               </motion.div>
             </div>
          )}

          {activeDescPost && (
            <div className="fixed inset-0 z-[10000] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative z-10 bg-[#0A0A0A] rounded-t-[40px] flex flex-col overflow-hidden pb-10 max-h-[75vh] shadow-[0_-10px_50px_rgba(0,0,0,0.8)] border-t border-white/10">
                <div className="w-full py-6 flex justify-center cursor-grab active:cursor-grabbing border-b border-white/5"><div className="w-16 h-1.5 bg-white/20 rounded-full"/></div>
                <div className="px-6 py-4 border-b border-white/5"><h2 className="text-white font-black text-lg">תיאור מלא</h2></div>
                <div className="p-6 overflow-y-auto" onPointerDown={stopPropagation} onTouchStart={stopPropagation}><p className="text-white/90 text-[15px] leading-relaxed text-right whitespace-pre-wrap">{activeDescPost.content}</p></div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </FadeIn>
  );
};
