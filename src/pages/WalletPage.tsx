import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
  Loader2,
  UserCircle,
  CheckCircle2,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

type WalletTx = {
  id: string | number;
  type: 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out' | 'purchase' | string;
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

type CreditPackage = {
  amount: number;
  price: number;
  id: string;
  discount?: number;
  popular?: boolean;
};

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  heightClass?: string;
};

const BottomSheet: React.FC<BottomSheetProps> = ({
  open,
  onClose,
  children,
  heightClass = 'h-[88vh]',
}) => {
  const dragControls = useDragControls();

  const startSheetDrag = (e: React.PointerEvent<HTMLElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const interactive = target.closest(
      'input, textarea, button, a, select, option, label, [contenteditable="true"], [data-no-drag="true"]'
    );

    if (interactive) return;

    dragControls.start(e);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9900] flex flex-col justify-end" dir="rtl">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.1}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 450) onClose();
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 520, mass: 0.6 }}
            className={`bg-surface rounded-t-[40px] ${heightClass} flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden border-t border-surface-border`}
            style={{ willChange: 'transform' }}
          >
            <div
              className="w-full py-5 flex justify-center shrink-0 cursor-grab active:cursor-grabbing border-b border-surface-border"
              onPointerDown={startSheetDrag}
              style={{ touchAction: 'none' }}
            >
              <div className="w-16 h-1.5 bg-white/10 rounded-full pointer-events-none" />
            </div>

            <div
              className="flex-1 overflow-y-auto scrollbar-hide overscroll-contain"
              onPointerDown={startSheetDrag}
              style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
            >
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

  const [mounted, setMounted] = useState(false);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);

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

      const data = await apiFetch<any>('/api/wallet', {
        headers: { 'x-user-id': authData.user.id },
      });

      setBalance(Number(data?.credits || 0));
      setTransactions(Array.isArray(data?.transactions) ? data.transactions : []);
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
        setTransferSearchResults([]);
        setIsSearchingUsers(false);
        return;
      }

      setIsSearchingUsers(true);

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
          .limit(10);

        if (error) throw error;

        const safeData = Array.isArray(data) ? data : [];
        setTransferSearchResults(safeData.filter((u) => u.id !== currentUserId));
      } catch {
        setTransferSearchResults([]);
      } finally {
        setIsSearchingUsers(false);
      }
    };

    const timeoutId = setTimeout(searchUsers, 250);
    return () => clearTimeout(timeoutId);
  }, [transferUsername, showUserDropdown, currentUserId, selectedRecipient]);

  const openPaymentSheet = (pkg: CreditPackage) => {
    triggerFeedback('pop');
    setSelectedPackage(pkg);
  };

  const closePaymentSheet = () => {
    triggerFeedback('pop');
    setSelectedPackage(null);
  };

  const processNativePayment = async () => {
    if (!selectedPackage) return;

    setAdding(true);
    triggerFeedback('pop');
    const tid = toast.loading('מעבד תשלום מאובטח...');

    setTimeout(async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) throw new Error('משתמש לא מחובר');

        const data = await apiFetch<any>('/api/wallet/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': authData.user.id,
          },
          body: JSON.stringify({ amount: selectedPackage.amount }),
        });

        setBalance(Number(data?.newBalance || data?.new_balance || 0));
        await fetchWallet();

        triggerFeedback('coin');
        toast.success(`רכשת ${selectedPackage.amount} CRD בהצלחה`, { id: tid });
        setSelectedPackage(null);
      } catch {
        triggerFeedback('error');
        toast.error('התשלום נכשל', { id: tid });
      } finally {
        setAdding(false);
      }
    }, 1400);
  };

  const selectRecipient = (user: SearchUser) => {
    triggerFeedback('pop');
    setSelectedRecipient(user);
    setTransferUsername(user.username ? `@${user.username}` : user.full_name || 'משתמש');
    setShowUserDropdown(false);
    setTransferSearchResults([]);
  };

  const resetTransferState = () => {
    setShowTransfer(false);
    setTransferUsername('');
    setSelectedRecipient(null);
    setTransferAmount('');
    setTransferSearchResults([]);
    setShowUserDropdown(false);
  };

  const handleTransfer = async () => {
    const amountNum = Number(transferAmount);

    if (!selectedRecipient?.id) return toast.error('בחר משתמש מהרשימה לפני שליחה');
    if (isNaN(amountNum) || amountNum <= 0) return toast.error('אנא הזן סכום תקין');
    if (amountNum > balance) return toast.error('אין לך מספיק יתרה בארנק');

    setTransferring(true);
    triggerFeedback('pop');
    const tid = toast.loading(`מעביר ${amountNum} CRD...`);

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error('משתמש לא מחובר');

      const { data, error } = await supabase.rpc('transfer_credits', {
        sender_id: authData.user.id,
        receiver_id: selectedRecipient.id,
        transfer_amount: amountNum,
      });

      if (error) throw error;

      setBalance(
        typeof data === 'number'
          ? data
          : Number(data?.new_balance ?? data?.newBalance ?? balance - amountNum)
      );

      await fetchWallet();
      triggerFeedback('success');
      toast.success('ההעברה בוצעה בהצלחה', { id: tid });
      resetTransferState();
    } catch {
      triggerFeedback('error');
      toast.error('ההעברה נכשלה', { id: tid });
    } finally {
      setTransferring(false);
    }
  };

  const handleRedeem = async () => {
    const amountNum = Number(redeemAmount);

    if (isNaN(amountNum) || amountNum <= 0) return toast.error('אנא הזן סכום תקין');
    if (amountNum > balance) return toast.error('אין לך מספיק יתרה למשיכה');
    if (amountNum < 100) return toast.error('מינימום למשיכה הוא 100 CRD');

    setRedeeming(true);
    triggerFeedback('pop');
    const tid = toast.loading('מכין בקשת משיכה...');

    setTimeout(() => {
      setBalance((prev) => prev - amountNum);
      setTransactions((prev) => [
        {
          id: Date.now(),
          type: 'withdrawal',
          amount: amountNum,
          description: 'משיכה לחשבון בנק',
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);

      triggerFeedback('success');
      toast.success('בקשת המשיכה נשלחה לאישור', { id: tid });
      setRedeeming(false);
      setShowRedeem(false);
      setRedeemAmount('');
    }, 1400);
  };

  const PACKAGES: CreditPackage[] = [
    { id: 'crd_100', amount: 100, price: 15, popular: false, discount: 0 },
    { id: 'crd_500', amount: 500, price: 59, popular: true, discount: 21 },
    { id: 'crd_1500', amount: 1500, price: 149, popular: false, discount: 33 },
  ];

  const visibleTransactions = useMemo(() => transactions.slice(0, 3), [transactions]);

  // חוקי עיצוב סמנטיים (ירוק = הכנסה, אדום = הוצאה)
  const getTxVisuals = (tx: WalletTx) => {
    const isPositive = tx.type === 'deposit' || tx.type === 'transfer_in';
    const isNegative = tx.type === 'withdrawal' || tx.type === 'transfer_out' || tx.type === 'purchase';
    
    if (isPositive) {
      return {
        sign: '+',
        color: 'text-green-500',
      };
    }

    if (isNegative) {
      return {
        sign: '-',
        color: 'text-red-500',
      };
    }

    return {
      sign: '',
      color: 'text-brand',
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 className="animate-spin text-accent-primary" />
      </div>
    );
  }

  return (
    <>
      <FadeIn
        className="px-4 pt-5 pb-28 bg-surface min-h-screen font-sans flex flex-col gap-4 relative overflow-x-hidden"
        dir="rtl"
      >
        <div className="relative z-10">
          <motion.div
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 110, damping: 20 }}
            className="-mx-4 px-2"
          >
            <div className="bg-surface-card border border-surface-border pt-8 pb-4 rounded-[34px] flex flex-col items-center text-center shadow-lg relative overflow-hidden z-10">

              <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest mb-1 z-10 mt-2">
                יתרת קרדיטים
              </span>

              <div className="flex flex-col items-center justify-center mt-2 mb-7 z-10 relative">
                <span className="text-[62px] font-black text-brand tracking-tighter leading-none">
                  {balance.toLocaleString()}
                </span>
                <span className="text-[10px] font-black text-accent-primary uppercase tracking-[0.3em] mt-3">
                  CRD COIN
                </span>
              </div>

              <div className="w-full flex items-center justify-between px-8 pt-4 border-t border-surface-border relative z-10">
                <button
                  onClick={() => {
                    triggerFeedback('pop');
                    setShowTransfer(true);
                  }}
                  className="flex items-center justify-center gap-2 text-accent-primary hover:text-accent-primary/80 transition-colors text-[13px] font-black uppercase tracking-widest active:scale-95 w-full text-center"
                >
                  העברה
                </button>

                <div className="w-px h-4 bg-surface-border" />

                <button
                  onClick={() => {
                    triggerFeedback('pop');
                    setShowRedeem(true);
                  }}
                  className="flex items-center justify-center gap-2 text-red-500 hover:text-red-400 transition-colors text-[13px] font-black uppercase tracking-widest active:scale-95 w-full text-center"
                >
                  משיכה
                </button>
              </div>
            </div>
          </motion.div>

          <div className="flex flex-col gap-2 z-10 mt-6">
            <h3 className="text-brand-muted text-[11px] font-black tracking-[0.2em] uppercase text-center px-2 mb-2">
              טעינה מהירה
            </h3>

            <div className="-mx-4 px-2">
              <div className="grid grid-cols-3 gap-2">
                {PACKAGES.map((pkg, idx) => (
                  <button
                    key={idx}
                    onClick={() => openPaymentSheet(pkg)}
                    className={`relative flex flex-col items-center justify-center gap-1 h-28 rounded-[28px] transition-all active:scale-95 overflow-hidden shadow-sm ${
                      pkg.popular
                        ? 'bg-accent-primary/10 border border-accent-primary text-accent-primary'
                        : 'bg-surface-card border border-surface-border text-brand'
                    }`}
                  >
                    <div className="absolute top-2 w-full flex justify-center px-2 pointer-events-none">
                      {pkg.discount && pkg.discount > 0 ? (
                        <span className="text-[9px] font-black uppercase tracking-wider text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                          {pkg.discount}% הנחה
                        </span>
                      ) : (
                        <span className="h-4" />
                      )}
                    </div>

                    <span className="text-[22px] font-black mt-4">
                      {pkg.amount}
                    </span>
                    <span className={`text-[11px] font-bold tracking-wider ${pkg.popular ? 'text-accent-primary' : 'text-brand-muted'}`}>₪{pkg.price}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-6 z-10 mb-4">
            <h3 className="text-brand-muted text-[11px] font-black tracking-[0.2em] uppercase text-center px-2 mb-2">
              פעולות אחרונות
            </h3>

            <div className="-mx-4 px-2">
              <div className="bg-surface-card border border-surface-border rounded-[34px] shadow-sm overflow-hidden">
                {transactions.length === 0 ? (
                  <div className="py-10 text-center text-brand-muted text-[12px] font-black uppercase tracking-widest flex flex-col items-center gap-3">
                    הארנק שלך ריק
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {visibleTransactions.map((tx, idx) => {
                      const visuals = getTxVisuals(tx);

                      return (
                        <div
                          key={tx.id}
                          className={`flex items-center justify-between p-4 ${
                            idx !== visibleTransactions.length - 1 ? 'border-b border-surface-border' : ''
                          }`}
                        >
                          <div className="flex items-center gap-4 text-right">
                            <div className="flex flex-col">
                              <span className="text-brand text-[15px] font-black">{tx.description}</span>
                              <span
                                className="text-brand-muted text-[11px] font-bold mt-1 tracking-widest"
                                dir="ltr"
                              >
                                {new Date(tx.created_at).toLocaleDateString('he-IL', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </div>

                          <span className={`font-black text-[16px] tracking-wide ${visuals.color}`} dir="ltr">
                            <span className="pl-0.5">{visuals.sign}</span>
                            {tx.amount}
                          </span>
                        </div>
                      );
                    })}

                    {transactions.length > 3 && (
                      <button
                        onClick={() => {
                          triggerFeedback('pop');
                          setShowAllTx(true);
                        }}
                        className="w-full p-4 border-t border-surface-border hover:bg-white/5 active:bg-white/10 transition-all flex items-center justify-center text-brand-muted text-[12px] font-black uppercase tracking-widest"
                      >
                        הצג הכל
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </FadeIn>

      {mounted &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <BottomSheet open={showAllTx} onClose={() => setShowAllTx(false)}>
              <div className="p-4 flex flex-col gap-2">
                <div className="text-center mb-4">
                  <h2 className="text-brand font-black text-lg tracking-widest uppercase">כל הפעולות</h2>
                </div>
                <div className="bg-surface-card border border-surface-border rounded-[24px] overflow-hidden">
                  {transactions.map((tx, idx) => {
                    const visuals = getTxVisuals(tx);
                    return (
                      <div key={tx.id} className={`flex items-center justify-between p-4 ${idx !== transactions.length - 1 ? 'border-b border-surface-border' : ''}`}>
                        <div className="flex flex-col text-right">
                          <span className="text-brand text-[15px] font-black">{tx.description}</span>
                          <span
                            className="text-brand-muted text-[11px] font-bold mt-1 tracking-widest"
                            dir="ltr"
                          >
                            {new Date(tx.created_at).toLocaleDateString('he-IL', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <span className={`font-black text-[18px] tracking-wide ${visuals.color}`} dir="ltr">
                          <span className="pl-0.5">{visuals.sign}</span>
                          {tx.amount}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </BottomSheet>

            <BottomSheet open={!!selectedPackage} onClose={closePaymentSheet} heightClass="h-auto min-h-[42vh] max-h-[82vh]">
              {selectedPackage && (
                <div className="p-6 flex flex-col items-center text-center gap-6">
                  <div>
                    <h2 className="text-brand font-black text-xl tracking-widest uppercase">אישור טעינה</h2>
                    <p className="text-brand-muted text-[13px] font-medium mt-1">
                      הוספת {selectedPackage.amount} CRD לארנק שלך
                    </p>
                  </div>

                  <div className="w-full bg-surface border border-surface-border rounded-[32px] p-5 flex flex-col gap-4 shadow-inner">
                    <div className="flex justify-between items-center pb-4 border-b border-surface-border">
                      <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest">כמות</span>
                      <span className="text-brand font-black text-[16px]">{selectedPackage.amount} CRD</span>
                    </div>

                    {selectedPackage.discount && selectedPackage.discount > 0 ? (
                      <div className="flex justify-between items-center pb-4 border-b border-surface-border">
                        <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest">
                          הנחה
                        </span>
                        <span className="text-orange-400 font-black text-[14px]">
                          {selectedPackage.discount}% חיסכון
                        </span>
                      </div>
                    ) : null}

                    <div className="flex justify-between items-center pt-1">
                      <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest">
                        סה"כ
                      </span>
                      <span className="text-accent-primary font-black text-2xl">₪{selectedPackage.price}</span>
                    </div>
                  </div>

                  <Button
                    onClick={processNativePayment}
                    disabled={adding}
                    className="w-full h-14 mt-1 bg-accent-primary text-white font-black text-[14px] uppercase tracking-widest rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {adding ? <Loader2 size={22} className="animate-spin text-white" /> : 'אישור תשלום'}
                  </Button>
                </div>
              )}
            </BottomSheet>

            <BottomSheet open={showTransfer} onClose={resetTransferState}>
              <div className="p-6 flex flex-col gap-6">
                <h2 className="text-brand font-black text-xl tracking-widest uppercase text-center mb-2">העברת קרדיטים</h2>
                
                <div className="flex flex-col gap-2 relative z-20">
                  <label className="text-brand-muted text-[11px] font-black uppercase px-2 tracking-widest text-right">
                    למי להעביר? (@)
                  </label>

                  <div className="relative" data-no-drag="true">
                    <input
                      type="text"
                      value={transferUsername}
                      onChange={(e: any) => {
                        setTransferUsername(e.target.value);
                        setSelectedRecipient(null);
                        setShowUserDropdown(true);
                      }}
                      onFocus={() => setShowUserDropdown(true)}
                      placeholder="חיפוש לפי שם..."
                      dir="rtl"
                      className="bg-surface text-brand font-medium h-14 border border-surface-border focus:border-accent-primary/40 focus:outline-none transition-all rounded-full px-5 w-full shadow-inner"
                    />

                    <AnimatePresence>
                      {showUserDropdown && transferUsername.trim() !== '' && !selectedRecipient && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 bg-surface-card border border-surface-border rounded-[32px] shadow-xl overflow-hidden flex flex-col"
                          data-no-drag="true"
                        >
                          {isSearchingUsers ? (
                            <div className="p-4 flex justify-center">
                              <Loader2 size={18} className="animate-spin text-brand-muted" />
                            </div>
                          ) : transferSearchResults.length === 0 ? (
                            <div className="p-4 text-center text-brand-muted text-[12px] font-bold">
                              לא נמצא משתמש כזה
                            </div>
                          ) : (
                            transferSearchResults.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => selectRecipient(u)}
                                className="flex items-center gap-3 p-3 border-b border-surface-border hover:bg-white/5 cursor-pointer transition-colors last:border-0 text-right w-full"
                              >
                                <div className="w-10 h-10 rounded-full bg-surface overflow-hidden shrink-0 border border-surface-border flex items-center justify-center">
                                  {u.avatar_url ? (
                                    <img src={u.avatar_url} className="w-full h-full object-cover" />
                                  ) : (
                                    <UserCircle size={16} className="text-brand-muted" />
                                  )}
                                </div>

                                <div className="flex flex-col text-right w-full">
                                  <span className="text-brand text-[13px] font-black">
                                    {u.full_name || 'משתמש'}
                                  </span>
                                  {u.username && (
                                    <span className="text-brand-muted text-[10px] font-bold tracking-widest" dir="ltr">
                                      @{u.username}
                                    </span>
                                  )}
                                </div>
                              </button>
                            ))
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {selectedRecipient && (
                    <div className="mt-2 bg-accent-primary/10 border border-accent-primary/20 rounded-[24px] p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={18} className="text-accent-primary" />
                        <div className="flex flex-col text-right">
                          <span className="text-brand text-[12px] font-black">
                            {selectedRecipient.full_name || 'משתמש'}
                          </span>
                          {selectedRecipient.username && (
                            <span className="text-brand-muted text-[10px] font-bold" dir="ltr">
                              @{selectedRecipient.username}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRecipient(null);
                          setTransferUsername('');
                          setShowUserDropdown(true);
                        }}
                        className="text-brand-muted hover:text-brand transition-colors text-[11px] font-black pl-2"
                      >
                        שנה
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 relative z-0 mt-2">
                  <label className="text-brand-muted text-[11px] font-black uppercase px-2 tracking-widest text-right">
                    סכום ב-CRD
                  </label>
                  <input
                    type="number"
                    value={transferAmount}
                    onChange={(e: any) => setTransferAmount(e.target.value)}
                    placeholder="0"
                    dir="ltr"
                    className="bg-surface text-brand font-black h-14 border border-surface-border focus:border-accent-primary/40 focus:outline-none transition-all rounded-full px-5 text-xl w-full shadow-inner"
                    data-no-drag="true"
                  />
                </div>

                <Button
                  onClick={handleTransfer}
                  disabled={transferring || !transferAmount || !selectedRecipient}
                  className="w-full h-14 mt-4 bg-accent-primary text-white font-black text-[14px] uppercase tracking-widest rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 relative z-0"
                >
                  {transferring ? <Loader2 size={24} className="animate-spin text-white" /> : 'אישור העברה'}
                </Button>
              </div>
            </BottomSheet>

            <BottomSheet open={showRedeem} onClose={() => setShowRedeem(false)} heightClass="h-auto min-h-[42vh] max-h-[82vh]">
              <div className="p-6 flex flex-col gap-6 items-center text-center">
                <h2 className="text-brand font-black text-xl tracking-widest uppercase mb-2">משיכת כספים</h2>
                
                <p className="text-brand-muted text-[13px] font-medium leading-relaxed px-4">
                  משוך את הקרדיטים שהרווחת במועדונים שלך ישירות לחשבון הבנק המקושר.
                  <br />
                  <span className="font-bold text-red-500 mt-2 block">מינימום למשיכה: 100 CRD</span>
                </p>

                <div className="w-full flex flex-col gap-2 mt-2">
                  <label className="text-brand-muted text-[11px] font-black uppercase px-2 tracking-widest text-right">
                    סכום למשיכה (CRD)
                  </label>
                  <input
                    type="number"
                    value={redeemAmount}
                    onChange={(e: any) => setRedeemAmount(e.target.value)}
                    placeholder="0"
                    dir="ltr"
                    className="bg-surface text-brand font-black h-14 border border-surface-border focus:border-red-500/40 focus:outline-none transition-all rounded-full px-5 text-xl w-full shadow-inner"
                    data-no-drag="true"
                  />
                </div>

                <Button
                  onClick={handleRedeem}
                  disabled={redeeming || !redeemAmount}
                  className="w-full h-14 mt-2 bg-red-500 hover:bg-red-600 text-white font-black text-[14px] uppercase tracking-widest rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
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
