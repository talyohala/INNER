import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Loader2, ArrowDownLeft, ArrowUpRight, UserCircle, CheckCircle2, Wallet, Zap, Tag, History, ShieldCheck, SmartphoneNfc, ChevronDown, Send, Banknote } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

type WalletTx = {
  id: string | number;
  type: 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out' | string;
  amount: number;
  description: string;
  created_at: string;
};

type SearchUser = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export const WalletPage: React.FC = () => {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  const historyDragControls = useDragControls();
  const paymentDragControls = useDragControls();
  const transferDragControls = useDragControls();
  const redeemDragControls = useDragControls();

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);

  const [adding, setAdding] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  const [selectedPackage, setSelectedPackage] = useState<{ amount: number; price: number; id: string; discount?: number } | null>(null);
  const [showAllTx, setShowAllTx] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [transferUsername, setTransferUsername] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<SearchUser | null>(null);
  const [transferAmount, setTransferAmount] = useState<number | string>('');
  const [redeemAmount, setRedeemAmount] = useState<number | string>('');

  const [transferSearchResults, setTransferSearchResults] = useState<SearchUser[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error('משתמש לא מחובר');

      setCurrentUserId(authData.user.id);

      const data = await apiFetch<any>('/api/wallet', { headers: { 'x-user-id': authData.user.id } });

      setBalance(Number(data?.credits || 0));
      setTransactions(Array.isArray(data?.transactions) ? data.transactions : []);
    } catch (err) { toast.error('שגיאה בטעינת הארנק'); } finally { setLoading(false); }
  };

  useEffect(() => {
    const searchUsers = async () => {
      const query = transferUsername.replace('@', '').trim();
      if (!showUserDropdown || query.length < 1 || selectedRecipient) {
        setTransferSearchResults([]); setIsSearchingUsers(false); return;
      }
      setIsSearchingUsers(true);
      try {
        const { data, error } = await supabase.from('profiles').select('id, full_name, username, avatar_url').or(`username.ilike.%${query}%,full_name.ilike.%${query}%`).limit(10);
        if (error) throw error;
        const safeData = Array.isArray(data) ? data : [];
        setTransferSearchResults(safeData.filter((u) => u.id !== currentUserId));
      } catch (err) { setTransferSearchResults([]); } finally { setIsSearchingUsers(false); }
    };
    const timeoutId = setTimeout(searchUsers, 250);
    return () => clearTimeout(timeoutId);
  }, [transferUsername, showUserDropdown, currentUserId, selectedRecipient]);

  const openPaymentSheet = (pkg: { amount: number; price: number; id: string; discount?: number }) => { triggerFeedback('pop'); setSelectedPackage(pkg); };
  const closePaymentSheet = () => { triggerFeedback('pop'); setSelectedPackage(null); };

  const processNativePayment = async () => {
    if (!selectedPackage) return;
    setAdding(true); triggerFeedback('pop');
    const tid = toast.loading('מעבד תשלום מאובטח...');
    setTimeout(async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) throw new Error('משתמש לא מחובר');
        const data = await apiFetch<any>('/api/wallet/add', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': authData.user.id }, body: JSON.stringify({ amount: selectedPackage.amount }) });
        setBalance(Number(data?.newBalance || 0)); await fetchWallet();
        triggerFeedback('coin'); toast.success(`רכשת ${selectedPackage.amount} CRD בהצלחה! 💎`, { id: tid });
        setSelectedPackage(null);
      } catch (err) { triggerFeedback('error'); toast.error('התשלום נכשל', { id: tid }); } finally { setAdding(false); }
    }, 1500);
  };

  const selectRecipient = (user: SearchUser) => { triggerFeedback('pop'); setSelectedRecipient(user); setTransferUsername(user.username ? `@${user.username}` : user.full_name || 'משתמש'); setShowUserDropdown(false); setTransferSearchResults([]); };
  const resetTransferState = () => { setShowTransfer(false); setTransferUsername(''); setSelectedRecipient(null); setTransferAmount(''); setTransferSearchResults([]); setShowUserDropdown(false); };

  const handleTransfer = async () => {
    const amountNum = Number(transferAmount);
    if (!selectedRecipient?.id) return toast.error('בחר משתמש מהרשימה לפני שליחה');
    if (isNaN(amountNum) || amountNum <= 0) return toast.error('אנא הזן סכום תקין');
    if (amountNum > balance) return toast.error('אין לך מספיק יתרה בארנק');

    setTransferring(true); triggerFeedback('pop');
    const tid = toast.loading(`מעביר ${amountNum} CRD...`);

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error('משתמש לא מחובר');
      const { data, error } = await supabase.rpc('transfer_credits', { sender_id: authData.user.id, receiver_id: selectedRecipient.id, transfer_amount: amountNum });
      if (error) throw error;
      setBalance(typeof data === 'number' ? data : Number(data?.new_balance ?? data?.newBalance ?? balance - amountNum));
      await fetchWallet();
      triggerFeedback('success'); toast.success(`ההעברה בוצעה בהצלחה!`, { id: tid });
      resetTransferState();
    } catch (err: any) { triggerFeedback('error'); toast.error('ההעברה נכשלה', { id: tid }); } finally { setTransferring(false); }
  };

  const handleRedeem = async () => {
    const amountNum = Number(redeemAmount);
    if (isNaN(amountNum) || amountNum <= 0) return toast.error('אנא הזן סכום תקין');
    if (amountNum > balance) return toast.error('אין לך מספיק יתרה למשיכה');
    if (amountNum < 100) return toast.error('מינימום למשיכה הוא 100 CRD');

    setRedeeming(true); triggerFeedback('pop');
    const tid = toast.loading('מכין בקשת פדיון...');

    setTimeout(() => {
      setBalance((prev) => prev - amountNum);
      setTransactions((prev) => [{ id: Date.now(), type: 'withdrawal', amount: amountNum, description: 'משיכה לחשבון בנק', created_at: new Date().toISOString() }, ...prev]);
      triggerFeedback('success'); toast.success('בקשת הפדיון נשלחה לאישור!', { id: tid });
      setRedeeming(false); setShowRedeem(false); setRedeemAmount('');
    }, 1500);
  };

  const PACKAGES = [
    { id: 'crd_100', amount: 100, price: 15, popular: false, discount: 0 },
    { id: 'crd_500', amount: 500, price: 59, popular: true, discount: 21 },
    { id: 'crd_1500', amount: 1500, price: 149, popular: false, discount: 33 }
  ];

  const visibleTransactions = useMemo(() => transactions.slice(0, 3), [transactions]);

  if (loading) return <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  return (
    <>
      <FadeIn className="px-4 pt-12 pb-32 bg-[#0C0C0C] min-h-screen font-sans flex flex-col gap-6 relative overflow-x-hidden" dir="rtl">
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex justify-center">
          <div className="absolute top-[-5%] left-[-10%] w-[50%] h-[40%] bg-white/5 blur-[100px] rounded-full mix-blend-screen"></div>
        </div>

        <div className="flex flex-col items-center justify-center relative z-10 mb-2 mt-2">
          <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">הארנק שלי</h1>
        </div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 100, damping: 20 }}>
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#050505] border border-white/20 pt-8 pb-4 rounded-[40px] flex flex-col items-center text-center shadow-[0_25px_60px_rgba(0,0,0,0.8)] relative overflow-hidden z-10">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[#e5e4e2]/10 blur-[80px] rounded-full pointer-events-none"></div>

            <span className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1 z-10 mt-2">יתרת קרדיטים זמינה</span>

            <div className="flex flex-col items-center justify-center mt-2 mb-8 z-10 relative">
              <span className="text-[72px] font-black text-white tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.1)] leading-none">{balance.toLocaleString()}</span>
              <span className="text-[10px] font-black text-[#ffc107] uppercase tracking-[0.3em] mt-4 drop-shadow-[0_0_10px_rgba(255,193,7,0.4)] bg-[#ffc107]/10 px-4 py-1.5 rounded-full border border-[#ffc107]/20">CRD COIN</span>
            </div>

            <div className="w-full flex items-center justify-between px-10 pt-4 border-t border-white/5 relative z-10">
              <button onClick={() => { triggerFeedback('pop'); setShowTransfer(true); }} className="flex items-center justify-center gap-1.5 text-white/60 hover:text-white transition-colors text-[12px] font-black uppercase tracking-widest active:scale-95 w-full text-center">העברה</button>
              <div className="w-px h-4 bg-white/10"></div>
              <button onClick={() => { triggerFeedback('pop'); setShowRedeem(true); }} className="flex items-center justify-center gap-1.5 text-white/60 hover:text-white transition-colors text-[12px] font-black uppercase tracking-widest active:scale-95 w-full text-center">פדיון</button>
            </div>
          </div>
        </motion.div>

        <div className="flex flex-col gap-3 z-10 mt-4">
          <h3 className="text-white/40 text-[10px] font-black tracking-[0.2em] uppercase text-center px-2">טעינה מהירה</h3>
          <div className="grid grid-cols-3 gap-3">
            {PACKAGES.map((pkg, idx) => (
              <button key={idx} onClick={() => openPaymentSheet(pkg)} className={`relative flex flex-col items-center justify-center gap-1 h-32 rounded-[32px] transition-all active:scale-95 overflow-hidden shadow-xl ${pkg.popular ? 'bg-gradient-to-br from-[#111] to-black border border-[#e5e4e2]/40 shadow-[0_0_20px_rgba(229,228,226,0.15)]' : 'bg-white/[0.03] backdrop-blur-md border border-white/10 hover:bg-white/[0.06]'}`}>
                <div className="absolute top-2 w-full flex justify-center px-2 pointer-events-none">
                  {pkg.discount > 0 ? (
                    <motion.span animate={pkg.popular ? { scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] } : {}} transition={{ repeat: Infinity, duration: 2 }} className="bg-[#ff5722]/10 text-[#ff5722] text-[9px] font-black uppercase tracking-wider py-0.5 px-3 rounded-full border border-[#ff5722]/30 shadow-[0_0_8px_rgba(255,87,34,0.3)]">{pkg.discount}% הנחה</motion.span>
                  ) : <span className="h-4"></span>}
                </div>
                <span className={`text-[24px] font-black mt-4 ${pkg.popular ? 'text-[#e5e4e2]' : 'text-white'}`}>{pkg.amount}</span>
                <span className="text-white/50 text-[11px] font-bold tracking-wider">₪{pkg.price}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-6 z-10 mb-6">
          <h3 className="text-white/40 text-[10px] font-black tracking-[0.2em] uppercase text-center px-2">פעולות אחרונות</h3>
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[40px] shadow-2xl overflow-hidden">
            {transactions.length === 0 ? (
              <div className="py-12 text-center text-white/20 text-[11px] font-black uppercase tracking-widest flex flex-col items-center gap-3">הארנק שלך ריק, התחל לטעון!</div>
            ) : (
              <div className="flex flex-col">
                {visibleTransactions.map((tx, idx) => (
                  <div key={tx.id} className={`flex items-center justify-between p-5 ${idx !== 2 && idx !== transactions.length - 1 ? 'border-b border-white/5' : ''}`}>
                    <div className="flex items-center gap-4 text-right">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-inner ${tx.type === 'deposit' || tx.type === 'transfer_in' ? 'bg-[#e5e4e2]/10 border border-[#e5e4e2]/20' : 'bg-white/[0.02] border border-white/5'}`}>
                        {tx.type === 'deposit' || tx.type === 'transfer_in' ? <ArrowDownLeft size={18} className="text-[#e5e4e2]" /> : <ArrowUpRight size={18} className="text-white/40" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white/90 text-[14px] font-black">{tx.description}</span>
                        <span className="text-white/40 text-[10px] font-bold mt-1 tracking-widest" dir="ltr">{new Date(tx.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    <span className="font-black text-[18px] text-white tracking-wide" dir="ltr">
                      <span className={tx.type === 'deposit' || tx.type === 'transfer_in' ? 'text-[#e5e4e2] pl-0.5' : 'text-white/30 pl-0.5'}>{tx.type === 'deposit' || tx.type === 'transfer_in' ? '+' : '-'}</span>{tx.amount}
                    </span>
                  </div>
                ))}
                {transactions.length > 3 && (
                  <button onClick={() => { triggerFeedback('pop'); setShowAllTx(true); }} className="w-full p-5 border-t border-white/5 bg-white/[0.01] hover:bg-white/[0.04] active:bg-white/[0.06] transition-all flex items-center justify-center text-white/50 text-[11px] font-black uppercase tracking-widest">
                    הצג את כל הפעולות ({transactions.length})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center text-white/20 mt-2 mb-8 relative z-10 text-[9px] font-black uppercase tracking-widest">עסקאות מאובטחות מוצפנות</div>
      </FadeIn>

      {mounted && typeof document !== 'undefined' && createPortal(
        <>
          <AnimatePresence>
            {showAllTx && (
              <div className="fixed inset-0 z-[9900] flex flex-col justify-end" dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAllTx(false)} />
                <motion.div drag="y" dragControls={historyDragControls} dragListener={false} dragConstraints={{ top: 0 }} dragElastic={0.2} onDragEnd={(e, { offset, velocity }) => { if (offset.y > 100 || velocity.y > 400) setShowAllTx(false); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="bg-[#0A0A0A] border-t border-white/10 rounded-t-[40px] h-[90vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
                  <div onPointerDown={(e) => historyDragControls.start(e)} style={{ touchAction: 'none' }} className="w-full flex flex-col items-center pt-5 pb-4 cursor-grab active:cursor-grabbing bg-white/[0.02]">
                    <div className="w-16 h-1.5 bg-white/20 rounded-full mb-4 pointer-events-none"></div>
                    <div className="px-6 pb-2 flex items-center justify-center w-full"><h3 className="text-[16px] font-black text-white">היסטוריית פעולות ({transactions.length})</h3></div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col scrollbar-hide touch-pan-y">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-4 border-b border-white/5">
                        <div className="flex items-center gap-4 text-right">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-inner ${tx.type === 'deposit' || tx.type === 'transfer_in' ? 'bg-[#e5e4e2]/10 border border-[#e5e4e2]/20' : 'bg-white/[0.03] border border-white/10'}`}>
                            {tx.type === 'deposit' || tx.type === 'transfer_in' ? <ArrowDownLeft size={18} className="text-[#e5e4e2]" /> : <ArrowUpRight size={18} className="text-white/40" />}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-white/90 text-[15px] font-black">{tx.description}</span>
                            <span className="text-white/40 text-[10px] font-bold mt-1 tracking-widest" dir="ltr">{new Date(tx.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                        <span className="font-black text-[18px] text-white tracking-wide" dir="ltr"><span className={tx.type === 'deposit' || tx.type === 'transfer_in' ? 'text-[#e5e4e2] pl-0.5' : 'text-white/30 pl-0.5'}>{tx.type === 'deposit' || tx.type === 'transfer_in' ? '+' : '-'}</span>{tx.amount}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectedPackage && (
              <div className="fixed inset-0 z-[9900] flex flex-col justify-end" dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closePaymentSheet} />
                <motion.div drag="y" dragControls={paymentDragControls} dragListener={false} dragConstraints={{ top: 0 }} dragElastic={0.2} onDragEnd={(e, { offset, velocity }) => { if (offset.y > 100 || velocity.y > 400) closePaymentSheet(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="bg-[#0A0A0A] border-t border-white/10 rounded-t-[40px] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative pb-12 overflow-hidden">
                  <div onPointerDown={(e) => paymentDragControls.start(e)} style={{ touchAction: 'none' }} className="w-full flex flex-col items-center pt-5 pb-4 cursor-grab active:cursor-grabbing bg-white/[0.02]">
                    <div className="w-16 h-1.5 bg-white/20 rounded-full mb-4 pointer-events-none"></div>
                    <div className="flex justify-center items-center w-full px-6"><h2 className="text-[16px] font-black text-white">רכישת קרדיטים</h2></div>
                  </div>
                  <div className="p-6 flex flex-col items-center text-center gap-6 overflow-y-auto scrollbar-hide">
                    <div><p className="text-white/50 text-[13px] font-medium mt-2">הוספת {selectedPackage.amount} CRD לארנק שלך.</p></div>
                    <div className="w-full bg-white/[0.03] border border-white/5 rounded-[32px] p-5 flex flex-col gap-4 shadow-inner">
                      <div className="flex justify-between items-center pb-4 border-b border-white/5"><span className="text-white/50 text-[11px] font-black uppercase tracking-widest">פריט</span><span className="text-white font-black text-[16px]">{selectedPackage.amount} CRD</span></div>
                      {selectedPackage.discount && selectedPackage.discount > 0 ? <div className="flex justify-between items-center pb-4 border-b border-white/5"><span className="text-white/50 text-[11px] font-black uppercase tracking-widest">הנחה</span><span className="text-[#e5e4e2] font-black text-[14px]">{selectedPackage.discount}% חיסכון</span></div> : null}
                      <div className="flex justify-between items-center pt-1"><span className="text-white/50 text-[11px] font-black uppercase tracking-widest">סה"כ לתשלום</span><span className="text-[#e5e4e2] font-black text-2xl">₪{selectedPackage.price}</span></div>
                    </div>
                    <Button onClick={processNativePayment} disabled={adding} className="w-full h-14 mt-2 bg-white text-black font-black text-[14px] uppercase tracking-widest rounded-full flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all active:scale-95 disabled:opacity-50">
                      {adding ? <Loader2 size={24} className="animate-spin text-black/50" /> : 'אשר רכישה'}
                    </Button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showTransfer && (
              <div className="fixed inset-0 z-[9900] flex flex-col justify-end" dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={resetTransferState} />
                <motion.div drag="y" dragControls={transferDragControls} dragListener={false} dragConstraints={{ top: 0 }} dragElastic={0.2} onDragEnd={(e, { offset, velocity }) => { if (offset.y > 100 || velocity.y > 400) resetTransferState(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="bg-[#0A0A0A] border-t border-white/10 rounded-t-[40px] h-[90vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative pb-12 overflow-hidden">
                  <div onPointerDown={(e) => transferDragControls.start(e)} style={{ touchAction: 'none' }} className="w-full flex flex-col items-center pt-5 pb-4 cursor-grab active:cursor-grabbing bg-white/[0.02]">
                    <div className="w-16 h-1.5 bg-white/20 rounded-full mb-4 pointer-events-none"></div>
                    <div className="flex justify-center items-center w-full px-6"><h2 className="text-[16px] font-black text-white">העברה לחבר</h2></div>
                  </div>
                  <div className="p-6 flex flex-col gap-6 overflow-y-auto scrollbar-hide">
                    <div className="flex flex-col gap-2 relative z-20">
                      <label className="text-white/40 text-[11px] font-black uppercase px-2 tracking-widest text-right">שם המשתמש או חיפוש (@)</label>
                      <div className="relative">
                        <input type="text" value={transferUsername} onChange={(e: any) => { setTransferUsername(e.target.value); setSelectedRecipient(null); setShowUserDropdown(true); }} onFocus={() => setShowUserDropdown(true)} placeholder="חיפוש לפי שם..." dir="rtl" className="bg-black/40 text-white font-medium h-14 border border-white/10 shadow-inner focus:border-white/50 focus:outline-none transition-all rounded-full px-5 w-full" />
                        <AnimatePresence>
                          {showUserDropdown && transferUsername.trim() !== '' && !selectedRecipient && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 bg-[#111] border border-white/10 rounded-[32px] shadow-inner overflow-hidden flex flex-col">
                              {isSearchingUsers ? (
                                <div className="p-4 flex justify-center"><Loader2 size={18} className="animate-spin text-white/40" /></div>
                              ) : transferSearchResults.length === 0 ? (
                                <div className="p-4 text-center text-white/40 text-[12px] font-bold">לא נמצא משתמש כזה</div>
                              ) : (
                                transferSearchResults.map((u) => (
                                  <button key={u.id} type="button" onClick={() => selectRecipient(u)} className="flex items-center gap-3 p-3 border-b border-white/5 hover:bg-white/[0.05] cursor-pointer transition-colors last:border-0 active:bg-white/10 text-right w-full">
                                    <div className="w-10 h-10 rounded-full bg-black overflow-hidden shrink-0 border border-white/10 relative">
                                      {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><UserCircle size={16} className="text-white/20" /></div>}
                                    </div>
                                    <div className="flex flex-col text-right w-full">
                                      <span className="text-white text-[13px] font-black">{u.full_name || 'משתמש'}</span>
                                      {u.username && <span className="text-white/40 text-[10px] font-bold tracking-widest" dir="ltr">@{u.username}</span>}
                                    </div>
                                  </button>
                                ))
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      {selectedRecipient && (
                        <div className="mt-2 bg-[#2196f3]/10 border border-[#2196f3]/20 rounded-[24px] p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 size={18} className="text-[#2196f3]" />
                            <div className="flex flex-col text-right">
                              <span className="text-white text-[12px] font-black">{selectedRecipient.full_name || 'משתמש'}</span>
                              {selectedRecipient.username && <span className="text-white/40 text-[10px] font-bold" dir="ltr">@{selectedRecipient.username}</span>}
                            </div>
                          </div>
                          <button type="button" onClick={() => { setSelectedRecipient(null); setTransferUsername(''); setShowUserDropdown(true); }} className="text-white/40 text-[11px] font-black pl-2">שנה</button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 relative z-0">
                      <label className="text-white/40 text-[11px] font-black uppercase px-2 tracking-widest text-right">סכום ב-CRD</label>
                      <input type="number" value={transferAmount} onChange={(e: any) => setTransferAmount(e.target.value)} placeholder="100" dir="ltr" className="bg-black/40 text-white font-black h-14 border border-white/10 shadow-inner focus:border-white/50 focus:outline-none transition-all rounded-full px-5 text-xl w-full" />
                    </div>
                    <Button onClick={handleTransfer} disabled={transferring} className="w-full h-14 mt-4 bg-white text-black font-black text-[14px] uppercase tracking-widest rounded-full flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all active:scale-95 disabled:opacity-50 relative z-0">
                      {transferring ? <Loader2 size={24} className="animate-spin text-black" /> : 'שלח קרדיטים'}
                    </Button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showRedeem && (
              <div className="fixed inset-0 z-[9900] flex flex-col justify-end" dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowRedeem(false)} />
                <motion.div drag="y" dragControls={redeemDragControls} dragListener={false} dragConstraints={{ top: 0 }} dragElastic={0.2} onDragEnd={(e, { offset, velocity }) => { if (offset.y > 100 || velocity.y > 400) setShowRedeem(false); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="bg-[#0A0A0A] border-t border-white/10 rounded-t-[40px] h-[90vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative pb-12 overflow-hidden">
                  <div onPointerDown={(e) => redeemDragControls.start(e)} style={{ touchAction: 'none' }} className="w-full flex flex-col items-center pt-5 pb-4 cursor-grab active:cursor-grabbing bg-white/[0.02]">
                    <div className="w-16 h-1.5 bg-white/20 rounded-full mb-4 pointer-events-none"></div>
                    <div className="flex justify-center items-center w-full px-6"><h2 className="text-[16px] font-black text-white">פדיון כספים לבנק</h2></div>
                  </div>
                  <div className="p-6 flex flex-col gap-6 overflow-y-auto scrollbar-hide">
                    <div className="bg-[#4ade80]/10 border border-[#4ade80]/20 p-4 rounded-[28px] flex items-start gap-3">
                      <p className="text-white/70 text-[11px] font-medium leading-relaxed">משוך את הקרדיטים שהרווחת במועדונים שלך ישירות לחשבון הבנק המקושר. מינימום למשיכה: 100 CRD.</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-white/40 text-[11px] font-black uppercase px-2 tracking-widest text-right">סכום למשיכה (CRD)</label>
                      <input type="number" value={redeemAmount} onChange={(e: any) => setRedeemAmount(e.target.value)} placeholder="0" dir="ltr" className="bg-black/40 text-white font-black h-14 border border-white/10 shadow-inner focus:border-[#4ade80]/50 focus:outline-none transition-all rounded-full px-5 text-xl w-full" />
                    </div>
                    <Button onClick={handleRedeem} disabled={redeeming} className="w-full h-14 mt-4 bg-white text-black font-black text-[14px] uppercase tracking-widest rounded-full flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all active:scale-95 disabled:opacity-50">
                      {redeeming ? <Loader2 size={24} className="animate-spin text-black" /> : 'בקש פדיון'}
                    </Button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>,
        document.getElementById('root') || document.body
      )}
    </>
  );
};
