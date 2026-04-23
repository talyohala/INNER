import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronLeft, Loader2, UserCircle, X, Lock, Unlock, Gift, TrendingUp, Flame, Crown, Hash, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FadeIn } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const cleanToastStyle = {
  background: 'rgba(20, 20, 20, 0.85)',
  backdropFilter: 'blur(16px)',
  color: '#ffffff',
  border: 'none',
  borderRadius: '100px',
  fontSize: '14px',
  fontWeight: 700,
  padding: '12px 24px',
  boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
};

const CATEGORY_TREE = [
  { id: 'all', name: 'הכל' },
  { id: 'venture_capital', name: 'הון סיכון', sub: ['קריפטו', 'נדל"ן', 'חברות הזנק', 'השקעות שונות'] },
  { id: 'business', name: 'עסקים ויזמות', sub: ['מסחר מקוון', 'שיווק', 'רישות עסקי', 'ניהול'] },
  { id: 'tech_alpha', name: 'טק וחדשנות', sub: ['בינה מלאכותית', 'פיתוח', 'סייבר', 'מערכות ענן'] },
  { id: 'lifestyle', name: 'סגנון חיים', sub: ['חיי לילה', 'אופנה', 'טיולים', 'קולינריה'] },
  { id: 'wellness', name: 'גוף ונפש', sub: ['כושר', 'קשיבות', 'תזונה', 'התפתחות אישית'] },
  { id: 'creators', name: 'יוצרים ומדיה', sub: ['הסכתים', 'אמנות', 'מוזיקה', 'וידאו'] },
  { id: 'gaming', name: 'משחקי וידאו', sub: ['ספורט אלקטרוני', 'שידורים חיים', 'פיתוח משחקים'] },
  { id: 'sanctum', name: 'הסנקטום', sub: ['לחברים בלבד', 'אירועי יוקרה', 'הזמנות מיוחדות'] }
];

