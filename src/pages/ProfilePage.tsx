import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { UserCircle, Edit2, Zap, ChevronLeft, ChevronDown, Loader2, Award, Flame, Wallet, Users, Crown, Activity, Heart, MessageSquare, ShoppingBag, Link as LinkIcon, UserPlus, UserCheck, MapPin, Calendar, GraduationCap, HeartHandshake, Camera } from 'lucide-react';
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

  const [data, setData] = useState<any>({ profile: {}, memberships: [], ownedCircles: [] });
  const [loadingData, setLoadingData] = useState(true);
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  
  // Tabs State
  const [activeTab, setActiveTab] = useState<'clubs' | 'activity' | 'wallet'>('clubs');

  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  const [showFollowersList, setShowFollowersList] = useState(false);
  const [showFollowingList, setShowFollowingList] = useState(false);
  const [usersListData, setUsersListData] = useState<any[]>([]);
  const [loadingUsersList, setLoadingUsersList] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

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

        // ספירה אמיתית
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

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isMyProfile) return;

    setUploadingCover(true);
    const tid = toast.loading('מעדכן תמונת נושא...', { style: { background: '#111', color: '#fff' } });
    
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error('Not logged in');

      const fileExt = file.name.split('.').pop();
      const fileName = `${authData.user.id}_cover_${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage.from('feed_images').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('feed_images').getPublicUrl(uploadData.path);

      const { error: updateError } = await supabase.from('profiles').update({ cover_url: publicUrl }).eq('id', authData.user.id);
      if (updateError) throw updateError;

      setData((prev: any) => ({ ...prev, profile: { ...prev.profile, cover_url: publicUrl } }));
      toast.success('תמונת הנושא עודכנה בהצלחה!', { id: tid, style: { background: '#111', color: '#e5e4e2', border: '1px solid rgba(229,228,226,0.2)' } });
    } catch (err) {
      toast.error('שגיאה בהעלאת התמונה', { id: tid, style: { background: '#111', color: '#ef4444' } });
    } finally {
      setUploadingCover(false);
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
      {/* בוטום שיט רשימת עוקבים מחובר אמיתי */}
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

      {/* בוטום שיט רשימת נעקבים מחובר אמיתי */}
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
    <FadeIn className="bg-[#050505] min-h-screen flex flex-col pb-32 relative overflow-x-hidden font-sans" dir="rtl">
      
      {/* אזור תמונת נושא יוקרתית (Cover) עם העלאת תמונה */}
      <div className="w-full h-44 bg-[#111] relative z-0 group">
        {userProfile.cover_url ? (
          <img src={userProfile.cover_url} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent"></div>
        )}
        
        <div className="absolute top-6 left-4 right-4 flex justify-between items-center z-20">
           {!isMyProfile ? (
            <button onClick={() => { triggerFeedback('pop'); navigate(-1); }} className="w-10 h-10 flex justify-center items-center bg-black/40 backdrop-blur-md border border-white/10 rounded-full shadow-lg active:scale-90 transition-all hover:bg-black/60">
              <ChevronLeft size={20} className="text-white" />
            </button>
          ) : <div className="w-10"></div>}
          
          <div className="bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
             <span className="text-[#ffc107] font-black text-[12px] drop-shadow-[0_0_5px_rgba(255,193,7,0.5)]">LVL {currentLevel}</span>
          </div>
        </div>

        {/* כפתור החלפת קאבר (גלריה) */}
        {isMyProfile && (
          <>
            <input type="file" ref={coverInputRef} onChange={handleCoverChange} accept="image/*" className="hidden" />
            <button 
              onClick={() => coverInputRef.current?.click()} 
              disabled={uploadingCover}
              className="absolute bottom-3 right-3 w-9 h-9 bg-black/50 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-white/20 active:scale-90 transition-all z-20 hover:bg-black/70 disabled:opacity-50"
            >
              {uploadingCover ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            </button>
          </>
        )}
      </div>

      <div className="px-4 relative z-10 flex flex-col items-center -mt-16 w-full">
        {/* תמונת פרופיל חותכת את הקאבר */}
        <motion.div whileHover={{ scale: 1.05 }} className="w-32 h-32 rounded-full bg-[#050505] shadow-2xl p-1.5 relative z-20">
          <div className="w-full h-full rounded-full overflow-hidden bg-[#1a1a1a] border border-white/10 relative">
            {userProfile?.avatar_url ? (
              <img src={userProfile.avatar_url} className="w-full h-full object-cover" alt="" />
            ) : (
              <UserCircle size={60} className="text-white/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            )}
          </div>
          {isMyProfile && (
             <button onClick={() => { triggerFeedback('pop'); navigate('/edit-profile'); }} className="absolute bottom-0 left-0 w-8 h-8 bg-[#e5e4e2] text-black rounded-full flex items-center justify-center shadow-lg border-2 border-[#050505] active:scale-90 transition-transform">
               <Edit2 size={14} className="ml-0.5" />
             </button>
          )}
        </motion.div>

        <div className="text-center mt-3 w-full">
          <h2 className="text-[22px] font-black text-white tracking-tight flex items-center justify-center gap-1.5">
            {userProfile?.full_name || 'משתמש'}
            {currentLevel >= 5 && <Crown size={16} className="text-[#ffc107] drop-shadow-[0_0_8px_rgba(255,193,7,0.5)]" />}
          </h2>
          <p className="text-white/40 font-bold text-[13px] tracking-widest mb-3" dir="ltr">@{userProfile?.username || 'user'}</p>

          <div className="flex items-center justify-center gap-2 text-[14px] text-white/50 font-medium mb-5 w-full max-w-[300px] mx-auto flex-wrap">
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

          {/* כפתור "נעקוב" לבן נקי */}
          {!isMyProfile && (
            <div className="flex justify-center mb-5 w-full px-8">
              <Button
                onClick={handleFollowToggle}
                disabled={followLoading}
                className={`h-11 w-full rounded-xl font-black text-[14px] flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${
                  isFollowing 
                    ? 'bg-white/10 text-white hover:bg-white/20' 
                    : 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                }`}
              >
                {followLoading ? <Loader2 size={18} className="animate-spin" /> : 
                 isFollowing ? <><UserCheck size={18} /> עוקב</> : <><UserPlus size={18} /> נעקוב</>}
              </Button>
            </div>
          )}

          {(userProfile?.zodiac || userProfile?.social_link) && (
            <div className="flex flex-col items-center gap-2 mb-4">
              {userProfile?.social_link && (
                <a href={userProfile.social_link.startsWith('http') ? userProfile.social_link : `https://${userProfile.social_link}`} target="_blank" rel="noopener noreferrer" className="text-[#e5e4e2] text-[13px] font-bold flex items-center gap-1.5 hover:text-white transition-colors">
                  <LinkIcon size={14} className="text-white/40" /> <span dir="ltr" className="tracking-wide text-blue-400">{displayLink}</span>
                </a>
              )}
              {userProfile?.zodiac && (
                <span className="text-white/60 text-[13px] font-medium flex items-center gap-1.5">
                   {userProfile.zodiac}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="w-full mt-2">
          <button onClick={() => { triggerFeedback('pop'); setIsBioExpanded(!isBioExpanded); }} className="mx-auto flex items-center justify-center gap-1.5 text-white/50 hover:text-white transition-colors py-2 px-4 rounded-full bg-white/[0.02]">
            <span className="text-[12px] font-bold">קצת עליי</span>
            <motion.div animate={{ rotate: isBioExpanded ? 180 : 0 }} transition={{ duration: 0.3 }}><ChevronDown size={14} /></motion.div>
          </button>
          
          <AnimatePresence>
            {isBioExpanded && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden w-full">
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 mt-3 text-right flex flex-col gap-4">
                  {userProfile?.bio && <p className="text-white/90 text-[14px] leading-relaxed font-medium mb-2">{userProfile.bio}</p>}
                  <h4 className="text-white/80 font-black text-[14px] border-b border-white/5 pb-2 mb-1">פרטים אישיים</h4>
                  <div className="flex items-center gap-3 text-white/70 text-[13px]"><MapPin size={16} className="text-white/40" /><span>מתגורר ב<span className="font-black text-white ml-1">תל אביב</span></span></div>
                  <div className="flex items-center gap-3 text-white/70 text-[13px]"><Calendar size={16} className="text-white/40" /><span>תאריך לידה <span className="font-black text-white">12 באוגוסט</span></span></div>
                  <div className="flex items-center gap-3 text-white/70 text-[13px]"><HeartHandshake size={16} className="text-white/40" /><span><span className="font-black text-white">במערכת יחסים</span></span></div>
                  <div className="flex items-center gap-3 text-white/70 text-[13px]"><GraduationCap size={16} className="text-white/40" /><span>למד ב<span className="font-black text-white">אוניברסיטת בן גוריון</span></span></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ========================================= */}
        {/* טאבים יוקרתיים מפרידים בין התוכן התחתון   */}
        {/* ========================================= */}
        <div className="flex border-b border-white/10 w-full mt-8">
          <button onClick={() => setActiveTab('clubs')} className={`flex-1 pb-3 text-[13px] font-black transition-colors border-b-2 ${activeTab === 'clubs' ? 'text-white border-white' : 'text-white/40 border-transparent hover:text-white/70'}`}>
            מועדונים
          </button>
          <button onClick={() => setActiveTab('activity')} className={`flex-1 pb-3 text-[13px] font-black transition-colors border-b-2 ${activeTab === 'activity' ? 'text-white border-white' : 'text-white/40 border-transparent hover:text-white/70'}`}>
            פעילות
          </button>
          {isMyProfile && (
            <button onClick={() => setActiveTab('wallet')} className={`flex-1 pb-3 text-[13px] font-black transition-colors border-b-2 ${activeTab === 'wallet' ? 'text-white border-white' : 'text-white/40 border-transparent hover:text-white/70'}`}>
              שדרוגים
            </button>
          )}
        </div>

        <div className="w-full mt-6 mb-12">
          <AnimatePresence mode="wait">
            
            {/* טאב מועדונים */}
            {activeTab === 'clubs' && (
              <motion.div key="clubs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-6">
                {ownedCircles.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-white/60 text-[12px] font-bold text-right flex items-center gap-1.5"><Activity size={14} /> מועדונים בניהול</h3>
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 pt-1 -mx-4 px-4">
                      {ownedCircles.map((circle: any) => (
                        <motion.div key={circle.id} whileTap={{ scale: 0.95 }} className="shrink-0 w-32">
                          <div onClick={() => { triggerFeedback('pop'); navigate(`/circle/${circle.slug}`); }} className="rounded-2xl overflow-hidden relative border border-white/10 cursor-pointer shadow-lg h-36 flex flex-col justify-end">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10"></div>
                            {circle.cover_url ? <img src={circle.cover_url} className="absolute inset-0 w-full h-full object-cover z-0" /> : <div className="absolute inset-0 bg-[#111] flex items-center justify-center z-0"><Users size={20} className="text-white/20" /></div>}
                            <div className="relative z-20 p-3 text-center">
                              <span className="text-white font-black text-[12px] line-clamp-1">{circle.name}</span>
                              <span className="text-[#ffc107] text-[10px] font-bold mt-0.5">מייסד</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <h3 className="text-white/60 text-[12px] font-bold text-right flex items-center gap-1.5"><Users size={14} /> מועדונים מחוברים</h3>
                  {joinedCircles.length === 0 ? (
                    <div className="py-8 border border-white/5 rounded-2xl text-center bg-white/[0.01]">
                      <p className="text-white/30 text-[11px] font-medium">לא מחובר למועדונים</p>
                    </div>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 pt-1 -mx-4 px-4">
                      {joinedCircles.map((circle: any) => (
                        <motion.div key={circle.id} whileTap={{ scale: 0.95 }} className="shrink-0 w-32">
                          <div onClick={() => { triggerFeedback('pop'); navigate(`/circle/${circle.slug}`); }} className="rounded-2xl overflow-hidden relative border border-white/10 cursor-pointer shadow-lg h-36 flex flex-col justify-end">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10"></div>
                            {circle.cover_url ? <img src={circle.cover_url} className="absolute inset-0 w-full h-full object-cover z-0" /> : <div className="absolute inset-0 bg-[#111] flex items-center justify-center z-0"><Users size={20} className="text-white/20" /></div>}
                            <div className="relative z-20 p-3 text-center">
                              <span className="text-white font-black text-[12px] line-clamp-1">{circle.name}</span>
                              <span className="text-[#10b981] text-[10px] font-bold mt-0.5">מאושר</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* טאב פעילות */}
            {activeTab === 'activity' && (
              <motion.div key="activity" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full bg-white/[0.02] border border-white/5 rounded-2xl p-5 flex flex-col gap-4 shadow-lg">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <Flame size={18} className="text-[#ff5722]" />
                    <span className="text-white/70 text-[14px] font-bold">רצף פעילות</span>
                  </div>
                  <span className="text-white font-black text-[20px]">{streak} <span className="text-[12px] text-white/40 font-medium">ימים</span></span>
                </div>
                {isMyProfile && (
                  <>
                    <div className="w-full h-px bg-white/5 my-1"></div>
                    <div className="flex flex-col gap-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-white/40 text-[11px] uppercase font-bold">לרמה הבאה: {xpToNextLevel}</span>
                        <span className="text-[#e5e4e2] text-[14px] font-black flex items-center gap-1"><Zap size={14} /> {currentXP} XP</span>
                      </div>
                      <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden border border-white/5 relative">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${xpProgress}%` }} transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }} className="absolute top-0 right-0 h-full bg-[#e5e4e2] rounded-full" />
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* טאב ארנק ושדרוגים */}
            {activeTab === 'wallet' && isMyProfile && (
              <motion.div key="wallet" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-3">
                <div onClick={() => { triggerFeedback('pop'); navigate('/wallet'); }} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center justify-between cursor-pointer active:scale-95 transition-all hover:bg-white/[0.04]">
                  <div className="flex flex-col text-right">
                    <span className="text-white/40 text-[11px] font-bold">הארנק שלך</span>
                    <span className="text-white font-black text-[20px] mt-1">{userProfile?.credits?.toLocaleString() || 0}</span>
                  </div>
                  <div className="w-12 h-12 bg-black rounded-full border border-white/10 flex items-center justify-center shadow-inner"><Wallet size={20} className="text-[#e5e4e2]" /></div>
                </div>
                <div onClick={() => { triggerFeedback('pop'); navigate('/store'); }} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center justify-between cursor-pointer active:scale-95 transition-all hover:bg-white/[0.04]">
                  <div className="flex flex-col text-right">
                    <span className="text-white/40 text-[11px] font-bold">שדרוגים</span>
                    <span className="text-[#e5e4e2] font-black text-[16px] mt-1">חנות VIP</span>
                  </div>
                  <div className="w-12 h-12 bg-black rounded-full border border-white/10 flex items-center justify-center shadow-inner"><ShoppingBag size={20} className="text-[#e5e4e2]" /></div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

      {userListsSheets}

    </FadeIn>
  );
};
