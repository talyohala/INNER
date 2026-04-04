import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Star,
  ShieldCheck,
  Flame,
  Radio,
  RefreshCw,
  ChevronLeft,
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

  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingBalance, setRefreshingBalance] = useState(false);
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);

  const items: StoreItem[] = useMemo(
    () => [
      { id: 1, title: 'הודעת זהב', desc: 'הודעה בולטת בלובי ל-24 שעות', price: 150, icon: MessageSquare, color: '#ffc107', badge: 'פופולרי' },
      { id: 2, title: 'תג CORE', desc: 'תג סטטוס יוקרתי ליד השם שלך', price: 500, icon: Crown, color: '#a855f7' },
      { id: 3, title: 'מצב רפאים', desc: 'כניסה שקטה לקהילות בלי למשוך תשומת לב', price: 300, icon: Ghost, color: '#94a3b8' },
      { id: 4, title: 'שם ניאון', desc: 'השם שלך זוהר למשך 7 ימים', price: 800, icon: Sparkles, color: '#2196f3', badge: 'חדש' },
      { id: 5, title: 'בוסט רדאר', desc: 'דחיפה של הקהילה שלך בחיפוש', price: 1500, icon: Radio, color: '#f43f5e' },
      { id: 6, title: 'נעץ שיחה', desc: 'הודעה מוצמדת בראש הקהילה', price: 400, icon: Pin, color: '#10b981' },
      { id: 7, title: 'מגן פרופיל', desc: 'סטטוס בולט לפרופיל שלך', price: 950, icon: ShieldCheck, color: '#0ea5e9' },
      { id: 8, title: 'חם עכשיו', desc: 'דחיפת חשיפה מהירה לתוכן שלך', price: 1200, icon: Flame, color: '#f97316' },
    ],
    []
  );

  const fetchWalletBalance = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshingBalance(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user?.id) return;

      const data = await apiFetch<any>('/api/wallet', { headers: { 'x-user-id': authData.user.id } });
      setBalance(Number(data?.credits || 0));
    } catch {
      setBalance(0);
    } finally {
      setLoading(false);
      setRefreshingBalance(false);
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
      await new Promise(r => setTimeout(r, 1200));
      setBalance(prev => (prev !== null ? prev - item.price : prev));
      triggerFeedback('coin');
      toast.success(`רכשת את ${item.title}!`);
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
    <FadeIn className="px-0 pt-8 pb-32 bg-[#030303] min-h-screen font-sans relative overflow-x-hidden" dir="rtl">
      
      {/* Background Glows */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-15%] w-[60%] h-[30%] bg-[#2196f3]/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] left-[-10%] w-[50%] h-[20%] bg-[#a855f7]/5 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 px-4">
        
        {/* Header - Centered as before, without Zap */}
        <div className="flex flex-col items-center text-center mb-8 pt-4">
          <h1 className="text-[26px] font-black text-white tracking-tighter uppercase">STORE</h1>
          <span className="text-white/30 text-[10px] font-black tracking-[0.18em] uppercase mt-1">Boosts & Status</span>
        </div>

        {/* Wallet Balance Card - Edge to Edge, Luxury Design */}
        <div className="mb-8 w-full bg-[#0A0A0A] border border-white/5 rounded-[32px] p-7 shadow-2xl relative overflow-hidden">
          <div className="flex justify-between items-start relative z-10">
            <div className="flex flex-col gap-1">
              <span className="text-white/40 text-[10px] font-black uppercase tracking-widest text-right">היתרה שלך</span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black tabular-nums tracking-tighter">{balance?.toLocaleString()}</span>
                <span className="text-xs font-black text-[#ffc107]">CRD</span>
              </div>
            </div>
            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 shadow-inner">
              <Wallet className="text-[#ffc107]" size={28} />
            </div>
          </div>
          <div className="mt-6 flex gap-3 relative z-10">
            <Button onClick={() => navigate('/wallet')} className="flex-1 h-12 bg-white text-black rounded-2xl font-black text-[11px] tracking-widest uppercase shadow-[0_10px_20px_rgba(255,255,255,0.1)] active:scale-95 transition-all">
              טען ארנק
            </Button>
            <button onClick={() => fetchWalletBalance(true)} className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 active:scale-90">
              <RefreshCw size={18} className={`text-white/60 ${refreshingBalance ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="px-1 mb-5 flex items-center justify-between">
          <h2 className="text-[15px] font-black tracking-tight text-white/90">בחר בוסט פרימיום</h2>
          <span className="text-white/20 text-[10px] font-black uppercase tracking-wider">Premium</span>
        </div>

        {/* Store Grid - 2 columns as before, but luxury style */}
        <div className="grid grid-cols-2 gap-4">
          {items.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              onClick={() => setSelectedItem(item)}
              className="group cursor-pointer h-full"
            >
              <div className="h-full rounded-[30px] bg-[#0A0A0A] border border-white/5 p-5 flex flex-col active:scale-95 transition-transform shadow-lg hover:border-white/10">
                <div className="flex items-start justify-between mb-5">
                  <div 
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner relative"
                    style={{ backgroundColor: `${item.color}15`, border: `1px solid ${item.color}30` }}
                  >
                    <item.icon size={24} style={{ color: item.color }} />
                  </div>
                  {item.badge && (
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest uppercase text-white/70 bg-white/5 border border-white/5">
                      {item.badge}
                    </span>
                  )}
                </div>

                <div className="text-right flex-1">
                  <h3 className="text-white font-black text-[14px] leading-tight min-h-[34px] tracking-tight">{item.title}</h3>
                  <p className="text-white/40 text-[10px] font-bold leading-relaxed mt-1.5 min-h-[32px] line-clamp-2">{item.desc}</p>
                </div>

                <div className="mt-5 pt-4 border-t border-white/5">
                  <div className="mb-3 text-right">
                    <span className="text-white font-black text-[22px] tracking-tighter tabular-nums" dir="ltr">{item.price.toLocaleString()}</span>
                    <span className="text-white/30 text-[10px] font-black mr-1">CRD</span>
                  </div>
                  <Button className={`w-full h-11 rounded-2xl font-black text-[11px] tracking-widest uppercase ${
                    balance !== null && balance >= item.price ? 'bg-white text-black' : 'bg-white/5 text-white/30'
                  }`}>
                    {balance !== null && balance >= item.price ? 'רכישה' : 'חסר'}
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Checkout Modal - z-[9999999] */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedItem(null)}/>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", damping: 25, stiffness: 350 }} className="relative z-10 bg-[#0A0A0A] rounded-t-[40px] p-8 pb-12 border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)]">
              <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
              <div className="flex flex-col items-center text-center gap-4 mb-8">
                <div className="w-20 h-20 bg-white/5 rounded-[24px] flex items-center justify-center text-3xl shadow-inner border border-white/5">
                  <selectedItem.icon size={36} style={{ color: selectedItem.color }} />
                </div>
                <h3 className="text-2xl font-black">אישור פעולה</h3>
                <p className="text-white/50 font-medium">האם ברצונך לרכוש את <span className="text-white font-bold">{selectedItem.title}</span>?</p>
              </div>
              <div className="bg-white/5 rounded-[24px] p-5 border border-white/5 flex justify-between items-center mb-8 tabular-nums">
                <span className="text-white/40 font-bold uppercase tracking-widest text-xs">סה"כ לתשלום</span>
                <span className="text-2xl font-black text-[#ffc107]">{selectedItem.price.toLocaleString()} CRD</span>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => handleBuy(selectedItem)} disabled={buyingId === selectedItem.id} className="flex-1 h-16 bg-white text-black rounded-full font-black text-lg active:scale-95 shadow-2xl">
                  {buyingId === selectedItem.id ? <Loader2 size={18} className="animate-spin" /> : 'אשר קנייה'}
                </Button>
                <button onClick={() => setSelectedItem(null)} className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-white/10 active:scale-90"><X size={24} /></button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </FadeIn>
  );
};
