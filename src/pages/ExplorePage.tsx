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
      } catch {} finally {
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
      } catch {} finally {
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
      } catch {} finally {
        setLoading(false);
      }
    };
    const timeoutId = setTimeout(fetchUsers, 400);
    return () => clearTimeout(timeoutId);
  }, [search, activeMainTab, activeSearchTab]);

  const filteredCircles = circles.filter((c) => {
    const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase()) || c.description?.toLowerCase().includes(search.toLowerCase());
    const matchesVibe = activeVibe === 'הכל' || c.name?.includes(activeVibe) || c.description?.includes(activeVibe);
    return matchesSearch && matchesVibe;
  });

  return (
    <FadeIn className="pt-[calc(env(safe-area-inset-top)+12px)] pb-28 bg-surface min-h-screen font-sans flex flex-col gap-6 overflow-x-hidden" dir="rtl">
      
      {/* שורת חיפוש שקופה לגמרי */}
      <div className="relative z-10 px-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={activeMainTab === 'clubs' ? 'חפש מועדון...' : 'חפש חבר...'}
          className="w-full bg-transparent border border-surface-border rounded-full py-3.5 pr-12 pl-12 text-brand text-[16px] font-bold placeholder:text-brand-muted outline-none transition-all focus:border-accent-primary"
        />
        <Search size={20} className="absolute right-8 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" />
        {search && (
          <button onClick={() => { triggerFeedback('pop'); setSearch(''); }} className="absolute left-7 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand transition-colors p-1">
            <X size={18} />
          </button>
        )}
      </div>

      {/* טאבים ראשיים נקיים */}
      <div className="flex gap-2 px-4 relative z-10">
        <button onClick={() => { triggerFeedback('pop'); setActiveMainTab('clubs'); setSearch(''); }} className={`flex-1 py-2.5 text-[14px] font-black transition-all rounded-full ${activeMainTab === 'clubs' ? 'bg-surface-card text-brand border border-surface-border' : 'text-brand-muted hover:text-brand'}`}>מועדונים</button>
        <button onClick={() => { triggerFeedback('pop'); setActiveMainTab('users'); setSearch(''); }} className={`flex-1 py-2.5 text-[14px] font-black transition-all rounded-full ${activeMainTab === 'users' ? 'bg-surface-card text-brand border border-surface-border' : 'text-brand-muted hover:text-brand'}`}>חברים</button>
      </div>

      <AnimatePresence mode="wait">
        {activeMainTab === 'clubs' && (
          <motion.div key="clubs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-5">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide px-4">
              {VIBES.map((vibe) => (
                <button key={vibe} onClick={() => { triggerFeedback('pop'); setActiveVibe(vibe); }} className={`text-[13px] font-bold whitespace-nowrap transition-all px-4 py-1.5 rounded-full border ${activeVibe === vibe ? 'bg-accent-primary/10 border-accent-primary text-accent-primary' : 'bg-transparent border-surface-border text-brand-muted hover:text-brand'}`}>
                  {vibe}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-accent-primary" /></div>
            ) : filteredCircles.length === 0 ? (
              <div className="text-center py-16 flex flex-col items-center gap-4"><span className="text-brand-muted font-medium text-[16px]">לא נמצאו מועדונים</span></div>
            ) : (
              <div className="mx-2 bg-surface-card border border-surface-border rounded-[24px] overflow-hidden flex flex-col">
                {filteredCircles.map((circle, idx) => (
                  <motion.div key={circle.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(idx * 0.05, 0.2) }}>
                    <div onClick={() => { if (search.trim()) saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/circle/${circle.slug}`); }} className={`py-4 px-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors ${idx !== filteredCircles.length - 1 ? 'border-b border-surface-border' : ''}`}>
                      <div className="flex items-center gap-4 text-right">
                        {circle.cover_url ? <img src={circle.cover_url} className="w-12 h-12 rounded-full object-cover" /> : <UserCircle size={48} className="text-brand-muted" strokeWidth={1} />}
                        <div className="flex flex-col">
                          <span className="text-brand font-black text-[16px]">{circle.name}</span>
                          <span className="text-brand-muted text-[12px] font-medium mt-0.5">{circle.members_count || 0} חברים</span>
                        </div>
                      </div>
                      <ChevronLeft size={18} className="text-brand-muted" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeMainTab === 'users' && (
          <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">
            {!search.trim() ? (
              <div className="flex flex-col gap-6">
                {recentSearches.length > 0 && (
                  <div className="flex flex-col px-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-brand-muted text-[11px] font-bold uppercase tracking-widest">חיפושים אחרונים</span>
                      <button onClick={() => { triggerFeedback('pop'); setRecentSearches([]); localStorage.removeItem('inner_recent_searches'); }} className="text-accent-primary text-[11px] font-bold">נקה</button>
                    </div>
                    <div className="bg-surface-card border border-surface-border rounded-[20px] flex flex-col overflow-hidden">
                      {recentSearches.map((term, i) => (
                        <div key={i} className={`flex items-center justify-between py-3.5 px-4 cursor-pointer hover:bg-white/5 transition-colors ${i !== recentSearches.length -1 ? 'border-b border-surface-border' : ''}`} onClick={() => { triggerFeedback('pop'); setSearch(term); }}>
                          <div className="flex items-center gap-3"><Search size={16} className="text-brand-muted" /><span className="text-brand font-medium text-[15px]">{term}</span></div>
                          <button onClick={(e) => removeRecentSearch(term, e)} className="text-brand-muted hover:text-brand p-1"><X size={16} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col">
                  <span className="text-brand-muted text-[11px] font-bold uppercase tracking-widest mb-2 px-4">הצעות עבורך</span>
                  {loadingSuggestions ? (
                    <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-accent-primary" /></div>
                  ) : (
                    <div className="mx-2 bg-surface-card border border-surface-border rounded-[24px] overflow-hidden flex flex-col">
                      {suggestedUsers.map((u, i) => (
                        <div key={u.id} className={`py-4 px-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors ${i !== suggestedUsers.length -1 ? 'border-b border-surface-border' : ''}`} onClick={() => { if (search.trim()) saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/profile/${u.id}`); }}>
                          <div className="flex items-center gap-4">
                            {u.avatar_url ? <img src={u.avatar_url} className="w-12 h-12 rounded-full object-cover" /> : <UserCircle size={48} className="text-brand-muted" strokeWidth={1} />}
                            <div className="flex flex-col text-right">
                              <span className="text-brand font-black text-[16px]">{u.full_name || 'חבר'}</span>
                              <span className="text-brand-muted text-[12px] font-medium mt-0.5" dir="ltr">@{u.username || 'user'}</span>
                            </div>
                          </div>
                          <ChevronLeft size={18} className="text-brand-muted" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4">
                  <button onClick={() => { triggerFeedback('pop'); setActiveSearchTab('top'); }} className={`text-[13px] font-bold whitespace-nowrap transition-all px-4 py-1.5 rounded-full border ${activeSearchTab === 'top' ? 'bg-accent-primary/10 border-accent-primary text-accent-primary' : 'bg-transparent border-surface-border text-brand-muted hover:text-brand'}`}>מובילים</button>
                  <button onClick={() => { triggerFeedback('pop'); setActiveSearchTab('accounts'); }} className={`text-[13px] font-bold whitespace-nowrap transition-all px-4 py-1.5 rounded-full border ${activeSearchTab === 'accounts' ? 'bg-accent-primary/10 border-accent-primary text-accent-primary' : 'bg-transparent border-surface-border text-brand-muted hover:text-brand'}`}>חשבונות</button>
                  <button onClick={() => { triggerFeedback('pop'); setActiveSearchTab('tags'); }} className={`text-[13px] font-bold whitespace-nowrap transition-all px-4 py-1.5 rounded-full border ${activeSearchTab === 'tags' ? 'bg-accent-primary/10 border-accent-primary text-accent-primary' : 'bg-transparent border-surface-border text-brand-muted hover:text-brand'}`}>ביו</button>
                </div>

                <div>
                  {loading ? (
                    <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-accent-primary" size={28} /></div>
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.div key="users-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col">
                        {usersListData.length === 0 ? (
                          <div className="text-center py-16"><span className="text-brand-muted font-medium">לא מצאנו תוצאות</span></div>
                        ) : (
                          <div className="mx-2 bg-surface-card border border-surface-border rounded-[24px] overflow-hidden flex flex-col">
                            {usersListData.map((u, idx) => (
                              <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(idx * 0.05, 0.2) }}>
                                <div onClick={() => { if (search.trim()) saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/profile/${u.id}`); }} className={`py-4 px-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors ${idx !== usersListData.length - 1 ? 'border-b border-surface-border' : ''}`}>
                                  <div className="flex items-center gap-4 text-right">
                                    {u.avatar_url ? <img src={u.avatar_url} className="w-12 h-12 rounded-full object-cover" /> : <UserCircle size={48} className="text-brand-muted" strokeWidth={1} />}
                                    <div className="flex flex-col">
                                      <span className="text-brand text-[16px] font-black">{u.full_name || 'משתמש'}</span>
                                      <span className="text-brand-muted text-[12px] font-medium mt-0.5" dir="ltr">@{u.username || 'user'}</span>
                                      {activeSearchTab === 'tags' && u.bio && <span className="text-brand-muted text-[11px] mt-1 line-clamp-1">{u.bio}</span>}
                                    </div>
                                  </div>
                                  <ChevronLeft size={18} className="text-brand-muted" />
                                </div>
                              </motion.div>
                            ))}
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
