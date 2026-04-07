import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

// ==========================================
// 🎨 CLEAN PREMIUM SVGs (No endpoints dots, subtle glow)
// ==========================================

const SvgGoldMessage = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]">
    <defs>
      <linearGradient id="goldGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FDE68A" />
        <stop offset="0.5" stopColor="#F59E0B" />
        <stop offset="1" stopColor="#B45309" />
      </linearGradient>
    </defs>
    <path d="M40 8H8C5.8 8 4 9.8 4 12V32C4 34.2 5.8 36 8 36H16V44L26.6 36H40C42.2 36 44 34.2 44 32V12C44 9.8 42.2 8 40 8Z" fill="url(#goldGrad)" />
    <path d="M14 22H34M14 16H26" stroke="#FEF3C7" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const SvgCrown = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]">
    <defs>
      <linearGradient id="goldGrad2" x1="0" y1="0" x2="48" y2="48">
        <stop stopColor="#FCD34D" />
        <stop offset="1" stopColor="#D97706" />
      </linearGradient>
    </defs>
    <path d="M6 38L10 14L24 26L38 14L42 38H6Z" fill="url(#goldGrad2)" stroke="#e0a800" strokeWidth="1" />
    <path d="M6 42H42V38H6V42Z" fill="#ffd54f" />
  </svg>
);

const SvgGhost = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 drop-shadow-[0_0_8px_rgba(148,163,184,0.3)] opacity-95">
    <defs>
      <linearGradient id="ghostGrad" x1="24" y1="4" x2="24" y2="44">
        <stop stopColor="#F8FAFC" />
        <stop offset="1" stopColor="#94A3B8" stopOpacity="0.1" />
      </linearGradient>
    </defs>
    <path d="M24 4C14 4 8 12 8 22V44L13.3 38.6L18.6 44L24 38.6L29.3 44L34.6 38.6L40 44V22C40 12 34 4 24 4Z" fill="url(#ghostGrad)" />
    <circle cx="18" cy="18" r="3" fill="#0F172A" />
    <circle cx="30" cy="18" r="3" fill="#0F172A" />
  </svg>
);

const SvgNeon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 drop-shadow-[0_0_6px_rgba(161,180,254,0.6)]">
    <path d="M10 24L20 10L28 38L38 24" stroke="#A1B4FE" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse" />
  </svg>
);

const SvgRadar = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]">
    <circle cx="24" cy="24" r="20" stroke="#F43F5E" strokeWidth="2" strokeDasharray="4 4" className="animate-[spin_6s_linear_infinite]" />
    <circle cx="24" cy="24" r="12" stroke="#FDA4AF" strokeWidth="1" opacity="0.4" />
    <circle cx="24" cy="24" r="4" fill="#F43F5E" />
    <path d="M24 24L38 10" stroke="#F43F5E" strokeWidth="3" strokeLinecap="round" className="animate-[spin_3s_linear_infinite]" style={{ transformOrigin: '24px 24px' }} />
  </svg>
);

const SvgPin = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">
    <defs>
      <linearGradient id="pinGrad" x1="10" y1="10" x2="38" y2="38">
        <stop stopColor="#6EE7B7" />
        <stop offset="1" stopColor="#059669" />
      </linearGradient>
    </defs>
    <path d="M30 18L18 30M32 16C36.4183 20.4183 36.4183 27.5817 32 32L16 16C20.4183 11.5817 27.5817 11.5817 32 16ZM18 30L8 40" stroke="url(#pinGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SvgShield = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 drop-shadow-[0_0_8px_rgba(14,165,233,0.3)]">
    <defs>
      <linearGradient id="shieldGrad" x1="24" y1="4" x2="24" y2="44">
        <stop stopColor="#7DD3FC" />
        <stop offset="1" stopColor="#0284C7" />
      </linearGradient>
    </defs>
    <path d="M24 4L8 10V22C8 32.5 14.8 41.8 24 44C33.2 41.8 40 32.5 40 22V10L24 4Z" fill="url(#shieldGrad)" />
    <path d="M20 24L24 28L32 18" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SvgFlame = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 drop-shadow-[0_0_10px_rgba(249,115,22,0.4)]">
    <defs>
      <linearGradient id="flameGrad" x1="24" y1="8" x2="24" y2="44">
        <stop stopColor="#FDBA74" />
        <stop offset="0.5" stopColor="#F97316" />
        <stop offset="1" stopColor="#EA580C" />
      </linearGradient>
    </defs>
    <path d="M24 44C31.732 44 38 37.732 38 30C38 21.5 24 4 24 4C24 4 10 21.5 10 30C10 37.732 16.268 44 24 44Z" fill="url(#flameGrad)" className="animate-[pulse_2s_ease-in-out_infinite]" />
  </svg>
);

