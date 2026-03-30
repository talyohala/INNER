import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls, useScroll, useTransform } from 'framer-motion';
import { UserCircle, Edit2, Zap, ChevronLeft, ChevronDown, Loader2, Award, Flame, Wallet, Users, Crown, Activity, Heart, MessageSquare, ShoppingBag, Link as LinkIcon, UserPlus, UserCheck, MapPin, Calendar, GraduationCap, HeartHandshake } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { username: routeId } = useParams<{ username?: string }>();
  const { user, profile: authProfile, loading: authLoading } = useAuth();

  const [mounted, setMounted] = useState(false);
  const followersDragControls = useDragControls();
  const followingDragControls = useDragControls();
  
  // אנימציות גלילה לקאבר
  const { scrollY } = useScroll();
  const coverY = useTransform(scrollY, [0, 250], [0, -100]);
  const coverOpacity = useTransform(scrollY, [0, 200], [1, 0]);
  const coverScale = useTransform(scrollY, [0, 200], [1, 0.95]);

  const [data, setData] = useState<any>({ profile: {}, memberships: [], ownedCircles: [] });
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

  const isMyProfile = !routeId || routeId === authProfile?.username || routeId === user?.id;

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
          setData(result);
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

          const [{ data: memberships }, { data: ownedCircles }] = await Promise.all([
            supabase.from('circle_members').select('circle:circles(*)').eq('user_id', targetId).neq('role', 'admin'),
            supabase.from('circles').select('*').eq('owner_id', targetId)
          ]);

          let isFollowingUser = false;
          if (authData.user) {
            try {
              const { data: followData } = await supabase.from('followers').select('*').eq('follower_id', authData.user.id).eq('following_id', targetId).maybeSingle();
              if (followData) isFollowingUser = true;
            } catch(e) {}
          }

          setData({ profile: publicProfile, memberships: memberships || [], ownedCircles: ownedCircles || [] });
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
        console.error(err);
        toast.error('הפרופיל לא נמצא', { style: { background: '#111', color: '#ef4444' } });
        navigate('/');
      } finally { 
        setLoadingData(false); 
      }
    };

    if (user && !authLoading) loadProfileData();
  }, [user, routeId, isMyProfile, authLoading, navigate]);

  const handleFollowToggle = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    triggerFeedback('pop');
    
    try {
      const { data: authData } = await supabase.auth.getUser();
      const myId = authData.user?.id;
      const targetId = data.profile?.id;

      if (!myId || !targetId) throw new Error('חסרים פרטים לביצוע הפעולה');

      if (isFollowing) {
        const { error } = await supabase.from('followers').delete().eq('follower_id', myId).eq('following_id', targetId);
        if (error) throw error;
        
        setIsFollowing(false);
        setFollowersCount(prev => Math.max(0, prev - 1));
        toast.success(`הפסקת לעקוב אחרי @${data.profile?.username || 'המשתמש'}`, { style: { background: '#111', color: '#fff' } });
      } else {
        const { error } = await supabase.from('followers').insert({ follower_id: myId, following_id: targetId });
        if (error) throw error;

        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
        triggerFeedback('success');
        toast.success(`אתה עוקב אחרי @${data.profile?.username || 'המשתמש'} עכשיו! 💎`, { style: { background: '#111', color: '#e5e4e2', border: '1px solid rgba(229,228,226,0.2)' } });
      }
    } catch (err: any) {
      toast.error('שגיאה בביצוע הפעולה', { style: { background: '#111', color: '#ef4444' } });
    } finally {
      setFollowLoading(false);
    }
  };

  const openUsersListSheet = async (type: 'followers' | 'following') => {
    triggerFeedback('pop');
    setLoadingUsersList(true);
    setUsersListData([]);
    
    if (type === 'followers') setShowFollowersList(true);
    else setShowFollowingList(true);

    try {
      const targetId = data.profile?.id;
      if (!targetId) throw new Error('No target ID');

      let userIds: string[] = [];

      if (type === 'followers') {
        const { data: followersData } = await supabase.from('followers').select('follower_id').eq('following_id', targetId);
        userIds = followersData ? followersData.map(d => d.follower_id) : [];
      } else {
        const { data: followingData } = await supabase.from('followers').select('following_id').eq('follower_id', targetId);
        userIds = followingData ? followingData.map(d => d.following_id) : [];
      }

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('*').in('id', userIds);
        setUsersListData(profilesData || []);
      } else {
        setUsersListData([]);
      }
    } catch (err) {
      toast.error('שגיאה בטעינת רשימת המשתמשים');
    } finally {
      setLoadingUsersList(false);
    }
  };

  if (authLoading || loadingData) return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  const userProfile = isMyProfile ? { ...(authProfile || {}), ...(data?.profile || {}) } : data?.profile || {};
  const currentLevel = userProfile.level || 1;
  const currentXP = userProfile.xp || 0;
  const streak = userProfile.streak || 0;
  const xpToNextLevel = currentLevel * 1000;
  const xpProgress = Math.min((currentXP / xpToNextLevel) * 100, 100);
  
  const trueReputation = Math.floor(currentXP / 10) + (currentLevel * 5);

  const joinedCircles = data.memberships?.map((m: any) => m?.circle).filter(Boolean) || [];
  const ownedCircles = data.ownedCircles || [];

  const displayLink = userProfile?.social_link ? userProfile.social_link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : '';

  const userListsSheets = mounted && typeof document !== 'undefined' ? createPortal(
    <AnimatePresence>
      {showFollowersList && (
        <div className="fixed inset-0 z-[99999] flex flex-col justify-end" dir="rtl">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowFollowersList(false)} />
          <motion.div drag="y" dragControls={followersDragControls} dragListener={false} dragConstraints={{ top: 0 }} dragElastic={0.2} onDragEnd={(e, { offset, velocity }) => { if (offset.y > 100 || velocity.y > 400) setShowFollowersList(false); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-[#0A0A0A] border-t border-white/10 rounded-t-[36px] h-[90vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
            <div onPointerDown={(e) => followersDragControls.start(e)} style={{ touchAction: "none" }} className="w-full flex flex-col items-center pt-5 pb-4 cursor-grab active:cursor-grabbing bg-white/[0.02]">
              <div className="w-16 h-1.5 bg-white/20 rounded-full mb-4 pointer-events-none"></div>
              <div className="px-6 pb-2 flex items-center justify-start w-full"><h3 className="text-[16px] font-black text-white">עוקבים ({followersCount})</h3></div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col scrollbar-hide touch-pan-y" onPointerDown={(e) => { if (e.currentTarget.scrollTop > 0) e.stopPropagation(); }} onTouchStart={(e) => { if (e.currentTarget.scrollTop > 0) e.stopPropagation(); }}>
              {loadingUsersList ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-white/20" /></div> : 
               usersListData.length === 0 ? <div className="text-center text-white/40 text-xs py-10 font-bold uppercase tracking-widest">אין עוקבים עדיין</div> :
               usersListData.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-4 border-b border-white/5 cursor-pointer hover:bg-white/[0.03]" onClick={() => { triggerFeedback('pop'); setShowFollowersList(false); navigate(`/profile/${u.id}`); }}>
                  <div className="flex items-center gap-4 text-right">
                    <motion.div whileHover={{ scale: 1.05 }} className="w-12 h-12 rounded-full bg-black border border-white/10 overflow-hidden shrink-0 shadow-inner">
                      {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><UserCircle size={20} className="text-white/20" /></div>}
                    </motion.div>
                    <div className="flex flex-col">
                      <span className="text-white text-[15px] font-black">{u.full_name || 'משתמש'}</span>
                      <span className="text-white/40 text-[10px] font-bold mt-1 tracking-widest" dir="ltr">@{u.username || 'user'}</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5"><ChevronLeft size={16} className="text-white/60" /></div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {showFollowingList && (
        <div className="fixed inset-0 z-[99999] flex flex-col justify-end" dir="rtl">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowFollowingList(false)} />
          <motion.div drag="y" dragControls={followingDragControls} dragListener={false} dragConstraints={{ top: 0 }} dragElastic={0.2} onDragEnd={(e, { offset, velocity }) => { if (offset.y > 100 || velocity.y > 400) setShowFollowingList(false); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-[#0A0A0A] border-t border-white/10 rounded-t-[36px] h-[90vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
            <div onPointerDown={(e) => followingDragControls.start(e)} style={{ touchAction: "none" }} className="w-full flex flex-col items-center pt-5 pb-4 cursor-grab active:cursor-grabbing bg-white/[0.02]">
              <div className="w-16 h-1.5 bg-white/20 rounded-full mb-4 pointer-events-none"></div>
              <div className="px-6 pb-2 flex items-center justify-start w-full"><h3 className="text-[16px] font-black text-white">נעקבים ({followingCount})</h3></div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col scrollbar-hide touch-pan-y" onPointerDown={(e) => { if (e.currentTarget.scrollTop > 0) e.stopPropagation(); }} onTouchStart={(e) => { if (e.currentTarget.scrollTop > 0) e.stopPropagation(); }}>
              {loadingUsersList ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-white/20" /></div> : 
               usersListData.length === 0 ? <div className="text-center text-white/40 text-xs py-10 font-bold uppercase tracking-widest">לא עוקב אחרי אף אחד</div> :
               usersListData.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-4 border-b border-white/5 cursor-pointer hover:bg-white/[0.03]" onClick={() => { triggerFeedback('pop'); setShowFollowingList(false); navigate(`/profile/${u.id}`); }}>
                  <div className="flex items-center gap-4 text-right">
                    <motion.div whileHover={{ scale: 1.05 }} className="w-12 h-12 rounded-full bg-black border border-white/10 overflow-hidden shrink-0 shadow-inner">
                      {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><UserCircle size={20} className="text-white/20" /></div>}
                    </motion.div>
                    <div className="flex flex-col">
                      <span className="text-white text-[15px] font-black">{u.full_name || 'משתמש'}</span>
                      <span className="text-white/40 text-[10px] font-bold mt-1 tracking-widest" dir="ltr">@{u.username || 'user'}</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5"><ChevronLeft size={16} className="text-white/60" /></div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  , document.body) : null;

  return (
    <div className="bg-[#050505] min-h-screen relative font-sans" dir="rtl">
      
      {/* בר עליון צף - כפתורי חזרה ועריכה */}
      <div className="fixed top-6 left-4 right-4 flex justify-between items-center z-50 pointer-events-none">
         {!isMyProfile ? (
          <button onClick={() => { triggerFeedback('pop'); navigate(-1); }} className="pointer-events-auto w-10 h-10 flex justify-center items-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-full shadow-lg active:scale-90 transition-all hover:bg-black/60">
            <ChevronLeft size={20} className="text-white" />
          </button>
        ) : <div className="w-10"></div>}
        
        {/* כפתור עריכת פרופיל - עבר לבר העליון (כמו טיקטוק) */}
        {isMyProfile && (
          <button onClick={() => { triggerFeedback('pop'); navigate('/edit-profile'); }} className="pointer-events-auto w-10 h-10 flex justify-center items-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-full shadow-lg active:scale-90 transition-all hover:bg-black/60">
            <Edit2 size={16} className="text-white" />
          </button>
        )}
      </div>

      {/* תמונת נושא - שכבה אחורית עם אפקט גלילה פרלקס */}
      <motion.div 
        style={{ y: coverY, opacity: coverOpacity, scale: coverScale }} 
        className="fixed top-0 left-0 w-full h-[220px] bg-[#111] z-0 rounded-b-[40px] overflow-hidden shadow-2xl origin-top"
      >
        {userProfile.cover_url ? (
          <img src={userProfile.cover_url} className="w-full h-full object-cover opacity-80" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#2196f3]/10 to-transparent"></div>
        )}
        <div className="absolute top-6 left-5 flex flex-col items-center">
           <span className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-0.5 drop-shadow-md">רמה</span>
           <span className="text-[#e5e4e2] font-black text-[22px] leading-none drop-shadow-[0_0_12px_rgba(229,228,226,0.5)]">{currentLevel}</span>
        </div>
      </motion.div>

      {/* תוכן הפרופיל שגולל על הקאבר */}
      <FadeIn className="relative z-10 pt-[170px] pb-32">
        <div className="bg-[#050505] rounded-t-[40px] px-4 min-h-screen flex flex-col items-center pt-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          
          {/* תמונת פרופיל - חותכת בדיוק בחצי */}
          <motion.div whileHover={{ scale: 1.05 }} className="w-[110px] h-[110px] rounded-full bg-[#050505] shadow-[0_10px_30px_rgba(0,0,0,0.8)] p-1.5 relative -mt-[55px] z-20">
            <div className="w-full h-full rounded-full overflow-hidden bg-[#1a1a1a] border border-white/5 relative">
              {userProfile?.avatar_url ? (
                <img src={userProfile.avatar_url} className="w-full h-full object-cover" alt="" />
              ) : (
                <UserCircle size={50} className="text-white/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              )}
            </div>
          </motion.div>

          <div className="text-center mt-3 w-full">
            <h2 className="text-[20px] font-black text-white tracking-tight flex items-center justify-center gap-1.5">
              {userProfile?.full_name || 'משתמש'}
              {currentLevel >= 5 && <Crown size={14} className="text-[#ffc107] drop-shadow-[0_0_8px_rgba(255,193,7,0.5)]" />}
            </h2>
            <p className="text-white/30 font-bold text-[12px] tracking-widest mb-4" dir="ltr">@{userProfile?.username || 'user'}</p>

            <div className="flex items-center justify-center gap-2 text-[13px] text-white/50 font-medium mb-5 w-full max-w-[280px] mx-auto flex-wrap">
               <span className="cursor-pointer hover:text-white transition-colors" onClick={() => openUsersListSheet('followers')}>
                 <span className="font-black text-white">{followersCount}</span> עוקבים
               </span>
               <span>•</span>
               <span className="cursor-pointer hover:text-white transition-colors" onClick={() => openUsersListSheet('following')}>
                 <span className="font-black text-white">{followingCount}</span> נעקבים
               </span>
               <span>•</span>
               <span>
                 <span className="font-black text-white">{trueReputation}</span> מוניטין
               </span>
            </div>

            {/* כפתור "נעקוב" יוקרתי, לבן, לא כחול */}
            {!isMyProfile && (
              <div className="flex justify-center mb-6 w-full px-10">
                <Button
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  className={`h-10 w-full rounded-[16px] font-black text-[13px] tracking-wide flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${
                    isFollowing 
                      ? 'bg-white/10 text-white hover:bg-white/20' 
                      : 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                  }`}
                >
                  {followLoading ? <Loader2 size={16} className="animate-spin" /> : 
                   isFollowing ? <><UserCheck size={16} /> עוקב</> : <><UserPlus size={16} /> נעקוב</>}
                </Button>
              </div>
            )}

            {/* קישורים ומזל - אפור יוקרתי ונקי */}
            {(userProfile?.zodiac || userProfile?.social_link) && (
              <div className="flex flex-col items-center gap-1.5 mb-5">
                {userProfile?.social_link && (
                  <a href={userProfile.social_link.startsWith('http') ? userProfile.social_link : `https://${userProfile.social_link}`} target="_blank" rel="noopener noreferrer" className="text-white/60 text-[12px] font-bold flex items-center gap-1.5 hover:text-white transition-colors">
                    <LinkIcon size={12} className="text-white/30" /> <span dir="ltr" className="tracking-wide">{displayLink}</span>
                  </a>
                )}
                {userProfile?.zodiac && (
                  <span className="text-white/40 text-[12px] font-medium flex items-center gap-1.5">
                     {userProfile.zodiac}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ========================================= */}
          {/* מחוונים מרכזיים מול העיניים (רצף ו-XP)      */}
          {/* ========================================= */}
          <div className="w-full flex flex-col gap-3 px-2 mb-5">
             <div className="flex justify-between items-center w-full">
                <span className="text-white/50 text-[12px] font-bold flex items-center gap-1.5"><Flame size={14} className="text-[#ff5722]" /> רצף פעילות: <span className="text-white">{streak} ימים</span></span>
                {isMyProfile && <span className="text-white/50 text-[12px] font-bold flex items-center gap-1"><Zap size={12} className="text-[#e5e4e2]" /> <span className="text-white">{currentXP}</span> / {xpToNextLevel}</span>}
             </div>
             {isMyProfile && (
               <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden relative">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${xpProgress}%` }} transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }} className="absolute top-0 right-0 h-full bg-gradient-to-l from-white/80 to-white/20 rounded-full" />
               </div>
             )}
          </div>

          {/* "קצת עליי" - בלי מסגרת, טקסט נקי ומשתלב */}
          <div className="w-full mt-2">
            <button onClick={() => { triggerFeedback('pop'); setIsBioExpanded(!isBioExpanded); }} className="mx-auto flex items-center justify-center gap-1.5 text-white/40 hover:text-white transition-colors py-1">
              <span className="text-[11px] font-bold uppercase tracking-widest">קצת עליי</span>
              <motion.div animate={{ rotate: isBioExpanded ? 180 : 0 }} transition={{ duration: 0.3 }}><ChevronDown size={12} /></motion.div>
            </button>
            
            <AnimatePresence>
              {isBioExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden w-full">
                  <div className="pt-4 pb-2 px-2 text-right flex flex-col gap-3">
                    {userProfile?.bio && <p className="text-white/80 text-[13px] leading-relaxed font-medium mb-3">{userProfile.bio}</p>}
                    
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-3 text-white/50 text-[12px]"><MapPin size={14} /><span>מתגורר ב<span className="font-bold text-white ml-1">תל אביב</span></span></div>
                      <div className="flex items-center gap-3 text-white/50 text-[12px]"><Calendar size={14} /><span>תאריך לידה <span className="font-bold text-white">12 באוגוסט</span></span></div>
                      <div className="flex items-center gap-3 text-white/50 text-[12px]"><HeartHandshake size={14} /><span><span className="font-bold text-white">במערכת יחסים</span></span></div>
                      <div className="flex items-center gap-3 text-white/50 text-[12px]"><GraduationCap size={14} /><span>למד ב<span className="font-bold text-white">אוניברסיטת בן גוריון</span></span></div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-6"></div>

          {/* ארנק ושדרוגים (רק שלי) */}
          {isMyProfile && (
            <div className="grid grid-cols-2 gap-3 w-full mb-6">
              <div onClick={() => { triggerFeedback('pop'); navigate('/wallet'); }} className="bg-white/[0.02] border border-white/5 rounded-[20px] p-3 flex items-center justify-between cursor-pointer active:scale-95 transition-all hover:bg-white/[0.04]">
                <div className="flex flex-col text-right">
                  <span className="text-white/30 text-[9px] font-bold tracking-widest uppercase mb-0.5">ארנק</span>
                  <span className="text-white font-black text-[15px]">{userProfile?.credits?.toLocaleString() || 0}</span>
                </div>
                <Wallet size={16} className="text-[#e5e4e2]" />
              </div>
              <div onClick={() => { triggerFeedback('pop'); navigate('/store'); }} className="bg-white/[0.02] border border-white/5 rounded-[20px] p-3 flex items-center justify-between cursor-pointer active:scale-95 transition-all hover:bg-white/[0.04]">
                <div className="flex flex-col text-right">
                  <span className="text-white/30 text-[9px] font-bold tracking-widest uppercase mb-0.5">שדרוגים</span>
                  <span className="text-[#e5e4e2] font-black text-[13px]">חנות VIP</span>
                </div>
                <ShoppingBag size={16} className="text-[#e5e4e2]" />
              </div>
            </div>
          )}

          {/* גלריית מועדונים אופקית */}
          {ownedCircles.length > 0 && (
            <div className="flex flex-col gap-2 w-full mt-2 mb-4">
              <h3 className="text-white/50 text-[11px] font-bold text-right px-1 flex items-center gap-1.5"><Activity size={12} /> מועדונים בניהול</h3>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 pt-1 -mx-4 px-4">
                {ownedCircles.map((circle: any) => (
                  <motion.div key={circle.id} whileTap={{ scale: 0.95 }} className="shrink-0 w-28">
                    <div onClick={() => { triggerFeedback('pop'); navigate(`/circle/${circle.slug}`); }} className="rounded-2xl overflow-hidden relative border border-white/5 cursor-pointer shadow-lg h-32 flex flex-col justify-end">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10"></div>
                      {circle.cover_url ? <img src={circle.cover_url} className="absolute inset-0 w-full h-full object-cover z-0" /> : <div className="absolute inset-0 bg-[#111] flex items-center justify-center z-0"><Users size={20} className="text-white/20" /></div>}
                      <div className="relative z-20 p-2 text-center">
                        <span className="text-white font-black text-[11px] line-clamp-1">{circle.name}</span>
                        <span className="text-[#ffc107] text-[8px] font-bold mt-0.5">מייסד</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 w-full mt-2">
            <h3 className="text-white/50 text-[11px] font-bold text-right px-1 flex items-center gap-1.5"><Users size={12} /> מועדונים מחוברים</h3>
            {joinedCircles.length === 0 ? (
              <div className="py-6 border border-white/5 rounded-[20px] text-center bg-white/[0.01]">
                <p className="text-white/20 text-[10px] font-medium">לא מחובר למועדונים</p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 pt-1 -mx-4 px-4">
                {joinedCircles.map((circle: any) => (
                  <motion.div key={circle.id} whileTap={{ scale: 0.95 }} className="shrink-0 w-28">
                    <div onClick={() => { triggerFeedback('pop'); navigate(`/circle/${circle.slug}`); }} className="rounded-2xl overflow-hidden relative border border-white/5 cursor-pointer shadow-lg h-32 flex flex-col justify-end">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10"></div>
                      {circle.cover_url ? <img src={circle.cover_url} className="absolute inset-0 w-full h-full object-cover z-0" /> : <div className="absolute inset-0 bg-[#111] flex items-center justify-center z-0"><Users size={20} className="text-white/20" /></div>}
                      <div className="relative z-20 p-2 text-center">
                        <span className="text-white font-black text-[11px] line-clamp-1">{circle.name}</span>
                        <span className="text-[#10b981] text-[8px] font-bold mt-0.5">מאושר</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

        </div>
      </FadeIn>

      {userListsSheets}

    </div>
  );
};
