import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls, useScroll, useTransform } from 'framer-motion';
import { 
  UserCircle, Loader2, MessageSquare, MoreVertical, MoreHorizontal, Share2, Reply, Trash2, X, Send, Download, 
  Link as LinkIcon, Edit2, Bookmark, MapPin, GraduationCap, ChevronDown, ChevronUp, Briefcase, Calendar, 
  Sparkles, LogOut, Crown, Flame, Diamond, Handshake, Heart, Users, ArrowLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { Share } from '@capacitor/share';

const SEAL_TYPES = [
  { id: 'fire', icon: <Flame size={24} />, label: 'אש', color: 'text-orange-500', xp: 15 },
  { id: 'diamond', icon: <Diamond size={24} />, label: 'יהלום', color: 'text-blue-400', xp: 50 },
  { id: 'alliance', icon: <Handshake size={24} />, label: 'ברית', color: 'text-emerald-400', xp: 100 }
];

const getZodiacIcon = (zodiac: string) => {
  const map: Record<string, string> = {
    'טלה': '♈', 'שור': '♉', 'תאומים': '♊', 'סרטן': '♋',
    'אריה': '♌', 'בתולה': '♍', 'מאזניים': '♎', 'עקרב': '♏',
    'קשת': '♐', 'גדי': '♑', 'דלי': '♒', 'דגים': '♓'
  };
  return map[zodiac] || '✨';
};

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { username: routeId } = useParams<{ username?: string }>();
  const { user, profile: authProfile, loading: authLoading } = useAuth() as any;

  const [mounted, setMounted] = useState(false);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  const commentsDragControls = useDragControls();
  const gridActionDragControls = useDragControls();

  const { scrollY } = useScroll();
  const coverY = useTransform(scrollY, [0, 250], [0, -100]);
  const coverOpacity = useTransform(scrollY, [0, 200], [1, 0.2]);

  const isMyProfile = !routeId || routeId === authProfile?.username || routeId === user?.id;

  const [data, setData] = useState<any>(() => {
    if (isMyProfile) {
      try {
        const cached = localStorage.getItem('inner_profile_cache');
        return cached ? JSON.parse(cached) : { profile: {}, memberships: [], ownedCircles: [], posts: [], savedPosts: [] };
      } catch { return { profile: {}, memberships: [], ownedCircles: [], posts: [], savedPosts: [] }; }
    }
    return { profile: {}, memberships: [], ownedCircles: [], posts: [], savedPosts: [] };
  });

  const [loadingData, setLoadingData] = useState(!data.profile?.id);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  
  const [showFollowersList, setShowFollowersList] = useState(false);
  const [showFollowingList, setShowFollowingList] = useState(false);
  const [usersListData, setUsersListData] = useState<any[]>([]);
  const [loadingUsersList, setLoadingUsersList] = useState(false);

  const [activeTab, setActiveTab] = useState<'posts' | 'circles' | 'saved'>('posts');
  
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
  const [commentActionModal, setCommentActionModal] = useState<any | null>(null);

  const [optionsMenuPost, setOptionsMenuPost] = useState<any>(null);
  const [activeDescPost, setActiveDescPost] = useState<any>(null);
  const [gridActionModal, setGridActionModal] = useState<{ item: any, type: 'post' | 'saved' | 'circle' } | null>(null);
  const [sealSelectorPost, setSealSelectorPost] = useState<any | null>(null);
  const [postCirclesModal, setPostCirclesModal] = useState<{ circles: any[], userId: string } | null>(null);

  const [currentUserId, setCurrentUserId] = useState('');
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [editPostText, setEditPostText] = useState('');
  const [extraInfoOpen, setExtraInfoOpen] = useState(false);
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  const stateRef = useRef({
    comments: false, options: false, desc: false, fullscreen: false, commentAction: false,
    followers: false, following: false, create: false, gridAction: false, seals: false, postCircles: false
  });

  const openOverlay = (action: () => void) => { window.history.pushState({ overlay: true }, ''); action(); };
  const closeOverlay = () => { window.history.back(); };

  useEffect(() => { setMounted(true); setPortalNode(document.getElementById('root') || document.body); }, []);

  useEffect(() => {
    stateRef.current = {
      comments: !!activeCommentsPostId, options: !!optionsMenuPost, desc: !!activeDescPost,
      fullscreen: !!fullScreenMedia, commentAction: !!commentActionModal, followers: showFollowersList,
      following: showFollowingList, create: showCreatePost, gridAction: !!gridActionModal, seals: !!sealSelectorPost, postCircles: !!postCirclesModal
    };
  }, [activeCommentsPostId, optionsMenuPost, activeDescPost, fullScreenMedia, commentActionModal, showFollowersList, showFollowingList, showCreatePost, gridActionModal, sealSelectorPost, postCirclesModal]);

  useEffect(() => {
    const handlePopState = () => {
      const s = stateRef.current;
      if (s.postCircles) setPostCirclesModal(null);
      else if (s.gridAction) setGridActionModal(null);
      else if (s.commentAction) setCommentActionModal(null);
      else if (s.seals) setSealSelectorPost(null);
      else if (s.followers) setShowFollowersList(false);
      else if (s.following) setShowFollowingList(false);
      else if (s.comments) { setActiveCommentsPostId(null); setActivePost(null); setReplyingTo(null); setEditingCommentId(null); setNewComment(''); }
      else if (s.options) setOptionsMenuPost(null);
      else if (s.desc) setActiveDescPost(null);
      else if (s.create) { setShowCreatePost(false); setEditingPost(null); setEditPostText(''); }
      else if (s.fullscreen) setFullScreenMedia(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadProfileData = async () => {
      try {
        if (!data.profile?.id) setLoadingData(true);
        const { data: authData } = await supabase.auth.getUser();
        const me = authData.user?.id || '';
        if (me) setCurrentUserId(me);

        let targetId = '';
        if (isMyProfile) {
          const headers = me ? { 'x-user-id': me } : {};
          const result = await apiFetch<any>('/api/profile/collection', { headers }).catch(() => ({ profile: authProfile }));
          targetId = result.profile?.id || authProfile?.id || me;

          const [{ data: memberships }, { data: ownedCircles }, { data: myPosts }, { data: freshProfile }] = await Promise.all([
            supabase.from('circle_members').select('circle:circles(*)').eq('user_id', targetId).neq('role', 'admin'),
            supabase.from('circles').select('*').eq('owner_id', targetId),
            supabase.from('posts').select('*, seals:post_seals(id, seal_type, user_id), comments_count:comments(count)').eq('user_id', targetId).order('created_at', { ascending: false }),
            supabase.from('profiles').select('*').eq('id', targetId).single()
          ]);

          const formattedPosts = (myPosts || []).map((p: any) => ({
            ...p, seals_count: p.seals?.length || 0, has_sealed: !!me && p.seals?.some((s: any) => s.user_id === me),
            comments_count: p.comments_count?.[0]?.count || 0, profiles: freshProfile || result.profile || authProfile
          }));

          let mySavedPosts: any[] = [];
          try {
            const { data: saved } = await supabase.from('saved_posts').select('post_id, posts(*, seals:post_seals(id, seal_type, user_id), comments_count:comments(count), profiles:user_id(*))').eq('user_id', targetId);
            mySavedPosts = saved?.map((s: any) => {
              if(!s.posts) return null;
              return {
                ...s.posts, seals_count: s.posts.seals?.length || 0, has_sealed: !!me && s.posts.seals?.some((seal: any) => seal.user_id === me),
                comments_count: s.posts.comments_count?.[0]?.count || 0
              };
            }).filter(Boolean) || [];
          } catch {}

          if (isMounted) {
            const freshData = { profile: freshProfile || result.profile || authProfile, memberships: memberships || result.memberships || [], ownedCircles: ownedCircles || result.ownedCircles || [], posts: formattedPosts, savedPosts: mySavedPosts };
            setData(freshData);
            localStorage.setItem('inner_profile_cache', JSON.stringify(freshData));
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
            supabase.from('posts').select('*, seals:post_seals(id, seal_type, user_id), comments_count:comments(count)').eq('user_id', targetId).order('created_at', { ascending: false }),
          ]);

          const formattedPosts = (userPosts || []).map((p: any) => ({
            ...p, seals_count: p.seals?.length || 0, has_sealed: !!me && p.seals?.some((s: any) => s.user_id === me),
            comments_count: p.comments_count?.[0]?.count || 0, profiles: publicProfile
          }));

          let isFollowingUser = false;
          if (me) {
            try {
              const { data: followData } = await supabase.from('followers').select('*').eq('follower_id', me).eq('following_id', targetId).maybeSingle();
              if (followData) isFollowingUser = true;
            } catch {}
          }

          if (isMounted) {
            setData({ profile: publicProfile, memberships: memberships || [], ownedCircles: ownedCircles || [], posts: formattedPosts, savedPosts: [] });
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
        if (!data.profile?.id) { toast.error('הפרופיל לא נמצא'); navigate('/'); }
      } finally {
        if (isMounted) setLoadingData(false);
      }
    };

    if (!authLoading) loadProfileData();
    return () => { isMounted = false; };
  }, [user, routeId, isMyProfile, authLoading, navigate, authProfile]);

  useEffect(() => {
    if (!data.profile?.id) return;
    const channel = supabase.channel(`profile_sync_${data.profile.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${data.profile.id}` }, (payload) => {
        setData((prev: any) => ({ ...prev, profile: { ...prev.profile, ...payload.new } }));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [data.profile?.id]);

  const mediaPosts = useMemo(() => {
    const pool = activeTab === 'saved' && isMyProfile ? data.savedPosts || [] : data.posts || [];
    return pool.filter((p: any) => p.media_url);
  }, [data.posts, data.savedPosts, activeTab, isMyProfile]);

  const allMyCircles = useMemo(() => {
    const owned = data.ownedCircles || [];
    const joined = data.memberships?.map((m: any) => m?.circle).filter(Boolean) || [];
    const map = new Map();
    owned.forEach((c: any) => map.set(c.id, { ...c, isOwner: true }));
    joined.forEach((c: any) => { if (!map.has(c.id)) map.set(c.id, { ...c, isOwner: false }); });
    return Array.from(map.values()).sort((a, b) => {
      if (a.isOwner && !b.isOwner) return -1;
      if (!a.isOwner && b.isOwner) return 1;
      return 0;
    });
  }, [data.ownedCircles, data.memberships]);

  const getRandomMediaBatch = (size = 4) => {
    if (!mediaPosts.length) return [];
    return Array.from({ length: size }).map(() => {
      const picked = mediaPosts[Math.floor(Math.random() * mediaPosts.length)];
      return { ...picked, _uid: `${picked.id}-${Math.random().toString(36).slice(2)}` };
    });
  };

  useEffect(() => {
    if (!fullScreenMedia) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const vid = entry.target as HTMLVideoElement;
        if (vid.tagName !== 'VIDEO') return;
        if (entry.isIntersecting) { vid.muted = false; vid.play().catch(() => {}); }
        else { vid.pause(); vid.muted = true; vid.currentTime = 0; }
      });
    }, { threshold: 0.7 });
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
      if (isFollowing) { setIsFollowing(false); setFollowersCount((prev) => Math.max(0, prev - 1)); }
      else { setIsFollowing(true); setFollowersCount((prev) => prev + 1); triggerFeedback('success'); }
    } catch { toast.error('שגיאה'); } finally { setFollowLoading(false); }
  };

  const openUsersListSheet = async (type: 'followers' | 'following') => {
    triggerFeedback('pop');
    openOverlay(() => { if (type === 'followers') setShowFollowersList(true); else setShowFollowingList(true); });
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
    } catch { toast.error('שגיאה בטעינת הרשימה'); } finally { setLoadingUsersList(false); }
  };

  const handleRemoveSeal = async (postId: string) => {
    triggerFeedback('pop');
    const update = (list: any[]) => list.map((p) => p.id === postId ? { ...p, has_sealed: false, seals_count: Math.max(0, (p.seals_count || 0) - 1) } : p);
    setData((prev: any) => ({ ...prev, posts: update(prev.posts || []), savedPosts: update(prev.savedPosts || []) }));
    if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));
    try { await supabase.from('post_seals').delete().match({ post_id: postId, user_id: currentUserId }); } catch (err) { toast.error('שגיאה בהסרת חותם'); }
  };

  const handleSeal = async (postId: string, sealType: string) => {
    triggerFeedback('pop');
    closeOverlay();
    const update = (list: any[]) => list.map((p) => p.id === postId ? { ...p, has_sealed: true, seals_count: (p.seals_count || 0) + 1 } : p);
    setData((prev: any) => ({ ...prev, posts: update(prev.posts || []), savedPosts: update(prev.savedPosts || []) }));
    if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));
    try {
      const { error } = await supabase.from('post_seals').insert({ post_id: postId, user_id: currentUserId, seal_type: sealType });
      if (error) {
        if (error.code === '23505') toast.error('כבר נתת חותם לפוסט זה');
        else throw error;
        const revert = (list: any[]) => list.map((p) => p.id === postId ? { ...p, has_sealed: false, seals_count: Math.max(0, (p.seals_count || 0) - 1) } : p);
        setData((prev: any) => ({ ...prev, posts: revert(prev.posts || []), savedPosts: revert(prev.savedPosts || []) }));
      } else { triggerFeedback('success'); }
    } catch (err) { toast.error('שגיאה בהענקת חותם'); }
  };

  const handleShare = async (post: any) => {
    triggerFeedback('pop');
    const publicUrl = `https://inner-app.com/post/${post.id}`;
    const textToShare = `${post.content ? `${post.content}\n\n` : ''}צפה בפוסט הזה ב-INNER!`;
    try {
      const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor && (window as any).Capacitor.isNativePlatform?.();
      if (isNative) await Share.share({ title: 'INNER', text: textToShare, url: publicUrl, dialogTitle: 'שתף עם חברים' });
      else if (navigator.share && window.isSecureContext) await navigator.share({ title: 'INNER', text: textToShare, url: publicUrl });
      else { await navigator.clipboard.writeText(`${textToShare}\n${publicUrl}`); toast.success('הקישור הועתק ללוח'); }
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
        const payload: any = { post_id: activePost.id, user_id: currentUserId, content: newComment.trim() };
        if (replyingTo) payload.parent_id = replyingTo.id;
        const { data: resData } = await supabase.from('comments').insert(payload).select('*, profiles(*)').single();
        if (resData) {
          setComments((prev) => [...prev, resData]);
          const update = (list: any[]) => list.map((p) => p.id === activePost.id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p);
          setData((prev: any) => ({ ...prev, posts: update(prev.posts || []), savedPosts: update(prev.savedPosts || []) }));
          if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));
          triggerFeedback('coin');
        }
      }
      setNewComment(''); setReplyingTo(null);
    } catch { toast.error('שגיאה בשרת'); }
  };

  const deleteComment = async (commentId: string) => {
    triggerFeedback('error');
    setComments((curr) => curr.filter((c) => c && c.id !== commentId && c.parent_id !== commentId));
    const update = (list: any[]) => list.map((p) => p.id === activePost?.id ? { ...p, comments_count: Math.max(0, (p.comments_count || 0) - 1) } : p);
    setData((prev: any) => ({ ...prev, posts: update(prev.posts || []), savedPosts: update(prev.savedPosts || []) }));
    if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));
    try { await supabase.from('comments').delete().eq('id', commentId); } catch {}
  };

  const handleDownloadMedia = async (mediaUrl: string) => {
    try {
      toast.loading('מוריד קובץ...', { id: 'dl' });
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `INNER_Media_${Date.now()}`;
      document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a);
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
    try { await supabase.from('saved_posts').delete().match({ user_id: currentUserId, post_id: postId }); toast.success('הוסר מהשמורים'); } catch { toast.error('שגיאה בהסרה'); }
  };

  const leaveCircle = async (circleId: string) => {
    triggerFeedback('error');
    if (gridActionModal) closeOverlay();
    setData((prev: any) => ({ ...prev, memberships: (prev.memberships || []).filter((m: any) => m.circle?.id !== circleId) }));
    try { await supabase.from('circle_members').delete().match({ user_id: currentUserId, circle_id: circleId }); toast.success('עזבת את המועדון'); } catch { toast.error('שגיאה בעזיבת המועדון'); }
  };

  const saveEditedPost = async () => {
    if (!editingPost || !editPostText.trim()) return;
    try {
      await supabase.from('posts').update({ content: editPostText.trim() }).eq('id', editingPost.id);
      const update = (list: any[]) => list.map((p) => (p.id === editingPost.id ? { ...p, content: editPostText.trim() } : p));
      setData((prev: any) => ({ ...prev, posts: update(prev.posts || []), savedPosts: update(prev.savedPosts || []) }));
      if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));
      toast.success('הפוסט עודכן'); closeOverlay();
      setTimeout(() => { setShowCreatePost(false); setEditingPost(null); setEditPostText(''); }, 50);
    } catch { toast.error('שגיאה בעדכון הפוסט'); }
  };

  const stopPropagation = (e: any) => e.stopPropagation();

  if ((authLoading || loadingData) && !data.profile?.id) {
    return <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" size={32} /></div>;
  }

  const userProfile = isMyProfile ? { ...(authProfile || {}), ...(data?.profile || {}) } : data?.profile || {};
  const currentLevel = userProfile.level || 1;
  const currentXP = userProfile.xp || 0;
  const xpToNextLevel = currentLevel * 1000;
  const xpProgress = Math.min((currentXP / xpToNextLevel) * 100, 100);
  const trueReputation = Math.floor(currentXP / 10) + currentLevel * 5;
  const streakDays = userProfile.streak_days || 1;
  const streakProgress = Math.min((streakDays % 30) / 30 * 100, 100);

  const userPosts = data.posts || [];
  const userSavedPosts = data.savedPosts || [];
  const displayLink = userProfile?.social_link ? userProfile.social_link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : '';

  const visibleChips = [
    userProfile?.zodiac ? { key: 'zodiac', value: `מזל ${userProfile.zodiac}`, icon: <span className="text-[13px] leading-none">{getZodiacIcon(userProfile.zodiac)}</span> } : null,
    userProfile?.gender ? { key: 'gender', value: userProfile.gender, icon: userProfile.gender === 'זכר' ? <span className="text-blue-400 leading-none font-black text-[14px]">♂</span> : userProfile.gender === 'נקבה' ? <span className="text-pink-400 leading-none font-black text-[14px]">♀</span> : <Sparkles size={12} className="text-white/50" /> } : null,
    userProfile?.education ? { key: 'education', value: userProfile.education, icon: <GraduationCap size={12} className="text-white/50" /> } : null,
  ].filter(Boolean);

  const hiddenChips = [
    { key: 'job_title', value: userProfile?.job_title, icon: <Briefcase size={12} className="text-white/50" /> },
    { key: 'location', value: userProfile?.location, icon: <MapPin size={12} className="text-white/50" /> },
    { key: 'relationship_status', value: userProfile?.relationship_status, icon: <Heart size={12} className="text-white/50" /> },
    { key: 'birth_date', value: userProfile?.birth_date ? new Date(userProfile.birth_date).toLocaleDateString('he-IL') : '', icon: <Calendar size={12} className="text-white/50" /> },
  ].filter((item) => item.value);

  return (
    <FadeIn className="bg-[#0d0d0f] min-h-[100dvh] relative font-sans text-white overflow-x-hidden pb-24" dir="rtl">
      
      {/* 🌌 Hero Backdrop - Seamless Masked Gradient */}
      <div className="absolute top-0 left-0 w-full h-[350px] z-0 pointer-events-none">
        {userProfile.cover_url ? (
          <motion.div style={{ y: coverY, opacity: coverOpacity }} className="w-full h-full relative">
            <img src={userProfile.cover_url} className="w-full h-full object-cover opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0d0d0f]/80 to-[#0d0d0f]" />
          </motion.div>
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-accent-primary/20 via-[#0d0d0f]/80 to-[#0d0d0f]" />
        )}
      </div>

      <div className="relative z-10 flex flex-col items-center pt-8">
        
        {/* 🧬 Clean Avatar Core */}
        <div className="relative mt-8">
          <div className="w-28 h-28 rounded-full border border-white/10 overflow-hidden bg-[#111] shadow-[0_10px_30px_rgba(0,0,0,0.8)] relative z-10">
            {userProfile.avatar_url ? (
              <img src={userProfile.avatar_url} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-accent-primary font-black text-4xl bg-accent-primary/5">
                {(userProfile.full_name || 'א')[0]}
              </div>
            )}
          </div>
          
          {/* Subtle Floating Edit Icon */}
          {isMyProfile && (
            <button onClick={() => navigate('/edit-profile')} className="absolute bottom-1 -right-1 w-8 h-8 rounded-full bg-white/10 backdrop-blur-md border border-white/5 text-white/70 hover:text-white flex items-center justify-center shadow-lg active:scale-90 transition-all z-30">
              <Edit2 size={12} strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* 📝 Name & Identity */}
        <div className="mt-5 flex flex-col items-center text-center px-6 w-full max-w-[340px]">
          
          {/* Minimal LEVEL Tag Above Name */}
          <div className="bg-white/5 backdrop-blur-md px-3 py-1 rounded-full border border-white/5 text-[9px] font-black tracking-widest flex items-center gap-1.5 mb-2 shadow-sm">
            <span className="text-white/40">LEVEL</span>
            <span className="text-accent-primary drop-shadow-[0_0_5px_rgba(var(--color-accent-primary),0.5)]">{currentLevel}</span>
          </div>

          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            {userProfile.full_name}
            {userProfile.role_label === 'CORE' && <Crown size={16} className="text-accent-primary drop-shadow-[0_0_5px_rgba(var(--color-accent-primary),0.5)]" />}
          </h2>
          <span className="text-white/40 text-[12px] font-bold tracking-[0.1em] mt-1" dir="ltr">@{userProfile.username}</span>

          {/* Clean Bio Without Border */}
          {userProfile.bio && (
            <div className="mt-4 w-full flex flex-col items-center">
              <p className="text-white/90 text-[14px] leading-relaxed font-medium whitespace-pre-wrap text-center">
                {(userProfile.bio.length > 80 && !isBioExpanded) ? userProfile.bio.slice(0, 80) + '...' : userProfile.bio}
                {userProfile.bio.length > 80 && (
                  <button onClick={() => setIsBioExpanded(!isBioExpanded)} className="text-accent-primary font-black text-[12px] mx-2">
                    {isBioExpanded ? 'פחות' : 'עוד'}
                  </button>
                )}
              </p>
            </div>
          )}

          {/* Clean Link */}
          {userProfile.social_link && (
            <a href={userProfile.social_link.startsWith('http') ? userProfile.social_link : `https://${userProfile.social_link}`} target="_blank" rel="noopener noreferrer" className="mt-3 text-white font-bold text-[13px] hover:text-white/70 transition-colors flex items-center gap-1.5">
              <LinkIcon size={14} className="text-white/60" /> <span dir="ltr">{displayLink}</span>
            </a>
          )}
        </div>

        {/* 🏷️ Info Chips (About section) */}
        <div className="mt-5 flex flex-col items-center w-full px-6">
          {visibleChips.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {visibleChips.map((c: any) => (
                <div key={c.key} className="bg-white/5 border border-white/5 backdrop-blur-md px-3 py-1.5 rounded-[12px] flex items-center gap-1.5 shadow-sm">
                  {c.icon} <span className="text-white/80 text-[11px] font-bold">{c.value}</span>
                </div>
              ))}
            </div>
          )}
          {hiddenChips.length > 0 && (
            <div className="w-full mt-2 flex flex-col items-center">
              <button onClick={() => setExtraInfoOpen(!extraInfoOpen)} className="flex items-center gap-1 text-white/30 hover:text-white/60 text-[9px] font-black uppercase tracking-widest py-2 transition-colors">
                מידע נוסף <motion.div animate={{ rotate: extraInfoOpen ? 180 : 0 }}><ChevronDown size={12} /></motion.div>
              </button>
              <AnimatePresence>
                {extraInfoOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden w-full flex flex-wrap justify-center gap-2 pt-1">
                    {hiddenChips.map((c: any) => (
                      <div key={c.key} className="bg-white/5 border border-white/5 backdrop-blur-md px-3 py-1.5 rounded-[12px] flex items-center gap-1.5 shadow-sm">
                        {c.icon} <span className="text-white/60 text-[11px] font-medium">{c.value}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* 📊 4 Circular Data Pods in a Single Row */}
        <div className="grid grid-cols-4 gap-2 mt-8 w-full max-w-[360px] px-2">
          
          {/* Followers Orb */}
          <div onClick={() => openUsersListSheet('followers')} className="aspect-square bg-white/5 border border-white/5 backdrop-blur-xl rounded-full flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform shadow-sm">
            <span className="text-white text-lg font-black leading-none">{followersCount}</span>
            <span className="text-white/30 text-[8px] font-black uppercase tracking-widest mt-1">עוקבים</span>
          </div>

          {/* Following Orb */}
          <div onClick={() => openUsersListSheet('following')} className="aspect-square bg-white/5 border border-white/5 backdrop-blur-xl rounded-full flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform shadow-sm">
            <span className="text-white text-lg font-black leading-none">{followingCount}</span>
            <span className="text-white/30 text-[8px] font-black uppercase tracking-widest mt-1">נעקבים</span>
          </div>

          {/* Streak Orb (Animated Emerald Ring) */}
          <div className="aspect-square relative flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform group">
            <div className="absolute inset-0 bg-white/5 border border-white/5 backdrop-blur-xl rounded-full shadow-sm" />
            <svg className="absolute -inset-1.5 w-[calc(100%+12px)] h-[calc(100%+12px)] -rotate-90 pointer-events-none" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" stroke="rgba(255,255,255,0.05)" strokeWidth="3" fill="none" />
              <motion.circle 
                cx="50" cy="50" r="46" stroke="#10b981" strokeWidth="3" fill="none" strokeLinecap="round"
                strokeDasharray="289" initial={{ strokeDashoffset: 289 }} animate={{ strokeDashoffset: 289 - (289 * (streakProgress || 100)) / 100 }}
                transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                style={{ filter: 'drop-shadow(0 0 4px rgba(16,185,129, 0.6))' }}
              />
            </svg>
            <span className="text-emerald-500 text-lg font-black drop-shadow-md relative z-10 leading-none">{streakDays}</span>
            <span className="text-emerald-500/50 text-[8px] font-black uppercase tracking-widest mt-1 relative z-10 text-center leading-tight">רצף<br/>ימים</span>
          </div>

          {/* Reputation Orb (Animated Accent Ring) */}
          <div className="aspect-square relative flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform group">
            <div className="absolute inset-0 bg-accent-primary/5 border border-accent-primary/10 backdrop-blur-xl rounded-full shadow-sm" />
            <svg className="absolute -inset-1.5 w-[calc(100%+12px)] h-[calc(100%+12px)] -rotate-90 pointer-events-none" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" stroke="rgba(var(--color-accent-primary), 0.1)" strokeWidth="3" fill="none" />
              <motion.circle 
                cx="50" cy="50" r="46" stroke="var(--color-accent-primary)" strokeWidth="3" fill="none" strokeLinecap="round"
                strokeDasharray="289" initial={{ strokeDashoffset: 289 }} animate={{ strokeDashoffset: 289 - (289 * xpProgress) / 100 }}
                transition={{ duration: 1.5, ease: "easeOut", delay: 0.4 }}
                style={{ filter: 'drop-shadow(0 0 4px rgba(var(--color-accent-primary), 0.6))' }}
              />
            </svg>
            <span className="text-accent-primary text-lg font-black drop-shadow-md relative z-10 leading-none">{trueReputation}</span>
            <span className="text-accent-primary/50 text-[8px] font-black uppercase tracking-widest mt-1 relative z-10 text-center leading-tight">מוניטין<br/>כולל</span>
          </div>

        </div>

        {/* ⚡ Action Buttons (Follow/Message) */}
        {!isMyProfile && (
          <div className="flex items-center gap-3 mt-8 w-full max-w-[340px] px-2">
            <button 
              onClick={() => { triggerFeedback('pop'); setIsFollowing(!isFollowing); }}
              className={`flex-1 h-14 rounded-full font-black text-[13px] tracking-widest uppercase transition-all active:scale-95 flex items-center justify-center ${
                isFollowing ? 'bg-white/5 border border-white/10 text-white/50' : 'bg-accent-primary text-white shadow-[0_0_20px_rgba(var(--color-accent-primary),0.4)]'
              }`}
            >
              {followLoading ? <Loader2 size={18} className="animate-spin" /> : isFollowing ? 'נעקב' : 'עקוב'}
            </button>
            <button onClick={() => navigate(`/chat/${userProfile.id}`)} className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform">
              <MessageSquare size={20} />
            </button>
          </div>
        )}
      </div>

      {/* 🚀 Holographic Tab Navigation */}
      <div className="sticky top-0 z-40 flex items-center justify-center gap-8 mt-10 shrink-0 bg-[#0d0d0f]/90 backdrop-blur-xl py-4 border-b border-white/5 w-full">
        {[
          { id: 'posts', label: 'פוסטים' },
          { id: 'circles', label: 'מועדונים' },
          ...(isMyProfile ? [{ id: 'saved', label: 'שמורים' }] : [])
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { triggerFeedback('pop'); setActiveTab(tab.id as any); }}
              className={`relative text-[12px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 ${
                isActive ? 'text-white' : 'text-white/30 hover:text-white/60'
              }`}
            >
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="profileTabIndicator"
                  className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-accent-primary shadow-[0_0_10px_rgba(var(--color-accent-primary),1)]"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 🔳 Edge-to-Edge Grid Content (3 Items Per Row) */}
      <div className="w-full mt-0.5 min-h-[50vh]">
        <AnimatePresence mode="wait">
          
          {/* POSTS */}
          {activeTab === 'posts' && (
            <motion.div key="posts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-3 gap-0.5 w-full">
              {data.posts.length === 0 ? (
                <div className="col-span-3 py-16 text-center text-white/30 text-[12px] font-bold uppercase tracking-widest">אין עדיין דגימות מידע</div>
              ) : (
                data.posts.map((post: any) => (
                  <div key={post.id} onClick={() => { openOverlay(() => { const first = { ...post, _uid: `${post.id}-${Math.random().toString(36).slice(2)}` }; const rest = mediaPosts.filter((p: any) => p.id !== post.id).map((p: any) => ({ ...p, _uid: `${p.id}-${Math.random().toString(36).slice(2)}` })); setFullScreenMedia([first, ...rest]); }); }} className="aspect-[3/4] bg-[#111] relative cursor-pointer active:opacity-70 group overflow-hidden rounded-sm">
                    {isMyProfile && (
                      <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setGridActionModal({ item: post, type: 'post' })); }} className="absolute top-2 left-2 z-20 text-white/80 hover:text-white bg-black/40 backdrop-blur-md rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal size={16} />
                      </button>
                    )}
                    {post.media_url ? (
                      post.media_type === 'video' ? <video src={post.media_url} className="w-full h-full object-cover" /> : <img src={post.media_url} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-2 text-center text-white/40 text-[10px] font-medium leading-relaxed">{post.content}</div>
                    )}
                  </div>
                ))
              )}
            </motion.div>
          )}

          {/* JOINED CIRCLES */}
          {activeTab === 'circles' && (
            <motion.div key="circles" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-3 gap-0.5 w-full">
              {data.memberships.length === 0 ? (
                <div className="col-span-3 py-16 text-center text-white/30 text-[12px] font-bold uppercase tracking-widest">לא חבר במועדונים</div>
              ) : (
                allMyCircles.map((circle: any) => (
                  <div key={circle.id} onClick={() => navigate(`/circle/${circle.slug}`)} className={`aspect-[3/4] bg-[#111] relative overflow-hidden cursor-pointer group rounded-sm shadow-sm transition-all ${circle.isOwner ? 'border-[1px] border-accent-primary/60 shadow-[0_0_10px_rgba(var(--color-accent-primary),0.2)]' : ''}`}>
                    {circle.isOwner && (
                      <div className="absolute top-2 right-2 z-20 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-[9px] font-black uppercase tracking-widest bg-accent-primary/80 backdrop-blur-md px-1.5 py-0.5 rounded">
                        בניהולי
                      </div>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setGridActionModal({ item: circle, type: 'circle' })); }} className="absolute top-2 left-2 z-20 text-white/80 hover:text-white bg-black/40 backdrop-blur-md rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal size={16} />
                    </button>
                    {circle.cover_url ? (
                      <img src={circle.cover_url} className="w-full h-full object-cover opacity-80" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/30 font-black text-2xl">{circle.name?.charAt(0)}</div>
                    )}
                    <div className="absolute bottom-0 w-full p-2 bg-[#0d0d0f]/80 backdrop-blur-sm text-center border-t border-white/5">
                      <span className="text-white text-[10px] font-bold line-clamp-1">{circle.name}</span>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {/* SAVED */}
          {activeTab === 'saved' && isMyProfile && (
            <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-3 gap-0.5 w-full">
              {data.savedPosts.length === 0 ? (
                <div className="col-span-3 py-16 text-center text-white/30 text-[12px] font-bold uppercase tracking-widest">אין פריטים שמורים</div>
              ) : (
                data.savedPosts.map((post: any) => (
                  <div key={post.id} onClick={() => { const savedMedia = data.savedPosts.filter((p: any) => p.media_url); openOverlay(() => { const first = { ...post, _uid: `${post.id}-${Math.random().toString(36).slice(2)}` }; const rest = savedMedia.filter((p: any) => p.id !== post.id).map((p: any) => ({ ...p, _uid: `${p.id}-${Math.random().toString(36).slice(2)}` })); setFullScreenMedia([first, ...rest]); }); }} className="aspect-[3/4] bg-[#111] relative overflow-hidden cursor-pointer active:opacity-70 group rounded-sm">
                    <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setGridActionModal({ item: post, type: 'saved' })); }} className="absolute top-2 left-2 z-20 text-white/80 hover:text-white bg-black/40 backdrop-blur-md rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal size={16} />
                    </button>
                    {post.media_url ? (
                      post.media_type === 'video' ? <video src={post.media_url} className="w-full h-full object-cover" /> : <img src={post.media_url} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-2 text-center text-white/40 text-[10px] font-medium leading-relaxed">{post.content}</div>
                    )}
                  </div>
                ))
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* 🌑 DARK GLASS MODALS */}
      {mounted && portalNode && createPortal(
        <AnimatePresence>
          
          {/* GRID ACTION MODAL */}
          {gridActionModal && (
            <div className="fixed inset-0 z-[100000] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-[#0d0d0f] rounded-t-[32px] p-6 flex flex-col gap-3 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-white/10" onPointerDown={(e) => gridActionDragControls.start(e)} style={{ touchAction: 'none' }}>
                <div className="w-full py-2 flex justify-center cursor-grab"><div className="w-12 h-1 bg-white/10 rounded-full" /></div>
                {gridActionModal.type === 'post' && (
                  <>
                    <button onClick={() => { closeOverlay(); setTimeout(() => { openOverlay(() => { setEditingPost(gridActionModal.item); setEditPostText(gridActionModal.item.content || ''); setShowCreatePost(true); }); }, 100); }} className="w-full p-4 bg-white/5 rounded-[20px] text-white font-black flex justify-between items-center text-[14px] hover:bg-white/10 transition-colors border border-white/5"><span>ערוך דגימה</span><Edit2 size={18} className="text-white/40" /></button>
                    <button onClick={() => { if (window.confirm('למחוק פוסט?')) deletePost(gridActionModal.item.id); }} className="w-full p-4 bg-red-500/10 rounded-[20px] text-red-500 font-black flex justify-between items-center text-[14px] hover:bg-red-500/20 transition-colors border border-red-500/20"><span>מחק דגימה</span><Trash2 size={18} /></button>
                  </>
                )}
                {gridActionModal.type === 'saved' && (
                  <button onClick={() => removeFromSaved(gridActionModal.item.id)} className="w-full p-4 bg-white/5 rounded-[20px] text-white font-black flex justify-between items-center text-[14px] hover:bg-white/10 transition-colors border border-white/5"><span>הסר מארכיון</span><Bookmark size={18} className="text-white/40" /></button>
                )}
                {gridActionModal.type === 'circle' && (
                  <>
                    <button onClick={() => { closeOverlay(); setTimeout(() => navigate(`/circle/${gridActionModal.item.slug}`), 100); }} className="w-full p-4 bg-white/5 rounded-[20px] text-white font-black flex justify-between items-center text-[14px] hover:bg-white/10 transition-colors border border-white/5"><span>כנס למועדון</span><LinkIcon size={18} className="text-white/40" /></button>
                    <button onClick={() => { if (window.confirm('לעזוב את המועדון?')) leaveCircle(gridActionModal.item.id); }} className="w-full p-4 bg-red-500/10 rounded-[20px] text-red-500 font-black flex justify-between items-center text-[14px] hover:bg-red-500/20 transition-colors border border-red-500/20"><span>עזוב מועדון</span><LogOut size={18} /></button>
                  </>
                )}
              </motion.div>
            </div>
          )}

          {/* CREATE/EDIT POST MODAL */}
          {showCreatePost && (
            <div className="fixed inset-0 z-[100000] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-[#0d0d0f] rounded-t-[32px] p-6 flex flex-col gap-4 pb-[env(safe-area-inset-bottom,32px)] border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)]">
                <div className="w-full py-2 flex justify-center cursor-grab"><div className="w-12 h-1 bg-white/10 rounded-full" /></div>
                <div className="flex justify-between items-center px-1"><h3 className="text-white font-black text-[15px] uppercase tracking-widest">עריכת נתונים</h3><button onClick={closeOverlay} className="text-white/40 hover:text-white"><X size={20} /></button></div>
                <textarea value={editPostText} onChange={(e) => setEditPostText(e.target.value)} placeholder="הקלד כאן..." className="h-40 bg-white/5 rounded-[20px] p-5 text-white text-[14px] outline-none resize-none border border-white/10 placeholder:text-white/30 shadow-inner" />
                <button onClick={saveEditedPost} disabled={!editPostText.trim()} className="h-14 bg-accent-primary text-white font-black text-[14px] uppercase tracking-widest rounded-[20px] mt-2 shadow-[0_0_20px_rgba(var(--color-accent-primary),0.3)] active:scale-95 transition-transform disabled:opacity-50">שמור שינויים</button>
              </motion.div>
            </div>
          )}

          {/* OPTIONS MODAL */}
          {optionsMenuPost && (
            <div className="fixed inset-0 z-[99900] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-[#0d0d0f] rounded-t-[32px] p-6 flex flex-col gap-3 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-white/10">
                <div className="w-full py-2 flex justify-center cursor-grab"><div className="w-12 h-1 bg-white/10 rounded-full" /></div>
                <button onClick={() => { closeOverlay(); setTimeout(() => handleShare(optionsMenuPost), 100); }} className="w-full p-4 bg-white/5 rounded-[20px] text-white font-black flex justify-between items-center text-[14px] active:scale-[0.98] transition-all border border-white/5"><span>שתף דגימה</span><Share2 size={18} className="text-white/40" /></button>
                {optionsMenuPost.media_url && <button onClick={() => handleDownloadMedia(optionsMenuPost.media_url)} className="w-full p-4 bg-white/5 rounded-[20px] text-white font-black flex justify-between items-center text-[14px] active:scale-[0.98] transition-all border border-white/5"><span>שמור למכשיר</span><Download size={18} className="text-white/40" /></button>}
                <button onClick={async () => { try { await supabase.from('saved_posts').insert({ user_id: currentUserId, post_id: optionsMenuPost.id }); toast.success('התווסף לארכיון'); } catch { toast.error('כבר קיים בארכיון'); } closeOverlay(); }} className="w-full p-4 bg-white/5 rounded-[20px] text-white font-black flex justify-between items-center text-[14px] active:scale-[0.98] transition-all border border-white/5"><span>שמור בארכיון</span><Bookmark size={18} className="text-white/40" /></button>
                <button onClick={() => handleCopyLink(optionsMenuPost)} className="w-full p-4 bg-white/5 rounded-[20px] text-white font-black flex justify-between items-center text-[14px] active:scale-[0.98] transition-all border border-white/5"><span>העתק קישור</span><LinkIcon size={18} className="text-white/40" /></button>
                {optionsMenuPost.user_id === currentUserId && (
                  <>
                    <button onClick={() => { closeOverlay(); setTimeout(() => { openOverlay(() => { setEditingPost(optionsMenuPost); setEditPostText(optionsMenuPost.content || ''); setShowCreatePost(true); }); }, 100); }} className="w-full p-4 bg-white/5 rounded-[20px] text-white font-black flex justify-between items-center text-[14px] active:scale-[0.98] transition-all border border-white/5 mt-2"><span>ערוך דגימה</span><Edit2 size={18} className="text-white/40" /></button>
                    <button onClick={() => { if (window.confirm('למחוק פוסט?')) deletePost(optionsMenuPost.id); }} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-[20px] text-red-500 font-black flex justify-between items-center text-[14px] mt-2 active:scale-[0.98] transition-all"><span>מחק דגימה</span><Trash2 size={18} className="text-red-500" /></button>
                  </>
                )}
              </motion.div>
            </div>
          )}

          {/* SEAL SELECTOR MODAL */}
          {sealSelectorPost && (
            <div className="fixed inset-0 z-[99900] flex flex-col justify-end p-4" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div initial={{ y: '100%', scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: '100%', scale: 0.95 }} transition={{ type: 'spring', damping: 25, stiffness: 400 }} className="relative z-10 bg-[#0d0d0f] border border-white/10 rounded-[32px] p-8 shadow-2xl flex flex-col items-center gap-6">
                <div className="w-12 h-1 bg-white/10 rounded-full mb-2" />
                <div className="text-center">
                  <h3 className="text-white font-black text-lg tracking-widest uppercase">הענקת חותם</h3>
                  <p className="text-white/40 text-[11px] mt-2 font-medium">הענקת חותם מספקת XP ליוצר</p>
                </div>
                <div className="grid grid-cols-3 gap-3 w-full">
                  {SEAL_TYPES.map((type) => (
                    <button key={type.id} onClick={() => handleSeal(sealSelectorPost.id, type.id)} className="flex flex-col items-center gap-3 p-4 rounded-[24px] bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95 shadow-sm">
                      <div className={`${type.color} drop-shadow-[0_0_10px_currentColor]`}>{type.icon}</div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-white font-black text-[11px] uppercase tracking-widest">{type.label}</span>
                        <span className="text-accent-primary bg-accent-primary/10 px-2 py-0.5 rounded text-[9px] font-black tracking-widest">+{type.xp}XP</span>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          )}

          {/* COMMENTS MODAL */}
          {activeCommentsPostId && (
            <div className="fixed inset-0 z-[99000] flex flex-col justify-end" dir="rtl" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="relative z-10 bg-[#0d0d0f] rounded-t-[32px] h-[85vh] flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom,20px)] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-white/10">
                <div className="w-full py-4 flex justify-center cursor-grab border-b border-white/5" onPointerDown={(e) => commentsDragControls.start(e)} style={{ touchAction: 'none' }}><div className="w-12 h-1 bg-white/10 rounded-full" /></div>
                
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 scrollbar-hide">
                  {loadingComments ? <Loader2 className="animate-spin mx-auto text-accent-primary mt-10" /> : comments.filter((c) => c && !c.parent_id).map((c) => {
                    const replies = comments.filter((r) => r && r.parent_id === c.id);
                    return (
                      <div key={c.id} className="flex flex-col gap-2">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#111] shrink-0 overflow-hidden cursor-pointer border border-white/10 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>
                            {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover" /> : <span className="text-white/40 font-black text-sm">{(c.profiles?.full_name || 'א')[0]}</span>}
                          </div>
                          <div className="flex flex-col flex-1">
                            <div className="bg-white/5 p-4 rounded-[20px] rounded-tr-sm border border-white/5 relative">
                              <button className="absolute top-3 left-3 text-white/30 hover:text-white" onClick={() => openOverlay(() => setCommentActionModal(c))}><MoreHorizontal size={16} /></button>
                              <span className="text-white font-black text-[12px] mb-1 inline-block uppercase tracking-widest cursor-pointer" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>{c.profiles?.full_name || 'אנונימי'}</span>
                              <p className="text-white/80 text-[13px] leading-relaxed">{c.content}</p>
                              <div className="flex items-center gap-4 mt-2 border-t border-white/5 pt-2">
                                <button onClick={() => { setReplyingTo(c); setNewComment(`@${c.profiles?.full_name} `); document.getElementById('comment-input')?.focus(); }} className="text-white/40 hover:text-accent-primary transition-colors flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest"><Reply size={12} /> השב</button>
                              </div>
                            </div>
                          </div>
                        </div>
                        {replies.length > 0 && (
                          <div className="pr-10 flex flex-col gap-2 mt-1">
                            {replies.map((reply) => (
                              <div key={reply.id} className="bg-white/5 rounded-[16px] p-3 border border-white/5 relative">
                                <button className="absolute top-2 left-2 text-white/30 hover:text-white" onClick={() => openOverlay(() => setCommentActionModal(reply))}><MoreHorizontal size={14} /></button>
                                <div className="text-white font-black text-[11px] mb-1 uppercase tracking-widest">{reply.profiles?.full_name || 'אנונימי'}</div>
                                <div className="text-white/70 text-[12px]">{reply.content}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 bg-[#0d0d0f] border-t border-white/5 flex flex-col gap-2">
                  {replyingTo && (
                    <div className="flex items-center justify-between bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 text-[11px]">
                      <span className="text-white/50 font-bold">משיב ל- <span className="text-accent-primary">{replyingTo.profiles?.full_name}</span></span>
                      <X size={14} className="cursor-pointer text-white/50 hover:text-white" onClick={() => { setReplyingTo(null); setNewComment(''); }} />
                    </div>
                  )}
                  <div className="flex gap-2 items-center">
                    <input id="comment-input" type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="הקלד תגובה..." className="flex-1 bg-white/5 border border-white/10 text-white rounded-full h-[50px] px-5 outline-none text-[14px] placeholder:text-white/30" />
                    <button onClick={submitComment} disabled={!newComment.trim()} className="w-[50px] h-[50px] rounded-full shrink-0 bg-accent-primary text-white flex items-center justify-center shadow-[0_0_15px_rgba(var(--color-accent-primary),0.4)] active:scale-95 disabled:opacity-50 transition-transform"><Send size={18} className="rtl:-scale-x-100 -ml-1" /></button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* FULL SCREEN MEDIA (TikTok Style with dark glass icons) */}
          {fullScreenMedia && (
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed inset-0 z-[90000] bg-[#0d0d0f]">
              <div className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide" onScroll={handleContainerScroll}>
                {fullScreenMedia.map((vid, idx) => {
                  const isVid = vid.media_url?.match(/\.(mp4|webm|mov)$/i);
                  const keyVal = vid._uid ? vid._uid : `${vid.id}-${idx}`;
                  return (
                    <div key={keyVal} className="w-full h-screen snap-center relative bg-[#0d0d0f] flex items-center justify-center">
                      {isVid ? (
                        <video src={vid.media_url} loop playsInline className="w-full h-full object-cover full-media-item" onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())} />
                      ) : (
                        <img src={vid.media_url} className="w-full h-full object-contain full-media-item" onError={(e) => { e.currentTarget.src = 'https://placehold.co/500x500/111/333?text=Unavailable'; }} />
                      )}
                      
                      {/* Floating Dark Glass Overlay (Right Side) */}
                      <div className="absolute bottom-32 left-4 flex flex-col gap-6 items-center z-50 pointer-events-auto">
                        <button onClick={(e) => { e.stopPropagation(); if (vid.has_sealed) handleRemoveSeal(vid.id); else openOverlay(() => setSealSelectorPost(vid)); }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
                          <Flame size={32} className={vid.has_sealed ? 'text-orange-500' : 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]'} fill={vid.has_sealed ? 'currentColor' : 'none'} strokeWidth={1.5} />
                          <span className="text-white text-[13px] font-black drop-shadow-md">{vid.seals_count || 0}</span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); openOverlay(() => { setActivePost(vid); setActiveCommentsPostId(vid.id); setLoadingComments(true); supabase.from('comments').select('*, profiles!user_id(*)').eq('post_id', vid.id).order('created_at', { ascending: true }).then((r) => { setComments(r.data || []); setLoadingComments(false); }); }); }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                          <MessageSquare size={32} strokeWidth={1.5} />
                          <span className="text-white text-[13px] font-black drop-shadow-md">{vid.comments_count}</span>
                        </button>
                      </div>

                      <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setOptionsMenuPost(vid)); }} className="absolute bottom-8 left-5 z-[60] active:scale-90 transition-transform p-1">
                        <MoreVertical size={28} strokeWidth={2} className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                      </button>

                      {/* Bottom Info Area */}
                      <div className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-32 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex flex-col pointer-events-none">
                        {vid.content && (
                          <p className="text-white drop-shadow-md text-[15px] font-medium text-right max-w-[85%] line-clamp-3 pointer-events-auto cursor-pointer mb-4" onClick={(e) => { e.stopPropagation(); openOverlay(() => setActiveDescPost(vid)); }}>
                            {vid.content}
                          </p>
                        )}
                        
                        {/* Circles Horizontal Scroll Area */}
                        {vid.user_circles && vid.user_circles.length > 0 && (
                          <div className="flex gap-2 overflow-x-auto scrollbar-hide items-center mb-3 pointer-events-auto">
                            {(() => {
                              const sortedCircles = [...vid.user_circles].sort((a, b) => {
                                const aOwner = a.owner_id === vid.user_id ? -1 : 1;
                                const bOwner = b.owner_id === vid.user_id ? -1 : 1;
                                return aOwner - bOwner;
                              });
                              const displayCircles = sortedCircles.slice(0, 20);
                              const hasMore = sortedCircles.length > 20;

                              return (
                                <>
                                  {displayCircles.map((circle: any) => {
                                    const isOwnerOfThisCircle = circle.owner_id === vid.user_id;
                                    return (
                                      <div key={circle.id} onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/circle/${circle.slug || circle.id}`), 50); }} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform">
                                        <div className={`w-8 h-8 rounded-full overflow-hidden shadow-sm bg-[#111] flex items-center justify-center ${isOwnerOfThisCircle ? 'border border-accent-primary shadow-[0_0_6px_rgba(var(--color-accent-primary),0.8)]' : 'border border-white/20'}`}>
                                          {circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover" loading="lazy" /> : <Users className="w-4 h-4 text-white/70" />}
                                        </div>
                                        <span className="text-[9px] text-white drop-shadow-md font-bold max-w-[55px] truncate text-center uppercase tracking-wider">{circle.name}</span>
                                        {isOwnerOfThisCircle && <span className="text-white font-black text-[8px] uppercase tracking-widest drop-shadow-md -mt-1">בניהולי</span>}
                                      </div>
                                    );
                                  })}
                                  {hasMore && (
                                    <div onClick={(e) => { e.stopPropagation(); openOverlay(() => setPostCirclesModal({ circles: sortedCircles, userId: vid.user_id })); }} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform">
                                      <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white backdrop-blur-md shadow-sm">
                                        <ArrowLeft size={14} />
                                      </div>
                                      <span className="text-[9px] text-white drop-shadow-md font-bold text-center uppercase tracking-wider">הכל</span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}

                        <div className="flex items-center justify-start pointer-events-auto">
                          <div className="flex items-center gap-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${vid.user_id}`), 50); }}>
                            <div className="w-10 h-10 rounded-full border border-white/20 overflow-hidden shrink-0 shadow-sm bg-[#111] flex items-center justify-center">
                              {vid.profiles?.avatar_url ? <img src={vid.profiles.avatar_url} className="w-full h-full object-cover" loading="lazy" /> : <span className="text-white font-black text-lg flex items-center justify-center leading-none">{(vid.profiles?.full_name || 'א')[0]}</span>}
                            </div>
                            <div className="flex flex-col text-right">
                              <span className="text-white font-black text-[15px] drop-shadow-md">{vid.profiles?.full_name || 'אנונימי'}</span>
                              <span className="text-white/80 text-[10px] font-bold drop-shadow-md">{new Date(vid.created_at).toLocaleDateString('he-IL')}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* DESC POST FULL */}
          <AnimatePresence>
            {activeDescPost && (
              <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-[#0d0d0f] rounded-t-[32px] flex flex-col overflow-hidden pb-10 max-h-[75vh] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-white/10 text-center">
                  <div className="w-full py-4 flex justify-center cursor-grab border-b border-white/5"><div className="w-12 h-1 bg-white/10 rounded-full" /></div>
                  <div className="p-6 overflow-y-auto" onPointerDown={stopPropagation} onTouchStart={stopPropagation}>
                    <p className="text-white/90 text-[14px] leading-relaxed whitespace-pre-wrap font-medium">{activeDescPost.content}</p>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* POST CIRCLES MODAL (For >20 Circles in Post) */}
          <AnimatePresence>
            {postCirclesModal && (
              <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-[#0d0d0f] rounded-t-[32px] p-6 flex flex-col gap-3 pb-12 max-h-[70vh] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-white/10">
                  <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>
                  <h2 className="text-white font-black text-lg mb-4">פורסם ב- ({postCirclesModal.circles.length}) מועדונים</h2>
                  <div className="flex flex-col gap-3 overflow-y-auto pr-1 scrollbar-hide" onPointerDown={stopPropagation} onTouchStart={stopPropagation}>
                    {postCirclesModal.circles.map((c: any) => {
                      const isOwnerOfThisCircle = c.owner_id === postCirclesModal.userId;
                      return (
                        <div key={c.id} onClick={() => { closeOverlay(); navigate(`/circle/${c.slug || c.id}`); }} className={`flex items-center gap-4 bg-white/5 p-4 rounded-2xl cursor-pointer active:scale-[0.98] transition-transform shadow-sm hover:bg-white/10 ${isOwnerOfThisCircle ? 'border-[1px] border-accent-primary shadow-[0_0_6px_rgba(var(--color-accent-primary),0.2)]' : 'border border-white/5'}`}>
                          <div className={`w-12 h-12 rounded-full bg-[#111] overflow-hidden shrink-0 flex items-center justify-center shadow-inner ${isOwnerOfThisCircle ? 'border-none' : 'border border-white/10'}`}>
                            {c.cover_url ? <img src={c.cover_url} className="w-full h-full object-cover" loading="lazy" /> : <Users size={20} className="text-white/30" />}
                          </div>
                          <div className="flex flex-col flex-1">
                            <span className="text-white font-black text-[15px]">{c.name}</span>
                            {isOwnerOfThisCircle && <span className="text-accent-primary font-black text-[10px] uppercase tracking-widest mt-0.5">בניהולי</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* COMMENT ACTION MODAL */}
          {commentActionModal && (
            <div className="fixed inset-0 z-[99900] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-[#0d0d0f] rounded-t-[32px] p-6 flex flex-col gap-3 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-white/10">
                <div className="w-full py-2 flex justify-center cursor-grab"><div className="w-12 h-1 bg-white/10 rounded-full" /></div>
                <button onClick={() => { closeOverlay(); setReplyingTo(commentActionModal.parent_id ? comments.find((c) => c?.id === commentActionModal.parent_id) : commentActionModal); setNewComment(`@${commentActionModal.profiles?.full_name} `); document.getElementById('comment-input')?.focus(); }} className="w-full p-4 bg-white/5 rounded-[20px] text-white font-black flex justify-between items-center text-[14px] hover:bg-white/10 transition-colors border border-white/5"><span>השב לתגובה</span><Reply size={18} className="text-white/40" /></button>
                {commentActionModal.user_id === currentUserId && (
                  <>
                    <button onClick={() => { closeOverlay(); setEditingCommentId(commentActionModal.id); setNewComment(commentActionModal.content); document.getElementById('comment-input')?.focus(); }} className="w-full p-4 bg-white/5 rounded-[20px] text-white font-black flex justify-between items-center text-[14px] hover:bg-white/10 transition-colors border border-white/5"><span>ערוך תגובה</span><Edit2 size={18} className="text-white/40" /></button>
                    <button onClick={() => { if (window.confirm('למחוק תגובה?')) { closeOverlay(); deleteComment(commentActionModal.id); } }} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-[20px] text-red-500 font-black flex justify-between items-center text-[14px] mt-2 active:scale-[0.98] transition-all"><span>מחק תגובה</span><Trash2 size={18} className="text-red-500" /></button>
                  </>
                )}
              </motion.div>
            </div>
          )}

        </AnimatePresence>,
        portalNode
      )}
    </FadeIn>
  );
};
