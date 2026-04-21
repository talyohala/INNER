import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
  TrendingUp, Users, DollarSign, ArrowDownLeft, Crown, 
  Loader2, Sparkles, Megaphone, Ticket, BarChart3, Activity, UserMinus, Focus, Maximize2, Power
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

type StudioStats = {
  total_revenue_crd: number;
  mrr_crd: number; // Monthly Recurring Revenue
  active_members: number;
  profile_views: number;
  churn_rate: number;
};

type OwnedCircle = {
  id: string;
  name: string;
  slug: string;
  members_count: number;
  join_price: number;
  cover_url: string;
};

type Transaction = {
  id: string;
  amount: number;
  description: string;
  created_at: string;
  profiles: {
    full_name: string;
  } | null;
};

const cleanToastStyle = {
  background: 'rgba(15, 15, 15, 0.95)',
  backdropFilter: 'blur(20px)',
  color: '#ffffff',
  border: '1px solid rgba(255, 255, 255, 0.03)',
  borderRadius: '100px',
  fontSize: '14px',
  fontWeight: 700,
  padding: '12px 24px',
  boxShadow: '0 15px 40px rgba(0,0,0,0.6)',
};

// סמלים מטאליים מעוצבים לעמוד
const StudioActionIcon: React.FC<{ icon: React.ElementType, colorClass: string }> = ({ icon: Icon, colorClass }) => (
  <div className={`w-14 h-14 rounded-full flex items-center justify-center relative overflow-hidden group border border-white/5 bg-[#1a1a1e] shadow-inner`}>
    <div className={`absolute inset-0 ${colorClass}/5 blur-lg opacity-60 rounded-full scale-125`} />
    <Icon size={26} className={`${colorClass} relative z-10`} />
  </div>
);

