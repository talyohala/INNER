import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  Crown,
  MessageSquare,
  Wallet,
  Ghost,
  Sparkles,
  Pin,
  ShieldCheck,
  Flame,
  Radio,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

type StoreItem = {
  id: number;
  title: string;
  desc: string;
  price: number;
  icon: any;
  color: string;
  badge?: string;
};

export const BoostStorePage: React.FC = () => {
  const navigate = useNavigate();

  const [mounted, setMounted] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);

  // מוודאים שהעמוד נטען לפני שימוש ב-Portal
  useEffect(() => {
    setMounted(true);
  }, []);

  const items: StoreItem[] = useMemo(
    () => [
      { id: 1, title: 'הודעת זהב', desc: 'הודעה בולטת בלובי ל-24 שעות', price: 150, icon: MessageSquare, color: '#f59e0b', badge: 'פופולרי' },
      { id: 2, title: 'תג CORE', desc: 'תג יוקרתי ליד השם שלך', price: 500, icon: Crown, color: '#a855f7' },
      { id: 3, title: 'מצב רפאים', desc: 'כניסה שקטה בלי למשוך תשומת לב', price: 300, icon: Ghost, color: '#94a3b8' },
      { id: 4, title: 'שם ניאון', desc: 'השם שלך זוהר למשך 7 ימים', price: 800, icon: Sparkles, color: '#2196f3', badge: 'חדש' },
      { id: 5, title: 'בוסט רדאר', desc: 'דחיפה של הקהילה שלך בחיפוש', price: 1500, icon: Radio, color: '#f43f5e' },
      { id: 6, title: 'נעץ שיחה', desc: 'הודעה מוצמדת בראש הקהילה', price: 400, icon: Pin, color: '#10b981' },
      { id: 7, title: 'מגן פרופיל', desc: 'סטטוס בולט לפרופיל שלך', price: 950, icon: ShieldCheck, color: '#0ea5e9' },
      { id: 8, title: 'חם עכשיו', desc: 'דחיפת חשיפה לתוכן שלך', price: 1200, icon: Flame, color: '#f97316' },
    ],
    []
  );

  const fetchWalletBalance = useCallback(async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user?.id) return;

      const data = await apiFetch<any>('/api/wallet', {
        headers: { 'x-user-id': authData.user.id },
      });

      setBalance(Number(data?.credits || 0));
    } catch {
      setBalance(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWalletBalance(); }, [fetchWalletBalance]);

  const handleBuy = async (item: StoreItem) => {
    triggerFeedback('pop');
    if (balance !== null && balance < item.price) {
      triggerFeedback('error');
      toast.error('אין לך מספיק CRD בארנק');
      return;
    }
    setBuyingId(item.id);
    try {
      await new Promise(r => setTimeout(r, 1100));
      setBalance(prev => (prev !== null ? prev - item.price : prev));
      triggerFeedback('coin');
      toast.success(`רכשת את ${item.title}`);
      setSelectedItem(null);
    } catch {
      toast.error('הרכישה נכשלה');
    } finally {
      setBuyingId(null);
    }
  };

  const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

  if (loading) return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center">
      <Loader2 className="animate-spin text-white/20" />
    </div>
  );

  return (
    <>
      <FadeIn className="px-0 pt-10 pb-32 bg-[#030303] min-h-screen font-sans relative overflow-x-hidden" dir="rtl">
        
        {/* Background Effects */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-5%] right-[-10%] w-[50%] h-[20%] bg-white/5 blur-[100px] rounded-full" />
        </div>

        <div className="relative z-10 px-4 w-full">
          
          {/* Header */}
          <div className="flex justify-center items-center mb-8 h-12">
            <h1 className="text-[28px] font-black text-white tracking-tighter">החנות</h1>
          </div>

          {/* Balance Card - Dark Transparent Gray */}
          <div className="mb-8 rounded-[32px] bg-white/[0.04] backdrop-blur-xl border border-white/5 p-8 shadow-2xl overflow-hidden relative flex flex-col items-center text-center">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#ffc107]/5 blur-3xl rounded-full pointer-events-none" />
            
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shadow-inner mb-4 relative z-10">
              <Wallet size={20} className="text-[#ffc107]" />
            </div>
            
            <span className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1 relative z-10">היתרה שלך</span>
            
            <div className="flex items-baseline gap-2 mb-6 relative z-10">
              <span className="text-5xl font-black tabular-nums tracking-tighter text-white leading-none" dir="ltr">
                {balance?.toLocaleString()}
              </span>
              <span className="text-[#ffc107] text-[12px] font-black tracking-widest uppercase leading-none" dir="ltr">
                CRD
              </span>
            </div>

            <Button
              onClick={() => { triggerFeedback('pop'); navigate('/wallet'); }}
              className="w-full h-14 rounded-2xl bg-white text-black font-black text-[12px] tracking-widest uppercase shadow-[0_10px_20px_rgba(255,255,255,0.1)] active:scale-95 transition-all relative z-10"
            >
              טען ארנק
            </Button>
          </div>

          {/* Store Grid - Dark Transparent Gray Cards */}
          <div className="grid grid-cols-2 gap-4">
            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={() => setSelectedItem(item)}
                className="h-full"
              >
                <div className="h-full rounded-[32px] bg-white/[0.04] backdrop-blur-xl border border-white/5 p-5 flex flex-col items-center text-center active:scale-95 transition-transform shadow-lg relative overflow-hidden group">
                  
                  {/* Background Tint on Hover */}
                  <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-[0.05] transition-opacity duration-500 pointer-events-none" 
                    style={{ backgroundColor: item.color }}
                  />

                  {item.badge && (
                    <span className="absolute top-4 right-4 px-2.5 py-1 rounded-lg text-[8px] font-black tracking-tighter uppercase text-white/80 bg-white/10 border border-white/5 shadow-sm z-10">
                      {item.badge}
                    </span>
                  )}

                  <div 
                    className="w-14 h-14 rounded-full flex items-center justify-center shadow-inner mt-2 mb-4 relative z-10"
                    style={{ backgroundColor: `${item.color}15`, border: `1px solid ${item.color}30` }}
                  >
                    <item.icon size={26} style={{ color: item.color }} />
                  </div>

                  <div className="flex-1 relative z-10 flex flex-col items-center">
                    <h3 className="text-white font-black text-[15px] leading-tight tracking-tight mb-1.5">{item.title}</h3>
                    <p className="text-white/40 text-[10px] font-bold leading-snug line-clamp-2 px-1">{item.desc}</p>
                  </div>

                  <div className="mt-5 w-full relative z-10">
                    <div className="mb-4 flex items-baseline justify-center gap-1">
                      <span className="text-white font-black text-[24px] tracking-tighter tabular-nums leading-none" dir="ltr">{item.price.toLocaleString()}</span>
                      <span className="text-white/30 text-[10px] font-black leading-none">CRD</span>
                    </div>

                    <Button
                      className={`w-full h-11 rounded-2xl font-black text-[11px] tracking-widest uppercase transition-all ${
                        balance !== null && balance >= item.price
                          ? 'bg-white text-black shadow-md'
                          : 'bg-white/5 text-white/30 border border-white/5'
                      }`}
                    >
                      {balance !== null && balance >= item.price ? 'רכישה' : 'חסר'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Safe Portal for Bottom Sheet - Escapes all stacking contexts and z-index traps */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedItem && (
            <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl" onTouchStart={stopPropagation} style={{ touchAction: 'none' }}>
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
                onClick={() => setSelectedItem(null)}
              />
              <motion.div 
                initial={{ y: '100%' }} 
                animate={{ y: 0 }} 
                exit={{ y: '100%' }} 
                transition={{ type: "spring", damping: 25, stiffness: 350 }} 
                className="relative z-10 bg-[#0A0A0A] rounded-t-[40px] p-6 pb-10 border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)]"
              >
                <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
                
                <div className="flex flex-col items-center text-center gap-4 mb-8">
                  <div 
                    className="w-20 h-20 rounded-[24px] flex items-center justify-center text-3xl shadow-inner border border-white/10"
                    style={{ backgroundColor: `${selectedItem.color}15` }}
                  >
                    <selectedItem.icon size={36} style={{ color: selectedItem.color }} />
                  </div>
                  <h3 className="text-2xl font-black text-white">אישור רכישה</h3>
                  <p className="text-white/50 font-medium text-sm">האם ברצונך לשלם ולרכוש את <span className="text-white font-bold">{selectedItem.title}</span>?</p>
                </div>

                <div className="bg-white/[0.04] rounded-[24px] p-5 border border-white/5 flex justify-between items-center mb-8">
                  <span className="text-white/40 font-bold uppercase tracking-widest text-[10px]">מחיר סופי</span>
                  <div className="flex items-baseline gap-1">
                     <span className="text-2xl font-black text-[#ffc107] tabular-nums leading-none">{selectedItem.price.toLocaleString()}</span>
                     <span className="text-[#ffc107]/50 text-[10px] font-black">CRD</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => handleBuy(selectedItem)} disabled={buyingId === selectedItem.id} className="flex-1 h-14 bg-white text-black rounded-2xl font-black text-lg active:scale-95 shadow-xl">
                    {buyingId === selectedItem.id ? <Loader2 size={20} className="animate-spin" /> : 'אשר ושלם'}
                  </Button>
                  <button onClick={() => setSelectedItem(null)} className="w-14 h-14 bg-[#111] rounded-2xl flex items-center justify-center border border-white/10 active:scale-90">
                    <X size={24} className="text-white/70" />
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
