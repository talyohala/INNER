import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronLeft, Loader2, Flame, Ghost, DollarSign, Brain, Heart, Target, UserCircle, Hash, TrendingUp, ChevronRight } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

export const ExplorePage: React.FC = () => {
  const navigate = useNavigate();
  
  // States ראשיים
  const [activeMainTab, setActiveMainTab] = useState<'clubs' | 'users'>('users');
  const [search, setSearch] = useState('');
  
  // States משניים (מועדונים)
  const [activeVibe, setActiveVibe] = useState('הכל');
  const [circles, setCircles] = useState<any[]>([]);
  
  // States משניים (משתמשים / חיפוש מתקדם)
  const [activeSearchTab, setActiveSearchTab] = useState<'top' | 'accounts' | 'tags'>('top');
  const [users, setUsers] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);

  const VIBES = [
    { id: 'הכל', icon: Target, color: 'text-[#2196f3]' },
    { id: 'דרמה', icon: Flame, color: 'text-[#e91e63]' },
    { id: 'סודות', icon: Ghost, color: 'text-[#9c27b0]' },
    { id: 'כסף', icon: DollarSign, color: 'text-[#8bc34a]' },
    { id: 'ידע', icon: Brain, color: 'text-[#ff9800]' },
    { id: 'זוגיות', icon: Heart, color: 'text-[#f44336]' }
  ];

  // שליפת מועדונים
  useEffect(() => {
    const fetchCircles = async () => {
      try {
        setLoading(true);
        const data = await apiFetch<any[]>('/api/circles');
        setCircles(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (activeMainTab === 'clubs') fetchCircles();
  }, [activeMainTab]);

  // חיפוש משתמשים עם אלגוריתם פופולריות
  useEffect(() => {
    const fetchUsers = async () => {
      if (activeMainTab !== 'users' || !search.trim()) {
        setUsers([]);
        return;
      }
      setLoading(true);
      try {
        // שליפה ממוינת לפי רמה (Level) - המשתמשים הכי פופולריים למעלה!
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, level')
          .or(`full_name.ilike.%${search}%,username.ilike.%${search}%`)
          .order('level', { ascending: false })
          .limit(30);
          
        if (!error && data) setUsers(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [search, activeMainTab]);

  const filteredCircles = circles.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase()) || c.description?.toLowerCase().includes(search.toLowerCase());
    const matchesVibe = activeVibe === 'הכל' || c.name?.includes(activeVibe) || c.description?.includes(activeVibe);
    return matchesSearch && matchesVibe;
  });

  const handleCircleClick = (slug: string) => {
    triggerFeedback('pop');
    navigate(`/circle/${slug}`);
  };

  const handleUserClick = (id: string) => {
    triggerFeedback('pop');
    navigate(`/profile/${id}`);
  };

  const handleVibeClick = (vibeId: string) => {
    triggerFeedback('pop');
    setActiveVibe(vibeId);
  };

  // ייצור האשטאגים דינמיים לתצוגה (סימולציה)
  const generatedTags = search.trim() ? [
    { name: search, count: '1.2M' },
    { name: `${search}Vibes`, count: '450K' },
    { name: `${search}Israel`, count: '120K' },
    { name: `Top${search}`, count: '89K' }
  ] : [];

  return (
    <FadeIn className="px-4 pt-12 pb-32 bg-[#0C0C0C] min-h-screen font-sans flex flex-col gap-5 overflow-x-hidden relative" dir="rtl">
      
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex justify-center">
        <div className="absolute top-[-5%] left-[-10%] w-[50%] h-[40%] bg-white/5 blur-[100px] rounded-full mix-blend-screen"></div>
        <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] bg-[#2196f3]/5 blur-[120px] rounded-full mix-blend-screen"></div>
      </div>

      {/* כותרת נקייה ומינימליסטית */}
      <div className="flex flex-col items-center justify-center relative z-10 mb-2">
        <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
          חיפוש
        </h1>
      </div>

      {/* טאבים ראשיים נקיים ללא אייקונים */}
      <div className="relative z-10 flex border-b border-white/10 w-full mb-1">
        <button 
          onClick={() => { triggerFeedback('pop'); setActiveMainTab('users'); setSearch(''); }} 
          className={`flex-1 pb-3 text-[14px] font-black transition-colors border-b-2 flex items-center justify-center ${activeMainTab === 'users' ? 'text-white border-white' : 'text-white/40 border-transparent hover:text-white/70'}`}
        >
          משתמשים
        </button>
        <button 
          onClick={() => { triggerFeedback('pop'); setActiveMainTab('clubs'); setSearch(''); }} 
          className={`flex-1 pb-3 text-[14px] font-black transition-colors border-b-2 flex items-center justify-center ${activeMainTab === 'clubs' ? 'text-white border-white' : 'text-white/40 border-transparent hover:text-white/70'}`}
        >
          מועדונים
        </button>
      </div>

      {/* שורת החיפוש */}
      <div className="relative z-10">
        <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none">
          <Search size={18} className="text-white/40" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={activeMainTab === 'clubs' ? 'חפש מועדונים, תחומי עניין...' : 'חפש אנשים, חשבונות, האשטאגים...'}
          className="w-full bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[20px] py-4 pr-12 pl-16 text-white text-[14px] font-medium placeholder:text-white/30 focus:border-[#e5e4e2]/50 focus:bg-white/[0.06] transition-all shadow-xl outline-none h-14"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute inset-y-0 left-4 flex items-center justify-center">
            <span className="text-white/40 hover:text-white text-[10px] font-bold uppercase tracking-widest bg-white/[0.05] px-2.5 py-1.5 rounded-lg transition-colors">נקה</span>
          </button>
        )}
      </div>

      {/* ============================================== */}
      {/* אזור מועדונים (CLUBS TAB) */}
      {/* ============================================== */}
      <AnimatePresence mode="wait">
        {activeMainTab === 'clubs' && (
          <motion.div key="clubs-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4 relative z-10">
            {/* ויבים (Vibes) */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 mt-2">
              {VIBES.map(vibe => (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  key={vibe.id}
                  onClick={() => handleVibeClick(vibe.id)}
                  className={`flex items-center gap-2 px-5 h-10 rounded-full font-black text-xs uppercase tracking-widest transition-all shrink-0 border ${
                    activeVibe === vibe.id ? 'bg-white/10 border-white/20 text-white shadow-inner' : 'bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/5'
                  }`}
                >
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
                <div className="flex flex-col gap-1">
                  <span className="text-white font-black text-[16px]">לא מצאנו מועדון</span>
                  <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest">נסה לשנות את החיפוש</span>
                </div>
                <Button onClick={() => { triggerFeedback('pop'); navigate('/create-circle'); }} className="px-8 h-12 bg-[#e5e4e2] text-black font-black text-[13px] uppercase tracking-widest rounded-xl mt-4 active:scale-95 shadow-[0_0_20px_rgba(229,228,226,0.2)]">
                  פתח מועדון משלך
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredCircles.map((circle, idx) => {
                  const isTrending = idx === 0 || circle.members_count > 50;
                  return (
                    <motion.div key={circle.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.3) }}>
                      <div onClick={() => handleCircleClick(circle.slug)} className="bg-white/[0.02] backdrop-blur-xl border border-white/5 p-3 rounded-[24px] flex items-center justify-between shadow-lg cursor-pointer group hover:bg-white/[0.05] active:scale-[0.98] transition-all">
                        <div className="flex items-center gap-4 text-right">
                          <div className="w-14 h-14 rounded-[18px] bg-black border border-white/10 overflow-hidden shrink-0 shadow-inner relative">
                            {circle.cover_url ? (
                              <img src={circle.cover_url} className="w-full h-full object-cover" alt={circle.name} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><Target size={20} className="text-white/20" /></div>
                            )}
                            {isTrending && <div className="absolute top-1 right-1 w-2 h-2 bg-[#ff5722] rounded-full shadow-[0_0_8px_#ff5722]"></div>}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-white font-black text-[15px] tracking-tight">{circle.name}</span>
                            <span className="text-white/40 text-[10px] font-bold mt-1 tracking-widest flex items-center gap-1.5">
                              <span>{circle.members_count || 0} חברים</span> <Users size={10} className="text-white/30" />
                            </span>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/30 transition-colors shrink-0 group-hover:bg-white/10 group-hover:text-white/60 mx-2">
                          <ChevronLeft size={16} />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ============================================== */}
        {/* אזור משתמשים (USERS TAB) עם סינון מתקדם */}
        {/* ============================================== */}
        {activeMainTab === 'users' && (
          <motion.div key="users-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2 relative z-10">
            
            {/* מצב כשהחיפוש ריק - מגמות חמות (Trending) */}
            {!search.trim() ? (
              <div className="mt-4 flex flex-col gap-4">
                <span className="text-white/40 text-[11px] font-black tracking-widest uppercase flex items-center gap-1.5"><span>מגמות חמות</span> <TrendingUp size={14} className="text-[#ff5722]" /></span>
                <div className="flex flex-col gap-3">
                   {['תלאביב', 'מסיבות', 'DRIP', 'הייטק'].map((trend, i) => (
                     <div key={i} className="flex items-center justify-between p-3 rounded-[20px] bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.05] transition-all" onClick={() => setSearch(trend)}>
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center border border-white/10"><Hash size={16} className="text-white/60" /></div>
                         <div className="flex flex-col text-right">
                            <span className="text-white font-bold text-[14px]">{trend}</span>
                            <span className="text-white/30 text-[10px] font-medium tracking-widest uppercase">פופולרי כעת</span>
                         </div>
                       </div>
                       <ChevronLeft size={16} className="text-white/20" />
                     </div>
                   ))}
                </div>
              </div>
            ) : (
              /* מצב כשהמשתמש מחפש - תת-טאבים לאינסטגרם סטייל */
              <>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2 mt-2">
                  <button onClick={() => { triggerFeedback('pop'); setActiveSearchTab('top'); }} className={`px-5 py-2 rounded-full font-black text-[12px] uppercase tracking-widest whitespace-nowrap transition-all border ${activeSearchTab === 'top' ? 'bg-white/10 text-white border-white/20' : 'bg-transparent text-white/40 border-transparent hover:text-white/70'}`}>
                    מובילים
                  </button>
                  <button onClick={() => { triggerFeedback('pop'); setActiveSearchTab('accounts'); }} className={`px-5 py-2 rounded-full font-black text-[12px] uppercase tracking-widest whitespace-nowrap transition-all border ${activeSearchTab === 'accounts' ? 'bg-white/10 text-white border-white/20' : 'bg-transparent text-white/40 border-transparent hover:text-white/70'}`}>
                    חשבונות
                  </button>
                  <button onClick={() => { triggerFeedback('pop'); setActiveSearchTab('tags'); }} className={`px-5 py-2 rounded-full font-black text-[12px] uppercase tracking-widest whitespace-nowrap transition-all border ${activeSearchTab === 'tags' ? 'bg-white/10 text-white border-white/20' : 'bg-transparent text-white/40 border-transparent hover:text-white/70'}`}>
                    האשטאגים
                  </button>
                </div>

                <div className="mt-2">
                  {loading ? (
                    <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-[#e5e4e2]" size={28} /></div>
                  ) : (
                    <AnimatePresence mode="wait">
                      
                      {/* טאב מובילים (Top) + חשבונות (Accounts) מציגים משתמשים */}
                      {(activeSearchTab === 'top' || activeSearchTab === 'accounts') && (
                        <motion.div key="users-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
                          {users.length === 0 ? (
                            <div className="text-center py-16 flex flex-col items-center gap-3">
                              <UserCircle size={40} className="text-white/20" />
                              <span className="text-white/40 text-[13px] font-bold">לא נמצאו חשבונות</span>
                            </div>
                          ) : (
                            users.map((u, idx) => (
                              <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(idx * 0.05, 0.2) }}>
                                <div onClick={() => handleUserClick(u.id)} className="bg-transparent p-2 rounded-[20px] flex items-center justify-between cursor-pointer hover:bg-white/[0.03] active:scale-[0.98] transition-all">
                                  <div className="flex items-center gap-4 text-right">
                                    <div className="w-14 h-14 rounded-full bg-[#111] border border-white/10 overflow-hidden shrink-0 shadow-inner relative">
                                      {u.avatar_url ? (
                                        <img src={u.avatar_url} className="w-full h-full object-cover" alt="" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center"><UserCircle size={20} className="text-white/20" /></div>
                                      )}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-white text-[15px] font-black">{u.full_name || 'משתמש'}</span>
                                      <span className="text-white/40 text-[11px] font-bold mt-0.5 tracking-widest" dir="ltr">@{u.username || 'user'}</span>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            ))
                          )}
                        </motion.div>
                      )}

                      {/* טאב האשטאגים (Tags) - סימולציית תגיות */}
                      {activeSearchTab === 'tags' && (
                        <motion.div key="tags-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
                          {generatedTags.map((tag, idx) => (
                            <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: idx * 0.05 }}>
                              <div className="bg-transparent p-3 rounded-[20px] flex items-center justify-between cursor-pointer hover:bg-white/[0.03] active:scale-[0.98] transition-all">
                                <div className="flex items-center gap-4 text-right">
                                  <div className="w-12 h-12 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0">
                                    <Hash size={20} className="text-white/80" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-white text-[15px] font-black" dir="ltr">#{tag.name}</span>
                                    <span className="text-white/40 text-[10px] font-bold mt-0.5 tracking-widest"><span>{tag.count} פוסטים</span></span>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </motion.div>
                      )}

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
