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
  X,
  ArrowRight
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
      { id: 3, title: 'מצב רפאים', desc: 'כניסה שקטה בלי למשוך תשומת לב', price: 300, icon: Ghost, color: '#94a3b8' },
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

      const data = await apiFetch<any>('/api/wallet', {
        headers: { 'x-user-id': authData.user.id },
      });

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
    <FadeIn className="px-4 pt-8 pb-32 bg-[#030303] min-h-screen font-sans relative overflow-x-hidden" dir="rtl">
      
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-5%] right-[-10%] w-[50%] h-[20%] bg-white/5 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10">
        
        {/* Header - Hebrew Only, No Description, No Zap */}
        <div className="flex flex-col items-center text-center mb-8 pt-4">
          <h1 className="text-[26px] font-black text-white tracking-tight">החנות</h1>
        </div>

        {/* Balance Card */}
        <div className="mb-6 rounded-[32px] bg-white/[0.04] border border-white/5 backdrop-blur-2xl p-6 shadow-[0_15px_35px_rgba(0,0,0,0.3)]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shadow-inner">
                <Wallet size={20} className="text-white/70" />
              </div>
              <div className="text-right">
                <span className="text-white font-black text-[15px] block leading-none">היתרה שלך</span>
                <span className="text-white/30 text-[9px] font-bold tracking-widest uppercase mt-1 block">Live Wallet</span>
              </div>
            </div>

            <div className="text-left">
              <span className="text-white font-black text-[30px] leading-none tracking-tighter block" dir="ltr">
                {balance?.toLocaleString()}
              </span>
              <span className="text-white/30 text-[10px] font-black tracking-widest uppercase block mt-1" dir="ltr">
                CRD
              </span>
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <Button
              onClick={() => { triggerFeedback('pop'); navigate('/wallet'); }}
              className="flex-1 h-12 rounded-[20px] bg-white text-black font-black text-[11px] tracking-widest uppercase shadow-xl"
            >
              טען ארנק
            </Button>
            <button
              onClick={() => { triggerFeedback('pop'); fetchWalletBalance(true); }}
              className="w-12 h-12 rounded-[20px] bg-white/5 flex items-center justify-center border border-white/10 active:scale-90 transition-all"
            >
              <RefreshCw size={16} className={`text-white/60 ${refreshingBalance ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Store Grid - 2 columns */}
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
              <div className="h-full rounded-[30px] bg-white/[0.03] border border-white/5 backdrop-blur-md p-5 flex flex-col active:scale-95 transition-transform shadow-lg">
                <div className="flex items-start justify-between mb-5">
                  <div 
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner"
                    style={{ backgroundColor: `${item.color}15`, border: `1px solid ${item.color}30` }}
                  >
                    <item.icon size={24} style={{ color: item.color }} />
                  </div>
                  {item.badge && (
                    <span className="px-2 py-0.5 rounded-lg text-[8px] font-black tracking-tighter uppercase text-white/80 bg-white/10 border border-white/5">
                      {item.badge}
                    </span>
                  )}
                </div>

                <div className="text-right flex-1">
                  <h3 className="text-white font-black text-[14px] leading-tight tracking-tight min-h-[34px]">{item.title}</h3>
                  <p className="text-white/35 text-[10px] font-bold leading-tight mt-1.5 line-clamp-2">{item.desc}</p>
                </div>

                <div className="mt-5">
                  <div className="mb-3 text-right">
                    <span className="text-white font-black text-[20px] tracking-tight" dir="ltr">{item.price.toLocaleString()}</span>
                    <span className="text-white/30 text-[9px] font-black mr-1">CRD</span>
                  </div>

                  <Button
                    className={`w-full h-10 rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all ${
                      balance !== null && balance >= item.price
                        ? 'bg-white text-black'
                        : 'bg-white/5 text-white/20'
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

      {/* Purchase Modal - Bottom Sheet */}
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
                <h3 className="text-2xl font-black text-white">אישור רכישה</h3>
                <p className="text-white/50 font-medium">האם אתה בטוח שברצונך לרכוש את <span className="text-white font-bold">{selectedItem.title}</span>?</p>
              </div>

              <div className="bg-white/5 rounded-[24px] p-5 border border-white/5 flex justify-between items-center mb-8">
                <span className="text-white/40 font-bold uppercase tracking-widest text-[10px]">מחיר סופי</span>
                <span className="text-2xl font-black text-[#ffc107] tabular-nums">{selectedItem.price.toLocaleString()} CRD</span>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => handleBuy(selectedItem)} disabled={buyingId === selectedItem.id} className="flex-1 h-16 bg-white text-black rounded-full font-black text-lg active:scale-95 shadow-2xl">
                  {buyingId === selectedItem.id ? <Loader2 size={20} className="animate-spin" /> : 'אשר ושלם'}
                </Button>
                <button onClick={() => setSelectedItem(null)} className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-white/10 active:scale-90"><X size={24} className="text-white" /></button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </FadeIn>
  );
};
