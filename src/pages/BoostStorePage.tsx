import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Zap,
  ArrowRight,
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
  ChevronLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';
import { FadeIn, GlassCard, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

type StoreItem = {
  id: number;
  title: string;
  desc: string;
  price: number;
  icon: any;
  color: string;
  glow: string;
  bg: string;
  badge?: string;
  popular?: boolean;
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
        desc: 'הודעה בולטת במיוחד בלובי הראשי ל-24 שעות',
        price: 150,
        icon: MessageSquare,
        color: 'text-amber-300',
        glow: 'shadow-[0_0_18px_rgba(252,211,77,0.14)]',
        bg: 'bg-amber-500/10',
        badge: 'פופולרי',
      },
      {
        id: 2,
        title: 'תג CORE',
        desc: 'תג יוקרתי ליד השם שלך בכל האפליקציה',
        price: 500,
        icon: Crown,
        color: 'text-violet-300',
        glow: 'shadow-[0_0_18px_rgba(167,139,250,0.14)]',
        bg: 'bg-violet-500/10',
      },
      {
        id: 3,
        title: 'מצב רפאים',
        desc: 'כניסה שקטה בלי למשוך תשומת לב בקהילות',
        price: 300,
        icon: Ghost,
        color: 'text-slate-200',
        glow: 'shadow-[0_0_18px_rgba(255,255,255,0.08)]',
        bg: 'bg-white/10',
      },
      {
        id: 4,
        title: 'שם ניאון',
        desc: 'השם שלך מקבל אפקט זוהר למשך 7 ימים',
        price: 800,
        icon: Sparkles,
        color: 'text-cyan-300',
        glow: 'shadow-[0_0_18px_rgba(34,211,238,0.14)]',
        bg: 'bg-cyan-500/10',
        badge: 'חדש',
      },
      {
        id: 5,
        title: 'בוסט רדאר',
        desc: 'הקהילה שלך מקבלת דחיפה חזקה בחיפוש',
        price: 1500,
        icon: Radio,
        color: 'text-red-300',
        glow: 'shadow-[0_0_18px_rgba(248,113,113,0.14)]',
        bg: 'bg-red-500/10',
      },
      {
        id: 6,
        title: 'נעץ שיחה',
        desc: 'הודעה מוצמדת לראש הקהילה לזמן מוגבל',
        price: 400,
        icon: Pin,
        color: 'text-emerald-300',
        glow: 'shadow-[0_0_18px_rgba(110,231,183,0.14)]',
        bg: 'bg-emerald-500/10',
      },
      {
        id: 7,
        title: 'מגן פרופיל',
        desc: 'הבלטת פרופיל עם סימון יוקרתי והגנה חזותית',
        price: 950,
        icon: ShieldCheck,
        color: 'text-sky-300',
        glow: 'shadow-[0_0_18px_rgba(125,211,252,0.14)]',
        bg: 'bg-sky-500/10',
      },
      {
        id: 8,
        title: 'חם עכשיו',
        desc: 'דחיפת תוכן לפרק זמן קצר עם חשיפה גבוהה',
        price: 1200,
        icon: Flame,
        color: 'text-orange-300',
        glow: 'shadow-[0_0_18px_rgba(253,186,116,0.14)]',
        bg: 'bg-orange-500/10',
        popular: true,
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

    setTimeout(() => {
      triggerFeedback('coin');
      setBalance((prev) => (prev !== null ? prev - item.price : prev));
      toast.success(`רכשת את: ${item.title}`);
      setBuyingId(null);
    }, 1200);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <Loader2 className="animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <FadeIn className="px-4 pt-8 pb-32 bg-[#030303] min-h-screen font-sans relative overflow-x-hidden" dir="rtl">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex justify-center">
        <div className="absolute top-[-8%] right-[-15%] w-[60%] h-[30%] bg-white/5 blur-[110px] rounded-full" />
        <div className="absolute bottom-[5%] left-[-15%] w-[50%] h-[25%] bg-white/5 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6 h-11">
          <button
            onClick={() => {
              triggerFeedback('pop');
              navigate(-1);
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-white/10 active:scale-90 transition-all shadow-inner"
          >
            <ArrowRight size={18} className="text-white/80" />
          </button>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-amber-300" />
              <h1 className="text-[24px] font-black text-white tracking-tight">החנות</h1>
            </div>
          </div>

          <div className="w-10" />
        </div>

        <GlassCard
          className="mb-4 p-4 rounded-[28px] border-white/10 bg-white/[0.04] cursor-pointer active:scale-[0.99] transition-transform"
          onClick={() => {
            triggerFeedback('pop');
            navigate('/wallet');
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-[18px] bg-emerald-500/10 border border-emerald-400/15 flex items-center justify-center shadow-inner">
                <Wallet size={18} className="text-emerald-300" />
              </div>

              <div className="text-right">
                <span className="text-white font-black text-[14px] block">היתרה שלך</span>
                <span className="text-white/35 text-[10px] font-bold tracking-widest uppercase">
                  לחץ לטעינת ארנק
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-emerald-300 font-black text-[24px] tracking-tight">
                {balance?.toLocaleString()}
              </span>
              <ChevronLeft size={16} className="text-white/20" />
            </div>
          </div>
        </GlassCard>

        <div className="mb-5 grid grid-cols-3 gap-2">
          <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3 text-center">
            <span className="text-white/30 text-[9px] font-black tracking-[0.18em] uppercase block">מוצרים</span>
            <span className="text-white font-black text-[16px] block mt-1">{items.length}</span>
          </div>
          <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3 text-center">
            <span className="text-white/30 text-[9px] font-black tracking-[0.18em] uppercase block">החל מ</span>
            <span className="text-white font-black text-[16px] block mt-1">
              {Math.min(...items.map((i) => i.price))} CRD
            </span>
          </div>
          <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3 text-center">
            <span className="text-white/30 text-[9px] font-black tracking-[0.18em] uppercase block">יוקרתי</span>
            <span className="text-white font-black text-[16px] block mt-1">CORE+</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4 px-1">
          <span className="text-white/75 font-black text-[15px]">בחר בוסט</span>
          <span className="text-white/25 text-[10px] font-black tracking-[0.18em] uppercase">
            Premium boosts
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {items.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: Math.min(idx * 0.05, 0.25) }}
              className="h-full"
            >
              <GlassCard
                className={`h-full rounded-[28px] p-4 bg-white/[0.03] border-white/8 relative overflow-hidden flex flex-col ${item.glow}`}
              >
                <div className={`absolute -top-8 -left-8 w-24 h-24 rounded-full blur-[38px] ${item.bg}`} />

                {(item.badge || item.popular) && (
                  <div className="absolute top-3 right-3 z-10">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest uppercase border ${
                        item.popular
                          ? 'bg-white/10 text-white border-white/10'
                          : 'bg-white/5 text-white/70 border-white/10'
                      }`}
                    >
                      {item.popular ? 'hot' : item.badge}
                    </span>
                  </div>
                )}

                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center justify-center mb-3 mt-2">
                    <div
                      className={`w-14 h-14 rounded-[20px] border border-white/8 flex items-center justify-center shadow-inner ${item.bg}`}
                    >
                      <item.icon size={24} className={item.color} />
                    </div>
                  </div>

                  <div className="text-center px-1">
                    <h3 className="text-white font-black text-[14px] leading-tight min-h-[36px]">
                      {item.title}
                    </h3>
                    <p className="text-white/40 text-[10px] font-bold leading-relaxed mt-1 min-h-[32px] line-clamp-2">
                      {item.desc}
                    </p>
                  </div>

                  <div className="mt-auto pt-4">
                    <div className="text-center mb-2">
                      <span className="text-white font-black text-[18px] tracking-tight">
                        {item.price.toLocaleString()}
                      </span>
                      <span className="text-white/35 text-[10px] font-black mr-1">CRD</span>
                    </div>

                    <Button
                      onClick={() => handleBuy(item)}
                      disabled={buyingId === item.id}
                      className={`w-full h-11 rounded-2xl font-black text-[11px] tracking-widest uppercase transition-all shadow-lg ${
                        balance !== null && balance >= item.price
                          ? 'bg-white text-black hover:bg-gray-200'
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
              </GlassCard>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[16px] bg-white/6 border border-white/10 flex items-center justify-center shrink-0">
              <Star size={16} className="text-white/70" />
            </div>
            <div className="text-right">
              <p className="text-white/80 text-[13px] font-black">רוצה עוד CRD?</p>
              <p className="text-white/35 text-[10px] font-bold leading-relaxed mt-1">
                טען את הארנק שלך וקבל גישה לבוסטים, סטטוסים והבלטות בכל המערכת.
              </p>
            </div>
          </div>
        </div>
      </div>
    </FadeIn>
  );
};