const SvgVault = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 drop-shadow-[0_0_8px_rgba(229,57,53,0.3)]">
    <rect x="6" y="10" width="36" height="32" rx="4" fill="#EF4444" />
    <circle cx="24" cy="26" r="8" fill="#B91C1C" />
    <path d="M24 22V26M24 26H28" stroke="#FECACA" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 10V6C12 4.89543 12.8954 4 14 4H34C35.1046 4 36 4.89543 36 6V10" stroke="#EF4444" strokeWidth="4" />
  </svg>
);

const SvgLightning = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 drop-shadow-[0_0_8px_rgba(253,224,71,0.4)]">
    <path d="M26 4L6 26H22L18 44L42 20H26L30 4Z" fill="#FBBF24" stroke="#FEF08A" strokeWidth="2" strokeLinejoin="round" className="animate-pulse" />
  </svg>
);

const SvgEye = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]">
    <path d="M4 24C4 24 12 10 24 10C36 10 44 24 44 24C44 24 36 38 24 38C12 38 4 24 4 24Z" fill="#1E3A8A" stroke="#60A5FA" strokeWidth="3" />
    <circle cx="24" cy="24" r="8" fill="#93C5FD" opacity="0.8" />
    <circle cx="24" cy="24" r="3" fill="#1E3A8A" />
  </svg>
);

// ==========================================
// STORE DATA
// ==========================================

type StoreItem = {
  id: number;
  title: string;
  desc: string;
  price: number;
  svg: React.FC;
  badge?: string;
};

const STORE_ITEMS: StoreItem[] = [
  { id: 1, title: 'הודעת זהב', desc: 'הודעה בולטת בלובי ל-24 שעות', price: 150, svg: SvgGoldMessage, badge: 'פופולרי' },
  { id: 2, title: 'תג CORE VIP', desc: 'תג כתר זהב מנצנץ ליד השם שלך', price: 500, svg: SvgCrown },
  { id: 3, title: 'מצב רפאים', desc: 'כניסה שקטה בלי למשוך תשומת לב', price: 300, svg: SvgGhost },
  { id: 4, title: 'שם ניאון', desc: 'השם שלך זוהר למשך 7 ימים', price: 800, svg: SvgNeon, badge: 'חדש' },
  { id: 5, title: 'בוסט רדאר', desc: 'דחיפה עוצמתית של הקהילה בחיפוש', price: 1500, svg: SvgRadar },
  { id: 6, title: 'נעץ שיחה', desc: 'הודעה מוצמדת בראש הקהילה', price: 400, svg: SvgPin },
  { id: 7, title: 'מגן פרופיל', desc: 'סטטוס בולט ומוגן לפרופיל שלך', price: 950, svg: SvgShield },
  { id: 8, title: 'רותח עכשיו', desc: 'דחיפת חשיפה לתוכן שלך', price: 1200, svg: SvgFlame },
  { id: 9, title: 'כספת קהילה', desc: 'נעל קהילה ל-CORE בלבד (24ש)', price: 650, svg: SvgVault, badge: 'ניהול' },
  { id: 10, title: 'מגבר הודעה', desc: 'מסגרת זוהרת להודעה שלך ל-3 שעות', price: 90, svg: SvgLightning },
  { id: 11, title: 'רואה-ואינו-נראה', desc: 'גלה מי נכנס אליך במצב רפאים', price: 1800, svg: SvgEye, badge: 'פרימיום' },
];

