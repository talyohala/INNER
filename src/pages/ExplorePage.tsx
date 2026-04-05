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
      {/* ענני אור לבן ברקע ליצירת עומק והשתקפות לזכוכית */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-5%] left-[-15%] w-[70%] h-[35%] bg-white/[0.04] blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[20%] right-[-15%] w-[60%] h-[40%] bg-white/[0.02] blur-[120px] rounded-full mix-blend-screen" />
      </div>

      {/* שורת חיפוש מזכוכית שקופה (מראה) עם פס השתקפות עליון עדין */}
      <div className="relative flex items-center w-full mt-2 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[20px] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] z-10">
        <Search size={20} className="absolute right-4 text-white/40 pointer-events-none" />
        
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={activeMainTab === 'clubs' ? 'חיפוש מועדונים...' : 'חיפוש משתמשים...'}
          className="w-full bg-transparent py-4 pr-12 pl-12 text-white text-[16px] font-medium placeholder:text-white/30 outline-none"
        />

        {search && (
          <button 
            onClick={() => { triggerFeedback('pop'); setSearch(''); }} 
            className="absolute left-4 text-white/40 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* טאבים ראשיים נקיים - נטו טקסט */}
      <div className="flex gap-8 border-b border-white/10 pb-2 z-10 relative">
        <button
          onClick={() => {
            triggerFeedback('pop');
            setActiveMainTab('clubs');
            setSearch('');
          }}
          className={`text-[16px] font-black transition-colors pb-2 ${
            activeMainTab === 'clubs' ? 'text-white border-b-2 border-white' : 'text-white/40 hover:text-white/70 border-b-2 border-transparent'
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
          className={`text-[16px] font-black transition-colors pb-2 ${
            activeMainTab === 'users' ? 'text-white border-b-2 border-white' : 'text-white/40 hover:text-white/70 border-b-2 border-transparent'
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
            {/* תגיות אווירה - טקסט נקי לחלוטין */}
            <div className="flex items-center gap-6 overflow-x-auto pb-2 scrollbar-hide">
              {VIBES.map((vibe) => (
                <button
                  key={vibe}
                  onClick={() => {
                    triggerFeedback('pop');
                    setActiveVibe(vibe);
                  }}
                  className={`text-[14px] font-bold whitespace-nowrap transition-colors ${
                    activeVibe === vibe ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-white/30 hover:text-white/60'
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
                    {/* שורת מועדון - נטו תוכן, בלי קופסאות */}
                    <div
                      onClick={() => {
                        if (search.trim()) saveRecentSearch(search.trim());
                        triggerFeedback('pop');
                        navigate(`/circle/${circle.slug}`);
                      }}
                      className="py-4 border-b border-white/10 flex items-center justify-between cursor-pointer group hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-4 text-right">
                        {circle.cover_url ? (
                          <img src={circle.cover_url} className="w-14 h-14 rounded-full object-cover" />
                        ) : (
                          <UserCircle size={56} className="text-white/10" strokeWidth={1} />
                        )}

                        <div className="flex flex-col">
                          <span className="text-white font-black text-[17px]">{circle.name}</span>
                          <span className="text-white/40 text-[12px] font-medium mt-0.5">
                            {circle.members_count || 0} חברים
                          </span>
                        </div>
                      </div>

                      <ChevronLeft size={20} className="text-white/20 group-hover:text-white/60 transition-colors" />
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
            {/* מצב שבו לא הוקלד כלום - חיפושים אחרונים והצעות */}
            {!search.trim() ? (
              <div className="flex flex-col gap-8">
                {recentSearches.length > 0 && (
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/40 text-[11px] font-bold uppercase tracking-widest">חיפושים אחרונים</span>
                      <button onClick={() => { triggerFeedback('pop'); setRecentSearches([]); localStorage.removeItem('inner_recent_searches'); }} className="text-white/40 hover:text-white text-[11px] font-bold">נקה</button>
                    </div>

                    <div className="flex flex-col">
                      {recentSearches.map((term, i) => (
                        <div key={i} className="flex items-center justify-between py-4 border-b border-white/10 hover:bg-white/[0.02] cursor-pointer transition-colors" onClick={() => { triggerFeedback('pop'); setSearch(term); }}>
                          <div className="flex items-center gap-4">
                            <Search size={18} className="text-white/30" />
                            <span className="text-white font-medium text-[16px]">{term}</span>
                          </div>
                          <button onClick={(e) => removeRecentSearch(term, e)} className="text-white/30 hover:text-white transition-colors">
                            <X size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col">
                  <span className="text-white/40 text-[11px] font-bold uppercase tracking-widest mb-2">הצעות עבורך</span>

                  {loadingSuggestions ? (
                    <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-white/20" /></div>
                  ) : (
                    <div className="flex flex-col">
                      {suggestedUsers.map((u) => (
                        <div key={u.id} className="py-4 border-b border-white/10 flex items-center justify-between cursor-pointer group hover:bg-white/[0.02] transition-colors" onClick={() => { if (search.trim()) saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/profile/${u.id}`); }}>
                          <div className="flex items-center gap-4">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} className="w-14 h-14 rounded-full object-cover" />
                            ) : (
                              <UserCircle size={56} className="text-white/10" strokeWidth={1} />
                            )}
                            <div className="flex flex-col text-right">
                              <span className="text-white font-black text-[17px]">{u.full_name || 'משתמש'}</span>
                              <span className="text-white/40 text-[12px] font-medium mt-0.5" dir="ltr">@{u.username || 'user'} • רמה {u.level || 1}</span>
                            </div>
                          </div>
                          <ChevronLeft size={20} className="text-white/20 group-hover:text-white/60 transition-colors" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* מצב שבו המשתמש מקליד חיפוש - רשימת תוצאות */
              <>
                {/* טאבים משניים לחיפוש */}
                <div className="flex gap-6 border-b border-white/10 pb-2">
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
                              {/* שורת משתמש - נטו טקסט ותמונה */}
                              <div onClick={() => { if (search.trim()) saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/profile/${u.id}`); }} className="py-4 border-b border-white/10 flex items-center justify-between cursor-pointer group hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-center gap-4 text-right">
                                  {u.avatar_url ? (
                                    <img src={u.avatar_url} className="w-14 h-14 rounded-full object-cover" />
                                  ) : (
                                    <UserCircle size={56} className="text-white/10" strokeWidth={1} />
                                  )}
                                  <div className="flex flex-col">
                                    <span className="text-white text-[17px] font-black">{u.full_name || 'משתמש'}</span>
                                    <span className="text-white/40 text-[12px] font-medium mt-0.5" dir="ltr">@{u.username || 'user'}</span>
                                    {activeSearchTab === 'tags' && u.bio && <span className="text-white/60 text-[11px] mt-1 line-clamp-1">{u.bio}</span>}
                                  </div>
                                </div>
                                <ChevronLeft size={20} className="text-white/20 group-hover:text-white/60 transition-colors" />
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
