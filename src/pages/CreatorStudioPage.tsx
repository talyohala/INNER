import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { TrendingUp, Users, DollarSign, Gift, ArrowUpRight, Crown, Loader2, Sparkles, ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { GlassCard, FadeIn, Button } from '../components/ui';

type StudioStats = {
  total_revenue_crd: number;
  active_members: number;
  gifts_received_today: number;
  profile_views: number;
  owned_circles: any[];
};

export const CreatorStudioPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [stats, setStats] = useState<StudioStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cashingOut, setCashingOut] = useState(false);

  useEffect(() => {
    const loadStudio = async () => {
      try {
        setLoading(true);
        // משיכת נתונים אמיתיים מהשרת שלנו!
        const result = await apiFetch<StudioStats>('/api/studio/stats');
        setStats(result);
      } catch (err: any) {
        toast.error(err.message || 'שגיאה בטעינת הסטודיו');
      } finally {
        setLoading(false);
      }
    };
    loadStudio();
  }, []);

  const handleCashOut = () => {
    setCashingOut(true);
    // סימולציית משיכת כספים (70% ליוצר)
    setTimeout(() => {
      setCashingOut(false);
      toast.success('בקשת המשיכה אושרה! הכסף בדרך לבנק. 💸');
    }, 2000);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white/20 font-black tracking-widest animate-pulse text-xl">ANALYZING REVENUE...</div>;

  // חישוב שווי אמיתי (לפי 70% רווח ליוצר מתוך ערך ה-CRD)
  const estimatedNis = ((stats?.total_revenue_crd || 0) / 100) * 7;

  return (
    <FadeIn className="px-3 pt-6 pb-28 flex flex-col gap-6">
      
      {/* Header */}
      <div className="px-1 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter drop-shadow-md">סטודיו יוצרים</h1>
        </div>
      </div>

      {/* Hero Revenue Card */}
      <GlassCard className="mx-1 p-0 overflow-hidden relative border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-green-500/10 via-transparent to-transparent blur-2xl" />
        
        <div className="p-6 relative z-10">
          <div className="flex items-center gap-2 text-white/50 text-xs font-black tracking-[0.2em] uppercase mb-1">
            <DollarSign size={16} className="text-green-400" /> סך הכנסות ממתינות
          </div>
          
          <div className="text-6xl font-black text-white tracking-tighter drop-shadow-2xl mb-1">
            ₪{estimatedNis.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          
          <div className="flex items-center gap-2 mb-6">
            <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold text-white/40 tracking-widest">
              {(stats?.total_revenue_crd || 0).toLocaleString()} CRD
            </span>
          </div>

          <Button 
            onClick={handleCashOut}
            disabled={cashingOut || !stats?.total_revenue_crd}
            className={`w-full h-14 bg-green-500/20 hover:bg-green-500/30 border-green-500/40 text-green-300 font-black text-lg tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(34,197,94,0.1)] ${cashingOut || !stats?.total_revenue_crd ? 'opacity-70' : ''}`}
          >
            {cashingOut ? <Loader2 size={24} className="animate-spin" /> : 'משוך כספים לבנק'}
          </Button>
        </div>
      </GlassCard>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 mx-1">
        <GlassCard className="p-4 bg-white/5 border-white/10 flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 blur-xl rounded-full" />
          <Users size={18} className="text-blue-400 mb-1 relative z-10" />
          <div className="text-2xl font-black text-white relative z-10">{stats?.active_members || 0}</div>
          <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest relative z-10">מנויים פעילים</div>
        </GlassCard>

        <GlassCard className="p-4 bg-white/5 border-white/10 flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-500/10 blur-xl rounded-full" />
          <Gift size={18} className="text-yellow-400 mb-1 relative z-10" />
          <div className="text-2xl font-black text-white relative z-10">{stats?.gifts_received_today || 0}</div>
          <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest relative z-10">מתנות היום</div>
        </GlassCard>
      </div>

      {/* Psychological Boost */}
      <div className="mx-1 bg-gradient-to-r from-purple-500/20 to-transparent p-4 rounded-2xl border border-purple-500/30 shadow-inner flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/40 shrink-0">
          <Crown size={24} className="text-purple-300 drop-shadow-md" />
        </div>
        <div>
          <h4 className="text-white font-black text-sm mb-0.5">הסטודיו שלך באוויר!</h4>
          <p className="text-purple-200/60 text-[11px] font-bold leading-snug">הנתונים כאן נמשכים בזמן אמת מהארנק והקהילות שלך.</p>
        </div>
      </div>

      {/* ניהול המעגלים שלי */}
      <div className="flex flex-col gap-3 mx-1 mt-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-white/40 text-[10px] font-black tracking-[0.2em] uppercase flex items-center gap-2">
            <Sparkles size={14} className="text-white/60" /> המעגלים שלך
          </h3>
          <button onClick={() => navigate('/create-circle')} className="text-[10px] text-white/60 font-black uppercase hover:text-white transition-colors bg-white/5 px-2 py-1 rounded-md border border-white/10">
            + מעגל חדש
          </button>
        </div>

        {stats?.owned_circles?.length === 0 ? (
          <div className="text-center text-white/40 text-xs py-4">עדיין אין לך קהילות בניהולך.</div>
        ) : (
          stats?.owned_circles?.map((circle) => (
            <button 
              key={circle.id} 
              onClick={() => navigate(`/circle/${circle.slug}`)}
              className="block w-full text-right outline-none active:scale-[0.98] transition-transform duration-200"
            >
              <GlassCard className="p-4 bg-white/5 border-white/10 flex items-center justify-between hover:bg-white/10 transition-colors">
                <div className="flex flex-col">
                  <span className="text-white font-black text-base drop-shadow-sm">{circle.name}</span>
                  <span className="text-white/40 text-[10px] font-bold mt-1 flex items-center gap-2">
                    <span className="flex items-center gap-1"><Users size={10}/> {circle.members} חברים</span>
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                  <ChevronLeft size={18} />
                </div>
              </GlassCard>
            </button>
          ))
        )}
      </div>

    </FadeIn>
  );
};
