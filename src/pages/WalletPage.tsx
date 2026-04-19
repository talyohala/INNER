import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
  Loader2, UserCircle, CheckCircle2, ArrowUpRight, ArrowDownLeft,
  CreditCard, Send, Download, Search, Zap, History, X, Gift
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
          <motion.div
            drag="y" dragControls={dragControls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.1}
            onDragEnd={(_, info) => { if (info.offset.y > 100 || info.velocity.y > 400) onClose(); }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 500 }}
            className={`bg-surface rounded-t-[40px] ${heightClass} flex flex-col shadow-2xl relative overflow-hidden border-t border-white/10`}
          >
            <div className="w-full py-4 flex justify-center shrink-0 cursor-grab active:cursor-grabbing border-b border-surface-border" onPointerDown={startSheetDrag} style={{ touchAction: 'none' }}>
              <div className="w-12 h-1 bg-white/20 rounded-full pointer-events-none" />
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6" onPointerDown={startSheetDrag} style={{ touchAction: 'pan-y' }}>
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
            toast.success('קיבלת העברה חדשה!', { icon: '💎' });
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
      toast.error('שגיאה בטעינת הארנק');
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
    setAdding(true); triggerFeedback('pop'); const tid = toast.loading('מעבד תשלום מאובטח...');
    setTimeout(async () => {
      try {
        const newBalance = (profile.crd_balance || 0) + selectedPackage.amount;
        const { error } = await supabase.from('profiles').update({ crd_balance: newBalance }).eq('id', profile.id);
        if (error) throw error;
        await supabase.from('transactions').insert({ user_id: profile.id, amount: selectedPackage.amount, type: 'deposit', description: `טעינת ${selectedPackage.amount} CRD באשראי` });
        if (reloadProfile) reloadProfile();
        setBalance(newBalance); await fetchWallet(); triggerFeedback('coin');
        toast.success(`רכשת ${selectedPackage.amount} CRD בהצלחה`, { id: tid }); setSelectedPackage(null);
      } catch { triggerFeedback('error'); toast.error('התשלום נכשל', { id: tid }); } finally { setAdding(false); }
    }, 1400);
  };

  const handleTransfer = async () => {
    const amt = Number(transferAmount);
    if (!selectedRecipient || amt <= 0 || isNaN(amt)) return toast.error('בדוק סכום או נמען');
    if (amt > balance) return toast.error('אין לך מספיק יתרה בארנק');
    
    setTransferring(true); triggerFeedback('pop'); const tid = toast.loading(`מעביר ${amt} CRD...`);
    try {
      const { data: newBalance, error } = await supabase.rpc('transfer_credits', { receiver_id: selectedRecipient.id, transfer_amount: amt });
      if (error) throw new Error(error.message);
      if (reloadProfile) reloadProfile();
      setBalance(Number(newBalance)); await fetchWallet(); triggerFeedback('success');
      toast.success('ההעברה בוצעה בהצלחה', { id: tid }); 
      setShowTransfer(false); setTransferAmount(''); setSelectedRecipient(null); setTransferUsername('');
    } catch (e: any) { triggerFeedback('error'); toast.error(e.message || 'העברה נכשלה', { id: tid }); } finally { setTransferring(false); }
  };

  const handleRedeem = async () => {
    const amt = Number(redeemAmount);
    if (isNaN(amt) || amt <= 0) return toast.error('אנא הזן סכום תקין');
    if (amt > balance) return toast.error('אין לך מספיק יתרה למשיכה');
    if (amt < 100) return toast.error('מינימום למשיכה הוא 100 CRD');

    setRedeeming(true); triggerFeedback('pop'); const tid = toast.loading('שולח בקשת משיכה...');
    try {
      const { error } = await supabase.rpc('request_cashout', { p_user_id: profile!.id, p_amount: amt });
      if (error) throw error;
      const newBal = balance - amt; setBalance(newBal);
      if (reloadProfile) await reloadProfile(); await fetchWallet();
      triggerFeedback('success'); toast.success('בקשת המשיכה נשלחה לאישור', { id: tid });
      setShowRedeem(false); setRedeemAmount('');
    } catch (err: any) { toast.error(err.message || 'שגיאה במשיכה', { id: tid }); } finally { setRedeeming(false); }
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
      <FadeIn className="px-4 pt-6 pb-32 bg-surface min-h-screen font-sans" dir="rtl">
        <div className="flex flex-col gap-8">
          
          {/* Balance Card - Ultra Premium */}
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-surface-card border border-white/10 rounded-[45px] p-10 flex flex-col items-center shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-accent-primary/10 blur-[80px] rounded-full pointer-events-none" />
            <span className="text-brand-muted text-[11px] font-black uppercase tracking-[0.3em] mb-2 relative z-10">יתרה זמינה</span>
            <div className="flex items-center gap-2 relative z-10">
               <span className="text-7xl font-black text-brand tracking-tighter drop-shadow-[0_10px_25px_rgba(var(--color-accent-primary),0.3)]">{balance.toLocaleString()}</span>
               <Zap size={24} className="text-accent-primary fill-accent-primary drop-shadow-[0_0_10px_rgba(var(--color-accent-primary),0.8)]" />
            </div>
            <span className="text-accent-primary text-[10px] font-black uppercase tracking-[0.5em] mt-4 opacity-80 relative z-10">Inner Credits</span>
            
            <div className="flex gap-4 w-full mt-10 pt-8 border-t border-surface-border relative z-10">
              <button onClick={() => { triggerFeedback('pop'); setShowTransfer(true); }} className="flex-1 bg-surface/50 hover:bg-surface h-14 rounded-2xl flex items-center justify-center gap-3 transition-all border border-surface-border active:scale-95 group">
                <Send size={18} className="text-brand-muted group-hover:text-accent-primary transition-colors rtl:-scale-x-100" />
                <span className="text-brand font-black text-sm uppercase tracking-widest">העברה</span>
              </button>
              <button onClick={() => { triggerFeedback('pop'); setShowRedeem(true); }} className="flex-1 bg-surface/50 hover:bg-surface h-14 rounded-2xl flex items-center justify-center gap-3 transition-all border border-surface-border active:scale-95 group">
                <Download size={18} className="text-brand-muted group-hover:text-white transition-colors" />
                <span className="text-brand font-black text-sm uppercase tracking-widest">משיכה</span>
              </button>
            </div>
          </motion.div>

          {/* Quick Packs (Upgraded Design) */}
          <div className="flex flex-col gap-4">
            <h3 className="text-brand-muted text-[10px] font-black uppercase tracking-[0.2em] px-2 flex items-center gap-2"><Gift size={12}/> טעינה מהירה</h3>
            <div className="grid grid-cols-3 gap-3 px-1">
              {PACKAGES.map((pkg) => (
                <button 
                  key={pkg.id} 
                  onClick={() => openPaymentSheet(pkg)} 
                  className={`relative group bg-surface-card border h-36 rounded-3xl p-5 flex flex-col justify-between active:scale-95 transition-all overflow-hidden shadow-lg ${pkg.popular ? 'border-accent-primary/40 bg-accent-primary/5 shadow-[0_0_20px_rgba(var(--color-accent-primary),0.1)]' : 'border-surface-border hover:border-surface-border-hover hover:bg-surface-border/20'}`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex justify-between items-center relative z-10">
                    <span className="text-[26px] font-black text-brand tracking-tighter drop-shadow-sm">{pkg.amount}</span>
                    <Zap size={14} className={`${pkg.popular ? 'text-accent-primary' : 'text-brand-muted'} group-hover:scale-110 transition-transform`} />
                  </div>
                  
                  <div className="flex flex-col items-start gap-1 relative z-10 mt-auto">
                    {pkg.discount && pkg.discount > 0 && (
                      <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full mb-1">{pkg.discount}% חסכון</span>
                    )}
                    <span className={`text-[13px] font-bold ${pkg.popular ? 'text-white' : 'text-brand-muted'}`}>₪{pkg.price}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* History */}
          <div className="flex flex-col gap-4">
            <h3 className="text-brand-muted text-[10px] font-black uppercase tracking-[0.2em] px-2 flex items-center gap-2">
              <History size={12} /> פעולות אחרונות
            </h3>
            <div className="bg-surface-card border border-surface-border rounded-[35px] overflow-hidden shadow-lg">
              {transactions.length === 0 ? (
                <div className="p-10 flex flex-col items-center justify-center text-brand-muted gap-3">
                   <CreditCard size={32} />
                   <span className="text-xs font-bold uppercase tracking-widest opacity-70">הארנק שלך ריק</span>
                </div>
              ) : (
                <div className="flex flex-col">
                  {visibleTransactions.map((tx, idx) => (
                    <div key={tx.id} className={`flex items-center justify-between p-5 ${idx !== visibleTransactions.length - 1 ? 'border-b border-surface-border' : ''}`}>
                      <div className="flex items-center gap-4 text-right">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-inner ${tx.amount > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                          {tx.amount > 0 ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-brand font-black text-sm">{tx.description || 'פעולה בחשבון'}</span>
                          <span className="text-brand-muted text-[10px] font-bold mt-0.5 tracking-widest" dir="ltr">{new Date(tx.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      <span className={`font-black text-[15px] tracking-widest ${tx.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`} dir="ltr">
                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                      </span>
                    </div>
                  ))}
                  {transactions.length > 4 && (
                    <button onClick={() => { triggerFeedback('pop'); setShowAllTx(true); }} className="w-full p-4 border-t border-surface-border hover:bg-surface transition-colors text-brand-muted text-[11px] font-black uppercase tracking-widest active:bg-surface-border/20">
                      הצג הכל
                    </button>
                  )}
                </div>
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
              <h2 className="text-brand font-black text-lg tracking-widest uppercase text-center mb-2">כל הפעולות</h2>
              <div className="bg-surface-card border border-surface-border rounded-[32px] overflow-hidden">
                {transactions.map((tx, idx) => (
                  <div key={tx.id} className={`flex items-center justify-between p-5 ${idx !== transactions.length - 1 ? 'border-b border-surface-border' : ''}`}>
                    <div className="flex items-center gap-4 text-right">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-inner ${tx.amount > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                        {tx.amount > 0 ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-brand font-black text-sm">{tx.description || 'פעולה'}</span>
                        <span className="text-brand-muted text-[10px] font-bold mt-0.5 tracking-widest" dir="ltr">{new Date(tx.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    <span className={`font-black text-[15px] tracking-widest ${tx.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`} dir="ltr">
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </BottomSheet>

          {/* Payment Sheet */}
          <BottomSheet open={!!selectedPackage} onClose={closePaymentSheet} heightClass="h-auto min-h-[40vh] max-h-[85vh]">
            {selectedPackage && (
              <div className="flex flex-col gap-6 items-center text-center pb-10">
                <div>
                  <h2 className="text-brand font-black text-xl tracking-widest uppercase">אישור טעינה</h2>
                  <p className="text-brand-muted text-[13px] font-medium mt-1">הוספת <span className="font-black text-white">{selectedPackage.amount} CRD</span> לארנק שלך</p>
                </div>
                <div className="w-full bg-surface-card border border-surface-border rounded-[32px] p-6 flex flex-col gap-4 shadow-inner">
                  <div className="flex justify-between items-center pb-4 border-b border-surface-border">
                    <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest">כמות קרדיטים</span>
                    <span className="text-brand font-black text-[16px]">{selectedPackage.amount} CRD</span>
                  </div>
                  {selectedPackage.discount && selectedPackage.discount > 0 ? (
                    <div className="flex justify-between items-center pb-4 border-b border-surface-border">
                      <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest">הטבה</span>
                      <span className="text-emerald-400 font-black text-[13px] bg-emerald-400/10 px-2 py-1 rounded-md border border-emerald-400/20">{selectedPackage.discount}% חיסכון</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest">סה"כ לתשלום</span>
                    <span className="text-accent-primary font-black text-2xl">₪{selectedPackage.price}</span>
                  </div>
                </div>
                <Button onClick={processNativePayment} disabled={adding} className="w-full h-16 bg-white text-black font-black text-[15px] uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[0_5px_20px_rgba(255,255,255,0.15)] disabled:opacity-50">
                  {adding ? <Loader2 size={24} className="animate-spin text-black" /> : 'אישור תשלום'}
                </Button>
              </div>
            )}
          </BottomSheet>

          {/* Transfer Sheet (Icon Moved to Left Corner) */}
          <BottomSheet open={showTransfer} onClose={() => setShowTransfer(false)}>
            <div className="flex flex-col gap-6 pb-10">
              <div className="text-center">
                <h2 className="text-white font-black text-xl tracking-widest uppercase">העברת קרדיטים</h2>
                <p className="text-white/40 text-xs font-medium mt-1">העבר CRD לחברים או יוצרים בקלות</p>
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
                    } else {
                      setTransferResults([]);
                    }
                  }}
                  placeholder="חפש שם או @יוזר..." dir="rtl"
                  className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 text-white outline-none focus:border-accent-primary/50 transition-all font-medium"
                />
                <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30" />
                
                <AnimatePresence>
                  {isSearching && (
                    <div className="absolute left-12 top-1/2 -translate-y-1/2 flex items-center"><Loader2 size={16} className="animate-spin text-accent-primary" /></div>
                  )}
                  {transferUsername.trim() !== '' && !selectedRecipient && !isSearching && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute w-full mt-2 bg-surface-card border border-surface-border rounded-2xl shadow-2xl overflow-hidden z-50" data-no-drag="true">
                      {transferResults.length === 0 ? (
                        <div className="p-6 text-center text-brand-muted text-[12px] font-bold">לא נמצא משתמש כזה</div>
                      ) : (
                        transferResults.map((u, i) => (
                          <div key={u.id} onClick={() => { triggerFeedback('pop'); setSelectedRecipient(u); setTransferUsername(u.username || ''); }} className={`flex items-center gap-3 p-4 hover:bg-surface-border/20 cursor-pointer transition-colors w-full ${i !== transferResults.length - 1 ? 'border-b border-surface-border' : ''}`}>
                            <div className="w-10 h-10 rounded-full bg-surface overflow-hidden shrink-0 border border-surface-border flex items-center justify-center">
                              {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={20} className="text-brand-muted" />}
                            </div>
                            <div className="flex flex-col text-right">
                              <span className="text-brand text-sm font-black">{u.full_name || 'משתמש'}</span>
                              {u.username && <span className="text-brand-muted text-[11px] font-bold tracking-widest" dir="ltr">@{u.username}</span>}
                            </div>
                          </div>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {selectedRecipient && (
                <div className="bg-accent-primary/10 border border-accent-primary/30 rounded-2xl p-3 px-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-surface border border-surface-border flex items-center justify-center">
                      {selectedRecipient.avatar_url ? <img src={selectedRecipient.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={20} className="text-brand-muted" />}
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-white text-[14px] font-black flex items-center gap-1.5">{selectedRecipient.full_name || 'משתמש'}<CheckCircle2 size={14} className="text-accent-primary" /></span>
                      {selectedRecipient.username && <span className="text-white/60 text-[11px] font-bold tracking-widest" dir="ltr">@{selectedRecipient.username}</span>}
                    </div>
                  </div>
                  <button onClick={() => { setSelectedRecipient(null); setTransferUsername(''); setTransferResults([]); }} className="text-white/40 hover:text-white transition-colors text-[11px] font-black bg-white/5 px-3 py-1.5 rounded-full border border-white/10">שנה</button>
                </div>
              )}
              
              <div className="relative mt-2" data-no-drag="true">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-accent-primary font-black text-sm tracking-widest">CRD</span>
                <input
                  type="number" value={transferAmount} onChange={(e: any) => setTransferAmount(e.target.value)}
                  placeholder="סכום..." dir="ltr"
                  className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-16 text-white font-black text-2xl outline-none focus:border-accent-primary/50 transition-all text-left"
                />
              </div>
              <Button onClick={handleTransfer} disabled={transferring || !transferAmount || !selectedRecipient} className="h-16 bg-accent-primary text-white font-black uppercase tracking-widest rounded-2xl mt-4 shadow-[0_5px_20px_rgba(var(--color-accent-primary),0.3)] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                {transferring ? <Loader2 size={24} className="animate-spin text-white" /> : 'אישור העברה'}
              </Button>
            </div>
          </BottomSheet>

          {/* Redeem Sheet */}
          <BottomSheet open={showRedeem} onClose={() => setShowRedeem(false)} heightClass="h-auto">
            <div className="flex flex-col gap-6 items-center text-center pb-10">
              <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center border border-rose-500/20 mb-2 shadowed-inner">
                <Download size={28} className="text-rose-400" />
              </div>
              <div>
                <h2 className="text-white font-black text-xl uppercase tracking-widest mb-1">משיכת מזומן</h2>
                <p className="text-white/50 text-[13px] font-medium leading-relaxed px-4">משוך את הקרדיטים לחשבון הבנק המקושר.<br/><span className="text-rose-400 font-bold text-[11px] uppercase tracking-widest">מינימום: 100 CRD</span></p>
              </div>
              <div className="relative w-full mt-2" data-no-drag="true">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-rose-400 font-black text-sm tracking-widest">CRD</span>
                <input
                  type="number" value={redeemAmount} onChange={(e: any) => setRedeemAmount(e.target.value)}
                  placeholder="0" dir="ltr"
                  className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-16 text-white font-black text-2xl outline-none focus:border-rose-400/50 transition-all text-left"
                />
              </div>
              <Button onClick={handleRedeem} disabled={redeeming || !redeemAmount} className="w-full h-16 mt-2 bg-rose-500 hover:bg-rose-600 text-white font-black uppercase tracking-widest rounded-2xl active:scale-95 disabled:opacity-50 shadow-[0_5px_20px_rgba(244,63,94,0.3)]">
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
