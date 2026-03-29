import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCircle, Edit2, Zap, ChevronLeft, ChevronDown, Loader2, Award, Flame, Wallet, Users, Crown, Activity, Heart, MessageSquare, ShoppingBag, Link as LinkIcon, UserPlus, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { username } = useParams<{ username?: string }>(); // שולף מזהה אם קיים
  const { user, profile: authProfile, loading: authLoading } = useAuth();

  const [data, setData] = useState<any>({ profile: {}, memberships: [], ownedCircles: [] });
  const [loadingData, setLoadingData] = useState(true);
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  
  // States for Following System
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  // האם אני צופה בפרופיל שלי או של מישהו אחר?
  const isMyProfile = !username || username === authProfile?.username;

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        setLoadingData(true);
        // אם זה אני, תביא את הדאטה הפרטי והמלא שלי. אם זה מישהו אחר, תביא פרופיל ציבורי
        const endpoint = isMyProfile ? '/api/profile/collection' : `/api/profile/public/${username}`;
        const result = await apiFetch<any>(endpoint);
        
        setData(result);
        
        // כאן נטען את נתוני המעקב (זמני עד שנקים את הראוט בשרת)
        if (!isMyProfile) {
          setIsFollowing(result.is_following || false);
        }
        setFollowersCount(result.profile?.followers_count || 0);
        setFollowingCount(result.profile?.following_count || 0);

      } catch (err) { 
        console.error(err);
        toast.error('הפרופיל לא נמצא');
        navigate('/');
      } finally { 
        setLoadingData(false); 
      }
    };

    if (user && !authLoading) loadProfileData();
  }, [user, username, isMyProfile, authLoading, navigate]);

  const handleFollowToggle = async () => {
    if (followLoading) return;
    
    setFollowLoading(true);
    triggerFeedback('pop');
    
    // סימולציית מעקב עד לחיבור לשרת
    setTimeout(() => {
      if (isFollowing) {
        setIsFollowing(false);
        setFollowersCount(prev => prev - 1);
        toast.success(`הפסקת לעקוב אחרי ${data.profile?.username}`);
      } else {
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
        triggerFeedback('success');
        toast.success(`אתה עוקב אחרי ${data.profile?.username} עכשיו!`, { style: { background: '#111', color: '#e5e4e2', border: '1px solid rgba(229,228,226,0.2)' } });
      }
      setFollowLoading(false);
    }, 800);
  };

  if (authLoading || loadingData) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  // אם זה הפרופיל שלי, נשלב עם ה-Auth, אחרת נשתמש רק במה שחזר מהשרת (Public)
  const userProfile = isMyProfile ? { ...(authProfile || {}), ...(data?.profile || {}) } : data?.profile || {};

  const currentLevel = userProfile.level || 1;
  const currentXP = userProfile.xp || 0;
  const streak = userProfile.streak || 0;
  const xpToNextLevel = currentLevel * 1000;
  const xpProgress = Math.min((currentXP / xpToNextLevel) * 100, 100);

  const joinedCircles = data.memberships?.map((m: any) => m?.circle).filter(Boolean) || [];
  const ownedCircles = data.ownedCircles || [];

  const statsGrid = [
    { label: 'עוקבים', value: followersCount, icon: Users, color: 'text-[#e5e4e2]' },
    { label: 'נעקבים', value: followingCount, icon: Zap, color: 'text-[#2196f3]' },
    { label: 'מוניטין', value: currentLevel * 3, icon: Award, color: 'text-[#ffc107]' }
  ];

  return (
    <FadeIn className="px-4 pt-8 pb-32 bg-black min-h-screen flex flex-col gap-6 relative overflow-x-hidden" dir="rtl">
      
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex justify-center">
        <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[40%] bg-white/10 blur-[120px] rounded-full mix-blend-screen"></div>
      </div>

      <div className="flex items-center justify-between relative z-10 px-1">
        <div className="w-10">
          {!isMyProfile && (
            <button onClick={() => { triggerFeedback('pop'); navigate(-1); }} className="w-10 h-10 flex justify-center items-center bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-full shadow-lg active:scale-90 transition-all hover:bg-white/10">
              <ChevronLeft size={20} className="text-white/80" />
            </button>
          )}
        </div>
        <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
          <UserCircle size={20} className="text-white/40" /> {isMyProfile ? 'הפרופיל שלך' : `הפרופיל של @${userProfile?.username}`}
        </h1>
        <div className="w-10">
          {isMyProfile && (
            <button onClick={() => { triggerFeedback('pop'); navigate('/edit-profile'); }} className="w-10 h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-full shadow-lg active:scale-90">
              <Edit2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="p-6 bg-white/[0.04] backdrop-blur-3xl border border-white/10 rounded-[36px] flex flex-col items-center text-center relative overflow-hidden z-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] gap-4">
        <motion.div whileHover={{ scale: 1.05 }} className="w-32 h-32 rounded-full bg-black shadow-2xl overflow-hidden p-1.5 border border-white/10 mb-2">
          <div className="w-full h-full rounded-full overflow-hidden bg-[#111] relative">
            {userProfile?.avatar_url ? (
              <img src={userProfile.avatar_url} className="w-full h-full object-cover" alt="" />
            ) : (
              <UserCircle size={60} className="text-white/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            )}
          </div>
        </motion.div>

        <div className="w-full">
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2 mb-1 flex-wrap">
            {userProfile?.full_name || 'משתמש'}
            {currentLevel >= 5 && <Crown size={18} className="text-[#ffc107] drop-shadow-[0_0_8px_rgba(255,193,7,0.5)]" />}
          </h2>
          <p className="text-white/40 font-bold text-sm tracking-widest mb-3" dir="ltr">@{userProfile?.username || 'user'}</p>

          {/* כפתור מעקב יוקרתי (רק אם זה לא הפרופיל שלי) */}
          {!isMyProfile && (
            <div className="flex justify-center mb-4">
              <Button
                onClick={handleFollowToggle}
                disabled={followLoading}
                className={`h-12 px-8 rounded-[20px] font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${
                  isFollowing 
                    ? 'bg-white/[0.05] border border-white/10 text-white hover:bg-white/[0.08]' 
                    : 'bg-[#e5e4e2] text-black shadow-[0_0_20px_rgba(229,228,226,0.3)]'
                }`}
              >
                {followLoading ? <Loader2 size={16} className="animate-spin" /> : 
                 isFollowing ? <><UserCheck size={16} /> בטל מעקב</> : <><UserPlus size={16} /> עקוב</>}
              </Button>
            </div>
          )}

          {(userProfile?.zodiac || userProfile?.social_link) && (
            <div className="flex items-center justify-center gap-2 mb-2">
              {userProfile?.zodiac && (
                <span className="bg-black/40 border border-white/10 px-4 py-1.5 rounded-full text-white/80 text-[11px] font-black shadow-inner">
                  {userProfile.zodiac}
                </span>
              )}
              {userProfile?.social_link && (
                <a
                  href={userProfile.social_link.startsWith('http') ? userProfile.social_link : `https://${userProfile.social_link}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-black/40 border border-white/10 px-4 py-1.5 rounded-full text-[#e5e4e2] text-[11px] font-black shadow-inner flex items-center gap-1.5 hover:bg-white/10 transition-colors"
                >
                  <LinkIcon size={12} /> קישור חיצוני
                </a>
              )}
            </div>
          )}
        </div>

        {userProfile?.bio && (
          <div className="w-full mt-2">
            <button
              onClick={() => { triggerFeedback('pop'); setIsBioExpanded(!isBioExpanded); }}
              className="mx-auto flex flex-col items-center justify-center gap-1 text-white/30 hover:text-white/60 transition-colors"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest">קצת עליי</span>
              <motion.div animate={{ rotate: isBioExpanded ? 180 : 0 }} transition={{ duration: 0.3 }}>
                <ChevronDown size={16} />
              </motion.div>
            </button>
            <AnimatePresence>
              {isBioExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <p className="text-white/80 text-[14px] font-medium leading-relaxed max-w-[280px] mx-auto pb-2">
                    {userProfile.bio}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 z-10 w-full mb-2">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 py-5 rounded-[28px] shadow-2xl flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-[#e5e4e2]/50"></div>
          <span className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1.5 block">רמת משתמש</span>
          <span className="text-white font-black text-[28px] drop-shadow-[0_0_12px_rgba(255,255,255,0.2)] leading-none">LVL {currentLevel}</span>
        </div>
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 py-5 rounded-[28px] shadow-2xl flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-[#ff5722]/50"></div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Flame size={14} className="text-[#ff5722]" />
            <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">רצף פעילות</span>
          </div>
          <span className="text-white font-black text-[28px] drop-shadow-[0_0_12px_rgba(255,255,255,0.2)] leading-none">{streak} <span className="text-[12px] text-white/60">ימים</span></span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 z-10">
        {statsGrid.map((stat, i) => (
          <div key={i} className="flex flex-col items-center justify-center bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[28px] py-6 shadow-2xl relative overflow-hidden group">
            <stat.icon size={22} className={`${stat.color} mb-3 drop-shadow-[0_0_8px_currentColor]`} />
            <span className="text-white font-black text-[22px] mb-0.5 leading-none">{stat.value}</span>
            <span className="text-white/40 text-[9px] font-black uppercase tracking-widest mt-1">{stat.label}</span>
          </div>
        ))}
      </div>

      {isMyProfile && (
        <div className="w-full bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[32px] p-6 text-right shadow-2xl z-10 mt-2">
          <div className="flex justify-between items-end mb-4 px-1">
            <span className="text-white/40 text-[10px] font-black uppercase">השלב הבא: {xpToNextLevel}</span>
            <span className="text-white text-[13px] font-black flex items-center gap-1.5 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"><Zap size={14} className="text-[#e5e4e2]" /> {currentXP} XP</span>
          </div>
          <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden shadow-inner border border-white/5 relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${xpProgress}%` }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
              className="absolute top-0 right-0 h-full bg-[#e5e4e2] rounded-full shadow-[0_0_15px_rgba(229,228,226,0.6)]"
            />
          </div>
        </div>
      )}

      {isMyProfile && (
        <div className="grid grid-cols-2 gap-3 mt-2 z-10">
          <div onClick={() => { triggerFeedback('pop'); navigate('/wallet'); }} className="p-6 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[32px] flex flex-col items-center justify-center gap-4 cursor-pointer text-center active:scale-95 shadow-2xl hover:bg-white/[0.05] transition-all">
            <div className="w-16 h-16 rounded-[24px] bg-black border border-white/10 flex items-center justify-center shadow-inner">
              <Wallet size={26} className="text-[#e5e4e2] drop-shadow-[0_0_8px_rgba(229,228,226,0.4)]" />
            </div>
            <div>
              <span className="text-white font-black text-2xl drop-shadow-[0_0_12px_rgba(255,255,255,0.2)] block">{userProfile?.credits?.toLocaleString() || 0}</span>
              <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest block mt-1.5">הארנק שלך</span>
            </div>
          </div>

          <div onClick={() => { triggerFeedback('pop'); navigate('/store'); }} className="p-6 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[32px] flex flex-col items-center justify-center gap-4 cursor-pointer text-center active:scale-95 shadow-2xl hover:bg-white/[0.05] transition-all">
            <div className="w-16 h-16 rounded-[24px] bg-black border border-white/10 flex items-center justify-center shadow-inner">
              <ShoppingBag size={26} className="text-[#ff9800] drop-shadow-[0_0_8px_rgba(255,152,0,0.4)]" />
            </div>
            <div>
              <span className="text-white font-black text-[16px] block mb-1">בוסטים</span>
              <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest block mt-1.5">חנות VIP</span>
            </div>
          </div>
        </div>
      )}

      {ownedCircles.length > 0 && (
        <div className="flex flex-col gap-3 z-10 mt-6">
          <h3 className="text-white/40 text-[11px] font-black uppercase text-right px-2 flex items-center gap-1.5"><Activity size={14} className="text-[#e5e4e2]" /> מועדונים בניהול</h3>
          <div className="grid grid-cols-1 gap-3">
            {ownedCircles.map((circle: any) => (
              <div key={circle.id} className="p-4 bg-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl rounded-[28px] cursor-pointer hover:bg-white/[0.04] transition-all active:scale-[0.98]" onClick={() => { triggerFeedback('pop'); navigate(`/circle/${circle.slug}`); }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-right">
                    <div className="w-14 h-14 rounded-[20px] bg-black border border-white/10 overflow-hidden shrink-0 shadow-inner">
                      {circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Users size={20} className="text-white/20" /></div>}
                    </div>
                    <div>
                      <span className="text-white font-black text-[16px] block mb-1">{circle.name}</span>
                      <span className="text-[#ffc107] text-[9px] font-black uppercase flex items-center gap-1.5 tracking-widest">OWNER 👑</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5"><ChevronLeft size={16} className="text-white/60" /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 z-10 mt-4 mb-12">
        <h3 className="text-white/40 text-[11px] font-black uppercase text-right px-2 flex items-center gap-1.5"><Users size={14} className="text-[#2196f3]" /> מועדונים מחוברים</h3>
        {joinedCircles.length === 0 ? (
          <div className="p-8 bg-white/[0.01] border border-white/5 rounded-[28px] text-center shadow-inner">
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">לא הצטרף לשום מועדון עדיין</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {joinedCircles.map((circle: any) => (
              <div key={circle.id} className="p-4 bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-[28px] flex items-center justify-between cursor-pointer hover:bg-white/[0.04] transition-all shadow-xl active:scale-[0.98]" onClick={() => { triggerFeedback('pop'); navigate(`/circle/${circle.slug}`); }}>
                <div className="flex items-center gap-4 text-right">
                  <div className="w-14 h-14 rounded-[20px] bg-black border border-white/10 overflow-hidden shrink-0 shadow-inner">
                    {circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Users size={20} className="text-white/20" /></div>}
                  </div>
                  <div>
                    <span className="text-white font-black text-[16px] block mb-1">{circle.name}</span>
                    <span className="text-[#8bc34a] text-[9px] font-black uppercase tracking-widest flex items-center gap-1">גישה מאושרת 🔓</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5"><ChevronLeft size={16} className="text-white/60" /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </FadeIn>
  );
};
