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
      className="px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-28 bg-[#020617] min-h-screen font-sans flex flex-col gap-6 overflow-x-hidden relative"
      dir="rtl"
    >
      {/* שורת חיפוש מורמת הכי למעלה - עיצוב שקוף ועמוק */}
      <div className="relative z-10">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={activeMainTab === 'clubs' ? 'חפש מועדון...' : 'חפש חבר...'}
          className="w-full bg-slate-900/60 backdrop-blur-2xl border border-slate-800/80 rounded-full py-4 pr-12 pl-12 text-slate-100 text-[16px] font-bold placeholder:text-slate-500 outline-none transition-all shadow-inner focus:border-sky-800"
        />
        <Search size={20} className="absolute right-4.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        
        {search && (
          <button 
            onClick={() => { triggerFeedback('pop'); setSearch(''); }} 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition-colors p-1"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* טאבים ראשיים - בועות (Pills) מעוצבות */}
      <div className="flex gap-2.5 bg-slate-900 border border-slate-800/80 p-1.5 rounded-full z-10 relative shadow-lg">
        <button
          onClick={() => {
            triggerFeedback('pop');
            setActiveMainTab('clubs');
            setSearch('');
          }}
          className={`flex-1 py-3 text-[13px] font-black transition-all rounded-full flex items-center justify-center ${
            activeMainTab === 'clubs' ? 'bg-slate-800 text-slate-100 shadow-md' : 'text-slate-400 hover:text-slate-100'
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
            activeMainTab === 'users' ? 'bg-slate-800 text-slate-100 shadow-md' : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          חברים
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
            {/* תגיות אווירה - בועות קטנות ועדינות */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
              {VIBES.map((vibe) => (
                <button
                  key={vibe}
                  onClick={() => {
                    triggerFeedback('pop');
                    setActiveVibe(vibe);
                  }}
                  className={`text-[12px] font-black whitespace-nowrap transition-all px-4 py-2 rounded-full border ${
                    activeVibe === vibe ? 'bg-sky-500/10 border-sky-400/30 text-sky-300' : 'bg-slate-900 border-slate-800/80 text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {vibe}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="animate-spin text-sky-500" />
              </div>
            ) : filteredCircles.length === 0 ? (
              <div className="text-center py-16 flex flex-col items-center gap-4">
                <span className="text-slate-400 font-medium text-[16px]">לא נמצאו מועדונים</span>
                <button onClick={() => navigate('/create-circle')} className="text-sky-400 font-bold underline underline-offset-4 opacity-70 hover:opacity-100 transition-opacity">
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
                    {/* תוצאת מועדון - קו הפרדה עדין ללא כרטיסייה */}
                    <div
                      onClick={() => {
                        if (search.trim()) saveRecentSearch(search.trim());
                        triggerFeedback('pop');
                        navigate(`/circle/${circle.slug}`);
                      }}
                      className="py-5 border-b border-slate-800 flex items-center justify-between cursor-pointer group hover:bg-slate-900/40 transition-colors -mx-4 px-4"
                    >
                      <div className="flex items-center gap-4 text-right">
                        {circle.cover_url ? (
                          <img src={circle.cover_url} className="w-14 h-14 rounded-full object-cover border-2 border-slate-800 group-hover:border-sky-800 transition-colors shadow-lg" />
                        ) : (
                          <div className="w-14 h-14 rounded-full border-2 border-slate-800 flex items-center justify-center bg-slate-900">
                             <UserCircle size={28} className="text-slate-600" strokeWidth={1} />
                          </div>
                        )}

                        <div className="flex flex-col">
                          <span className="text-slate-100 font-black text-[17px] group-hover:text-sky-300 transition-colors">{circle.name}</span>
                          <span className="text-slate-400 text-[12px] font-medium mt-0.5">
                            {circle.members_count || 0} חברים
                          </span>
                        </div>
                      </div>

                      <ChevronLeft size={20} className="text-slate-600 group-hover:text-slate-300 transition-colors" />
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
                      <span className="text-slate-500 text-[11px] font-bold uppercase tracking-widest">חיפושים אחרונים</span>
                      <button onClick={() => { triggerFeedback('pop'); setRecentSearches([]); localStorage.removeItem('inner_recent_searches'); }} className="text-sky-400 hover:text-sky-200 text-[11px] font-bold transition-colors">נקה</button>
                    </div>

                    <div className="flex flex-col bg-slate-900 border border-slate-800/80 rounded-[24px] px-2 shadow-inner overflow-hidden">
                      {recentSearches.map((term, i) => (
                        <div key={i} className={`flex items-center justify-between py-4.5 px-3 cursor-pointer hover:bg-slate-800/60 transition-colors ${i !== recentSearches.length -1 ? 'border-b border-slate-800' : ''}`} onClick={() => { triggerFeedback('pop'); setSearch(term); }}>
                          <div className="flex items-center gap-4">
                            <Search size={18} className="text-slate-600" />
                            <span className="text-slate-100 font-medium text-[16px]">{term}</span>
                          </div>
                          <button onClick={(e) => removeRecentSearch(term, e)} className="text-slate-500 hover:text-red-400 p-2 -m-2 transition-colors">
                            <X size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col">
                  <span className="text-slate-500 text-[11px] font-bold uppercase tracking-widest mb-2">הצעות עבורך</span>

                  {loadingSuggestions ? (
                    <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-sky-500/50" /></div>
                  ) : (
                    <div className="flex flex-col">
                      {suggestedUsers.map((u) => (
                        <div key={u.id} className="py-5 border-b border-slate-800 flex items-center justify-between cursor-pointer group hover:bg-slate-900/40 transition-colors -mx-4 px-4" onClick={() => { if (search.trim()) saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/profile/${u.id}`); }}>
                          <div className="flex items-center gap-5">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} className="w-14 h-14 rounded-full object-cover border-2 border-slate-800 group-hover:border-sky-800 transition-colors shadow-lg" />
                            ) : (
                              <div className="w-14 h-14 rounded-full border-2 border-slate-800 flex items-center justify-center bg-slate-900">
                                <UserCircle size={28} className="text-slate-600" strokeWidth={1} />
                              </div>
                            )}
                            <div className="flex flex-col text-right">
                              <span className="text-slate-100 font-black text-[17px] group-hover:text-sky-300 transition-colors">{u.full_name || 'חבר חדש'}</span>
                              <span className="text-slate-400 text-[12px] font-medium mt-0.5" dir="ltr">@{u.username || 'user'} • רמה {u.level || 1}</span>
                            </div>
                          </div>
                          <ChevronLeft size={20} className="text-slate-600 group-hover:text-slate-300 transition-colors" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* טאבים משניים - Pills מעוצבים */}
                <div className="flex gap-2.5 bg-slate-900 border border-slate-800/80 p-1.5 rounded-full z-10 relative shadow-lg">
                  <button onClick={() => { triggerFeedback('pop'); setActiveSearchTab('top'); }} className={`flex-1 py-3 text-[13px] font-black transition-all rounded-full flex items-center justify-center whitespace-nowrap ${activeSearchTab === 'top' ? 'bg-slate-800 text-slate-100 shadow-md' : 'text-slate-400 hover:text-slate-100'}`}>מובילים</button>
                  <button onClick={() => { triggerFeedback('pop'); setActiveSearchTab('accounts'); }} className={`flex-1 py-3 text-[13px] font-black transition-all rounded-full flex items-center justify-center whitespace-nowrap ${activeSearchTab === 'accounts' ? 'bg-slate-800 text-slate-100 shadow-md' : 'text-slate-400 hover:text-slate-100'}`}>חשבונות</button>
                  <button onClick={() => { triggerFeedback('pop'); setActiveSearchTab('tags'); }} className={`flex-1 py-3 text-[13px] font-black transition-all rounded-full flex items-center justify-center whitespace-nowrap ${activeSearchTab === 'tags' ? 'bg-slate-800 text-slate-100 shadow-md' : 'text-slate-400 hover:text-slate-100'}`}>ביו</button>
                </div>

                <div>
                  {loading ? (
                    <div className="py-16 flex justify-center">
                      <Loader2 className="animate-spin text-sky-500/50" size={28} />
                    </div>
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.div key="users-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col">
                        {usersListData.length === 0 ? (
                          <div className="text-center py-16 flex flex-col items-center gap-3">
                            <span className="text-slate-400 font-medium text-[16px]">לא מצאנו תוצאות</span>
                          </div>
                        ) : (
                          usersListData.map((u, idx) => (
                            <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(idx * 0.05, 0.2) }}>
                              {/* תוצאת משתמש - קו הפרדה עדין ללא כרטיסייה */}
                              <div onClick={() => { if (search.trim()) saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/profile/${u.id}`); }} className="py-5 border-b border-slate-800 flex items-center justify-between cursor-pointer group hover:bg-slate-900/40 transition-colors -mx-4 px-4">
                                <div className="flex items-center gap-5 text-right">
                                  {u.avatar_url ? (
                                    <img src={u.avatar_url} className="w-14 h-14 rounded-full object-cover border-2 border-slate-800 group-hover:border-sky-800 transition-colors shadow-lg" />
                                  ) : (
                                    <div className="w-14 h-14 rounded-full border-2 border-slate-800 flex items-center justify-center bg-slate-900">
                                      <UserCircle size={28} className="text-slate-600" strokeWidth={1} />
                                    </div>
                                  )}
                                  <div className="flex flex-col">
                                    <span className="text-slate-100 text-[17px] font-black group-hover:text-sky-300 transition-colors">{u.full_name || 'משתמש'}</span>
                                    <span className="text-slate-400 text-[12px] font-medium mt-0.5" dir="ltr">@{u.username || 'user'}</span>
                                    {activeSearchTab === 'tags' && u.bio && <span className="text-slate-300 text-[12px] mt-1.5 line-clamp-1 bg-slate-900 px-3 py-1 rounded-full border border-slate-800 self-start">{u.bio}</span>}
                                  </div>
                                </div>
                                <ChevronLeft size={20} className="text-slate-600 group-hover:text-slate-300 transition-colors" />
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
