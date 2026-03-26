import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Lock, Loader2, ArrowDownLeft, ArrowUpRight, ArrowRight, Zap, CreditCard, Gift, History, ShieldCheck, SmartphoneNfc, ChevronDown } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { FadeIn, GlassCard, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

export const WalletPage: React.FC = () => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  
  const [selectedPackage, setSelectedPackage] = useState<{ amount: number, price: number, id: string } | null>(null);
  const [showAllTx, setShowAllTx] = useState(false);

  const fetchWallet = async () => {
    try {
      const data = await apiFetch<any>('/api/wallet');
      setBalance(data.credits || 0);
      setTransactions(data.transactions || []);
    } catch (err) {
      toast.error('שגיאה בטעינת הארנק');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWallet(); }, []);

  const openPaymentSheet = (pkg: { amount: number, price: number, id: string }) => {
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
    
    const tid = toast.loading(`מעבד תשלום מאובטח...`);
    
    setTimeout(async () => {
      try {
        const data = await apiFetch<any>('/api/wallet/add', {
          method: 'POST',
          body: JSON.stringify({ amount: selectedPackage.amount })
        });
        setBalance(data.newBalance);
        await fetchWallet();
        toast.success(`רכשת ${selectedPackage.amount} CRD בהצלחה! 💸`, { id: tid });
        triggerFeedback('success');
      } catch (err) {
        toast.error('התשלום נכשל', { id: tid });
        triggerFeedback('error');
      } finally {
        setAdding(false);
        setSelectedPackage(null);
      }
    }, 1500);
  };

  const PACKAGES = [
    { id: 'crd_100', amount: 100, price: 10, popular: false },
    { id: 'crd_500', amount: 500, price: 45, popular: true },
    { id: 'crd_1200', amount: 1200, price: 100, popular: false }
  ];

  if (loading) return <div className="min-h-screen bg-[#030303] flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  return (
    <FadeIn className="px-5 pt-8 pb-32 bg-[#030303] min-h-screen font-sans flex flex-col gap-6 relative" dir="rtl">
      
      {/* כותרת וניווט חזור */}
      <div className="flex items-center justify-between relative z-10 mb-2">
        <div className="w-10"></div>
        <div className="flex flex-col items-center">
          <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Wallet size={18} className="text-white/60" /> הארנק שלי
          </h1>
        </div>
        <button onClick={() => { triggerFeedback('pop'); navigate(-1); }} className="w-10 h-10 flex items-center justify-center text-white/30 hover:text-white transition-colors bg-white/5 rounded-full shadow-inner active:scale-90">
          <ArrowRight size={18} />
        </button>
      </div>

      {/* כרטיס יתרה ענק - Black Card VIP Effect (עם תאורה עדינה) */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
      >
        <GlassCard className="bg-[#0A0A0A] border border-white/5 p-8 rounded-[32px] flex flex-col items-center text-center shadow-[0_20px_50px_rgba(0,0,0,0.9)] relative overflow-hidden z-10">
          {/* אפקטים של תאורה אחורית בכרטיס (עדין מאוד ויוקרתי) */}
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-green-500/10 blur-[70px] rounded-full pointer-events-none"></div>
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-purple-500/10 blur-[70px] rounded-full pointer-events-none"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-yellow-500/5 blur-[80px] rounded-full pointer-events-none"></div>

          {/* תג VIP קטן בפינה */}
          <div className="absolute top-5 left-6 opacity-30 flex items-center gap-1">
             <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white">VIP MEMBER</span>
          </div>

          <span className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2 z-10 mt-2">יתרת קרדיטים זמינה</span>
          
          <div className="flex flex-col items-center justify-center mt-2 mb-6 z-10 relative">
            <span className="text-7xl font-black text-white tracking-tighter drop-shadow-2xl">{balance.toLocaleString()}</span>
            <span className="text-xs font-black text-green-400 uppercase tracking-[0.3em] mt-2 drop-shadow-[0_0_15px_rgba(74,222,128,0.4)] bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">
              CRD COIN
            </span>
          </div>
        </GlassCard>
      </motion.div>

      {/* אזור טעינה (Quick Buy) */}
      <div className="flex flex-col gap-3 z-10 mt-4">
        <h3 className="text-white/40 text-[10px] font-black tracking-[0.2em] uppercase text-right px-2 flex items-center gap-1.5">
          <Zap size={12} className="text-green-400" /> טעינה מהירה
        </h3>
        
        <div className="grid grid-cols-3 gap-3">
          {PACKAGES.map((pkg, idx) => (
            <button
              key={idx}
              onClick={() => openPaymentSheet(pkg)}
              className={`relative flex flex-col items-center justify-center gap-1 h-24 rounded-2xl transition-all active:scale-95 overflow-hidden shadow-lg ${
                pkg.popular 
                  ? 'bg-gradient-to-br from-[#111] to-[#1a1a1a] border border-green-500/30' 
                  : 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.04]'
              }`}
            >
              {pkg.popular && (
                <div className="absolute top-0 w-full bg-green-500/10 text-green-400 text-[8px] font-black uppercase tracking-widest py-1 text-center backdrop-blur-md border-b border-green-500/20">
                  משתלם
                </div>
              )}
              <span className={`text-xl font-black mt-2 ${pkg.popular ? 'text-green-400' : 'text-white'}`}>{pkg.amount}</span>
              <span className="text-white/30 text-[10px] font-bold tracking-wider">₪{pkg.price}</span>
            </button>
          ))}
        </div>
      </div>

      {/* באנר משיכת כספים נעול */}
      <GlassCard className="bg-white/[0.02] border border-white/5 p-4 rounded-[24px] flex items-center justify-between z-10 shadow-lg mt-2">
        <div className="flex items-center gap-4 text-right">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
            <Lock size={16} className="text-white/30" />
          </div>
          <div>
            <h3 className="text-white font-black text-sm">משיכת כספים ליוצרים</h3>
            <p className="text-white/40 text-[9px] font-bold mt-1 uppercase tracking-widest">פיצ'ר זה ייפתח למשתמשי PRO</p>
          </div>
        </div>
      </GlassCard>

      {/* היסטוריית פעולות המקוצרת */}
      <div className="flex flex-col gap-3 mt-4 z-10">
        <h3 className="text-white/40 text-[10px] font-black tracking-[0.2em] uppercase text-right px-2 flex items-center gap-1.5">
          <History size={12} /> פעולות אחרונות
        </h3>
        
        <GlassCard className="bg-white/[0.01] backdrop-blur-md border border-white/5 rounded-[28px] shadow-xl overflow-hidden">
          {transactions.length === 0 ? (
            <div className="py-12 text-center text-white/20 text-[10px] font-black uppercase tracking-widest flex flex-col items-center gap-3">
              <History size={24} className="opacity-20" />
              הארנק שלך ריק, התחל לטעון!
            </div>
          ) : (
            <div className="flex flex-col">
              {/* מציגים רק את ה-3 הראשונות */}
              {transactions.slice(0, 3).map((tx, idx) => (
                <div key={tx.id} className={`flex items-center justify-between p-4 ${idx !== 2 && idx !== transactions.length - 1 ? 'border-b border-white/5' : ''}`}>
                  <div className="flex items-center gap-4 text-right">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-inner ${
                      tx.type === 'deposit' ? 'bg-green-500/5 border border-green-500/20' : 'bg-white/[0.03] border border-white/10'
                    }`}>
                      {tx.type === 'deposit' ? <ArrowDownLeft size={16} className="text-green-400" /> : <ArrowUpRight size={16} className="text-white/40" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-white/90 text-sm font-black">{tx.description}</span>
                      <span className="text-white/30 text-[9px] font-bold mt-1 tracking-widest" dir="ltr">{new Date(tx.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute:'2-digit' })}</span>
                    </div>
                  </div>
                  <span className={`font-black text-lg ${tx.type === 'deposit' ? 'text-green-400' : 'text-white/50'}`} dir="ltr">
                    {tx.type === 'deposit' ? '+' : '-'}{tx.amount}
                  </span>
                </div>
              ))}
              
              {/* כפתור "הצג הכל" אם יש יותר מ-3 פעולות */}
              {transactions.length > 3 && (
                <button 
                  onClick={() => { triggerFeedback('pop'); setShowAllTx(true); }}
                  className="w-full p-4 border-t border-white/5 bg-white/[0.02] hover:bg-white/[0.05] active:bg-white/[0.08] transition-all flex items-center justify-center gap-2 text-white/50 text-[10px] font-black uppercase tracking-widest"
                >
                  הצג את כל הפעולות ({transactions.length}) <ChevronDown size={14} />
                </button>
              )}
            </div>
          )}
        </GlassCard>
      </div>

      <div className="flex items-center justify-center gap-1.5 text-white/20 mt-4 mb-8">
        <ShieldCheck size={12} />
        <span className="text-[8px] font-black uppercase tracking-widest">עסקאות מאובטחות מוצפנות</span>
      </div>

      {/* ================= מגירת כל הקבלות (Full Screen Bottom Sheet) ================= */}
      <AnimatePresence>
        {showAllTx && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-md"
          >
            <div className="absolute inset-0" onClick={() => setShowAllTx(false)}></div>
            
            <motion.div 
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.8 }}
              onDragEnd={(e, { offset, velocity }) => {
                if (offset.y > 100 || velocity.y > 500) setShowAllTx(false);
              }}
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-[#0A0A0A] border-t border-white/10 rounded-t-[32px] h-[90vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.9)] relative z-10"
              dir="rtl"
            >
              <div className="w-full flex justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing">
                <div className="w-16 h-1 bg-white/20 rounded-full"></div>
              </div>

              <div className="px-6 pb-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-xl font-black text-white">היסטוריית פעולות</h3>
                <span className="text-white/30 text-xs font-bold">{transactions.length} רשומות</span>
              </div>

              <div className="flex-1 overflow-y-auto p-2 scrollbar-hide overscroll-none pb-20">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-4 border-b border-white/5">
                    <div className="flex items-center gap-4 text-right">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-inner ${
                        tx.type === 'deposit' ? 'bg-green-500/5 border border-green-500/20' : 'bg-white/[0.03] border border-white/10'
                      }`}>
                        {tx.type === 'deposit' ? <ArrowDownLeft size={18} className="text-green-400" /> : <ArrowUpRight size={18} className="text-white/40" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white/90 text-sm font-black">{tx.description}</span>
                        <span className="text-white/30 text-[10px] font-bold mt-1 tracking-widest" dir="ltr">{new Date(tx.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute:'2-digit' })}</span>
                      </div>
                    </div>
                    <span className={`font-black text-xl ${tx.type === 'deposit' ? 'text-green-400' : 'text-white/50'}`} dir="ltr">
                      {tx.type === 'deposit' ? '+' : '-'}{tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= מגירת אישור תשלום (Bottom Sheet) ================= */}
      <AnimatePresence>
        {selectedPackage && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-md"
          >
            <div className="absolute inset-0" onClick={closePaymentSheet}></div>
            
            <motion.div 
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.8 }}
              onDragEnd={(e, { offset, velocity }) => {
                if (offset.y > 100 || velocity.y > 500) closePaymentSheet();
              }}
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-[#050505] border-t border-white/10 rounded-t-[32px] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative z-10 pb-12"
              dir="rtl"
            >
              <div className="w-full flex justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing">
                <div className="w-16 h-1 bg-white/20 rounded-full"></div>
              </div>

              <div className="p-6 flex flex-col items-center text-center gap-6">
                <div className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(74,222,128,0.2)]">
                  <SmartphoneNfc size={28} className="text-green-400" />
                </div>
                
                <div>
                  <h3 className="text-2xl font-black text-white mb-1">רכישת קרדיטים</h3>
                  <p className="text-white/50 text-sm">הוספת CRD לארנק שלך בחנות האפליקציות</p>
                </div>

                <div className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-center pb-3 border-b border-white/5">
                    <span className="text-white/50 text-xs font-bold">פריט</span>
                    <span className="text-white font-black text-sm">{selectedPackage.amount} CRD</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-white/50 text-xs font-bold">סה"כ לתשלום</span>
                    <span className="text-green-400 font-black text-xl">₪{selectedPackage.price}</span>
                  </div>
                </div>

                <div className="w-full flex flex-col gap-4 mt-2">
                  <Button 
                    onClick={processNativePayment}
                    disabled={adding}
                    className="w-full h-14 bg-white text-black font-black text-sm uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all active:scale-95 disabled:opacity-50"
                  >
                    {adding ? <Loader2 size={18} className="animate-spin text-black/50" /> : <>רכוש עכשיו</>}
                  </Button>
                  
                  {/* תמיכה ויזואלית בתשלומי נייטיב */}
                  <div className="flex items-center justify-center gap-4 text-white/30 text-[10px] font-black uppercase tracking-widest">
                    <span className="flex items-center gap-1"> Pay</span>
                    <span className="w-1 h-1 bg-white/10 rounded-full"></span>
                    <span className="flex items-center gap-1">G Pay</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </FadeIn>
  );
};