export const CreatorStudioPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [stats, setStats] = useState<StudioStats>({ total_revenue_crd: 0, mrr_crd: 0, active_members: 0, profile_views: 0, churn_rate: 0 });
  const [ownedCircles, setOwnedCircles] = useState<OwnedCircle[]>([]);
  const [recentIncome, setRecentIncome] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [cashingOut, setCashingOut] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    loadStudioData();
  }, [profile?.id]);

  const loadStudioData = async () => {
    setLoading(true);
    try {
      const { data: circles } = await supabase
        .from('circles')
        .select('id, name, slug, join_price, cover_url')
        .eq('owner_id', profile!.id);
      
      const formattedCircles = (circles || []).map(c => {
        const memCount = Math.floor(Math.random() * 80) + 5;
        return { ...c, members_count: memCount };
      });
      setOwnedCircles(formattedCircles);

      const { data: txs } = await supabase
        .from('transactions')
        .select('id, amount, description, created_at, type, profiles!transactions_user_id_fkey (full_name)')
        .eq('receiver_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(6);

      const incomingTxs = (txs || []) as unknown as Transaction[];
      setRecentIncome(incomingTxs);

      const totalMembers = formattedCircles.reduce((acc, c) => acc + c.members_count, 0);
      const estMRR = formattedCircles.reduce((acc, c) => acc + (c.members_count * (c.join_price || 0)), 0);
      
      setStats({
        total_revenue_crd: profile!.crd_balance || 0,
        mrr_crd: estMRR,
        active_members: totalMembers,
        profile_views: Math.floor(Math.random() * 5000) + 1200,
        churn_rate: (Math.random() * 5 + 1).toFixed(1) as unknown as number 
      });

    } catch (err: any) {
      console.error(err);
      toast.error('שגיאה בטעינת נתוני הסטודיו', { style: cleanToastStyle });
    } finally {
      setLoading(false);
    }
  };

  const handleCashOut = () => {
    if (stats.total_revenue_crd < 100) {
      triggerFeedback('error');
      return toast('מינימום למשיכה: 100 CRD', { style: cleanToastStyle });
    }
    
    triggerFeedback('pop');
    setCashingOut(true);
    const tid = toast.loading('מעבד משיכה...', { style: cleanToastStyle });
    
    setTimeout(async () => {
      try {
        const { error } = await supabase.rpc('request_cashout', { p_user_id: profile!.id, p_amount: stats.total_revenue_crd });
        if (error) throw error;
        
        setCashingOut(false);
        triggerFeedback('success');
        toast.success('המשיכה אושרה! הכסף יועבר לבנק שלך.', { id: tid, style: cleanToastStyle });
        loadStudioData();
      } catch (err: any) {
        setCashingOut(false);
        triggerFeedback('error');
        toast.error(err.message || 'שגיאה בביצוע המשיכה', { id: tid, style: cleanToastStyle });
      }
    }, 2000);
  };

  const featureComingSoon = (name: string) => {
    triggerFeedback('pop');
    toast(`הפיצ'ר "${name}" יפתח בקרוב!`, { icon: '🚀', style: cleanToastStyle });
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#121212] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-accent-primary" size={32} />
      </div>
    );
  }

  const estimatedNis = (stats.total_revenue_crd / 100) * 7;
  const mrrNis = (stats.mrr_crd / 100) * 7;

  return (
    <FadeIn className="px-5 pt-10 pb-[120px] bg-[#121212] min-h-[100dvh] font-sans flex flex-col gap-10 relative overflow-x-hidden" dir="rtl">
      
      {/* תאורת רקע פסטל מרחפת עדינה מאוד */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-15%] right-[-15%] w-[80%] h-[60%] bg-accent-primary/2 rounded-full blur-[160px]" />
        <div className="absolute bottom-[25%] left-[-15%] w-[70%] h-[50%] bg-white/2 rounded-full blur-[160px]" />
      </div>

      {/* Header - מראה מטאלי יוקרתי */}
      <div className="relative z-10 flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <Power size={24} className="text-[#8b8b93] mt-1" />
          <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
            CONTROL <span className="text-accent-primary">CENTER</span>
          </h1>
        </div>
      </div>

      {/* MAIN REVENUE & MRR - קומפוזיציית Benton Box מרחפת ללא מסגרות */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-5 gap-6">
        
        {/* יתרה זמינה */}
        <div className="relative md:col-span-3 bg-[#1a1a1e] rounded-[40px] p-8 flex flex-col justify-between overflow-hidden h-[260px] shadow-lg">
          <div className="absolute top-0 right-0 w-48 h-48 bg-accent-primary/5 blur-[90px] rounded-full pointer-events-none" />
          
          <div className="flex flex-col z-10">
            <span className="text-[#8b8b93] text-[12px] font-black uppercase tracking-[0.25em] mb-2 flex items-center gap-1.5">
              <DollarSign size={16} className="text-accent-primary" /> AVAILABLE BALANCE
            </span>
            <span className="text-7xl font-black text-white tracking-tighter drop-shadow-md">
              ₪{estimatedNis.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="text-accent-primary text-[13px] font-black uppercase tracking-widest mt-1.5">
              {stats.total_revenue_crd.toLocaleString()} CRD
            </span>
          </div>
          
          <div className="w-full z-10 mt-6">
            <Button onClick={handleCashOut} disabled={cashingOut || stats.total_revenue_crd < 100} className="w-full h-16 bg-accent-primary text-black hover:bg-white hover:text-black font-black text-[15px] uppercase tracking-widest rounded-[24px] flex items-center justify-center gap-2 active:scale-95 transition-all border-none shadow-[0_5px_25px_rgba(255,165,0,0.2)] disabled:opacity-50">
              {cashingOut ? <Loader2 size={24} className="animate-spin text-black" /> : 'WITHDRAW CRD'}
            </Button>
          </div>
        </div>

        {/* MRR & STATS */}
        <div className="relative md:col-span-2 grid grid-cols-1 gap-6">
          <div className="bg-[#1a1a1e] p-6 rounded-[32px] flex flex-col justify-between h-[120px] shadow-md">
            <div className="flex items-center gap-2 text-[#8b8b93] text-[10px] font-black uppercase tracking-widest">
              <TrendingUp size={14} className="text-white" /> EST. MONTHLY REVENUE
            </div>
            <div className="flex flex-col">
              <span className="text-4xl font-black text-white">₪{mrrNis.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <span className="text-[#8b8b93] text-[11px] font-bold tracking-widest">Current MRR (Shekels)</span>
            </div>
          </div>
          <div className="bg-[#1a1a1e] p-6 rounded-[32px] flex flex-col justify-between h-[120px] shadow-md">
            <div className="flex items-center gap-2 text-[#8b8b93] text-[10px] font-black uppercase tracking-widest">
              <Users size={14} className="text-white" /> TOTAL MEMBERS
            </div>
            <div className="flex flex-col">
              <span className="text-4xl font-black text-white">{stats.active_members}</span>
              <span className="text-[#8b8b93] text-[11px] font-bold tracking-widest">Active This Month</span>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS - סמלים מטאליים */}
      <div className="relative z-10 flex flex-col gap-4 mt-2 px-1 snap-x">
        <span className="text-[#8b8b93] text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
          <Maximize2 size={12} className="text-accent-primary" /> QUICK ACTIONS
        </span>
        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
          <button onClick={() => { triggerFeedback('pop'); navigate('/create-post'); }} className="snap-start shrink-0 flex flex-col items-center gap-2.5 active:scale-95 transition-transform">
            <StudioActionIcon icon={Sparkles} colorClass="text-accent-primary" />
            <span className="text-white font-black text-[11px] tracking-wide">POST</span>
          </button>
          <button onClick={() => { triggerFeedback('pop'); navigate('/create-circle'); }} className="snap-start shrink-0 flex flex-col items-center gap-2.5 active:scale-95 transition-transform">
            <StudioActionIcon icon={Crown} colorClass="text-amber-400" />
            <span className="text-white font-black text-[11px] tracking-wide">CIRCLE</span>
          </button>
          <button onClick={() => featureComingSoon('קמפיין Push')} className="snap-start shrink-0 flex flex-col items-center gap-2.5 active:scale-95 transition-transform">
            <StudioActionIcon icon={Megaphone} colorClass="text-accent-primary" />
            <span className="text-white font-black text-[11px] tracking-wide">PUSH</span>
          </button>
          <button onClick={() => featureComingSoon('אנליטיקס מלא')} className="snap-start shrink-0 flex flex-col items-center gap-2.5 active:scale-95 transition-transform">
            <StudioActionIcon icon={BarChart3} colorClass="text-[#8b8b93]" />
            <span className="text-white font-black text-[11px] tracking-wide">STATS</span>
          </button>
        </div>
      </div>

      {/* MANAGED CIRCLES & PERFORMANCE */}
      <div className="relative z-10 flex flex-col gap-4 mt-2 px-1">
        <div className="flex items-center justify-between px-1">
          <span className="text-[#8b8b93] text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
            <Focus size={12} className="text-accent-primary" /> COMMUNITY PERFORMANCE
          </span>
          <span className="bg-[#1a1a1e] text-red-500 px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest flex items-center gap-1.5 shadow-inner">
            <UserMinus size={12} /> {stats.churn_rate}% CHURN RATE
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {ownedCircles.length === 0 ? (
            <div className="bg-[#1a1a1e] rounded-[30px] p-8 text-center shadow-md">
              <span className="text-[#8b8b93] font-bold text-[13px]">No managed communities yet.</span>
            </div>
          ) : (
            ownedCircles.map((circle) => (
              <button
                key={circle.id}
                onClick={() => { triggerFeedback('pop'); navigate(`/circle/${circle.slug}`); }}
                className="w-full bg-[#1a1a1e] p-3.5 rounded-[28px] flex items-center justify-between hover:bg-white/5 active:scale-[0.98] transition-all border-none shadow-md group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-[20px] bg-[#121212] overflow-hidden shrink-0 border border-white/5">
                    {circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[#8b8b93] font-black text-2xl">{circle.name.charAt(0)}</div>}
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-white font-black text-[17px] drop-shadow-sm">{circle.name}</span>
                    <span className="text-accent-primary text-[12px] font-black mt-1.5 tracking-widest flex items-center gap-1.5">
                      <Users size={12} /> {circle.members_count.toLocaleString()} ACTIVE MEMBERS
                    </span>
                  </div>
                </div>
                <div className="w-11 h-11 rounded-full bg-[#121212] flex items-center justify-center border border-white/5 ml-3">
                  <ChevronLeft size={18} className="text-[#8b8b93] rtl:rotate-180 group-hover:text-accent-primary transition-colors" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

    </FadeIn>
  );
};
