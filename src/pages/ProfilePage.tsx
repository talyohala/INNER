import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls, useScroll, useTransform } from 'framer-motion';
import { 
  UserCircle, Edit2, Zap, ChevronLeft, ChevronDown, ChevronUp, Loader2, Users, Crown, 
  Activity, Heart, MessageSquare, ShoppingBag, Link as LinkIcon, UserPlus, 
  UserCheck, Shield, Wallet, Flame, MapPin, Calendar, GraduationCap, 
  MessageCircle, Bookmark, LayoutGrid, MoreVertical, Share2
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
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  const [showFollowersList, setShowFollowersList] = useState(false);
  const [showFollowingList, setShowFollowingList] = useState(false);
  const [usersListData, setUsersListData] = useState<any[]>([]);
  const [loadingUsersList, setLoadingUsersList] = useState(false);

  const [activeTab, setActiveTab] = useState<'posts' | 'joined' | 'saved'>('posts');
  
  // מסך מלא מהפרופיל
  const [fullScreenMedia, setFullScreenMedia] = useState<any[] | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const scrollTimeout = useRef<any>(null);

  const isMyProfile = !routeId || routeId === authProfile?.username || routeId === user?.id;

  const stateRef = useRef({ fullscreen: false });
  useEffect(() => { stateRef.current = { fullscreen: !!fullScreenMedia }; }, [fullScreenMedia]);

  useEffect(() => {
    const handlePopState = () => {
      if (stateRef.current.fullscreen) setFullScreenMedia(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openOverlay = (action: () => void) => { window.history.pushState({ overlay: true }, ''); action(); };
  const closeOverlay = () => { window.history.back(); };

  useEffect(() => {
    setMounted(true);
    const loadProfileData = async () => {
      try {
        setLoadingData(true);
        const { data: authData } = await supabase.auth.getUser();
        let targetId = '';

        if (isMyProfile) {
          const headers = authData.user ? { 'x-user-id': authData.user.id } : {};
          const result = await apiFetch<any>('/api/profile/collection', { headers });
          
          const { data: myPosts } = await supabase.from('posts').select('*').eq('user_id', result.profile?.id).order('created_at', { ascending: false });
          let mySavedPosts = [];
          try {
            const { data: saved } = await supabase.from('saved_posts').select('post_id, posts(*)').eq('user_id', result.profile?.id);
            mySavedPosts = saved?.map((s: any) => s.posts).filter(Boolean) || [];
          } catch(e) {}

          setData({ ...result, posts: myPosts || [], savedPosts: mySavedPosts });
          targetId = result.profile?.id;
        } else {
          const identifier = routeId || '';
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
          
          let query = supabase.from('profiles').select('*');
          if (isUuid) query = query.eq('id', identifier);
          else query = query.eq('username', identifier);
          
          const { data: publicProfile, error: profileErr } = await query.maybeSingle();
          if (!publicProfile || profileErr) throw new Error('Profile not found');
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

          setData({ profile: publicProfile, memberships: memberships || [], ownedCircles: ownedCircles || [], posts: userPosts || [], savedPosts: [] });
          setIsFollowing(isFollowingUser);
        }

        if (targetId) {
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
      } finally { setLoadingData(false); }
    };

    if (user && !authLoading) loadProfileData();
  }, [user, routeId, isMyProfile, authLoading, navigate]);

  const handleFollowToggle = async () => {
    if (followLoading) return;
    setFollowLoading(true); triggerFeedback('pop');
    try {
      const { data: authData } = await supabase.auth.getUser();
      const myId = authData.user?.id; const targetId = data.profile?.id;
      if (isFollowing) {
        await supabase.from('followers').delete().eq('follower_id', myId).eq('following_id', targetId);
        setIsFollowing(false); setFollowersCount(prev => Math.max(0, prev - 1));
      } else {
        await supabase.from('followers').insert({ follower_id: myId, following_id: targetId });
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

  // פונקציות מסך מלא לפרופיל
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

  const getSafeDate = (dateStr: string) => { try { return new Date(dateStr).toLocaleDateString('he-IL'); } catch (e) { return dateStr; } };

  return (
    <div className="bg-[#0C0C0C] min-h-screen relative font-sans" dir="rtl">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex justify-center">
        <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[40%] bg-white/10 blur-[120px] rounded-full mix-blend-screen"></div>
        <div className="absolute bottom-[-10%] right-[-20%] w-[60%] h-[40%] bg-white/5 blur-[120px] rounded-full mix-blend-screen"></div>
      </div>

      <div className="fixed top-6 left-4 right-4 flex justify-between items-center z-50 pointer-events-none">
        <div className="w-10"></div>
        {isMyProfile && (
          <button onClick={() => { triggerFeedback('pop'); navigate('/edit-profile'); }} className="pointer-events-auto w-10 h-10 flex justify-center items-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-full shadow-lg active:scale-90 transition-all hover:bg-black/60"><Edit2 size={16} className="text-white" /></button>
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
            <div className="w-full h-full rounded-full overflow-hidden bg-[#1a1a1a] border border-white/5 relative">
              {userProfile?.avatar_url ? <img src={userProfile.avatar_url} className="w-full h-full object-cover" alt="" /> : <UserCircle size={50} className="text-white/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
            </div>
          </motion.div>

          <div className="text-center mt-3 w-full">
            <h2 className="text-[20px] font-black text-white tracking-tight flex items-center justify-center gap-1.5">
              <span>{userProfile?.full_name || 'משתמש'}</span>
              {currentLevel >= 5 && <Crown size={14} className="text-[#ffc107] drop-shadow-[0_0_8px_rgba(255,193,7,0.5)]" />}
            </h2>
            <p className="text-white/30 font-bold text-[12px] tracking-widest mb-4" dir="ltr">@{userProfile?.username || 'user'}</p>

            <div className="flex items-center justify-center gap-2 text-[13px] text-white/50 font-medium mb-5 w-full max-w-[280px] mx-auto flex-wrap">
              <span className="cursor-pointer hover:text-white transition-colors" onClick={() => openUsersListSheet('followers')}><span>עוקבים</span> <span className="font-black text-white">{followersCount}</span></span><span>•</span>
              <span className="cursor-pointer hover:text-white transition-colors" onClick={() => openUsersListSheet('following')}><span>נעקבים</span> <span className="font-black text-white">{followingCount}</span></span><span>•</span>
              <span><span>מוניטין</span> <span className="font-black text-white">{trueReputation}</span></span>
            </div>

            {!isMyProfile && (
              <div className="flex justify-center gap-3 mb-6 w-full px-4">
                <Button onClick={handleFollowToggle} disabled={followLoading} className={`flex-1 h-12 rounded-[20px] font-black text-[14px] flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${isFollowing ? 'bg-white/10 text-white border border-white/10' : 'bg-white text-black shadow-lg'}`}>
                  {followLoading ? <Loader2 size={18} className="animate-spin" /> : isFollowing ? <><span>נעקב</span> <UserCheck size={18} /></> : <><span>עקוב</span> <UserPlus size={18} /></>}
                </Button>
                <Button onClick={() => navigate(`/chat/${userProfile.id}`)} className="flex-1 h-12 bg-white text-black rounded-[20px] font-black text-[14px] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg">
                  <span>הודעה</span> <MessageCircle size={18} className="text-black" />
                </Button>
              </div>
            )}

            {(userProfile?.zodiac || userProfile?.social_link) && (
              <div className="flex flex-col items-center gap-1.5 mb-5">
                {userProfile?.social_link && <a href={userProfile.social_link.startsWith('http') ? userProfile.social_link : `https://${userProfile.social_link}`} target="_blank" rel="noopener noreferrer" className="text-[#e5e4e2] text-[12px] font-bold flex items-center gap-1.5 hover:text-white transition-colors"><span dir="ltr" className="tracking-wide">{displayLink}</span> <LinkIcon size={12} className="text-[#e5e4e2]/60" /></a>}
                {userProfile?.zodiac && <span className="text-white/40 text-[12px] font-medium flex items-center gap-1.5"><span>{userProfile.zodiac}</span></span>}
              </div>
            )}
          </div>

          <div className="w-full flex flex-col gap-3 px-2 mb-5">
            <div className="flex justify-between items-center w-full">
              <span className="text-white/50 text-[12px] font-bold flex items-center gap-1.5"><span>רצף: <span className="text-white">{streak} ימים</span></span> <Flame size={14} className="text-[#ff5722]" /></span>
              {isMyProfile && <span className="text-white/50 text-[12px] font-bold flex items-center gap-1"><span className="text-white">{currentXP}</span> / {xpToNextLevel} <Zap size={12} className="text-[#e5e4e2]" /></span>}
            </div>
            {isMyProfile && <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden relative shadow-inner"><motion.div initial={{ width: 0 }} animate={{ width: `${xpProgress}%` }} transition={{ duration: 1.5, ease: "easeOut" }} className="absolute top-0 right-0 h-full bg-gradient-to-l from-[#ff5722] via-[#d500f9] to-[#2196f3] rounded-full" /></div>}
          </div>

          <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-6"></div>

          <div className="w-full mb-10">
            <div className="flex border-b border-white/10 w-full mb-5 pb-1">
              <button onClick={() => setActiveTab('posts')} className={`flex-1 pb-3 text-[13px] font-black transition-colors border-b-2 flex items-center justify-center gap-1.5 ${activeTab === 'posts' ? 'text-white border-white' : 'text-white/40 border-transparent hover:text-white/70'}`}>
                <LayoutGrid size={16} /> <span>פוסטים</span>
              </button>
              <button onClick={() => setActiveTab('joined')} className={`flex-1 pb-3 text-[13px] font-black transition-colors border-b-2 flex items-center justify-center gap-1.5 ${activeTab === 'joined' ? 'text-white border-white' : 'text-white/40 border-transparent hover:text-white/70'}`}>
                <Users size={16} /> <span>מועדונים</span>
              </button>
              {isMyProfile && (
                <button onClick={() => setActiveTab('saved')} className={`flex-1 pb-3 text-[13px] font-black transition-colors border-b-2 flex items-center justify-center gap-1.5 ${activeTab === 'saved' ? 'text-white border-white' : 'text-white/40 border-transparent hover:text-white/70'}`}>
                  <Bookmark size={16} /> <span>שמורים</span>
                </button>
              )}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'posts' && (
                <motion.div key="posts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-3 gap-1">
                  {userPosts.length === 0 ? (
                    <div className="col-span-3 text-center py-10 text-white/30 text-xs">אין פוסטים עדיין</div>
                  ) : (
                    userPosts.map((post: any) => (
                      <div key={post.id} onClick={() => { 
                        const mediaPosts = userPosts.filter((p:any) => p.media_url);
                        openOverlay(() => setFullScreenMedia([post, ...mediaPosts.filter((v:any) => v.id !== post.id)]));
                      }} className="aspect-square bg-white/5 relative overflow-hidden cursor-pointer active:opacity-70 border border-white/5">
                        {post.media_url ? (post.media_type === 'video' ? <video src={post.media_url} className="w-full h-full object-cover" /> : <img src={post.media_url} onError={(e) => { e.currentTarget.src = 'https://placehold.co/500x500/111/333?text=Image'; }} className="w-full h-full object-cover" />) : <div className="w-full h-full flex items-center justify-center p-2 text-center text-white/50 text-[9px] line-clamp-3">{post.content}</div>}
                      </div>
                    ))
                  )}
                </motion.div>
              )}

              {activeTab === 'joined' && (
                <motion.div key="joined" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-3 gap-1">
                   {joinedCircles.map((circle: any) => (
                     <div key={circle.id} onClick={() => navigate(`/circle/${circle.slug}`)} className="aspect-square bg-[#111] relative overflow-hidden cursor-pointer border border-white/5">
                        {circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover opacity-80" /> : <Users size={20} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20" />}
                        <div className="absolute bottom-0 w-full p-1 bg-black/60 backdrop-blur-sm text-center"><span className="text-white text-[9px] font-bold line-clamp-1">{circle.name}</span></div>
                     </div>
                   ))}
                </motion.div>
              )}

              {activeTab === 'saved' && isMyProfile && (
                <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-3 gap-1">
                  {userSavedPosts.length === 0 ? (
                    <div className="col-span-3 text-center py-10 text-white/30 text-xs">אין פוסטים שמורים</div>
                  ) : (
                    userSavedPosts.map((post: any) => (
                      <div key={post.id} onClick={() => { 
                        const mediaPosts = userSavedPosts.filter((p:any) => p.media_url);
                        openOverlay(() => setFullScreenMedia([post, ...mediaPosts.filter((v:any) => v.id !== post.id)]));
                      }} className="aspect-square bg-white/5 relative overflow-hidden cursor-pointer active:opacity-70 border border-white/5">
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

      {/* PORTALS FOR FULLSCREEN MEDIA IN PROFILE */}
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
                        <video src={vid.media_url} loop playsInline className="w-full h-full object-cover profile-full-media-item" onClick={(e) => e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause()} />
                      ) : (
                        <img src={vid.media_url} className="w-full h-full object-contain profile-full-media-item" onError={(e) => { e.currentTarget.src = 'https://placehold.co/500x500/111/333?text=Media+Unavailable'; }} />
                      )}
                      
                      <div className="absolute bottom-48 left-4 flex flex-col gap-6 items-center z-50">
                        <button onClick={(e) => { e.stopPropagation(); handleLike(vid.id, vid.is_liked); }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform"><Heart size={30} className={vid.is_liked ? 'text-[#e91e63]' : 'text-white'} fill={vid.is_liked ? 'currentColor' : 'none'} strokeWidth={1.5} /><span className="text-white text-[13px] font-black drop-shadow-md">{vid.likes_count}</span></button>
                        <button onClick={(e) => { e.stopPropagation(); handleShare(vid); }} className="active:scale-90 transition-transform"><Share2 size={30} className="text-white" strokeWidth={1.5} /></button>
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end pointer-events-none">
                        <div className="flex items-center gap-3 mb-2 cursor-pointer w-fit pr-2 pointer-events-auto" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${vid.user_id}`), 50); }}>
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-black border-2 border-white/20 shrink-0 shadow-lg">{vid.profiles?.avatar_url ? <img src={vid.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={24} className="text-white/50 w-full h-full p-2" />}</div>
                          <span className="text-white font-black text-[17px] drop-shadow-md">{vid.profiles?.full_name || 'אנונימי'}</span>
                        </div>
                        <p className="text-white/90 text-[15px] font-medium text-right pr-2 w-5/6 line-clamp-3 pointer-events-auto">{vid.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showFollowersList && (
            <div className="fixed inset-0 z-[99999] flex flex-col justify-end" dir="rtl">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowFollowersList(false)} />
               <motion.div drag="y" dragControls={followersDragControls} dragListener={false} dragConstraints={{ top: 0 }} dragElastic={0.2} onDragEnd={(e, { offset }) => { if (offset.y > 100) setShowFollowersList(false); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-white border-t border-black/10 rounded-t-[36px] h-[90vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.1)] relative overflow-hidden">
                 <div onPointerDown={(e) => followersDragControls.start(e)} style={{ touchAction: "none" }} className="w-full flex flex-col items-center pt-5 pb-4 cursor-grab border-b border-black/5"><div className="w-16 h-1.5 bg-black/15 rounded-full mb-4"></div><h3 className="text-[16px] font-black text-black px-6 w-full text-right">עוקבים ({followersCount})</h3></div>
                 <div className="flex-1 overflow-y-auto p-4 flex flex-col scrollbar-hide">
                    {loadingUsersList ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-black/20" /></div> : usersListData.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-4 border-b border-black/5 cursor-pointer hover:bg-black/5" onClick={() => { setShowFollowersList(false); navigate(`/profile/${u.id}`); }}>
                        <div className="flex items-center gap-4 text-right"><div className="w-12 h-12 rounded-full bg-black/5 overflow-hidden border border-black/10">{u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={20} className="text-black/30 w-full h-full p-2" />}</div><div className="flex flex-col"><span className="text-black text-[15px] font-black">{u.full_name || 'משתמש'}</span><span className="text-black/50 text-[10px] font-bold">@{u.username || 'user'}</span></div></div>
                      </div>
                    ))}
                 </div>
               </motion.div>
            </div>
          )}
          {showFollowingList && (
            <div className="fixed inset-0 z-[99999] flex flex-col justify-end" dir="rtl">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowFollowingList(false)} />
               <motion.div drag="y" dragControls={followingDragControls} dragListener={false} dragConstraints={{ top: 0 }} dragElastic={0.2} onDragEnd={(e, { offset }) => { if (offset.y > 100) setShowFollowingList(false); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-white border-t border-black/10 rounded-t-[36px] h-[90vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.1)] relative overflow-hidden">
                 <div onPointerDown={(e) => followingDragControls.start(e)} style={{ touchAction: "none" }} className="w-full flex flex-col items-center pt-5 pb-4 cursor-grab border-b border-black/5"><div className="w-16 h-1.5 bg-black/15 rounded-full mb-4"></div><h3 className="text-[16px] font-black text-black px-6 w-full text-right">נעקבים ({followingCount})</h3></div>
                 <div className="flex-1 overflow-y-auto p-4 flex flex-col scrollbar-hide">
                    {loadingUsersList ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-black/20" /></div> : usersListData.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-4 border-b border-black/5 cursor-pointer hover:bg-black/5" onClick={() => { setShowFollowingList(false); navigate(`/profile/${u.id}`); }}>
                        <div className="flex items-center gap-4 text-right"><div className="w-12 h-12 rounded-full bg-black/5 overflow-hidden border border-black/10">{u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={20} className="text-black/30 w-full h-full p-2" />}</div><div className="flex flex-col"><span className="text-black text-[15px] font-black">{u.full_name || 'משתמש'}</span><span className="text-black/50 text-[10px] font-bold">@{u.username || 'user'}</span></div></div>
                      </div>
                    ))}
                 </div>
               </motion.div>
            </div>
          )}
        </AnimatePresence>
      , document.body)}
    </div>
  );
};
