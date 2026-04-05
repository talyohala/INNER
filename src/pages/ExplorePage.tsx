import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronLeft, Loader2, UserCircle, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
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

  const sectionTitleClass =
    'text-brand-muted text-[10px] font-black tracking-[0.18em] uppercase text-center px-1';

  return (
    <FadeIn
      className="px-4 pt-9 pb-28 bg-surface min-h-screen font-sans flex flex-col gap-5 overflow-x-hidden relative"
      dir="rtl"
    >
      {/* רקע עננים לבנים כדי לייצר אור והשתקפות לזכוכית */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-15%] w-[60%] h-[40%] bg-white/10 blur-[130px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[20%] right-[-15%] w-[60%] h-[50%] bg-white/5 blur-[140px] rounded-full mix-blend-screen" />
      </div>

      <div className="flex flex-col items-center justify-center relative z-10 mb-1 mt-1">
        <h1 className="text-[23px] font-black text-brand tracking-tight drop-shadow-md">חיפוש</h1>
      </div>

      {/* שורת חיפוש למעלה - אפקט מראת זכוכית */}
      <div className="relative z-10">
        <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none">
          <Search size={18} className="text-white/60" />
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={activeMainTab === 'clubs' ? 'חפש מועדונים...' : 'חפש משתמשים...'}
          className="w-full bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)] rounded-full py-4 pr-12 pl-16 text-white text-[15px] font-medium placeholder:text-white/50 focus:border-white/40 focus:bg-white/15 transition-all outline-none h-14"
        />

        {search && (
          <button onClick={() => setSearch('')} className="absolute inset-y-0 left-3 flex items-center justify-center">
            <span className="text-white/80 hover:text-white text-[10px] font-bold uppercase tracking-widest bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] transition-colors active:scale-95">
              נקה
            </span>
          </button>
        )}
      </div>

      {/* טאבים מתחת לשורת החיפוש - זכוכית מראה */}
      <div className="relative z-10 flex w-full bg-white/10 backdrop-blur-[40px] p-1 rounded-full border border-white/20 shadow-[inset_0_1px_2px_rgba(255,255,255,0.2),0_8px_20px_rgba(0,0,0,0.2)]">
        <button
          onClick={() => {
            triggerFeedback('pop');
            setActiveMainTab('clubs');
            setSearch('');
          }}
          className={`flex-1 py-3 text-[13px] font-black transition-all rounded-full flex items-center justify-center ${
            activeMainTab === 'clubs' ? 'bg-white border border-white/40 text-black shadow-lg' : 'text-white/60 hover:text-white'
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
          className={`flex-1 py-3 text-[13px] font-black transition-all rounded-full flex items-center justify-center ${
            activeMainTab === 'users' ? 'bg-white border border-white/40 text-black shadow-lg' : 'text-white/60 hover:text-white'
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
            className="flex flex-col gap-3 relative z-10"
          >
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
              {VIBES.map((vibe) => (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  key={vibe}
                  onClick={() => {
                    triggerFeedback('pop');
                    setActiveVibe(vibe);
                  }}
                  className={`flex items-center justify-center px-5 h-10 rounded-full font-black text-[12px] transition-all shrink-0 border ${
                    activeVibe === vibe
                      ? 'bg-white/30 border-white/40 text-white backdrop-blur-xl shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]'
                      : 'bg-white/5 border-white/10 text-white/60 backdrop-blur-md hover:bg-white/10 hover:text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]'
                  }`}
                >
                  <span>{vibe}</span>
                </motion.button>
              ))}
            </div>

            {loading ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="animate-spin text-white/40" />
              </div>
            ) : filteredCircles.length === 0 ? (
              <div className="text-center py-16 flex flex-col items-center gap-3">
                <span className="text-white/70 font-black text-[15px]">לא מצאנו מועדון כזה</span>
                <Button onClick={() => navigate('/create-circle')} className="px-8 mt-1 rounded-full">
                  פתח מועדון משלך
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredCircles.map((circle, idx) => (
                  <motion.div
                    key={circle.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.3) }}
                    className="-mx-4 px-2"
                  >
                    <div
                      onClick={() => {
                        if (search.trim()) saveRecentSearch(search.trim());
                        triggerFeedback('pop');
                        navigate(`/circle/${circle.slug}`);
                      }}
                      className="bg-white/10 backdrop-blur-[30px] border border-white/20 p-4 rounded-[32px] flex items-center justify-between shadow-[inset_0_1px_2px_rgba(255,255,255,0.3),0_8px_20px_rgba(0,0,0,0.2)] cursor-pointer group hover:bg-white/15 hover:border-white/30 active:scale-[0.985] transition-all"
                    >
                      <div className="flex items-center gap-4 text-right">
                        <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 overflow-hidden shrink-0 shadow-inner p-0.5">
                          <div className="w-full h-full rounded-full overflow-hidden bg-black/50">
                            {circle.cover_url ? (
                              <img src={circle.cover_url} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/50 font-black text-xl">
                                {circle.name?.charAt(0)}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-white font-black text-[15px] drop-shadow-md">{circle.name}</span>
                          <span className="text-white/60 text-[10px] font-bold mt-1 tracking-widest">
                            {circle.members_count || 0} חברים
                          </span>
                        </div>
                      </div>

                      <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0 ml-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                        <ChevronLeft size={17} className="text-white/80" />
                      </div>
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
            className="flex flex-col gap-3 relative z-10"
          >
            {!search.trim() ? (
              <div className="flex flex-col gap-4">
                {recentSearches.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className={`${sectionTitleClass} flex items-center justify-between w-full px-1`}>
                      <span>חיפושים אחרונים</span>
                      <button
                        onClick={() => {
                          triggerFeedback('pop');
                          setRecentSearches([]);
                          localStorage.removeItem('inner_recent_searches');
                        }}
                        className="text-white/40 hover:text-white"
                      >
                        נקה הכל
                      </button>
                    </span>

                    <div className="-mx-4 px-2">
                      <div className="bg-white/10 backdrop-blur-[30px] rounded-[32px] p-2 flex flex-col shadow-[inset_0_1px_2px_rgba(255,255,255,0.3),0_8px_20px_rgba(0,0,0,0.2)] border border-white/20">
                        {recentSearches.map((term, i) => (
                          <div
                            key={i}
                            onClick={() => {
                              triggerFeedback('pop');
                              setSearch(term);
                            }}
                            className={`flex items-center justify-between p-4 cursor-pointer hover:bg-white/10 active:bg-white/20 transition-colors rounded-[24px] ${
                              i !== recentSearches.length - 1 ? 'border-b border-white/10 rounded-b-none' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Search size={16} className="text-white/60" />
                              <span className="text-white font-medium text-[14px]">{term}</span>
                            </div>

                            <button
                              onClick={(e) => removeRecentSearch(term, e)}
                              className="p-2 -m-2 opacity-50 hover:opacity-100 active:scale-90 transition-all"
                            >
                              <X size={16} className="text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <span className={sectionTitleClass}>משתמשים מובילים</span>

                  {loadingSuggestions ? (
                    <Loader2 className="animate-spin text-white/40 mx-auto mt-4" />
                  ) : (
                    <div className="-mx-4 px-2">
                      <div className="bg-white/10 backdrop-blur-[30px] rounded-[32px] p-2 flex flex-col shadow-[inset_0_1px_2px_rgba(255,255,255,0.3),0_8px_20px_rgba(0,0,0,0.2)] border border-white/20">
                        {suggestedUsers.map((u, i) => (
                          <div
                            key={u.id}
                            className={`flex items-center justify-between p-3 cursor-pointer hover:bg-white/10 active:bg-white/20 transition-all rounded-[24px] ${
                              i !== suggestedUsers.length - 1 ? 'border-b border-white/10 rounded-b-none' : ''
                            }`}
                            onClick={() => {
                              if (search.trim()) saveRecentSearch(search.trim());
                              triggerFeedback('pop');
                              navigate(`/profile/${u.id}`);
                            }}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 overflow-hidden relative shadow-[inset_0_1px_2px_rgba(255,255,255,0.3)] p-0.5">
                                <div className="w-full h-full rounded-full overflow-hidden bg-black/40">
                                  {u.avatar_url ? (
                                    <img src={u.avatar_url} className="w-full h-full object-cover" />
                                  ) : (
                                    <UserCircle size={20} className="m-auto mt-3 text-white/40" />
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-col text-right">
                                <span className="text-white font-black text-[14px]">{u.full_name || 'משתמש'}</span>
                                <span
                                  className="text-white/60 text-[10px] font-medium tracking-widest uppercase mt-0.5"
                                  dir="ltr"
                                >
                                  @{u.username || 'user'} • רמה {u.level || 1}
                                </span>
                              </div>
                            </div>

                            <div className="w-8 h-8 rounded-full border border-white/20 bg-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] flex items-center justify-center shrink-0">
                              <ChevronLeft size={16} className="text-white/80" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
                  <button
                    onClick={() => {
                      triggerFeedback('pop');
                      setActiveSearchTab('top');
                    }}
                    className={`px-5 py-2.5 rounded-full font-black text-[11px] uppercase tracking-widest whitespace-nowrap transition-all border ${
                      activeSearchTab === 'top'
                        ? 'bg-white/30 text-white border-white/40 shadow-[inset_0_1px_2px_rgba(255,255,255,0.5)]'
                        : 'bg-white/10 text-white/60 border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] hover:text-white'
                    }`}
                  >
                    מובילים
                  </button>

                  <button
                    onClick={() => {
                      triggerFeedback('pop');
                      setActiveSearchTab('accounts');
                    }}
                    className={`px-5 py-2.5 rounded-full font-black text-[11px] uppercase tracking-widest whitespace-nowrap transition-all border ${
                      activeSearchTab === 'accounts'
                        ? 'bg-white/30 text-white border-white/40 shadow-[inset_0_1px_2px_rgba(255,255,255,0.5)]'
                        : 'bg-white/10 text-white/60 border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] hover:text-white'
                    }`}
                  >
                    חשבונות
                  </button>

                  <button
                    onClick={() => {
                      triggerFeedback('pop');
                      setActiveSearchTab('tags');
                    }}
                    className={`px-5 py-2.5 rounded-full font-black text-[11px] uppercase tracking-widest whitespace-nowrap transition-all border ${
                      activeSearchTab === 'tags'
                        ? 'bg-white/30 text-white border-white/40 shadow-[inset_0_1px_2px_rgba(255,255,255,0.5)]'
                        : 'bg-white/10 text-white/60 border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] hover:text-white'
                    }`}
                  >
                    ביו
                  </button>
                </div>

                <div>
                  {loading ? (
                    <div className="py-16 flex justify-center">
                      <Loader2 className="animate-spin text-white/50" size={28} />
                    </div>
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key="users-list"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col gap-2"
                      >
                        {usersListData.length === 0 ? (
                          <div className="text-center py-16 flex flex-col items-center gap-3">
                            <span className="text-white/60 text-[14px] font-black">לא מצאנו תוצאות לחיפוש</span>
                          </div>
                        ) : (
                          <div className="-mx-4 px-2">
                            <div className="bg-white/10 backdrop-blur-[30px] rounded-[32px] p-2 flex flex-col shadow-[inset_0_1px_2px_rgba(255,255,255,0.3),0_8px_20px_rgba(0,0,0,0.2)] border border-white/20">
                              {usersListData.map((u, idx) => (
                                <motion.div
                                  key={u.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.2, delay: Math.min(idx * 0.05, 0.2) }}
                                >
                                  <div
                                    onClick={() => {
                                      if (search.trim()) saveRecentSearch(search.trim());
                                      triggerFeedback('pop');
                                      navigate(`/profile/${u.id}`);
                                    }}
                                    className={`p-3 flex items-center justify-between cursor-pointer hover:bg-white/10 active:bg-white/20 transition-colors rounded-[24px] ${
                                      idx !== usersListData.length - 1 ? 'border-b border-white/10 rounded-b-none' : ''
                                    }`}
                                  >
                                    <div className="flex items-center gap-4 text-right">
                                      <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 overflow-hidden shrink-0 relative shadow-[inset_0_1px_2px_rgba(255,255,255,0.3)] p-0.5">
                                        <div className="w-full h-full rounded-full overflow-hidden bg-black/40">
                                          {u.avatar_url ? (
                                            <img src={u.avatar_url} className="w-full h-full object-cover" />
                                          ) : (
                                            <UserCircle size={20} className="m-auto mt-4 text-white/40" />
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex flex-col">
                                        <span className="text-white text-[15px] font-black drop-shadow-md">{u.full_name || 'משתמש'}</span>
                                        <span
                                          className="text-white/60 text-[11px] font-bold mt-0.5 tracking-widest"
                                          dir="ltr"
                                        >
                                          @{u.username || 'user'}
                                        </span>
                                        {activeSearchTab === 'tags' && u.bio && (
                                          <span className="text-white/80 text-[10px] mt-1 line-clamp-1">{u.bio}</span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="w-8 h-8 rounded-full border border-white/20 bg-white/10 flex items-center justify-center shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                                      <ChevronLeft size={16} className="text-white/80" />
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>
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
