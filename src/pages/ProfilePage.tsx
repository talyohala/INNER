import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCircle, Edit2, Zap, ChevronLeft, ChevronDown, Loader2, Award, Flame, Wallet, Users, Crown, Activity, Heart, MessageSquare, ShoppingBag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { FadeIn } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile: authProfile, loading: authLoading } = useAuth();
  
  const [data, setData] = useState<any>({ profile: {}, memberships: [], ownedCircles: [] });
  const [loadingData, setLoadingData] = useState(true);
  
  // סטייט חדש לפתיחת וסגירת הביו
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        const result = await apiFetch<any>('/api/profile/collection');
        setData(result);
      } catch (err) { console.error(err); } finally { setLoadingData(false); }
    };
    if (user) loadProfileData();
  }, [user]);

  if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  const userProfile = { ...(authProfile || {}), ...(data?.profile && Object.keys(data.profile).length > 0 ? data.profile : {}) };
  
  const currentLevel = userProfile.level || 1;
  const currentXP = userProfile.xp || 0;
  const streak = userProfile.streak || 0;
  
  const xpToNextLevel = currentLevel * 1000;
  const xpProgress = Math.min((currentXP / xpToNextLevel) * 100, 100);
  
  const joinedCircles = data.memberships.map((m: any) => m?.circle).filter(Boolean);

  // אייקונים מונוכרומטיים עפו, הצבעים החיים חזרו!
  const statsGrid = [
    { label: 'פוסטים', value: currentLevel * 12 + 4, icon: MessageSquare, color: 'text-[#e91e63]' },
    { label: 'לייקים', value: currentLevel * 85 + 12, icon: Heart, color: 'text-[#f44336]' },
    { label: 'מוניטין', value: currentLevel * 3, icon: Award, color: 'text-[#9c27b0]' }
  ];

  return (
    <FadeIn className="px-4 pt-8 pb-32 bg-black min-h-screen flex flex-col gap-6 relative overflow-x-hidden" dir="rtl">
      
      {/* תאורת אווירה כסופה */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex justify-center">
        <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[40%] bg-white/10 blur-[120px] rounded-full mix-blend-screen"></div>
      </div>

      <div className="flex items-center justify-between relative z-10">
        <div className="w-10"></div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
          <UserCircle size={20} className="text-white/40" /> הפרופיל שלך
        </h1>
        <button onClick={() => { triggerFeedback('pop'); navigate('/edit-profile'); }} className="w-10 h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-full shadow-lg active:scale-90">
          <Edit2 size={16} />
        </button>
      </div>

      {/* כרטיס פרופיל מרכזי - עכשיו מכיל את הביו באנימציה נפתחת */}
      <div className="p-6 bg-white/[0.04] backdrop-blur-3xl border border-white/10 rounded-[36px] flex flex-col items-center text-center relative overflow-hidden z-10 shadow-2xl gap-3">
        <motion.div whileHover={{ scale: 1.05 }} className="w-32 h-32 rounded-full bg-[#0a0a0a] shadow-2xl overflow-hidden p-1.5 border border-white/10 mb-2">
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
            {currentLevel >= 5 && <Crown size={18} className="text-[#9c27b0] drop-shadow-[0_0_8px_rgba(156,39,176,0.5)]" />}
          </h2>
          <p className="text-white/40 font-bold text-sm tracking-widest" dir="ltr">@{userProfile?.username || 'user'}</p>
        </div>

        {/* מנגנון פתיחת הביו */}
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
                  <p className="text-white/80 text-[15px] font-medium leading-relaxed max-w-[280px] mx-auto pb-2">
                    {userProfile.bio}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* כרטיס הישגים (LVL, Streak) - סוף סוף סימטרי לחלוטין */}
      <div className="grid grid-cols-2 gap-4 z-10 w-full mb-2">
        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 py-5 rounded-[28px] shadow-2xl flex flex-col items-center justify-center hover:bg-white/[0.06] transition-colors">
          <span className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1.5 block">רמת משתמש</span>
          <span className="text-white font-black text-2xl drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]">LVL {currentLevel}</span>
        </div>
        <motion.div whileHover={{ scale: 1.02 }} className="bg-white/[0.04] backdrop-blur-xl border border-white/10 py-5 rounded-[28px] shadow-2xl flex flex-col items-center justify-center hover:bg-white/[0.06] transition-colors relative">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Flame size={14} className="text-[#f44336]" />
            <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">רצף פעילות</span>
          </div>
          <span className="text-white font-black text-2xl drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]">{streak} <span className="text-[14px] text-white/60">ימים</span></span>
        </motion.div>
      </div>

      {/* כרטיס סטטיסטיקה - עם הצבעים החיים לאייקונים */}
      <div className="grid grid-cols-3 gap-4 z-10">
        {statsGrid.map((stat, i) => (
          <div key={i} className="flex flex-col items-center justify-center bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-[28px] py-6 shadow-2xl hover:bg-white/[0.06] transition-colors active:scale-95 transition-transform">
            <stat.icon size={22} className={`${stat.color} mb-3 drop-shadow-[0_0_8px_currentColor]`} />
            <span className="text-white font-black text-[18px] mb-0.5">{stat.value}</span>
            <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* כרטיס התקדמות XP - כחול/ירוק פרימיום */}
      <div className="w-full bg-white/[0.03] border border-white/10 rounded-[32px] p-6 text-right shadow-2xl z-10 mt-2">
        <div className="flex justify-between items-end mb-3.5 px-1">
          <span className="text-white/40 text-[10px] font-black uppercase">השלב הבא: {xpToNextLevel}</span>
          <span className="text-white text-[12px] font-black flex items-center gap-1.5 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"><Zap size={14} className="text-[#2196f3]" /> {currentXP} XP</span>
        </div>
        <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden shadow-inner border border-white/5 relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${xpProgress}%` }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
            className="absolute top-0 right-0 h-full bg-gradient-to-l from-[#2196f3] to-[#8bc34a] rounded-full shadow-[0_0_12px_rgba(33,150,243,0.5)]"
          />
        </div>
      </div>

      {/* אזור פעולות מהירות (עם צבעים חיים) */}
      <div className="grid grid-cols-2 gap-4 mt-2 z-10">
        <div onClick={() => { triggerFeedback('pop'); navigate('/wallet'); }} className="p-6 bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-[32px] flex flex-col items-center justify-center gap-4 cursor-pointer text-center active:scale-95 transition-transform shadow-2xl hover:bg-white/[0.08] transition-all">
          <div className="w-16 h-16 rounded-[24px] bg-black border border-white/10 flex items-center justify-center shadow-inner">
            <Wallet size={26} className="text-[#ff9800]" />
          </div>
          <div>
            <span className="text-white font-black text-3xl drop-shadow-[0_0_12px_rgba(255,152,0,0.3)] block">{userProfile?.credits?.toLocaleString() || 0}</span>
            <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest block mt-1.5">ארנק</span>
          </div>
        </div>
        
        <div onClick={() => { triggerFeedback('pop'); navigate('/store'); }} className="p-6 bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-[32px] flex flex-col items-center justify-center gap-4 cursor-pointer text-center active:scale-95 transition-transform shadow-2xl hover:bg-white/[0.08] transition-all">
          <div className="w-16 h-16 rounded-[24px] bg-black border border-white/10 flex items-center justify-center shadow-inner">
            <ShoppingBag size={26} className="text-[#f44336]" />
          </div>
          <div>
            <span className="text-white font-black text-[16px] block mb-1">בוסטים</span>
            <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest block mt-1">שדרוג VIP</span>
          </div>
        </div>
      </div>

      {/* מועדונים בניהולך */}
      {data.ownedCircles.length > 0 && (
        <div className="flex flex-col gap-4 z-10 mt-6">
          <h3 className="text-white/40 text-[11px] font-black uppercase text-right px-2 flex items-center gap-1.5"><Activity size={14} className="text-[#8bc34a]" /> בניהולך</h3>
          <div className="grid grid-cols-1 gap-4">
            {data.ownedCircles.map((circle: any) => (
              <div key={circle.id} className="p-5 bg-white/[0.05] backdrop-blur-xl border border-white/10 shadow-2xl rounded-[28px] cursor-pointer hover:bg-white/[0.08] transition-all active:scale-[0.98] transition-transform" onClick={() => { triggerFeedback('pop'); navigate(`/circle/${circle.slug}`); }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-right">
                    <div className="w-16 h-16 rounded-[24px] bg-black border border-white/10 overflow-hidden shrink-0 shadow-inner">
                      {circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Users size={20} className="text-white/20" /></div>}
                    </div>
                    <div>
                      <span className="text-white font-black text-[17px] block mb-0.5">{circle.name}</span>
                      <span className="text-[#ffc107] text-[10px] font-black uppercase flex items-center gap-1.5">OWNER 👑</span>
                    </div>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/5"><ChevronLeft size={18} className="text-white/60" /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* המועדונים שלך */}
      <div className="flex flex-col gap-4 z-10 mt-6 mb-12">
        <h3 className="text-white/40 text-[11px] font-black uppercase text-right px-2 flex items-center gap-1.5"><Users size={14} className="text-[#2196f3]" /> המעגלים שלך</h3>
        {loadingData ? (
          <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-white/20" /></div>
        ) : joinedCircles.length === 0 ? (
          <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[28px] text-center shadow-inner">
            <p className="text-white/40 text-[11px] font-black uppercase tracking-widest">לא הצטרפת לשום מעגל עדיין</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {joinedCircles.map((circle: any) => (
              <div key={circle.id} className="p-5 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[28px] flex items-center justify-between cursor-pointer hover:bg-white/[0.06] transition-all shadow-xl active:scale-[0.98] transition-transform" onClick={() => { triggerFeedback('pop'); navigate(`/circle/${circle.slug}`); }}>
                <div className="flex items-center gap-4 text-right">
                  <div className="w-16 h-16 rounded-[24px] bg-black border border-white/10 overflow-hidden shrink-0 shadow-inner">
                    {circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Users size={20} className="text-white/20" /></div>}
                  </div>
                  <div>
                    <span className="text-white font-black text-[17px] block mb-0.5">{circle.name}</span>
                    <span className="text-white/40 text-[10px] font-black uppercase">גישה מאושרת 🔓</span>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/5"><ChevronLeft size={18} className="text-white/60" /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </FadeIn>
  );
};
