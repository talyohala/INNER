import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, DollarSign, Users, ArrowDownToLine, 
  Activity, Loader2, Zap, ArrowLeft, Wallet, CheckCircle2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

export const StudioPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, reloadProfile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [revenueStats, setRevenueStats] = useState({ total: 0, thisMonth: 0, pending: 0 });
  const [recentEarnings, setRecentEarnings] = useState<any[]>([]);
  const [showCashout, setShowCashout] = useState(false);
  const [cashoutAmount, setCashoutAmount] = useState<number | ''>('');
  const [processing, setProcessing] = useState(false);

  const MIN_CASHOUT = 500; // מינימום משיכה ב-CRD

  useEffect(() => {
    if (profile?.id) fetchStudioData();
  }, [profile?.id]);

  const fetchStudioData = async () => {
    setLoading(true);
    try {
      // שליפת עסקאות של הכנסות בלבד (סיגנלים, כספות, העברות נכנסות)
      const { data: txs, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', profile!.id)
        .gt('amount', 0)
        .in('type', ['signal_revenue', 'vault_sale', 'transfer', 'drop_revenue'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const earnings = txs || [];
      
      // חישובים סטטיסטיים
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      let total = 0;
      let thisMonth = 0;

      earnings.forEach(tx => {
        total += tx.amount;
        if (new Date(tx.created_at) >= firstDayOfMonth) {
          thisMonth += tx.amount;
        }
      });

      setRevenueStats({ total, thisMonth, pending: profile?.crd_balance || 0 });
      setRecentEarnings(earnings.slice(0, 10)); // 10 האחרונים
    } catch (err) {
      console.error('Error fetching studio data', err);
      toast.error('שגיאה בטעינת נתוני סטודיו');
    } finally {
      setLoading(false);
    }
  };

  const handleCashout = async () => {
    const amount = Number(cashoutAmount);
    if (!amount || amount < MIN_CASHOUT) return toast.error(`מינימום משיכה הוא ${MIN_CASHOUT} CRD`);
    if (amount > (profile?.crd_balance || 0)) return toast.error('אין לך מספיק יתרה זמינה');

    setProcessing(true);
    triggerFeedback('pop');
    const tid = toast.loading('מעבד בקשת משיכה...');

    try {
      // ניכוי היתרה ושמירת בקשת משיכה (withdrawal)
      const newBalance = (profile!.crd_balance || 0) - amount;
      await supabase.from('profiles').update({ crd_balance: newBalance }).eq('id', profile!.id);
      
      await supabase.from('transactions').insert({
        user_id: profile!.id,
        amount: -amount,
        type: 'withdrawal_pending',
        description: 'בקשת משיכה לחשבון הבנק (ממתין לאישור)'
      });

      if (reloadProfile) reloadProfile();
      await fetchStudioData();
      
      triggerFeedback('success');
      toast.success('בקשת המשיכה נשלחה בהצלחה!', { id: tid });
      setShowCashout(false);
      setCashoutAmount('');
    } catch (err) {
      toast.error('שגיאה בביצוע משיכה', { id: tid });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" size={32} /></div>;
  }

  return (
    <FadeIn className="bg-[#030303] min-h-[100dvh] font-sans flex flex-col relative overflow-hidden pb-24" dir="rtl">
      
      {/* HEADER */}
      <div className="relative z-50 pt-[calc(env(safe-area-inset-top)+16px)] px-6 flex items-center justify-between pb-4">
        <button onClick={() => { triggerFeedback('pop'); navigate(-1); }} className="w-10 h-10 bg-surface-card border border-surface-border rounded-full flex items-center justify-center text-brand active:scale-95 transition-all">
          <ArrowLeft size={20} className="rtl:-scale-x-100" />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-xl font-black text-white tracking-widest uppercase flex items-center gap-2">
            סטודיו יוצרים <TrendingUp size={20} className="text-emerald-400" />
          </h1>
        </div>
        <div className="w-10" />
      </div>

      {/* MAIN DASHBOARD */}
      <div className="flex flex-col px-4 gap-4 mt-2">
        
        {/* TOTAL EARNINGS CARD */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-gradient-to-br from-emerald-500/10 to-surface-card border border-emerald-500/20 rounded-[32px] p-6 shadow-lg relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-emerald-500/20 blur-[40px] rounded-full pointer-events-none" />
          
          <div className="flex justify-between items-start relative z-10">
            <div className="flex flex-col gap-1">
              <span className="text-emerald-400/80 text-[11px] font-black uppercase tracking-widest">סך הכל הכנסות</span>
              <span className="text-white text-4xl font-black tracking-tight flex items-center gap-2">
                {revenueStats.total.toLocaleString()} <Zap size={24} className="text-amber-400 fill-amber-400" />
              </span>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <DollarSign size={24} className="text-emerald-400" />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between bg-black/40 p-3 px-4 rounded-2xl border border-white/5 relative z-10">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-brand-muted" />
              <span className="text-brand text-[13px] font-bold">הכנסות החודש</span>
            </div>
            <span className="text-emerald-400 font-black text-[15px]">+{revenueStats.thisMonth.toLocaleString()} CRD</span>
          </div>
        </motion.div>

        {/* CASHOUT SECTION */}
        <div className="flex gap-3">
          <div className="flex-1 bg-surface-card border border-surface-border rounded-[28px] p-5 shadow-sm flex flex-col justify-center">
            <span className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">יתרה זמינה למשיכה</span>
            <span className="text-brand font-black text-2xl flex items-center gap-1.5">{revenueStats.pending.toLocaleString()} <Zap size={16} className="text-amber-400" /></span>
          </div>
          <button onClick={() => { triggerFeedback('pop'); setShowCashout(true); }} className="flex-1 bg-white hover:bg-gray-100 text-black rounded-[28px] p-5 shadow-lg active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-2 group">
            <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowDownToLine size={20} className="text-black" />
            </div>
            <span className="font-black text-[13px] uppercase tracking-widest">משיכת כספים</span>
          </button>
        </div>

        {/* RECENT ACTIVITY */}
        <div className="flex flex-col gap-3 mt-4">
          <h3 className="text-brand-muted text-[11px] font-black uppercase tracking-[0.2em] px-2">פעילות הכנסות אחרונה</h3>
          <div className="bg-surface-card border border-surface-border rounded-[32px] overflow-hidden shadow-sm">
            {recentEarnings.length === 0 ? (
              <div className="p-10 flex flex-col items-center text-center opacity-50">
                <Wallet size={40} className="text-brand-muted mb-3" strokeWidth={1} />
                <span className="text-brand-muted font-bold text-[13px]">אין הכנסות עדיין</span>
                <span className="text-brand-muted/70 text-[11px] mt-1">התחל לקבל סיגנלים כדי להרוויח!</span>
              </div>
            ) : (
              recentEarnings.map((tx, idx) => (
                <div key={tx.id} className={`flex items-center justify-between p-4 px-5 ${idx !== recentEarnings.length - 1 ? 'border-b border-surface-border' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <TrendingUp size={16} className="text-emerald-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-brand font-black text-[14px]">{tx.description || 'הכנסה'}</span>
                      <span className="text-brand-muted text-[10px] font-bold tracking-widest mt-0.5" dir="ltr">
                        {new Date(tx.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                    <span className="text-emerald-400 font-black text-[14px] tracking-widest" dir="ltr">+{tx.amount}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* CASHOUT BOTTOM SHEET */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showCashout && (
            <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowCashout(false)} />
              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 400 }}
                className="relative z-10 bg-surface rounded-t-[40px] p-6 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border flex flex-col"
              >
                <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />
                
                <div className="flex flex-col items-center text-center gap-2 mb-8">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2">
                    <ArrowDownToLine size={28} className="text-emerald-400" />
                  </div>
                  <h2 className="text-brand font-black text-xl tracking-widest uppercase">משיכת כספים (Cashout)</h2>
                  <p className="text-brand-muted text-[13px] font-medium mt-1">המר את ה-CRD שלך לכסף אמיתי שיועבר לחשבון הבנק שלך.</p>
                </div>

                <div className="flex flex-col gap-2 relative z-0 mb-6">
                  <div className="flex justify-between items-center px-2 mb-1">
                    <label className="text-brand-muted text-[11px] font-black uppercase tracking-widest">סכום למשיכה</label>
                    <span className="text-accent-primary text-[10px] font-black uppercase tracking-widest">זמין: {revenueStats.pending} CRD</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-400 font-black text-[13px] tracking-widest">CRD</span>
                    <input 
                      type="number" 
                      value={cashoutAmount} 
                      onChange={(e) => setCashoutAmount(Number(e.target.value))} 
                      placeholder="0" 
                      dir="ltr" 
                      className="bg-surface-card text-brand font-black h-[60px] border border-surface-border focus:border-emerald-500/50 focus:outline-none transition-all rounded-[24px] px-16 text-2xl w-full shadow-inner text-left" 
                    />
                  </div>
                  <div className="flex items-center gap-2 px-2 mt-2">
                    <CheckCircle2 size={12} className={Number(cashoutAmount) >= MIN_CASHOUT ? 'text-emerald-400' : 'text-brand-muted'} />
                    <span className={`text-[10px] font-black tracking-widest uppercase ${Number(cashoutAmount) >= MIN_CASHOUT ? 'text-emerald-400' : 'text-brand-muted'}`}>מינימום למשיכה: {MIN_CASHOUT} CRD</span>
                  </div>
                </div>

                <Button onClick={handleCashout} disabled={processing || !cashoutAmount || Number(cashoutAmount) < MIN_CASHOUT} className="w-full h-16 bg-white hover:bg-gray-100 text-black font-black text-[15px] uppercase tracking-widest rounded-[24px] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {processing ? <Loader2 size={24} className="animate-spin text-black" /> : 'שלח בקשת משיכה'}
                </Button>

              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </FadeIn>
  );
};
