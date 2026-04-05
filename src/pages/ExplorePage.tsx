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
      className="px-5 pt-4 pb-28 bg-[#050505] min-h-screen font-sans flex flex-col gap-6 overflow-x-hidden relative"
      dir="rtl"
    >
      {/* שורת חיפוש נורא נקייה - רק קו תחתון ואייקונים צפים */}
      <div className="relative flex items-center w-full mt-2">
        <Search size={22} className="absolute right-0 text-white/40 pointer-events-none" />
        
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש..."
          className="w-full bg-transparent border-b border-white/10 py-4 pr-10 pl-10 text-white text-[18px] font-medium placeholder:text-white/30 focus:border-white/50 transition-colors outline-none"
        />

        {search && (
          <button 
            onClick={() => { triggerFeedback('pop'); setSearch(''); }} 
            className="absolute left-0 p-2 opacity-50 hover:opacity-100 transition-opacity"
          >
            <X size={20} className="text-white" />
          </button>
        )}
      </div>

      {/* טאבים ראשיים - טקסט נטו עם שינוי צבע */}
      <div className="flex gap-8 border-b border-white/5 pb-2">
        <button
          onClick={() => {
            triggerFeedback('pop');
            setActiveMainTab('clubs');
            setSearch('');
          }}
          className={`text-[16px] font-black transition-colors ${
            activeMainTab === 'clubs' ? 'text-white' : 'text-white/30 hover:text-white/60'
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
          className={`text-[16px] font-black transition-colors ${
            activeMainTab === 'users' ? 'text-white' : 'text-white/30 hover:text-white/60'
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
            className="flex flex-col gap-6"
          >
            {/* תגיות אווירה - נקיות מבוססות טקסט */}
            <div className="flex items-center gap-6 overflow-x-auto pb-2 scrollbar-hide">
              {VIBES.map((vibe) => (
                <button
                  key={vibe}
                  onClick={() => {
                    triggerFeedback('pop');
                    setActiveVibe(vibe);
                  }}
                  className={`text-[14px] font-bold whitespace-nowrap transition-colors ${
                    activeVibe === vibe ? 'text-white' : 'text-white/30 hover:text-white/60'
                  }`}
                >
                  {vibe}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="animate-spin text-white/20" />
              </div>
            ) : filteredCircles.length === 0 ? (
              <div className="text-center py-16 flex flex-col items-center gap-4">
                <span className="text-white/40 font-medium text-[16px]">לא נמצאו מועדונים</span>
                <button onClick={() => navigate('/create-circle')} className="text-white font-bold underline underline-offset-4 opacity-70 hover:opacity-100 transition-opacity">
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
                      className="py-4 border-b border-white/5 flex items-center justify-between cursor-pointer group hover:bg-white/[0.02] transition-colors -mx-5 px-5"
                    >
                      <div className="flex items-center gap-5 text-right">
                        {circle.cover_url ? (
                          <img src={circle.cover_url} className="w-14 h-14 rounded-full object-cover" />
                        ) : (
                          <UserCircle size={56} className="text-white/10" strokeWidth={1} />
                        )}

                        <div className="flex flex-col">
                          <span className="text-white font-black text-[18px]">{circle.name}</span>
                          <span className="text-white/40 text-[12px] font-medium mt-0.5">
                            {circle.members_count || 0} חברים
                          </span>
                        </div>
                      </div>

                      <ChevronLeft size={20} className="text-white/20 group-hover:text-white/50 transition-colors" />
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
            className="flex flex-col gap-6"
          >
            {!search.trim() ? (
              <div className="flex flex-col gap-8">
                {recentSearches.length > 0 && (
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/30 text-[11px] font-bold uppercase tracking-widest">חיפושים אחרונים</span>
                      <button onClick={() => { triggerFeedback('pop'); setRecentSearches([]); localStorage.removeItem('inner_recent_searches'); }} className="text-white/30 hover:text-white text-[11px] font-bold">נקה</button>
                    </div>

                    <div className="flex flex-col">
                      {recentSearches.map((term, i) => (
                        <div key={i} className="flex items-center justify-between py-4 border-b border-white/5 -mx-5 px-5 hover:bg-white/[0.02] cursor-pointer transition-colors" onClick={() => { triggerFeedback('pop'); setSearch(term); }}>
                          <div className="flex items-center gap-4">
                            <Search size={18} className="text-white/30" />
                            <span className="text-white font-medium text-[16px]">{term}</span>
                          </div>
                          <button onClick={(e) => removeRecentSearch(term, e)} className="opacity-30 hover:opacity-100 p-2 -m-2 transition-opacity">
                            <X size={18} className="text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col">
                  <span className="text-white/30 text-[11px] font-bold uppercase tracking-widest mb-2">הצעות עבורך</span>

                  {loadingSuggestions ? (
                    <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-white/20" /></div>
                  ) : (
                    <div className="flex flex-col">
                      {suggestedUsers.map((u) => (
                        <div key={u.id} className="py-4 border-b border-white/5 flex items-center justify-between cursor-pointer group hover:bg-white/[0.02] transition-colors -mx-5 px-5" onClick={() => { if (search.trim()) saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/profile/${u.id}`); }}>
                          <div className="flex items-center gap-5">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} className="w-14 h-14 rounded-full object-cover" />
                            ) : (
                              <UserCircle size={56} className="text-white/10" strokeWidth={1} />
                            )}
                            <div className="flex flex-col text-right">
                              <span className="text-white font-black text-[18px]">{u.full_name || 'משתמש'}</span>
                              <span className="text-white/40 text-[12px] font-medium mt-0.5" dir="ltr">@{u.username || 'user'} • רמה {u.level || 1}</span>
                            </div>
                          </div>
                          <ChevronLeft size={20} className="text-white/20 group-hover:text-white/50 transition-colors" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-8 overflow-x-auto scrollbar-hide pb-2">
                  <button onClick={() => { triggerFeedback('pop'); setActiveSearchTab('top'); }} className={`text-[14px] font-bold whitespace-nowrap transition-colors ${activeSearchTab === 'top' ? 'text-white' : 'text-white/30 hover:text-white/60'}`}>מובילים</button>
                  <button onClick={() => { triggerFeedback('pop'); setActiveSearchTab('accounts'); }} className={`text-[14px] font-bold whitespace-nowrap transition-colors ${activeSearchTab === 'accounts' ? 'text-white' : 'text-white/30 hover:text-white/60'}`}>חשבונות</button>
                  <button onClick={() => { triggerFeedback('pop'); setActiveSearchTab('tags'); }} className={`text-[14px] font-bold whitespace-nowrap transition-colors ${activeSearchTab === 'tags' ? 'text-white' : 'text-white/30 hover:text-white/60'}`}>ביו</button>
                </div>

                <div>
                  {loading ? (
                    <div className="py-16 flex justify-center">
                      <Loader2 className="animate-spin text-white/20" size={28} />
                    </div>
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.div key="users-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col">
                        {usersListData.length === 0 ? (
                          <div className="text-center py-16 flex flex-col items-center gap-3">
                            <span className="text-white/40 text-[16px] font-medium">לא מצאנו תוצאות</span>
                          </div>
                        ) : (
                          usersListData.map((u, idx) => (
                            <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(idx * 0.05, 0.2) }}>
                              <div onClick={() => { if (search.trim()) saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/profile/${u.id}`); }} className="py-4 border-b border-white/5 flex items-center justify-between cursor-pointer group hover:bg-white/[0.02] transition-colors -mx-5 px-5">
                                <div className="flex items-center gap-5 text-right">
                                  {u.avatar_url ? (
                                    <img src={u.avatar_url} className="w-14 h-14 rounded-full object-cover" />
                                  ) : (
                                    <UserCircle size={56} className="text-white/10" strokeWidth={1} />
                                  )}
                                  <div className="flex flex-col">
                                    <span className="text-white text-[18px] font-black">{u.full_name || 'משתמש'}</span>
                                    <span className="text-white/40 text-[12px] font-medium mt-0.5" dir="ltr">@{u.username || 'user'}</span>
                                    {activeSearchTab === 'tags' && u.bio && <span className="text-white/60 text-[11px] mt-1 line-clamp-1">{u.bio}</span>}
                                  </div>
                                </div>
                                <ChevronLeft size={20} className="text-white/20 group-hover:text-white/50 transition-colors" />
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
