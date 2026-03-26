import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Users, Lock, Flame, Sparkles, Target, MessageCircle, ArrowUpRight } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { FadeIn } from '../components/ui';

type Circle = { id: string; slug: string; name: string; description?: string | null; cover_url?: string | null; members_count?: number | null; vip_price?: number | null; created_at?: string | null; };
type FeedResponse = Circle[] | { items?: Circle[]; circles?: Circle[]; data?: Circle[]; };
type FeedTab = 'hot' | 'new' | 'foryou';

const TABS = [
  { key: 'hot', label: 'חם עכשיו', icon: Flame, color: 'text-orange-400' },
  { key: 'new', label: 'חדשים', icon: Sparkles, color: 'text-blue-400' },
  { key: 'foryou', label: 'בשבילך', icon: Target, color: 'text-purple-400' },
] as const;

export const FeedPage: React.FC = () => {
  const [items, setItems] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FeedTab>('hot');

  const normalizeItems = (payload: FeedResponse): Circle[] => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray((payload as any)?.items)) return (payload as any).items;
    return [];
  };

  const loadFeed = async () => {
    try {
      setLoading(true);
      const result = await apiFetch<FeedResponse>('/api/feed');
      setItems(normalizeItems(result));
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בטעינת הפיד');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFeed(); }, []);

  const sortedItems = useMemo(() => {
    const arr = [...items];
    if (activeTab === 'new') return arr.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    if (activeTab === 'foryou') return arr.sort(() => Math.random() - 0.5);
    // ברירת מחדל (חם): משקלל חברים ומחיר VIP
    return arr.sort((a, b) => ((Number(b.members_count) || 0) * 2 + (Number(b.vip_price) || 0)) - ((Number(a.members_count) || 0) * 2 + (Number(a.vip_price) || 0)));
  }, [items, activeTab]);

  if (loading) return <div className="min-h-screen bg-[#030303] flex items-center justify-center text-white/20 font-black animate-pulse text-xl tracking-widest uppercase">SCANNING...</div>;

  return (
    <FadeIn className="px-4 pt-10 pb-28 flex flex-col gap-6 bg-[#030303] min-h-screen font-sans" dir="rtl">
      
      {/* כותרת עליונה */}
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black text-white tracking-tighter drop-shadow-md">פיד</h1>
      </div>

      {/* טאבים לניווט */}
      <div className="flex gap-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as FeedTab)}
              className={`flex-1 h-12 rounded-[18px] border text-xs font-black transition-all duration-300 flex items-center justify-center gap-2 ${
                isActive 
                  ? 'bg-[#1A1C20] text-white border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)]' 
                  : 'bg-transparent text-white/40 border-transparent hover:bg-white/5'
              }`}
            >
              <Icon size={14} className={isActive ? tab.color : 'opacity-40'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {sortedItems.length === 0 ? (
        <div className="bg-[#0A0A0A] border border-white/5 rounded-[32px] text-center py-20 flex flex-col items-center justify-center shadow-inner">
          <Flame size={40} className="text-white/10 mb-4" />
          <h3 className="text-xl font-black text-white/80 mb-2">אין קהילות בתדר הזה</h3>
          <p className="text-white/30 text-sm font-bold">תהיה הראשון להדליק את האור.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {sortedItems.map((circle) => {
             // חישוב סטטיסטיקת "לייב" מזויפת (עד שיהיה מנוע WebSockets מלא) כדי לייצר FOMO
             const membersCount = circle.members_count || 1;
             const activeNow = Math.max(1, Math.ceil(membersCount * 0.15 + (Math.random() * 3)));
             const chattingNow = Math.max(0, Math.ceil(activeNow * 0.3));

             return (
              <Link 
                key={circle.id} 
                to={`/circle/${encodeURIComponent(circle.slug || circle.id)}`} 
                className="block group outline-none active:scale-[0.98] transition-transform duration-200"
              >
                <div className="p-0 overflow-hidden rounded-[32px] bg-[#0A0A0A] border border-white/5 group-hover:border-white/20 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
                  
                  {/* חלק עליון - קאבר וסמלים */}
                  <div className="relative h-64">
                    <div className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105" style={{ backgroundImage: `url(${circle.cover_url || ''})` }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-black/40 to-black/10" />
                    
                    {/* תגית VIP */}
                    <div className="absolute top-4 right-4 px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-[10px] font-black text-white/90 flex items-center gap-1.5 backdrop-blur-md">
                      <Lock size={12} className="text-white/50" /> VIP
                    </div>

                    {/* כותרת ואינדיקטורים */}
                    <div className="absolute bottom-5 right-5 left-5 z-10 flex flex-col gap-3">
                      <h3 className="text-white text-3xl font-black drop-shadow-2xl truncate leading-none">{circle.name}</h3>
                      
                      <div className="flex gap-2">
                        {chattingNow > 0 && (
                          <div className="px-3 py-1.5 rounded-[12px] bg-yellow-500/10 border border-yellow-500/20 text-[10px] font-black text-yellow-500 flex items-center gap-1.5 backdrop-blur-md">
                            <MessageCircle size={12} /> {chattingNow} מדברים
                          </div>
                        )}
                        <div className="px-3 py-1.5 rounded-[12px] bg-white/5 border border-white/10 text-[10px] font-black text-white/80 flex items-center gap-1.5 backdrop-blur-md">
                          <Users size={12} className="text-green-400" /> {activeNow} אונליין
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* חלק תחתון - טיזר וכפתור חץ */}
                  <div className="p-5 flex flex-col gap-4 border-t border-white/5 bg-[#050505]">
                    {circle.description && (
                       <p className="text-white/50 text-sm font-medium leading-relaxed line-clamp-2 text-right">
                         {circle.description}
                       </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                       <span className="text-white/30 text-[9px] font-black uppercase tracking-widest">Premium Access</span>
                       <div className="w-12 h-12 bg-[#1A1C20] rounded-xl border border-white/5 group-hover:bg-white/10 group-hover:scale-105 transition-all duration-300 flex items-center justify-center shadow-inner">
                         <ArrowUpRight size={22} className="text-white/60 group-hover:text-white transition-colors" />
                       </div>
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
