import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserCircle, Edit2, Zap, ChevronLeft, Loader2, Award, Flame, Wallet, Users, Crown, Activity, Heart, MessageSquare, Gift, ShoppingBag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { GlassCard, FadeIn } from '../components/ui';
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

  if (authLoading) return <div className="min-h-screen bg-[#030303] flex items-center justify-center text-white/20 font-black tracking-widest">LOADING...</div>;

  const userProfile = data.profile || authProfile || {};
  const currentLevel = userProfile.level || 1;
  const currentXP = userProfile.xp || 0;
  const streak = userProfile.streak || 0;
  
  const xpToNextLevel = currentLevel * 1000;
  const xpProgress = Math.min((currentXP / xpToNextLevel) * 100, 100);

  const joinedCircles = data.memberships.map((m: any) => m?.circle).filter(Boolean);

  const statsGrid = [
    { label: 'פוסטים', value: currentLevel * 12 + 4, icon: MessageSquare, color: 'text-blue-400' },
    { label: 'לייקים', value: currentLevel * 85 + 12, icon: Heart, color: 'text-red-400' },
    { label: 'מתנות', value: currentLevel * 3, icon: Gift, color: 'text-gray-300' } // שונה לכסף
  ];

  return (
    <FadeIn className="px-5 pt-8 pb-32 bg-[#030303] min-h-screen font-sans flex flex-col gap-6 relative overflow-x-hidden" dir="rtl">
      
      <div className="flex items-center justify-between relative z-10">
        <div className="w-10"></div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <UserCircle size={20} className="text-white/40" /> הפרופיל שלך
        </h1>
        <button 
          onClick={() => { triggerFeedback('pop'); navigate('/edit-profile'); }} 
          className="w-10 h-10 flex items-center justify-center text-white/30 hover:text-white transition-colors bg-white/5 rounded-full shadow-inner active:scale-90"
        >
          <Edit2 size={16} />
        </button>
      </div>

      <GlassCard className="bg-white/[0.04] rounded-[32px] flex flex-col items-center text-center relative overflow-hidden z-10 p-0 border-white/10 shadow-2xl">
        
        {/* תגית LVL בפינה השמאלית העליונה כמו כרטיס VIP */}
        <div className="absolute top-4 left-4 bg-white/10 border border-white/20 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl z-20 shadow-[0_0_15px_rgba(255,255,255,0.1)] backdrop-blur-md">
          LVL {currentLevel}
        </div>

        <div className="w-full h-24 bg-gradient-to-br from-purple-600/30 via-transparent to-blue-600/20 relative">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        </div>
        
        <div className="relative -mt-12 mb-3">
          <motion.div whileHover={{ scale: 1.05 }} className="w-24 h-24 rounded-[24px] bg-[#0A0A0A] border-4 border-[#080808] shadow-2xl overflow-hidden relative z-10 mx-auto">
            {userProfile?.avatar_url ? (
              <img src={userProfile.avatar_url} className="w-full h-full object-cover" alt="" />
            ) : (
              <UserCircle size={50} className="text-white/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            )}
          </motion.div>
        </div>
        
        <div className="w-full px-6 pb-6">
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2 mb-1 flex-wrap">
            {userProfile?.full_name || 'משתמש'} 
            {/* כתר כסוף/לבן */}
            {currentLevel >= 5 && <Crown size={18} className="text-gray-300 drop-shadow-md" />}
          </h2>
          <p className="text-white/40 font-bold text-sm tracking-widest mb-4" dir="ltr">@{userProfile?.username || 'user'}</p>
          
          {userProfile?.bio && (
            <p className="text-white/70 text-sm font-medium leading-relaxed max-w-[280px] mx-auto mb-6">
              {userProfile.bio}
            </p>
          )}

          <div className="flex items-center justify-center gap-2 w-full mb-6 flex-wrap">
            {currentLevel >= 5 && (
              <motion.div whileHover={{ scale: 1.05 }} className="flex items-center gap-1.5 bg-gradient-to-r from-white/10 to-white/5 border border-white/20 px-3 py-1.5 rounded-xl shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                <Award size={14} className="text-gray-200" />
                <span className="text-gray-200 text-[9px] font-black uppercase tracking-widest">CORE</span>
              </motion.div>
            )}
            <motion.div whileHover={{ scale: 1.05 }} className="flex items-center gap-1.5 bg-gradient-to-r from-red-500/10 to-orange-500/5 border border-red-500/30 px-3 py-1.5 rounded-xl">
              <Flame size={14} className="text-red-500" />
              <span className="text-red-500 text-[9px] font-black uppercase tracking-widest">{streak} ימים ברצף</span>
            </motion.div>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full mb-6">
            {statsGrid.map((stat, i) => (
              <div key={i} className="flex flex-col items-center justify-center bg-black/40 border border-white/5 rounded-2xl py-3 shadow-inner">
                <stat.icon size={14} className={`${stat.color} mb-1 opacity-80`} />
                <span className="text-white font-black text-sm">{stat.value}</span>
                <span className="text-white/30 text-[8px] font-bold uppercase tracking-widest">{stat.label}</span>
              </div>
            ))}
          </div>

          <div className="w-full bg-black/60 border border-white/5 rounded-2xl p-4 text-right shadow-inner">
            <div className="flex justify-between items-end mb-2">
              <span className="text-white/40 text-[9px] font-black uppercase">השלב הבא: {xpToNextLevel} XP</span>
              <span className="text-purple-400 text-[10px] font-black flex items-center gap-1"><Zap size={10} /> {currentXP} XP</span>
            </div>
            <div className="w-full h-2 bg-[#050505] rounded-full overflow-hidden shadow-inner border border-white/5 relative">
              <motion.div 
                initial={{ width: 0 }} 
                animate={{ width: `${xpProgress}%` }} 
                transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                className="absolute top-0 right-0 h-full bg-gradient-to-l from-purple-500 to-blue-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"
              />
            </div>
          </div>
        </div>
      </GlassCard>

      {/* אזור היוצרים - צבעים עודכנו לכסף/לבן */}
      {data.ownedCircles.length > 0 && (
        <div className="flex flex-col gap-3 z-10">
          <h3 className="text-white/40 text-[10px] font-black uppercase text-right px-1 flex items-center gap-1.5">
            <Activity size={12} /> מעגלים בניהולך
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {data.ownedCircles.map((circle: any) => (
              <GlassCard key={circle.id} className="p-4 bg-white/[0.04] border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.05)] rounded-[24px] cursor-pointer" onClick={() => { triggerFeedback('pop'); navigate(`/circle/${circle.slug}`); }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-right">
                    <div className="w-12 h-12 rounded-[16px] bg-black overflow-hidden shrink-0 shadow-inner">
                      {circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-white/5"><Users size={16} className="text-white/20" /></div>}
                    </div>
                    <div>
                      <span className="text-white font-black text-sm block">{circle.name}</span>
                      <span className="text-gray-300 text-[9px] font-black uppercase flex items-center gap-1 mt-0.5">OWNER 👑</span>
                    </div>
                  </div>
                  <ChevronLeft size={16} className="text-white/20" />
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* קהילות (Access) */}
      <div className="flex flex-col gap-3 z-10">
        <h3 className="text-white/40 text-[10px] font-black uppercase text-right px-1 flex items-center gap-1.5">
          <Users size={12} /> המעגלים שלך
        </h3>
        
        {loadingData ? (
          <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-white/10" /></div>
        ) : joinedCircles.length === 0 ? (
          <GlassCard className="bg-white/[0.02] border-white/5 rounded-[24px] text-center py-10">
            <p className="text-white/30 text-[10px] font-black uppercase tracking-widest">לא השגת גישה לשום מעגל עדיין</p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {joinedCircles.map((circle: any) => (
              <GlassCard key={circle.id} className="p-4 bg-white/[0.02] border border-white/10 rounded-[24px] flex items-center justify-between cursor-pointer hover:bg-white/[0.04]" onClick={() => { triggerFeedback('pop'); navigate(`/circle/${circle.slug}`); }}>
                <div className="flex items-center gap-3 text-right">
                  <div className="w-12 h-12 rounded-[16px] bg-black overflow-hidden shrink-0 shadow-inner">
                    {circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-white/5" />}
                  </div>
                  <div>
                    <span className="text-white font-black text-sm block">{circle.name}</span>
                    <span className="text-white/30 text-[9px] font-bold uppercase mt-0.5">גישה מאושרת 🔓</span>
                  </div>
                </div>
                <ChevronLeft size={16} className="text-white/20" />
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {/* פעולות מהירות (ארנק + חנות פלטינום) */}
      <div className="grid grid-cols-2 gap-3 mt-2 z-10 mb-8">
        <GlassCard 
          className="p-5 bg-green-500/5 border border-green-500/20 rounded-[28px] flex flex-col items-center justify-center gap-2 cursor-pointer text-center active:scale-95 transition-transform" 
          onClick={() => { triggerFeedback('pop'); navigate('/wallet'); }}
        >
          <div className="w-12 h-12 rounded-[18px] bg-green-500/10 flex items-center justify-center mb-1 shadow-inner">
            <Wallet size={20} className="text-green-400" />
          </div>
          <div>
            <span className="text-green-400 font-black text-2xl drop-shadow-[0_0_8px_rgba(74,222,128,0.3)] block">{userProfile?.credits?.toLocaleString() || 0}</span>
            <span className="text-white/40 text-[9px] font-bold uppercase tracking-widest block mt-0.5">CRD בארנק</span>
          </div>
        </GlassCard>

        {/* חנות שונתה לכסוף/לבן נקי */}
        <GlassCard 
          className="p-5 bg-white/5 border border-white/20 rounded-[28px] flex flex-col items-center justify-center gap-2 cursor-pointer text-center active:scale-95 transition-transform" 
          onClick={() => { triggerFeedback('pop'); navigate('/store'); }}
        >
          <div className="w-12 h-12 rounded-[18px] bg-white/10 flex items-center justify-center mb-1 shadow-inner">
            <ShoppingBag size={20} className="text-white" />
          </div>
          <div>
            <span className="text-white font-black text-sm block mb-1">חנות הבוסטים</span>
            <span className="text-white/40 text-[9px] font-bold uppercase tracking-widest block">שדרוג סטטוס</span>
          </div>
        </GlassCard>
      </div>

    </FadeIn>
  );
};
