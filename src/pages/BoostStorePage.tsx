import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Zap,
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
  tone: string;
  badge?: string;
};

export const BoostStorePage: React.FC = () => {
  const navigate = useNavigate();

  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingBalance, setRefreshingBalance] = useState(false);
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const items: StoreItem[] = useMemo(
    () => [
      {
        id: 1,
        title: 'הודעת זהב',
        desc: 'הודעה בולטת בלובי ל-24 שעות',
        price: 150,
        icon: MessageSquare,
        tone: 'text-amber-300',
        badge: 'פופולרי',
      },
      {
        id: 2,
        title: 'תג CORE',
        desc: 'תג סטטוס יוקרתי ליד השם שלך',
        price: 500,
        icon: Crown,
        tone: 'text-violet-300',
      },
      {
        id: 3,
        title: 'מצב רפאים',
        desc: 'כניסה שקטה לקהילות בלי למשוך תשומת לב',
        price: 300,
        icon: Ghost,
        tone: 'text-slate-200',
      },
      {
        id: 4,
        title: 'שם ניאון',
        desc: 'השם שלך זוהר למשך 7 ימים',
        price: 800,
        icon: Sparkles,
        tone: 'text-cyan-300',
        badge: 'חדש',
      },
      {
        id: 5,
        title: 'בוסט רדאר',
        desc: 'דחיפה של הקהילה שלך בחיפוש',
        price: 1500,
        icon: Radio,
        tone: 'text-rose-300',
      },
      {
        id: 6,
        title: 'נעץ שיחה',
        desc: 'הודעה מוצמדת בראש הקהילה',
        price: 400,
        icon: Pin,
        tone: 'text-emerald-300',
      },
      {
        id: 7,
        title: 'מגן פרופיל',
        desc: 'סטטוס בולט לפרופיל שלך',
        price: 950,
        icon: ShieldCheck,
        tone: 'text-sky-300',
      },
      {
        id: 8,
        title: 'חם עכשיו',
        desc: 'דחיפת חשיפה מהירה לתוכן שלך',
        price: 1200,
        icon: Flame,
        tone: 'text-orange-300',
      },
    ],
    []
  );

  const fetchWalletBalance = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshingBalance(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id;

      if (!uid) {
        setBalance(0);
        setCurrentUserId('');
        return;
      }

      setCurrentUserId(uid);

      const data = await apiFetch<any>('/api/wallet', {
        headers: {
          'x-user-id': uid,
        },
      });

      setBalance(Number(data?.credits || 0));
    } catch (err) {
      console.error('שגיאה בטעינת הארנק:', err);
      if (!silent) toast.error('לא הצלחנו לטעון את היתרה מהארנק');
      setBalance(0);
    } finally {
      setLoading(false);
      setRefreshingBalance(false);
    }
  }, []);

  useEffect(() => {
    fetchWalletBalance(false);
  }, [fetchWalletBalance]);

  const handleBuy = async (item: StoreItem) => {
    triggerFeedback('pop');

    if (balance !== null && balance < item.price) {
      triggerFeedback('error');
      toast.error('אין לך מספיק CRD. טען את הארנק קודם');
      return;
    }

    setBuyingId(item.id);

    try {
      // כרגע זו עדיין רכישת UI בלבד עד שנחבר endpoint קנייה אמיתי לחנות
      await new Promise((resolve) => setTimeout(resolve, 1100));

      setBalance((prev) => (prev !== null ? prev - item.price : prev));
      triggerFeedback('coin');
      toast.success(`רכשת את ${item.title}`);
    } catch (err) {
      triggerFeedback('error');
      toast.error('הרכישה נכשלה');
    } finally {
      setBuyingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <Loader2 className="animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <FadeIn
      className="px-4 pt-8 pb-32 bg-[#030303] min-h-screen font-sans relative overflow-x-hidden"
      dir="rtl"
    >
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-12%] right-[-18%] w-[58%] h-[24%] bg-white/5 blur-[110px] rounded-full" />
        <div className="absolute bottom-[4%] left-[-14%] w-[42%] h-[18%] bg-white/5 blur-[90px] rounded-full" />
      </div>

      <div className="relative z-10">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-white/72" />
            <h1 className="text-[24px] font-black text-white tracking-tight">החנות</h1>
          </div>
          <span className="text-white/28 text-[10px] font-black tracking-[0.18em] uppercase mt-2">
            Boosts & Status
          </span>
        </div>

        <div className="mb-5 rounded-[30px] bg-white/[0.04] backdrop-blur-2xl px-5 py-5 shadow-[0_12px_35px_rgba(0,0,0,0.24)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Wallet size={18} className="text-white/70 shrink-0 mt-1" />
              <div className="text-right">
                <span className="text-white font-black text-[14px] block">היתרה שלך</span>
                <span className="text-white/34 text-[10px] font-bold tracking-widest uppercase">
                  מחובר לארנק האמיתי
                </span>
                {currentUserId && (
                  <span className="text-white/20 text-[9px] font-bold block mt-1" dir="ltr">
                    {currentUserId.slice(0, 8)}...
                  </span>
                )}
              </div>
            </div>

            <div className="text-left shrink-0">
              <span className="text-white font-black text-[32px] leading-none tracking-tight block" dir="ltr">
                {balance?.toLocaleString()}
              </span>
              <span className="text-white/34 text-[10px] font-black tracking-[0.2em] uppercase block mt-1" dir="ltr">
                CRD
              </span>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              onClick={() => {
                triggerFeedback('pop');
                navigate('/wallet');
              }}
              className="flex-1 h-11 rounded-2xl bg-white text-black font-black text-[11px] tracking-widest uppercase"
            >
              טען ארנק
            </Button>

            <button
              onClick={() => {
                triggerFeedback('pop');
                fetchWalletBalance(true);
              }}
              className="w-11 h-11 rounded-2xl bg-white/7 flex items-center justify-center active:scale-95 transition-all"
              aria-label="רענן יתרה"
            >
              <RefreshCw
                size={16}
                className={`text-white/70 ${refreshingBalance ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between px-1">
          <span className="text-white/82 font-black text-[15px]">בחר בוסט</span>
          <span className="text-white/22 text-[10px] font-black tracking-[0.18em] uppercase">
            Premium
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {items.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: Math.min(idx * 0.04, 0.22) }}
              className="h-full"
            >
              <div className="h-full rounded-[28px] bg-white/[0.03] backdrop-blur-2xl px-4 py-4 shadow-[0_10px_28px_rgba(0,0,0,0.2)] flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <item.icon size={22} className={item.tone} />

                  {item.badge ? (
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest uppercase text-white/68 bg-white/[0.06]">
                      {item.badge}
                    </span>
                  ) : (
                    <span />
                  )}
                </div>

                <div className="text-right">
                  <h3 className="text-white font-black text-[14px] leading-tight min-h-[34px]">
                    {item.title}
                  </h3>
                  <p className="text-white/38 text-[10px] font-bold leading-relaxed mt-1 min-h-[32px] line-clamp-2">
                    {item.desc}
                  </p>
                </div>

                <div className="mt-auto pt-4">
                  <div className="mb-3 text-right">
                    <span className="text-white font-black text-[20px] tracking-tight" dir="ltr">
                      {item.price.toLocaleString()}
                    </span>
                    <span className="text-white/35 text-[10px] font-black mr-1" dir="ltr">
                      CRD
                    </span>
                  </div>

                  <Button
                    onClick={() => handleBuy(item)}
                    disabled={buyingId === item.id}
                    className={`w-full h-11 rounded-2xl font-black text-[11px] tracking-widest uppercase transition-all ${
                      balance !== null && balance >= item.price
                        ? 'bg-white text-black hover:bg-neutral-200'
                        : 'bg-white/10 text-white/35'
                    }`}
                  >
                    {buyingId === item.id ? (
                      <Loader2 size={16} className="animate-spin text-black/70" />
                    ) : balance !== null && balance >= item.price ? (
                      'קנה עכשיו'
                    ) : (
                      'אין יתרה'
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-5 rounded-[24px] bg-white/[0.03] backdrop-blur-2xl px-4 py-4 shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
          <div className="flex items-center gap-3">
            <Star size={16} className="text-white/60 shrink-0" />
            <div className="text-right">
              <p className="text-white/85 text-[13px] font-black">צריך עוד CRD?</p>
              <p className="text-white/35 text-[10px] font-bold leading-relaxed mt-1">
                פתח את הארנק שלך, טען יתרה, וחזור לחנות כדי לרכוש בוסטים וסטטוסים.
              </p>
            </div>
          </div>
        </div>
      </div>
    </FadeIn>
  );
};
