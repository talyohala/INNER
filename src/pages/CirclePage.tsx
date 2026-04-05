import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { FadeIn, Button } from '../components/ui';
import {
  Users, Loader2, ArrowRight, MessageSquare, Heart, Activity,
  Send, Lock, X, UserCircle, Trash2, Edit2, Reply, MoreHorizontal, Paperclip, Share2, Download, Link, Bookmark, ShieldAlert, Image as ImageIcon
} from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { Share } from '@capacitor/share';
import { useAuth } from '../context/AuthContext';

export const CirclePage: React.FC = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { profile: myProfile } = useAuth();
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

    const reqLevel = data.circle.min_level || 1;
    const curLevel = myProfile?.level || 1;
    if (curLevel < reqLevel) {
      triggerFeedback('error');
      return toast.error(`הסלקטור חסם אותך. דרושה רמה ${reqLevel}.`);
    }

    setJoining(true); triggerFeedback('pop');
    try {
      if (data.isMember) {
        await supabase.from('circle_members').delete().match({ circle_id: data.circle.id, user_id: currentUserId });
        setData((prev: any) => ({ ...prev, isMember: false, circle: { ...prev.circle, members_count: Math.max((prev.circle.members_count || 1) - 1, 0) } }));
      } else {
        const res = await apiFetch(`/api/circles/${data.circle.slug}/join`, { method: 'POST', headers: { 'x-user-id': currentUserId } });
        if (res) {
          setData((prev: any) => ({ ...prev, isMember: true, circle: { ...prev.circle, members_count: (prev.circle.members_count || 0) + 1 } }));
          triggerFeedback('success'); toast.success('ברוך הבא למועדון!');
          fetchCircleData();
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בהצטרפות');
    } finally { setJoining(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) setSelectedFile(file);
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
      if (target.scrollHeight - target.scrollTop <= target.clientHeight * 2 && fullScreenMedia) {
        const mediaPosts = data.posts.filter((p: any) => p.media_url);
        if (mediaPosts.length > 0) {
          const more = Array.from({ length: 3 }).map(() => mediaPosts[Math.floor(Math.random() * mediaPosts.length)]);
          setFullScreenMedia((prev) => [...(prev || []), ...more.map(p => ({...p, _uid: Math.random().toString()}))]);
        }
      }
    }, 150);
  };

  const stopPropagation = (e: any) => e.stopPropagation();

  if (loading || !data) return <div className="min-h-screen bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" /></div>;
  const { circle, isMember, posts } = data;
  const activeNow = Math.floor((circle.members_count || 1) * 0.4) + 1;
  const requiredLevel = circle.min_level || 1;
  const currentLevel = myProfile?.level || 1;
  const levelTooLow = requiredLevel > currentLevel;

  return (
    <>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />
      <FadeIn className="pt-8 pb-32 bg-surface min-h-screen font-sans flex flex-col gap-6 relative overflow-x-hidden" dir="rtl">
        
        {/* כפתור חזרה וכותרת קטנה */}
        <div className="flex items-center justify-between relative z-10 px-5">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-brand-muted bg-surface-card border border-white/[0.05] rounded-full z-10 shadow-lg active:scale-90 transition-transform"><ArrowRight size={18} /></button>
          <div className="flex flex-col items-center w-full absolute left-0 right-0 pointer-events-none">
            <h1 className="text-[16px] font-black text-brand tracking-tight drop-shadow-md truncate max-w-[200px]">{circle.name}</h1>
            <span className="text-[10px] text-green-400 font-bold flex items-center gap-1.5 mt-0.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></span> LIVE</span>
          </div>
        </div>

        {/* קאבר מועדון */}
        <div className="flex flex-col items-center text-center relative overflow-hidden min-h-[280px] justify-center w-full border-b border-white/[0.05]">
          {circle.cover_url ? (
            <div className="absolute inset-0 z-0">
              <img src={circle.cover_url} className="w-full h-full object-cover opacity-40 mix-blend-luminosity" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent"></div>
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/10 to-transparent z-0"></div>
          )}
          <div className="relative z-10 flex flex-col items-center p-6 w-full mt-auto pb-8">
            <h2 className="text-3xl font-black text-white drop-shadow-lg mb-3">{circle.name}</h2>
            <p className="text-brand-muted text-[13px] font-medium max-w-[280px] mb-6 leading-relaxed drop-shadow-md">{circle.description}</p>
            <div className="flex items-center gap-4 bg-surface-card backdrop-blur-xl rounded-full py-3.5 px-8 w-fit text-brand font-black text-[11px] justify-center uppercase tracking-widest border border-white/[0.05] shadow-2xl">
              <span className="flex flex-col items-center gap-1.5 text-white">{circle.members_count || 0} חברים</span>
              <div className="w-px h-8 bg-white/[0.05] mx-2"></div>
              <span className="flex flex-col items-center gap-1.5 text-green-400">{activeNow} אונליין</span>
            </div>
          </div>
        </div>

        {/* יצירת פוסט */}
        <div className="relative flex flex-col gap-6 w-full px-4">
          {isMember && (
            <div className="w-full">
              <div className="p-4 rounded-[28px] border border-white/[0.05] bg-surface-card shadow-lg relative z-10 flex flex-col gap-3">
                <div className="flex gap-3 items-start">
                  <div className="w-10 h-10 rounded-full bg-surface border border-white/[0.05] shrink-0 overflow-hidden shadow-inner">
                    {supabase.auth.getUser() ? <UserCircle className="w-full h-full p-2 text-brand-muted" /> : null}
                  </div>
                  <textarea value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder="כתוב משהו למועדון..." className="w-full bg-transparent border-none text-brand text-[15px] font-medium outline-none resize-none placeholder:text-brand-muted pt-2 min-h-[60px]" />
                </div>
                {selectedFile && (
                  <div className="relative mt-2 mb-4 w-fit">
                    {selectedFile.type.startsWith('video/') ? <video src={URL.createObjectURL(selectedFile)} controls playsInline className="w-28 h-28 rounded-[20px] object-cover border border-white/[0.05] shadow-xl" /> : <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="w-28 h-28 rounded-[20px] object-cover border border-white/[0.05] shadow-xl" />}
                    <button onClick={() => setSelectedFile(null)} className="absolute -top-3 -right-3 w-8 h-8 bg-surface rounded-full text-brand flex items-center justify-center shadow-lg font-black border border-white/[0.05] z-10"><X size={14} className="text-red-500" /></button>
                  </div>
                )}
                <div className="flex justify-between items-center mt-2 border-t border-white/[0.05] pt-3">
                  <button onClick={() => fileInputRef.current?.click()} className="text-brand-muted hover:text-brand transition-colors p-2"><Paperclip size={18}/></button>
                  <Button onClick={handlePost} disabled={posting || (!newPost.trim() && !selectedFile)} size="sm" className="rounded-full px-6 py-0 h-10 shadow-lg font-black text-[12px] uppercase tracking-widest bg-accent-primary text-surface hover:bg-accent-primary/90">
                    {posting ? <Loader2 size={14} className="animate-spin" /> : 'שדר'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* פיד הפוסטים (מלבני, מקצה לקצה בערך) */}
          <div className="flex flex-col gap-8 w-full px-0 -mx-1.5">
            {posts?.map((post: any) => {
              const hasMedia = !!post.media_url;
              const isVideo = post.media_url?.match(/\.(mp4|webm|mov)$/i);

              if (!isMember) {
                return (
                  <div key={post.id} className="flex flex-col bg-surface-card border border-white/[0.05] overflow-hidden shadow-2xl w-full relative rounded-[32px]">
                    <div className="flex items-center justify-between p-4 px-5 z-10 absolute top-0 left-0 right-0 bg-gradient-to-b from-surface/80 to-transparent rounded-t-[32px]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-surface border border-white/[0.05] overflow-hidden shrink-0">
                          {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full p-2 text-brand-muted" />}
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-brand font-black text-[14px] drop-shadow-sm">{post.profiles?.full_name || 'אנונימי'}</span>
                          <span className="text-brand-muted text-[10px] font-bold mt-0.5">{new Date(post.created_at).toLocaleDateString('he-IL')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-full relative aspect-[4/5] bg-surface overflow-hidden flex items-center justify-center">
                      {hasMedia ? (
                        <img src={post.media_url} className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30 scale-110" />
                      ) : (
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-surface-card to-surface"></div>
                      )}
                      <div className="relative z-20 w-[280px] bg-surface/50 backdrop-blur-2xl rounded-[32px] p-6 flex flex-col items-center border border-white/[0.05] shadow-2xl">
                        <div className="absolute -top-7 relative flex justify-center w-full">
                          <div className="relative">
                            <img src={post.profiles?.avatar_url || 'https://placehold.co/100x100/1E1F22/333'} className="w-14 h-14 rounded-full border-4 border-surface-card object-cover" />
                            <div className="absolute bottom-0 right-0 bg-brand text-surface rounded-full p-1 shadow-md">
                              {levelTooLow ? <ShieldAlert size={10} className="text-accent-primary" /> : <Lock size={10}/>}
                            </div>
                          </div>
                        </div>
                        <h3 className="text-brand font-black mt-4 text-lg">{levelTooLow ? 'נעול ע"י סלקטור' : 'Unlock to view'}</h3>
                        <p className="text-brand-muted text-xs font-bold mt-1 flex items-center gap-1.5 uppercase tracking-widest">
                          {hasMedia ? <><ImageIcon size={12}/> Media Content</> : <><MessageSquare size={12}/> Text Post</>}
                        </p>
                        <button onClick={handleJoin} disabled={joining || levelTooLow} className={`mt-6 w-full font-black rounded-full py-3.5 text-sm uppercase tracking-widest shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 ${levelTooLow ? 'bg-white/[0.03] text-brand-muted cursor-not-allowed shadow-none' : 'bg-accent-primary text-surface hover:bg-accent-primary/90'}`}>
                          {joining ? <Loader2 size={16} className="animate-spin" /> : levelTooLow ? `דרושה רמה ${requiredLevel}` : circle.is_private && circle.join_price > 0 ? `הצטרף - ${circle.join_price} CRD` : 'הצטרף עכשיו'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={post.id} className="flex flex-col bg-surface-card border border-white/[0.05] overflow-hidden shadow-xl rounded-[28px] w-full relative">
                  <div className="flex items-center justify-between p-4 px-5 z-10 absolute top-0 left-0 right-0 bg-gradient-to-b from-surface/80 to-transparent rounded-t-[28px]">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate(`/profile/${post.user_id}`)}>
                      <div className="w-10 h-10 rounded-full bg-surface border border-white/[0.05] overflow-hidden shrink-0 shadow-inner">
                        {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full p-2 text-brand-muted" />}
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-brand font-black text-[14px] drop-shadow-sm">{post.profiles?.full_name || 'אנונימי'}</span>
                        <span className="text-white text-[10px] font-bold mt-0.5">{new Date(post.created_at).toLocaleDateString('he-IL')}</span>
                      </div>
                    </div>
                    {/* 3 הנקודות הנקיות */}
                    <button onClick={() => openOverlay(() => setOptionsMenuPost(post))} className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] hover:text-white/70 transition-colors p-2">
                      <MoreHorizontal size={24} strokeWidth={2.5}/>
                    </button>
                  </div>

                  {hasMedia && (
                    <div className="w-full bg-surface relative cursor-pointer rounded-t-[28px] overflow-hidden" onClick={() => openOverlay(() => { const vids = posts.filter((p:any) => p.media_url); setFullScreenMedia([post, ...vids.filter((v:any) => v.id !== post.id).sort(() => Math.random() - 0.5)]); setCurrentMediaIndex(0); })}>
                      {isVideo ? <video src={post.media_url} autoPlay loop muted playsInline className="w-full aspect-[4/5] object-cover" /> : <img src={post.media_url} className="w-full aspect-[4/5] object-cover" />}
                      {post.content && (
                        <div className="absolute bottom-0 left-0 right-0 p-5 pt-16 bg-gradient-to-t from-surface via-surface/60 to-transparent flex items-end pointer-events-none">
                          <p onClick={(e) => { e.stopPropagation(); openOverlay(() => setActiveDescPost(post)); }} className="text-brand text-sm leading-relaxed text-right line-clamp-2 w-full pr-2 cursor-pointer active:opacity-50 pointer-events-auto">{post.content}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {!hasMedia && post.content && (
                    <div className="p-6 pb-4 mt-16">
                      <p onClick={() => openOverlay(() => setActiveDescPost(post))} className="text-brand text-[15px] leading-relaxed text-right line-clamp-4 cursor-pointer active:opacity-50">{post.content}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-6 px-5 py-4 bg-surface-card border-t border-white/[0.03]">
                    <button onClick={() => handleLike(post.id, post.is_liked)} className={`flex items-center gap-2 transition-all active:scale-90 ${post.is_liked ? 'text-red-500' : 'text-brand-muted hover:text-red-400'}`}>
                      <Heart size={22} fill={post.is_liked ? "currentColor" : "none"} strokeWidth={post.is_liked ? 0 : 2} /> <span className="text-[14px] font-black text-white">{post.likes_count}</span>
                    </button>
                    <button onClick={() => openOverlay(() => { setActivePost(post); setActiveCommentsPostId(post.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at', { ascending: true }).then((r) => { setComments(r.data || []); setLoadingComments(false); }); })} className="flex items-center gap-2 text-brand-muted hover:text-accent-primary transition-all active:scale-90">
                      <MessageSquare size={22} /> <span className="text-[14px] font-black text-white">{post.comments_count}</span>
                    </button>
                    <button onClick={() => handleShare(post)} className="flex items-center gap-2 text-brand-muted hover:text-brand mr-auto active:scale-90 transition-all">
                      <Share2 size={20} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </FadeIn>

      {/* OVERLAYS פורטלים למיניהם (ללא שינוי מהותי מעבר לצבעים) */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <>
          <AnimatePresence>
            {fullScreenMedia && (
              <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed inset-0 z-[999999] bg-[#000]">
                <div className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide" onScroll={handleContainerScroll}>
                  {fullScreenMedia.map((vid, idx) => {
                    const isVid = vid.media_url?.match(/\.(mp4|webm|mov)$/i);
                    const keyVal = vid._uid ? vid._uid : `${vid.id}-${idx}`;
                    return (
                      <div key={keyVal} className="w-full h-screen snap-center relative bg-[#000] flex items-center justify-center">
                        {isVid ? <video src={vid.media_url} loop playsInline className="w-full h-full object-cover full-media-item" onClick={(e) => e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause()} /> : <img src={vid.media_url} className="w-full h-full object-contain full-media-item" />}
                        <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setOptionsMenuPost(vid)); }} className="absolute bottom-8 left-4 z-[60] active:scale-90 transition-transform drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"><MoreHorizontal size={26} strokeWidth={2.5} className="text-white" /></button>
                        <div className="absolute bottom-48 left-4 flex flex-col gap-6 items-center z-50">
                          <button onClick={(e) => { e.stopPropagation(); handleLike(vid.id, vid.is_liked); }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform"><Heart size={30} className={vid.is_liked ? 'text-red-500' : 'text-white'} fill={vid.is_liked ? 'currentColor' : 'none'} strokeWidth={1.5} /><span className="text-white text-[13px] font-black drop-shadow-md">{vid.likes_count}</span></button>
                          <button onClick={(e) => { e.stopPropagation(); openOverlay(() => { setActivePost(vid); setActiveCommentsPostId(vid.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', vid.id).order('created_at', { ascending: true }).then((r) => { setComments(r.data || []); setLoadingComments(false); }); }); }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform"><MessageSquare size={30} className="text-white" strokeWidth={1.5} /><span className="text-white text-[13px] font-black drop-shadow-md">{vid.comments_count}</span></button>
                          <button onClick={(e) => { e.stopPropagation(); handleShare(vid); }} className="active:scale-90 transition-transform"><Share2 size={30} className="text-white" strokeWidth={1.5} /></button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-surface/90 via-surface/40 to-transparent flex flex-col justify-end pointer-events-none">
                          <div className="flex items-center gap-3 mb-2 cursor-pointer w-fit pr-2 pointer-events-auto" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${vid.user_id}`), 50); }}>
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-card border-2 border-white/[0.05] shrink-0 shadow-lg">{vid.profiles?.avatar_url ? <img src={vid.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={24} className="text-brand-muted w-full h-full p-2" />}</div>
                            <span className="text-brand font-black text-[17px] drop-shadow-md">{vid.profiles?.full_name || 'אנונימי'}</span>
                          </div>
                          <p className="text-brand text-[15px] font-medium text-right pr-2 w-5/6 line-clamp-3 pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); openOverlay(() => setActiveDescPost(vid)); }}>{vid.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {activeCommentsPostId && (
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" dir="rtl" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-surface/80 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="relative z-10 bg-surface rounded-t-[40px] h-[85vh] flex flex-col overflow-hidden pb-10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-white/[0.05]">
                  <div className="w-full py-5 flex justify-center cursor-grab active:cursor-grabbing border-b border-white/[0.05]" onPointerDown={e => commentsDragControls.start(e)} style={{ touchAction: "none" }}><div className="w-16 h-1.5 bg-white/[0.1] rounded-full"/></div>
                  <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-hide">
                    {loadingComments ? <Loader2 className="animate-spin mx-auto text-accent-primary mt-10" /> : comments.filter((c) => c && !c.parent_id).map((c) => {
                      const replies = comments.filter((r) => r && r.parent_id === c.id);
                      return (
                        <div key={c.id} className="flex flex-col gap-2">
                          <div className="flex gap-3">
                            <div className="w-10 h-10 min-w-[40px] rounded-full bg-surface-card shrink-0 overflow-hidden cursor-pointer border border-white/[0.05] flex items-center justify-center" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>
                              {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover object-center" /> : <UserCircle className="w-full h-full p-2 text-brand-muted" />}
                            </div>
                            <div className="flex flex-col flex-1">
                              <div className="bg-surface-card p-3 rounded-[24px] rounded-tr-sm cursor-pointer" onClick={() => openOverlay(() => setCommentActionModal(c))}>
                                <span className="text-brand font-bold text-xs mb-1 inline-block" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>{c.profiles?.full_name || 'אנונימי'}</span>
                                <p className="text-brand-muted text-sm whitespace-pre-wrap leading-relaxed">{c.content}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="p-4 bg-surface border-t border-white/[0.05] flex gap-2 pb-8">
                    <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="הוסף תגובה..." className="flex-1 bg-surface-card border border-white/[0.05] text-brand rounded-full px-5 outline-none text-[15px]" />
                    <Button onClick={submitComment} disabled={!newComment.trim()} className="w-14 h-14 p-0 rounded-full shrink-0 bg-accent-primary text-surface shadow-md hover:bg-accent-primary/90">
                      <Send size={20} className="rtl:-scale-x-100 -ml-1" />
                    </Button>
                  </div>
                </motion.div>
              </div>
            )}

            {optionsMenuPost && (
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-surface/80 backdrop-blur-sm" onClick={closeOverlay} />
                 <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative z-10 bg-surface rounded-t-[40px] p-6 flex flex-col gap-2 pb-12 shadow-[0_-10px_50px_rgba(0,0,0,0.8)] border-t border-white/[0.05]">
                   <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/[0.1] rounded-full"/></div>
                   <button onClick={() => { closeOverlay(); setTimeout(() => handleShare(optionsMenuPost), 100); }} className="w-full p-4 bg-surface-card rounded-full text-brand font-bold flex justify-between items-center text-lg active:bg-white/[0.05] transition-colors border border-white/[0.05]">
                     <span>שתף פוסט</span><Share2 size={20} className="text-brand-muted" />
                   </button>
                   {optionsMenuPost.media_url && (
                     <button onClick={() => handleDownloadMedia(optionsMenuPost.media_url)} className="w-full p-4 bg-surface-card rounded-full text-brand font-bold flex justify-between items-center text-lg active:bg-white/[0.05] transition-colors mt-2 border border-white/[0.05]">
                       <span>שמור למכשיר</span><Download size={20} className="text-brand-muted" />
                     </button>
                   )}
                   <button onClick={async () => {
                     try {
                       await supabase.from('saved_posts').insert({ user_id: currentUserId, post_id: optionsMenuPost.id });
                       toast.success('הפוסט נשמר במועדפים!');
                     } catch(e:any) { toast.error('הפוסט כבר שמור אצלך'); }
                     closeOverlay();
                   }} className="w-full p-4 bg-surface-card rounded-full text-brand font-bold flex justify-between items-center text-lg active:bg-white/[0.05] transition-colors mt-2 border border-white/[0.05]">
                     <span>שמור במועדפים</span><Bookmark size={20} className="text-brand-muted" />
                   </button>
                   <button onClick={() => handleCopyLink(optionsMenuPost)} className="w-full p-4 bg-surface-card rounded-full text-brand font-bold flex justify-between items-center text-lg active:bg-white/[0.05] transition-colors mt-2 border border-white/[0.05]">
                     <span>העתק קישור</span><Link size={20} className="text-brand-muted" />
                   </button>
                   {optionsMenuPost.user_id === currentUserId && (
                     <>
                       <button onClick={() => { closeOverlay(); setTimeout(() => { openOverlay(() => { setEditingPost(optionsMenuPost); setNewPost(optionsMenuPost.content || ''); setShowCreatePost(true); }); }, 100); }} className="w-full p-4 bg-surface-card rounded-full text-brand font-bold flex justify-between items-center text-lg active:bg-white/[0.05] transition-colors mt-4 border border-white/[0.05]">
                         <span>ערוך פוסט</span><Edit2 size={20} className="text-brand-muted" />
                       </button>
                       <button onClick={() => { if(window.confirm('למחוק פוסט?')){ deletePost(optionsMenuPost.id); } }} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-full text-red-500 font-bold flex justify-between items-center text-lg mt-2 active:bg-red-500/20 transition-colors">
                         <span>מחק פוסט</span><Trash2 size={20} className="text-red-500" />
                       </button>
                     </>
                   )}
                 </motion.div>
              </div>
            )}

            {commentActionModal && (
               <div className="fixed inset-0 z-[100000] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-surface/80 backdrop-blur-sm" onClick={closeOverlay} />
                 <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative z-10 bg-surface rounded-t-[40px] p-6 flex flex-col gap-3 pb-12 shadow-[0_-10px_50px_rgba(0,0,0,0.8)] border-t border-white/[0.05]">
                   <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/[0.1] rounded-full"/></div>
                   <button onClick={() => { closeOverlay(); setReplyingTo(commentActionModal.parent_id ? comments.find(c => c?.id === commentActionModal.parent_id) : commentActionModal); setNewComment(`@${commentActionModal.profiles?.full_name} `); }} className="w-full p-4 bg-surface-card border border-white/[0.05] rounded-full text-brand font-bold flex justify-between items-center text-lg hover:bg-white/[0.05] transition-colors">
                     <span>השב לתגובה</span><Reply size={20} className="text-brand-muted" />
                   </button>
                   {commentActionModal.user_id === currentUserId && (
                     <>
                       <button onClick={() => { closeOverlay(); setEditingCommentId(commentActionModal.id); setNewComment(commentActionModal.content); }} className="w-full p-4 bg-surface-card border border-white/[0.05] rounded-full text-brand font-bold flex justify-between items-center text-lg hover:bg-white/[0.05] transition-colors">
                         <span>ערוך תגובה</span><Edit2 size={20} className="text-brand-muted" />
                       </button>
                       <button onClick={() => { if(window.confirm('למחוק תגובה?')){ closeOverlay(); deleteComment(commentActionModal.id); } }} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-full text-red-500 font-bold flex justify-between items-center text-lg mt-2 hover:bg-red-500/20 transition-colors">
                         <span>מחק תגובה</span><Trash2 size={20} className="text-red-500" />
                       </button>
                     </>
                   )}
                 </motion.div>
               </div>
            )}

            {activeDescPost && (
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-surface/80 backdrop-blur-sm" onClick={closeOverlay} />
                 <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative z-10 bg-surface rounded-t-[40px] flex flex-col overflow-hidden pb-10 max-h-[75vh] shadow-[0_-10px_50px_rgba(0,0,0,0.8)] border-t border-white/[0.05]">
                   <div className="w-full py-6 flex justify-center cursor-grab active:cursor-grabbing border-b border-white/[0.05]"><div className="w-16 h-1.5 bg-white/[0.1] rounded-full"/></div>
                   <div className="px-6 py-4 border-b border-white/[0.05]"><h2 className="text-brand font-black text-lg text-center">תיאור מלא</h2></div>
                   <div className="p-6 overflow-y-auto" onPointerDown={stopPropagation} onTouchStart={stopPropagation}><p className="text-brand-muted text-[15px] leading-relaxed text-right whitespace-pre-wrap">{activeDescPost.content}</p></div>
                 </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}
    </>
  );
};