export const BoostStorePage: React.FC = () => {
  const navigate = useNavigate();

  const [mounted, setMounted] = useState(false);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);

  useEffect(() => {
    setMounted(true);
    setPortalNode(document.getElementById('root') || document.body);
    fetchWalletBalance();
  }, []);

  const fetchWalletBalance = async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user?.id) { setBalance(0); return; }
      const data = await apiFetch<any>('/api/wallet', { headers: { 'x-user-id': authData.user.id } });
      setBalance(Number(data?.credits || 0));
    } catch {
      setBalance(0);
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (item: StoreItem) => {
    triggerFeedback('pop');
    if (balance !== null && balance < item.price) {
      triggerFeedback('error');
      toast.error('אין לך מספיק CRD בארנק');
      return;
    }

    setBuyingId(item.id);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1100)); // סימולציה
      setBalance((prev) => (prev !== null ? prev - item.price : prev));
      triggerFeedback('coin');
      toast.success(`רכשת את ${item.title} בהצלחה! 🔥`);
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
      <FadeIn className="px-4 pt-6 pb-32 bg-surface min-h-screen font-sans relative overflow-x-hidden" dir="rtl">
        
        {/* Glow Effects */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[30%] bg-accent-primary/5 blur-[120px] rounded-full" />
        </div>

        <div className="relative z-10 w-full flex flex-col gap-6">
          
          {/* Upgraded Symmetrical Wallet Card */}
          <motion.div 
            onClick={() => navigate('/wallet')}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-card border border-surface-border rounded-[32px] p-6 flex flex-col items-center text-center shadow-md cursor-pointer active:scale-[0.98] transition-all"
          >
            <span className="text-[10px] font-black text-brand-muted uppercase tracking-widest mb-2">יתרת קרדיטים זמינה</span>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-5xl font-black text-brand tabular-nums tracking-tighter">{balance?.toLocaleString()}</span>
              <span className="text-[12px] text-yellow-500 font-black uppercase tracking-widest">CRD</span>
            </div>
            <span className="text-xs text-brand-muted font-medium mt-1">לחץ לטעינה</span>
          </motion.div>

          {/* Store Grid - Clean, Framed Cards - Symmetrical */}
          <div className="grid grid-cols-2 gap-4">
            {STORE_ITEMS.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={() => setSelectedItem(item)}
                className="bg-surface-card border border-surface-border rounded-[24px] p-5 flex flex-col items-center text-center active:scale-[0.98] transition-all cursor-pointer relative group overflow-hidden shadow-sm"
              >
                {item.badge && (
                  <span className="absolute top-3 right-3 px-2 py-0.5 rounded text-[9px] font-black uppercase text-accent-primary bg-accent-primary/10">
                    {item.badge}
                  </span>
                )}

                <div className="mb-4 mt-4 pointer-events-none transform group-hover:scale-105 transition-transform">
                  <item.svg />
                </div>

                <p className="text-brand text-xs font-medium leading-snug text-center mb-5 line-clamp-2 px-1">
                  {item.desc}
                </p>

                <div className="mt-auto w-full flex flex-col items-center gap-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-[18px] font-black text-brand tabular-nums">{item.price}</span>
                    <span className="text-brand-muted text-[10px] font-black uppercase tracking-widest">CRD</span>
                  </div>
                  
                  {/* Buy Button - White if affordable */}
                  <Button
                    className={`w-full h-10 rounded-xl font-black text-[12px] uppercase transition-all shadow-sm ${balance !== null && balance >= item.price ? 'bg-white text-black' : 'bg-surface border border-surface-border text-brand-muted'}`}
                  >
                    רכישה
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </FadeIn>

      {/* PURCHASE BOTTOM SHEET - Clean, No X, Symmetrical */}
      {mounted && portalNode && createPortal(
        <AnimatePresence>
          {selectedItem && (
            <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl">
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
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={0.35}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 100) setSelectedItem(null);
                }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="relative z-10 bg-surface rounded-t-[40px] p-6 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border touch-none"
              >
                <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-6 cursor-grab active:cursor-grabbing" />

                <div className="flex flex-col items-center text-center gap-2 mb-8 px-4">
                  <div className="mb-6 transform scale-[1.3] drop-shadow-sm">
                    <selectedItem.svg />
                  </div>
                  
                  <p className="text-brand text-sm font-medium leading-relaxed max-w-[280px]">
                    {selectedItem.desc}
                  </p>
                </div>

                <div className="bg-surface-card border border-surface-border rounded-[24px] p-5 flex flex-col items-center gap-2 mb-8 shadow-inner">
                  <span className="text-brand-muted font-black uppercase tracking-widest text-[10px]">מחיר סופי</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-accent-primary tabular-nums drop-shadow-sm">
                      {selectedItem.price.toLocaleString()}
                    </span>
                    <span className="text-accent-primary/60 text-[11px] font-black uppercase tracking-widest">CRD</span>
                  </div>
                </div>

                <Button
                  onClick={() => handleBuy(selectedItem)}
                  disabled={buyingId === selectedItem.id}
                  className="w-full h-16 bg-white text-black rounded-2xl font-black text-[16px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 shadow-md"
                >
                  {buyingId === selectedItem.id ? <Loader2 size={24} className="animate-spin text-black" /> : 'אישור והפעלת בוסט'}
                </Button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        portalNode
      )}
    </>
  );
};
