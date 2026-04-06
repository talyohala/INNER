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
  X,
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
  icon: React.ComponentType<any>;
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

  useEffect(() => {
    setMounted(true);
  }, []);

  const items: StoreItem[] = useMemo(
    () => [
      { id: 1, title: 'הודעת זהב', desc: 'הודעה בולטת בלובי ל-24 שעות', price: 150, icon: MessageSquare, color: '#f59e0b', badge: 'פופולרי' },
      { id: 2, title: 'תג CORE', desc: 'תג יוקרתי ליד השם שלך', price: 500, icon: Crown, color: '#a855f7' },
      { id: 3, title: 'מצב רפאים', desc: 'כניסה שקטה בלי למשוך תשומת לב', price: 300, icon: Ghost, color: '#94a3b8' },
      { id: 4, title: 'שם ניאון', desc: 'השם שלך זוהר למשך 7 ימים', price: 800, icon: Sparkles, color: '#A1B4FE', badge: 'חדש' },
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
      if (!authData.user?.id) {
        setBalance(0);
        return;
      }

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

  useEffect(() => {
    fetchWalletBalance();
  }, [fetchWalletBalance]);

  const handleBuy = async (item: StoreItem) => {
    triggerFeedback('pop');

    if (balance !== null && balance < item.price) {
      triggerFeedback('error');
      toast.error('אין לך מספיק CRD בארנק');
      return;
    }

    setBuyingId(item.id);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1100));
      setBalance((prev) => (prev !== null ? prev - item.price : prev));
      triggerFeedback('coin');
      toast.success(`רכשת את ${item.title}`);
      setSelectedItem(null);
    } catch {
      toast.error('הרכישה נכשלה');
    } finally {
      setBuyingId(null);
    }
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
      <FadeIn className="px-4 pt-5 pb-32 bg-surface min-h-screen font-sans relative overflow-x-hidden" dir="rtl">
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-8%] right-[-10%] w-[45%] h-[18%] bg-accent-primary/10 blur-[110px] rounded-full" />
          <div className="absolute bottom-[-8%] left-[-10%] w-[38%] h-[16%] bg-white/5 blur-[120px] rounded-full" />
        </div>

        <div className="relative z-10 w-full text-center">
          <div className="mb-6 rounded-[32px] bg-surface-card border border-surface-border p-7 shadow-2xl flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-surface border border-surface-border flex items-center justify-center mb-4 shadow-inner">
              <Wallet size={20} className="text-[#ffc107]" />
            </div>

            <span className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">
              היתרה שלך
            </span>

            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-5xl font-black tabular-nums tracking-tighter text-brand leading-none" dir="ltr">
                {balance?.toLocaleString()}
              </span>
              <span className="text-[#ffc107] text-[12px] font-black tracking-widest uppercase leading-none" dir="ltr">
                CRD
              </span>
            </div>

            <Button
              onClick={() => navigate('/wallet')}
              className="w-full h-14 rounded-2xl bg-white text-black font-black text-[12px] tracking-widest uppercase shadow-xl active:scale-95"
            >
              טען ארנק
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4 text-center">
            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={() => setSelectedItem(item)}
              >
                <div className="h-full rounded-[32px] bg-surface-card border border-surface-border p-5 flex flex-col items-center active:scale-95 transition-transform shadow-lg relative overflow-hidden group">
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-[0.06] transition-opacity"
                    style={{ backgroundColor: item.color }}
                  />

                  {item.badge && (
                    <span className="absolute top-4 right-4 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase text-brand bg-white/5 border border-surface-border">
                      {item.badge}
                    </span>
                  )}

                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mt-2 mb-4 shadow-inner"
                    style={{ backgroundColor: `${item.color}15`, border: `1px solid ${item.color}30` }}
                  >
                    <item.icon size={26} style={{ color: item.color }} />
                  </div>

                  <h3 className="text-brand font-black text-[15px] leading-tight mb-1.5">{item.title}</h3>
                  <p className="text-brand-muted text-[10px] font-bold leading-snug line-clamp-2 px-1">{item.desc}</p>

                  <div className="mt-5 w-full">
                    <div className="mb-4 flex items-baseline justify-center gap-1">
                      <span className="text-[24px] font-black text-brand tabular-nums" dir="ltr">
                        {item.price.toLocaleString()}
                      </span>
                      <span className="text-brand-muted text-[10px] font-black">CRD</span>
                    </div>

                    <Button
                      className={`w-full h-11 rounded-2xl font-black text-[11px] uppercase ${
                        balance !== null && balance >= item.price
                          ? 'bg-white text-black'
                          : 'bg-white/80 text-black'
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

      {mounted &&
        typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {selectedItem && (
              <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                  onClick={() => setSelectedItem(null)}
                />

                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  drag="y"
                  dragConstraints={{ top: 0 }}
                  dragElastic={0.35}
                  onDragEnd={(_, info) => {
                    if (info.offset.y > 100) setSelectedItem(null);
                  }}
                  transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  className="relative z-10 bg-white rounded-t-[40px] p-6 pb-12 shadow-2xl touch-none"
                >
                  <div className="w-16 h-1.5 bg-black/10 rounded-full mx-auto mb-8 cursor-grab active:cursor-grabbing" />

                  <button
                    onClick={() => setSelectedItem(null)}
                    className="absolute top-5 left-5 w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 active:scale-95"
                  >
                    <X size={18} />
                  </button>

                  <div className="flex flex-col items-center text-center gap-4 mb-8">
                    <div
                      className="w-20 h-20 rounded-[24px] flex items-center justify-center border border-neutral-200 shadow-inner"
                      style={{ backgroundColor: `${selectedItem.color}15` }}
                    >
                      <selectedItem.icon size={36} style={{ color: selectedItem.color }} />
                    </div>

                    <h3 className="text-2xl font-black text-black">אישור רכישה</h3>
                    <p className="text-neutral-500 font-medium text-sm px-4">
                      האם ברצונך לרכוש את <span className="text-black font-bold">{selectedItem.title}</span>?
                    </p>
                  </div>

                  <div className="bg-neutral-100 rounded-[24px] p-5 border border-neutral-200 flex justify-between items-center mb-8">
                    <span className="text-neutral-500 font-bold uppercase tracking-widest text-[10px]">
                      מחיר סופי
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-accent-primary tabular-nums">
                        {selectedItem.price.toLocaleString()}
                      </span>
                      <span className="text-accent-primary/60 text-[10px] font-black">CRD</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleBuy(selectedItem)}
                    disabled={buyingId === selectedItem.id}
                    className="w-full h-16 bg-white text-black rounded-2xl font-black text-lg active:scale-95 shadow-xl border border-neutral-200"
                  >
                    {buyingId === selectedItem.id ? <Loader2 size={20} className="animate-spin" /> : 'רכוש'}
                  </Button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};
