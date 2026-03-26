import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Users, ChevronLeft, Loader2, Flame, Ghost, DollarSign, Brain, Heart, Target, Radio, Sparkles } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { FadeIn, GlassCard, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

export const ExplorePage: React.FC = () => {
  const navigate = useNavigate();
  const [circles, setCircles] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeVibe, setActiveVibe] = useState('הכל');
  const [loading, setLoading] = useState(true);

  // Vibe Tags - פסיכולוגיה של רגש במקום קטגוריות טכניות
  const VIBES = [
    { id: 'הכל', icon: Target, color: 'text-white' },
    { id: 'דרמה', icon: Flame, color: 'text-red-400' },
    { id: 'סודות', icon: Ghost, color: 'text-purple-400' },
    { id: 'כסף', icon: DollarSign, color: 'text-green-400' },
    { id: 'ידע', icon: Brain, color: 'text-blue-400' },
    { id: 'זוגיות', icon: Heart, color: 'text-pink-400' }
  ];

  useEffect(() => {
    const fetchCircles = async () => {
      try {
        const data = await apiFetch<any[]>('/api/circles');
        setCircles(Array.isArray(data) ? data : []);
      } catch (err) { 
        console.error(err); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchCircles();
  }, []);

  // מנגנון סינון חכם
  const filteredCircles = circles.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase()) || c.description?.toLowerCase().includes(search.toLowerCase());
    const matchesVibe = activeVibe === 'הכל' || c.name?.includes(activeVibe) || c.description?.includes(activeVibe);
    return matchesSearch && matchesVibe;
  });

  const handleCircleClick = (slug: string) => {
    triggerFeedback('pop');
    navigate(`/circle/${slug}`);
  };

  const handleVibeClick = (vibeId: string) => {
    triggerFeedback('pop');
    setActiveVibe(vibeId);
  };

  return (
    <FadeIn className="px-5 pt-8 pb-32 bg-[#030303] min-h-screen font-sans flex flex-col gap-6 overflow-x-hidden relative" dir="rtl">
      
      {/* הדר מיושר לאמצע עם אייקון ליד (בלי זהב, סידור חדש) */}
      <div className="flex flex-col items-center justify-center relative z-10 mb-3 mt-2">
        <div className="flex items-center gap-3">
          <motion.div
            className="relative flex items-center justify-center mt-1"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          >
            {/* גלי רדאר ברקע (ירוק עדין) */}
            <motion.div
              className="absolute w-10 h-10 bg-green-500/10 rounded-full"
              animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
            />
            <Radio size={22} className="text-white/80 relative z-10" />
          </motion.div>
          
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            הרדאר <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></span>
          </h1>
        </div>
        <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">איתור קהילות בזמן אמת</span>
      </div>

      {/* שורת חיפוש צפה (Glass Search) */}
      <div className="relative z-10">
        <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none">
          <Search size={18} className="text-white/30" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חפש מועדון חסוי..."
          className="w-full bg-[#0A0A0A] border border-white/10 rounded-[24px] py-4 pr-12 pl-4 text-white text-sm font-black placeholder:text-white/20 focus:border-white/20 focus:bg-[#0f0f0f] transition-all shadow-[0_10px_30px_rgba(0,0,0,0.5)] outline-none h-14"
        />
      </div>

      {/* תגיות Vibe נגללות */}
      <div className="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-hide z-10 -mx-5 px-5">
        {VIBES.map(vibe => (
          <motion.button
            whileTap={{ scale: 0.9 }}
            key={vibe.id}
            onClick={() => handleVibeClick(vibe.id)}
            className={`flex items-center gap-2 px-5 h-12 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shrink-0 border ${
              activeVibe === vibe.id
                ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                : 'bg-[#0A0A0A] border-white/5 text-white/50 hover:bg-white/5'
            }`}
          >
            <vibe.icon size={16} className={activeVibe === vibe.id ? 'text-black' : vibe.color} /> 
            {vibe.id}
          </motion.button>
        ))}
      </div>

      {/* רשימת הקהילות עם אנימציות כניסה/יציאה */}
      <div className="flex flex-col gap-4 z-10">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-white/20" /></div>
        ) : filteredCircles.length === 0 ? (
          /* מצב ריק (Empty State) אקסקלוסיבי */
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 flex flex-col items-center gap-4">
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}>
              <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
                <Ghost size={32} className="text-white/20" />
              </div>
            </motion.div>
            <div className="flex flex-col gap-1">
              <span className="text-white font-black text-sm">הרדאר לא מצא כלום</span>
              <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest">נסה לחפש ויב אחר או שם אחר</span>
            </div>
            <Button 
              onClick={() => { triggerFeedback('pop'); navigate('/create-circle'); }}
              className="px-6 h-12 bg-white/[0.03] border border-white/10 text-white font-black text-xs uppercase tracking-widest rounded-2xl mt-4 hover:bg-white/10"
            >
              פתח מעגל משלך <Users size={14} className="ml-2 inline" />
            </Button>
          </motion.div>
        ) : (
          <AnimatePresence>
            {filteredCircles.map((circle, idx) => {
              // קהילות טרנדיות מקבלות הילה לבנה עדינה במקום זהב
              const isTrending = idx === 0 || circle.members_count > 50; 

              return (
                <motion.div
                  key={circle.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                >
                  <GlassCard
                    onClick={() => handleCircleClick(circle.slug)}
                    className={`bg-[#0A0A0A] border p-4 rounded-[28px] flex flex-col gap-4 shadow-lg cursor-pointer relative overflow-hidden group transition-all hover:bg-[#0f0f0f] active:scale-[0.98] ${
                      isTrending ? 'border-white/10 shadow-[0_5px_30px_rgba(255,255,255,0.03)]' : 'border-white/5'
                    }`}
                  >
                    {/* הילה קריסטלית עדינה ברקע לקהילות חמות */}
                    {isTrending && <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 blur-[40px] rounded-full pointer-events-none"></div>}

                    <div className="flex items-center gap-4">
                      {/* תמונת הקהילה */}
                      <div className="w-16 h-16 rounded-[20px] bg-[#050505] border border-white/5 overflow-hidden shrink-0 shadow-inner relative">
                        {circle.cover_url ? (
                          <img src={circle.cover_url} className="w-full h-full object-cover" alt={circle.name} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Users size={24} className="text-white/10" /></div>
                        )}
                        {/* אינדיקטור LIVE */}
                        <div className="absolute bottom-1 right-1 w-2.5 h-2.5 bg-green-500 border-2 border-[#050505] rounded-full shadow-[0_0_8px_#22c55e] animate-pulse"></div>
                      </div>

                      {/* פרטי הקהילה */}
                      <div className="flex flex-col flex-1">
                        <div className="flex justify-between items-start">
                          <span className="text-white font-black text-base tracking-tight">{circle.name}</span>
                          {/* אייקון להבה בצבע נייטרלי/לבן */}
                          {isTrending && <Flame size={16} className="text-white/60" />}
                        </div>
                        
                        <p className="text-white/40 text-[10px] font-bold mt-1 line-clamp-1">
                          {circle.description || 'המעגל הסודי נפתח. הצטרף עכשיו כדי לגלות.'}
                        </p>

                        <div className="flex items-center gap-3 mt-3">
                          <span className="text-white/30 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                            <Users size={10} /> {circle.members_count || 0} חברים
                          </span>
                        </div>
                      </div>

                      {/* חץ מעבר */}
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/30 transition-colors shrink-0 group-hover:bg-white/10 group-hover:text-white/60">
                        <ChevronLeft size={16} />
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </FadeIn>
  );
};
