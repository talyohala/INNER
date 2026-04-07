import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronLeft, Loader2, UserCircle, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { FadeIn } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

// להבת אש פועמת וטבעית
const RealFlame: React.FC = () => {
  return (
    <motion.span
      animate={{ scale: [1, 1.15, 1], rotate: [0, -5, 5, 0] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      className="text-[16px] drop-shadow-md inline-block"
    >
      🔥
    </motion.span>
  );
};

const VIBES = ['הכל', 'דרמה', 'סודות', 'כסף', 'ידע', 'זוגיות'];

export const ExplorePage: React.FC = () => {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [activeVibe, setActiveVibe] = useState('הכל');
  
  const [circles, setCircles] = useState<any[]>([]);
  const [usersListData, setUsersListData] = useState<any[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  
  const [recentSearches, setRecentSearches] = useState<string[]>(
    JSON.parse(localStorage.getItem('inner_recent_searches') || '[]')
  );
  
  const [loadingCircles, setLoadingCircles] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  const saveRecentSearch = (term: string) => {
    if (!term.trim()) return;
    const updated = [term, ...recentSearches.filter((t) => t !== term)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('inner_recent_searches', JSON.stringify(updated));
  };

  const removeRecentSearch = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentSearches.filter((t) => t !== term);
    setRecentSearches(updated);
    localStorage.setItem('inner_recent_searches', JSON.stringify(updated));
  };

  // 1. שליפת מועדונים למסך הראשי
  useEffect(() => {
    const fetchCircles = async () => {
      try {
        setLoadingCircles(true);
        const data = await apiFetch<any[]>('/api/circles');
        
        const formatted = (Array.isArray(data) ? data : []).map((c: any) => ({
          ...c,
          active_now: Math.max(1, Math.ceil((c.members_count || 5) * 0.2 + Math.random() * 4)),
          is_trending: Math.random() > 0.5 // סימולציה של טרנד
        }));
        
        setCircles(formatted);
      } catch {
      } finally {
        setLoadingCircles(false);
      }
    };
    fetchCircles();
  }, []);

  // 2. שליפת משתמשים מומלצים למסך הראשי
  useEffect(() => {
    const fetchSuggested = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, bio')
          .limit(5);
        if (!error && data) setSuggestedUsers(data);
      } catch (err) {
      } finally {
        setLoadingSuggestions(false);
      }
    };
    fetchSuggested();
  }, []);

  // 3. חיפוש חכם (Debounced) - שולף משתמשים כשהחיפוש משתנה
  useEffect(() => {
    const fetchUsers = async () => {
      if (!search.trim()) {
        setUsersListData([]);
        return;
      }
      setLoadingUsers(true);
      try {
        const query = supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, bio')
          .or(`full_name.ilike.%${search}%,username.ilike.%${search}%`)
          .limit(15);

        const { data, error } = await query;
        if (data) setUsersListData(data);
      } catch (err) {
      } finally {
        setLoadingUsers(false);
      }
    };
    const timeoutId = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [search]);

  // סינון מקומי של מועדונים לפי החיפוש וה-Vibe
  const filteredCircles = circles.filter((c) => {
    const searchLower = search.trim().toLowerCase();
    const nameMatch = c.name?.toLowerCase().includes(searchLower);
    const descMatch = c.description?.toLowerCase().includes(searchLower);
    const matchesSearch = searchLower === '' || nameMatch || descMatch;

    let matchesVibe = true;
    if (activeVibe !== 'הכל' && !search.trim()) {
      matchesVibe = c.name?.includes(activeVibe) || c.description?.includes(activeVibe) || Math.random() > 0.5;
    }
    
    return matchesSearch && matchesVibe;
  });

  return (
    <FadeIn className="pt-[calc(env(safe-area-inset-top)+12px)] pb-28 bg-surface min-h-screen font-sans flex flex-col gap-6 overflow-x-hidden" dir="rtl">
      
      {/* שורת חיפוש חכמה ומרכזית */}
      <div className="relative z-20 px-4 sticky top-0 bg-surface/90 backdrop-blur-xl py-2 shadow-sm border-b border-surface-border">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חפש מועדונים ואנשים..."
          className="w-full bg-transparent border border-surface-border rounded-full py-4 pr-12 pl-12 text-brand text-[16px] font-bold placeholder:text-brand-muted outline-none transition-all focus:border-accent-primary"
        />
        <Search size={20} className="absolute right-8 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" />
        {search && (
          <button onClick={() => { triggerFeedback('pop'); setSearch(''); }} className="absolute left-7 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand transition-colors p-1">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 mt-2">
        <AnimatePresence mode="wait">
          {/* מצב 1: חיפוש פעיל (מציג תוצאות משולבות של מועדונים ומשתמשים) */}
          {search.trim() ? (
            <motion.div key="search-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">
              
              {/* תוצאות מועדונים */}
              {filteredCircles.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-4">מועדונים</span>
                  <div className="mx-2 bg-surface-card border border-surface-border rounded-[24px] overflow-hidden flex flex-col">
                    {filteredCircles.map((circle, idx) => (
                      <div 
                        key={circle.id} 
                        onClick={() => { saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/circle/${circle.slug}`); }} 
                        className={`py-4 px-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors ${idx !== filteredCircles.length - 1 ? 'border-b border-surface-border' : ''}`}
                      >
                        <div className="flex items-center gap-4 text-right">
                          {circle.cover_url ? (
                            <img src={circle.cover_url} className="w-12 h-12 rounded-full object-cover border border-surface-border" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-surface border border-surface-border flex items-center justify-center text-brand-muted font-black text-xl">
                              {circle.name?.charAt(0)}
                            </div>
                          )}
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-brand font-black text-[16px]">{circle.name}</span>
                              <span className="text-[9px] bg-accent-primary/10 text-accent-primary px-1.5 py-0.5 rounded font-black">מועדון</span>
                            </div>
                            <span className="text-brand-muted text-[12px] font-medium mt-0.5">{circle.members_count || 0} חברים</span>
                          </div>
                        </div>
                        <ChevronLeft size={18} className="text-brand-muted" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* תוצאות משתמשים */}
              {loadingUsers ? (
                <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-accent-primary" /></div>
              ) : usersListData.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-4">משתמשים</span>
                  <div className="mx-2 bg-surface-card border border-surface-border rounded-[24px] overflow-hidden flex flex-col">
                    {usersListData.map((u, idx) => (
                      <div 
                        key={u.id} 
                        onClick={() => { saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/profile/${u.id}`); }} 
                        className={`py-4 px-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors ${idx !== usersListData.length - 1 ? 'border-b border-surface-border' : ''}`}
                      >
                        <div className="flex items-center gap-4 text-right">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} className="w-12 h-12 rounded-full object-cover border border-surface-border" />
                          ) : (
                            <UserCircle size={48} className="text-brand-muted" strokeWidth={1} />
                          )}
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-brand text-[16px] font-black">{u.full_name || 'משתמש'}</span>
                              <span className="text-[9px] bg-surface border border-surface-border text-brand-muted px-1.5 py-0.5 rounded font-black">משתמש</span>
                            </div>
                            <span className="text-brand-muted text-[12px] font-medium mt-0.5" dir="ltr">@{u.username || 'user'}</span>
                          </div>
                        </div>
                        <ChevronLeft size={18} className="text-brand-muted" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* הודעת "אין תוצאות" אם הכל ריק */}
              {filteredCircles.length === 0 && usersListData.length === 0 && !loadingUsers && (
                <div className="text-center py-16 flex flex-col items-center gap-4">
                  <span className="text-brand-muted font-medium text-[16px]">לא נמצאו תוצאות לחיפוש הזה</span>
                </div>
              )}
            </motion.div>
          ) : (
            
            /* מצב 2: מסך הבית של הראדר (מועדונים ומשתמשים מומלצים) */
            <motion.div key="explore-home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-8">
              
              {/* חיפושים אחרונים */}
              {recentSearches.length > 0 && (
                <div className="flex flex-col px-4 gap-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-brand-muted text-[11px] font-bold uppercase tracking-widest">חיפושים אחרונים</span>
                    <button onClick={() => { triggerFeedback('pop'); setRecentSearches([]); localStorage.removeItem('inner_recent_searches'); }} className="text-accent-primary text-[11px] font-bold">נקה</button>
                  </div>
                  <div className="bg-surface-card border border-surface-border rounded-[20px] flex flex-col overflow-hidden">
                    {recentSearches.map((term, i) => (
                      <div key={i} className={`flex items-center justify-between py-3.5 px-4 cursor-pointer hover:bg-white/5 transition-colors ${i !== recentSearches.length -1 ? 'border-b border-surface-border' : ''}`} onClick={() => { triggerFeedback('pop'); setSearch(term); }}>
                        <span className="text-brand font-medium text-[15px]">{term}</span>
                        <button onClick={(e) => removeRecentSearch(term, e)} className="text-brand-muted hover:text-brand p-1"><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* תגיות Vibe (רק למסך הראשי) */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide px-4">
                {VIBES.map((vibe) => (
                  <button 
                    key={vibe} 
                    onClick={() => { triggerFeedback('pop'); setActiveVibe(vibe); }} 
                    className={`text-[13px] font-bold whitespace-nowrap transition-all px-4 py-1.5 rounded-full border ${activeVibe === vibe ? 'bg-accent-primary/10 border-accent-primary text-accent-primary' : 'bg-transparent border-surface-border text-brand-muted hover:text-brand'}`}
                  >
                    {vibe}
                  </button>
                ))}
              </div>

              {/* מועדונים (מחולק לגריד) */}
              <div className="flex flex-col gap-3">
                <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-4">מועדונים פופולריים</span>
                
                {loadingCircles ? (
                  <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-accent-primary" /></div>
                ) : filteredCircles.length === 0 ? (
                  <div className="text-center py-10"><span className="text-brand-muted font-medium text-[14px]">לא נמצאו מועדונים בתדר הזה</span></div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 px-4">
                    {filteredCircles.map((circle, idx) => (
                      <motion.div 
                        key={circle.id} 
                        layout 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ duration: 0.2, delay: Math.min(idx * 0.05, 0.2) }}
                        onClick={() => { triggerFeedback('pop'); navigate(`/circle/${circle.slug}`); }} 
                        className="cursor-pointer active:scale-95 transition-transform duration-200"
                      >
                        <div className="h-[200px] rounded-[24px] bg-surface-card border border-surface-border shadow-md flex flex-col relative overflow-hidden">
                          <div className="absolute inset-0 z-0 bg-surface">
                            {circle.cover_url ? (
                              <img src={circle.cover_url} className="w-full h-full object-cover opacity-80" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-brand-muted font-black text-5xl bg-surface">
                                {circle.name?.charAt(0)}
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-surface-card via-surface-card/60 to-transparent" />
                          </div>

                          <div className="relative z-10 p-3 flex justify-end">
                            {circle.is_trending && <RealFlame />}
                          </div>

                          <div className="relative z-10 mt-auto p-3">
                            <h3 className="text-white font-black text-[15px] leading-tight drop-shadow-md truncate">
                              {circle.name}
                            </h3>
                            <p className="text-white/80 text-[11px] mt-0.5 mb-2 line-clamp-1 font-medium drop-shadow-md">
                              {circle.description || 'היכנס כדי לגלות מה קורה בפנים...'}
                            </p>
                            
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_#22c55e]" />
                              <span className="text-[11px] font-black text-white drop-shadow-md">{circle.active_now} אונליין</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* אנשים ששווה להכיר */}
              <div className="flex flex-col gap-3 pb-8">
                <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-4">אנשים ששווה להכיר</span>
                {loadingSuggestions ? (
                  <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-accent-primary" /></div>
                ) : (
                  <div className="mx-4 bg-surface-card border border-surface-border rounded-[24px] overflow-hidden flex flex-col shadow-sm">
                    {suggestedUsers.map((u, i) => (
                      <div 
                        key={u.id} 
                        className={`py-4 px-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors ${i !== suggestedUsers.length -1 ? 'border-b border-surface-border' : ''}`} 
                        onClick={() => { triggerFeedback('pop'); navigate(`/profile/${u.id}`); }}
                      >
                        <div className="flex items-center gap-4 text-right">
                          <div className="w-12 h-12 rounded-full border border-surface-border bg-surface overflow-hidden shrink-0 flex items-center justify-center">
                            {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={48} className="text-brand-muted" strokeWidth={1} />}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-brand font-black text-[16px]">{u.full_name || 'משתמש'}</span>
                            <span className="text-brand-muted text-[12px] font-medium mt-0.5" dir="ltr">@{u.username || 'user'}</span>
                          </div>
                        </div>
                        <ChevronLeft size={18} className="text-brand-muted" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FadeIn>
  );
};
