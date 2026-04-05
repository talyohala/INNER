import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls, useScroll, useTransform } from 'framer-motion';
import {
  UserCircle,
  Loader2,
  Heart,
  MessageSquare,
  MoreVertical,
  Share2,
  Reply,
  Trash2,
  X,
  Send,
  Download,
  Link as LinkIcon,
  Edit2,
  Bookmark,
  MapPin,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Calendar,
  Sparkles,
  LogOut
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
  const commentsDragControls = useDragControls();
  const gridActionDragControls = useDragControls();

  const { scrollY } = useScroll();
  const coverY = useTransform(scrollY, [0, 250], [0, -100]);
  const coverOpacity = useTransform(scrollY, [0, 200], [1, 0]);
  const coverScale = useTransform(scrollY, [0, 200], [1, 0.95]);

  const [data, setData] = useState<any>({
    profile: {},
    memberships: [],
    ownedCircles: [],
    posts: [],
    savedPosts: [],
  });
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
  const [gridActionModal, setGridActionModal] = useState<{ item: any, type: 'post' | 'saved' | 'circle' } | null>(null);

  const [currentUserId, setCurrentUserId] = useState('');
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [editPostText, setEditPostText] = useState('');
  const [aboutOpen, setAboutOpen] = useState(false);

  const isMyProfile = !routeId || routeId === authProfile?.username || routeId === user?.id;

  const stateRef = useRef({
    comments: false,
    options: false,
    desc: false,
    fullscreen: false,
    commentAction: false,
    followers: false,
    following: false,
    create: false,
    gridAction: false,
  });

  const openOverlay = (action: () => void) => {
    window.history.pushState({ overlay: true }, '');
    action();
  };

  const closeOverlay = () => {
    window.history.back();
  };

  useEffect(() => {
    stateRef.current = {
      comments: !!activeCommentsPostId,
      options: !!optionsMenuPost,
      desc: !!activeDescPost,
      fullscreen: !!fullScreenMedia,
      commentAction: !!commentActionModal,
      followers: showFollowersList,
      following: showFollowingList,
      create: showCreatePost,
      gridAction: !!gridActionModal,
    };
  }, [
    activeCommentsPostId,
    optionsMenuPost,
    activeDescPost,
    fullScreenMedia,
    commentActionModal,
    showFollowersList,
    showFollowingList,
    showCreatePost,
    gridActionModal,
  ]);

  useEffect(() => {
    const handlePopState = () => {
      const s = stateRef.current;
      if (s.gridAction) setGridActionModal(null);
      else if (s.commentAction) setCommentActionModal(null);
      else if (s.followers) setShowFollowersList(false);
      else if (s.following) setShowFollowingList(false);
      else if (s.comments) {
        setActiveCommentsPostId(null);
        setActivePost(null);
        setReplyingTo(null);
        setEditingCommentId(null);
        setNewComment('');
      } else if (s.options) setOptionsMenuPost(null);
      else if (s.desc) setActiveDescPost(null);
      else if (s.create) {
        setShowCreatePost(false);
        setEditingPost(null);
        setEditPostText('');
      } else if (s.fullscreen) setFullScreenMedia(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    let isMounted = true;
    setMounted(true);

    const loadProfileData = async () => {
      try {
        setLoadingData(true);
        const { data: authData } = await supabase.auth.getUser();
        const me = authData.user?.id || '';
        if (me) setCurrentUserId(me);

        let targetId = '';

        if (isMyProfile) {
          const headers = me ? { 'x-user-id': me } : {};
          const result = await apiFetch<any>('/api/profile/collection', { headers }).catch(() => ({ profile: authProfile }));
          targetId = result.profile?.id || authProfile?.id || me;

          const [{ data: memberships }, { data: ownedCircles }, { data: myPosts }] = await Promise.all([
            supabase.from('circle_members').select('circle:circles(*)').eq('user_id', targetId).neq('role', 'admin'),
            supabase.from('circles').select('*').eq('owner_id', targetId),
            supabase.from('posts').select('*').eq('user_id', targetId).order('created_at', { ascending: false }),
          ]);

          let mySavedPosts: any[] = [];
          try {
            const { data: saved } = await supabase.from('saved_posts').select('post_id, posts(*)').eq('user_id', targetId);
            mySavedPosts = saved?.map((s: any) => s.posts).filter(Boolean) || [];
          } catch {}

          if (isMounted) {
            setData({
              profile: result.profile || authProfile,
              memberships: memberships || result.memberships || [],
              ownedCircles: ownedCircles || result.ownedCircles || [],
              posts: myPosts || [],
              savedPosts: mySavedPosts,
            });
          }
        } else {
          const identifier = routeId || '';
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

          let query = supabase.from('profiles').select('*');
          query = isUuid ? query.eq('id', identifier) : query.eq('username', identifier);

          const { data: publicProfile } = await query.maybeSingle();
          if (!publicProfile) throw new Error('Profile not found');

          targetId = publicProfile.id;

          const [{ data: memberships }, { data: ownedCircles }, { data: userPosts }] = await Promise.all([
            supabase.from('circle_members').select('circle:circles(*)').eq('user_id', targetId).neq('role', 'admin'),
            supabase.from('circles').select('*').eq('owner_id', targetId),
            supabase.from('posts').select('*').eq('user_id', targetId).order('created_at', { ascending: false }),
          ]);

          let isFollowingUser = false;
          if (me) {
            try {
              const { data: followData } = await supabase
                .from('followers')
                .select('*')
                .eq('follower_id', me)
                .eq('following_id', targetId)
                .maybeSingle();
              if (followData) isFollowingUser = true;
            } catch {}
          }

          if (isMounted) {
            setData({
              profile: publicProfile,
              memberships: memberships || [],
              ownedCircles: ownedCircles || [],
              posts: userPosts || [],
              savedPosts: [],
            });
            setIsFollowing(isFollowingUser);
          }
        }

        if (targetId && isMounted) {
          const [{ count: followers }, { count: following }] = await Promise.all([
            supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', targetId),
            supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', targetId),
          ]);
          setFollowersCount(followers || 0);
          setFollowingCount(following || 0);
        }
      } catch {
        toast.error('הפרופיל לא נמצא');
        navigate('/');
      } finally {
        if (isMounted) setLoadingData(false);
      }
    };

    if (!authLoading) loadProfileData();
    return () => { isMounted = false; };
  }, [user, routeId, isMyProfile, authLoading, navigate, authProfile]);

  const mediaPosts = useMemo(() => {
    const pool = activeTab === 'saved' && isMyProfile ? data.savedPosts || [] : data.posts || [];
    return pool.filter((p: any) => p.media_url);
  }, [data.posts, data.savedPosts, activeTab, isMyProfile]);

  const getRandomMediaBatch = (size = 4) => {
    if (!mediaPosts.length) return [];
    return Array.from({ length: size }).map(() => {
      const picked = mediaPosts[Math.floor(Math.random() * mediaPosts.length)];
      return { ...picked, _uid: `${picked.id}-${Math.random().toString(36).slice(2)}` };
    });
  };

  useEffect(() => {
    if (!fullScreenMedia) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const vid = entry.target as HTMLVideoElement;
          if (vid.tagName !== 'VIDEO') return;
          if (entry.isIntersecting) {
            vid.muted = false;
            vid.play().catch(() => {});
          } else {
            vid.pause();
            vid.muted = true;
            vid.currentTime = 0;
          }
        });
      },
      { threshold: 0.7 }
    );
    document.querySelectorAll('.profile-full-media-item').forEach((v) => observer.observe(v));
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
        const more = getRandomMediaBatch(4);
        if (more.length) setFullScreenMedia((prev) => [...(prev || []), ...more]);
      }
    }, 120);
  };

  const handleFollowToggle = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    triggerFeedback('pop');
    try {
      const { data: authData } = await supabase.auth.getUser();
      const myId = authData.user?.id;
      const targetId = data.profile?.id;
      if (!myId || !targetId) throw new Error('missing');

      await apiFetch(`/api/profile/${targetId}/follow`, { method: 'POST', headers: { 'x-user-id': myId } });

      if (isFollowing) {
        setIsFollowing(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
      } else {
        setIsFollowing(true);
        setFollowersCount((prev) => prev + 1);
        triggerFeedback('success');
      }
    } catch {
      toast.error('שגיאה');
    } finally {
      setFollowLoading(false);
    }
  };

  const openUsersListSheet = async (type: 'followers' | 'following') => {
    triggerFeedback('pop');
    openOverlay(() => {
      if (type === 'followers') setShowFollowersList(true);
      else setShowFollowingList(true);
    });
    setLoadingUsersList(true);
    setUsersListData([]);
    try {
      const targetId = data.profile?.id;
      let userIds: string[] = [];
      if (type === 'followers') {
        const { data: fData } = await supabase.from('followers').select('follower_id').eq('following_id', targetId);
        userIds = fData ? fData.map((d: any) => d.follower_id) : [];
      } else {
        const { data: fData } = await supabase.from('followers').select('following_id').eq('follower_id', targetId);
        userIds = fData ? fData.map((d: any) => d.following_id) : [];
      }

      if (userIds.length > 0) {
        const { data: pData } = await supabase.from('profiles').select('*').in('id', userIds);
        setUsersListData(pData || []);
      }
    } catch {
      toast.error('שגיאה בטעינת הרשימה');
    } finally {
      setLoadingUsersList(false);
    }
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    triggerFeedback('pop');
    const update = (list: any[]) =>
      list.map((p) => p.id === postId ? { ...p, is_liked: !isLiked, likes_count: isLiked ? Math.max(0, (p.likes_count || 0) - 1) : (p.likes_count || 0) + 1 } : p);

    setData((prev: any) => ({ ...prev, posts: update(prev.posts || []), savedPosts: update(prev.savedPosts || []) }));
    if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));

    try {
      if (isLiked) await supabase.from('likes').delete().match({ post_id: postId, user_id: user?.id });
      else await supabase.from('likes').insert({ post_id: postId, user_id: user?.id });
    } catch {}
  };

  const handleShare = async (post: any) => {
    triggerFeedback('pop');
    const publicUrl = `https://inner-app.com/post/${post.id}`;
    const textToShare = `${post.content ? `${post.content}\n\n` : ''}צפה בפוסט הזה ב-INNER!`;
    try {
      const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor && (window as any).Capacitor.isNativePlatform?.();
      if (isNative) await Share.share({ title: 'INNER', text: textToShare, url: publicUrl, dialogTitle: 'שתף עם חברים' });
      else if (navigator.share && window.isSecureContext) await navigator.share({ title: 'INNER', text: textToShare, url: publicUrl });
      else {
        await navigator.clipboard.writeText(`${textToShare}\n${publicUrl}`);
        toast.success('הקישור הועתק ללוח');
      }
    } catch {}
  };

  const submitComment = async () => {
    if (!newComment.trim() || !activePost) return;
    try {
      if (editingCommentId) {
        await supabase.from('comments').update({ content: newComment.trim() }).eq('id', editingCommentId);
        setComments((prev) => prev.map((c) => (c.id === editingCommentId ? { ...c, content: newComment.trim() } : c)));
        setEditingCommentId(null);
      } else {
        const payload: any = { post_id: activePost.id, user_id: user?.id, content: newComment.trim() };
        if (replyingTo) payload.parent_id = replyingTo.id;
        const { data: resData } = await supabase.from('comments').insert(payload).select('*, profiles(*)').single();

        if (resData) {
          setComments((prev) => [...prev, resData]);
          const update = (list: any[]) => list.map((p) => p.id === activePost.id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p);
          setData((prev: any) => ({ ...prev, posts: update(prev.posts || []), savedPosts: update(prev.savedPosts || []) }));
          if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));
          if (replyingTo) setExpandedThreads((prev) => ({ ...prev, [replyingTo.id]: true }));
          triggerFeedback('coin');
        }
      }
      setNewComment('');
      setReplyingTo(null);
    } catch { toast.error('שגיאה בשרת'); }
  };

  const deleteComment = async (commentId: string) => {
    triggerFeedback('error');
    setComments((curr) => curr.filter((c) => c && c.id !== commentId && c.parent_id !== commentId));
    try { await supabase.from('comments').delete().eq('id', commentId); } catch {}
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
    } catch { toast.error('לא ניתן להוריד את הקובץ', { id: 'dl' }); }
    if (optionsMenuPost) closeOverlay();
  };

  const handleCopyLink = async (post: any) => {
    const publicUrl = `https://inner-app.com/post/${post.id}`;
    try { await navigator.clipboard.writeText(publicUrl); toast.success('הקישור הועתק ללוח', { icon: '🔗' }); } catch { toast.error('שגיאה בהעתקה'); }
    if (optionsMenuPost || gridActionModal) closeOverlay();
  };

  const deletePost = async (postId: string) => {
    triggerFeedback('error');
    if (optionsMenuPost || gridActionModal) closeOverlay();
    if (fullScreenMedia) setFullScreenMedia((curr) => curr?.filter((p) => p.id !== postId) || null);
    setData((prev: any) => ({ ...prev, posts: (prev.posts || []).filter((p: any) => p.id !== postId), savedPosts: (prev.savedPosts || []).filter((p: any) => p.id !== postId) }));
    await supabase.from('posts').delete().eq('id', postId);
  };

  const removeFromSaved = async (postId: string) => {
    triggerFeedback('pop');
    if (gridActionModal) closeOverlay();
    setData((prev: any) => ({ ...prev, savedPosts: (prev.savedPosts || []).filter((p: any) => p.id !== postId) }));
    try {
      await supabase.from('saved_posts').delete().match({ user_id: currentUserId, post_id: postId });
      toast.success('הוסר מהשמורים');
    } catch { toast.error('שגיאה בהסרה'); }
  };

  const leaveCircle = async (circleId: string) => {
    triggerFeedback('error');
    if (gridActionModal) closeOverlay();
    setData((prev: any) => ({ ...prev, memberships: (prev.memberships || []).filter((m: any) => m.circle?.id !== circleId) }));
    try {
      await supabase.from('circle_members').delete().match({ user_id: currentUserId, circle_id: circleId });
      toast.success('עזבת את המועדון');
    } catch { toast.error('שגיאה בעזיבת המועדון'); }
  };

  const saveEditedPost = async () => {
    if (!editingPost || !editPostText.trim()) return;
    try {
      await supabase.from('posts').update({ content: editPostText.trim() }).eq('id', editingPost.id);
      const update = (list: any[]) => list.map((p) => (p.id === editingPost.id ? { ...p, content: editPostText.trim() } : p));
      setData((prev: any) => ({ ...prev, posts: update(prev.posts || []), savedPosts: update(prev.savedPosts || []) }));
      if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));
      toast.success('הפוסט עודכן');
      closeOverlay();
      setTimeout(() => { setShowCreatePost(false); setEditingPost(null); setEditPostText(''); }, 50);
    } catch { toast.error('שגיאה בעדכון הפוסט'); }
  };

  const toggleCommentLike = (commentId: string) => {
    setLikedComments((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
    triggerFeedback('pop');
  };

  const renderCommentText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(@[\wא-ת]+)/g);
    return parts.map((part, i) => part.startsWith('@') ? <span key={i} className="text-accent-primary font-bold">{part}</span> : <span key={i}>{part}</span>);
  };

  const stopPropagation = (e: any) => e.stopPropagation();

  if (authLoading || loadingData) {
    return <div className="min-h-screen bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" /></div>;
  }

  const userProfile = isMyProfile ? { ...(authProfile || {}), ...(data?.profile || {}) } : data?.profile || {};
  const currentLevel = userProfile.level || 1;
  const currentXP = userProfile.xp || 0;
  const streak = userProfile.streak || 0;
  const xpToNextLevel = currentLevel * 1000;
  const xpProgress = Math.min((currentXP / xpToNextLevel) * 100, 100);
  const trueReputation = Math.floor(currentXP / 10) + currentLevel * 5;
  const joinedCircles = data.memberships?.map((m: any) => m?.circle).filter(Boolean) || [];
  const userPosts = data.posts || [];
  const userSavedPosts = data.savedPosts || [];
  const displayLink = userProfile?.social_link ? userProfile.social_link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : '';

  const aboutItems = [
    { key: 'location', label: 'מתגורר ב', value: userProfile?.location, icon: <MapPin size={16} /> },
    { key: 'relationship_status', label: 'מצב משפחתי', value: userProfile?.relationship_status, icon: <Heart size={16} /> },
    { key: 'education', label: 'השכלה', value: userProfile?.education, icon: <GraduationCap size={16} /> },
    { key: 'job_title', label: 'עיסוק', value: userProfile?.job_title, icon: <Briefcase size={16} /> },
    { key: 'birth_date', label: 'תאריך לידה', value: userProfile?.birth_date ? new Date(userProfile.birth_date).toLocaleDateString('he-IL') : '', icon: <Calendar size={16} /> },
    { key: 'bio', label: 'ביו', value: userProfile?.bio, icon: <Sparkles size={16} />, full: true },
  ].filter((item) => item.value);

  return (
    <div className="bg-surface min-h-screen relative font-sans" dir="rtl">
      
      <div className="fixed top-4 left-4 right-4 flex justify-between items-center z-50 pointer-events-none">
        <div className="w-10" />
        {isMyProfile && (
          <button
            onClick={() => { triggerFeedback('pop'); navigate('/edit-profile'); }}
            className="pointer-events-auto w-10 h-10 flex justify-center items-center bg-surface-card border border-white/[0.05] rounded-full shadow-lg active:scale-90 transition-all hover:bg-white/[0.05]"
          >
            <Edit2 size={16} className="text-brand-muted" />
          </button>
        )}
      </div>

      <motion.div style={{ y: coverY, opacity: coverOpacity, scale: coverScale }} className="fixed top-0 left-0 w-full h-[240px] bg-surface z-0 overflow-hidden origin-top">
        {userProfile.cover_url ? (
          <img src={userProfile.cover_url} className="w-full h-full object-cover opacity-70" />
        ) : (
          <div className="absolute inset-0 bg-surface-card" />
        )}
        <div className="absolute top-6 right-5 flex flex-col items-center">
          <span className="text-accent-primary text-[10px] font-black uppercase tracking-widest mb-0.5">רמה</span>
          <span className="text-brand font-black text-[24px] leading-none drop-shadow-md">{currentLevel}</span>
        </div>
      </motion.div>

      <FadeIn className="relative z-10 pt-[200px] pb-32">
        <div className="bg-surface rounded-t-[40px] px-4 min-h-screen flex flex-col items-center shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/[0.05]">
          
          <motion.div whileHover={{ scale: 1.05 }} className="w-[100px] h-[100px] rounded-full bg-surface p-1.5 relative -mt-[50px] z-20 shadow-xl">
            <div className="w-full h-full rounded-full overflow-hidden bg-surface-card border-2 border-white/[0.05] relative flex items-center justify-center">
              {userProfile?.avatar_url ? (
                <img src={userProfile.avatar_url} className="w-full h-full object-cover object-center" alt="" />
              ) : (
                <UserCircle size={50} className="text-brand-muted" />
              )}
            </div>
          </motion.div>

          <div className="text-center mt-3 w-full">
            <h2 className="text-[22px] font-black text-brand tracking-tight">{userProfile?.full_name || 'משתמש'}</h2>
            <p className="text-brand-muted font-bold text-[13px] tracking-widest mb-5" dir="ltr">@{userProfile?.username || 'user'}</p>

            <div className="flex items-center justify-center gap-3 text-[14px] text-brand-muted font-medium mb-6 w-full max-w-[300px] mx-auto flex-wrap">
              <span className="cursor-pointer hover:text-brand transition-colors" onClick={() => openUsersListSheet('followers')}>עוקבים <span className="font-black text-accent-primary">{followersCount}</span></span>
              <span className="text-white/[0.1]">•</span>
              <span className="cursor-pointer hover:text-brand transition-colors" onClick={() => openUsersListSheet('following')}>נעקבים <span className="font-black text-accent-primary">{followingCount}</span></span>
              <span className="text-white/[0.1]">•</span>
              <span>מוניטין <span className="font-black text-accent-primary">{trueReputation}</span></span>
            </div>

            {!isMyProfile && (
              <div className="flex justify-center gap-3 mb-6 w-full px-2">
                <button
                  onClick={handleFollowToggle} disabled={followLoading}
                  className={`flex-1 h-12 rounded-full font-black text-[14px] flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 ${isFollowing ? 'bg-surface-card text-brand border border-white/[0.05]' : 'bg-accent-primary text-surface shadow-lg'}`}
                >
                  {followLoading ? <Loader2 size={18} className="animate-spin" /> : isFollowing ? 'נעקב' : 'עקוב'}
                </button>
                <button onClick={() => navigate(`/chat/${userProfile.id}`)} className="flex-1 h-12 bg-white/[0.03] text-brand border border-white/[0.05] rounded-full font-black text-[14px] flex items-center justify-center transition-all active:scale-95">
                  הודעה
                </button>
              </div>
            )}

            {(userProfile?.zodiac || userProfile?.social_link || aboutItems.length > 0) && (
              <div className="flex flex-col items-center gap-2 mb-6 w-full">
                {userProfile?.social_link && (
                  <a href={userProfile.social_link.startsWith('http') ? userProfile.social_link : `https://${userProfile.social_link}`} target="_blank" rel="noopener noreferrer" className="text-white text-[13px] font-bold flex items-center gap-1.5 hover:text-white/80 transition-colors">
                    <span dir="ltr" className="tracking-wide">{displayLink}</span>
                    <LinkIcon size={14} className="text-white/60" />
                  </a>
                )}
                {userProfile?.zodiac && <span className="text-brand-muted text-[13px] font-medium">{userProfile.zodiac}</span>}

                {aboutItems.length > 0 && (
                  <div className="w-full max-w-[360px] mt-2">
                    <button onClick={() => { triggerFeedback('pop'); setAboutOpen((prev) => !prev); }} className="w-full flex items-center justify-center gap-2 text-brand-muted hover:text-brand transition-colors">
                      <span className="text-[13px] font-black tracking-wide">אודות</span>
                      {aboutOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    <AnimatePresence initial={false}>
                      {aboutOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="mt-4 bg-surface-card border border-white/[0.05] rounded-[24px] p-4 text-right shadow-lg">
                            <div className="grid grid-cols-1 gap-3">
                              {aboutItems.map((item: any) => (
                                <div key={item.key} className={`flex items-start gap-3 rounded-[16px] border border-white/[0.02] bg-white/[0.02] px-4 py-3 ${item.full ? 'flex-col items-stretch' : ''}`}>
                                  {!item.full ? (
                                    <>
                                      <div className="mt-0.5 text-accent-primary">{item.icon}</div>
                                      <div className="flex-1">
                                        <div className="text-brand-muted text-[10px] font-black tracking-widest mb-1 uppercase">{item.label}</div>
                                        <div className="text-brand text-[13px] font-medium">{item.value}</div>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-2 text-accent-primary">
                                        {item.icon}
                                        <div className="text-brand-muted text-[10px] font-black tracking-widest uppercase">{item.label}</div>
                                      </div>
                                      <div className="text-brand text-[13px] font-medium leading-6 whitespace-pre-wrap">{item.value}</div>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* מדד התקדמות עבה וצבעוני */}
          <div className="w-full flex flex-col gap-3 px-2 mb-6">
            <div className="flex justify-between items-center w-full">
              <span className="text-brand-muted text-[13px] font-bold">רצף: <span className="text-white">{streak} ימים</span></span>
              {isMyProfile && <span className="text-brand-muted text-[13px] font-bold"><span className="text-white">{currentXP}</span> / {xpToNextLevel}</span>}
            </div>
            {isMyProfile && (
              <div className="w-full h-2.5 bg-surface-card rounded-full overflow-hidden relative shadow-inner border border-white/[0.05]">
                <motion.div initial={{ width: 0 }} animate={{ width: `${xpProgress}%` }} transition={{ duration: 1.5, ease: 'easeOut' }} className="absolute top-0 right-0 h-full bg-gradient-to-l from-accent-primary via-indigo-400 to-purple-400 rounded-full" />
              </div>
            )}
          </div>

          <div className="w-full mb-10">
            <div className="flex gap-2 bg-white/[0.03] border border-white/[0.05] p-1.5 rounded-full z-10 relative mb-6 shadow-lg mx-1.5">
              <button onClick={() => setActiveTab('posts')} className={`flex-1 py-3 text-[13px] font-black transition-all rounded-full flex items-center justify-center ${activeTab === 'posts' ? 'bg-surface-card text-brand shadow-md' : 'text-brand-muted hover:text-brand'}`}>פוסטים</button>
              <button onClick={() => setActiveTab('joined')} className={`flex-1 py-3 text-[13px] font-black transition-all rounded-full flex items-center justify-center ${activeTab === 'joined' ? 'bg-surface-card text-brand shadow-md' : 'text-brand-muted hover:text-brand'}`}>מועדונים</button>
              {isMyProfile && <button onClick={() => setActiveTab('saved')} className={`flex-1 py-3 text-[13px] font-black transition-all rounded-full flex items-center justify-center ${activeTab === 'saved' ? 'bg-surface-card text-brand shadow-md' : 'text-brand-muted hover:text-brand'}`}>שמורים</button>}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'posts' && (
                <motion.div key="posts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-3 gap-1">
                  {userPosts.length === 0 ? (
                    <div className="col-span-3 text-center py-10 text-brand-muted text-[14px] font-bold">אין פוסטים עדיין</div>
                  ) : (
                    userPosts.map((post: any) => (
                      <div key={post.id} onClick={() => { openOverlay(() => { const first = { ...post, _uid: `${post.id}-${Math.random().toString(36).slice(2)}` }; const rest = mediaPosts.filter((p: any) => p.id !== post.id).map((p: any) => ({ ...p, _uid: `${p.id}-${Math.random().toString(36).slice(2)}` })); setFullScreenMedia([first, ...rest]); }); }} className="aspect-[4/5] bg-surface-card relative overflow-hidden cursor-pointer active:opacity-70 border border-white/[0.05] rounded-[20px]">
                        {isMyProfile && (
                          <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setGridActionModal({ item: post, type: 'post' })); }} className="absolute top-2 left-2 z-20 p-2 bg-black/50 backdrop-blur-md rounded-full text-brand hover:bg-black/70 transition-colors">
                            <MoreVertical size={16} />
                          </button>
                        )}
                        {post.media_url ? (post.media_type === 'video' ? <video src={post.media_url} className="w-full h-full object-cover" /> : <img src={post.media_url} className="w-full h-full object-cover" />) : <div className="w-full h-full flex items-center justify-center p-2 text-center text-brand-muted text-[11px] line-clamp-3 font-medium">{post.content}</div>}
                      </div>
                    ))
                  )}
                </motion.div>
              )}

              {activeTab === 'joined' && (
                <motion.div key="joined" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-3 gap-1">
                  {joinedCircles.map((circle: any) => (
                    <div key={circle.id} onClick={() => navigate(`/circle/${circle.slug}`)} className="aspect-[4/5] bg-surface-card relative overflow-hidden cursor-pointer border border-white/[0.05] rounded-[20px] group">
                      <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setGridActionModal({ item: circle, type: 'circle' })); }} className="absolute top-2 left-2 z-20 p-2 bg-black/50 backdrop-blur-md rounded-full text-brand hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100 touch-manipulation">
                        <MoreVertical size={16} />
                      </button>
                      {circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover opacity-80" /> : <div className="w-full h-full flex items-center justify-center text-brand-muted font-black text-2xl">{circle.name?.charAt(0)}</div>}
                      <div className="absolute bottom-0 w-full p-2 bg-surface/80 backdrop-blur-sm text-center border-t border-white/[0.05]"><span className="text-brand text-[10px] font-bold line-clamp-1">{circle.name}</span></div>
                    </div>
                  ))}
                </motion.div>
              )}

              {activeTab === 'saved' && isMyProfile && (
                <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-3 gap-1">
                  {userSavedPosts.length === 0 ? (
                    <div className="col-span-3 text-center py-10 text-brand-muted text-[14px] font-bold">אין פוסטים שמורים</div>
                  ) : (
                    userSavedPosts.map((post: any) => (
                      <div key={post.id} onClick={() => { const savedMedia = userSavedPosts.filter((p: any) => p.media_url); openOverlay(() => { const first = { ...post, _uid: `${post.id}-${Math.random().toString(36).slice(2)}` }; const rest = savedMedia.filter((p: any) => p.id !== post.id).map((p: any) => ({ ...p, _uid: `${p.id}-${Math.random().toString(36).slice(2)}` })); setFullScreenMedia([first, ...rest]); }); }} className="aspect-[4/5] bg-surface-card relative overflow-hidden cursor-pointer active:opacity-70 border border-white/[0.05] rounded-[20px]">
                        <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setGridActionModal({ item: post, type: 'saved' })); }} className="absolute top-2 left-2 z-20 p-2 bg-black/50 backdrop-blur-md rounded-full text-brand hover:bg-black/70 transition-colors">
                          <MoreVertical size={16} />
                        </button>
                        {post.media_url ? (post.media_type === 'video' ? <video src={post.media_url} className="w-full h-full object-cover" /> : <img src={post.media_url} className="w-full h-full object-cover" />) : <div className="w-full h-full flex items-center justify-center p-2 text-center text-brand-muted text-[11px] line-clamp-3 font-medium">{post.content}</div>}
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </FadeIn>

      {/* OVERLAYS */}
      {mounted && createPortal(
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
                        {isVid ? <video src={vid.media_url} loop playsInline className="w-full h-full object-cover profile-full-media-item" onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())} /> : <img src={vid.media_url} className="w-full h-full object-contain profile-full-media-item" />}
                        <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setOptionsMenuPost(vid)); }} className="absolute bottom-8 left-4 z-[60] active:scale-90 transition-transform drop-shadow-md"><MoreVertical size={26} className="text-brand" /></button>
                        <div className="absolute bottom-48 left-4 flex flex-col gap-6 items-center z-50">
                          <button onClick={(e) => { e.stopPropagation(); handleLike(vid.id, vid.is_liked); }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
                            <Heart size={32} className={vid.is_liked ? 'text-[#ff4757]' : 'text-brand'} fill={vid.is_liked ? 'currentColor' : 'none'} strokeWidth={1.5} />
                            <span className="text-brand text-[13px] font-black drop-shadow-md">{vid.likes_count}</span>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); openOverlay(() => { setActivePost(vid); setActiveCommentsPostId(vid.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', vid.id).order('created_at', { ascending: true }).then((r) => { setComments(r.data || []); setLoadingComments(false); }); }); }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
                            <MessageSquare size={32} className="text-brand" strokeWidth={1.5} />
                            <span className="text-brand text-[13px] font-black drop-shadow-md">{vid.comments_count}</span>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleShare(vid); }} className="active:scale-90 transition-transform"><Share2 size={32} className="text-brand" strokeWidth={1.5} /></button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-surface/90 via-surface/40 to-transparent flex flex-col justify-end pointer-events-none">
                          <div className="flex items-center gap-3 mb-3 cursor-pointer w-fit pr-2 pointer-events-auto" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${vid.user_id}`), 50); }}>
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-card border-2 border-white/[0.05] shrink-0 shadow-lg">
                              {vid.profiles?.avatar_url ? <img src={vid.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={24} className="text-brand-muted w-full h-full p-2" />}
                            </div>
                            <span className="text-brand font-black text-[18px] drop-shadow-md">{vid.profiles?.full_name || 'אנונימי'}</span>
                          </div>
                          <p className="text-brand-muted text-[15px] font-medium text-right pr-2 w-5/6 line-clamp-3 pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); openOverlay(() => setActiveDescPost(vid)); }}>{vid.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {gridActionModal && (
              <div className="fixed inset-0 z-[100000] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-surface/80 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] p-6 flex flex-col gap-2 pb-12 shadow-[0_-10px_50px_rgba(0,0,0,0.8)] border-t border-white/[0.05]" onPointerDown={(e) => gridActionDragControls.start(e)} style={{ touchAction: 'none' }}>
                  <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/[0.1] rounded-full" /></div>
                  
                  {gridActionModal.type === 'post' && (
                    <>
                      <button onClick={() => { closeOverlay(); setTimeout(() => { openOverlay(() => { setEditingPost(gridActionModal.item); setEditPostText(gridActionModal.item.content || ''); setShowCreatePost(true); }); }, 100); }} className="w-full p-4 bg-surface-card border border-white/[0.05] rounded-[20px] text-brand font-bold flex justify-between items-center text-lg hover:bg-white/[0.05] transition-colors"><span>ערוך פוסט</span><Edit2 size={20} className="text-brand-muted" /></button>
                      <button onClick={() => { if (window.confirm('למחוק פוסט?')) deletePost(gridActionModal.item.id); }} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-[20px] text-red-500 font-bold flex justify-between items-center text-lg mt-2 hover:bg-red-500/20 transition-colors"><span>מחק פוסט</span><Trash2 size={20} className="text-red-500" /></button>
                    </>
                  )}

                  {gridActionModal.type === 'saved' && (
                    <button onClick={() => removeFromSaved(gridActionModal.item.id)} className="w-full p-4 bg-surface-card border border-white/[0.05] rounded-[20px] text-brand font-bold flex justify-between items-center text-lg hover:bg-white/[0.05] transition-colors"><span>הסר משמורים</span><Bookmark size={20} className="text-brand-muted" /></button>
                  )}

                  {gridActionModal.type === 'circle' && (
                    <>
                      <button onClick={() => { closeOverlay(); setTimeout(() => { navigate(`/circle/${gridActionModal.item.slug}`); }, 100); }} className="w-full p-4 bg-surface-card border border-white/[0.05] rounded-[20px] text-brand font-bold flex justify-between items-center text-lg hover:bg-white/[0.05] transition-colors"><span>כנס למועדון</span><LinkIcon size={20} className="text-brand-muted" /></button>
                      <button onClick={() => { if (window.confirm('לעזוב את המועדון?')) leaveCircle(gridActionModal.item.id); }} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-[20px] text-red-500 font-bold flex justify-between items-center text-lg mt-2 hover:bg-red-500/20 transition-colors"><span>עזוב מועדון</span><LogOut size={20} className="text-red-500" /></button>
                    </>
                  )}
                </motion.div>
              </div>
            )}

            {activeCommentsPostId && (
              <div className="fixed inset-0 z-[100000] flex flex-col justify-end" dir="rtl" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-surface/80 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="relative z-10 bg-surface rounded-t-[40px] h-[85vh] flex flex-col overflow-hidden pb-10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-white/[0.05]">
                  <div className="w-full py-5 flex justify-center cursor-grab active:cursor-grabbing border-b border-white/[0.05]" onPointerDown={(e) => commentsDragControls.start(e)} style={{ touchAction: 'none' }}><div className="w-16 h-1.5 bg-white/[0.1] rounded-full" /></div>
                  <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6" onPointerDown={stopPropagation} onTouchStart={stopPropagation}>
                    {loadingComments ? <Loader2 className="animate-spin mx-auto text-accent-primary mt-10" /> : comments.filter((c) => c && !c.parent_id).map((c) => {
                      const replies = comments.filter((r) => r && r.parent_id === c.id);
                      const isThreadExpanded = expandedThreads[c.id];
                      return (
                        <div key={c.id} className="flex flex-col gap-2">
                          <div className="flex gap-3">
                            <div className="w-10 h-10 min-w-[40px] rounded-full bg-surface-card shrink-0 overflow-hidden cursor-pointer border border-white/[0.05] flex items-center justify-center" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>
                              {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover object-center" /> : <UserCircle className="w-full h-full p-2 text-brand-muted" />}
                            </div>
                            <div className="flex flex-col flex-1">
                              <div className="bg-surface-card p-3 rounded-[20px] rounded-tr-sm cursor-pointer" onClick={() => openOverlay(() => setCommentActionModal(c))}>
                                <span className="text-brand font-bold text-xs mb-1 inline-block" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>{c.profiles?.full_name || 'אנונימי'}</span>
                                <p className="text-brand-muted text-sm whitespace-pre-wrap leading-relaxed">{renderCommentText(c.content)}</p>
                              </div>
                              <div className="flex items-center gap-4 mt-2 px-2">
                                <span className="text-[11px] text-brand-muted cursor-pointer font-medium hover:text-brand" onClick={() => { setReplyingTo(c); setNewComment(`@${c.profiles?.full_name} `); }}>השב</span>
                                <button onClick={() => toggleCommentLike(c.id)} className={`ml-auto flex items-center gap-1 ${likedComments.has(c.id) ? 'text-[#ff4757]' : 'text-brand-muted'}`}><Heart size={12} fill={likedComments.has(c.id) ? 'currentColor' : 'none'} /></button>
                              </div>
                              {replies.length > 0 && <button onClick={() => setExpandedThreads((prev) => ({ ...prev, [c.id]: !prev[c.id] }))} className="text-left text-[11px] font-bold text-brand-muted hover:text-brand mt-2 flex items-center gap-1"><span className="flex-1 border-t border-white/[0.05] mr-2" />{isThreadExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}{isThreadExpanded ? 'הסתר תגובות' : `צפה ב-${replies.length} תגובות`}</button>}
                            </div>
                          </div>
                          {isThreadExpanded && replies.map((reply) => (
                            <div key={reply.id} className="flex gap-3 pr-10 mt-2 relative">
                              <div className="absolute right-[20px] top-[-10px] bottom-6 border-r-2 border-white/[0.05] rounded-br-xl w-4" />
                              <div className="w-8 h-8 min-w-[32px] rounded-full bg-surface-card shrink-0 overflow-hidden cursor-pointer z-10 border border-white/[0.05] flex items-center justify-center" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${reply.user_id}`), 50); }}>
                                {reply.profiles?.avatar_url ? <img src={reply.profiles.avatar_url} className="w-full h-full object-cover object-center" /> : <UserCircle className="w-full h-full p-1.5 text-brand-muted" />}
                              </div>
                              <div className="flex flex-col flex-1 z-10">
                                <div className="bg-surface-card p-3 rounded-[20px] rounded-tr-sm cursor-pointer" onClick={() => openOverlay(() => setCommentActionModal(reply))}>
                                  <span className="text-brand font-bold text-[11px] mb-1 inline-block" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${reply.user_id}`), 50); }}>{reply.profiles?.full_name || 'אנונימי'}</span>
                                  <p className="text-brand-muted text-[13px] whitespace-pre-wrap leading-relaxed">{renderCommentText(reply.content)}</p>
                                </div>
                                <div className="flex items-center gap-4 mt-2 px-2">
                                  <span className="text-[10px] text-brand-muted cursor-pointer font-medium hover:text-brand" onClick={() => { setReplyingTo(c); setNewComment(`@${reply.profiles?.full_name} `); }}>השב</span>
                                  <button onClick={() => toggleCommentLike(reply.id)} className={`ml-auto flex items-center gap-1 ${likedComments.has(reply.id) ? 'text-[#ff4757]' : 'text-brand-muted'}`}><Heart size={10} fill={likedComments.has(reply.id) ? 'currentColor' : 'none'} /></button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                  <div className="p-4 border-t border-white/[0.05] flex flex-col gap-2 bg-surface" onPointerDown={stopPropagation}>
                    {replyingTo && !editingCommentId && <div className="text-[11px] text-accent-primary flex items-center justify-between px-3 py-1 bg-accent-primary/10 rounded-full w-fit mb-1"><span className="font-bold mr-1">משיב ל-@{replyingTo.profiles?.full_name}</span><X size={12} className="cursor-pointer" onClick={() => { setReplyingTo(null); setNewComment(''); }} /></div>}
                    {editingCommentId && <div className="text-[10px] text-accent-primary flex justify-between px-2"><span>עורך תגובה...</span><span onClick={() => { setEditingCommentId(null); setNewComment(''); }} className="cursor-pointer font-bold">ביטול</span></div>}
                    <div className="flex gap-2 items-center bg-surface-card rounded-full p-1 pl-2 border border-white/[0.05]">
                      <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="הוסף תגובה..." className="flex-1 bg-transparent px-4 text-brand text-sm outline-none placeholder:text-brand-muted" />
                      <button onClick={submitComment} disabled={!newComment.trim()} className="w-9 h-9 bg-accent-primary rounded-full flex items-center justify-center text-surface active:scale-95 disabled:opacity-50 transition-opacity"><Send size={16} className="rtl:-scale-x-100 -ml-0.5" /></button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            {optionsMenuPost && (
              <div className="fixed inset-0 z-[100000] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-surface/80 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] p-6 flex flex-col gap-2 pb-12 shadow-[0_-10px_50px_rgba(0,0,0,0.8)] border-t border-white/[0.05]">
                  <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/[0.1] rounded-full" /></div>
                  <button onClick={() => { closeOverlay(); setTimeout(() => handleShare(optionsMenuPost), 100); }} className="w-full p-4 bg-surface-card border border-white/[0.05] rounded-[20px] text-brand font-bold flex justify-between items-center text-lg hover:bg-white/[0.05] transition-colors"><span>שתף פוסט</span><Share2 size={20} className="text-brand-muted" /></button>
                  {optionsMenuPost.media_url && <button onClick={() => handleDownloadMedia(optionsMenuPost.media_url)} className="w-full p-4 bg-surface-card border border-white/[0.05] rounded-[20px] text-brand font-bold flex justify-between items-center text-lg hover:bg-white/[0.05] transition-colors mt-2"><span>שמור למכשיר</span><Download size={20} className="text-brand-muted" /></button>}
                  <button onClick={async () => { try { await supabase.from('saved_posts').insert({ user_id: currentUserId, post_id: optionsMenuPost.id }); toast.success('הפוסט נשמר במועדפים!'); } catch { toast.error('הפוסט כבר שמור אצלך'); } closeOverlay(); }} className="w-full p-4 bg-surface-card border border-white/[0.05] rounded-[20px] text-brand font-bold flex justify-between items-center text-lg hover:bg-white/[0.05] transition-colors mt-2"><span>שמור במועדפים</span><Bookmark size={20} className="text-brand-muted" /></button>
                  <button onClick={() => handleCopyLink(optionsMenuPost)} className="w-full p-4 bg-surface-card border border-white/[0.05] rounded-[20px] text-brand font-bold flex justify-between items-center text-lg hover:bg-white/[0.05] transition-colors mt-2"><span>העתק קישור</span><LinkIcon size={20} className="text-brand-muted" /></button>
                  {optionsMenuPost.user_id === currentUserId && (
                    <>
                      <button onClick={() => { closeOverlay(); setTimeout(() => { openOverlay(() => { setEditingPost(optionsMenuPost); setEditPostText(optionsMenuPost.content || ''); setShowCreatePost(true); }); }, 100); }} className="w-full p-4 bg-surface-card border border-white/[0.05] rounded-[20px] text-brand font-bold flex justify-between items-center text-lg hover:bg-white/[0.05] transition-colors mt-4"><span>ערוך פוסט</span><Edit2 size={20} className="text-brand-muted" /></button>
                      <button onClick={() => { if (window.confirm('למחוק פוסט?')) deletePost(optionsMenuPost.id); }} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-[20px] text-red-500 font-bold flex justify-between items-center text-lg mt-2 hover:bg-red-500/20 transition-colors"><span>מחק פוסט</span><Trash2 size={20} className="text-red-500" /></button>
                    </>
                  )}
                </motion.div>
              </div>
            )}

            {commentActionModal && (
              <div className="fixed inset-0 z-[100000] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-surface/80 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] p-6 flex flex-col gap-3 pb-12 shadow-[0_-10px_50px_rgba(0,0,0,0.8)] border-t border-white/[0.05]">
                  <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/[0.1] rounded-full" /></div>
                  <button onClick={() => { closeOverlay(); setReplyingTo(commentActionModal.parent_id ? comments.find((c) => c?.id === commentActionModal.parent_id) : commentActionModal); setNewComment(`@${commentActionModal.profiles?.full_name} `); }} className="w-full p-4 bg-surface-card border border-white/[0.05] rounded-[20px] text-brand font-bold flex justify-between items-center text-lg hover:bg-white/[0.05] transition-colors"><span>השב לתגובה</span><Reply size={20} className="text-brand-muted" /></button>
                  {commentActionModal.user_id === currentUserId && (
                    <>
                      <button onClick={() => { closeOverlay(); setEditingCommentId(commentActionModal.id); setNewComment(commentActionModal.content); }} className="w-full p-4 bg-surface-card border border-white/[0.05] rounded-[20px] text-brand font-bold flex justify-between items-center text-lg hover:bg-white/[0.05] transition-colors"><span>ערוך תגובה</span><Edit2 size={20} className="text-brand-muted" /></button>
                      <button onClick={() => { if (window.confirm('למחוק תגובה?')) { closeOverlay(); deleteComment(commentActionModal.id); } }} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-[20px] text-red-500 font-bold flex justify-between items-center text-lg mt-2 hover:bg-red-500/20 transition-colors"><span>מחק תגובה</span><Trash2 size={20} className="text-red-500" /></button>
                    </>
                  )}
                </motion.div>
              </div>
            )}

            {activeDescPost && (
              <div className="fixed inset-0 z-[100000] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-surface/80 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] flex flex-col overflow-hidden pb-10 max-h-[75vh] shadow-[0_-10px_50px_rgba(0,0,0,0.8)] border-t border-white/[0.05]">
                  <div className="w-full py-6 flex justify-center cursor-grab active:cursor-grabbing border-b border-white/[0.05]"><div className="w-16 h-1.5 bg-white/[0.1] rounded-full" /></div>
                  <div className="px-6 py-4 border-b border-white/[0.05]"><h2 className="text-brand font-black text-lg text-center">תיאור מלא</h2></div>
                  <div className="p-6 overflow-y-auto" onPointerDown={stopPropagation} onTouchStart={stopPropagation}><p className="text-brand-muted text-[15px] leading-relaxed text-right whitespace-pre-wrap">{activeDescPost.content}</p></div>
                </motion.div>
              </div>
            )}

            {(showFollowersList || showFollowingList) && (
              <div className="fixed inset-0 z-[100000] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-surface/80 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] p-6 pb-10 max-h-[75vh] border-t border-white/[0.05] shadow-[0_-10px_50px_rgba(0,0,0,0.8)]">
                  <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing" onPointerDown={(e) => (showFollowersList ? followersDragControls.start(e) : followingDragControls.start(e))} style={{ touchAction: 'none' }}><div className="w-16 h-1.5 bg-white/[0.1] rounded-full" /></div>
                  <h3 className="text-brand text-lg font-black text-center mb-5">{showFollowersList ? 'עוקבים' : 'נעקבים'}</h3>
                  <div className="overflow-y-auto max-h-[58vh] flex flex-col gap-3">
                    {loadingUsersList ? <Loader2 className="animate-spin mx-auto text-accent-primary mt-6" /> : usersListData.length === 0 ? <div className="text-center text-brand-muted text-sm py-10">אין נתונים להצגה</div> : usersListData.map((item: any) => (
                      <button key={item.id} onClick={() => { closeOverlay(); setTimeout(() => navigate(`/profile/${item.username || item.id}`), 50); }} className="w-full flex items-center gap-4 bg-surface-card border border-white/[0.05] rounded-[20px] p-3 active:scale-[0.99] transition-transform">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-surface border border-white/[0.05] shrink-0">{item.avatar_url ? <img src={item.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full p-2 text-brand-muted" />}</div>
                        <div className="flex-1 text-right"><div className="text-brand font-black text-[15px]">{item.full_name || 'משתמש'}</div><div className="text-brand-muted text-[12px]" dir="ltr">@{item.username || 'user'}</div></div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </div>
            )}

            {showCreatePost && (
              <div className="fixed inset-0 z-[100000] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-surface/80 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] p-6 flex flex-col gap-4 pb-12 border-t border-white/[0.05] shadow-[0_-10px_50px_rgba(0,0,0,0.8)]">
                  <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/[0.1] rounded-full" /></div>
                  <div className="flex justify-between items-center"><h3 className="text-brand font-black text-lg">עריכת פוסט</h3><button onClick={closeOverlay} className="text-brand-muted hover:text-brand"><X size={20} /></button></div>
                  <textarea value={editPostText} onChange={(e) => setEditPostText(e.target.value)} placeholder="כתוב משהו..." className="h-36 bg-surface-card rounded-[20px] p-5 text-brand text-[16px] outline-none resize-none border border-white/[0.05] placeholder:text-brand-muted shadow-inner" />
                  <Button onClick={saveEditedPost} disabled={!editPostText.trim()} className="h-14 bg-accent-primary text-surface font-black rounded-[20px] mt-2 shadow-lg">שמור עריכה</Button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>,
        document.body
      )}
    </div>
  );
};
