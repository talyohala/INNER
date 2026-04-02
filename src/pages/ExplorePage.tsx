import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronLeft, Loader2, Flame, Ghost, DollarSign, Brain, Heart, Target, UserCircle, Hash, TrendingUp, Users, History, X, BadgeCheck } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { FadeIn, Button, GlassCard } from '../components/ui';
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
  const [recentSearches, setRecentSearches] = useState<string[]>(JSON.parse(localStorage.getItem('inner_recent_searches') || '[]'));
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  const VIBES = [
    { id: 'הכל', icon: Target, color: 'text-[#2196f3]' },
    { id: 'דרמה', icon: Flame, color: 'text-[#e91e63]' },
    { id: 'סודות', icon: Ghost, color: 'text-[#9c27b0]' },
    { id: 'כסף', icon: DollarSign, color: 'text-[#8bc34a]' },
    { id: 'ידע', icon: Brain, color: 'text-[#ff9800]' },
    { id: 'זוגיות', icon: Heart, color: 'text-[#f44336]' }
  ];

  const saveRecentSearch = (term: string) => {
    if (!term.trim()) return;
    const updated = [term, ...recentSearches.filter(t => t !== term)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('inner_recent_searches', JSON.stringify(updated));
  };

  const removeRecentSearch = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentSearches.filter(t => t !== term);
    setRecentSearches(updated);
    localStorage.setItem('inner_recent_searches', JSON.stringify(updated));
  };

  useEffect(() => {
    const fetchSuggested = async () => {
      try {
        const { data } = await supabase.from('profiles').select('id, full_name, username, avatar_url, level').order('level', { ascending: false }).limit(5);
        if (data) setSuggestedUsers(data);
      } catch (e) {} finally { setLoadingSuggestions(false); }
    };
    fetchSuggested();
  }, []);

  useEffect(() => {
    const fetchCircles = async () => {
      try {
        setLoading(true);
        const data = await apiFetch<any[]>('/api/circles');
        setCircles(Array.isArray(data) ? data : []);
      } catch (err) {} finally { setLoading(false); }
    };
    if (activeMainTab === 'clubs') fetchCircles();
  }, [activeMainTab]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (activeMainTab !== 'users' || !search.trim()) {
        setUsersListData([]); return;
      }
      setLoading(true);
      try {
        let query = supabase.from('profiles').select('id, full_name, username, avatar_url, level, bio');
        if (activeSearchTab === 'tags') { query = query.ilike('bio', `%${search}%`); } 
        else {
          query = query.or(`full_name.ilike.%${search}%,username.ilike.%${search}%`);
          if (activeSearchTab === 'top') query = query.order('level', { ascending: false });
          if (activeSearchTab === 'accounts') query = query.order('full_name', { ascending: true });
        }
        const { data, error } = await query.limit(30);
        if (!error && data) setUsersListData(data);
      } catch (err) {} finally { setLoading(false); }
    };
    const timeoutId = setTimeout(fetchUsers, 400);
    return () => clearTimeout(timeoutId);
  }, [search, activeMainTab, activeSearchTab]);

  const filteredCircles = circles.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase()) || c.description?.toLowerCase().includes(search.toLowerCase());
    const matchesVibe = activeVibe === 'הכל' || c.name?.includes(activeVibe) || c.description?.includes(activeVibe);
    return matchesSearch && matchesVibe;
  });

  return (
    <FadeIn className="px-4 pt-12 pb-32 bg-[#0A0A0A] min-h-screen font-sans flex flex-col gap-5 overflow-x-hidden relative" dir="rtl">
      <div className="flex flex-col items-center justify-center relative z-10 mb-2">
        <h1 className="text-3xl font-black text-white tracking-tighter drop-shadow-md">גלה</h1>
        <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">חיפוש קהילות ואנשים</span>
      </div>

      <div className="relative z-10 flex w-full mb-1 bg-white/5 p-1 rounded-[20px] border border-white/5 shadow-inner">
        <button onClick={() => { triggerFeedback('pop'); setActiveMainTab('clubs'); setSearch(''); }} className={`flex-1 py-3 text-[14px] font-black transition-all rounded-[16px] flex items-center justify-center gap-2 ${activeMainTab === 'clubs' ? 'bg-white/10 text-white shadow-md' : 'text-white/40 hover:text-white/70'}`}>
          <Target size={16} /> מועדונים
        </button>
        <button onClick={() => { triggerFeedback('pop'); setActiveMainTab('users'); setSearch(''); }} className={`flex-1 py-3 text-[14px] font-black transition-all rounded-[16px] flex items-center justify-center gap-2 ${activeMainTab === 'users' ? 'bg-white/10 text-white shadow-md' : 'text-white/40 hover:text-white/70'}`}>
          <Users size={16} /> אנשים
        </button>
      </div>

      <div className="relative z-10">
        <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none"><Search size={18} className="text-white/40" /></div>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={activeMainTab === 'clubs' ? 'חפש מועדונים...' : 'חפש אנשים...'} className="w-full bg-[#111] border border-white/10 rounded-[20px] py-4 pr-12 pl-16 text-white text-[15px] font-medium placeholder:text-white/30 focus:border-white/30 transition-all shadow-inner outline-none h-14" />
        {search && <button onClick={() => setSearch('')} className="absolute inset-y-0 left-3 flex items-center justify-center"><span className="text-white/60 hover:text-white text-[10px] font-bold uppercase tracking-widest bg-white/10 px-3 py-1.5 rounded-xl transition-colors active:scale-95">נקה</span></button>}
      </div>

      <AnimatePresence mode="wait">
        {activeMainTab === 'clubs' && (
          <motion.div key="clubs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4 relative z-10">
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 mt-2">
              {VIBES.map(vibe => (
                <motion.button whileTap={{ scale: 0.95 }} key={vibe.id} onClick={() => {triggerFeedback('pop'); setActiveVibe(vibe.id);}} className={`flex items-center gap-2 px-5 h-11 rounded-[16px] font-black text-[13px] transition-all shrink-0 border shadow-inner ${activeVibe === vibe.id ? 'bg-white/10 border-white/20 text-white' : 'bg-[#111] border-white/5 text-white/40 hover:bg-white/5 hover:text-white/80'}`}>
                  <span>{vibe.id}</span>
                  <vibe.icon size={14} className={`${vibe.color} ${activeVibe === vibe.id ? 'drop-shadow-[0_0_8px_currentColor]' : ''}`} />
                </motion.button>
              ))}
            </div>

            {loading ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-white/20" /></div> : filteredCircles.length === 0 ? (
              <div className="text-center py-20 flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shadow-inner"><Ghost size={32} className="text-white/20" /></div>
                <span className="text-white/80 font-black text-[16px]">לא מצאנו מועדון כזה</span>
                <Button onClick={() => navigate('/create-circle')} className="px-8 mt-2 rounded-[20px] shadow-lg">פתח מועדון משלך</Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredCircles.map((circle, idx) => (
                  <motion.div key={circle.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.3) }}>
                    <GlassCard onClick={() => { if (search.trim()) saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/circle/${circle.slug}`); }} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-4 text-right">
                        <div className="w-14 h-14 rounded-[18px] bg-[#111] border border-white/10 overflow-hidden shrink-0 shadow-inner">
                          {circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Target size={20} className="text-white/20" /></div>}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-white font-black text-[15px]">{circle.name}</span>
                          <span className="text-white/40 text-[10px] font-bold mt-1 tracking-widest flex items-center gap-1.5"><span>{circle.members_count || 0} חברים</span> <Users size={10} /></span>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 ml-1"><ChevronLeft size={16} className="text-white/40" /></div>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeMainTab === 'users' && (
          <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2 relative z-10">
            {!search.trim() ? (
              <div className="mt-4 flex flex-col gap-6">
                {recentSearches.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <span className="text-white/40 text-[10px] font-black tracking-widest uppercase flex items-center justify-between w-full px-2">
                      <div className="flex items-center gap-1.5"><span>חיפושים אחרונים</span> <History size={12} /></div>
                      <button onClick={() => { triggerFeedback('pop'); setRecentSearches([]); localStorage.removeItem('inner_recent_searches'); }} className="text-white/30 hover:text-white">נקה הכל</button>
                    </span>
                    <GlassCard className="p-0 flex flex-col">
                      {recentSearches.map((term, i) => (
                        <div key={i} onClick={() => { triggerFeedback('pop'); setSearch(term); }} className={`flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 active:bg-white/10 transition-colors ${i !== recentSearches.length - 1 ? 'border-b border-white/5' : ''}`}>
                          <div className="flex items-center gap-3"><Search size={16} className="text-white/30" /><span className="text-white font-medium text-[14px]">{term}</span></div>
                          <button onClick={(e) => removeRecentSearch(term, e)} className="p-2 -m-2 opacity-50 hover:opacity-100 active:scale-90 transition-all"><X size={16} className="text-white" /></button>
                        </div>
                      ))}
                    </GlassCard>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <span className="text-white/40 text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 px-2"><span>משתמשים מובילים</span> <TrendingUp size={12} className="text-[#ff5722]" /></span>
                  {loadingSuggestions ? <Loader2 className="animate-spin text-white/20 mx-auto mt-4" /> : 
                  <GlassCard className="p-0 flex flex-col">
                   {suggestedUsers.map((u, i) => (
                    <div key={u.id} className={`flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 active:bg-white/10 transition-all ${i !== suggestedUsers.length - 1 ? 'border-b border-white/5' : ''}`} onClick={() => { if (search.trim()) saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/profile/${u.id}`); }}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-[16px] bg-[#111] border border-white/10 overflow-hidden relative shadow-inner">
                          {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><UserCircle size={20} className="text-white/20" /></div>}
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-white font-black text-[14px] flex items-center gap-1">{u.full_name || 'משתמש'} {(u.level || 0) >= 5 && <BadgeCheck size={14} className="text-[#2196f3]" />}</span>
                          <span className="text-white/40 text-[10px] font-bold tracking-widest uppercase mt-0.5" dir="ltr">@{u.username || 'user'} • רמה {u.level || 1}</span>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"><ChevronLeft size={16} className="text-white/20" /></div>
                    </div>
                  ))}
                  </GlassCard>
                  }
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2 mt-3">
                  <button onClick={() => { triggerFeedback('pop'); setActiveSearchTab('top'); }} className={`px-5 py-2.5 rounded-[14px] font-black text-[12px] uppercase tracking-widest whitespace-nowrap transition-all border ${activeSearchTab === 'top' ? 'bg-white/10 text-white border-white/20 shadow-inner' : 'bg-[#111] text-white/40 border-white/5 hover:text-white/70'}`}>מובילים</button>
                  <button onClick={() => { triggerFeedback('pop'); setActiveSearchTab('accounts'); }} className={`px-5 py-2.5 rounded-[14px] font-black text-[12px] uppercase tracking-widest whitespace-nowrap transition-all border ${activeSearchTab === 'accounts' ? 'bg-white/10 text-white border-white/20 shadow-inner' : 'bg-[#111] text-white/40 border-white/5 hover:text-white/70'}`}>חשבונות</button>
                  <button onClick={() => { triggerFeedback('pop'); setActiveSearchTab('tags'); }} className={`px-5 py-2.5 rounded-[14px] font-black text-[12px] uppercase tracking-widest whitespace-nowrap transition-all border ${activeSearchTab === 'tags' ? 'bg-white/10 text-white border-white/20 shadow-inner' : 'bg-[#111] text-white/40 border-white/5 hover:text-white/70'}`}>ביו והאשטאגים</button>
                </div>
                <div className="mt-3">
                  {loading ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-white/40" size={28} /></div> : (
                    <AnimatePresence mode="wait">
                      <motion.div key="users-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2">
                        {usersListData.length === 0 ? (
                          <div className="text-center py-16 flex flex-col items-center gap-3">
                            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">{activeSearchTab === 'tags' ? <Hash size={24} className="text-white/30" /> : <UserCircle size={24} className="text-white/30" />}</div>
                            <span className="text-white/60 text-[14px] font-black">לא מצאנו תוצאות לחיפוש</span>
                          </div>
                        ) : (
                          <GlassCard className="p-0 flex flex-col">
                              {usersListData.map((u, idx) => (
                                <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(idx * 0.05, 0.2) }}>
                                  <div onClick={() => { if (search.trim()) saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/profile/${u.id}`); }} className={`p-3 flex items-center justify-between cursor-pointer hover:bg-white/5 active:bg-white/10 transition-colors ${idx !== usersListData.length - 1 ? 'border-b border-white/5' : ''}`}>
                                    <div className="flex items-center gap-4 text-right">
                                      <div className="w-12 h-12 rounded-[16px] bg-[#111] border border-white/10 overflow-hidden shrink-0 relative shadow-inner">
                                        {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><UserCircle size={20} className="text-white/20" /></div>}
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-white text-[15px] font-black flex items-center gap-1">{u.full_name || 'משתמש'} {(u.level || 0) >= 5 && <BadgeCheck size={14} className="text-[#2196f3]" />}</span>
                                        <span className="text-white/40 text-[11px] font-bold mt-0.5 tracking-widest" dir="ltr">@{u.username || 'user'}</span>
                                        {activeSearchTab === 'tags' && u.bio && <span className="text-white/60 text-[10px] mt-1 line-clamp-1">{u.bio}</span>}
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                          </GlassCard>
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
