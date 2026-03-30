import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronLeft, Loader2, Flame, Ghost, DollarSign, Brain, Heart, Target, UserCircle, Hash, TrendingUp, Users, History, X, BadgeCheck } from 'lucide-react';
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

  // שמירה וניהול היסטוריית חיפושים
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

  // שליפת הצעות אמיתיות (משתמשים מובילים ב-Level)
  useEffect(() => {
    const fetchSuggested = async () => {
      try {
        const { data } = await supabase.from('profiles').select('id, full_name, username, avatar_url, level').order('level', { ascending: false }).limit(5);
        if (data) setSuggestedUsers(data);
      } catch (e) { console.error(e); } finally { setLoadingSuggestions(false); }
    };
    fetchSuggested();
  }, []);

  // שליפת מועדונים
  useEffect(() => {
    const fetchCircles = async () => {
      try {
        setLoading(true);
        const data = await apiFetch<any[]>('/api/circles');
        setCircles(Array.isArray(data) ? data : []);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    if (activeMainTab === 'clubs') fetchCircles();
  }, [activeMainTab]);

  // חיפוש משתמשים ותגיות בזמן אמת
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
          // חיפוש אמיתי בתוך הביו של המשתמשים!
          query = query.ilike('bio', `%${search}%`);
        } else {
          query = query.or(`full_name.ilike.%${search}%,username.ilike.%${search}%`);
          if (activeSearchTab === 'top') query = query.order('level', { ascending: false });
          if (activeSearchTab === 'accounts') query = query.order('full_name', { ascending: true });
        }
        
        const { data, error } = await query.limit(30);
        if (!error && data) setUsersListData(data);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const timeoutId = setTimeout(fetchUsers, 400);
    return () => clearTimeout(timeoutId);
  }, [search, activeMainTab, activeSearchTab]);

  const filteredCircles = circles.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase()) || c.description?.toLowerCase().includes(search.toLowerCase());
    const matchesVibe = activeVibe === 'הכל' || c.name?.includes(activeVibe) || c.description?.includes(activeVibe);
    return matchesSearch && matchesVibe;
  });

  const handleCircleClick = (slug: string) => {
    if (search.trim()) saveRecentSearch(search.trim());
    triggerFeedback('pop');
    navigate(`/circle/${slug}`);
  };

  const handleUserClick = (id: string) => {
    if (search.trim()) saveRecentSearch(search.trim());
    triggerFeedback('pop');
    navigate(`/profile/${id}`);
  };

  const handleVibeClick = (vibeId: string) => {
    triggerFeedback('pop');
    setActiveVibe(vibeId);
  };

  return (
    <FadeIn className="px-4 pt-12 pb-32 bg-[#0C0C0C] min-h-screen font-sans flex flex-col gap-5 overflow-x-hidden relative" dir="rtl">
      
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex justify-center">
        <div className="absolute top-[-5%] left-[-10%] w-[50%] h-[40%] bg-white/5 blur-[100px] rounded-full mix-blend-screen"></div>
        <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] bg-[#2196f3]/5 blur-[120px] rounded-full mix-blend-screen"></div>
      </div>

      <div className="flex flex-col items-center justify-center relative z-10 mb-2">
        <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
          חיפוש
        </h1>
      </div>

      <div className="relative z-10 flex border-b border-white/10 w-full mb-1">
        <button onClick={() => { triggerFeedback('pop'); setActiveMainTab('clubs'); setSearch(''); }} className={`flex-1 pb-3 text-[14px] font-black transition-colors border-b-2 flex items-center justify-center ${activeMainTab === 'clubs' ? 'text-white border-white' : 'text-white/40 border-transparent hover:text-white/70'}`}>
          מועדונים
        </button>
        <button onClick={() => { triggerFeedback('pop'); setActiveMainTab('users'); setSearch(''); }} className={`flex-1 pb-3 text-[14px] font-black transition-colors border-b-2 flex items-center justify-center ${activeMainTab === 'users' ? 'text-white border-white' : 'text-white/40 border-transparent hover:text-white/70'}`}>
          משתמשים
        </button>
      </div>

      <div className="relative z-10">
        <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none">
          <Search size={18} className="text-white/40" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={activeMainTab === 'clubs' ? 'חפש מועדונים, תחומי עניין...' : 'חפש אנשים, חשבונות, ביו...'}
          className="w-full bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[20px] py-4 pr-12 pl-16 text-white text-[14px] font-medium placeholder:text-white/30 focus:border-[#e5e4e2]/50 focus:bg-white/[0.06] transition-all shadow-xl outline-none h-14"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute inset-y-0 left-4 flex items-center justify-center">
            <span className="text-white/40 hover:text-white text-[10px] font-bold uppercase tracking-widest bg-white/[0.05] px-2.5 py-1.5 rounded-lg transition-colors">נקה</span>
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* ================= CLUBS TAB ================= */}
        {activeMainTab === 'clubs' && (
          <motion.div key="clubs-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4 relative z-10">
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 mt-2">
              {VIBES.map(vibe => (
                <motion.button whileTap={{ scale: 0.95 }} key={vibe.id} onClick={() => handleVibeClick(vibe.id)} className={`flex items-center gap-2 px-5 h-10 rounded-full font-black text-xs uppercase tracking-widest transition-all shrink-0 border ${activeVibe === vibe.id ? 'bg-white/10 border-white/20 text-white shadow-inner' : 'bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/5'}`}>
                  <span>{vibe.id}</span>
                  <vibe.icon size={14} className={`${vibe.color} ${activeVibe === vibe.id ? 'drop-shadow-[0_0_8px_currentColor]' : ''}`} />
                </motion.button>
              ))}
            </div>

            {loading ? (
              <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-white/20" /></div>
            ) : filteredCircles.length === 0 ? (
              <div className="text-center py-20 flex flex-col items-center gap-4">
                <Ghost size={32} className="text-white/20" />
                <span className="text-white font-black text-[16px]">לא מצאנו מועדון</span>
                <Button onClick={() => navigate('/create-circle')} className="px-8 h-12 bg-[#e5e4e2] text-black font-black text-[13px] rounded-xl active:scale-95">פתח משלך</Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredCircles.map((circle, idx) => (
                  <motion.div key={circle.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.3) }}>
                    <div onClick={() => handleCircleClick(circle.slug)} className="bg-white/[0.02] backdrop-blur-xl border border-white/5 p-3 rounded-[24px] flex items-center justify-between shadow-lg cursor-pointer group hover:bg-white/[0.05] active:scale-[0.98] transition-all">
                      <div className="flex items-center gap-4 text-right">
                        <div className="w-14 h-14 rounded-[18px] bg-black border border-white/10 overflow-hidden shrink-0 shadow-inner">
                          {circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Target size={20} className="text-white/20" /></div>}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-white font-black text-[15px]">{circle.name}</span>
                          <span className="text-white/40 text-[10px] font-bold mt-1 tracking-widest flex items-center gap-1.5"><span>{circle.members_count || 0} חברים</span> <Users size={10} /></span>
                        </div>
                      </div>
                      <ChevronLeft size={16} className="text-white/30 ml-2" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ================= USERS TAB ================= */}
        {activeMainTab === 'users' && (
          <motion.div key="users-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2 relative z-10">
            
            {!search.trim() ? (
              <div className="mt-4 flex flex-col gap-6">
                
                {/* היסטוריית חיפושים */}
                {recentSearches.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <span className="text-white/40 text-[11px] font-black tracking-widest uppercase flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5"><span>חיפושים אחרונים</span> <History size={14} /></div>
                      <button onClick={() => { setRecentSearches([]); localStorage.removeItem('inner_recent_searches'); }} className="text-white/30 hover:text-white">נקה הכל</button>
                    </span>
                    <div className="flex flex-col gap-1">
                      {recentSearches.map((term, i) => (
                        <div key={i} onClick={() => setSearch(term)} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] cursor-pointer group">
                          <div className="flex items-center gap-3"><Search size={14} className="text-white/30" /><span className="text-white font-medium text-[14px]">{term}</span></div>
                          <button onClick={(e) => removeRecentSearch(term, e)} className="p-2 -m-2 opacity-50 hover:opacity-100"><X size={14} className="text-white" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* הצעות חמות בזמן אמת מהדאטהבייס */}
                <div className="flex flex-col gap-3">
                  <span className="text-white/40 text-[11px] font-black tracking-widest uppercase flex items-center gap-1.5"><span>משתמשים מובילים</span> <TrendingUp size={14} className="text-[#ff5722]" /></span>
                  {loadingSuggestions ? <Loader2 className="animate-spin text-white/20 mx-auto mt-4" /> : 
                   suggestedUsers.map((u, i) => (
                    <div key={u.id} className="flex items-center justify-between p-3 rounded-[20px] bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.05] transition-all" onClick={() => handleUserClick(u.id)}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-black border border-white/10 overflow-hidden relative">
                          {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><UserCircle size={20} className="text-white/20" /></div>}
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-white font-bold text-[14px] flex items-center gap-1">
                            {u.full_name || 'משתמש'} {(u.level || 0) >= 5 && <BadgeCheck size={14} className="text-[#2196f3]" />}
                          </span>
                          <span className="text-white/30 text-[10px] font-medium tracking-widest uppercase" dir="ltr">@{u.username || 'user'} • רמה {u.level || 1}</span>
                        </div>
                      </div>
                      <ChevronLeft size={16} className="text-white/20" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2 mt-2">
                  <button onClick={() => { triggerFeedback('pop'); setActiveSearchTab('top'); }} className={`px-5 py-2 rounded-full font-black text-[12px] uppercase tracking-widest whitespace-nowrap transition-all border ${activeSearchTab === 'top' ? 'bg-white/10 text-white border-white/20' : 'bg-transparent text-white/40 border-transparent hover:text-white/70'}`}>מובילים</button>
                  <button onClick={() => { triggerFeedback('pop'); setActiveSearchTab('accounts'); }} className={`px-5 py-2 rounded-full font-black text-[12px] uppercase tracking-widest whitespace-nowrap transition-all border ${activeSearchTab === 'accounts' ? 'bg-white/10 text-white border-white/20' : 'bg-transparent text-white/40 border-transparent hover:text-white/70'}`}>חשבונות</button>
                  <button onClick={() => { triggerFeedback('pop'); setActiveSearchTab('tags'); }} className={`px-5 py-2 rounded-full font-black text-[12px] uppercase tracking-widest whitespace-nowrap transition-all border ${activeSearchTab === 'tags' ? 'bg-white/10 text-white border-white/20' : 'bg-transparent text-white/40 border-transparent hover:text-white/70'}`}>האשטאגים / ביו</button>
                </div>

                <div className="mt-2">
                  {loading ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-[#e5e4e2]" size={28} /></div> : (
                    <AnimatePresence mode="wait">
                      <motion.div key="users-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
                        {usersListData.length === 0 ? (
                          <div className="text-center py-16 flex flex-col items-center gap-3">
                            {activeSearchTab === 'tags' ? <Hash size={40} className="text-white/20" /> : <UserCircle size={40} className="text-white/20" />}
                            <span className="text-white/40 text-[13px] font-bold">לא מצאנו תוצאות לחיפוש</span>
                          </div>
                        ) : (
                          usersListData.map((u, idx) => (
                            <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(idx * 0.05, 0.2) }}>
                              <div onClick={() => handleUserClick(u.id)} className="bg-transparent p-2 rounded-[20px] flex items-center justify-between cursor-pointer hover:bg-white/[0.03] active:scale-[0.98] transition-all">
                                <div className="flex items-center gap-4 text-right">
                                  <div className="w-14 h-14 rounded-full bg-[#111] border border-white/10 overflow-hidden shrink-0 relative">
                                    {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><UserCircle size={20} className="text-white/20" /></div>}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-white text-[15px] font-black flex items-center gap-1">
                                      {u.full_name || 'משתמש'} {(u.level || 0) >= 5 && <BadgeCheck size={14} className="text-[#2196f3]" />}
                                    </span>
                                    <span className="text-white/40 text-[11px] font-bold mt-0.5 tracking-widest" dir="ltr">@{u.username || 'user'}</span>
                                    {activeSearchTab === 'tags' && u.bio && <span className="text-white/60 text-[10px] mt-1 line-clamp-1">{u.bio}</span>}
                                  </div>
                                </div>
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