export const ExplorePage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const myLevel = profile?.level || 1;

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeSub, setActiveSub] = useState('');

  const [searchCirclesResult, setSearchCirclesResult] = useState<any[]>([]);
  const [searchUsersResult, setSearchUsersResult] = useState<any[]>([]);
  const [searchPostsResult, setSearchPostsResult] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // שחרור Main Thread מ-localStorage ע"י טעינה אסינכרונית
  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const cached = localStorage.getItem('inner_recent_searches');
        if (cached) setRecentSearches(JSON.parse(cached));
      } catch {}
    });
  }, []);

  const saveRecentSearch = (term: string) => {
    if (!term.trim()) return;
    const updated = [term, ...recentSearches.filter((t) => t !== term)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('inner_recent_searches', JSON.stringify(updated));
  };

  const removeRecentSearch = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerFeedback('pop');
    const updated = recentSearches.filter((t) => t !== term);
    setRecentSearches(updated);
    localStorage.setItem('inner_recent_searches', JSON.stringify(updated));
  };

  // מנוע טעינה מאוחד חכם - קמפיינים, אנשים מומלצים ופוסטים חמים בבקשה אחת עם מטמון
  const { data: overviewData, isLoading: loadingOverview } = useQuery({
    queryKey: ['explore_overview'],
    queryFn: async () => {
      const [campRes, usersRes, postsRes] = await Promise.all([
        supabase.from('campaigns').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('profiles').select('id, full_name, username, avatar_url, bio, role_label').limit(5),
        supabase.from('posts').select('*, profiles(*)').order('seals_count', { ascending: false }).limit(5)
      ]);
      return {
        campaign: campRes.data || null,
        suggestedUsers: usersRes.data || [],
        trendingPosts: postsRes.data || []
      };
    },
    staleTime: 1000 * 60 * 10 // שומר בזיכרון ל-10 דקות כדי לא לטעון סתם שוב
  });

  // טעינת מועדונים לפי קטגוריה וקאש אוטומטי
  const { data: circlesData, isFetching: loadingCircles } = useQuery({
    queryKey: ['explore_circles', activeCategory, activeSub],
    queryFn: async () => {
      let query = supabase.from('circles').select('*').order('created_at', { ascending: false });
      if (activeCategory !== 'all') query = query.eq('category', activeCategory);
      if (activeSub) query = query.eq('sub_category', activeSub);

      const { data, error } = await query;
      if (error) throw error;

      return (Array.isArray(data) ? data : []).map((c: any) => ({
        ...c,
        active_now: Math.max(1, Math.ceil((c.members_count || 5) * 0.2 + Math.random() * 4)),
        is_trending: Math.random() > 0.7
      }));
    },
    staleTime: 1000 * 60 * 5 // 5 דקות קאש למעבר מהיר בין קטגוריות
  });

  const activeCampaign = overviewData?.campaign;
  const suggestedUsers = overviewData?.suggestedUsers || [];
  const trendingPosts = overviewData?.trendingPosts || [];
  const circles = circlesData || [];

  // מנוע החיפוש החי (מנוהל דרך Local State בשילוב Effect debounce)
  useEffect(() => {
    const fetchSearchResults = async () => {
      const term = search.trim();
      if (!term) {
        setSearchUsersResult([]);
        setSearchCirclesResult([]);
        setSearchPostsResult([]);
        return;
      }

      setLoadingSearch(true);
      try {
        const queryTerm = `%${term}%`;
        const [usersRes, circlesRes, postsRes] = await Promise.all([
          supabase.from('profiles')
            .select('id, full_name, username, avatar_url, bio, role_label')
            .or(`full_name.ilike.${queryTerm},username.ilike.${queryTerm},bio.ilike.${queryTerm}`)
            .limit(5),
          supabase.from('circles')
            .select('*')
            .or(`name.ilike.${queryTerm},description.ilike.${queryTerm},category.ilike.${queryTerm},sub_category.ilike.${queryTerm}`)
            .limit(5),
          supabase.from('posts')
            .select('id, content, created_at, profiles(full_name, avatar_url, role_label)')
            .ilike('content', queryTerm)
            .limit(5)
        ]);

        if (usersRes.data) setSearchUsersResult(usersRes.data);
        if (circlesRes.data) setSearchCirclesResult(circlesRes.data);
        if (postsRes.data) setSearchPostsResult(postsRes.data);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoadingSearch(false);
      }
    };

    const timeoutId = setTimeout(fetchSearchResults, 400);
    return () => clearTimeout(timeoutId);
  }, [search]);

  const currentCatObj = CATEGORY_TREE.find(c => c.id === activeCategory);
  const hasSearchResults = searchCirclesResult.length > 0 || searchUsersResult.length > 0 || searchPostsResult.length > 0;

  return (
    <FadeIn className="pt-[calc(env(safe-area-inset-top)+12px)] pb-32 bg-[#121212] min-h-[100dvh] font-sans flex flex-col overflow-x-hidden" dir="rtl">
      
      {/* Header & Sticky Search Bar */}
      <div className="relative z-20 px-5 sticky top-0 bg-[#121212]/90 backdrop-blur-xl py-3 border-none">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש נושאים, אנשים או מועדונים..."
            className="w-full bg-white/5 border-none rounded-[24px] h-[56px] pr-12 pl-12 text-white text-[15px] font-black placeholder:text-[#8b8b93] outline-none transition-all focus:bg-white/10 shadow-sm"
          />
          <Search size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8b8b93] pointer-events-none" />
          
          <AnimatePresence>
            {search && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => { triggerFeedback('pop'); setSearch(''); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8b8b93] hover:text-white transition-colors p-1 active:scale-90"
              >
                <X size={18} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex-1 mt-2">
        <AnimatePresence mode="wait">
          
          {/* STATE 1: SMART SEARCH ACTIVE */}
          {search.trim() ? (
            <motion.div key="search-results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-8 pt-4">
              {loadingSearch ? (
                <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-accent-primary" /></div>
              ) : (
                <>
                  {/* Global Circle Results */}
                  {searchCirclesResult.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="text-[#8b8b93] text-[11px] font-black uppercase tracking-widest px-6">מועדונים</span>
                      <div className="flex flex-col px-3">
                        {searchCirclesResult.map((circle) => (
                          <div
                            key={circle.id}
                            onClick={() => { saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/circle/${circle.slug || circle.id}`); }}
                            className="py-3 px-3 flex items-center justify-between cursor-pointer rounded-[20px] hover:bg-white/5 active:scale-[0.98] transition-all"
                          >
                            <div className="flex items-center gap-4 text-right">
                              <div className="relative">
                                {circle.cover_url ? (
                                  <img src={circle.cover_url} className="w-14 h-14 rounded-[16px] object-cover border-none shadow-sm" />
                                ) : (
                                  <div className="w-14 h-14 rounded-[16px] bg-[#1a1a1e] border-none flex items-center justify-center text-[#8b8b93] font-black text-xl shadow-inner">
                                    {circle.name?.charAt(0)}
                                  </div>
                                )}
                                {circle.is_private && (
                                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#121212] rounded-full flex items-center justify-center shadow-md">
                                    <Lock size={10} className="text-[#8b8b93]" />
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-white font-black text-[16px]">{circle.name}</span>
                                <span className="text-[#8b8b93] text-[12px] font-bold mt-0.5 flex items-center gap-1.5">
                                  {circle.category === 'venture_capital' ? 'הון סיכון' : circle.category}
                                  {circle.join_price > 0 && <span className="text-accent-primary font-black text-[10px] tracking-wider uppercase">• {circle.join_price} CRD</span>}
                                </span>
                              </div>
                            </div>
                            <ChevronLeft size={20} className="text-[#8b8b93] rtl:rotate-180" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Global User Results */}
                  {searchUsersResult.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="text-[#8b8b93] text-[11px] font-black uppercase tracking-widest px-6">משתמשים</span>
                      <div className="flex flex-col px-3">
                        {searchUsersResult.map((u) => (
                          <div
                            key={u.id}
                            onClick={() => { saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/profile/${u.id}`); }}
                            className="py-3 px-3 flex items-center justify-between cursor-pointer rounded-[20px] hover:bg-white/5 active:scale-[0.98] transition-all"
                          >
                            <div className="flex items-center gap-4 text-right">
                              <div className="w-12 h-12 rounded-full bg-[#1a1a1e] overflow-hidden shrink-0 flex items-center justify-center shadow-sm border-none">
                                {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={28} className="text-[#8b8b93]" strokeWidth={1.5} />}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-white font-black text-[15px] flex items-center gap-1.5">
                                  {u.full_name || 'משתמש'}
                                  {u.role_label === 'CORE' && <Crown size={12} className="text-accent-primary" />}
                                </span>
                                <span className="text-[#8b8b93] text-[11px] font-bold mt-0.5 tracking-widest" dir="ltr">@{u.username || 'user'}</span>
                              </div>
                            </div>
                            <ChevronLeft size={20} className="text-[#8b8b93] rtl:rotate-180" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Global Posts & Hashtags Results */}
                  {searchPostsResult.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="text-[#8b8b93] text-[11px] font-black uppercase tracking-widest px-6">פעילות ודיונים</span>
                      <div className="flex flex-col px-4 gap-3">
                        {searchPostsResult.map((post) => (
                          <div
                            key={post.id}
                            onClick={() => { saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/post/${post.id}`); }}
                            className="p-5 bg-white/5 rounded-[24px] flex flex-col gap-3 cursor-pointer active:scale-[0.98] transition-all border-none shadow-sm"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-[#121212] shrink-0">
                                  {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-[#8b8b93]" />}
                                </div>
                                <span className="text-[#8b8b93] font-bold text-[12px]">{post.profiles?.full_name || 'אנונימי'}</span>
                              </div>
                              <Hash size={16} className="text-[#8b8b93] opacity-50" />
                            </div>
                            <p className="text-white text-[14px] leading-relaxed line-clamp-2 font-medium">
                              {post.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No Results at all */}
                  {!hasSearchResults && (
                    <div className="text-center py-24 flex flex-col items-center gap-4 opacity-60">
                      <Search size={48} className="text-[#8b8b93]" strokeWidth={1.5} />
                      <span className="text-[#8b8b93] font-black text-[14px] tracking-widest uppercase">אין תוצאות לחיפוש זה</span>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          ) : (
            
            /* STATE 2: EXPLORE HOME */
            <motion.div key="explore-home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-8 pb-10">
              
              {/* CATEGORIES - TABS FLOAT STYLE WITH LINES */}
              <div className="flex flex-col gap-4 mt-2">
                <LayoutGroup id="exploreCategories">
                  <div className="flex items-center gap-x-8 gap-y-1 overflow-x-auto scrollbar-hide px-6 pb-2">
                    {CATEGORY_TREE.map((cat) => {
                      const isActive = activeCategory === cat.id;
                      return (
                        <button key={cat.id} onClick={() => { triggerFeedback('pop'); setActiveCategory(cat.id); setActiveSub(''); }} className="relative flex flex-col items-center min-w-max pb-2.5 active:scale-95 transition-all">
                          <span className={`text-[15px] transition-colors ${isActive ? 'text-white font-black' : 'text-[#8b8b93] font-bold hover:text-white/80'}`}>
                            {cat.name}
                          </span>
                          {isActive && <motion.div layoutId="catLine" className="absolute bottom-0 w-6 h-0.5 bg-accent-primary rounded-full shadow-[0_0_8px_rgba(var(--color-accent-primary),0.6)]" />}
                        </button>
                      );
                    })}
                  </div>
                </LayoutGroup>

                <AnimatePresence mode="wait">
                  {currentCatObj && currentCatObj.sub && currentCatObj.sub.length > 0 && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <LayoutGroup id="exploreSub">
                        <div className="flex items-center gap-x-8 gap-y-1 overflow-x-auto scrollbar-hide px-6 pb-2">
                          {currentCatObj.sub.map((subName) => {
                            const isActive = activeSub === subName;
                            return (
                              <button key={subName} onClick={() => { triggerFeedback('pop'); setActiveSub(activeSub === subName ? '' : subName); }} className="relative flex flex-col items-center min-w-max pb-2.5 active:scale-95 transition-transform">
                                <span className={`text-[13px] transition-colors ${isActive ? 'text-white font-black' : 'text-[#8b8b93] font-bold hover:text-white/80'}`}>
                                  {subName}
                                </span>
                                {isActive && <motion.div layoutId="subLine" className="absolute bottom-0 w-6 h-0.5 bg-accent-primary rounded-full shadow-[0_0_8px_rgba(var(--color-accent-primary),0.6)]" />}
                              </button>
                            );
                          })}
                        </div>
                      </LayoutGroup>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Dynamic Campaign / Sponsor Drop */}
              {activeCampaign && (
                <div onClick={() => { triggerFeedback('pop'); if (activeCampaign.action_url) window.open(activeCampaign.action_url, '_blank'); else toast('קמפיין נפתח!', { style: cleanToastStyle }); }} className="mx-5 relative overflow-hidden rounded-[32px] cursor-pointer group active:scale-[0.98] transition-transform shadow-md border-none">
                  <div className="absolute inset-0 bg-[#1a1a1e] backdrop-blur-xl" />
                  {activeCampaign.media_url && (
                    <img src={activeCampaign.media_url} className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay" />
                  )}
                  <div className="relative p-8 flex items-center justify-between z-10">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[#8b8b93] text-[11px] font-black tracking-widest uppercase flex items-center gap-1.5">
                        <Gift size={14} className="text-accent-primary" /> קמפיין מיוחד
                      </span>
                      <span className="text-white font-black text-[22px] tracking-wide">{activeCampaign.title}</span>
                      <span className="text-[#8b8b93] text-[13px] font-medium leading-relaxed max-w-[200px] line-clamp-2">
                        {activeCampaign.body || 'צפה עכשיו בפרטים נוספים'}
                      </span>
                    </div>
                    <button className="h-14 w-14 shrink-0 rounded-full bg-[#121212] text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <ChevronLeft size={24} strokeWidth={2.5} className="rtl:-scale-x-100" />
                    </button>
                  </div>
                </div>
              )}

              {/* Popular Circles Grid - Full Image Version */}
              <div className="flex flex-col gap-4">
                <span className="text-[#8b8b93] text-[11px] font-black uppercase tracking-widest px-6 flex items-center gap-1.5">
                  מועדונים חמים <TrendingUp size={14} className="text-[#8b8b93]" />
                </span>
                
                {loadingCircles ? (
                  <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-accent-primary" /></div>
                ) : circles.length === 0 ? (
                  <div className="text-center py-10 opacity-50"><span className="text-[#8b8b93] font-black text-[12px] uppercase tracking-widest">אין פעילות בקטגוריה זו</span></div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 px-5">
                    {circles.map((circle, idx) => {
                      const reqLevel = circle.min_level || 1;
                      const isLocked = myLevel < reqLevel;
                      const joinPrice = Number(circle.join_price || circle.entry_crd_price || circle.price || 0);
                      
                      return (
                        <motion.div
                          key={circle.id} layout
                          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.2) }}
                          onClick={() => { if (isLocked) { triggerFeedback('error'); return; } triggerFeedback('pop'); navigate(`/circle/${circle.slug || circle.id}`); }}
                          className={`cursor-pointer active:scale-[0.97] transition-transform duration-200 ${isLocked ? 'opacity-70 grayscale-[30%]' : ''}`}
                        >
                          <div className="h-[220px] rounded-[24px] bg-[#1a1a1e] border-none shadow-sm flex flex-col relative overflow-hidden group">
                            
                            {/* Full Sharp Image */}
                            <div className="absolute inset-0 z-0 bg-[#121212]">
                              {circle.cover_url ? (
                                <img src={circle.cover_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[#8b8b93] font-black text-6xl bg-white/5">
                                  {circle.name?.charAt(0)}
                                </div>
                              )}
                            </div>
                            
                            {/* Top Badges */}
                            <div className="relative z-10 p-3 flex justify-between items-start">
                              <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-[12px] border-none flex items-center gap-1.5 shadow-sm">
                                {isLocked ? (
                                  <><Lock size={12} className="text-rose-500" /><span className="text-white font-black text-[10px] tracking-widest">רמה {reqLevel}</span></>
                                ) : circle.is_private ? (
                                  <><Lock size={12} className="text-slate-300" /><span className="text-white font-black text-[10px] tracking-widest">{joinPrice || 0} CRD</span></>
                                ) : (
                                  <><Unlock size={12} className="text-emerald-400" /><span className="text-white font-black text-[10px] tracking-widest uppercase">חופשי</span></>
                                )}
                              </div>
                              
                              {circle.is_trending && (
                                <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} className="relative z-10 p-1">
                                  <Flame size={20} className="text-orange-500 drop-shadow-sm" fill="currentColor" />
                                </motion.div>
                              )}
                            </div>
                            
                            {/* Title & Stats - Crisp Dark Gradient strictly at the bottom for readability */}
                            <div className="relative z-10 mt-auto p-4 pt-12 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end">
                              <h3 className="text-white font-black text-[16px] leading-tight truncate drop-shadow-md">{circle.name}</h3>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[11px] font-black text-white/70 uppercase tracking-widest">{circle.active_now} מחוברים</span>
                              </div>
                            </div>

                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Trending Posts */}
              {!loadingOverview && trendingPosts.length > 0 && (
                <div className="flex flex-col gap-3 pt-2">
                  <span className="text-[#8b8b93] text-[11px] font-black uppercase tracking-widest px-6 flex items-center gap-1.5">
                    פעילות חמה <Flame size={14} className="text-orange-500" />
                  </span>
                  <div className="flex gap-4 overflow-x-auto scrollbar-hide px-5 pb-4 snap-x snap-mandatory">
                    {trendingPosts.map((post: any) => (
                      <div key={post.id} onClick={() => { triggerFeedback('pop'); navigate(`/post/${post.id}`); }} className="w-[260px] snap-center shrink-0 bg-white/5 border-none rounded-[28px] p-5 flex flex-col gap-3 cursor-pointer shadow-sm active:scale-95 transition-transform">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-[#121212] shrink-0">
                            {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-[#8b8b93]" />}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-white font-black text-[13px] flex items-center gap-1 truncate max-w-[160px]">{post.profiles?.full_name || 'אנונימי'} {post.profiles?.role_label === 'CORE' && <Crown size={12} className="text-accent-primary"/>}</span>
                          </div>
                        </div>
                        {post.media_url && (
                          <div className="w-full h-28 rounded-[16px] overflow-hidden bg-[#121212] mb-1 border-none shadow-inner">
                            {post.media_url.match(/\.(mp4|webm|mov)$/i) ? (
                              <video src={post.media_url} className="w-full h-full object-cover" />
                            ) : (
                              <img src={post.media_url} className="w-full h-full object-cover" />
                            )}
                          </div>
                        )}
                        {post.content && !post.media_url && (
                          <p className="text-white/90 text-[13px] line-clamp-3 font-medium leading-relaxed">{post.content}</p>
                        )}
                        <div className="mt-auto pt-3 flex items-center justify-between">
                          <span className="text-orange-500 text-[12px] font-black tracking-widest flex items-center gap-1.5"><Flame size={14} fill="currentColor"/> {post.seals_count || 0}</span>
                          <span className="text-[#8b8b93] text-[12px] font-bold flex items-center gap-1.5"><MessageSquare size={14}/> {post.comments_count || 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Users */}
              <div className="flex flex-col gap-3">
                <span className="text-[#8b8b93] text-[11px] font-black uppercase tracking-widest px-6">אנשים ששווה להכיר</span>
                {loadingOverview ? (
                  <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-accent-primary" /></div>
                ) : (
                  <div className="flex flex-col px-4 gap-2">
                    {suggestedUsers.map((u: any) => (
                      <div
                        key={u.id}
                        className="py-3 px-4 flex items-center justify-between cursor-pointer rounded-[20px] hover:bg-white/5 active:scale-[0.98] transition-all"
                        onClick={() => { triggerFeedback('pop'); navigate(`/profile/${u.id}`); }}
                      >
                        <div className="flex items-center gap-4 text-right">
                          <div className="w-12 h-12 rounded-full bg-[#1a1a1e] overflow-hidden shrink-0 flex items-center justify-center shadow-sm border-none">
                            {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={28} className="text-[#8b8b93]" strokeWidth={1.5} />}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-white font-black text-[15px] flex items-center gap-1.5 truncate max-w-[160px]">
                              {u.full_name || 'משתמש'}
                              {u.role_label === 'CORE' && <Crown size={12} className="text-accent-primary" />}
                            </span>
                            <span className="text-[#8b8b93] text-[11px] font-bold mt-0.5 tracking-widest" dir="ltr">@{u.username || 'user'}</span>
                          </div>
                        </div>
                        <ChevronLeft size={20} className="text-[#8b8b93] rtl:rotate-180" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="flex flex-col px-5 gap-3 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[#8b8b93] text-[11px] font-black uppercase tracking-widest">חיפושים אחרונים</span>
                    <button onClick={() => { triggerFeedback('pop'); setRecentSearches([]); localStorage.removeItem('inner_recent_searches'); }} className="text-[#8b8b93] hover:text-white transition-colors text-[11px] font-black uppercase tracking-widest">נקה הכל</button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 snap-x">
                    {recentSearches.map((term, i) => (
                      <div key={i} onClick={() => { triggerFeedback('pop'); setSearch(term); }} className="snap-start shrink-0 flex items-center gap-2 bg-white/5 rounded-full px-5 py-2.5 cursor-pointer active:scale-95 transition-transform shadow-sm whitespace-nowrap border-none hover:bg-white/10">
                        <Search size={14} className="text-[#8b8b93]" />
                        <span className="text-white font-bold text-[13px]">{term}</span>
                        <button onClick={(e) => removeRecentSearch(term, e)} className="p-1 ml-1 text-[#8b8b93] hover:text-white transition-colors"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FadeIn>
  );
};
