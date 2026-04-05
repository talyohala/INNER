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
      className="px-4 pt-9 pb-28 bg-surface min-h-screen font-sans flex flex-col gap-4 overflow-x-hidden relative"
      dir="rtl"
    >
      <div className="flex flex-col items-center justify-center relative z-10 mb-1 mt-1">
        <h1 className="text-[23px] font-black text-brand tracking-tight">חיפוש</h1>
      </div>

      <div className="relative z-10 flex w-full bg-surface-card p-1 rounded-full border border-surface-border shadow-inner">
        <button
          onClick={() => {
            triggerFeedback('pop');
            setActiveMainTab('clubs');
            setSearch('');
          }}
          className={`flex-1 py-3 text-[13px] font-black transition-all rounded-full flex items-center justify-center ${
            activeMainTab === 'clubs' ? 'bg-brand text-surface shadow-md' : 'text-brand-muted hover:text-brand'
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
            activeMainTab === 'users' ? 'bg-brand text-surface shadow-md' : 'text-brand-muted hover:text-brand'
          }`}
        >
          משתמשים
        </button>
      </div>

      <div className="relative z-10">
        <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none">
          <Search size={18} className="text-brand-muted" />
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={activeMainTab === 'clubs' ? 'חפש מועדונים...' : 'חפש משתמשים...'}
          className="w-full bg-surface-card border border-surface-border rounded-full py-4 pr-12 pl-16 text-brand text-[15px] font-medium placeholder:text-brand-muted focus:border-brand/30 transition-all shadow-inner outline-none h-14"
        />

        {search && (
          <button onClick={() => setSearch('')} className="absolute inset-y-0 left-3 flex items-center justify-center">
            <span className="text-brand-muted hover:text-brand text-[10px] font-bold uppercase tracking-widest bg-surface-card px-4 py-2 rounded-full border border-surface-border transition-colors active:scale-95">
              נקה
            </span>
          </button>
        )}
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
                  className={`flex items-center justify-center px-5 h-10 rounded-full font-black text-[12px] transition-all shrink-0 border shadow-inner ${
                    activeVibe === vibe
                      ? 'bg-brand border-brand text-surface'
                      : 'bg-transparent border-surface-border text-brand-muted hover:bg-surface-card hover:text-brand'
                  }`}
                >
                  <span>{vibe}</span>
                </motion.button>
              ))}
            </div>

            {loading ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="animate-spin text-brand-muted" />
              </div>
            ) : filteredCircles.length === 0 ? (
              <div className="text-center py-16 flex flex-col items-center gap-3">
                <span className="text-brand-muted font-black text-[15px]">לא מצאנו מועדון כזה</span>
                <Button onClick={() => navigate('/create-circle')} className="px-8 mt-1 rounded-full shadow-lg border border-surface-border">
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
                      className="bg-surface-card border border-surface-border p-4 rounded-[30px] flex items-center justify-between shadow-lg cursor-pointer group hover:border-white/20 active:scale-[0.985] transition-all"
                    >
                      <div className="flex items-center gap-4 text-right">
                        <div className="w-14 h-14 rounded-full bg-surface border border-surface-border overflow-hidden shrink-0 shadow-inner p-0.5">
                          <div className="w-full h-full rounded-full overflow-hidden bg-surface-card">
                            {circle.cover_url ? (
                              <img src={circle.cover_url} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-brand-muted font-black text-xl">
                                {circle.name?.charAt(0)}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-brand font-black text-[15px]">{circle.name}</span>
                          <span className="text-brand-muted text-[10px] font-bold mt-1 tracking-widest">
                            {circle.members_count || 0} חברים
                          </span>
                        </div>
                      </div>

                      <div className="w-9 h-9 rounded-full bg-surface-card border border-surface-border flex items-center justify-center shrink-0 ml-1">
                        <ChevronLeft size={17} className="text-brand-muted" />
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
                        className="text-brand-muted hover:text-brand"
                      >
                        נקה הכל
                      </button>
                    </span>

                    <div className="-mx-4 px-2">
                      <div className="bg-surface-card rounded-[30px] p-2 flex flex-col shadow-lg border border-surface-border">
                        {recentSearches.map((term, i) => (
                          <div
                            key={i}
                            onClick={() => {
                              triggerFeedback('pop');
                              setSearch(term);
                            }}
                            className={`flex items-center justify-between p-4 cursor-pointer hover:bg-surface-card active:bg-surface border-surface-border transition-colors rounded-[22px] ${
                              i !== recentSearches.length - 1 ? 'border-b rounded-b-none' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Search size={16} className="text-brand-muted" />
                              <span className="text-brand font-medium text-[14px]">{term}</span>
                            </div>

                            <button
                              onClick={(e) => removeRecentSearch(term, e)}
                              className="p-2 -m-2 opacity-50 hover:opacity-100 active:scale-90 transition-all"
                            >
                              <X size={16} className="text-brand" />
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
                    <Loader2 className="animate-spin text-brand-muted mx-auto mt-4" />
                  ) : (
                    <div className="-mx-4 px-2">
                      <div className="bg-surface-card rounded-[30px] p-2 flex flex-col shadow-lg border border-surface-border">
                        {suggestedUsers.map((u, i) => (
                          <div
                            key={u.id}
                            className={`flex items-center justify-between p-3 cursor-pointer hover:bg-surface-card active:bg-surface border-surface-border transition-all rounded-[22px] ${
                              i !== suggestedUsers.length - 1 ? 'border-b rounded-b-none' : ''
                            }`}
                            onClick={() => {
                              if (search.trim()) saveRecentSearch(search.trim());
                              triggerFeedback('pop');
                              navigate(`/profile/${u.id}`);
                            }}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-surface border border-surface-border overflow-hidden relative shadow-inner p-0.5">
                                <div className="w-full h-full rounded-full overflow-hidden bg-surface-card">
                                  {u.avatar_url ? (
                                    <img src={u.avatar_url} className="w-full h-full object-cover" />
                                  ) : (
                                    <UserCircle size={20} className="m-auto mt-3 text-brand-muted" />
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-col text-right">
                                <span className="text-brand font-black text-[14px]">{u.full_name || 'משתמש'}</span>
                                <span
                                  className="text-brand-muted text-[10px] font-medium tracking-widest uppercase mt-0.5"
                                  dir="ltr"
                                >
                                  @{u.username || 'user'} • רמה {u.level || 1}
                                </span>
                              </div>
                            </div>

                            <div className="w-8 h-8 rounded-full border border-surface-border flex items-center justify-center shrink-0">
                              <ChevronLeft size={16} className="text-brand-muted" />
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
                        ? 'bg-brand text-surface border-brand shadow-inner'
                        : 'bg-transparent text-brand-muted border-transparent hover:text-brand'
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
                        ? 'bg-brand text-surface border-brand shadow-inner'
                        : 'bg-transparent text-brand-muted border-transparent hover:text-brand'
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
                        ? 'bg-brand text-surface border-brand shadow-inner'
                        : 'bg-transparent text-brand-muted border-transparent hover:text-brand'
                    }`}
                  >
                    ביו
                  </button>
                </div>

                <div>
                  {loading ? (
                    <div className="py-16 flex justify-center">
                      <Loader2 className="animate-spin text-brand-muted" size={28} />
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
                            <span className="text-brand-muted text-[14px] font-black">לא מצאנו תוצאות לחיפוש</span>
                          </div>
                        ) : (
                          <div className="-mx-4 px-2">
                            <div className="bg-surface-card rounded-[30px] p-2 flex flex-col shadow-lg border border-surface-border">
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
                                    className={`p-3 flex items-center justify-between cursor-pointer hover:bg-surface-card active:bg-surface border-surface-border transition-colors rounded-[22px] ${
                                      idx !== usersListData.length - 1 ? 'border-b rounded-b-none' : ''
                                    }`}
                                  >
                                    <div className="flex items-center gap-4 text-right">
                                      <div className="w-14 h-14 rounded-full bg-surface border border-surface-border overflow-hidden shrink-0 relative shadow-inner p-0.5">
                                        <div className="w-full h-full rounded-full overflow-hidden bg-surface-card">
                                          {u.avatar_url ? (
                                            <img src={u.avatar_url} className="w-full h-full object-cover" />
                                          ) : (
                                            <UserCircle size={20} className="m-auto mt-4 text-brand-muted" />
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex flex-col">
                                        <span className="text-brand text-[15px] font-black">{u.full_name || 'משתמש'}</span>
                                        <span
                                          className="text-brand-muted text-[11px] font-bold mt-0.5 tracking-widest"
                                          dir="ltr"
                                        >
                                          @{u.username || 'user'}
                                        </span>
                                        {activeSearchTab === 'tags' && u.bio && (
                                          <span className="text-brand-muted text-[10px] mt-1 line-clamp-1">{u.bio}</span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="w-8 h-8 rounded-full border border-surface-border flex items-center justify-center shrink-0">
                                      <ChevronLeft size={16} className="text-brand-muted" />
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
