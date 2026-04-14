import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion'; 
import { Search, ChevronLeft, Loader2, UserCircle, X, Lock, Unlock, Gift, TrendingUp, Timer } from 'lucide-react';
import { apiFetch } from '../lib/api';                   
import { supabase } from '../lib/supabase';
import { FadeIn } from '../components/ui';               
import { triggerFeedback } from '../lib/sound';
import { useAuth } from '../context/AuthContext';

// עץ הקטגוריות החדש - מחובר לדאטה-בייס, בלי אייקונים נלווים
const CATEGORY_TREE = [
  { id: 'all', name: 'הכל' },
  { id: 'venture_capital', name: 'הון סיכון', sub: ['Crypto', 'Real Estate', 'Startups'] },
  { id: 'lifestyle', name: 'לייף סטייל', sub: ['Nightlife', 'Fashion', 'Travel'] },
  { id: 'tech_alpha', name: 'טק', sub: ['AI & Data', 'Dev', 'Cyber'] },
  { id: 'creators', name: 'יוצרים', sub: ['Media', 'Podcasts', 'Art'] },
  { id: 'sanctum', name: 'The Sanctum', sub: ['Elite Only'] }
];

export const ExplorePage: React.FC = () => {               
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [search, setSearch] = useState('');                
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeSub, setActiveSub] = useState('');
  
  const [circles, setCircles] = useState<any[]>([]);       
  const [usersListData, setUsersListData] = useState<any[]>([]);                                                    
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);                                                                                                           
  const [recentSearches, setRecentSearches] = useState<string[]>(
    JSON.parse(localStorage.getItem('inner_recent_searches') || '[]')
  );
  
  const [loadingCircles, setLoadingCircles] = useState(true);                                                       
  const [loadingUsers, setLoadingUsers] = useState(false);                                                          
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

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

  useEffect(() => {                                          
    const fetchCircles = async () => {                         
      try {                                                      
        setLoadingCircles(true);
        let query = supabase.from('circles').select('*').order('created_at', { ascending: false });
        
        if (activeCategory !== 'all') {
          query = query.eq('category', activeCategory);
        }
        if (activeSub) {
          query = query.eq('sub_category', activeSub);
        }

        const { data, error } = await query;                                                              
        if (error) throw error;
        
        const formatted = (Array.isArray(data) ? data : []).map((c: any) => ({                                              
          ...c,                                                    
          active_now: Math.max(1, Math.ceil((c.members_count || 5) * 0.2 + Math.random() * 4)),                             
          is_trending: Math.random() > 0.5 // סימולציה של טרנד חם                                                         
        }));                                                                                                              
        setCircles(formatted);                                 
      } catch {                                                
      } finally {                                                
        setLoadingCircles(false);                              
      }                                                      
    };                                                       
    fetchCircles();                                        
  }, [activeCategory, activeSub]);

  useEffect(() => {                                          
    const fetchSuggested = async () => {                       
      try {                                                      
        const { data, error } = await supabase                     
          .from('profiles')                                        
          .select('id, full_name, username, avatar_url, bio, role_label')                                                   
          .limit(5);                                             
        if (!error && data) setSuggestedUsers(data);           
      } catch (err) {                                          
      } finally {                                                
        setLoadingSuggestions(false);                          
      }                                                      
    };                                                       
    fetchSuggested();                                      
  }, []);

  useEffect(() => {                                          
    const fetchUsers = async () => {                           
      if (!search.trim()) {                                      
        setUsersListData([]);                                    
        return;                                                
      }                                                        
      setLoadingUsers(true);                                   
      try {                                                      
        const query = supabase                                     
          .from('profiles')                                        
          .select('id, full_name, username, avatar_url, bio')                                                               
          .or(`full_name.ilike.%${search}%,username.ilike.%${search}%`)                                                     
          .limit(15);                                    
        const { data, error } = await query;                     
        if (data) setUsersListData(data);                      
      } catch (err) {                                          
      } finally {                                                
        setLoadingUsers(false);                                
      }                                                      
    };                                                       
    const timeoutId = setTimeout(fetchUsers, 300);           
    return () => clearTimeout(timeoutId);                  
  }, [search]);

  // סינון מקומי לפי חיפוש טקסט
  const filteredCircles = circles.filter((c) => {            
    const searchLower = search.trim().toLowerCase();
    const nameMatch = c.name?.toLowerCase().includes(searchLower);                                                    
    const descMatch = c.description?.toLowerCase().includes(searchLower);                                             
    return searchLower === '' || nameMatch || descMatch;
  });

  const currentCatObj = CATEGORY_TREE.find(c => c.id === activeCategory);

  return (                                                   
    <FadeIn className="pt-[calc(env(safe-area-inset-top)+12px)] pb-32 bg-surface min-h-screen font-sans flex flex-col overflow-x-hidden" dir="rtl">                                                                                       
      
      {/* Header & Sticky Search Bar */}                       
      <div className="relative z-20 px-4 sticky top-0 bg-surface/90 backdrop-blur-2xl py-3 shadow-sm border-b border-surface-border">                                              
        <div className="relative">                                 
          <input                                                     
            type="text"                                              
            value={search}
            onChange={(e) => setSearch(e.target.value)}              
            placeholder="חפש מועדונים, יוצרים ודרופים..."            
            className="w-full bg-surface-card border border-surface-border rounded-full h-[52px] pr-12 pl-12 text-brand text-[15px] font-bold placeholder:text-brand-muted/50 outline-none transition-all focus:border-accent-primary/50 shadow-inner"                                                 
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
          
          {/* STATE 1: SEARCH ACTIVE */}                           
          {search.trim() ? (                                         
            <motion.div key="search-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">                                                                                             
              
              {/* Circle Results */}                                   
              {filteredCircles.length > 0 && (                           
                <div className="flex flex-col gap-2">                      
                  <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-6">מועדונים</span>                                                                   
                  <div className="mx-4 bg-surface-card border border-surface-border rounded-[28px] overflow-hidden flex flex-col shadow-sm">                                                   
                    {filteredCircles.map((circle, idx) => (                                                                             
                      <div                                                       
                        key={circle.id}                                          
                        onClick={() => { saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/circle/${circle.slug || circle.id}`); }}                                                           
                        className={`py-4 px-5 flex items-center justify-between cursor-pointer hover:bg-white/5 active:scale-[0.98] transition-all ${idx !== filteredCircles.length - 1 ? 'border-b border-surface-border' : ''}`}                        
                      >                                                          
                        <div className="flex items-center gap-4 text-right">                                                                
                          <div className="relative">                                 
                            {circle.cover_url ? (                                      
                              <img src={circle.cover_url} className="w-14 h-14 rounded-[18px] object-cover border border-surface-border shadow-sm" />
                            ) : (                                                      
                              <div className="w-14 h-14 rounded-[18px] bg-surface border border-surface-border flex items-center justify-center text-brand-muted font-black text-xl shadow-inner">                                                                  
                                {circle.name?.charAt(0)}                               
                              </div>                                                 
                            )}                                                       
                            {circle.is_private && (                                    
                              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-surface-card border border-surface-border rounded-full flex items-center justify-center shadow-md">                                                                            
                                <Lock size={10} className="text-accent-primary" />                                                              
                              </div>                                                 
                            )}                                                     
                          </div>                                                   
                          <div className="flex flex-col">                            
                            <span className="text-brand font-black text-[16px]">{circle.name}</span>                                          
                            <span className="text-brand-muted text-[12px] font-medium mt-0.5 flex items-center gap-1.5">                                                                                 
                              {circle.members_count || 0} חברים                                                                                 
                              {circle.join_price > 0 && <span className="text-accent-primary/70 font-black text-[10px] tracking-wider uppercase">• {circle.join_price} CRD</span>}                                                                              
                            </span>                                                
                          </div>                                                 
                        </div>                                                   
                        <ChevronLeft size={20} className="text-brand-muted" />                                                          
                      </div>                                                 
                    ))}                                                    
                  </div>                                                 
                </div>                                                 
              )}                                                                                                                
              
              {/* User Results */}                                     
              {loadingUsers ? (                                          
                <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-accent-primary" /></div>                                                                
              ) : usersListData.length > 0 && (                          
                <div className="flex flex-col gap-2">                      
                  <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-6">משתמשים</span>                                                                    
                  <div className="mx-4 bg-surface-card border border-surface-border rounded-[28px] overflow-hidden flex flex-col shadow-sm">                                                   
                    {usersListData.map((u, idx) => (
                      <div                                                       
                        key={u.id}                                               
                        onClick={() => { saveRecentSearch(search.trim()); triggerFeedback('pop'); navigate(`/profile/${u.id}`); }}                                                                 
                        className={`py-4 px-5 flex items-center justify-between cursor-pointer hover:bg-white/5 active:scale-[0.98] transition-all ${idx !== usersListData.length - 1 ? 'border-b border-surface-border' : ''}`}                          
                      >                                                          
                        <div className="flex items-center gap-4 text-right">                                                                
                          <div className="w-12 h-12 rounded-full border border-surface-border bg-surface overflow-hidden shrink-0 flex items-center justify-center shadow-sm">                                                                                  
                            {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={28} className="text-brand-muted" strokeWidth={1.5} />}                                                                      
                          </div>                                                   
                          <div className="flex flex-col">                            
                            <span className="text-brand font-black text-[15px]">{u.full_name || 'משתמש'}</span>
                            <span className="text-brand-muted text-[12px] font-medium mt-0.5" dir="ltr">@{u.username || 'user'}</span>                                                               
                          </div>                                                 
                        </div>                                                   
                        <ChevronLeft size={20} className="text-brand-muted" />                                                          
                      </div>                                                 
                    ))}                                                    
                  </div>                                                 
                </div>                                                 
              )}                                         
              
              {/* No Results */}                                       
              {filteredCircles.length === 0 && usersListData.length === 0 && !loadingUsers && (                                   
                <div className="text-center py-20 flex flex-col items-center gap-4 opacity-50">
                  <Search size={40} className="text-brand-muted" strokeWidth={1} />                                                 
                  <span className="text-brand-muted font-black text-[12px] tracking-widest uppercase">אין תוצאות לחיפוש הזה</span>                                                         
                </div>                                                 
              )}                                                     
            </motion.div>                                          
          ) : (                                                                                                               
            
            /* STATE 2: EXPLORE HOME */                      
            <motion.div key="explore-home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-8 pb-10">                                                                                         
              
              {/* Sponsor Drop */}                  
              <div className="mx-4 relative overflow-hidden rounded-[28px] cursor-pointer group active:scale-[0.98] transition-transform shadow-[0_10px_40px_rgba(0,0,0,0.2)]">                                                                     
                <div className="absolute inset-0 bg-gradient-to-r from-accent-primary/40 via-purple-500/20 to-accent-primary/40 animate-pulse opacity-50" />                               
                <div className="absolute inset-0 bg-surface-card/80 backdrop-blur-xl border border-surface-border rounded-[28px]" />                                                       
                <div className="relative p-6 flex items-center justify-between z-10">                                               
                  <div className="flex flex-col gap-1.5">                    
                    <span className="text-accent-primary text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5">                                                            
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
              
              {/* Recent Searches */}                                  
              {recentSearches.length > 0 && (                            
                <div className="flex flex-col px-4 gap-3">                                                                          
                  <div className="flex items-center justify-between px-1">                                                            
                    <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest">חיפושים אחרונים</span>                                                                 
                    <button onClick={() => { triggerFeedback('pop'); setRecentSearches([]); localStorage.removeItem('inner_recent_searches'); }} className="text-accent-primary text-[11px] font-black uppercase tracking-widest">נקה</button>                                                                 
                  </div>                                                   
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">                                                    
                    {recentSearches.map((term, i) => (                         
                      <div key={i} onClick={() => { triggerFeedback('pop'); setSearch(term); }} className="flex items-center gap-2 bg-surface-card border border-surface-border rounded-full px-4 py-2 cursor-pointer active:scale-95 transition-transform shadow-sm whitespace-nowrap">                             
                        <Search size={12} className="text-brand-muted" />
                        <span className="text-brand font-bold text-[13px]">{term}</span>                                                
                        <button onClick={(e) => removeRecentSearch(term, e)} className="p-0.5 ml-1 text-brand-muted hover:text-brand transition-colors"><X size={12} /></button>
                      </div>                                                 
                    ))}                                                    
                  </div>                                                 
                </div>                                                 
              )}                                                                                                                
              
              {/* CATEGORIES (Vibes) - Dynamic from DB tree, No Icons */}                               
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-hide px-4">                                
                  {CATEGORY_TREE.map((cat) => (                                     
                    <button                                                    
                      key={cat.id}                                               
                      onClick={() => { triggerFeedback('pop'); setActiveCategory(cat.id); setActiveSub(''); }}                                                  
                      className={`text-[13px] font-black tracking-wide whitespace-nowrap transition-all px-5 py-2.5 rounded-full border shadow-sm ${
                        activeCategory === cat.id 
                          ? 'bg-accent-primary/10 border-accent-primary/40 text-accent-primary' 
                          : 'bg-surface-card border-surface-border text-brand-muted hover:text-brand'
                      }`}                                              
                    >                                                          
                      {cat.name}                                                 
                    </button>                                              
                  ))}                                                    
                </div>

                {/* Sub-categories */}
                <AnimatePresence mode="wait">
                  {currentCatObj && currentCatObj.sub && currentCatObj.sub.length > 0 && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="flex overflow-x-auto scrollbar-hide gap-2 px-4 mt-1"
                    >
                      {currentCatObj.sub.map((subName) => (
                        <button
                          key={subName}
                          onClick={() => { triggerFeedback('pop'); setActiveSub(activeSub === subName ? '' : subName); }}
                          className={`shrink-0 h-8 px-4 rounded-full font-bold text-[11px] transition-all border ${
                            activeSub === subName 
                              ? 'bg-white/10 border-white/20 text-white' 
                              : 'bg-transparent border-surface-border text-brand-muted hover:bg-white/5'
                          }`}
                          dir="ltr"
                        >
                          {subName}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>                                                                                                            
              
              {/* Popular Circles Grid */}                             
              <div className="flex flex-col gap-4">                      
                <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-6 flex items-center gap-1.5">                                                          
                  טרקלינים חמים <TrendingUp size={14} className="text-accent-primary/80" />                                       
                </span>                                                                                                           
                
                {loadingCircles ? (                                        
                  <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-accent-primary" /></div>                                                                
                ) : filteredCircles.length === 0 ? (                       
                  <div className="text-center py-10 opacity-50"><span className="text-brand-muted font-black text-[12px] uppercase tracking-widest">אין מועדונים פעילים כרגע בקטגוריה זו</span></div>                                                           
                ) : (                                                      
                  <div className="grid grid-cols-2 gap-3 px-4">                                                                       
                    {filteredCircles.map((circle, idx) => {
                      const reqLevel = circle.min_level || 1;
                      const isLocked = myLevel < reqLevel;

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
                          <div className="h-[220px] rounded-[28px] bg-surface-card border border-surface-border shadow-md flex flex-col relative overflow-hidden group">
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
                            
                            {/* VIP Price Tag / Timer Badge / Lock */}                                                                               
                            <div className="relative z-10 p-3 flex justify-between items-start">                                                
                              <div className="bg-black/50 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5 shadow-sm">                                           
                                {isLocked ? (
                                  <>
                                    <Lock size={10} className="text-rose-500" />
                                    <span className="text-white text-[10px] font-black tracking-widest">רמה {reqLevel}</span>
                                  </>
                                ) : circle.is_private ? (                                     
                                  <>                                                         
                                    <Lock size={10} className="text-accent-primary" />                                                                
                                    <span className="text-white text-[10px] font-black tracking-widest">{circle.join_price || 0} CRD</span>                                                                  
                                  </>                                                    
                                ) : (                                                      
                                  <>
                                    <Unlock size={10} className="text-green-400" />                                                                   
                                    <span className="text-white text-[10px] font-black tracking-widest uppercase">חופשי</span>                                                                               
                                  </>                                                    
                                )}                                                     
                              </div>                                                                                                            
                              
                              {/* Trending Badge */}                                
                              {circle.is_trending && (                                   
                                <div className="bg-red-500/20 backdrop-blur-md px-2 py-1 rounded-xl border border-red-500/30 flex items-center gap-1">                                                       
                                  <Timer size={10} className="text-red-400" />                                                                      
                                  <span className="text-red-400 text-[9px] font-black uppercase tracking-widest">HOT</span>                                                                                
                                </div>                                                 
                              )}                                                     
                            </div>                                                                                                            
                            
                            {/* Title & Stats */}
                            <div className="relative z-10 mt-auto p-4 pt-10 bg-gradient-to-t from-surface via-surface/90 to-transparent">                                                                
                              <h3 className="text-white font-black text-[16px] leading-tight drop-shadow-md truncate">                                                                                     
                                {circle.name}                                          
                              </h3>                                                                                                             
                              <div className="flex items-center gap-1.5 mt-2">                                                                    
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]" />                                                                          
                                <span className="text-[11px] font-black text-white/80 drop-shadow-md uppercase tracking-wider">{circle.active_now} אונליין</span>                                        
                              </div>                                                 
                            </div>                                                 
                          </div>                                                 
                        </motion.div>                                          
                      );
                    })}                                                    
                  </div>                                                 
                )}                                                     
              </div>                                     
              
              {/* Recommended Users */}                         
              <div className="flex flex-col gap-4 pt-4">                 
                <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-6">אנשים ששווה להכיר</span>                                                          
                {loadingSuggestions ? (
                  <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-accent-primary" /></div>                                                                
                ) : (                                                      
                  <div className="mx-4 bg-surface-card border border-surface-border rounded-[28px] overflow-hidden flex flex-col shadow-sm">                                                   
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
                            <span className="text-brand font-black text-[15px]">{u.full_name || 'משתמש'}</span>                               
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
