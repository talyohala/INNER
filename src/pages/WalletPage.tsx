import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, ArrowDownToLine, ArrowUpRight, ArrowDownLeft, 
  History, Loader2, ArrowLeft, Zap, CheckCircle2, Send, PlusCircle 
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
  
  // Modals state
  const [showCashout, setShowCashout] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  
  // Forms state
  const [amount, setAmount] = useState<number | ''>('');
  const [targetUsername, setTargetUsername] = useState('');
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
    const val = Number(amount);
    if (!val || val < MIN_CASHOUT) return toast.error(`מינימום משיכה: ${MIN_CASHOUT} CRD`);
    if (val > (profile?.crd_balance || 0)) return toast.error('אין מספיק יתרה');

    setProcessing(true);
    triggerFeedback('pop');
    const tid = toast.loading('מעבד משיכה...');

    try {
      const { error } = await supabase.rpc('request_cashout', { p_user_id: profile!.id, p_amount: val });
      if (error) throw error;

      if (reloadProfile) await reloadProfile();
      await fetchTransactions();
      
      triggerFeedback('success');
      toast.success('בקשת המשיכה נשלחה בהצלחה!', { id: tid });
      setShowCashout(false);
      setAmount('');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה', { id: tid });
    } finally {
      setProcessing(false);
    }
  };

  const handleTransfer = async () => {
    const val = Number(amount);
    if (!val || val <= 0) return toast.error('הכנס סכום תקין');
    if (!targetUsername.trim()) return toast.error('הכנס שם משתמש (Username)');
    if (val > (profile?.crd_balance || 0)) return toast.error('אין מספיק יתרה');

    setProcessing(true);
    triggerFeedback('pop');
    const tid = toast.loading('מעביר CRD...');

    try {
      const { error } = await supabase.rpc('transfer_crd', { 
        sender_id: profile!.id, 
        receiver_username: targetUsername.trim(), 
        p_amount: val 
      });
      if (error) throw error;

      if (reloadProfile) await reloadProfile();
      await fetchTransactions();
      
      triggerFeedback('success');
      toast.success('ההעברה בוצעה בהצלחה!', { id: tid });
      setShowTransfer(false);
      setAmount('');
      setTargetUsername('');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה', { id: tid });
    } finally {
      setProcessing(false);
    }
  };

  if (loading && transactions.length === 0) return <div className="min-h-screen bg-[#030303] flex items-center justify-center"><Loader2 className="animate-spin text-amber-400" size={32} /></div>;

  return (
    <FadeIn className="bg-[#030303] min-h-[100dvh] font-sans flex flex-col relative overflow-hidden pb-24" dir="rtl">
      
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

      <div className="flex flex-col px-4 gap-6 mt-2">
        
        {/* BALANCE CARD */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-gradient-to-br from-amber-500/10 to-surface-card border border-amber-500/30 rounded-[32px] p-8 shadow-lg relative overflow-hidden text-center flex flex-col items-center justify-center">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/20 blur-[40px] rounded-full pointer-events-none" />
          <span className="text-amber-400/80 text-[12px] font-black uppercase tracking-widest mb-2 relative z-10">יתרה זמינה</span>
          <span className="text-white text-6xl font-black tracking-tight flex items-center gap-3 relative z-10">
            {profile?.crd_balance?.toLocaleString() || 0} <Zap size={32} className="text-amber-400 fill-amber-400" />
          </span>
        </motion.div>

        {/* ACTIONS */}
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => { triggerFeedback('pop'); navigate('/store'); }} className="flex flex-col items-center justify-center gap-2 bg-surface-card border border-surface-border rounded-[24px] py-5 active:scale-95 transition-transform shadow-sm">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center"><PlusCircle size={20} /></div>
            <span className="text-brand font-black text-[12px] uppercase">קנה CRD</span>
          </button>
          
          <button onClick={() => { triggerFeedback('pop'); setShowTransfer(true); setAmount(''); }} className="flex flex-col items-center justify-center gap-2 bg-surface-card border border-surface-border rounded-[24px] py-5 active:scale-95 transition-transform shadow-sm">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center"><Send size={18} className="rtl:-scale-x-100" /></div>
            <span className="text-brand font-black text-[12px] uppercase">העבר למשתמש</span>
          </button>

          <button onClick={() => { triggerFeedback('pop'); setShowCashout(true); setAmount(''); }} className="flex flex-col items-center justify-center gap-2 bg-surface-card border border-surface-border rounded-[24px] py-5 active:scale-95 transition-transform shadow-sm">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center"><ArrowDownToLine size={20} /></div>
            <span className="text-brand font-black text-[12px] uppercase">משיכה</span>
          </button>
        </div>

        {/* TRANSACTIONS */}
        <div className="flex flex-col gap-3 mt-2">
          <h3 className="text-brand-muted text-[11px] font-black uppercase tracking-[0.2em] px-2 flex items-center gap-2"><History size={14} /> פעולות אחרונות</h3>
          <div className="bg-surface-card border border-surface-border rounded-[32px] overflow-hidden shadow-sm">
            {transactions.length === 0 ? (
              <div className="p-10 flex flex-col items-center text-center opacity-50">
                <History size={40} className="text-brand-muted mb-3" strokeWidth={1} />
                <span className="text-brand-muted font-bold text-[13px]">אין היסטוריה עדיין</span>
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
                        <span className="text-brand-muted text-[10px] font-bold mt-0.5" dir="ltr">{new Date(tx.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    <span className={`font-black text-[15px] ${isPositive ? 'text-emerald-400' : isPending ? 'text-amber-400' : 'text-rose-500'}`} dir="ltr">
                      {isPositive ? '+' : ''}{tx.amount}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* OVERLAYS */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {/* CASHOUT MODAL */}
          {showCashout && (
            <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowCashout(false)} />
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }} className="relative z-10 bg-surface rounded-t-[40px] p-6 pb-12 border-t border-surface-border flex flex-col">
                <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />
                <div className="flex flex-col items-center gap-2 mb-6">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center"><ArrowDownToLine size={24} /></div>
                  <h2 className="text-brand font-black text-xl uppercase">משיכת יתרה</h2>
                </div>
                <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} placeholder="סכום למשיכה" className="bg-surface-card text-brand font-black h-16 rounded-[24px] px-6 text-xl text-center border border-surface-border outline-none mb-2" dir="ltr" />
                <span className="text-brand-muted text-[11px] font-bold text-center mb-6">מינימום למשיכה: {MIN_CASHOUT} CRD</span>
                <Button onClick={handleCashout} disabled={processing || !amount} className="h-14 bg-emerald-500 text-black font-black text-[15px] rounded-full">שלח בקשה</Button>
              </motion.div>
            </div>
          )}

          {/* TRANSFER MODAL */}
          {showTransfer && (
            <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowTransfer(false)} />
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }} className="relative z-10 bg-surface rounded-t-[40px] p-6 pb-12 border-t border-surface-border flex flex-col">
                <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />
                <div className="flex flex-col items-center gap-2 mb-6">
                  <div className="w-14 h-14 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center"><Send size={24} className="rtl:-scale-x-100" /></div>
                  <h2 className="text-brand font-black text-xl uppercase">העברה לחבר</h2>
                </div>
                <div className="flex flex-col gap-3 mb-6">
                  <input type="text" value={targetUsername} onChange={(e) => setTargetUsername(e.target.value)} placeholder="שם משתמש (username@)" className="bg-surface-card text-brand font-black h-14 rounded-[20px] px-6 text-center border border-surface-border outline-none" dir="ltr" />
                  <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} placeholder="סכום (CRD)" className="bg-surface-card text-brand font-black h-14 rounded-[20px] px-6 text-center border border-surface-border outline-none" dir="ltr" />
                </div>
                <Button onClick={handleTransfer} disabled={processing || !amount || !targetUsername} className="h-14 bg-blue-500 text-white font-black text-[15px] rounded-full">העבר עכשיו</Button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>, document.body
      )}
    </FadeIn>
  );
};
