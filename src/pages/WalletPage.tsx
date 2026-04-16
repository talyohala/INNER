import React, { useEffect, useMemo, useState } from 'react';                                                      
import { useNavigate } from 'react-router-dom';          
import { createPortal } from 'react-dom';                
import { motion, AnimatePresence, useDragControls } from 'framer-motion';                                         
import {                                                   
  Loader2, UserCircle, CheckCircle2, ArrowUpRight, ArrowDownLeft,                                           
  CreditCard, Send, Download, Search, Plus, ShieldCheck, Zap                                                
} from 'lucide-react';                                   
import { apiFetch } from '../lib/api';                   
import { supabase } from '../lib/supabase';              
import { FadeIn, Button } from '../components/ui';       
import { triggerFeedback } from '../lib/sound';          
import toast from 'react-hot-toast';                     
import { useAuth } from '../context/AuthContext';                                                         

type WalletTx = {                                          
  id: string | number;                                     
  type: 'deposit' | 'withdrawal' | 'transfer' | 'purchase' | 'top_up' | 'drop_revenue' | 'platform_tax' | 'dm_fee' | string;                            
  amount: number;                                          
  description?: string;                                     
  created_at: string;                                    
  user_id: string;
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
  open, onClose, children, heightClass = 'h-[88vh]',                              
}) => {                                                    
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />                                                                                                                
          <motion.div                                                
            drag="y" dragControls={dragControls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.1} dragMomentum={false}                                     
            onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 450) onClose(); }}                                                       
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 520, mass: 0.6 }}                                           
            className={`bg-surface rounded-t-[40px] ${heightClass} flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden border-t border-surface-border`}                                                                
            style={{ willChange: 'transform' }}                    
          >                                                          
            <div className="w-full py-5 flex justify-center shrink-0 cursor-grab active:cursor-grabbing border-b border-surface-border" onPointerDown={startSheetDrag} style={{ touchAction: 'none' }}>                                                          
              <div className="w-16 h-1.5 bg-white/10 rounded-full pointer-events-none" />                                     
            </div>                                                                                                            
            <div className="flex-1 overflow-y-auto scrollbar-hide overscroll-contain" onPointerDown={startSheetDrag} style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>                                                          
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
  }, [profile?.id]);                                                                                                           
  
  const fetchWallet = async () => {                          
    if (!profile?.id) return;
    setLoading(true);
    setCurrentUserId(profile.id);
    setBalance(profile.crd_balance || 0);

    try {                                                      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20);                                                                                                               
      
      if (!error && data) {
        setTransactions(data as WalletTx[]);
      }
    } catch {                                                  
      toast.error('שגיאה בטעינת היסטוריית ארנק');                     
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
        const { data, error } = await supabase.from('profiles').select('id, full_name, username, avatar_url').or(`username.ilike.%${query}%,full_name.ilike.%${query}%`).limit(10);                                                                                                     
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
    if (!selectedPackage || !profile?.id) return;                            
    setAdding(true);                                         
    triggerFeedback('pop');                                  
    const tid = toast.loading('מעבד תשלום מאובטח...');                                                                
    
    setTimeout(async () => {                                   
      try {                                                      
        const newBalance = (profile.crd_balance || 0) + selectedPackage.amount;
        const { error } = await supabase.from('profiles').update({ crd_balance: newBalance }).eq('id', profile.id);
        if (error) throw error;

        await supabase.from('transactions').insert({
          user_id: profile.id,
          amount: selectedPackage.amount,
          type: 'deposit',
          description: `טעינת ${selectedPackage.amount} CRD באשראי`
        });
        
        if (reloadProfile) reloadProfile();
        setBalance(newBalance);                                                   
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
    setTransferUsername(user.full_name || user.username || 'משתמש');                             
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
    
    // כאן התיקון! בודקים רק את ה-ID (אידי) ולא את השם משתמש. 
    if (!selectedRecipient?.id) return toast.error('בחר משתמש מהרשימה לפני שליחה');                                   
    if (isNaN(amountNum) || amountNum <= 0) return toast.error('אנא הזן סכום תקין');                                  
    if (amountNum > balance) return toast.error('אין לך מספיק יתרה בארנק');                                                                                                    
    
    setTransferring(true);                                   
    triggerFeedback('pop');                                  
    const tid = toast.loading(`מעביר ${amountNum} CRD...`);                                                                                                                    
    try {                                                      
      if (!profile?.id) throw new Error('משתמש לא מחובר');                                                                                                                     
      
      const result = await apiFetch('/api/wallet/transfer', {
        method: 'POST',
        body: JSON.stringify({ 
          receiverId: selectedRecipient.id, 
          amount: amountNum 
        })
      });                                                                                                             
      
      if (reloadProfile) reloadProfile();
      setBalance(result.newBalance);                                                                                                                
      await fetchWallet();                                     
      
      triggerFeedback('success');                              
      toast.success('ההעברה בוצעה בהצלחה', { id: tid });       
      resetTransferState();                                  
    } catch (err: any) {                                                  
      triggerFeedback('error');                                
      toast.error(err.message || 'ההעברה נכשלה', { id: tid });              
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
      if (reloadProfile) reloadProfile();
      triggerFeedback('success');                              
      toast.success('בקשת המשיכה נשלחה לאישור', { id: tid });                                                           
      setRedeeming(false);                                     
      setShowRedeem(false);                                    
      setRedeemAmount('');                                   
      fetchWallet();
    }, 1400);                                              
  };                                                                                                                
  
  const PACKAGES: CreditPackage[] = [                        
    { id: 'crd_100', amount: 100, price: 15, popular: false, discount: 0 },                                           
    { id: 'crd_500', amount: 500, price: 59, popular: true, discount: 21 },                                           
    { id: 'crd_1500', amount: 1500, price: 149, popular: false, discount: 33 },                                     
  ];                                                                                                                
  
  const visibleTransactions = useMemo(() => transactions.slice(0, 3), [transactions]);                                                                                       
  
  const getTxVisuals = (tx: WalletTx) => {                   
    const isPositive = tx.amount > 0;                                            
    const isNegative = tx.amount < 0;                                                                       
    
    let description = tx.description || 'פעולה בחשבון';
    
    if (isPositive) {                                          
      return { sign: '+', color: 'text-emerald-400', icon: <ArrowDownLeft size={16} className="text-emerald-400" />, desc: description };                                                     
    }                                                                                                                 
    if (isNegative) {                                          
      return { sign: '', color: 'text-rose-400', icon: <ArrowUpRight size={16} className="text-rose-400" />, desc: description };                                                     
    }                                                                                                                 
    return { sign: '', color: 'text-brand', icon: <CreditCard size={16} className="text-brand-muted" />, desc: description };                                                     
  };                                                                                                                
  
  if (loading && transactions.length === 0) {                                             
    return ( <div className="min-h-screen bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" size={32} /></div> );                                                     
  }                                                                                                                 
  
  return (                                                   
    <>                                                         
      <FadeIn className="px-4 pt-5 pb-28 bg-surface min-h-screen font-sans flex flex-col gap-6 relative overflow-x-hidden" dir="rtl">                                                          
        <div className="relative z-10 flex flex-col gap-6">                                                                                                                          
          
          {/* THE BLACK CARD (Main Balance) */}                    
          <motion.div initial={{ y: 20, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} className="-mx-2">                                                          
            <div className="bg-surface-card border border-surface-border pt-10 pb-5 rounded-[40px] flex flex-col items-center text-center shadow-[0_20px_50px_rgba(0,0,0,0.4)] relative overflow-hidden z-10">                                                                                             
              <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/10 via-transparent to-transparent opacity-60" />                                                    
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-accent-primary/20 blur-[60px] rounded-full pointer-events-none" />                                                                                                          
              <span className="text-brand-muted text-[11px] font-black uppercase tracking-[0.2em] mb-1 z-10 drop-shadow-md">יתרת ארנק</span>                                                                                                           
              
              <div className="flex flex-col items-center justify-center mt-2 mb-8 z-10 relative">                                 
                <span className="text-[64px] font-black text-brand tracking-tighter leading-none drop-shadow-lg">{balance.toLocaleString()}</span>                                                  
                <span className="text-[11px] font-black text-accent-primary uppercase tracking-[0.4em] mt-3 drop-shadow-md">INNER COIN</span>                                                
              </div>                                                                                                            
              
              {/* Action Buttons inside Card */}                       
              <div className="w-full flex items-center justify-between px-6 pt-5 border-t border-surface-border relative z-10">                                                            
                <button onClick={() => { triggerFeedback('pop'); setShowTransfer(true); }} className="flex items-center justify-center gap-2 text-brand hover:text-accent-primary transition-colors text-[13px] font-black uppercase tracking-widest active:scale-95 w-full text-center group">                                                          
                  <Send size={16} className="text-brand-muted group-hover:text-accent-primary transition-colors" /> העברה                                                  
                </button>                                                                                                         
                <div className="w-px h-6 bg-surface-border" />                                                                                                                             
                <button onClick={() => { triggerFeedback('pop'); setShowRedeem(true); }} className="flex items-center justify-center gap-2 text-brand hover:text-rose-400 transition-colors text-[13px] font-black uppercase tracking-widest active:scale-95 w-full text-center group">                                                          
                  <Download size={16} className="text-brand-muted group-hover:text-rose-400 transition-colors" /> משיכה                                                  
                </button>                                              
              </div>                                                 
            </div>                                                 
          </motion.div>                                                                                                     
          
          {/* STORE PACKAGES */}                                   
          <div className="flex flex-col gap-3 z-10 mt-2">            
            <div className="flex items-center justify-between px-2 mb-1">                                                       
              <h3 className="text-brand-muted text-[11px] font-black tracking-[0.2em] uppercase">טעינה מהירה</h3>                                                  
            </div>                                                                                                            
            <div className="grid grid-cols-3 gap-2 px-1">              
              {PACKAGES.map((pkg, idx) => (                              
                <button key={idx} onClick={() => openPaymentSheet(pkg)} className={`relative flex flex-col items-center justify-center gap-1 h-32 rounded-[28px] transition-all active:scale-95 overflow-hidden shadow-sm ${pkg.popular ? 'bg-accent-primary/10 border border-accent-primary/40 text-accent-primary shadow-[0_0_20px_rgba(var(--color-accent-primary),0.1)]' : 'bg-surface-card border border-surface-border text-brand hover:bg-white/5'}`}>                                                          
                  <div className="absolute top-3 w-full flex justify-center px-2 pointer-events-none">                                
                    {pkg.discount && pkg.discount > 0 ? (                      
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full shadow-sm">{pkg.discount}% חסכון</span>                                                
                    ) : ( <span className="h-4" /> )}                                                     
                  </div>                                                                                                            
                  <span className="text-[24px] font-black mt-4 drop-shadow-sm">{pkg.amount}</span>                                                  
                  <span className={`text-[12px] font-bold tracking-wider ${pkg.popular ? 'text-accent-primary' : 'text-brand-muted'}`}>₪{pkg.price}</span>                                                
                </button>                                              
              ))}                                                    
            </div>                                                 
          </div>                                                                                                            
          
          {/* RECENT TRANSACTIONS */}                              
          <div className="flex flex-col gap-3 z-10 mb-4 mt-2">                                                                
            <h3 className="text-brand-muted text-[11px] font-black tracking-[0.2em] uppercase px-2 mb-1">פעולות אחרונות</h3>                                                                                                             
            <div className="bg-surface-card border border-surface-border rounded-[32px] shadow-sm overflow-hidden px-1">                                                                 
              {transactions.length === 0 ? (                             
                <div className="py-12 text-center text-brand-muted text-[12px] font-black uppercase tracking-widest flex flex-col items-center gap-3 opacity-60">                            
                  <CreditCard size={32} strokeWidth={1.5} /> הארנק שלך ריק                                          
                </div>                                                 
              ) : (                                                      
                <div className="flex flex-col">                            
                  {visibleTransactions.map((tx, idx) => {                    
                    const visuals = getTxVisuals(tx);                                                                                 
                    return (                                                   
                      <div key={tx.id} className={`flex items-center justify-between p-4 px-5 ${idx !== visibleTransactions.length - 1 ? 'border-b border-surface-border' : ''}`}>                                                          
                        <div className="flex items-center gap-4 text-right">                                                                
                          <div className="w-10 h-10 rounded-full bg-surface border border-surface-border flex items-center justify-center shrink-0 shadow-inner">{visuals.icon}</div>                                                   
                          <div className="flex flex-col">                            
                            <span className="text-brand text-[14px] font-black leading-tight">{visuals.desc}</span>                                                                                  
                            <span className="text-brand-muted text-[11px] font-bold mt-1 tracking-widest" dir="ltr">{new Date(tx.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>                                                
                          </div>                                                 
                        </div>                                                                                                            
                        <span className={`font-black text-[16px] tracking-widest ${visuals.color}`} dir="ltr">                              
                          <span className="pl-0.5">{visuals.sign}</span>{tx.amount}                                            
                        </span>                                                
                      </div>                                                 
                    );                                                     
                  })}                                                                                                               
                  {transactions.length > 3 && (                              
                    <button onClick={() => { triggerFeedback('pop'); setShowAllTx(true); }} className="w-full p-4 border-t border-surface-border hover:bg-white/5 active:bg-white/10 transition-all flex items-center justify-center text-brand-muted text-[12px] font-black uppercase tracking-widest">                                                          
                      הצג הכל                                                
                    </button>                                              
                  )}                                                     
                </div>                                                 
              )}                                                     
            </div>                                                 
          </div>                                                 
        </div>                                                 
      </FadeIn>                                                                                                         
      
      {/* BOTTOM SHEETS */}                                    
      {mounted && typeof document !== 'undefined' && createPortal(                                              
        <>                                                         
          {/* ALL TRANSACTIONS */}                                 
          <BottomSheet open={showAllTx} onClose={() => setShowAllTx(false)}>                                                  
            <div className="p-4 flex flex-col gap-4">                  
              <div className="text-center mb-2">                         
                <h2 className="text-brand font-black text-lg tracking-widest uppercase">כל הפעולות</h2>                         
              </div>                                                   
              <div className="bg-surface-card border border-surface-border rounded-[32px] overflow-hidden shadow-sm">                                                                      
                {transactions.map((tx, idx) => {                           
                  const visuals = getTxVisuals(tx);                        
                  return (                                                   
                    <div key={tx.id} className={`flex items-center justify-between p-4 px-5 ${idx !== transactions.length - 1 ? 'border-b border-surface-border' : ''}`}>                        
                      <div className="flex items-center gap-4 text-right">                                                                
                        <div className="w-10 h-10 rounded-full bg-surface border border-surface-border flex items-center justify-center shrink-0 shadow-inner">{visuals.icon}</div>                                                   
                        <div className="flex flex-col">                            
                          <span className="text-brand text-[14px] font-black leading-tight">{visuals.desc}</span>                                                                                  
                          <span className="text-brand-muted text-[11px] font-bold mt-1 tracking-widest" dir="ltr">{new Date(tx.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>                                                
                        </div>                                                 
                      </div>                                                   
                      <span className={`font-black text-[16px] tracking-widest ${visuals.color}`} dir="ltr">                              
                        <span className="pl-0.5">{visuals.sign}</span>{tx.amount}                                                       
                      </span>                                                
                    </div>                                                 
                  );                                                     
                })}                                                    
              </div>                                                 
            </div>                                                 
          </BottomSheet>                                                                                                    
          
          {/* PAYMENT CONFIRMATION */}                             
          <BottomSheet open={!!selectedPackage} onClose={closePaymentSheet} heightClass="h-auto min-h-[42vh] max-h-[82vh]">                                                            
            {selectedPackage && (                                      
              <div className="p-6 flex flex-col items-center text-center gap-6">                                                  
                <div>                                                      
                  <h2 className="text-brand font-black text-xl tracking-widest uppercase">אישור טעינה</h2>                          
                  <p className="text-brand-muted text-[13px] font-medium mt-1">הוספת <span className="font-black text-white">{selectedPackage.amount} CRD</span> לארנק שלך</p>                                                   
                </div>                                                                                                            
                <div className="w-full bg-surface-card border border-surface-border rounded-[32px] p-6 flex flex-col gap-4 shadow-sm">                                                       
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
                <Button onClick={processNativePayment} disabled={adding} className="w-full h-14 mt-2 bg-white text-black font-black text-[14px] uppercase tracking-widest rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-[0_5px_20px_rgba(255,255,255,0.15)]">                                                          
                  {adding ? <Loader2 size={22} className="animate-spin text-black" /> : 'אישור תשלום'}                            
                </Button>                                              
              </div>                                                 
            )}                                                     
          </BottomSheet>                                                                                                    
          
          {/* TRANSFER SHEET */}                                   
          <BottomSheet open={showTransfer} onClose={resetTransferState}>                                                      
            <div className="p-6 flex flex-col gap-6">                  
              <div className="text-center mb-2">                         
                <h2 className="text-brand font-black text-xl tracking-widest uppercase">העברת קרדיטים</h2>                        
                <p className="text-brand-muted text-[12px] font-medium mt-1">העבר CRD לחברים או יוצרים</p>                      
              </div>                                                                                                            
              <div className="flex flex-col gap-2 relative z-20">                                                                 
                <label className="text-brand-muted text-[11px] font-black uppercase px-2 tracking-widest text-right">למי להעביר?</label>                                                 
                <div className="relative" data-no-drag="true">                                                                      
                  <Search size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-muted" />                       
                  <input                                                     
                    type="text" value={transferUsername}                                 
                    onChange={(e: any) => { setTransferUsername(e.target.value); setSelectedRecipient(null); setShowUserDropdown(true); }}                                                       
                    onFocus={() => setShowUserDropdown(true)}                                                                         
                    placeholder="חפש שם או @יוזר..." dir="rtl"                                                
                    className="bg-surface-card text-brand font-medium h-[56px] border border-surface-border focus:border-accent-primary/50 focus:outline-none transition-all rounded-[24px] pr-12 pl-5 w-full shadow-inner"                           
                  />                                                                                                                
                  <AnimatePresence>                                          
                    {showUserDropdown && transferUsername.trim() !== '' && !selectedRecipient && (                                      
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="absolute w-full mt-2 bg-surface-card border border-surface-border rounded-[24px] shadow-2xl overflow-hidden flex flex-col z-50" data-no-drag="true">                                                          
                        {isSearchingUsers ? (                                      
                          <div className="p-5 flex justify-center"><Loader2 size={20} className="animate-spin text-accent-primary" /></div>                                                 
                        ) : transferSearchResults.length === 0 ? (                                                                          
                          <div className="p-5 text-center text-brand-muted text-[12px] font-bold">לא נמצא משתמש כזה</div>                                                 
                        ) : (                                                      
                          transferSearchResults.map((u, i) => (                                                                               
                            <button key={u.id} type="button" onClick={() => selectRecipient(u)} className={`flex items-center gap-3 p-4 hover:bg-white/5 cursor-pointer transition-colors text-right w-full ${i !== transferSearchResults.length - 1 ? 'border-b border-surface-border' : ''}`}>                                                          
                              <div className="w-10 h-10 rounded-full bg-surface overflow-hidden shrink-0 border border-surface-border flex items-center justify-center shadow-inner">                                                                               
                                {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={20} className="text-brand-muted" />}                                                     
                              </div>                                                   
                              <div className="flex flex-col text-right w-full">                                                                   
                                <span className="text-brand text-[14px] font-black">{u.full_name || 'משתמש'}</span>                                                  
                                {u.username && <span className="text-brand-muted text-[11px] font-bold tracking-widest" dir="ltr">@{u.username}</span>}                                                     
                              </div>                                                 
                            </button>                                              
                          ))                                                     
                        )}                                                     
                      </motion.div>                                          
                    )}                                                     
                  </AnimatePresence>                                     
                </div>                                                                                                            
                {selectedRecipient && (                                    
                  <div className="mt-2 bg-surface-card border border-accent-primary/30 rounded-[24px] p-3 px-4 flex items-center justify-between shadow-sm">                                   
                    <div className="flex items-center gap-3">                                                                           
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-surface border border-surface-border">                                                                             
                        {selectedRecipient.avatar_url ? <img src={selectedRecipient.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-brand-muted p-1" />}                                                
                      </div>                                                   
                      <div className="flex flex-col text-right">                                                                          
                        <span className="text-brand text-[14px] font-black flex items-center gap-1.5">{selectedRecipient.full_name || 'משתמש'}<CheckCircle2 size={14} className="text-accent-primary" /></span>                                                  
                        {selectedRecipient.username && <span className="text-brand-muted text-[11px] font-bold tracking-widest" dir="ltr">@{selectedRecipient.username}</span>}                                                     
                      </div>                                                 
                    </div>                                                   
                    <button type="button" onClick={() => { setSelectedRecipient(null); setTransferUsername(''); setShowUserDropdown(true); }} className="text-brand-muted hover:text-brand transition-colors text-[11px] font-black bg-surface px-3 py-1.5 rounded-full border border-surface-border">שנה</button>                                              
                  </div>                                                 
                )}                                                     
              </div>                                                                                                            
              <div className="flex flex-col gap-2 relative z-0 mt-2">                                                             
                <label className="text-brand-muted text-[11px] font-black uppercase px-2 tracking-widest text-right">סכום ב-CRD</label>                                                 
                <div className="relative">                                 
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-accent-primary font-black text-[12px] tracking-widest">CRD</span>                                           
                  <input type="number" value={transferAmount} onChange={(e: any) => setTransferAmount(e.target.value)} placeholder="0" dir="ltr" className="bg-surface-card text-brand font-black h-[56px] border border-surface-border focus:border-accent-primary/50 focus:outline-none transition-all rounded-[24px] px-16 text-xl w-full shadow-inner text-left" data-no-drag="true" />                                                     
                </div>                                                 
              </div>                                                                                                            
              <Button onClick={handleTransfer} disabled={transferring || !transferAmount || !selectedRecipient} className="w-full h-14 mt-4 bg-accent-primary text-white font-black text-[14px] uppercase tracking-widest rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 relative z-0 shadow-lg">                                                          
                {transferring ? <Loader2 size={24} className="animate-spin text-white" /> : 'אישור העברה'}                      
              </Button>                                              
            </div>                                                 
          </BottomSheet>                                                                                                    
          
          {/* REDEEM SHEET */}                                     
          <BottomSheet open={showRedeem} onClose={() => setShowRedeem(false)} heightClass="h-auto min-h-[42vh] max-h-[82vh]">                                                          
            <div className="p-6 flex flex-col gap-6 items-center text-center">                                                  
              <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-2">                                                      
                <Download size={28} className="text-rose-400" />                                                                
              </div>                                                   
              <div>                                                      
                <h2 className="text-brand font-black text-xl tracking-widest uppercase mb-2">משיכת כספים</h2>                     
                <p className="text-brand-muted text-[13px] font-medium leading-relaxed px-4">משוך את הקרדיטים שהרווחת ישירות לחשבון הבנק המקושר.<span className="font-bold text-rose-400 mt-2 block tracking-widest uppercase text-[11px]">מינימום למשיכה: 100 CRD</span></p>                                                   
              </div>                                                                                                            
              <div className="w-full flex flex-col gap-2 mt-4">                                                                   
                <label className="text-brand-muted text-[11px] font-black uppercase px-2 tracking-widest text-right">סכום למשיכה (CRD)</label>                                                 
                <div className="relative">                                 
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-rose-400 font-black text-[12px] tracking-widest">CRD</span>                                                 
                  <input type="number" value={redeemAmount} onChange={(e: any) => setRedeemAmount(e.target.value)} placeholder="0" dir="ltr" className="bg-surface-card text-brand font-black h-[56px] border border-surface-border focus:border-rose-400/50 focus:outline-none transition-all rounded-[24px] px-16 text-xl w-full shadow-inner text-left" data-no-drag="true" />                                                     
                </div>                                                 
              </div>                                                                                                            
              <Button onClick={handleRedeem} disabled={redeeming || !redeemAmount} className="w-full h-14 mt-4 bg-rose-500 hover:bg-rose-600 text-white font-black text-[14px] uppercase tracking-widest rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-[0_5px_20px_rgba(244,63,94,0.3)]">                                                          
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
