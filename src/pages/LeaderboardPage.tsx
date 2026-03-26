import React, { useState } from 'react';
import { Trophy, Flame, Crown, Medal, Sparkles } from 'lucide-react';
import { GlassCard, FadeIn } from '../components/ui';

export const LeaderboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'wealth' | 'streak'>('wealth');

  // סימולציית נתונים - מנוע תחרות
  const LEADERS = {
    wealth: [
      { id: 1, name: 'Tal Yohala', score: 12500, label: 'CRD SPENT', role: 'CORE', badge: '🥇' },
      { id: 2, name: 'Dan88', score: 9400, label: 'CRD SPENT', role: 'OG', badge: '🥈' },
      { id: 3, name: 'VIP_Guest', score: 8200, label: 'CRD SPENT', role: 'CORE', badge: '🥉' },
      { id: 4, name: 'Anna_X', score: 4500, label: 'CRD SPENT', role: 'INNER', badge: '4' },
      { id: 5, name: 'NightOwl', score: 3100, label: 'CRD SPENT', role: 'INNER', badge: '5' },
    ],
    streak: [
      { id: 1, name: 'Dan88', score: 142, label: 'DAYS', role: 'OG', badge: '🥇' },
      { id: 2, name: 'Tal Yohala', score: 84, label: 'DAYS', role: 'CORE', badge: '🥈' },
      { id: 3, name: 'Anna_X', score: 65, label: 'DAYS', role: 'INNER', badge: '🥉' },
    ]
  };

  const currentList = LEADERS[activeTab];

  return (
    <FadeIn className="px-3 pt-6 pb-28 flex flex-col gap-6">
      <div className="px-1 flex flex-col gap-1 text-center items-center">
        <div className="w-16 h-16 rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center mb-2 shadow-2xl backdrop-blur-xl">
          <Trophy size={32} className="text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
        </div>
        <h1 className="text-4xl font-black text-white tracking-tighter drop-shadow-md">היכל התהילה</h1>
        <p className="text-white/40 text-sm font-bold">האנשים ששולטים במועדון.</p>
      </div>

      <div className="flex gap-2 px-1">
        <button onClick={() => setActiveTab('wealth')} className={`flex-1 h-12 rounded-2xl border text-sm font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'wealth' ? 'bg-white/15 text-white border-white/30 shadow-xl backdrop-blur-xl' : 'bg-white/5 text-white/50 border-white/5 hover:bg-white/10'}`}>
          <Crown size={16} className={activeTab === 'wealth' ? 'text-yellow-400' : ''} /> Top Spenders
        </button>
        <button onClick={() => setActiveTab('streak')} className={`flex-1 h-12 rounded-2xl border text-sm font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'streak' ? 'bg-white/15 text-white border-white/30 shadow-xl backdrop-blur-xl' : 'bg-white/5 text-white/50 border-white/5 hover:bg-white/10'}`}>
          <Flame size={16} className={activeTab === 'streak' ? 'text-orange-400' : ''} /> Top Streaks
        </button>
      </div>

      <div className="flex flex-col gap-3 mx-1 mt-2">
        {currentList.map((user, idx) => {
          const isFirst = idx === 0;
          const isSecond = idx === 1;
          const isThird = idx === 2;
          
          return (
            <GlassCard key={user.id} className={`p-4 flex items-center justify-between transition-all ${isFirst ? 'bg-yellow-500/10 border-yellow-500/30 shadow-[0_0_20px_rgba(250,204,21,0.1)] scale-[1.02]' : isSecond ? 'bg-slate-300/10 border-slate-300/30' : isThird ? 'bg-amber-700/10 border-amber-700/30' : 'bg-white/5 border-white/10'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shadow-inner ${isFirst ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/50' : isSecond ? 'bg-slate-300/20 text-slate-300 border border-slate-300/50' : isThird ? 'bg-amber-600/20 text-amber-500 border border-amber-600/50' : 'bg-white/5 text-white/40 border border-white/10'}`}>
                  {user.badge}
                </div>
                <div className="flex flex-col">
                  <div className="font-black text-base text-white flex items-center gap-2">
                    {user.name}
                    {user.role === 'CORE' && <Sparkles size={12} className="text-yellow-400" />}
                  </div>
                  <div className="text-[10px] font-bold text-white/40 bg-black/40 px-2 py-0.5 rounded-md w-fit mt-1">{user.role}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-black text-xl drop-shadow-md ${isFirst ? 'text-yellow-400' : 'text-white'}`}>
                  {user.score.toLocaleString()}
                </div>
                <div className="text-[10px] font-bold text-white/40 tracking-widest">{user.label}</div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </FadeIn>
  );
};
