import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, ArrowDownToLine, ArrowUpRight, ArrowDownLeft, 
  History, Loader2, ArrowLeft, Zap, CheckCircle2 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

export const WalletPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, reloadProfile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showCashout, setShowCashout] = useState(false);
  const [cashoutAmount, setCashoutAmount] = useState<number | ''>('');
  const [processing, setProcessing] = useState(false);

  const MIN_CASHOUT = 500;

  useEffect(() => {
    if (profile?.id) fetchTransactions();
  }, [profile?.id]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      toast.error('שגיאה בטעינת היסטוריית ארנק');
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
      // קריאה מאובטחת לשרת שניזונה ישירות מהארנק ומורידה יתרה!
      const { error } = await supabase.rpc('request_cashout', {
        p_user_id: profile!.id,
        p_amount: amount
      });

      if (error) throw error;

      if (reloadProfile) await reloadProfile(); // מסנכרן את היתרה למעלה באפליקציה
      await fetchTransactions(); // מעדכן את ההיסטוריה
      
      triggerFeedback('success');
      toast.success('בקשת המשיכה נשלחה לאישור בהצלחה!', { id: tid });
      setShowCashout(false);
      setCashoutAmount('');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בביצוע משיכה', { id: tid });
    } finally {
      setProcessing(false);
    }
  };

  if (loading && transactions.length === 0) {
    return <div className="min-h-screen bg-[#030303] flex items-center justify-center"><Loader2 className="animate-spin text-amber-400" size={32} /></div>;
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
            הארנק שלי <Wallet size={20} className="text-amber-400" />
          </h1>
        </div>
        <div className="w-10" />
      </div>

      <div className="flex flex-col px-4 gap-4 mt-2">
        
        {/* BALANCE CARD */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-gradient-to-br from-amber-500/10 to-surface-card border border-amber-500/20 rounded-[32px] p-6 shadow-lg relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-amber-500/20 blur-[40px] rounded-full pointer-events-none" />
          
          <div className="flex justify-between items-start relative z-10">
            <div className="flex flex-col gap-1">
              <span className="text-amber-400/80 text-[11px] font-black uppercase tracking-widest">יתרה נוכחית (CRD)</span>
              <span className="text-white text-5xl font-black tracking-tight flex items-center gap-2">
                {profile?.crd_balance?.toLocaleString() || 0}
              </span>
            </div>
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <Zap size={24} className="text-amber-400 fill-amber-400" />
            </div>
          </div>

          <div className="mt-8 flex gap-3 relative z-10">
            <button onClick={() => { triggerFeedback('pop'); setShowCashout(true); }} className="flex-1 bg-amber-500 hover:bg-amber-400 text-black rounded-[20px] py-3.5 font-black text-[13px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md">
              <ArrowDownToLine size={18} /> משיכה
            </button>
            <button onClick={() => { triggerFeedback('pop'); navigate('/store'); }} className="flex-1 bg-surface border border-surface-border text-brand rounded-[20px] py-3.5 font-black text-[13px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2">
              <ArrowUpRight size={18} /> קנה CRD
            </button>
          </div>
        </motion.div>

        {/* TRANSACTIONS HISTORY */}
        <div className="flex flex-col gap-3 mt-4">
          <h3 className="text-brand-muted text-[11px] font-black uppercase tracking-[0.2em] px-2 flex items-center gap-2">
            <History size={14} /> היסטוריית פעולות
          </h3>
          <div className="bg-surface-card border border-surface-border rounded-[32px] overflow-hidden shadow-sm">
            {transactions.length === 0 ? (
              <div className="p-10 flex flex-col items-center text-center opacity-50">
                <History size={40} className="text-brand-muted mb-3" strokeWidth={1} />
                <span className="text-brand-muted font-bold text-[13px]">אין עסקאות עדיין</span>
              </div>
            ) : (
              transactions.map((tx, idx) => {
                const isPositive = tx.amount > 0;
                const isPending = tx.type.includes('pending');
                return (
                  <div key={tx.id} className={`flex items-center justify-between p-4 px-5 ${idx !== transactions.length - 1 ? 'border-b border-surface-border' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${isPositive ? 'bg-emerald-500/10 border-emerald-500/20' : isPending ? 'bg-amber-500/10 border-amber-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                        {isPositive ? <ArrowDownLeft size={16} className="text-emerald-400" /> : isPending ? <Loader2 size={16} className="text-amber-400 animate-spin" /> : <ArrowUpRight size={16} className="text-rose-500" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-brand font-black text-[14px]">{tx.description || tx.type}</span>
                        <span className="text-brand-muted text-[10px] font-bold tracking-widest mt-0.5" dir="ltr">
                          {new Date(tx.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <span className={`font-black text-[15px] tracking-widest ${isPositive ? 'text-emerald-400' : isPending ? 'text-amber-400' : 'text-rose-500'}`} dir="ltr">
                      {isPositive ? '+' : ''}{tx.amount}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* CASHOUT MODAL */}
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
                  <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-2">
                    <ArrowDownToLine size={28} className="text-amber-400" />
                  </div>
                  <h2 className="text-brand font-black text-xl tracking-widest uppercase">משיכת יתרה</h2>
                  <p className="text-brand-muted text-[13px] font-medium mt-1">בקש משיכה של ה-CRD לחשבון הבנק שלך.</p>
                </div>

                <div className="flex flex-col gap-2 relative z-0 mb-6">
                  <div className="flex justify-between items-center px-2 mb-1">
                    <label className="text-brand-muted text-[11px] font-black uppercase tracking-widest">סכום למשיכה</label>
                    <span className="text-amber-400 text-[10px] font-black uppercase tracking-widest">זמין: {profile?.crd_balance || 0} CRD</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-amber-400 font-black text-[13px] tracking-widest">CRD</span>
                    <input 
                      type="number" 
                      value={cashoutAmount} 
                      onChange={(e) => setCashoutAmount(Number(e.target.value))} 
                      placeholder="0" 
                      dir="ltr" 
                      className="bg-surface-card text-brand font-black h-[60px] border border-surface-border focus:border-amber-500/50 focus:outline-none transition-all rounded-[24px] px-16 text-2xl w-full shadow-inner text-left" 
                    />
                  </div>
                  <div className="flex items-center gap-2 px-2 mt-2">
                    <CheckCircle2 size={12} className={Number(cashoutAmount) >= MIN_CASHOUT ? 'text-emerald-400' : 'text-brand-muted'} />
                    <span className={`text-[10px] font-black tracking-widest uppercase ${Number(cashoutAmount) >= MIN_CASHOUT ? 'text-emerald-400' : 'text-brand-muted'}`}>מינימום למשיכה: {MIN_CASHOUT} CRD</span>
                  </div>
                </div>

                <Button onClick={handleCashout} disabled={processing || !cashoutAmount || Number(cashoutAmount) < MIN_CASHOUT} className="w-full h-16 bg-amber-500 hover:bg-amber-400 text-black font-black text-[15px] uppercase tracking-widest rounded-[24px] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
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
