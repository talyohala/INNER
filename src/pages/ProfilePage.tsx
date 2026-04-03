import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls, useScroll, useTransform } from 'framer-motion';
import { 
  UserCircle, Loader2, Heart, MessageSquare, MoreVertical, Share2, Reply, Trash2, X, Send, Download, Link as LinkIcon, Edit2, Bookmark, MapPin, GraduationCap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { Share } from '@capacitor/share';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { username: routeId } = useParams<{ username?: string }>();
  const { user, profile: authProfile, loading: authLoading } = useAuth();
  
  const [mounted, setMounted] = useState(false);
  const followersDragControls = useDragControls();
  const followingDragControls = useDragControls();
  
  const { scrollY } = useScroll();
  const coverY = useTransform(scrollY, [0, 250], [0, -100]);
  const coverOpacity = useTransform(scrollY, [0, 200], [1, 0]);
  const coverScale = useTransform(scrollY, [0, 200], [1, 0.95]);

  const [data, setData] = useState<any>({ profile: {}, memberships: [], ownedCircles: [], posts: [], savedPosts: [] });
  const [loadingData, setLoadingData] = useState(true);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  const [showFollowersList, setShowFollowersList] = useState(false);
  const [showFollowingList, setShowFollowingList] = useState(false);
  const [usersListData, setUsersListData] = useState<any[]>([]);
  const [loadingUsersList, setLoadingUsersList] = useState(false);

  const [activeTab, setActiveTab] = useState<'posts' | 'joined' | 'saved'>('posts');
  
  const [fullScreenMedia, setFullScreenMedia] = useState<any[] | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const scrollTimeout = useRef<any>(null);

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

  const commentsDragControls = useDragControls();
  const optionsDragControls = useDragControls();

  const isMyProfile = !routeId || routeId === authProfile?.username || routeId === user?.id;

  const stateRef = useRef({ 
    comments: false, options: false, desc: false, 
    fullscreen: false, commentAction: false
  });
  
  useEffect(() => {
    stateRef.current = {
      comments: !!activeCommentsPostId, options: !!optionsMenuPost, desc: !!activeDescPost,
      fullscreen: !!fullScreenMedia, commentAction: !!commentActionModal
    };
  }, [activeCommentsPostId, optionsMenuPost, activeDescPost, fullScreenMedia, commentActionModal]);

  useEffect(() => {
    const handlePopState = () => {
      const s = stateRef.current;
      if (s.commentAction) { setCommentActionModal(null); }
      else if (s.comments) { setActiveCommentsPostId(null); setActivePost(null); setReplyingTo(null); }
      else if (s.options) { setOptionsMenuPost(null); }
      else if (s.desc) { setActiveDescPost(null); }
      else if (s.fullscreen) { setFullScreenMedia(null); }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openOverlay = (action: () => void) => { window.history.pushState({ overlay: true }, ''); action(); };
  const closeOverlay = () => { window.history.back(); };

  useEffect(() => {
    let isMounted = true;
    setMounted(true);
    
    const loadProfileData = async () => {
      try {
        setLoadingData(true);
        const { data: authData } = await supabase.auth.getUser();
        let targetId = '';

        if (isMyProfile) {
          const headers = authData.user ? { 'x-user-id': authData.user.id } : {};
          const result = await apiFetch<any>('/api/profile/collection', { headers }).catch(() => ({ profile: authProfile }));
          targetId = result.profile?.id || authProfile?.id;

          const [{ data: memberships }, { data: ownedCircles }, { data: myPosts }] = await Promise.all([
            supabase.from('circle_members').select('circle:circles(*)').eq('user_id', targetId).neq('role', 'admin'),
            supabase.from('circles').select('*').eq('owner_id', targetId),
            supabase.from('posts').select('*').eq('user_id', targetId).order('created_at', { ascending: false })
          ]);

          let mySavedPosts = [];
          try {
            const { data: saved } = await supabase.from('saved_posts').select('post_id, posts(*)').eq('user_id', targetId);
            mySavedPosts = saved?.map((s: any) => s.posts).filter(Boolean) || [];
          } catch(e) {}

          if (isMounted) {
            setData({ 
              profile: result.profile || authProfile, 
              memberships: memberships || result.memberships || [], 
              ownedCircles: ownedCircles || result.ownedCircles || [], 
              posts: myPosts || [], 
              savedPosts: mySavedPosts 
            });
          }
        } else {
          const identifier = routeId || '';
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
          
          let query = supabase.from('profiles').select('*');
          if (isUuid) query = query.eq('id', identifier);
          else query = query.eq('username', identifier);
          
          const { data: publicProfile } = await query.maybeSingle();
          if (!publicProfile) throw new Error('Profile not found');
          targetId = publicProfile.id;

          const [{ data: memberships }, { data: ownedCircles }, { data: userPosts }] = await Promise.all([
            supabase.from('circle_members').select('circle:circles(*)').eq('user_id', targetId).neq('role', 'admin'),
            supabase.from('circles').select('*').eq('owner_id', targetId),
            supabase.from('posts').select('*').eq('user_id', targetId).order('created_at', { ascending: false })
          ]);

          let isFollowingUser = false;
          if (authData.user) {
            try {
              const { data: followData } = await supabase.from('followers').select('*').eq('follower_id', authData.user.id).eq('following_id', targetId).maybeSingle();
              if (followData) isFollowingUser = true;
            } catch(e) {}
          }

          if (isMounted) {
            setData({ profile: publicProfile, memberships: memberships || [], ownedCircles: ownedCircles || [], posts: userPosts || [], savedPosts: [] });
            setIsFollowing(isFollowingUser);
          }
        }

        if (targetId && isMounted) {
          const [{ count: followers }, { count: following }] = await Promise.all([
            supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', targetId),
            supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', targetId)
          ]);
          setFollowersCount(followers || 0);
          setFollowingCount(following || 0);
        }

      } catch (err) {
        toast.error('הפרופיל לא נמצא');
        navigate('/');
      } finally { 
        if (isMounted) setLoadingData(false); 
      }
    };

    if (user && !authLoading) loadProfileData();
    return () => { isMounted = false; };
  }, [user, routeId, isMyProfile, authLoading, navigate]);

  const handleFollowToggle = async () => {
    if (followLoading) return;
    setFollowLoading(true); triggerFeedback('pop');
    try {
      const { data: authData } = await supabase.auth.getUser();
      const myId = authData.user?.id; const targetId = data.profile?.id;
      if (isFollowing) {
        await apiFetch(`/api/profile/${targetId}/follow`, { method: 'POST', headers: { 'x-user-id': myId } });
        setIsFollowing(false); setFollowersCount(prev => Math.max(0, prev - 1));
      } else {
        await apiFetch(`/api/profile/${targetId}/follow`, { method: 'POST', headers: { 'x-user-id': myId } });
        setIsFollowing(true); setFollowersCount(prev => prev + 1); triggerFeedback('success');
      }
    } catch (err: any) { toast.error('שגיאה'); } finally { setFollowLoading(false); }
  };

  const openUsersListSheet = async (type: 'followers' | 'following') => {
    triggerFeedback('pop'); setLoadingUsersList(true); setUsersListData([]);
    if (type === 'followers') setShowFollowersList(true); else setShowFollowingList(true);
    try {
      const targetId = data.profile?.id;
      let userIds: string[] = [];
      if (type === 'followers') {
        const { data: fData } = await supabase.from('followers').select('follower_id').eq('following_id', targetId);
        userIds = fData ? fData.map(d => d.follower_id) : [];
      } else {
        const { data: fData } = await supabase.from('followers').select('following_id').eq('follower_id', targetId);
        userIds = fData ? fData.map(d => d.following_id) : [];
      }
      if (userIds.length > 0) {
        const { data: pData } = await supabase.from('profiles').select('*').in('id', userIds);
        setUsersListData(pData || []);
      }
    } catch (err) {} finally { setLoadingUsersList(false); }
  };

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
    document.querySelectorAll('.profile-full-media-item').forEach(v => observer.observe(v));
    return () => observer.disconnect();
  }, [fullScreenMedia, currentMediaIndex]);

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

  const handleLike = async (postId: string, isLiked: boolean) => {
    triggerFeedback('pop');
    const update = (list: any[]) => list.map(p => p.id === postId ? { ...p, is_liked: !isLiked, likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1 } : p);
    if (fullScreenMedia) setFullScreenMedia(update(fullScreenMedia));
    try { 
      if (isLiked) await supabase.from('likes').delete().match({ post_id: postId, user_id: user?.id });
      else await supabase.from('likes').insert({ post_id: postId, user_id: user?.id });
    } catch (err) {}
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

  const submitComment = async () => {
    if (!newComment.trim() || !activePost) return;
    try {
      if (editingCommentId) {
        await supabase.from('comments').update({ content: newComment.trim() }).eq('id', editingCommentId);
        setComments(prev => prev.map(c => c.id === editingCommentId ? { ...c, content: newComment.trim() } : c));
        setEditingCommentId(null);
      } else {
        const payload: any = { post_id: activePost.id, user_id: user?.id, content: newComment.trim() };
        if (replyingTo) { payload.parent_id = replyingTo.id; }
        const { data: resData } = await supabase.from('comments').insert(payload).select('*, profiles(*)').single();
        if (resData) {
          setComments(prev => [...prev, resData]);
          const update = (list: any[]) => list.map(p => p.id === activePost.id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p);
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
    try { await supabase.from('comments').delete().eq('id', commentId); } catch (err) {}
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

  const handleCopyLink = async (post: any) => {
    const publicUrl = `https://inner-app.com/post/${post.id}`;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('הקישור הועתק ללוח', { icon: '🔗' });
    } catch (e) { toast.error('שגיאה בהעתקה'); }
    closeOverlay();
  };

  const deletePost = async (postId: string) => {
    triggerFeedback('error'); closeOverlay();
    if(fullScreenMedia) setFullScreenMedia(curr => curr?.filter(p => p.id !== postId) || null);
    setData((prev:any) => ({ ...prev, posts: prev.posts.filter((p:any) => p.id !== postId) }));
    await supabase.from('posts').delete().eq('id', postId);
  };

  const toggleCommentLike = (commentId: string) => {
    setLikedComments(prev => { const next = new Set(prev); if (next.has(commentId)) next.delete(commentId); else next.add(commentId); return next; });
    triggerFeedback('pop');
  };

  const stopPropagation = (e: any) => e.stopPropagation();

  if (authLoading || loadingData) return <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  const userProfile = isMyProfile ? { ...(authProfile || {}), ...(data?.profile || {}) } : data?.profile || {};
  const currentLevel = userProfile.level || 1;
  const currentXP = userProfile.xp || 0;
  const streak = userProfile.streak || 0;
  const xpToNextLevel = currentLevel * 1000;
  const xpProgress = Math.min((currentXP / xpToNextLevel) * 100, 100);
  const trueReputation = Math.floor(currentXP / 10) + (currentLevel * 5);
  const joinedCircles = data.memberships?.map((m: any) => m?.circle).filter(Boolean) || [];
  const userPosts = data.posts || [];
  const userSavedPosts = data.savedPosts || [];
  const displayLink = userProfile?.social_link ? userProfile.social_link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : '';

  return (
    <div className="bg-[#0C0C0C] min-h-screen relative font-sans" dir="rtl">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex justify-center">
        <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[40%] bg-white/10 blur-[120px] rounded-full mix-blend-screen"></div>
        <div className="absolute bottom-[-10%] right-[-20%] w-[60%] h-[40%] bg-white/5 blur-[120px] rounded-full mix-blend-screen"></div>
      </div>

      <div className="fixed top-6 left-4 right-4 flex justify-between items-center z-50 pointer-events-none">
        <div className="w-10"></div>
        {isMyProfile && (
          <button onClick={() => { triggerFeedback('pop'); navigate('/edit-profile'); }} className="pointer-events-auto w-10 h-10 flex justify-center items-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-full shadow-lg active:scale-90 transition-all hover:bg-black/60">
            <span className="text-white text-xs font-black">עריכה</span>
          </button>
        )}
      </div>

      <motion.div style={{ y: coverY, opacity: coverOpacity, scale: coverScale }} className="fixed top-0 left-0 w-full h-[220px] bg-[#111] z-0 rounded-b-[40px] overflow-hidden shadow-2xl origin-top">
        {userProfile.cover_url ? <img src={userProfile.cover_url} className="w-full h-full object-cover opacity-80" /> : <div className="absolute inset-0 bg-gradient-to-b from-[#2196f3]/10 to-transparent"></div>}
        <div className="absolute top-6 right-5 flex flex-col items-center">
          <span className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-0.5 drop-shadow-md">רמה</span>
          <span className="text-[#e5e4e2] font-black text-[22px] leading-none drop-shadow-[0_0_12px_rgba(229,228,226,0.5)]">{currentLevel}</span>
        </div>
      </motion.div>

      <FadeIn className="relative z-10 pt-[170px] pb-32">
        <div className="bg-[#0C0C0C]/90 backdrop-blur-3xl rounded-t-[40px] px-4 min-h-screen flex flex-col items-center pt-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/5">
          <motion.div whileHover={{ scale: 1.05 }} className="w-[110px] h-[110px] rounded-full bg-[#0C0C0C] shadow-[0_10px_30px_rgba(0,0,0,0.8)] p-1.5 relative -mt-[55px] z-20">
            <div className="w-full h-full rounded-full overflow-hidden bg-[#1a1a1a] border border-white/5 relative flex items-center justify-center">
              {userProfile?.avatar_url ? <img src={userProfile.avatar_url} className="w-full h-full object-cover object-center" alt="" /> : <UserCircle size={50} className="text-white/20" />}
            </div>
          </motion.div>

          <div className="text-center mt-3 w-full">
            <h2 className="text-[20px] font-black text-white tracking-tight">
              {userProfile?.full_name || 'משתמש'}
            </h2>
            <p className="text-white/30 font-bold text-[12px] tracking-widest mb-4" dir="ltr">@{userProfile?.username || 'user'}</p>

            <div className="flex items-center justify-center gap-2 text-[13px] text-white/50 font-medium mb-5 w-full max-w-[280px] mx-auto flex-wrap">
              <span className="cursor-pointer hover:text-white transition-colors" onClick={() => openUsersListSheet('followers')}>עוקבים <span className="font-black text-white">{followersCount}</span></span><span>•</span>
              <span className="cursor-pointer hover:text-white transition-colors" onClick={() => openUsersListSheet('following')}>נעקבים <span className="font-black text-white">{followingCount}</span></span><span>•</span>
              <span>מוניטין <span className="font-black text-white">{trueReputation}</span></span>
            </div>

            {!isMyProfile && (
              <div className="flex justify-center gap-3 mb-6 w-full px-4">
                <Button onClick={handleFollowToggle} disabled={followLoading} className={`flex-1 h-12 rounded-full font-black text-[14px] flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 ${isFollowing ? 'bg-white/10 text-white border border-white/10' : 'bg-white/10 border border-white/20 text-white shadow-lg'}`}>
                  {followLoading ? <Loader2 size={18} className="animate-spin" /> : isFollowing ? 'נעקב' : 'עקוב'}
                </Button>
                <Button onClick={() => navigate(`/chat/${userProfile.id}`)} className="flex-1 h-12 bg-white text-black rounded-full font-black text-[14px] flex items-center justify-center transition-all active:scale-95 shadow-lg">
                  הודעה
                </Button>
              </div>
            )}

            {(userProfile?.zodiac || userProfile?.social_link) && (
              <div className="flex flex-col items-center gap-1.5 mb-5">
                {userProfile?.social_link && <a href={userProfile.social_link.startsWith('http') ? userProfile.social_link : `https://${userProfile.social_link}`} target="_blank" rel="noopener noreferrer" className="text-[#e5e4e2] text-[12px] font-bold flex items-center gap-1.5 hover:text-white transition-colors"><span dir="ltr" className="tracking-wide">{displayLink}</span> <LinkIcon size={12} className="text-[#e5e4e2]/60" /></a>}
                {userProfile?.zodiac && <span className="text-white/40 text-[12px] font-medium">{userProfile.zodiac}</span>}
              </div>
            )}
          </div>

          <div className="w-full flex flex-col gap-3 px-2 mb-5">
            <div className="flex justify-between items-center w-full">
              <span className="text-white/50 text-[12px] font-bold">רצף: <span className="text-white">{streak} ימים</span></span>
              {isMyProfile && <span className="text-white/50 text-[12px] font-bold"><span className="text-white">{currentXP}</span> / {xpToNextLevel}</span>}
            </div>
            {isMyProfile && <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden relative shadow-inner"><motion.div initial={{ width: 0 }} animate={{ width: `${xpProgress}%` }} transition={{ duration: 1.5, ease: "easeOut" }} className="absolute top-0 right-0 h-full bg-gradient-to-l from-[#ff5722] via-[#d500f9] to-[#2196f3] rounded-full" /></div>}
          </div>

          <div className="w-full flex flex-col gap-3 px-2 mb-8 bg-white/5 p-5 rounded-[24px] border border-white/10">
              <h3 className="text-white font-black text-[16px] mb-2">קצת עליי</h3>
              <div className="flex flex-col gap-4 text-white/80 text-[14px] font-medium">
                  {userProfile?.location && (
                      <div className="flex items-center gap-3">
                          <MapPin size={18} className="text-[#2196f3]" />
                          <span>מתגורר ב-{userProfile.location}</span>
                      </div>
                  )}
                  {userProfile?.relationship_status && (
                      <div className="flex items-center gap-3">
                          <Heart size={18} className="text-[#ff5722]" />
                          <span>מצב משפחתי: {userProfile.relationship_status}</span>
                      </div>
                  )}
                  {userProfile?.degree && (
                      <div className="flex items-center gap-3">
                          <GraduationCap size={18} className="text-[#d500f9]" />
                          <span>תואר: {userProfile.degree}</span>
                      </div>
                  )}
                  {userProfile?.job_title && (
                      <div className="flex items-center gap-3">
                          <UserCircle size={18} className="text-white/40" />
                          <span>עובד כ-{userProfile.job_title}</span>
                      </div>
                  )}
                  {(!userProfile?.location && !userProfile?.relationship_status && !userProfile?.degree && !userProfile?.job_title) && (
                      <p className="text-white/40 text-xs italic text-center">המשתמש טרם הוסיף פרטים אישיים.</p>
                  )}
              </div>
          </div>

          <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-6"></div>

          <div className="w-full mb-10">
            <div className="flex w-full mb-5 bg-white/5 p-1 rounded-full border border-white/5 shadow-inner">
              <button onClick={() => setActiveTab('posts')} className={`flex-1 py-3 text-[13px] font-black transition-all rounded-full flex items-center justify-center ${activeTab === 'posts' ? 'bg-[#1A1C20] text-white shadow-md' : 'text-white/40 hover:text-white/70'}`}>
                פוסטים
              </button>
              <button onClick={() => setActiveTab('joined')} className={`flex-1 py-3 text-[13px] font-black transition-all rounded-full flex items-center justify-center ${activeTab === 'joined' ? 'bg-[#1A1C20] text-white shadow-md' : 'text-white/40 hover:text-white/70'}`}>
                מועדונים
              </button>
              {isMyProfile && (
                <button onClick={() => setActiveTab('saved')} className={`flex-1 py-3 text-[13px] font-black transition-all rounded-full flex items-center justify-center ${activeTab === 'saved' ? 'bg-[#1A1C20] text-white shadow-md' : 'text-white/40 hover:text-white/70'}`}>
                  שמורים
                </button>
              )}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'posts' && (
                <motion.div key="posts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-3 gap-1">
                  {userPosts.length === 0 ? (
                    <div className="col-span-3 text-center py-10 text-white/30 text-xs font-bold">אין פוסטים עדיין</div>
                  ) : (
                    userPosts.map((post: any) => (
                      <div key={post.id} onClick={() => { 
                        const mediaPosts = userPosts.filter((p:any) => p.media_url);
                        openOverlay(() => setFullScreenMedia([post, ...mediaPosts.filter((v:any) => v.id !== post.id)]));
                      }} className="aspect-square bg-white/5 relative overflow-hidden cursor-pointer active:opacity-70 border border-white/5 rounded-[24px]">
                        {post.media_url ? (post.media_type === 'video' ? <video src={post.media_url} className="w-full h-full object-cover" /> : <img src={post.media_url} onError={(e) => { e.currentTarget.src = 'https://placehold.co/500x500/111/333?text=Image'; }} className="w-full h-full object-cover" />) : <div className="w-full h-full flex items-center justify-center p-2 text-center text-white/50 text-[9px] line-clamp-3">{post.content}</div>}
                      </div>
                    ))
                  )}
                </motion.div>
              )}

              {activeTab === 'joined' && (
                <motion.div key="joined" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-3 gap-1">
                   {joinedCircles.map((circle: any) => (
                     <div key={circle.id} onClick={() => navigate(`/circle/${circle.slug}`)} className="aspect-square bg-[#111] relative overflow-hidden cursor-pointer border border-white/5 rounded-[24px]">
                        {circle.cover_url ? <img src={circle.cover_url} onError={(e) => { e.currentTarget.src = 'https://placehold.co/500x500/111/333?text=Image'; }} className="w-full h-full object-cover opacity-80" /> : <div className="w-full h-full flex items-center justify-center text-white/20 font-black text-xl">{circle.name?.charAt(0)}</div>}
                        <div className="absolute bottom-0 w-full p-1 bg-black/60 backdrop-blur-sm text-center"><span className="text-white text-[9px] font-bold line-clamp-1">{circle.name}</span></div>
                     </div>
                   ))}
                </motion.div>
              )}

              {activeTab === 'saved' && isMyProfile && (
                <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-3 gap-1">
                  {userSavedPosts.length === 0 ? (
                    <div className="col-span-3 text-center py-10 text-white/30 text-xs font-bold">אין פוסטים שמורים</div>
                  ) : (
                    userSavedPosts.map((post: any) => (
                      <div key={post.id} onClick={() => { 
                        const mediaPosts = userSavedPosts.filter((p:any) => p.media_url);
                        openOverlay(() => setFullScreenMedia([post, ...mediaPosts.filter((v:any) => v.id !== post.id)]));
                      }} className="aspect-square bg-white/5 relative overflow-hidden cursor-pointer active:opacity-70 border border-white/5 rounded-[24px]">
                        {post.media_url ? (post.media_type === 'video' ? <video src={post.media_url} className="w-full h-full object-cover" /> : <img src={post.media_url} onError={(e) => { e.currentTarget.src = 'https://placehold.co/500x500/111/333?text=Image'; }} className="w-full h-full object-cover" />) : <div className="w-full h-full flex items-center justify-center p-2 text-center text-white/50 text-[9px] line-clamp-3">{post.content}</div>}
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </FadeIn>

      {/* PORTALS */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <>
          <AnimatePresence>
            {fullScreenMedia && (
              <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed inset-0 z-[999999] bg-black">
                <div className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide" onScroll={handleContainerScroll}>
                  {fullScreenMedia.map((vid, idx) => {
                    const isVid = vid.media_url?.match(/\.(mp4|webm|mov)$/i);
                    const keyVal = vid._uid ? vid._uid : `${vid.id}-${idx}`;

                    return (
                      <div key={keyVal} className="w-full h-screen snap-center relative bg-black flex items-center justify-center">
                        {isVid ? <video src={vid.media_url} loop playsInline className="w-full h-full object-cover full-media-item" onClick={(e) => e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause()} /> : <img src={vid.media_url} className="w-full h-full object-contain full-media-item" onError={(e) => { e.currentTarget.src = 'https://placehold.co/500x500/111/333?text=Media+Unavailable'; }} />}
                        <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setOptionsMenuPost(vid)); }} className="absolute bottom-6 left-4 z-[60] active:scale-90 transition-transform drop-shadow-md"><MoreVertical size={24} className="text-white" /></button>
                        <div className="absolute bottom-48 left-4 flex flex-col gap-6 items-center z-50">
                          <button onClick={(e) => { e.stopPropagation(); handleLike(vid.id, vid.is_liked); }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform"><Heart size={30} className={vid.is_liked ? 'text-[#e91e63]' : 'text-white'} fill={vid.is_liked ? 'currentColor' : 'none'} strokeWidth={1.5} /><span className="text-white text-[13px] font-black drop-shadow-md">{vid.likes_count}</span></button>
                          <button onClick={(e) => { e.stopPropagation(); openOverlay(() => { setActivePost(vid); setActiveCommentsPostId(vid.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', vid.id).order('created_at', { ascending: true }).then((r) => { setComments(r.data || []); setLoadingComments(false); }); }); }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform"><MessageSquare size={30} className="text-white" strokeWidth={1.5} /><span className="text-white text-[13px] font-black drop-shadow-md">{vid.comments_count}</span></button>
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
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" dir="rtl" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="relative z-10 bg-[#0F0F0F] rounded-t-[40px] h-[85vh] flex flex-col overflow-hidden pb-10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-white/10">
                  <div className="w-full py-5 flex justify-center cursor-grab active:cursor-grabbing border-b border-white/5" onPointerDown={e => commentsDragControls.start(e)} style={{ touchAction: 'none' }}><div className="w-16 h-1.5 bg-white/20 rounded-full" /></div>
                  <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6" onPointerDown={stopPropagation} onTouchStart={stopPropagation}>
                    {loadingComments ? <Loader2 className="animate-spin mx-auto text-white/20 mt-4" /> : comments.filter((c) => c && !c.parent_id).map((c) => {
                      const replies = comments.filter((r) => r && r.parent_id === c.id);
                      const isThreadExpanded = expandedThreads[c.id];
                      return (
                        <div key={c.id} className="flex flex-col gap-2">
                          <div className="flex gap-3">
                            <div className="w-10 h-10 min-w-[40px] rounded-full bg-[#111] shrink-0 overflow-hidden cursor-pointer border border-white/10 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>
                              {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover object-center" /> : <UserCircle className="w-full h-full p-2 text-white/20" />}
                            </div>
                            <div className="flex flex-col flex-1">
                              <div className="bg-[#111] p-3 rounded-[24px] rounded-tr-sm cursor-pointer" onClick={() => openOverlay(() => setCommentActionModal(c))}>
                                <span className="text-white/90 font-bold text-xs mb-1 inline-block" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>{c.profiles?.full_name || 'אנונימי'}</span>
                                <p className="text-white/70 text-sm whitespace-pre-wrap leading-relaxed">{renderCommentText(c.content)}</p>
                              </div>
                              <div className="flex items-center gap-4 mt-2 px-2">
                                <span className="text-[11px] text-white/40 cursor-pointer font-medium hover:text-white" onClick={() => { setReplyingTo(c); setNewComment(`@${c.profiles?.full_name} `); }}>השב</span>
                                <button onClick={() => toggleCommentLike(c.id)} className={`ml-auto flex items-center gap-1 ${likedComments.has(c.id) ? 'text-[#e91e63]' : 'text-white/30'}`}><Heart size={12} fill={likedComments.has(c.id) ? 'currentColor' : 'none'} /></button>
                              </div>
                              {replies.length > 0 && (
                                <button onClick={() => setExpandedThreads((prev) => ({ ...prev, [c.id]: !prev[c.id] }))} className="text-left text-[11px] font-bold text-white/40 hover:text-white/70 mt-2 flex items-center gap-1">
                                  <span className="flex-1 border-t border-white/10 mr-2" />{isThreadExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}{isThreadExpanded ? 'הסתר תגובות' : `צפה ב-${replies.length} תגובות`}
                                </button>
                              )}
                            </div>
                          </div>
                          {isThreadExpanded && replies.map((reply) => (
                            <div key={reply.id} className="flex gap-3 pr-10 mt-2 relative">
                              <div className="absolute right-[20px] top-[-10px] bottom-6 border-r-2 border-white/10 rounded-br-xl w-4" />
                              <div className="w-8 h-8 min-w-[32px] rounded-full bg-[#111] shrink-0 overflow-hidden cursor-pointer z-10 border border-white/10 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${reply.user_id}`), 50); }}>
                                {reply.profiles?.avatar_url ? <img src={reply.profiles.avatar_url} className="w-full h-full object-cover object-center" /> : <UserCircle className="w-full h-full p-1.5 text-white/20" />}
                              </div>
                              <div className="flex flex-col flex-1 z-10">
                                <div className="bg-[#111] p-3 rounded-[24px] rounded-tr-sm cursor-pointer" onClick={() => openOverlay(() => setCommentActionModal(reply))}>
                                  <span className="text-white/90 font-bold text-[11px] mb-1 inline-block" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${reply.user_id}`), 50); }}>{reply.profiles?.full_name || 'אנונימי'}</span>
                                  <p className="text-white/70 text-[13px] whitespace-pre-wrap leading-relaxed">{renderCommentText(reply.content)}</p>
                                </div>
                                <div className="flex items-center gap-4 mt-2 px-2">
                                  <span className="text-[10px] text-white/40 cursor-pointer font-medium hover:text-white" onClick={() => { setReplyingTo(c); setNewComment(`@${reply.profiles?.full_name} `); }}>השב</span>
                                  <button onClick={() => toggleCommentLike(reply.id)} className={`ml-auto flex items-center gap-1 ${likedComments.has(reply.id) ? 'text-[#e91e63]' : 'text-white/30'}`}><Heart size={10} fill={likedComments.has(reply.id) ? 'currentColor' : 'none'} /></button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                  <div className="p-4 border-t border-white/5 flex flex-col gap-2 bg-[#050505]" onPointerDown={stopPropagation}>
                    {replyingTo && !editingCommentId && <div className="text-[11px] text-[#2196f3] flex items-center justify-between px-3 py-1 bg-[#2196f3]/10 rounded-full w-fit mb-1"><span className="font-bold mr-1">משיב ל-@{replyingTo.profiles?.full_name}</span><X size={12} className="cursor-pointer" onClick={() => { setReplyingTo(null); setNewComment(''); }} /></div>}
                    {editingCommentId && <div className="text-[10px] text-[#2196f3] flex justify-between px-2"><span>עורך תגובה...</span><span onClick={() => { setEditingCommentId(null); setNewComment(''); }} className="cursor-pointer font-bold">ביטול</span></div>}
                    <div className="flex gap-2 items-center bg-white/5 rounded-full p-1 pl-2 border border-white/10">
                      <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="הוסף תגובה..." className="flex-1 bg-transparent px-4 text-white text-sm outline-none placeholder:text-white/40" />
                      <button onClick={submitComment} disabled={!newComment.trim()} className="w-9 h-9 bg-[#2196f3] rounded-full flex items-center justify-center text-white active:scale-95 disabled:opacity-50 transition-opacity"><Send size={16} className="rtl:-scale-x-100 -ml-0.5" /></button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            {optionsMenuPost && (
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-[#0A0A0A] rounded-t-[40px] p-6 flex flex-col gap-2 pb-12 shadow-[0_-10px_50px_rgba(0,0,0,0.8)] border-t border-white/10">
                  <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/20 rounded-full" /></div>
                  
                  <button onClick={() => { closeOverlay(); setTimeout(() => handleShare(optionsMenuPost), 100); }} className="w-full p-4 bg-white/5 rounded-full text-white/90 font-bold flex justify-between items-center text-lg active:bg-white/10 transition-colors">
                    <span>שתף פוסט</span><Share2 size={20} className="text-white/60" />
                  </button>

                  {optionsMenuPost.media_url && (
                    <button onClick={() => handleDownloadMedia(optionsMenuPost.media_url)} className="w-full p-4 bg-white/5 rounded-full text-white/90 font-bold flex justify-between items-center text-lg active:bg-white/10 transition-colors mt-2">
                      <span>שמור למכשיר</span><Download size={20} className="text-white/60" />
                    </button>
                  )}
                  
                  <button onClick={async () => {
                    try {
                      await supabase.from('saved_posts').insert({ user_id: currentUserId, post_id: optionsMenuPost.id });
                      toast.success('הפוסט נשמר במועדפים!');
                    } catch(e:any) { toast.error('הפוסט כבר שמור אצלך'); }
                    closeOverlay();
                  }} className="w-full p-4 bg-white/5 rounded-full text-white/90 font-bold flex justify-between items-center text-lg active:bg-white/10 transition-colors mt-2">
                    <span>שמור במועדפים</span><Bookmark size={20} className="text-white/60" />
                  </button>

                  <button onClick={() => handleCopyLink(optionsMenuPost)} className="w-full p-4 bg-white/5 rounded-full text-white/90 font-bold flex justify-between items-center text-lg active:bg-white/10 transition-colors mt-2">
                    <span>העתק קישור</span><LinkIcon size={20} className="text-white/60" />
                  </button>
                  
                  {optionsMenuPost.user_id === currentUserId && (
                    <>
                      <button onClick={() => { closeOverlay(); setTimeout(() => { openOverlay(() => { setEditingPost(optionsMenuPost); setNewPost(optionsMenuPost.content || ''); setShowCreatePost(true); }); }, 100); }} className="w-full p-4 bg-white/5 rounded-full text-white/90 font-bold flex justify-between items-center text-lg active:bg-white/10 transition-colors mt-4">
                        <span>ערוך פוסט</span><Edit2 size={20} className="text-white/60" />
                      </button>
                      <button onClick={() => { if(window.confirm('למחוק פוסט?')){ deletePost(optionsMenuPost.id); } }} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-full text-red-500 font-bold flex justify-between items-center text-lg mt-2 active:bg-red-500/20 transition-colors">
                        <span>מחק פוסט</span><Trash2 size={20} className="text-red-500/80" />
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
                   <button onClick={() => { closeOverlay(); setReplyingTo(commentActionModal.parent_id ? comments.find(c => c?.id === commentActionModal.parent_id) : commentActionModal); setNewComment(`@${commentActionModal.profiles?.full_name} `); }} className="w-full p-4 bg-white/5 rounded-full text-white/90 font-bold flex justify-between items-center text-lg hover:bg-white/10 transition-colors">
                     <span>השב לתגובה</span><Reply size={20} className="text-white/60" />
                   </button>
                   {commentActionModal.user_id === currentUserId && (
                     <>
                       <button onClick={() => { closeOverlay(); setEditingCommentId(commentActionModal.id); setNewComment(commentActionModal.content); }} className="w-full p-4 bg-white/5 rounded-full text-white/90 font-bold flex justify-between items-center text-lg hover:bg-white/10 transition-colors">
                         <span>ערוך תגובה</span><Edit2 size={20} className="text-white/60" />
                       </button>
                       <button onClick={() => { if(window.confirm('למחוק תגובה?')){ closeOverlay(); deleteComment(commentActionModal.id); } }} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-full text-red-500 font-bold flex justify-between items-center text-lg mt-2 hover:bg-red-500/20 transition-colors">
                         <span>מחק תגובה</span><Trash2 size={20} className="text-red-500/80" />
                       </button>
                     </>
                   )}
                 </motion.div>
               </div>
            )}

            {activeDescPost && (
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative z-10 bg-[#0A0A0A] rounded-t-[40px] flex flex-col overflow-hidden pb-10 max-h-[75vh] shadow-[0_-10px_50px_rgba(0,0,0,0.8)] border-t border-white/10">
                  <div className="w-full py-6 flex justify-center cursor-grab active:cursor-grabbing border-b border-white/5"><div className="w-16 h-1.5 bg-white/20 rounded-full"/></div>
                  <div className="px-6 py-4 border-b border-white/5"><h2 className="text-white font-black text-lg text-center">תיאור מלא</h2></div>
                  <div className="p-6 overflow-y-auto" onPointerDown={stopPropagation} onTouchStart={stopPropagation}><p className="text-white/90 text-[15px] leading-relaxed text-right whitespace-pre-wrap">{activeDescPost.content}</p></div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}
    </>
  );
};
