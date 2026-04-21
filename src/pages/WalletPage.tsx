import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
  Loader2, UserCircle, CheckCircle2, ArrowUpRight, ArrowDownLeft,
  CreditCard, Send, Download, Search, Zap, History, Gift, Flame
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

type WalletTx = {
  id: string | number;
  type: string;
  amount: number;
  description?: string;
  created_at: string;
  user_id?: string;
};

type SearchUser = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type CreditPackage = {
  amount: number;
  price: number;
  id: string;
  discount?: number;
  popular?: boolean;
};

const cleanToastStyle = {
  background: 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(16px)',
  color: '#0f172a',
  border: '1px solid rgba(0, 0, 0, 0.05)',
  borderRadius: '100px',
  fontSize: '14px',
  fontWeight: 700,
  padding: '12px 24px',
  boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
};

const BottomSheet: React.FC<{ open: boolean; onClose: () => void; children: React.ReactNode; heightClass?: string }> = ({ open, onClose, children, heightClass = 'h-[85vh]' }) => {
  const dragControls = useDragControls();
  const startSheetDrag = (e: React.PointerEvent<HTMLElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const interactive = target.closest('input, textarea, button, a, select, option, label, [contenteditable="true"], [data-no-drag="true"]');
    if (interactive) return;
    dragControls.start(e);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9900] flex flex-col justify-end" dir="rtl">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            drag="y" dragControls={dragControls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.1}
            onDragEnd={(_, info) => { if (info.offset.y > 100 || info.velocity.y > 400) onClose(); }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 500 }}
            className={`bg-surface rounded-t-[40px] ${heightClass} flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.15)] relative overflow-hidden border-t border-surface-border`}
          >
            <div className="w-full py-4 flex justify-center shrink-0 cursor-grab active:cursor-grabbing border-b border-surface-border/50" onPointerDown={startSheetDrag} style={{ touchAction: 'none' }}>
              <div className="w-12 h-1.5 bg-surface-border rounded-full pointer-events-none" />
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 pt-4" onPointerDown={startSheetDrag} style={{ touchAction: 'pan-y' }}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const WalletPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, reloadProfile } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [balance, setBalance] = useState(() => Number(localStorage.getItem('inner_wallet_balance') || profile?.crd_balance || 0));
  const [transactions, setTransactions] = useState<WalletTx[]>(() => {
    try { return JSON.parse(localStorage.getItem('inner_wallet_tx') || '[]'); } catch { return []; }
  });
  const [loading, setLoading] = useState(transactions.length === 0);

  const [adding, setAdding] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [showAllTx, setShowAllTx] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const [transferUsername, setTransferUsername] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<SearchUser | null>(null);
  const [transferAmount, setTransferAmount] = useState<number | string>('');
  const [transferResults, setTransferResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState<number | string>('');

  useEffect(() => {
    setMounted(true);
    fetchWallet();
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase.channel(`public:profiles:eq.${profile.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profile.id}` }, (payload) => {
        const newBal = payload.new.crd_balance;
        if (newBal !== balance) {
          if (newBal > balance) {
            triggerFeedback('coin');
            toast('קיבלת העברה חדשה!', { icon: '💎', style: cleanToastStyle });
          }
          setBalance(newBal);
          fetchWallet();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, balance]);

  const fetchWallet = async () => {
    if (!profile?.id) return;
    setCurrentUserId(profile.id);
    try {
      const { data: tx } = await supabase.from('transactions').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(25);
      if (tx) {
        setTransactions(tx);
        localStorage.setItem('inner_wallet_tx', JSON.stringify(tx));
      }
      setBalance(profile.crd_balance || 0);
      localStorage.setItem('inner_wallet_balance', String(profile.crd_balance || 0));
    } catch {
      toast('שגיאה בטעינת הארנק', { style: cleanToastStyle });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const searchUsers = async () => {
      const query = transferUsername.replace('@', '').trim();
      if (!showUserDropdown || query.length < 1 || selectedRecipient) {
        setTransferResults([]); setIsSearching(false); return;
      }
      setIsSearching(true);
      try {
        const { data, error } = await supabase.from('profiles').select('id, full_name, username, avatar_url').or(`username.ilike.%${query}%,full_name.ilike.%${query}%`).limit(10);
        if (error) throw error;
        const safeData = Array.isArray(data) ? data : [];
        setTransferResults(safeData.filter((u) => u.id !== currentUserId));
      } catch { setTransferResults([]); } finally { setIsSearching(false); }
    };
    const timeoutId = setTimeout(searchUsers, 250);
    return () => clearTimeout(timeoutId);
  }, [transferUsername, showUserDropdown, currentUserId, selectedRecipient]);

  const openPaymentSheet = (pkg: CreditPackage) => { triggerFeedback('pop'); setSelectedPackage(pkg); };
  const closePaymentSheet = () => { triggerFeedback('pop'); setSelectedPackage(null); };

  const processNativePayment = async () => {
    if (!selectedPackage || !profile?.id) return;
    setAdding(true); triggerFeedback('pop'); const tid = toast('מעבד תשלום מאובטח...', { style: cleanToastStyle });
    setTimeout(async () => {
      try {
        const newBalance = (profile.crd_balance || 0) + selectedPackage.amount;
        const { error } = await supabase.from('profiles').update({ crd_balance: newBalance }).eq('id', profile.id);
        if (error) throw error;
        await supabase.from('transactions').insert({ user_id: profile.id, amount: selectedPackage.amount, type: 'deposit', description: `טעינת ${selectedPackage.amount} קרדיטים` });
        if (reloadProfile) reloadProfile();
        setBalance(newBalance); await fetchWallet(); triggerFeedback('coin');
        toast(`רכשת ${selectedPackage.amount} קרדיטים בהצלחה`, { id: tid, style: cleanToastStyle }); setSelectedPackage(null);
      } catch { triggerFeedback('error'); toast('התשלום נכשל', { id: tid, style: cleanToastStyle }); } finally { setAdding(false); }
    }, 1400);
  };

  const handleTransfer = async () => {
    const amt = Number(transferAmount);
    if (!selectedRecipient || amt <= 0 || isNaN(amt)) return toast('בדוק סכום או נמען', { style: cleanToastStyle });
    if (amt > balance) return toast('אין לך מספיק יתרה בארנק', { style: cleanToastStyle });

    setTransferring(true); triggerFeedback('pop'); const tid = toast(`מעביר ${amt} קרדיטים...`, { style: cleanToastStyle });
    try {
      const { data: newBalance, error } = await supabase.rpc('transfer_credits', { receiver_id: selectedRecipient.id, transfer_amount: amt });
      if (error) throw new Error(error.message);
      if (reloadProfile) reloadProfile();
      setBalance(Number(newBalance)); await fetchWallet(); triggerFeedback('success');
      toast('ההעברה בוצעה בהצלחה', { id: tid, style: cleanToastStyle });
      setShowTransfer(false); setTransferAmount(''); setSelectedRecipient(null); setTransferUsername('');
    } catch (e: any) { triggerFeedback('error'); toast(e.message || 'העברה נכשלה', { id: tid, style: cleanToastStyle }); } finally { setTransferring(false); }
  };

  const handleRedeem = async () => {
    const amt = Number(redeemAmount);
    if (isNaN(amt) || amt <= 0) return toast('אנא הזן סכום תקין', { style: cleanToastStyle });
    if (amt > balance) return toast('אין לך מספיק יתרה למשיכה', { style: cleanToastStyle });
    if (amt < 100) return toast('מינימום למשיכה הוא 100 קרדיטים', { style: cleanToastStyle });

    setRedeeming(true); triggerFeedback('pop'); const tid = toast('שולח בקשת משיכה...', { style: cleanToastStyle });
    try {
      const { error } = await supabase.rpc('request_cashout', { p_user_id: profile!.id, p_amount: amt });
      if (error) throw error;
      const newBal = balance - amt; setBalance(newBal);
      if (reloadProfile) await reloadProfile(); await fetchWallet();
      triggerFeedback('success'); toast('בקשת המשיכה נשלחה לאישור', { id: tid, style: cleanToastStyle });
      setShowRedeem(false); setRedeemAmount('');
    } catch (err: any) { toast(err.message || 'שגיאה במשיכה', { id: tid, style: cleanToastStyle }); } finally { setRedeeming(false); }
  };

  const PACKAGES: CreditPackage[] = [
    { id: 'crd_100', amount: 100, price: 15, popular: false, discount: 0 },
    { id: 'crd_500', amount: 500, price: 59, popular: true, discount: 21 },
    { id: 'crd_1500', amount: 1500, price: 149, popular: false, discount: 33 },
  ];

  const visibleTransactions = useMemo(() => transactions.slice(0, 4), [transactions]);

  if (loading && transactions.length === 0 && balance === 0) return ( <div className="min-h-screen bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" size={32} /></div> );

  return (
    <>
      <FadeIn className="px-5 pt-8 pb-32 bg-surface min-h-[100dvh] font-sans relative overflow-hidden" dir="rtl">
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-accent-primary/5 rounded-full blur-[100px]" />
        </div>

        <div className="flex flex-col gap-8 relative z-10">
          
          {/* Balance Card */}
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-surface-card rounded-[40px] p-8 pb-6 flex flex-col items-center shadow-sm overflow-hidden border border-surface-border">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent-primary/10 blur-[80px] rounded-full pointer-events-none" />
            <span className="text-brand-muted text-[12px] font-black uppercase tracking-[0.3em] mb-2 relative z-10">יתרה זמינה</span>
            <div className="flex items-center gap-2 relative z-10">
              <span className="text-7xl font-black text-brand tracking-tighter drop-shadow-sm">{balance.toLocaleString()}</span>
            </div>
            <span className="text-accent-primary text-[11px] font-black uppercase tracking-[0.3em] mt-3 opacity-90 relative z-10">קרדיטים פנימיים</span>
            
            <div className="flex gap-4 w-full mt-10 relative z-10">
              {/* כפתורים שקופים לחלוטין ללא מסגרות ורקעים - נטו טקסט ואייקון מרחפים */}
              <button onClick={() => { triggerFeedback('pop'); setShowTransfer(true); }} className="flex-1 bg-transparent h-14 flex items-center justify-center gap-2.5 transition-colors active:scale-95 group border-none">
                <Send size={22} className="text-brand-muted group-hover:text-accent-primary transition-colors rtl:-scale-x-100" />
                <span className="text-brand font-black text-[15px] uppercase tracking-widest group-hover:text-accent-primary transition-colors">העברה</span>
              </button>
              <button onClick={() => { triggerFeedback('pop'); setShowRedeem(true); }} className="flex-1 bg-transparent h-14 flex items-center justify-center gap-2.5 transition-colors active:scale-95 group border-none">
                <Download size={22} className="text-brand-muted group-hover:text-brand transition-colors" />
                <span className="text-brand font-black text-[15px] uppercase tracking-widest transition-colors">משיכה</span>
              </button>
            </div>
          </motion.div>

          {/* Quick Packs (עיגולים מושלמים, ללא מסגרת, אחוזים נטו) */}
          <div className="flex flex-col gap-4">
            <h3 className="text-brand-muted text-[12px] font-black uppercase tracking-[0.2em] px-2 flex items-center gap-2"><Gift size={16}/> טעינה מהירה</h3>
            <div className="grid grid-cols-3 gap-4 px-2">
              {PACKAGES.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => openPaymentSheet(pkg)}
                  className={`relative aspect-square rounded-full flex flex-col items-center justify-center active:scale-95 transition-all group overflow-visible shadow-sm border-none ${pkg.popular ? 'bg-accent-primary/10' : 'bg-surface-card hover:bg-surface-border/40'}`}
                >
                  {pkg.popular && (
                    <motion.div 
                      animate={{ y: [0, -6, 0] }} 
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="absolute -top-2 right-1 z-20 pointer-events-none"
                    >
                      <Flame size={22} className="text-orange-500 drop-shadow-sm" fill="currentColor" />
                    </motion.div>
                  )}
                  
                  <div className="flex flex-col items-center justify-center relative z-10 gap-0.5">
                    <span className="text-[28px] font-black text-brand tracking-tighter drop-shadow-sm">{pkg.amount}</span>
                    <span className="text-[13px] font-bold text-brand-muted">₪{pkg.price}</span>
                    {pkg.discount && pkg.discount > 0 && (
                      <span className="text-[11px] font-black uppercase tracking-widest text-emerald-500 mt-1">{pkg.discount}% הנחה</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* History - מרחף לגמרי, נטו טקסט ואייקונים בלי קופסאות */}
          <div className="flex flex-col gap-4 mt-4">
            <h3 className="text-brand-muted text-[12px] font-black uppercase tracking-[0.2em] px-2 flex items-center gap-2">
              <History size={16} /> פעולות אחרונות
            </h3>
            <div className="flex flex-col gap-2">
              {transactions.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center text-brand-muted gap-3">
                  <CreditCard size={36} />
                  <span className="text-[13px] font-bold uppercase tracking-widest opacity-70">הארנק שלך ריק</span>
                </div>
              ) : (
                <>
                  {visibleTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-2">
                      <div className="flex items-center gap-4 text-right">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-inner border-none ${tx.amount > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                          {tx.amount > 0 ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-brand font-black text-[15px] drop-shadow-sm">{tx.description || 'פעולה בחשבון'}</span>
                          <span className="text-brand-muted text-[11px] font-bold mt-0.5 tracking-widest" dir="ltr">{new Date(tx.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      <span className={`font-black text-[16px] tracking-widest ${tx.amount > 0 ? 'text-emerald-500' : 'text-rose-500'}`} dir="ltr">
                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                      </span>
                    </div>
                  ))}
                  {transactions.length > 4 && (
                    <button onClick={() => { triggerFeedback('pop'); setShowAllTx(true); }} className="w-full mt-2 p-3 hover:bg-surface-border/20 rounded-full transition-colors text-brand-muted text-[12px] font-black uppercase tracking-widest">
                      הצג הכל
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </FadeIn>

      {/* PORTALS FOR BOTTOM SHEETS */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <>
          {/* All Transactions Sheet */}
          <BottomSheet open={showAllTx} onClose={() => setShowAllTx(false)}>
            <div className="flex flex-col gap-4 pb-10">
              <h2 className="text-brand font-black text-xl tracking-widest uppercase text-center mb-4">כל הפעולות</h2>
              <div className="flex flex-col gap-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-4 text-right">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-inner border-none ${tx.amount > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                        {tx.amount > 0 ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-brand font-black text-[15px] drop-shadow-sm">{tx.description || 'פעולה'}</span>
                        <span className="text-brand-muted text-[11px] font-bold mt-0.5 tracking-widest" dir="ltr">{new Date(tx.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    <span className={`font-black text-[16px] tracking-widest ${tx.amount > 0 ? 'text-emerald-500' : 'text-rose-500'}`} dir="ltr">
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </BottomSheet>

          {/* Payment Sheet */}
          <BottomSheet open={!!selectedPackage} onClose={closePaymentSheet} heightClass="h-auto min-h-[30vh] max-h-[85vh]">
            {selectedPackage && (
              <div className="flex flex-col gap-6 items-center text-center pb-10">
                <div>
                  <h2 className="text-brand font-black text-2xl tracking-widest uppercase">אישור טעינה</h2>
                  <p className="text-brand-muted text-[14px] font-medium mt-1">הוספת <span className="font-black text-brand">{selectedPackage.amount} קרדיטים</span> לארנק שלך</p>
                </div>
                <div className="w-full bg-surface-card rounded-[32px] p-6 flex flex-col gap-5 shadow-sm border-none">
                  <div className="flex justify-between items-center">
                    <span className="text-brand-muted text-[12px] font-black uppercase tracking-widest">כמות קרדיטים</span>
                    <span className="text-brand font-black text-[18px]">{selectedPackage.amount}</span>
                  </div>
                  {selectedPackage.discount && selectedPackage.discount > 0 ? (
                    <div className="flex justify-between items-center">
                      <span className="text-brand-muted text-[12px] font-black uppercase tracking-widest">הטבה</span>
                      <span className="text-emerald-500 font-black text-[14px]">{selectedPackage.discount}% חיסכון</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-brand-muted text-[12px] font-black uppercase tracking-widest">סה"כ לתשלום</span>
                    <span className="text-accent-primary font-black text-3xl">₪{selectedPackage.price}</span>
                  </div>
                </div>
                <Button onClick={processNativePayment} disabled={adding} className="w-full h-16 bg-accent-primary text-white font-black text-[16px] uppercase tracking-widest rounded-3xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md disabled:opacity-50 border-none">
                  {adding ? <Loader2 size={24} className="animate-spin text-white" /> : 'אישור תשלום'}
                </Button>
              </div>
            )}
          </BottomSheet>

          {/* Transfer Sheet (ללא קווים) */}
          <BottomSheet open={showTransfer} onClose={() => setShowTransfer(false)}>
            <div className="flex flex-col gap-6 pb-10">
              <div className="text-center">
                <h2 className="text-brand font-black text-2xl tracking-widest uppercase">העברת קרדיטים</h2>
                <p className="text-brand-muted text-[13px] font-medium mt-1">העבר לחברים או יוצרים בקלות</p>
              </div>
              
              <div className="relative" data-no-drag="true">
                <input
                  type="text" value={transferUsername}
                  onChange={async (e: any) => {
                    const v = e.target.value; setTransferUsername(v); setSelectedRecipient(null);
                    if (v.length > 1) {
                      setIsSearching(true);
                      const { data } = await supabase.from('profiles').select('id, full_name, username, avatar_url').or(`username.ilike.%${v}%,full_name.ilike.%${v}%`).limit(5);
                      setTransferResults(data || []); setIsSearching(false);
                    } else { setTransferResults([]); }
                  }}
                  onFocus={() => setShowUserDropdown(true)}
                  placeholder="חפש שם או @יוזר..." dir="rtl"
                  className="w-full h-16 bg-surface-card border-none rounded-[20px] pl-12 pr-5 text-brand outline-none focus:bg-surface-border/30 transition-all font-medium shadow-sm"
                />
                <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-muted" />
                
                <AnimatePresence>
                  {isSearching && (
                    <div className="absolute left-14 top-1/2 -translate-y-1/2 flex items-center"><Loader2 size={18} className="animate-spin text-accent-primary" /></div>
                  )}
                  {transferUsername.trim() !== '' && !selectedRecipient && !isSearching && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute w-full mt-2 bg-surface-card rounded-[24px] shadow-2xl overflow-hidden z-50 flex flex-col gap-1 p-2" data-no-drag="true">
                      {transferResults.length === 0 ? (
                        <div className="p-6 text-center text-brand-muted text-[13px] font-bold">לא נמצא משתמש כזה</div>
                      ) : (
                        transferResults.map((u, i) => (
                          <div key={u.id} onClick={() => { triggerFeedback('pop'); setSelectedRecipient(u); setTransferUsername(u.username || ''); setShowUserDropdown(false); }} className={`flex items-center gap-3 p-3 bg-surface rounded-[16px] hover:bg-surface-border/40 cursor-pointer transition-colors w-full`}>
                            <div className="w-12 h-12 rounded-full bg-surface-card overflow-hidden shrink-0 border-none flex items-center justify-center">
                              {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={24} className="text-brand-muted" />}
                            </div>
                            <div className="flex flex-col text-right">
                              <span className="text-brand text-[15px] font-black">{u.full_name || 'משתמש'}</span>
                              {u.username && <span className="text-brand-muted text-[12px] font-bold tracking-widest" dir="ltr">@{u.username}</span>}
                            </div>
                          </div>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {selectedRecipient && (
                <div className="bg-accent-primary/10 border-none rounded-[20px] p-3 px-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-card border-none flex items-center justify-center">
                      {selectedRecipient.avatar_url ? <img src={selectedRecipient.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={24} className="text-brand-muted" />}
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-brand text-[15px] font-black flex items-center gap-1.5">{selectedRecipient.full_name || 'משתמש'}<CheckCircle2 size={16} className="text-accent-primary" /></span>
                      {selectedRecipient.username && <span className="text-brand-muted text-[12px] font-bold tracking-widest" dir="ltr">@{selectedRecipient.username}</span>}
                    </div>
                  </div>
                  <button onClick={() => { setSelectedRecipient(null); setTransferUsername(''); setTransferResults([]); }} className="text-brand-muted hover:text-brand transition-colors text-[12px] font-black bg-surface px-4 py-2 rounded-full border-none">שנה</button>
                </div>
              )}

              <div className="relative mt-2" data-no-drag="true">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-accent-primary font-black text-[16px] tracking-widest">קרדיטים</span>
                <input
                  type="number" value={transferAmount} onChange={(e: any) => setTransferAmount(e.target.value)}
                  placeholder="סכום..." dir="ltr"
                  className="w-full h-16 bg-surface-card border-none rounded-[20px] px-24 text-brand font-black text-2xl outline-none focus:bg-surface-border/30 transition-all text-left placeholder:text-brand-muted shadow-sm"
                />
              </div>
              <Button onClick={handleTransfer} disabled={transferring || !transferAmount || !selectedRecipient} className="h-16 bg-accent-primary text-white font-black text-[16px] uppercase tracking-widest rounded-[20px] mt-4 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 border-none shadow-md">
                {transferring ? <Loader2 size={24} className="animate-spin text-white" /> : 'אישור העברה'}
              </Button>
            </div>
          </BottomSheet>

          {/* Redeem Sheet */}
          <BottomSheet open={showRedeem} onClose={() => setShowRedeem(false)} heightClass="h-auto">
            <div className="flex flex-col gap-6 items-center text-center pb-10">
              <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mb-2">
                <Download size={32} className="text-rose-500" />
              </div>
              <div>
                <h2 className="text-brand font-black text-2xl uppercase tracking-widest mb-1">משיכת מזומן</h2>
                <p className="text-brand-muted text-[14px] font-medium leading-relaxed px-4">משוך את הקרדיטים לחשבון הבנק.<br/><span className="text-rose-500 font-bold text-[12px] uppercase tracking-widest">מינימום: 100 קרדיטים</span></p>
              </div>
              <div className="relative w-full mt-2" data-no-drag="true">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-rose-500 font-black text-[16px] tracking-widest">קרדיטים</span>
                <input
                  type="number" value={redeemAmount} onChange={(e: any) => setRedeemAmount(e.target.value)}
                  placeholder="0" dir="ltr"
                  className="w-full h-16 bg-surface-card border-none rounded-[20px] px-24 text-brand font-black text-2xl outline-none focus:bg-surface-border/30 transition-all text-left placeholder:text-brand-muted shadow-sm"
                />
              </div>
              <Button onClick={handleRedeem} disabled={redeeming || !redeemAmount} className="w-full h-16 mt-2 bg-rose-500 hover:bg-rose-600 text-white font-black text-[16px] uppercase tracking-widest rounded-[20px] active:scale-95 disabled:opacity-50 border-none shadow-md">
                {redeeming ? <Loader2 size={24} className="animate-spin text-white" /> : 'בקש משיכה'}
              </Button>
            </div>
          </BottomSheet>
        </>,
        document.getElementById('root') || document.body
      )}
    </>
  );
};
