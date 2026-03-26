import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Search, Flame, EyeOff, TrendingUp, Brain, Heart, Smile, Users, Lock, Sparkles, Rocket, ArrowUpLeft, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { FadeIn } from '../components/ui';

type Circle = { id: string; slug: string; name: string; description?: string | null; cover_url?: string | null; members_count?: number | null; join_price?: number | null; vip_price?: number | null; };
type DiscoverResponse = Circle[] | { items?: Circle[] };

const VIBES = [
  { id: 'all', label: 'הכל', icon: Sparkles, color: 'text-white', bg: 'bg-white/10', border: 'border-white/20' },
  { id: 'drama', label: 'דרמה', icon: Flame, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  { id: 'secrets', label: 'סודות', icon: EyeOff, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  { id: 'money', label: 'כסף', icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  { id: 'knowledge', label: 'ידע', icon: Brain, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { id: 'funny', label: 'מצחיק', icon: Smile, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  { id: 'love', label: 'זוגיות', icon: Heart, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
];

export const DiscoverPage: React.FC = () => {
  const [items, setItems] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeVibe, setActiveVibe] = useState('all');

  const loadDiscover = async (q: string = '') => {
    try {
      setLoading(true);
      const result = await apiFetch<DiscoverResponse>(`/api/discover?q=${encodeURIComponent(q)}`);
      if (Array.isArray(result)) setItems(result);
      else if (result.items) setItems(result.items);
      else setItems([]);
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בטעינת החיפוש');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadDiscover(searchQuery);
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const filteredItems = items.filter(item => {
    if (activeVibe === 'all') return true;
    const nameStr = (item.name + (item.description || '')).toLowerCase();
    if (activeVibe === 'drama' && nameStr.includes('דרמה')) return true;
    if (activeVibe === 'money' && (nameStr.includes('כסף') || nameStr.includes('השקעות'))) return true;
    return Math.random() > 0.3; 
  });

  return (
    <FadeIn className="px-4 pt-10 pb-28 flex flex-col gap-6 bg-[#030303] min-h-screen font-sans" dir="rtl">
      
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black text-white tracking-tighter drop-shadow-md">חיפוש</h1>
      </div>

      <div className="relative">
        <Search size={20} className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
        <input 
          type="text"
          placeholder="חפש קהילות, יוצרים או תדרים..." 
          value={searchQuery}
          onChange={(e: any) => setSearchQuery(e.target.value)}
          className="w-full bg-[#0A0A0A] border border-white/5 text-white placeholder:text-white/20 h-16 pr-14 pl-5 rounded-[24px] shadow-inner focus:outline-none focus:border-white/20 focus:bg-[#0f1115] transition-all font-bold text-sm"
        />
      </div>

      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 py-1">
        <div className="flex gap-2 w-max">
          {VIBES.map((vibe) => {
            const isActive = activeVibe === vibe.id;
            const Icon = vibe.icon;
            return (
              <button
                key={vibe.id}
                onClick={() => setActiveVibe(vibe.id)}
                className={`flex items-center gap-2 h-12 px-5 rounded-[18px] border text-xs font-black transition-all whitespace-nowrap ${
                  isActive 
                    ? `${vibe.bg} ${vibe.color} ${vibe.border} shadow-inner` 
                    : 'bg-[#0A0A0A] text-white/40 border-white/5 hover:bg-white/5 hover:border-white/10'
                }`}
              >
                <Icon size={14} className={isActive ? vibe.color : 'opacity-40'} />
                {vibe.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2 text-white/50 text-xs font-black tracking-widest uppercase">
           <Rocket size={14} className="text-blue-400" /> צומחים עכשיו
        </div>
        <span className="text-[9px] text-white/30 font-bold bg-white/5 px-2 py-1 rounded-md border border-white/5 shadow-inner uppercase tracking-widest">
          מותאם עבורך
        </span>
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center text-white/20 font-black tracking-widest animate-pulse text-sm">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-[#0A0A0A] border border-white/5 rounded-[32px] text-center py-20 flex flex-col items-center justify-center shadow-inner mt-4">
          <Search size={40} className="text-white/10 mb-4" />
          <h3 className="text-xl font-black text-white/80 mb-2">אין תוצאות לחיפוש הזה</h3>
          <p className="text-white/30 text-xs font-bold">נסה לחפש משהו אחר או שנה תדר.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filteredItems.map((circle) => {
             const membersCount = circle.members_count || 1;
             const activeNow = Math.max(1, Math.ceil(membersCount * 0.2 + Math.random() * 2));

             return (
              <Link key={circle.id} to={`/circle/${encodeURIComponent(circle.slug || circle.id)}`} className="block group outline-none active:scale-95 transition-transform duration-200">
                <div className="p-0 overflow-hidden rounded-[24px] bg-[#0A0A0A] border border-white/5 group-hover:border-white/20 transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
                  
                  <div className="relative h-40">
                    <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url(${circle.cover_url || ''})` }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-black/30 to-transparent" />
                    
                    <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/60 border border-white/10 text-[9px] font-black text-white/80 flex items-center gap-1 backdrop-blur-md">
                      <Lock size={10} className="text-red-400" /> VIP
                    </div>

                    <div className="absolute bottom-3 right-3 left-3 z-10">
                      <h3 className="text-white text-base font-black drop-shadow-lg leading-tight mb-1.5 truncate">
                        {circle.name}
                      </h3>
                      <div className="px-2 py-1.5 rounded-lg bg-white/10 border border-white/10 text-[9px] font-black text-white flex items-center gap-1.5 shadow-inner backdrop-blur-xl w-fit">
                        <Users size={10} className="text-green-400" /> {activeNow} אונליין
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-[#050505] border-t border-white/5 flex justify-between items-center group-hover:bg-[#080808] transition-colors">
                     <span className="text-white/30 text-[9px] font-black uppercase tracking-widest">Premium</span>
                     <div className="w-8 h-8 rounded-[10px] bg-[#1A1C20] border border-white/5 flex items-center justify-center group-hover:text-white text-white/50 transition-colors shadow-inner">
                        <ArrowUpLeft size={16} />
                     </div>
                  </div>

                </div>
              </Link>
             );
          })}
        </div>
      )}
    </FadeIn>
  );
};
