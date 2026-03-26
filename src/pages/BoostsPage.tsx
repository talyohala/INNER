import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Zap, Sparkles, MessageSquare, Crown, Star, Flame, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { GlassCard, FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

type Boost = {
  id: string;
  title: string;
  description: string;
  price: number;
  duration: string;
  icon: any;
  color: string;
  bg: string;
  border: string;
};

export const BoostsPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [processingId, setProcessingId] = useState<string | null>(null);

  // קטלוג הבוסטים - פסיכולוגיה של סטטוס
  const BOOSTS: Boost[] = [
    {
      id: 'highlight',
      title: 'הודעה זוהרת',
      description: 'ההודעה הבאה שלך בצ׳אט תופיע בגדול, במרכז, ועם אפקט ניאון שאי אפשר לפספס.',
      price: 50,
      duration: 'הודעה 1',
      icon: Sparkles,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30'
    },
    {
      id: 'vip_badge',
      title: 'תג VIP זמני',
      description: 'קבל תג כתר זוהר ליד השם שלך בכל המעגלים. כולם יידעו שאתה שחקן חזק.',
      price: 300,
      duration: '24 שעות',
      icon: Crown,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/30'
    },
    {
      id: 'pin_msg',
      title: 'נעיצת הודעה',
      description: 'ההודעה שלך תישאר נעוצה בראש הצ׳אט של המועדון למשך שעה שלמה. מקסימום חשיפה.',
      price: 800,
      duration: 'שעה 1',
      icon: Flame,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30'
    }
  ];

  const handleBuyBoost = async (boost: Boost) => {
    if (!profile) return toast.error('עליך להתחבר קודם');
    if ((profile.credits || 0) < boost.price) {
      toast.error('אין לך מספיק CRD. קפוץ לארנק.');
      setTimeout(() => navigate('/wallet'), 1500);
      return;
    }

    try {
      setProcessingId(boost.id);
      
      // סימולציית רכישת הבוסט מול השרת
      await apiFetch('/api/store/buy', {
        method: 'POST',
        body: JSON.stringify({ user_id: profile.id, boost_id: boost.id, price: boost.price })
      });

      triggerFeedback('success');
      toast.success(`הפעלת את ${boost.title}! 🔥 כנס למועדון להשתמש בזה.`);
    } catch (err: any) {
      triggerFeedback('error');
      // שימוש בלוכד השגיאות החכם שלנו
      toast.error(err.message || 'שגיאה ברכישת הבוסט');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <FadeIn className="px-3 pt-6 pb-28 flex flex-col gap-6">
      
      {/* Header */}
      <div className="px-1 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter drop-shadow-md">חנות סטטוס</h1>
          
        </div>
        
        {/* יתרה מהירה בפינה שמזכירה למשתמש כמה כוח יש לו */}
        <button onClick={() => navigate('/wallet')} className="flex flex-col items-end bg-black/40 px-3 py-1.5 rounded-xl border border-white/10 shadow-inner active:scale-95 transition-transform">
           <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">היתרה שלך</span>
           <span className="text-sm font-black text-white flex items-center gap-1">
             {profile?.credits?.toLocaleString() || 0} <span className="text-[10px] text-yellow-400">CRD</span>
           </span>
        </button>
      </div>

      {/* Hero Banner מפתה */}
      <GlassCard className="mx-1 p-0 overflow-hidden relative border-white/10">
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-purple-500/20 via-transparent to-yellow-500/20 blur-2xl" />
        <div className="p-6 relative z-10 flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.1)] mb-2 backdrop-blur-xl">
            <Star size={32} className="text-white drop-shadow-lg" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">לבלוט מעל כולם</h2>
          <p className="text-white/60 text-sm font-bold leading-relaxed px-4">
            במועדונים העמוסים, רק מי שזורח מקבל תשומת לב. השתמש בקרדיטים שלך כדי לקנות בוסטים ולהפוך לאגדה במעגל.
          </p>
        </div>
      </GlassCard>

      {/* רשימת הבוסטים לקנייה */}
      <div className="flex flex-col gap-4 mx-1 mt-2">
        {BOOSTS.map((boost) => {
          const Icon = boost.icon;
          const isProcessing = processingId === boost.id;

          return (
            <GlassCard key={boost.id} className="p-1 bg-white/5 border-white/10 overflow-hidden relative group">
              {/* אפקט זוהר משתנה לפי סוג הבוסט */}
              <div className={`absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-transparent to-${boost.color.split('-')[1]}-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              
              <div className="p-4 flex gap-4 relative z-10">
                <div className={`w-14 h-14 shrink-0 rounded-[20px] flex items-center justify-center border shadow-inner ${boost.bg} ${boost.border} ${boost.color}`}>
                  <Icon size={24} className="drop-shadow-md" />
                </div>
                
                <div className="flex-1 flex flex-col justify-center min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-black text-lg text-white truncate drop-shadow-sm">{boost.title}</h3>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-black/40 text-white/50 px-2 py-1 rounded-md border border-white/5">
                      {boost.duration}
                    </span>
                  </div>
                  <p className="text-white/50 text-xs font-bold leading-snug pr-1">
                    {boost.description}
                  </p>
                </div>
              </div>

              {/* Action Area */}
              <div className="px-4 pb-4 pt-2 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-black text-lg">
                  <span className="text-white">{boost.price}</span>
                  <span className="text-[10px] text-white/40 tracking-widest uppercase">CRD</span>
                </div>
                
                <Button 
                  onClick={() => handleBuyBoost(boost)}
                  disabled={isProcessing}
                  className={`h-10 px-6 text-sm bg-white/10 hover:bg-white/20 border-white/20 shadow-[0_4px_15px_rgba(255,255,255,0.05)] ${isProcessing ? 'opacity-70' : ''}`}
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : 'הפעל עכשיו'}
                </Button>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </FadeIn>
  );
};
