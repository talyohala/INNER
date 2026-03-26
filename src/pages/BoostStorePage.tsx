import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Star, ArrowRight, Loader2, Crown, MessageSquare, Wallet, Ghost, Sparkles, Pin } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';
import { FadeIn, GlassCard, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

export const BoostStorePage: React.FC = () => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<number | null>(null);

  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const data = await apiFetch<any>('/api/wallet');
        setBalance(data.credits);
      } catch (err) { console.error('שגיאה בטעינת ארנק'); } 
      finally { setLoading(false); }
    };
    fetchWallet();
  }, []);

  // קטלוג מוצרים - תוקנה בעיית הגרשיים במילה "צ'אט"
  const items = [
    { id: 1, title: 'הודעת זהב', desc: 'מסגרת בולטת בלובי ל-24 שעות', price: 150, icon: MessageSquare, color: 'text-yellow-400', glow: 'shadow-[0_0_15px_rgba(234,179,8,0.15)]', bg: 'bg-yellow-500/10' },
    { id: 2, title: 'תג CORE', desc: 'סמל סטטוס יוקרתי ליד השם שלך', price: 500, icon: Crown, color: 'text-purple-400', glow: 'shadow-[0_0_15px_rgba(168,85,247,0.15)]', bg: 'bg-purple-500/10' },
    { id: 3, title: 'מצב רפאים', desc: 'כניסה חשאית לקהילות ללא זיהוי', price: 300, icon: Ghost, color: 'text-gray-300', glow: 'shadow-[0_0_15px_rgba(255,255,255,0.1)]', bg: 'bg-white/10' },
    { id: 4, title: 'שם ניאון', desc: 'השם שלך יזהר בצאט ל-7 ימים', price: 800, icon: Sparkles, color: 'text-cyan-400', glow: 'shadow-[0_0_15px_rgba(34,211,238,0.15)]', bg: 'bg-cyan-500/10' },
    { id: 5, title: 'בוסט רדאר', desc: 'הקהילה שלך בטופ של החיפוש', price: 1500, icon: Star, color: 'text-red-400', glow: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]', bg: 'bg-red-500/10' },
    { id: 6, title: 'נעץ שיחה', desc: 'הודעה בראש הקהילה לשעה', price: 400, icon: Pin, color: 'text-green-400', glow: 'shadow-[0_0_15px_rgba(74,222,128,0.15)]', bg: 'bg-green-500/10' }
  ];

  const handleBuy = async (item: any) => {
    triggerFeedback('pop');
    if (balance !== null && balance < item.price) {
      triggerFeedback('error');
      toast.error('אין לך מספיק CRD. טען את הארנק!', { style: { background: '#ef4444', color: '#fff' } });
      return;
    }

    setBuyingId(item.id);
    // סימולציה של רכישה
    setTimeout(() => {
      triggerFeedback('coin');
      if (balance !== null) setBalance(balance - item.price);
      toast.success(`רכשת את: ${item.title}! 🚀`, { style: { background: '#22c55e', color: '#000' } });
      setBuyingId(null);
    }, 1500);
  };

  if (loading) return <div className="min-h-screen bg-[#030303] flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  return (
    <FadeIn className="px-5 pt-8 pb-32 bg-[#030303] min-h-screen font-sans relative" dir="rtl">
      
      {/* כותרת חנות וניווט חזור */}
      <div className="flex justify-between items-center mb-6 relative z-10">
        <div className="w-8"></div>
        <div className="flex flex-col items-center">
          <motion.h1 animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="text-2xl font-black text-white flex items-center gap-2">
            <Zap size={24} className="text-yellow-500 fill-yellow-500/20" /> החנות
          </motion.h1>
          <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">קנה סטטוס וירטואלי</span>
        </div>
        <button onClick={() => { triggerFeedback('pop'); navigate(-1); }} className="w-8 h-8 flex justify-center items-center bg-white/5 rounded-full shadow-inner active:scale-90 transition-all">
          <ArrowRight size={16} />
        </button>
      </div>

      {/* תצוגת יתרה מהירה */}
      <GlassCard className="mb-6 p-4 flex items-center justify-between border-green-500/20 bg-green-500/[0.02] rounded-[24px] cursor-pointer active:scale-95 transition-transform" onClick={() => navigate('/wallet')}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
            <Wallet size={16} className="text-green-400" />
          </div>
          <div className="text-right">
            <span className="text-white font-black text-sm block">היתרה שלך</span>
            <span className="text-white/40 text-[10px] font-bold">לחץ כדי לטעון CRD</span>
          </div>
        </div>
        <span className="text-green-400 font-black text-xl drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]">{balance?.toLocaleString()}</span>
      </GlassCard>

      {/* גריד מוצרים - 2 בשורה */}
      <div className="grid grid-cols-2 gap-4 relative z-10">
        {items.map((item, idx) => (
          <motion.div 
            key={item.id}
            initial={{ opacity: 0, scale: 0.9, y: 10 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            transition={{ delay: idx * 0.05 }}
            className="h-full"
          >
            <GlassCard className={`p-4 flex flex-col items-center text-center gap-3 h-full justify-between relative overflow-hidden bg-white/[0.02] border-white/5 rounded-[28px] ${item.glow}`}>
              
              <div className={`absolute -top-6 -right-6 w-24 h-24 blur-[40px] rounded-full pointer-events-none ${item.bg}`}></div>
              
              <div className="flex flex-col items-center gap-2 relative z-10 w-full mt-2">
                <div className={`w-12 h-12 rounded-[18px] flex items-center justify-center shadow-inner ${item.bg} border border-white/5`}>
                  <item.icon size={22} className={item.color} />
                </div>
                <h3 className="text-white font-black text-sm mt-1">{item.title}</h3>
                <p className="text-white/40 text-[9px] font-bold leading-relaxed line-clamp-2 px-1 min-h-[28px]">{item.desc}</p>
              </div>

              <Button 
                onClick={() => handleBuy(item)} 
                disabled={buyingId === item.id}
                className={`w-full h-10 mt-1 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg relative z-10 ${
                  balance !== null && balance >= item.price ? 'bg-white text-black hover:bg-gray-200' : 'bg-white/10 text-white/40'
                }`}
              >
                {buyingId === item.id ? <Loader2 size={16} className="animate-spin text-black" /> : `${item.price.toLocaleString()} CRD`}
              </Button>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </FadeIn>
  );
};
