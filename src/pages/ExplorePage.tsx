import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronLeft, Loader2, UserCircle, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { FadeIn } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

export const ExplorePage: React.FC = () => {
  const navigate = useNavigate();

  const [activeMainTab, setActiveMainTab] = useState<'clubs' | 'users'>('clubs');
  const [search, setSearch] = useState('');
  const [activeVibe, setActiveVibe] = useState('הכל');
  const [circles, setCircles] = useState<any[]>([]);
  const [activeSearchTab, setActiveSearchTab] = useState<'top' | 'accounts' | 'tags'>('top');
  const [usersListData, setUsersListData] = useState<any[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(
    JSON.parse(localStorage.getItem('inner_recent_searches') || '[]')
  );
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  const VIBES = ['הכל', 'דרמה', 'סודות', 'כסף', 'ידע', 'זוגיות'];

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

  useEffect(() => {
    const fetchSuggested = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, level')
          .order('level', { ascending: false })
          .limit(5);

        if (data) setSuggestedUsers(data);
      } catch {
      } finally {
        setLoadingSuggestions(false);
      }
    };

    fetchSuggested();
  }, []);

  useEffect(() => {
    const fetchCircles = async () => {
      try {
        setLoading(true);
        const data = await apiFetch<any[]>('/api/circles');
        setCircles(Array.isArray(data) ? data : []);
      } catch {
      } finally {
        setLoading(false);
      }
    };

    if (activeMainTab === 'clubs') fetchCircles();
  }, [activeMainTab]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (activeMainTab !== 'users' || !search.trim()) {
        setUsersListData([]);
        return;
      }

      setLoading(true);

      try {
        let query = supabase.from('profiles').select('id, full_name, username, avatar_url, level, bio');

        if (activeSearchTab === 'tags') {
          query = query.ilike('bio', `%${search}%`);
        } else {
          query = query.or(`full_name.ilike.%${search}%,username.ilike.%${search}%`);
          if (activeSearchTab === 'top') query = query.order('level', { ascending: false });
          if (activeSearchTab === 'accounts') query = query.order('full_name', { ascending: true });
        }

        const { data, error } = await query.limit(30);
        if (!error && data) setUsersListData(data);
      } catch {
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchUsers, 400);
    return () => clearTimeout(timeoutId);
  }, [search, activeMainTab, activeSearchTab]);

  const filteredCircles = circles.filter((c) => {
    const matchesSearch =
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase());
    const matchesVibe =
      activeVibe === 'הכל' || c.name?.includes(activeVibe) || c.description?.includes(activeVibe);
    return matchesSearch && matchesVibe;
  });

  return (
    <FadeIn
      className="px-5 pt-4 pb-28 min-h-screen font-sans flex flex-col gap-6 overflow-x-hidden relative"
      dir="rtl"
    >
      {/* תאורת שמפניה מרחפת ברקע */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[40%] bg-[#D4AF37]/5 dark:bg-[#D4AF37]/[0.02] blur-[140px] rounded-full mix-blend-screen" />
      </div>

      {/* שורת חיפוש סופר-שקופה */}
      <div className="relative flex items-center w-full mt-2 bg-black/[0.03] dark:bg-white/[0.02] border border-black/5 dark:border-white/10 rounded-full z-10 transition-all shadow-inner">
        <Search size={20} className="absolute right-5 text-black/30 dark:text-white/30 pointer-events-none" />
        
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={activeMainTab === 'clubs' ? 'חיפוש מועדונים...' : 'חיפוש משתמשים...'}
          className="w-full bg-transparent py-3.5 pr-14 pl-14 text-black dark:text-white text-[15px] font-bold placeholder:text-black/30 dark:placeholder:text-white/30 outline-none"
        />

        {search && (
          <button 
            onClick={() => { triggerFeedback('pop'); setSearch(''); }} 
            className="absolute left-4 text-black/30 dark:text-white/30 hover:text-black dark:hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* טאבים ראשיים - בועות שמפניה */}
      <div className="flex gap-2 bg-black/[0.03] dark:bg-white/[0.03] p-1.5 rounded-full border border-black/5 dark:border-white/10 z-10 relative">
        <button
          onClick={() => {
            triggerFeedback('pop');
            setActiveMainTab('clubs');
            setSearch('');
          }}
          className={`flex-1 py-2.5 text-[13px] font-black transition-all rounded-full flex items-center justify-center ${
            activeMainTab === 'clubs' ? 'bg-black dark:bg-white text-white dark:text-black shadow-md' : 'text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white'
          }`}
        >
          מועדונים
        </button>

        <button
          onClick={() => {
            triggerFeedback('pop');
            setActiveMainTab('users');
            setSearch('');
          }}
          className={`flex-1 py-2.5 text-[13px] font-black transition-all rounded-full flex items-center justify-center ${
            activeMainTab === 'users' ? 'bg-black dark:bg-white text-white dark:text-black shadow-md' : 'text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white'
          }`}
        >
          משתמשים
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeMainTab === 'clubs' && (
          <motion.div
            key="clubs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-6 z-10 relative"
          >
            {/* תגיות אווירה - נטו טקסט והדגשת שמפניה קלה */}
            <div className="flex items-center gap-6 overflow-x-auto pb-2 scrollbar-hide">
              {VIBES.map((vibe) => (
                <button
                  key={vibe}
                  onClick={() => {
                    triggerFeedback('pop');
                    setActiveVibe(vibe);
                  }}
                  className={`text-[14px] font-bold whitespace-nowrap transition-colors pb-1 border-b-2 ${
                    activeVibe === vibe ? 'text-[#D4AF37] border-[#D4AF37]' : 'text-black/40 dark:text-white/30 border-transparent hover:text-black/70 dark:hover:text-white/60'
                  }`}
                >
                  {vibe}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="animate-spin text-[#D4AF37]/50" />
              </div>
            ) : filteredCircles.length === 0 ? (
              <div className="text-center py-16 flex flex-col items-center gap-4">
                <span className="text-black/40 dark:text-white/40 font-medium text-[16px]">לא נמצאו מועדונים</span>
                <button onClick={() => navigate('/create-circle')} className="text-black dark:text-white font-bold underline underline-offset-4 opacity-70 hover:opacity-100 transition-opacity">
                  פתח מועדון משלך
                </button>
              </div>
            ) : (
              <div className="flex flex-col">
                {filteredCircles.map((circle, idx) => (
                  <motion.div
                    key={circle.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.3) }}
                  >
                    <div
                      onClick={() => {
                        if (search.trim()) saveRecentSearch(search.trim());
                        triggerFeedback('pop');
                        navigate(`/circle/${circle.slug}`);
                      }}
                      className="py-4 border-b border-black/5 dark:border-white/10 flex items-center justify-between cursor-pointer group hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors -mx-5 px-5"
                    >
                      <div className="flex items-center gap-5 text-right">
                        {circle.cover_url ? (
                          <img src={circle.cover_url} className="w-14 h-14 rounded-full object-cover shadow-sm border border-black/5 dark:border-white/10" />
                        ) : (
                          <UserCircle size={56} className="text-black/10 dark:text-white/10" strokeWidth={1} />
                        )}

                        <div className="flex flex-col">
                          <span className="text-black dark:text-white font-black text-[17px]">{circle.name}</span>
                          <span className="text-black/40 dark:text-white/40 text-[12px] font-medium mt-0.5">
                            {circle.members_count || 0} חברים
                          </span>
                        </div>
                      </div>

                      <ChevronLeft size={20} className="text-black/20 dark:text-white/20 group-hover:text-black/50 dark:group-hover:text-white/50 transition-colors" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeMainTab === 'users' && (
          <motion.div
            key="users"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-6 z-10 relative"
          >
            {!search.trim() ? (
              <div className="flex flex-col gap-8">
                {recentSearches.length > 0 && (
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-black/30 dark:text-white/30 text-[11px] font-bold uppercase tracking-widest">חיפושים אחרונים</span>
                      <button onClick={() => { triggerFeedback('pop'); setRecentSearches([]); localStorage.removeItem('inner_recent_searches'); }} className="text-[#D4AF37] hover:text-black dark:hover:text-white text-[11px] font-bold transition-colors">נקה</button>
                    </div>

                    <div className="flex flex-col">
                      {recentSearches.map((term, i) => (
                        <div key={i} className="flex items-center justify-between py-4 border-b border-black/5 dark:border-white/10 -mx-5 px-5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer transition-colors" onClick={() => { triggerFeedback('pop'); setSearch(term); }}>
                          <div className="flex items-center gap-4">
                            <Search size={18} className="text-black/30 dark:text-white/30" />
                            <span className="text-black dark:text-white font-medium text-[16px]">{term}</span>
                          </div>
                          <button onClick={(e) => removeRecentSearch(term, e)} className="opacity-30 hover:opacity-100 p-2 -m-2 transition-opacity">
                            <X size={18} className="text-black dark:text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col">
                  <span className="text-black/30 dark:text-white/30 text-[11px] font-bold uppercase tracking-widest mb-2">הצעות עבורך</span>

                  {loadingSuggestions ? (
                    <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-[#D4AF37]/50" /></div>
                  ) : (
                    <div className="flex flex-col">
                      {suggestedUsers.map((u) => (
                        <div key={u.id} className="py-4 border-b border-black/5 dark:border-white/10 flex items-center justify-between cursor-pointer group hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors -mx-5 px-5" onClick={() => { if (search.trim()) saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/profile/${u.id}`); }}>
                          <div className="flex items-center gap-5">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} className="w-14 h-14 rounded-full object-cover shadow-sm border border-black/5 dark:border-white/10" />
                            ) : (
                              <UserCircle size={56} className="text-black/10 dark:text-white/10" strokeWidth={1} />
                            )}
                            <div className="flex flex-col text-right">
                              <span className="text-black dark:text-white font-black text-[17px]">{u.full_name || 'משתמש'}</span>
                              <span className="text-black/40 dark:text-white/40 text-[12px] font-medium mt-0.5" dir="ltr">@{u.username || 'user'} • רמה {u.level || 1}</span>
                            </div>
                          </div>
                          <ChevronLeft size={20} className="text-black/20 dark:text-white/20 group-hover:text-black/50 dark:group-hover:text-white/50 transition-colors" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-8 overflow-x-auto scrollbar-hide pb-2">
                  <button onClick={() => { triggerFeedback('pop'); setActiveSearchTab('top'); }} className={`text-[14px] font-bold whitespace-nowrap transition-colors pb-1 border-b-2 ${activeSearchTab === 'top' ? 'text-[#D4AF37] border-[#D4AF37]' : 'text-black/40 dark:text-white/30 border-transparent hover:text-black/70 dark:hover:text-white/60'}`}>מובילים</button>
                  <button onClick={() => { triggerFeedback('pop'); setActiveSearchTab('accounts'); }} className={`text-[14px] font-bold whitespace-nowrap transition-colors pb-1 border-b-2 ${activeSearchTab === 'accounts' ? 'text-[#D4AF37] border-[#D4AF37]' : 'text-black/40 dark:text-white/30 border-transparent hover:text-black/70 dark:hover:text-white/60'}`}>חשבונות</button>
                  <button onClick={() => { triggerFeedback('pop'); setActiveSearchTab('tags'); }} className={`text-[14px] font-bold whitespace-nowrap transition-colors pb-1 border-b-2 ${activeSearchTab === 'tags' ? 'text-[#D4AF37] border-[#D4AF37]' : 'text-black/40 dark:text-white/30 border-transparent hover:text-black/70 dark:hover:text-white/60'}`}>ביו</button>
                </div>

                <div>
                  {loading ? (
                    <div className="py-16 flex justify-center">
                      <Loader2 className="animate-spin text-[#D4AF37]/50" size={28} />
                    </div>
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.div key="users-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col">
                        {usersListData.length === 0 ? (
                          <div className="text-center py-16 flex flex-col items-center gap-3">
                            <span className="text-black/40 dark:text-white/40 text-[16px] font-medium">לא מצאנו תוצאות</span>
                          </div>
                        ) : (
                          usersListData.map((u, idx) => (
                            <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(idx * 0.05, 0.2) }}>
                              <div onClick={() => { if (search.trim()) saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/profile/${u.id}`); }} className="py-4 border-b border-black/5 dark:border-white/10 flex items-center justify-between cursor-pointer group hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors -mx-5 px-5">
                                <div className="flex items-center gap-5 text-right">
                                  {u.avatar_url ? (
                                    <img src={u.avatar_url} className="w-14 h-14 rounded-full object-cover shadow-sm border border-black/5 dark:border-white/10" />
                                  ) : (
                                    <UserCircle size={56} className="text-black/10 dark:text-white/10" strokeWidth={1} />
                                  )}
                                  <div className="flex flex-col">
                                    <span className="text-black dark:text-white text-[17px] font-black">{u.full_name || 'משתמש'}</span>
                                    <span className="text-black/40 dark:text-white/40 text-[12px] font-medium mt-0.5" dir="ltr">@{u.username || 'user'}</span>
                                    {activeSearchTab === 'tags' && u.bio && <span className="text-black/60 dark:text-white/60 text-[11px] mt-1 line-clamp-1">{u.bio}</span>}
                                  </div>
                                </div>
                                <ChevronLeft size={20} className="text-black/20 dark:text-white/20 group-hover:text-black/50 dark:group-hover:text-white/50 transition-colors" />
                              </div>
                            </motion.div>
                          ))
                        )}
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </FadeIn>
  );
};
