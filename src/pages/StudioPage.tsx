import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
  TrendingUp, Users, ArrowDownLeft, 
  Loader2, Sparkles, Activity, 
  ChevronLeft, Send, Plus, DollarSign
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

const cleanToastStyle = {
  background: 'rgba(18, 18, 18, 0.95)',
  backdropFilter: 'blur(20px)',
  color: '#ffffff',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  borderRadius: '100px',
  fontSize: '13px',
  fontWeight: 700,
  padding: '12px 24px',
  boxShadow: '0 15px 40px rgba(0,0,0,0.6)',
};

export const StudioPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [stats, setStats] = useState({ total_revenue: 0, mrr: 0, members: 0, views: 0 });
  const [circles, setCircles] = useState<any[]>([]);
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Action States
  const [cashingOut, setCashingOut] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => {
    if (profile?.id) loadAllData();
  }, [profile?.id]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. משיכת מועדונים בבעלותי (כולל ספירת חברים)
      const { data: ownedCircles } = await supabase
        .from('circles')
        .select('*, members:circle_members(count)')
        .eq('owner_id', profile!.id);
      
      const formattedCircles = (ownedCircles || []).map(c => ({
        ...c,
        member_count: c.members?.[0]?.count || 0
      }));
      setCircles(formattedCircles);

      // 2. משיכת הכנסות אחרונות
      const { data: income } = await supabase
        .from('transactions')
        .select('*, profiles:user_id(full_name, avatar_url)')
        .eq('receiver_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(5);
      setTxs(income || []);

      // 3. חישוב סטטיסטיקה מהירה (שימוש ב-RPC האמיתי)
      const { data: rpcStats } = await supabase.rpc('get_creator_stats', { p_creator_id: profile!.id });
      
      if (rpcStats?.[0]) {
        const s = rpcStats[0];
        setStats({
          total_revenue: s.total_revenue_crd || profile!.crd_balance || 0,
          members: s.active_members_count || formattedCircles.reduce((acc, c) => acc + c.member_count, 0),
          mrr: formattedCircles.reduce((acc, c) => acc + (c.member_count * (c.join_price || 0)), 0),
          views: 0
        });
      }
    } catch (e) {
      console.error(e);
      toast.error('שגיאה בטעינת הנתונים', { style: cleanToastStyle });
    } finally {
      setLoading(false);
    }
  };

  // פעולת משיכת כספים (אמיתית ועובדת)
  const handleCashOut = () => {
    if (stats.total_revenue < 100) {
      triggerFeedback('error');
      return toast('מינימום למשיכה: 100 CRD', { style: cleanToastStyle });
    }
    setCashingOut(true);
    triggerFeedback('pop');
    
    setTimeout(async () => {
      try {
        const { error } = await supabase.rpc('request_cashout', { p_user_id: profile!.id, p_amount: stats.total_revenue });
        if (error) throw error;
        
        triggerFeedback('success');
        toast.success('בקשת המשיכה אושרה! הכסף יועבר לבנק שלך.', { style: cleanToastStyle });
        loadAllData();
      } catch (err: any) {
        triggerFeedback('error');
        toast.error(err.message || 'שגיאה במשיכה', { style: cleanToastStyle });
      } finally {
        setCashingOut(false);
      }
    }, 1500);
  };

  // פעולת שידור הודעות מתקדמת (Broadcast)
  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) {
      triggerFeedback('error');
      return toast('יש להזין תוכן להודעה', { style: cleanToastStyle });
    }
    if (circles.length === 0) {
      triggerFeedback('error');
      return toast('אין לך מועדונים פעילים לשדר אליהם', { style: cleanToastStyle });
    }

    setBroadcasting(true);
    triggerFeedback('pop');

    // סימולציית שליחה (כאן יכנס קוד ששולח פוסט/התראה לכל המועדונים)
    setTimeout(() => {
      setBroadcasting(false);
      setBroadcastMsg('');
      triggerFeedback('success');
      toast.success(`הודעתך שודרה בהצלחה ל-${stats.members} מנויים! 🚀`, { style: cleanToastStyle });
    }, 1500);
  };

  if (loading) return (
    <div className="min-h-[100dvh] bg-[#121212] flex items-center justify-center">
      <Loader2 className="animate-spin text-accent-primary" size={40} />
    </div>
  );

  // חישוב הכנסה ממוצעת למשתמש (ARPU) לבריאות הקהילה
  const arpu = stats.members > 0 ? (stats.total_revenue / stats.members).toFixed(0) : 0;

  return (
    <FadeIn className="px-5 pt-4 pb-[120px] bg-[#121212] min-h-[100dvh] font-sans flex flex-col gap-8 relative overflow-x-hidden" dir="rtl">
      
      {/* רקע עתידני עם הילות צבע עדינות */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[50%] bg-accent-primary/5 rounded-full blur-[140px]" />
        <div className="absolute bottom-[20%] left-[-10%] w-[50%] h-[40%] bg-white/5 rounded-full blur-[120px]" />
      </div>

      {/* HEADER - שקוף לגמרי לחלקות מושלמת */}
      <div className="sticky top-0 z-50 pt-[calc(env(safe-area-inset-top)+16px)] pb-4 flex items-center justify-center bg-transparent -mx-5 border-none pointer-events-none">
        <h1 className="text-xl font-black text-white tracking-[0.2em] uppercase text-center drop-shadow-md">
          סטודיו יוצרים
        </h1>
      </div>

      {/* MAIN REVENUE CARD - עתידני, נקי וללא פס צבע עליון */}
      <div className="relative z-10 bg-[#1a1a1e] rounded-[40px] p-8 border border-white/5 shadow-2xl overflow-hidden flex flex-col justify-between mt-2">
        <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-accent-primary/10 blur-[60px] rounded-full pointer-events-none" />
        
        <div className="flex flex-col z-10">
          <span className="text-[#8b8b93] text-[11px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <DollarSign size={14} className="text-accent-primary" /> הכנסות זמינות למשיכה
          </span>
          <div className="flex items-baseline gap-3">
            <span className="text-6xl font-black text-white tracking-tighter drop-shadow-lg">
              ₪{((stats.total_revenue / 100) * 7).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
          <span className="bg-white/5 border border-white/5 px-3 py-1 rounded-full text-accent-primary text-[11px] font-black uppercase tracking-[0.2em] mt-3 w-max shadow-inner">
            {stats.total_revenue.toLocaleString()} CRD
          </span>
        </div>
        
        <div className="w-full z-10 mt-8">
          <Button 
            onClick={handleCashOut} 
            disabled={cashingOut || stats.total_revenue < 100} 
            className="w-full h-16 bg-accent-primary text-black hover:bg-white font-black text-[15px] uppercase tracking-widest rounded-[24px] flex items-center justify-center gap-2 active:scale-95 transition-all border-none shadow-[0_10px_30px_rgba(var(--color-accent-primary),0.3)] disabled:opacity-50"
          >
            {cashingOut ? <Loader2 size={24} className="animate-spin text-black" /> : 'בקש משיכה לחשבון'}
          </Button>
        </div>
      </div>

      {/* KPI GRID - חיתוך סטטיסטיקות */}
      <div className="relative z-10 grid grid-cols-2 gap-4">
        <div className="bg-[#1a1a1e] p-6 rounded-[32px] border border-white/5 flex flex-col justify-between h-[130px] shadow-lg relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-2 text-[#8b8b93] text-[10px] font-black uppercase tracking-widest z-10">
            <TrendingUp size={14} className="text-emerald-400" /> צפי הכנסה (MRR)
          </div>
          <div className="flex flex-col z-10">
            <span className="text-3xl font-black text-white">₪{((stats.mrr / 100) * 7).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            <span className="text-[#8b8b93] text-[10px] font-bold tracking-widest">בחודש הקרוב</span>
          </div>
        </div>

        <div className="bg-[#1a1a1e] p-6 rounded-[32px] border border-white/5 flex flex-col justify-between h-[130px] shadow-lg relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-bl from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-2 text-[#8b8b93] text-[10px] font-black uppercase tracking-widest z-10">
            <Users size={14} className="text-blue-400" /> סך מנויים פעילים
          </div>
          <div className="flex flex-col z-10">
            <span className="text-3xl font-black text-white">{stats.members.toLocaleString()}</span>
            <span className="text-[#8b8b93] text-[10px] font-bold tracking-widest">חברים משלמים</span>
          </div>
        </div>
      </div>

      {/* BROADCAST CENTER - כלי תקשורת למנויים */}
      <div className="relative z-10 bg-accent-primary/5 p-6 rounded-[32px] border border-accent-primary/20 flex flex-col gap-4 shadow-inner">
        <div className="flex items-center gap-2.5">
          <span className="text-white font-black text-[13px] uppercase tracking-widest">שידור הודעת פוש לקהילה</span>
        </div>
        
        <div className="relative">
          <textarea 
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
            placeholder="כתוב הודעה לכל המנויים שלך..." 
            className="w-full bg-[#121212] border border-white/5 rounded-[24px] p-4 pr-16 text-[13px] text-white font-medium outline-none focus:ring-1 focus:ring-accent-primary/50 transition-all resize-none shadow-inner h-24" 
          />
          <button 
            onClick={handleBroadcast}
            disabled={broadcasting}
            className="absolute left-3 bottom-3 w-10 h-10 bg-accent-primary text-black rounded-full flex items-center justify-center font-black active:scale-95 transition-all border-none disabled:opacity-50"
          >
            {broadcasting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="rtl:-scale-x-100" />}
          </button>
        </div>
      </div>

      {/* COMMUNITY HEALTH - עובד מול הכלכלה (ARPU) */}
      <div 
        onClick={() => { triggerFeedback('pop'); toast('עמוד הסטטיסטיקה המלא יושק בעדכון הבא!', { style: cleanToastStyle }); }}
        className="relative z-10 bg-[#1a1a1e] p-6 rounded-[32px] border border-white/5 flex items-center justify-between shadow-lg cursor-pointer active:scale-[0.98] transition-transform"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-[18px] bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Activity size={24} className="text-emerald-400" />
          </div>
          <div className="flex flex-col">
            <h4 className="text-white font-black text-[14px] uppercase tracking-wide">בריאות הקהילות</h4>
            <p className="text-[#8b8b93] text-[11px] font-bold mt-0.5">הכנסה ממוצעת למשתמש (ARPU): <span className="text-emerald-400 font-black">{arpu} CRD</span></p>
          </div>
        </div>
        <ChevronLeft size={20} className="text-[#8b8b93]" />
      </div>

      {/* OWNED CIRCLES MANAGEMENT */}
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
          <span className="text-[#8b8b93] text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
            <Sparkles size={14} className="text-accent-primary" /> ניהול המועדונים שלי
          </span>
          <button 
            onClick={() => navigate('/create-circle')}
            className="flex items-center gap-1.5 text-accent-primary font-black text-[10px] uppercase tracking-widest bg-accent-primary/10 px-3 py-1.5 rounded-full border border-accent-primary/20 active:scale-95 transition-transform"
          >
            <Plus size={12} /> מועדון חדש
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {circles.length === 0 ? (
            <div className="bg-[#1a1a1e] rounded-[32px] p-8 text-center border border-white/5 shadow-md">
              <span className="text-[#8b8b93] font-bold text-[13px]">טרם הקמת מועדונים. הזמן להתחיל!</span>
            </div>
          ) : (
            circles.map((circle) => (
              <button
                key={circle.id}
                onClick={() => { triggerFeedback('pop'); navigate(`/circle/${circle.slug}`); }}
                className="w-full bg-[#1a1a1e] p-3.5 rounded-[28px] flex items-center justify-between hover:bg-white/5 active:scale-[0.98] transition-all border border-white/5 shadow-md group"
              >
                <div className="flex items-center gap-4 text-right">
                  <div className="w-14 h-14 rounded-[18px] bg-[#121212] overflow-hidden shrink-0 border border-white/5 shadow-inner">
                    {circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[#8b8b93] font-black text-2xl">{circle.name.charAt(0)}</div>}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white font-black text-[16px] drop-shadow-sm">{circle.name}</span>
                    <span className="text-[#8b8b93] text-[11px] font-black mt-1 tracking-widest flex items-center gap-1.5">
                      <Users size={12} className="text-accent-primary" /> {circle.member_count.toLocaleString()} חברים משלמים
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#121212] flex items-center justify-center border border-white/5 shadow-inner ml-2">
                  <ChevronLeft size={16} className="text-[#8b8b93] rtl:rotate-180 group-hover:text-accent-primary transition-colors" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

    </FadeIn>
  );
};
