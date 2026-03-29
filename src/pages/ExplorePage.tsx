import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Users, ChevronLeft, Loader2, Flame, Ghost, DollarSign, Brain, Heart, Target, Radio } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

export const ExplorePage: React.FC = () => {
  const navigate = useNavigate();
  const [circles, setCircles] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeVibe, setActiveVibe] = useState('הכל');
  const [loading, setLoading] = useState(true);

  const VIBES = [
    { id: 'הכל', icon: Target, color: 'text-[#2196f3]' },
    { id: 'דרמה', icon: Flame, color: 'text-[#e91e63]' },
    { id: 'סודות', icon: Ghost, color: 'text-[#9c27b0]' },
    { id: 'כסף', icon: DollarSign, color: 'text-[#8bc34a]' },
    { id: 'ידע', icon: Brain, color: 'text-[#ff9800]' },
    { id: 'זוגיות', icon: Heart, color: 'text-[#f44336]' }
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
    <FadeIn className="px-4 pt-8 pb-32 bg-black min-h-screen font-sans flex flex-col gap-6 overflow-x-hidden relative" dir="rtl">
      
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex justify-center">
        <div className="absolute top-[-5%] left-[-10%] w-[50%] h-[40%] bg-white/10 blur-[100px] rounded-full mix-blend-screen"></div>
      </div>

      <div className="flex flex-col items-center justify-center relative z-10 mb-3 mt-2">
        <div className="flex items-center gap-3">
          <motion.div
            className="relative flex items-center justify-center mt-1"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          >
            <motion.div
              className="absolute w-10 h-10 bg-[#8bc34a]/20 rounded-full"
              animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
            />
            <Radio size={22} className="text-[#8bc34a] relative z-10 drop-shadow-[0_0_8px_rgba(139,195,74,0.5)]" />
          </motion.div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            הרדאר
          </h1>
        </div>
        {/* העדכון הקטן והקריטי פה */}
        <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">איתור מועדון בזמן אמת</span>
      </div>

      <div className="relative z-10">
        <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none">
          <Search size={18} className="text-[#2196f3] drop-shadow-[0_0_5px_rgba(33,150,243,0.4)]" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חפש מועדון חסוי..."
          className="w-full bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] py-4 pr-12 pl-4 text-white text-[15px] font-medium placeholder:text-white/30 focus:border-white/30 focus:bg-white/[0.06] transition-all shadow-2xl outline-none h-14"
        />
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-hide z-10 -mx-4 px-4">
        {VIBES.map(vibe => (
          <motion.button
            whileTap={{ scale: 0.95 }}
            key={vibe.id}
            onClick={() => handleVibeClick(vibe.id)}
            className={`flex items-center gap-2 px-5 h-12 rounded-[20px] font-black text-xs uppercase tracking-widest transition-all shrink-0 border ${
              activeVibe === vibe.id
                ? 'bg-white/10 border-white/20 text-white shadow-inner'
                : 'bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/5'
            }`}
          >
            <vibe.icon size={16} className={`${vibe.color} ${activeVibe === vibe.id ? 'drop-shadow-[0_0_8px_currentColor]' : ''}`} />
            {vibe.id}
          </motion.button>
        ))}
      </div>

      <div className="flex flex-col gap-4 z-10 mb-6">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-white/20" /></div>
        ) : filteredCircles.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 flex flex-col items-center gap-4">
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}>
              <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
                <Ghost size={32} className="text-white/20" />
              </div>
            </motion.div>
            <div className="flex flex-col gap-1">
              <span className="text-white font-black text-[16px]">הרדאר לא מצא כלום</span>
              <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest">נסה לחפש ויב אחר או שם אחר</span>
            </div>
            {/* העדכון לכפתור יצירת מועדון */}
            <Button
              onClick={() => { triggerFeedback('pop'); navigate('/create-circle'); }}
              className="px-8 h-12 bg-white text-black font-black text-[13px] uppercase tracking-widest rounded-[20px] mt-4 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              פתח מועדון משלך
            </Button>
          </motion.div>
        ) : (
          <AnimatePresence>
            {filteredCircles.map((circle, idx) => {
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
                  <div
                    onClick={() => handleCircleClick(circle.slug)}
                    className="bg-white/[0.03] backdrop-blur-xl border border-white/10 p-4 rounded-[32px] flex flex-col gap-4 shadow-2xl cursor-pointer relative overflow-hidden group transition-all hover:bg-white/[0.06] active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-[24px] bg-black border border-white/10 overflow-hidden shrink-0 shadow-inner relative p-0.5">
                        <div className="w-full h-full rounded-[20px] overflow-hidden bg-[#111]">
                            {circle.cover_url ? (
                            <img src={circle.cover_url} className="w-full h-full object-cover" alt={circle.name} />
                            ) : (
                            <div className="w-full h-full flex items-center justify-center"><Users size={24} className="text-white/20" /></div>
                            )}
                        </div>
                        <div className="absolute bottom-1 right-1 w-2.5 h-2.5 bg-[#8bc34a] border-2 border-black rounded-full shadow-[0_0_8px_#8bc34a] animate-pulse"></div>
                      </div>

                      <div className="flex flex-col flex-1">
                        <div className="flex justify-between items-start">
                          <span className="text-white font-black text-[16px] tracking-tight">{circle.name}</span>
                          {isTrending && <Flame size={16} className="text-[#ff9800] drop-shadow-[0_0_5px_rgba(255,152,0,0.5)]" />}
                        </div>
                        <p className="text-white/40 text-[11px] font-medium mt-1 line-clamp-1">
                          {circle.description || 'המועדון הסודי נפתח. הצטרף עכשיו כדי לגלות.'}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-white/40 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-full border border-white/5">
                            <Users size={10} className="text-[#2196f3]" /> {circle.members_count || 0} חברים
                          </span>
                        </div>
                      </div>

                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/30 transition-colors shrink-0 group-hover:bg-white/10 group-hover:text-white/60">
                        <ChevronLeft size={16} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </FadeIn>
  );
};
