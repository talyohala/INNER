import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';
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
  const [buyingId, setBuyingId] = useState<number | null>(null);

  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const data = await apiFetch<any>('/api/wallet');
        setBalance(Number(data?.credits || 0));
      } catch (err) {
        console.error('שגיאה בטעינת ארנק');
        setBalance(0);
        toast.error('לא הצלחנו לטעון את היתרה מהארנק');
      } finally {
        setLoading(false);
      }
    };

    fetchWallet();
  }, []);

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
        tone: 'text-red-300',
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

  const handleBuy = async (item: StoreItem) => {
    triggerFeedback('pop');

    if (balance !== null && balance < item.price) {
      triggerFeedback('error');
      toast.error('אין לך מספיק CRD. טען את הארנק קודם');
      return;
    }

    setBuyingId(item.id);

    try {
      // כרגע סימולציה מקומית לרכישה.
      // כשנחבר רכישה אמיתית לשרת, נחליף כאן לקריאת API.
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
        <div className="absolute top-[-8%] right-[-15%] w-[55%] h-[20%] bg-white/5 blur-[100px] rounded-full" />
        <div className="absolute bottom-[8%] left-[-15%] w-[45%] h-[18%] bg-white/5 blur-[90px] rounded-full" />
      </div>

      <div className="relative z-10">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-white/75" />
            <h1 className="text-[24px] font-black text-white tracking-tight">החנות</h1>
          </div>
        </div>

        <div
          onClick={() => {
            triggerFeedback('pop');
            navigate('/wallet');
          }}
          className="mb-5 w-full rounded-[28px] bg-white/[0.04] backdrop-blur-2xl px-5 py-5 shadow-[0_10px_30px_rgba(0,0,0,0.28)] active:scale-[0.99] transition-transform cursor-pointer"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Wallet size={18} className="text-white/70 shrink-0" />
              <div className="text-right">
                <span className="text-white font-black text-[14px] block">יתרה זמינה</span>
                <span className="text-white/35 text-[10px] font-bold tracking-widest uppercase">
                  מחובר לארנק שלך
                </span>
              </div>
            </div>

            <div className="text-left">
              <span className="text-white font-black text-[28px] tracking-tight block" dir="ltr">
                {balance?.toLocaleString()}
              </span>
              <span className="text-white/35 text-[10px] font-bold tracking-[0.18em] uppercase" dir="ltr">
                CRD
              </span>
            </div>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between px-1">
          <span className="text-white/80 font-black text-[15px]">בוסטים וסטטוסים</span>
          <span className="text-white/22 text-[10px] font-black tracking-[0.18em] uppercase">
            Premium store
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {items.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: Math.min(idx * 0.05, 0.25) }}
              className="h-full"
            >
              <div className="h-full rounded-[28px] bg-white/[0.035] backdrop-blur-2xl px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.22)] flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex justify-start">
                    <item.icon size={22} className={item.tone} />
                  </div>

                  {item.badge ? (
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest uppercase text-white/70 bg-white/6">
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

        <div className="mt-5 rounded-[24px] bg-white/[0.03] backdrop-blur-2xl px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
          <div className="flex items-center gap-3">
            <Star size={16} className="text-white/65 shrink-0" />
            <div className="text-right">
              <p className="text-white/85 text-[13px] font-black">צריך עוד CRD?</p>
              <p className="text-white/35 text-[10px] font-bold leading-relaxed mt-1">
                פתח את הארנק, טען יתרה, וחזור לכאן לרכישת בוסטים וסטטוסים.
              </p>
            </div>
          </div>
        </div>
      </div>
    </FadeIn>
  );
};
