import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserCircle, Edit2, Zap, ChevronLeft, Loader2, Award, Flame, Wallet, Users, Crown, Activity, Heart, MessageSquare, Gift, ShoppingBag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { FadeIn } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile: authProfile, loading: authLoading } = useAuth();
  
  const [data, setData] = useState<any>({ profile: {}, memberships: [], ownedCircles: [] });
  const [loadingData, setLoadingData] = useState(true);

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

  const userProfile = data.profile || authProfile || {};
  const currentLevel = userProfile.level || 1;
  const currentXP = userProfile.xp || 0;
  const streak = userProfile.streak || 0;
  
  const xpToNextLevel = currentLevel * 1000;
  const xpProgress = Math.min((currentXP / xpToNextLevel) * 100, 100);
  
  const joinedCircles = data.memberships.map((m: any) => m?.circle).filter(Boolean);

  const statsGrid = [
    { label: 'פוסטים', value: currentLevel * 12 + 4, icon: MessageSquare },
    { label: 'לייקים', value: currentLevel * 85 + 12, icon: Heart },
    { label: 'מוניטין', value: currentLevel * 3, icon: Award }
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

      <div className="bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-[36px] flex flex-col items-center text-center relative overflow-hidden z-10 p-0 shadow-2xl">
        <div className="absolute top-5 left-5 bg-white/10 border border-white/20 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl z-20 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
          LVL {currentLevel}
        </div>
        
        <div className="w-full h-28 bg-gradient-to-br from-white/[0.08] via-transparent to-white/[0.02] relative border-b border-white/5"></div>
        
        <div className="relative -mt-14 mb-4">
          <motion.div whileHover={{ scale: 1.05 }} className="w-28 h-28 rounded-[28px] bg-black border border-white/20 shadow-2xl overflow-hidden relative z-10 mx-auto p-1">
            <div className="w-full h-full rounded-[24px] overflow-hidden bg-[#111]">
              {userProfile?.avatar_url ? (
                <img src={userProfile.avatar_url} className="w-full h-full object-cover" alt="" />
              ) : (
                <UserCircle size={50} className="text-white/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              )}
            </div>
          </motion.div>
        </div>
        
        <div className="w-full px-6 pb-6">
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2 mb-1 flex-wrap">
            {userProfile?.full_name || 'משתמש'}
            {currentLevel >= 5 && <Crown size={18} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />}
          </h2>
          <p className="text-white/40 font-bold text-sm tracking-widest mb-4" dir="ltr">@{userProfile?.username || 'user'}</p>
          
          {userProfile?.bio && (
            <p className="text-white/80 text-[15px] font-medium leading-relaxed max-w-[280px] mx-auto mb-6">
              {userProfile.bio}
            </p>
          )}

          <div className="flex items-center justify-center gap-3 w-full mb-8 flex-wrap">
            {currentLevel >= 5 && (
              <motion.div whileHover={{ scale: 1.05 }} className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-[16px] shadow-inner">
                <Award size={14} className="text-white" />
                <span className="text-white text-[10px] font-black uppercase tracking-widest">CORE</span>
              </motion.div>
            )}
            <motion.div whileHover={{ scale: 1.05 }} className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-[16px] shadow-inner">
              <Flame size={14} className="text-white" />
              <span className="text-white text-[10px] font-black uppercase tracking-widest">{streak} ימים</span>
            </motion.div>
          </div>

          <div className="grid grid-cols-3 gap-3 w-full mb-8">
            {statsGrid.map((stat, i) => (
              <div key={i} className="flex flex-col items-center justify-center bg-black/60 border border-white/10 rounded-[20px] py-4 shadow-inner">
                <stat.icon size={16} className="text-white/80 mb-2" />
                <span className="text-white font-black text-[16px]">{stat.value}</span>
                <span className="text-white/40 text-[9px] font-bold uppercase tracking-widest mt-0.5">{stat.label}</span>
              </div>
            ))}
          </div>

          <div className="w-full bg-black/60 border border-white/10 rounded-[24px] p-5 text-right shadow-inner">
            <div className="flex justify-between items-end mb-3">
              <span className="text-white/40 text-[10px] font-black uppercase">השלב הבא: {xpToNextLevel}</span>
              <span className="text-white text-[11px] font-black flex items-center gap-1 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"><Zap size={12} /> {currentXP} XP</span>
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden shadow-inner border border-white/5 relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress}%` }}
                transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                className="absolute top-0 right-0 h-full bg-gradient-to-l from-white to-white/40 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* אזור פעולות מהירות (ארנק וחנות - מונוכרומטי) */}
      <div className="grid grid-cols-2 gap-4 mt-2 z-10">
        <div onClick={() => { triggerFeedback('pop'); navigate('/wallet'); }} className="p-5 bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-[32px] flex flex-col items-center justify-center gap-3 cursor-pointer text-center active:scale-95 transition-transform shadow-2xl">
          <div className="w-14 h-14 rounded-[20px] bg-black border border-white/10 flex items-center justify-center shadow-inner">
            <Wallet size={24} className="text-white" />
          </div>
          <div>
            <span className="text-white font-black text-2xl drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] block">{userProfile?.credits?.toLocaleString() || 0}</span>
            <span className="text-white/40 text-[9px] font-bold uppercase tracking-widest block mt-1">יתרה בארנק</span>
          </div>
        </div>
        
        <div onClick={() => { triggerFeedback('pop'); navigate('/store'); }} className="p-5 bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-[32px] flex flex-col items-center justify-center gap-3 cursor-pointer text-center active:scale-95 transition-transform shadow-2xl">
          <div className="w-14 h-14 rounded-[20px] bg-black border border-white/10 flex items-center justify-center shadow-inner">
            <ShoppingBag size={24} className="text-white" />
          </div>
          <div>
            <span className="text-white font-black text-[15px] block mb-1">חנות הבוסטים</span>
            <span className="text-white/40 text-[9px] font-bold uppercase tracking-widest block">שדרוג סטטוס</span>
          </div>
        </div>
      </div>

      {/* מועדונים בניהולך */}
      {data.ownedCircles.length > 0 && (
        <div className="flex flex-col gap-3 z-10 mt-4">
          <h3 className="text-white/40 text-[11px] font-black uppercase text-right px-1 flex items-center gap-1.5"><Activity size={14} /> מעגלים בניהולך</h3>
          <div className="grid grid-cols-1 gap-3">
            {data.ownedCircles.map((circle: any) => (
              <div key={circle.id} className="p-4 bg-white/[0.06] backdrop-blur-xl border border-white/10 shadow-2xl rounded-[28px] cursor-pointer hover:bg-white/[0.08] transition-all" onClick={() => { triggerFeedback('pop'); navigate(`/circle/${circle.slug}`); }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-right">
                    <div className="w-14 h-14 rounded-[20px] bg-black border border-white/10 overflow-hidden shrink-0 shadow-inner">
                      {circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Users size={18} className="text-white/20" /></div>}
                    </div>
                    <div>
                      <span className="text-white font-black text-[16px] block">{circle.name}</span>
                      <span className="text-white/60 text-[10px] font-black uppercase flex items-center gap-1 mt-1">OWNER 👑</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5"><ChevronLeft size={16} className="text-white/60" /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* המועדונים שלך */}
      <div className="flex flex-col gap-3 z-10 mt-4 mb-10">
        <h3 className="text-white/40 text-[11px] font-black uppercase text-right px-1 flex items-center gap-1.5"><Users size={14} /> המעגלים שלך</h3>
        {loadingData ? (
          <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-white/20" /></div>
        ) : joinedCircles.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/5 rounded-[28px] text-center py-10 shadow-inner">
            <p className="text-white/40 text-[11px] font-black uppercase tracking-widest">לא השגת גישה למעגל עדיין</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {joinedCircles.map((circle: any) => (
              <div key={circle.id} className="p-4 bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-[28px] flex items-center justify-between cursor-pointer hover:bg-white/[0.06] transition-all shadow-xl" onClick={() => { triggerFeedback('pop'); navigate(`/circle/${circle.slug}`); }}>
                <div className="flex items-center gap-4 text-right">
                  <div className="w-14 h-14 rounded-[20px] bg-black border border-white/10 overflow-hidden shrink-0 shadow-inner">
                    {circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Users size={18} className="text-white/20" /></div>}
                  </div>
                  <div>
                    <span className="text-white font-black text-[16px] block">{circle.name}</span>
                    <span className="text-white/40 text-[10px] font-black uppercase mt-1 block">גישה מאושרת 🔓</span>
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
