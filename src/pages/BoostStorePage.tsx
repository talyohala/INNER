import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Loader2, Crown, MessageSquare, Wallet, Ghost, Sparkles,
  Pin, Star, ShieldCheck, Flame, Radio, RefreshCw, ArrowRight, ChevronLeft
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

  const items: StoreItem[] = useMemo(() => [
    { id: 1, title: 'הודעת זהב', desc: 'הודעה בולטת בלובי ל-24 שעות', price: 150, icon: MessageSquare, color: '#ffc107', badge: 'פופולרי' },
    { id: 2, title: 'תג CORE', desc: 'תג סטטוס יוקרתי ליד השם שלך', price: 500, icon: Crown, color: '#a855f7' },
    { id: 4, title: 'שם ניאון', desc: 'השם שלך זוהר למשך 7 ימים', price: 800, icon: Sparkles, color: '#2196f3', badge: 'חדש' },
    { id: 5, title: 'בוסט רדאר', desc: 'דחיפה של הקהילה שלך בחיפוש', price: 1500, icon: Radio, color: '#f43f5e' },
    { id: 7, title: 'מגן פרופיל', desc: 'סטטוס בולט לפרופיל שלך', price: 950, icon: ShieldCheck, color: '#0ea5e9' },
    { id: 8, title: 'חם עכשיו', desc: 'דחיפת חשיפה מהירה לתוכן שלך', price: 1200, icon: Flame, color: '#f97316' },
  ], []);

  const fetchWalletBalance = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshingBalance(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user?.id) return;
      const data = await apiFetch<any>('/api/wallet', { headers: { 'x-user-id': authData.user.id } });
      setBalance(Number(data?.credits || 0));
    } catch (err) {
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
    } catch {
      toast.error('הרכישה נכשלה');
    } finally {
      setBuyingId(null);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center">
      <Loader2 className="animate-spin text-white/20" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#030303] text-white pb-32 overflow-x-hidden font-sans" dir="rtl">
      {/* Header - Edge to Edge Design */}
      <div className="p-6 pt-14 flex justify-between items-center bg-[#0A0A0A] border-b border-white/5">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full active:scale-90 transition-transform">
          <ArrowRight size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-xl font-black uppercase tracking-tighter">INNER STORE</h1>
          <div className="flex items-center gap-1">
            <span className="w-1 h-1 bg-[#2196f3] rounded-full animate-pulse" />
            <span className="text-[9px] font-black text-white/40 tracking-[0.2em] uppercase">Premium Boosts</span>
          </div>
        </div>
        <button onClick={() => fetchWalletBalance(true)} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full">
           <RefreshCw size={18} className={`text-white/60 ${refreshingBalance ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <FadeIn className="px-0 py-6">
        {/* Wallet Balance Card - Edge to Edge */}
        <div className="px-4 mb-8">
          <div className="w-full bg-gradient-to-br from-[#111] to-[#050505] border border-white/10 rounded-[32px] p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[#2196f3]/5 pointer-events-none" />
            <div className="flex justify-between items-start relative z-10">
              <div className="flex flex-col gap-1">
                <span className="text-white/40 text-[10px] font-black uppercase tracking-widest text-right">היתרה שלך</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black tabular-nums tracking-tighter">{balance?.toLocaleString()}</span>
                  <span className="text-xs font-black text-[#2196f3]">CRD</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 shadow-inner">
                <Wallet className="text-[#2196f3]" size={24} />
              </div>
            </div>
            <Button 
              onClick={() => navigate('/wallet')}
              className="w-full mt-6 h-12 bg-white text-black rounded-2xl font-black text-[11px] tracking-widest uppercase shadow-[0_10px_20px_rgba(255,255,255,0.1)] active:scale-95 transition-all"
            >
              טען קרדיטים
            </Button>
          </div>
        </div>

        <div className="px-5 mb-4 flex items-center justify-between">
          <h2 className="text-[14px] font-black uppercase tracking-wider">שדרוגים ובוסטים</h2>
          <Zap size={14} className="text-white/20" />
        </div>

        {/* Store Items List - Full Width Items */}
        <div className="flex flex-col gap-4 px-4">
          {items.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => handleBuy(item)}
              className="group relative overflow-hidden bg-[#0A0A0A] border border-white/5 rounded-[32px] p-5 flex items-center justify-between active:scale-[0.98] transition-all shadow-lg"
            >
              <div className="flex items-center gap-5">
                <div 
                  className="w-16 h-16 rounded-[24px] flex items-center justify-center shadow-inner relative group-active:scale-90 transition-transform"
                  style={{ backgroundColor: `${item.color}15`, border: `1px solid ${item.color}30` }}
                >
                  <item.icon size={28} style={{ color: item.color }} />
                  {item.badge && (
                    <div className="absolute -top-2 -right-2 bg-white text-black text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-tighter shadow-xl">
                      {item.badge}
                    </div>
                  )}
                </div>
                <div className="flex flex-col text-right">
                  <span className="font-black text-[16px] text-white tracking-tight">{item.title}</span>
                  <span className="text-[11px] text-white/40 font-bold leading-tight mt-1 max-w-[160px]">{item.desc}</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black tracking-tighter tabular-nums">{item.price}</span>
                  <span className="text-[9px] font-black text-white/30">CRD</span>
                </div>
                <div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                  balance !== null && balance >= item.price 
                    ? 'bg-white/5 text-white/80 group-active:bg-white group-active:text-black' 
                    : 'bg-red-500/10 text-red-500/50'
                }`}>
                  {buyingId === item.id ? <Loader2 size={12} className="animate-spin" /> : (balance !== null && balance >= item.price ? 'רכישה' : 'חסר')}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Info Footer */}
        <div className="mt-8 px-6 text-center">
          <p className="text-white/20 text-[10px] font-bold leading-relaxed">
            רכישות בחנות הן סופיות. הבוסטים מופעלים באופן מיידי על הפרופיל שלך.<br/>
            צריך עזרה? פנה לתמיכה ב-Settings.
          </p>
        </div>
      </FadeIn>
    </div>
  );
};
