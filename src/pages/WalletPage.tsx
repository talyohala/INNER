import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Wallet, Lock, Loader2, ArrowDownLeft, ArrowUpRight, ArrowRight, Zap, History, ShieldCheck, SmartphoneNfc, ChevronDown, Send, Tag } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

export const WalletPage: React.FC = () => {
  const navigate = useNavigate();
  const historyDragControls = useDragControls();
  const paymentDragControls = useDragControls();

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const [selectedPackage, setSelectedPackage] = useState<{ amount: number, price: number, id: string, discount?: number } | null>(null);
  const [showAllTx, setShowAllTx] = useState(false);

  const fetchWallet = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error('משתמש לא מחובר');

      const data = await apiFetch<any>('/api/wallet', {
        headers: { 'x-user-id': authData.user.id }
      });
      setBalance(data.credits || 0);
      setTransactions(data.transactions || []);
    } catch (err) {
      toast.error('שגיאה בטעינת הארנק', { style: { background: '#111', color: '#ef4444' } });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWallet(); }, []);

  const openPaymentSheet = (pkg: { amount: number, price: number, id: string, discount?: number }) => {
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
    const tid = toast.loading(`מעבד תשלום מאובטח...`, { style: { background: '#111', color: '#fff' } });

    setTimeout(async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) throw new Error('משתמש לא מחובר');

        const data = await apiFetch<any>('/api/wallet/add', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-user-id': authData.user.id 
          },
          body: JSON.stringify({ amount: selectedPackage.amount })
        });

        setBalance(data.newBalance);
        await fetchWallet();
        
        triggerFeedback('coin');
        toast.success(`רכשת ${selectedPackage.amount} CRD בהצלחה! 💎`, { id: tid, style: { background: '#111', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' } });
        closePaymentSheet();
      } catch (err) {
        triggerFeedback('error');
        toast.error('התשלום נכשל', { id: tid, style: { background: '#111', color: '#ef4444' } });
      } finally {
        setAdding(false);
      }
    }, 1500);
  };

  const PACKAGES = [
    { id: 'crd_100', amount: 100, price: 10, popular: false, discount: 0 },
    { id: 'crd_500', amount: 500, price: 45, popular: true, discount: 10 },
    { id: 'crd_1200', amount: 1200, price: 100, popular: false, discount: 17 }
  ];

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  return (
    <FadeIn className="px-4 pt-8 pb-32 bg-black min-h-screen font-sans flex flex-col gap-6 relative overflow-x-hidden" dir="rtl">
      
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex justify-center">
        <div className="absolute top-[-5%] left-[-10%] w-[50%] h-[40%] bg-white/10 blur-[100px] rounded-full mix-blend-screen"></div>
      </div>

      <div className="flex items-center justify-between relative z-10 mb-2 px-1">
        <div className="w-10"></div>
        <div className="flex flex-col items-center">
          <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            <Wallet size={18} className="text-white/60" /> הארנק שלי
          </h1>
        </div>
        <button onClick={() => { triggerFeedback('pop'); navigate(-1); }} className="w-10 h-10 flex items-center justify-center text-white/30 hover:text-white transition-colors bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-full shadow-lg active:scale-90">
          <ArrowRight size={18} />
        </button>
      </div>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 100, damping: 20 }}>
        <div className="bg-black border border-white/10 p-8 rounded-[36px] flex flex-col items-center text-center shadow-2xl relative overflow-hidden z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[#00d4ff]/10 blur-[80px] rounded-full pointer-events-none"></div>
          
          <div className="absolute top-5 left-6 opacity-40 flex items-center gap-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white">VIP MEMBER</span>
          </div>

          <span className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2 z-10 mt-2">יתרת קרדיטים זמינה</span>
          
          <div className="flex flex-col items-center justify-center mt-2 mb-6 z-10 relative">
            <span className="text-[72px] font-black text-white tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.1)] leading-none">{balance.toLocaleString()}</span>
            <span className="text-[10px] font-black text-[#00d4ff] uppercase tracking-[0.3em] mt-4 drop-shadow-[0_0_10px_rgba(0,212,255,0.4)] bg-[#00d4ff]/10 px-4 py-1.5 rounded-full border border-[#00d4ff]/20">
              CRD COIN
            </span>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 z-10 mt-2">
        <button 
          onClick={() => { triggerFeedback('error'); toast('פיצ׳ר משיכה לחשבון בנק ייפתח בקרוב!', { icon: '🔒', style: { background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }); }}
          className="h-14 bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-[20px] flex items-center justify-center gap-2 text-white/60 font-black text-[12px] uppercase tracking-widest hover:bg-white/[0.06] active:scale-95 transition-all shadow-lg"
        >
          <ArrowUpRight size={16} className="text-[#2196f3]" /> פדיון CRD
        </button>
        <button 
          onClick={() => { triggerFeedback('error'); toast('פיצ׳ר העברת קרדיטים לחברים ייפתח בקרוב!', { icon: '🤝', style: { background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }); }}
          className="h-14 bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-[20px] flex items-center justify-center gap-2 text-white/60 font-black text-[12px] uppercase tracking-widest hover:bg-white/[0.06] active:scale-95 transition-all shadow-lg"
        >
          <Send size={16} className="text-[#00d4ff]" /> העברה לחבר
        </button>
      </div>

      <div className="flex flex-col gap-3 z-10 mt-4">
        <h3 className="text-white/40 text-[10px] font-black tracking-[0.2em] uppercase text-right px-2 flex items-center gap-1.5 drop-shadow-md">
          <Zap size={12} className="text-[#00d4ff]" /> טעינה מהירה
        </h3>
        
        <div className="grid grid-cols-3 gap-3">
          {PACKAGES.map((pkg, idx) => (
            <button
              key={idx}
              onClick={() => openPaymentSheet(pkg)}
              className={`relative flex flex-col items-center justify-center gap-1 h-32 rounded-[24px] transition-all active:scale-95 overflow-hidden shadow-xl ${
                pkg.popular
                  ? 'bg-gradient-to-br from-[#111] to-black border border-[#00d4ff]/40 shadow-[0_0_20px_rgba(0,212,255,0.15)]'
                  : 'bg-white/[0.03] backdrop-blur-md border border-white/10 hover:bg-white/[0.06]'
              }`}
            >
              <div className="absolute top-2 w-full flex justify-center px-2 pointer-events-none">
                {pkg.discount > 0 ? (
                  <motion.span 
                    animate={pkg.popular ? { scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] } : {}} 
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="bg-[#00d4ff]/20 text-[#00d4ff] text-[9px] font-black uppercase tracking-wider py-0.5 px-2 rounded-full border border-[#00d4ff]/30 shadow-[0_0_8px_rgba(0,212,255,0.3)] flex items-center gap-1"
                  >
                    <Tag size={8} /> {pkg.discount}% הנחה
                  </motion.span>
                ) : (
                  <span className="h-4"></span>
                )}
              </div>

              <span className={`text-[24px] font-black mt-4 ${pkg.popular ? 'text-[#00d4ff]' : 'text-white'}`}>{pkg.amount}</span>
              <span className="text-white/50 text-[11px] font-bold tracking-wider">₪{pkg.price}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-6 z-10 mb-6">
        <h3 className="text-white/40 text-[10px] font-black tracking-[0.2em] uppercase text-right px-2 flex items-center gap-1.5">
          <History size={12} className="text-white/60" /> פעולות אחרונות
        </h3>
        
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[32px] shadow-2xl overflow-hidden">
          {transactions.length === 0 ? (
            <div className="py-12 text-center text-white/20 text-[11px] font-black uppercase tracking-widest flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-black border border-white/5 flex items-center justify-center shadow-inner">
                <History size={24} className="text-white/10" />
              </div>
              הארנק שלך ריק, התחל לטעון!
            </div>
          ) : (
            <div className="flex flex-col">
              {transactions.slice(0, 3).map((tx, idx) => (
                <div key={tx.id} className={`flex items-center justify-between p-5 ${idx !== 2 && idx !== transactions.length - 1 ? 'border-b border-white/5' : ''}`}>
                  <div className="flex items-center gap-4 text-right">
                    <div className="w-12 h-12 rounded-[20px] bg-white/[0.02] border border-white/5 flex items-center justify-center shrink-0 shadow-inner">
                      {tx.type === 'deposit' ? <ArrowDownLeft size={18} className="text-white/80" /> : <ArrowUpRight size={18} className="text-white/40" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-white text-[14px] font-black">{tx.description}</span>
                      <span className="text-white/40 text-[10px] font-bold mt-1 tracking-widest" dir="ltr">{new Date(tx.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute:'2-digit' })}</span>
                    </div>
                  </div>
                  <span className={`font-black text-[18px] ${tx.type === 'deposit' ? 'text-[#00d4ff]' : 'text-white/50'}`} dir="ltr">
                    {tx.type === 'deposit' ? '+' : '-'}{tx.amount}
                  </span>
                </div>
              ))}
              
              {transactions.length > 3 && (
                <button
                  onClick={() => { triggerFeedback('pop'); setShowAllTx(true); }}
                  className="w-full p-5 border-t border-white/5 bg-white/[0.01] hover:bg-white/[0.04] active:bg-white/[0.06] transition-all flex items-center justify-center gap-2 text-white/50 text-[11px] font-black uppercase tracking-widest"
                >
                  הצג את כל הפעולות ({transactions.length}) <ChevronDown size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 text-white/20 mt-2 mb-8 relative z-10">
        <ShieldCheck size={14} />
        <span className="text-[9px] font-black uppercase tracking-widest">עסקאות מאובטחות מוצפנות</span>
      </div>

      {/* ================= בוטום שיט: היסטוריית פעולות ================= */}
      <AnimatePresence>
        {showAllTx && (
          <div className="fixed inset-0 z-[99999] flex flex-col justify-end" dir="rtl">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAllTx(false)} />
            
            <motion.div
              drag="y"
              dragControls={historyDragControls}
              dragListener={false}
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(e, { offset, velocity }) => { if (offset.y > 100 || velocity.y > 400) setShowAllTx(false); }}
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-[#0A0A0A] border-t border-white/10 rounded-t-[36px] h-[90vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative z-10 overflow-hidden"
            >
              <div 
                className="w-full flex flex-col items-center pt-5 pb-4 cursor-grab active:cursor-grabbing bg-white/[0.02]"
                onPointerDown={(e) => historyDragControls.start(e)}
                style={{ touchAction: "none" }}
              >
                <div className="w-16 h-1.5 bg-white/20 rounded-full mb-4 pointer-events-none"></div>
                <div className="px-6 pb-2 flex items-center justify-start w-full">
                  <h3 className="text-[16px] font-black text-white">היסטוריית פעולות ({transactions.length})</h3>
                </div>
              </div>
              
              <div 
                className="flex-1 overflow-y-auto p-4 flex flex-col scrollbar-hide touch-pan-y"
                onPointerDown={(e) => { if (e.currentTarget.scrollTop > 0) e.stopPropagation(); }}
                onTouchStart={(e) => { if (e.currentTarget.scrollTop > 0) e.stopPropagation(); }}
              >
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-4 border-b border-white/5">
                    <div className="flex items-center gap-4 text-right">
                      <div className="w-12 h-12 rounded-[20px] bg-white/[0.02] border border-white/5 flex items-center justify-center shrink-0 shadow-inner">
                        {tx.type === 'deposit' ? <ArrowDownLeft size={18} className="text-white/80" /> : <ArrowUpRight size={18} className="text-white/40" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white text-[15px] font-black">{tx.description}</span>
                        <span className="text-white/40 text-[10px] font-bold mt-1 tracking-widest" dir="ltr">{new Date(tx.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute:'2-digit' })}</span>
                      </div>
                    </div>
                    <span className={`font-black text-[18px] ${tx.type === 'deposit' ? 'text-[#00d4ff]' : 'text-white/50'}`} dir="ltr">
                      {tx.type === 'deposit' ? '+' : '-'}{tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= בוטום שיט: אישור רכישה ================= */}
      <AnimatePresence>
        {selectedPackage && (
          <div className="fixed inset-0 z-[99999] flex flex-col justify-end" dir="rtl">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closePaymentSheet} />
            
            <motion.div
              drag="y"
              dragControls={paymentDragControls}
              dragListener={false}
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(e, { offset, velocity }) => { if (offset.y > 100 || velocity.y > 400) closePaymentSheet(); }}
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-[#0A0A0A] border-t border-white/10 rounded-t-[36px] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative z-10 pb-12 overflow-hidden"
            >
              <div 
                className="w-full flex flex-col items-center pt-5 pb-4 cursor-grab active:cursor-grabbing bg-white/[0.02]"
                onPointerDown={(e) => paymentDragControls.start(e)}
                style={{ touchAction: "none" }}
              >
                <div className="w-16 h-1.5 bg-white/20 rounded-full mb-4 pointer-events-none"></div>
                <div className="flex justify-start items-center w-full px-6">
                  <h2 className="text-[16px] font-black text-white">רכישת קרדיטים</h2>
                </div>
              </div>
              
              <div 
                className="p-6 flex flex-col items-center text-center gap-6 overflow-y-auto scrollbar-hide"
                onPointerDown={(e) => { if (e.currentTarget.scrollTop > 0) e.stopPropagation(); }}
                onTouchStart={(e) => { if (e.currentTarget.scrollTop > 0) e.stopPropagation(); }}
              >
                <div className="w-20 h-20 rounded-[28px] bg-[#00d4ff]/10 border-2 border-[#00d4ff]/30 flex items-center justify-center shadow-[0_0_30px_rgba(0,212,255,0.2)]">
                  <SmartphoneNfc size={32} className="text-[#00d4ff]" />
                </div>
                
                <div>
                  <p className="text-white/50 text-[13px] font-medium mt-2">הוספת {selectedPackage.amount} CRD לארנק שלך בחנות האפליקציות.</p>
                </div>
                
                <div className="w-full bg-white/[0.03] border border-white/5 rounded-[24px] p-5 flex flex-col gap-4 shadow-inner">
                  <div className="flex justify-between items-center pb-4 border-b border-white/5">
                    <span className="text-white/50 text-[11px] font-black uppercase tracking-widest">פריט</span>
                    <span className="text-white font-black text-[16px]">{selectedPackage.amount} CRD</span>
                  </div>
                  {selectedPackage.discount && selectedPackage.discount > 0 ? (
                    <div className="flex justify-between items-center pb-4 border-b border-white/5">
                      <span className="text-white/50 text-[11px] font-black uppercase tracking-widest">הנחה</span>
                      <span className="text-[#00d4ff] font-black text-[14px]">{selectedPackage.discount}% חיסכון</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-white/50 text-[11px] font-black uppercase tracking-widest">סה"כ לתשלום</span>
                    <span className="text-[#00d4ff] font-black text-2xl">₪{selectedPackage.price}</span>
                  </div>
                </div>
                
                <div className="w-full flex flex-col gap-4 mt-2">
                  <Button
                    onClick={processNativePayment}
                    disabled={adding}
                    className="w-full h-14 bg-white text-black font-black text-[14px] uppercase tracking-widest rounded-[20px] flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all active:scale-95 disabled:opacity-50"
                  >
                    {adding ? <Loader2 size={24} className="animate-spin text-black/50" /> : 'אשר רכישה'}
                  </Button>
                  
                  <div className="flex items-center justify-center gap-4 text-white/30 text-[10px] font-black uppercase tracking-widest mt-2">
                    <span className="flex items-center gap-1"> Pay</span>
                    <span className="w-1 h-1 bg-white/10 rounded-full"></span>
                    <span className="flex items-center gap-1">G Pay</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </FadeIn>
  );
};
