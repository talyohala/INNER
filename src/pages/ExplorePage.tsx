import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronLeft, Loader2, UserCircle, X, Lock, Unlock, Gift, TrendingUp, Timer, Flame, Crown, Hash } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FadeIn } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const CATEGORY_TREE = [
  { id: 'all', name: 'הכל' },
  { id: 'venture_capital', name: 'הון סיכון', sub: ['קריפטו', 'נדל"ן', 'סטארטאפים'] },
  { id: 'lifestyle', name: 'לייף סטייל', sub: ['חיי לילה', 'אופנה', 'טיולים'] },
  { id: 'tech_alpha', name: 'טק', sub: ['בינה מלאכותית', 'פיתוח', 'סייבר'] },
  { id: 'creators', name: 'יוצרים', sub: ['מדיה', 'פודקאסטים', 'אמנות'] },
  { id: 'sanctum', name: 'The Sanctum', sub: ['לחברים בלבד'] }
];

export const ExplorePage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeSub, setActiveSub] = useState('');
  
  // States for Explore Home
  const [circles, setCircles] = useState<any[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<any[]>([]);
  
  // States for Smart Search Results
  const [searchCirclesResult, setSearchCirclesResult] = useState<any[]>([]);
  const [searchUsersResult, setSearchUsersResult] = useState<any[]>([]);
  const [searchPostsResult, setSearchPostsResult] = useState<any[]>([]);
  
  const [recentSearches, setRecentSearches] = useState<string[]>(
    JSON.parse(localStorage.getItem('inner_recent_searches') || '[]')
  );
  
  const [loadingCircles, setLoadingCircles] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [loadingTrending, setLoadingTrending] = useState(true);
  
  const myLevel = profile?.level || 1;

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

  // --- Explore Home Fetchers ---
  useEffect(() => {
    const fetchCircles = async () => {
      try {
        setLoadingCircles(true);
        let query = supabase.from('circles').select('*').order('created_at', { ascending: false });
        if (activeCategory !== 'all') query = query.eq('category', activeCategory);
        if (activeSub) query = query.eq('sub_category', activeSub);
        
        const { data, error } = await query;
        if (error) throw error;
        
        const formatted = (Array.isArray(data) ? data : []).map((c: any) => ({
          ...c,
          active_now: Math.max(1, Math.ceil((c.members_count || 5) * 0.2 + Math.random() * 4)),
          is_trending: Math.random() > 0.7
        }));
        
        setCircles(formatted);
      } catch {} finally { setLoadingCircles(false); }
    };
    fetchCircles();
  }, [activeCategory, activeSub]);

  useEffect(() => {
    const fetchSuggested = async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('id, full_name, username, avatar_url, bio, role_label').limit(5);
        if (!error && data) setSuggestedUsers(data);
      } catch {} finally { setLoadingSuggestions(false); }
    };
    fetchSuggested();
  }, []);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const { data, error } = await supabase.from('posts')
          .select('*, profiles(*)')
          .order('seals_count', { ascending: false })
          .limit(5);
        if (!error && data) setTrendingPosts(data);
      } catch {} finally { setLoadingTrending(false); }
    };
    fetchTrending();
  }, []);

  // --- SMART GLOBAL SEARCH ALGORITHM ---
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
        
        // שליפה מקבילה מ-3 טבלאות
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
    
    // Debounce של 400ms כדי לא להעמיס על השרת בהקלדה מהירה
    const timeoutId = setTimeout(fetchSearchResults, 400);
    return () => clearTimeout(timeoutId);
  }, [search]);

  const currentCatObj = CATEGORY_TREE.find(c => c.id === activeCategory);
  const hasSearchResults = searchCirclesResult.length > 0 || searchUsersResult.length > 0 || searchPostsResult.length > 0;

  return (
    <FadeIn className="pt-[calc(env(safe-area-inset-top)+12px)] pb-32 bg-surface min-h-screen font-sans flex flex-col overflow-x-hidden" dir="rtl">
      
      {/* Header & Sticky Search Bar (Slate navy focus) */}
      <div className="relative z-20 px-4 sticky top-0 bg-surface/90 backdrop-blur-2xl py-3 shadow-sm border-b border-surface-border">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חפש נושאים, מועדונים, אנשים..."
            className="w-full bg-surface-card border border-surface-border rounded-full h-[52px] pr-12 pl-12 text-brand text-[15px] font-bold placeholder:text-brand-muted/50 outline-none transition-all focus:border-slate-400/50 shadow-inner"
          />
          <Search size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" />
          {search && (
            <button onClick={() => { triggerFeedback('pop'); setSearch(''); }} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand transition-colors p-1 active:scale-90">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 mt-4">
        <AnimatePresence mode="wait">
          
          {/* STATE 1: SMART SEARCH ACTIVE */}
          {search.trim() ? (
            <motion.div key="search-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">
              
              {loadingSearch ? (
                <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>
              ) : (
                <>
                  {/* Global Circle Results */}
                  {searchCirclesResult.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-6">מועדונים</span>
                      <div className="mx-4 bg-surface-card border border-surface-border rounded-[24px] overflow-hidden flex flex-col shadow-sm">
                        {searchCirclesResult.map((circle, idx) => (
                          <div
                            key={circle.id}
                            onClick={() => { saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/circle/${circle.slug || circle.id}`); }}
                            className={`py-4 px-5 flex items-center justify-between cursor-pointer hover:bg-white/5 active:scale-[0.98] transition-all ${idx !== searchCirclesResult.length - 1 ? 'border-b border-surface-border' : ''}`}
                          >
                            <div className="flex items-center gap-4 text-right">
                              <div className="relative">
                                {circle.cover_url ? (
                                  <img src={circle.cover_url} className="w-14 h-14 rounded-[14px] object-cover border border-surface-border shadow-sm" />
                                ) : (
                                  <div className="w-14 h-14 rounded-[14px] bg-surface border border-surface-border flex items-center justify-center text-brand-muted font-black text-xl shadow-inner">
                                    {circle.name?.charAt(0)}
                                  </div>
                                )}
                                {circle.is_private && (
                                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-surface-card border border-surface-border rounded-full flex items-center justify-center shadow-md">
                                    <Lock size={10} className="text-slate-400" />
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-brand font-black text-[16px]">{circle.name}</span>
                                <span className="text-brand-muted text-[12px] font-medium mt-0.5 flex items-center gap-1.5">
                                  {circle.category === 'venture_capital' ? 'הון סיכון' : circle.category}
                                  {circle.join_price > 0 && <span className="text-slate-400 font-black text-[10px] tracking-wider uppercase">• {circle.join_price} CRD</span>}
                                </span>
                              </div>
                            </div>
                            <ChevronLeft size={20} className="text-brand-muted" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Global User Results */}
                  {searchUsersResult.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-6">משתמשים</span>
                      <div className="mx-4 bg-surface-card border border-surface-border rounded-[24px] overflow-hidden flex flex-col shadow-sm">
                        {searchUsersResult.map((u, idx) => (
                          <div
                            key={u.id}
                            onClick={() => { saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/profile/${u.id}`); }}
                            className={`py-4 px-5 flex items-center justify-between cursor-pointer hover:bg-white/5 active:scale-[0.98] transition-all ${idx !== searchUsersResult.length - 1 ? 'border-b border-surface-border' : ''}`}
                          >
                            <div className="flex items-center gap-4 text-right">
                              <div className="w-12 h-12 rounded-full border border-surface-border bg-surface overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
                                {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={28} className="text-brand-muted" strokeWidth={1.5} />}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-brand font-black text-[15px] flex items-center gap-1">
                                  {u.full_name || 'משתמש'}
                                  {u.role_label === 'CORE' && <Crown size={12} className="text-slate-400" />}
                                </span>
                                <span className="text-brand-muted text-[12px] font-medium mt-0.5" dir="ltr">@{u.username || 'user'}</span>
                              </div>
                            </div>
                            <ChevronLeft size={20} className="text-brand-muted" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Global Posts & Hashtags Results */}
                  {searchPostsResult.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-6">פוסטים ודיונים</span>
                      <div className="mx-4 bg-surface-card border border-surface-border rounded-[24px] overflow-hidden flex flex-col shadow-sm">
                        {searchPostsResult.map((post, idx) => (
                          <div
                            key={post.id}
                            onClick={() => { saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/post/${post.id}`); }}
                            className={`py-4 px-5 flex flex-col gap-2 cursor-pointer hover:bg-white/5 active:scale-[0.98] transition-all ${idx !== searchPostsResult.length - 1 ? 'border-b border-surface-border' : ''}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-surface border border-surface-border shrink-0">
                                  {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-brand-muted" />}
                                </div>
                                <span className="text-brand-muted font-bold text-[11px]">{post.profiles?.full_name || 'אנונימי'}</span>
                              </div>
                              <Hash size={14} className="text-slate-400/50" />
                            </div>
                            <p className="text-brand text-[13px] leading-relaxed line-clamp-2 font-medium">
                              {/* Highlight the search term visually if needed, but for now simple render */}
                              {post.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No Results at all */}
                  {!hasSearchResults && (
                    <div className="text-center py-20 flex flex-col items-center gap-4 opacity-50">
                      <Search size={40} className="text-brand-muted" strokeWidth={1} />
                      <span className="text-brand-muted font-black text-[12px] tracking-widest uppercase">אין תוצאות לחיפוש הזה</span>
                    </div>
                  )}
                </划>
              )}
            </motion.div>

          ) : (
            
            /* STATE 2: EXPLORE HOME */
            <motion.div key="explore-home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-8 pb-10">
              
              {/* Sponsor Drop (Updated Slate navy) */}
              <div className="mx-4 relative overflow-hidden rounded-[24px] cursor-pointer group active:scale-[0.98] transition-transform shadow-lg border border-surface-border">
                <div className="absolute inset-0 bg-gradient-to-r from-slate-600/20 via-slate-500/10 to-slate-600/20 animate-pulse opacity-50" />
                <div className="absolute inset-0 bg-surface-card/60 backdrop-blur-xl" />
                <div className="relative p-6 flex items-center justify-between z-10">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-slate-300 text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5">
                      <Gift size={12} /> דרופ ממומן • Nike
                    </span>
                    <span className="text-brand font-black text-[18px] tracking-wide">קבל 50 CRD חינם</span>
                    <span className="text-brand-muted text-[12px] font-medium leading-relaxed max-w-[180px]">צפה בתוכן VIP מהקמפיין החדש וקבל מטבעות לארנק.</span>
                  </div>
                  <button onClick={() => toast.success('הדרופ נפתח!')} className="h-12 w-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <ChevronLeft size={24} strokeWidth={2.5} className="rtl:-scale-x-100" />
                  </button>
                </div>
              </div>

              {/* Trending Posts (Slate navy accent) */}
              {!loadingTrending && trendingPosts.length > 0 && (
                <div className="flex flex-col gap-3">
                  <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-6 flex items-center gap-1.5">
                    פוסטים חמים <Flame size={14} className="text-orange-500" />
                  </span>
                  <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-2">
                    {trendingPosts.map((post) => (
                      <div key={post.id} onClick={() => navigate(`/post/${post.id}`)} className="w-[240px] shrink-0 bg-[#0a0a0a] border border-surface-border rounded-[24px] p-4 flex flex-col gap-3 cursor-pointer shadow-sm active:scale-95 transition-transform group hover:border-slate-400/30">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-surface border border-surface-border">
                            {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-brand-muted" />}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-brand font-black text-[12px] flex items-center gap-1">{post.profiles?.full_name || 'אנונימי'} {post.profiles?.role_label === 'CORE' && <Crown size={10} className="text-slate-400"/>}</span>
                          </div>
                        </div>
                        {post.media_url && (
                          <div className="w-full h-24 rounded-xl overflow-hidden bg-surface border border-surface-border mb-1">
                            {post.media_url.match(/\.(mp4|webm|mov)$/i) ? (
                               <video src={post.media_url} className="w-full h-full object-cover opacity-80" />
                            ) : (
                               <img src={post.media_url} className="w-full h-full object-cover opacity-80" />
                            )}
                          </div>
                        )}
                        {post.content && !post.media_url && (
                          <p className="text-brand-muted text-[12px] line-clamp-3 font-medium leading-relaxed">{post.content}</p>
                        )}
                        <div className="mt-auto pt-2 flex items-center justify-between border-t border-surface-border">
                          <span className="text-orange-500 text-[11px] font-black tracking-widest flex items-center gap-1"><Flame size={12} fill="currentColor"/> {post.seals_count || 0}</span>
                          <span className="text-brand-muted text-[11px] font-bold flex items-center gap-1"><MessageSquare size={12}/> {post.comments_count || 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="flex flex-col px-4 gap-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest">חיפושים אחרונים</span>
                    <button onClick={() => { triggerFeedback('pop'); setRecentSearches([]); localStorage.removeItem('inner_recent_searches'); }} className="text-slate-400 text-[11px] font-black uppercase tracking-widest">נקה</button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                    {recentSearches.map((term, i) => (
                      <div key={i} onClick={() => { triggerFeedback('pop'); setSearch(term); }} className="flex items-center gap-2 bg-surface-card border border-surface-border rounded-full px-4 py-2 cursor-pointer active:scale-95 transition-transform shadow-sm whitespace-nowrap hover:bg-white/5">
                        <Search size={12} className="text-brand-muted" />
                        <span className="text-brand font-bold text-[13px]">{term}</span>
                        <button onClick={(e) => removeRecentSearch(term, e)} className="p-0.5 ml-1 text-brand-muted hover:text-brand transition-colors"><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CATEGORIES (Updated to match Smoky Navy Glass) */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 min-w-max pb-1 overflow-x-auto scrollbar-hide px-4">
                  {CATEGORY_TREE.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => { triggerFeedback('pop'); setActiveCategory(cat.id); setActiveSub(''); }}
                      className={`px-5 py-2.5 rounded-full text-[13px] font-black tracking-wide transition-all border ${
                        activeCategory === cat.id
                          ? 'bg-slate-400/10 border-slate-400/30 text-slate-300 shadow-[0_0_15px_rgba(148,163,184,0.1)]'
                          : 'bg-surface-card border-surface-border text-brand-muted hover:text-brand hover:border-surface-border-hover'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
                
                {/* Sub-categories */}
                <AnimatePresence mode="wait">
                  {currentCatObj && currentCatObj.sub && currentCatObj.sub.length > 0 && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex overflow-x-auto scrollbar-hide gap-2 px-4 mt-1">
                      {currentCatObj.sub.map((subName) => (
                        <button
                          key={subName}
                          onClick={() => { triggerFeedback('pop'); setActiveSub(activeSub === subName ? '' : subName); }}
                          className={`shrink-0 h-8 px-4 rounded-full font-bold text-[11px] transition-all border ${
                            activeSub === subName
                              ? 'bg-white/10 border-white/20 text-white shadow-sm'
                              : 'bg-transparent border-surface-border text-brand-muted hover:bg-white/5'
                          }`}
                        >
                          {subName}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Popular Circles Grid (Updated Slate navy accent & Animated Flame) */}
              <div className="flex flex-col gap-4">
                <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-6 flex items-center gap-1.5">
                  מועדונים חמים <TrendingUp size={14} className="text-slate-400" />
                </span>
                
                {loadingCircles ? (
                  <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>
                ) : filteredCircles.length === 0 ? (
                  <div className="text-center py-10 opacity-50"><span className="text-brand-muted font-black text-[12px] uppercase tracking-widest">אין מועדונים פעילים בקטגוריה זו</span></div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 px-4">
                    {filteredCircles.map((circle, idx) => {
                      const reqLevel = circle.min_level || 1;
                      const isLocked = myLevel < reqLevel;
                      const joinPrice = Number(circle.join_price || circle.entry_crd_price || circle.price || 0);

                      return (
                        <motion.div
                          key={circle.id}
                          layout
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.2) }}
                          onClick={() => {
                            if (isLocked) { triggerFeedback('error'); return; }
                            triggerFeedback('pop'); navigate(`/circle/${circle.slug || circle.id}`);
                          }}
                          className={`cursor-pointer active:scale-[0.97] transition-transform duration-200 ${isLocked ? 'opacity-70 grayscale-[30%]' : ''}`}
                        >
                          <div className="h-[220px] rounded-[24px] bg-surface-card border border-surface-border shadow-sm flex flex-col relative overflow-hidden group hover:border-slate-400/30 transition-colors">
                            <div className="absolute inset-0 z-0 bg-surface">
                              {circle.cover_url ? (
                                <img src={circle.cover_url} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-brand-muted font-black text-6xl bg-surface">
                                  {circle.name?.charAt(0)}
                                </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface-card/60 to-transparent" />
                            </div>
                            
                            {/* VIP / Price / Lock / Animated Flame */}
                            <div className="relative z-10 p-3 flex justify-between items-start">
                              <div className="bg-black/50 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5 shadow-sm">
                                {isLocked ? (
                                  <>
                                    <Lock size={10} className="text-rose-500" />
                                    <span className="text-white text-[10px] font-black tracking-widest">רמה {reqLevel}</span>
                                  </>
                                ) : circle.is_private ? (
                                  <>
                                    <Lock size={10} className="text-slate-400" />
                                    <span className="text-white text-[10px] font-black tracking-widest">{joinPrice || 0} CRD</span>
                                  </>
                                ) : (
                                  <>
                                    <Unlock size={10} className="text-green-400" />
                                    <span className="text-white text-[10px] font-black tracking-widest uppercase">חופשי</span>
                                  </>
                                )}
                              </div>
                              
                              {/* Pure, Animated Trending Flame */}
                              {circle.is_trending && (
                                <motion.div
                                  animate={{ 
                                    scale: [1, 1.15, 1],
                                    opacity: [0.8, 1, 0.8]
                                  }}
                                  transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                  }}
                                  className="relative z-10 p-1"
                                >
                                  <Flame size={18} className="text-orange-500" fill="currentColor" />
                                </motion.div>
                              )}
                            </div>
                            
                            {/* Title & Stats */}
                            <div className="relative z-10 mt-auto p-4 pt-10 bg-gradient-to-t from-surface via-surface/90 to-transparent">
                              <h3 className="text-white font-black text-[16px] leading-tight drop-shadow-md truncate">
                                {circle.name}
                              </h3>
                              <div className="flex items-center gap-1.5 mt-2">
                                <span className="text-[11px] font-black text-white/80 drop-shadow-md uppercase tracking-wider">{circle.active_now} מחוברים</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recommended Users (Slate navy) */}
              <div className="flex flex-col gap-4 pt-4">
                <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-6">אנשים ששווה להכיר</span>
                {loadingSuggestions ? (
                  <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>
                ) : (
                  <div className="mx-4 bg-surface-card border border-surface-border rounded-[24px] overflow-hidden flex flex-col shadow-sm">
                    {suggestedUsers.map((u, i) => (
                      <div
                        key={u.id}
                        className={`py-4 px-5 flex items-center justify-between cursor-pointer hover:bg-white/5 active:scale-[0.98] transition-all ${i !== suggestedUsers.length -1 ? 'border-b border-surface-border' : ''}`}
                        onClick={() => { triggerFeedback('pop'); navigate(`/profile/${u.id}`); }}
                      >
                        <div className="flex items-center gap-4 text-right">
                          <div className="w-12 h-12 rounded-full border border-surface-border bg-surface overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
                            {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={28} className="text-brand-muted" strokeWidth={1.5} />}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-brand font-black text-[15px] flex items-center gap-1">
                              {u.full_name || 'משתמש'}
                              {u.role_label === 'CORE' && <Crown size={12} className="text-slate-400" />}
                            </span>
                            <span className="text-brand-muted text-[12px] font-medium mt-0.5" dir="ltr">@{u.username || 'user'}</span>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-surface border border-surface-border flex items-center justify-center shadow-inner">
                          <ChevronLeft size={16} className="text-brand-muted" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FadeIn>
  );
};
