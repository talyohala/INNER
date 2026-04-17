import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { FadeIn, Button } from '../components/ui';
import { VaultCard } from '../components/VaultCard';
import { 
  Loader2, MessageSquare, Crown, Send, Lock, UserCircle, Trash2, Edit2, MoreVertical, 
  Paperclip, Share2, Download, Link as LinkIcon, Bookmark, ShieldAlert, Gift, Flame, 
  Eye, ChevronDown, ChevronUp, Reply, X, Diamond, Handshake, Coins, Plus, ChevronRight
} from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { Share } from '@capacitor/share';
import { useAuth } from '../context/AuthContext';

export const CirclePage: React.FC = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { profile: myProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'chat' | 'vaults' | 'members'>('chat');
  const [page, setPage] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const POSTS_PER_PAGE = 20;

  const [loadingMore, setLoadingMore] = useState(false);
  const [vaults, setVaults] = useState<any[]>([]);
  const [loadingVaults, setLoadingVaults] = useState(false);

  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [joining, setJoining] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  
  const [membersList, setMembersList] = useState<any[]>([]);
  const [liveStats, setLiveStats] = useState({ active: 0, typing: 0, giftsSent: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchCircleData();
    const channel = supabase.channel(`circle_${slug}`).on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
      if (page === 0) fetchCircleData();
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [slug]);

  useEffect(() => {
    if (activeTab === 'vaults' && data?.circle?.id) {
      fetchVaults();
    }
  }, [activeTab, data?.circle?.id]);

  const fetchCircleData = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id;
      if (uid) setCurrentUserId(uid);

      let circle: any = null;
      const { data: circleBySlug } = await supabase.from('circles').select('*').eq('slug', slug).maybeSingle();
      circle = circleBySlug;
      if (!circle) {
        const { data: circleById } = await supabase.from('circles').select('*').eq('id', slug).maybeSingle();
        circle = circleById;
      }
      
      if (!circle) throw new Error('מועדון לא נמצא');

      let isMember = false;
      let membership = null;
      if (uid) {
        const { data: memberData } = await supabase.from('circle_members').select('*').eq('circle_id', circle.id).eq('user_id', uid).maybeSingle();
        if (memberData) { isMember = true; membership = memberData; }
      }

      const { data: pData } = await supabase.from('posts')
        .select('*, profiles!user_id(*), seals:post_seals(id, seal_type, user_id), comments(id)')
        .eq('circle_id', circle.id)
        .is('parent_id', null)
        .order('created_at', { ascending: false })
        .limit(POSTS_PER_PAGE);

      let formattedPosts: any[] = [];
      if (pData) {
        formattedPosts = pData.map((p: any) => ({
          ...p,
          seals_count: p.seals?.length || 0,
          comments_count: p.comments?.length || 0,
          has_sealed: !!uid && p.seals?.some((s: any) => s.user_id === uid),
        }));
      }

      fetchMembersList(circle.id);
      
      setLiveStats({
        active: Math.max(1, Math.floor((circle.members_count || 10) * 0.2 + Math.random() * 5)),
        typing: Math.floor(Math.random() * 4),
        giftsSent: Math.floor(Math.random() * 200) * 10
      });

      setPage(0);
      setHasMorePosts(pData?.length === POSTS_PER_PAGE);
      setData({ circle, isMember, membership, posts: formattedPosts });
      
    } catch (err) { 
      toast.error('המועדון לא קיים או שאין לך גישה');
      navigate('/explore'); 
    } finally { 
      setLoading(false); 
    }
  };

  const fetchMembersList = async (circleId: string) => {
    try {
      const { data: membersData } = await supabase.from('circle_members').select('role, profiles(*)').eq('circle_id', circleId);
      if (membersData) setMembersList(membersData.sort((a, b) => (a.role === 'admin' ? -1 : b.role === 'admin' ? 1 : 0)));
    } catch (err) {}
  };

  const fetchVaults = async () => {
    if(!data?.circle?.id) return;
    setLoadingVaults(true);
    try {
      const { data: vaultData, error } = await supabase
        .from('vaults')
        .select('*')
        .eq('circle_id', data.circle.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let unlockedIds: string[] = [];
      if (currentUserId) {
        const { data: unlocks } = await supabase.from('vault_unlocks').select('vault_id').eq('user_id', currentUserId);
        unlockedIds = (unlocks || []).map((u: any) => u.vault_id);
      }

      const enrichedVaults = (vaultData || []).map((v: any) => ({
        ...v,
        is_unlocked: unlockedIds.includes(v.id) || v.creator_id === currentUserId
      }));

      setVaults(enrichedVaults);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingVaults(false);
    }
  };

  const handleJoin = async (tier: 'INNER' | 'CORE') => {
    if (!currentUserId) return toast.error('יש להתחבר תחילה');
    const reqLevel = data.circle.min_level || 1;
    const curLevel = myProfile?.level || 1;
    
    if (curLevel < reqLevel) { 
      triggerFeedback('error'); 
      return toast.error(`הסלקטור חסם אותך. דרושה רמה ${reqLevel}.`); 
    }
    
    setJoining(true); 
    triggerFeedback('pop');
    try {
      if (data.isMember) {
        await apiFetch(`/api/circles/${data.circle.slug}/upgrade`, { method: 'POST', body: JSON.stringify({ tier }) });
        triggerFeedback('success'); 
        toast.success(`שודרגת ל-${tier}! 👑`);
      } else {
        await apiFetch(`/api/circles/${data.circle.slug}/join`, { method: 'POST' });
        triggerFeedback('success'); 
        toast.success('ברוך הבא למועדון! 🎉');
      }
      fetchCircleData();
    } catch (err: any) { 
      toast.error(err?.message || 'שגיאה בהצטרפות/שדרוג. בדוק את יתרת ה-CRD שלך.'); 
    } finally { 
      setJoining(false); 
    }
  };

  const handlePost = async () => {
    if (!newPost.trim() && !selectedFile) return;
    setPosting(true);
    try {
      const postData = {
        circle_id: data.circle.id,
        user_id: currentUserId,
        content: newPost.trim(),
        media_urls: [],
        media_types: [],
        tier_required: 'INNER'
      };

      const { data: insertedPost, error } = await supabase.from('posts').insert(postData).select('*, profiles!user_id(*), seals:post_seals(id, seal_type, user_id), comments(id)').single();
      
      if (error) throw error;
      
      if (insertedPost) {
        const newMsg = { ...insertedPost, seals_count: 0, comments_count: 0, has_sealed: false };
        setData((curr: any) => ({ ...curr, posts: [newMsg, ...curr.posts] }));
      }
      
      setNewPost(''); 
      setSelectedFile(null); 
      triggerFeedback('pop');
    } catch (err: any) { 
      toast.error('שגיאה בשליחת ההודעה'); 
    } finally { 
      setPosting(false); 
    }
  };

  if (loading || !data) {
    return <div className="min-h-[100dvh] bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>;
  }

  const { circle, isMember, membership, posts } = data;
  const isOwner = circle.creator_id === currentUserId || membership?.role === 'admin';
  const joinPrice = Number(circle.join_price || circle.entry_crd_price || circle.price || 0);

  return (
    <FadeIn className="bg-surface h-[100dvh] font-sans flex flex-col relative overflow-hidden" dir="rtl">
      
      {/* HEADER / HERO SECTION */}
      <div className="relative w-full h-[220px] shrink-0 bg-surface flex flex-col justify-end pb-6 border-b border-surface-border">
        {circle.cover_url ? (
          <img src={circle.cover_url} className="absolute inset-0 w-full h-full object-cover opacity-60" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-surface-card to-surface flex items-center justify-center">
            <span className="text-9xl opacity-5 font-black">{circle.name?.charAt(0)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-transparent" />
        
        {/* Back Button */}
        <button onClick={() => navigate(-1)} className="absolute top-[calc(env(safe-area-inset-top)+16px)] right-4 w-10 h-10 bg-black/40 backdrop-blur-md rounded-full border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform z-20 shadow-lg">
          <ChevronRight size={20} />
        </button>

        <div className="relative z-10 px-6 flex flex-col gap-2">
          <span className="text-indigo-400 font-black text-[10px] tracking-widest uppercase flex items-center gap-1.5 drop-shadow-md">
            <Crown size={12} /> טרקלין מועדון
          </span>
          <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-lg">{circle.name}</h1>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl shadow-sm">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_#34d399]" />
              <span className="text-[11px] font-black text-white">{liveStats.active} מחוברים</span>
            </div>
            {isMember && (
              <div className="flex items-center gap-1.5 text-white/70">
                <MessageSquare size={12} />
                <span className="text-[11px] font-bold">{liveStats.typing} מקלידים...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BODY CONTENT */}
      {!isMember ? (
        
        /* 🔒 PAYWALL / GUEST VIEW */
        <div className="flex-1 flex flex-col items-center justify-center p-6 mt-4 z-10 relative">
          <div className="absolute inset-0 bg-accent-primary/5 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="w-24 h-24 rounded-[32px] bg-surface-card border border-surface-border flex items-center justify-center mb-6 shadow-2xl relative z-10">
            <Lock size={36} className="text-indigo-400" />
          </div>
          
          <div className="text-center flex flex-col gap-2 mb-8 relative z-10">
            <h2 className="text-2xl font-black text-brand tracking-wide">מועדון סגור</h2>
            <p className="text-brand-muted text-[14px] leading-relaxed max-w-[260px] mx-auto">
              הצטרף עכשיו כדי לפתוח את הלייב צ'אט, הכספות הסודיות ותוכן החברים.
            </p>
          </div>
          
          <div className="w-full max-w-[300px] flex flex-col gap-3 relative z-10">
            <Button onClick={() => handleJoin('INNER')} disabled={joining} className="w-full h-14 bg-indigo-500 hover:bg-indigo-400 text-white font-black rounded-[24px] uppercase tracking-widest text-[14px] shadow-[0_5px_20px_rgba(99,102,241,0.3)] transition-all active:scale-95 flex items-center justify-center gap-2">
              {joining ? <Loader2 className="animate-spin text-white" /> : (
                <>
                  הצטרפות <div className="w-1 h-1 bg-white/50 rounded-full mx-1" /> {joinPrice > 0 ? `${joinPrice} CRD` : 'חינם'}
                </>
              )}
            </Button>
            {circle.min_level > 1 && (
              <span className="text-center text-brand-muted text-[11px] font-bold">
                דורש מינימום רמה {circle.min_level} כדי להצטרף
              </span>
            )}
          </div>
        </div>

      ) : (

        /* 🔓 MEMBER VIEW */
        <div className="flex flex-col flex-1 overflow-hidden relative">
          
          {/* TABS */}
          <div className="flex justify-between border-b border-surface-border shrink-0 px-6 bg-surface/90 backdrop-blur-md z-20 relative shadow-sm">
            {['chat', 'vaults', 'members'].map((tab) => (
              <button 
                key={tab} 
                onClick={() => { triggerFeedback('pop'); setActiveTab(tab as any); }} 
                className={`py-4 text-[13px] font-black uppercase tracking-widest transition-colors relative ${activeTab === tab ? 'text-indigo-400' : 'text-brand-muted hover:text-brand'}`}
              >
                {tab === 'chat' ? 'לייב צ׳אט' : tab === 'vaults' ? 'כספות' : 'חברים'}
                {activeTab === tab && <motion.div layoutId="circleTab" className="absolute bottom-0 left-0 right-0 h-[3px] bg-indigo-400 rounded-t-full shadow-[0_0_10px_rgba(129,140,248,0.5)]" />}
              </button>
            ))}
          </div>

          {/* TAB CONTENT: CHAT */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden bg-surface relative">
              <div className="flex-1 p-4 flex flex-col-reverse gap-6 overflow-y-auto pb-[180px] scrollbar-hide">
                {posts?.map((post: any) => {
                  const isMine = post.user_id === currentUserId;
                  return (
                    <div key={post.id} className={`flex flex-col gap-1 w-full ${isMine ? 'items-end' : 'items-start'}`}>
                      <div className={`flex gap-3 w-full ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                        
                        {!isMine && (
                          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-surface-border bg-surface-card flex items-center justify-center shadow-sm cursor-pointer" onClick={() => navigate(`/profile/${post.user_id}`)}>
                            {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={24} className="text-brand-muted" />}
                          </div>
                        )}
                        
                        <div className="flex flex-col gap-1 max-w-[80%]">
                          {!isMine && (
                            <span className="text-[11px] font-black text-brand-muted px-1 flex items-center gap-1">
                              {post.profiles?.full_name || 'אנונימי'} 
                              {post.profiles?.role_label === 'CORE' && <Crown size={10} className="text-indigo-400" />}
                            </span>
                          )}
                          
                          <div className={`p-4 text-[14px] leading-relaxed shadow-sm font-medium ${
                            isMine 
                              ? 'bg-indigo-500 text-white rounded-[24px] rounded-br-sm' 
                              : 'bg-surface-card border border-surface-border text-brand rounded-[24px] rounded-tl-sm'
                          }`}>
                            {post.content}
                          </div>
                          
                          <span className={`text-[9px] text-brand-muted font-bold px-2 mt-0.5 ${isMine ? 'text-left' : 'text-right'}`}>
                            {new Date(post.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {posts?.length === 0 && (
                  <div className="text-center py-20 opacity-50 flex flex-col items-center gap-3">
                    <MessageSquare size={40} className="text-brand-muted" strokeWidth={1} />
                    <span className="text-brand-muted font-black text-[13px] tracking-widest uppercase">אין הודעות עדיין.<br/>תהיה הראשון לכתוב!</span>
                  </div>
                )}
              </div>

              {/* Chat Input Floating */}
              <div className="absolute bottom-[90px] left-0 right-0 px-4 z-40">
                <div className="w-full bg-surface-card/90 backdrop-blur-2xl border border-surface-border rounded-[28px] flex items-center px-2 py-1.5 shadow-2xl">
                  <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 shrink-0 rounded-full text-brand-muted hover:text-brand flex items-center justify-center transition-colors">
                    <Paperclip size={20} />
                  </button>
                  <input 
                    type="text" 
                    value={newPost} 
                    onChange={(e) => setNewPost(e.target.value)} 
                    placeholder="הקלד הודעה..." 
                    className="flex-1 bg-transparent border-none outline-none text-brand font-medium px-2 text-[15px] placeholder:text-brand-muted/50" 
                    onKeyDown={(e) => e.key === 'Enter' && handlePost()}
                  />
                  <button 
                    onClick={() => handlePost()} 
                    disabled={posting || !newPost.trim()}
                    className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-all active:scale-95 ${newPost.trim() ? 'bg-indigo-500 text-white shadow-md' : 'bg-surface-border text-brand-muted'}`}
                  >
                    {posting ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={16} className="rtl:-scale-x-100 -ml-0.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: VAULTS */}
          {activeTab === 'vaults' && (
            <div className="flex-1 p-4 flex flex-col gap-6 bg-surface overflow-y-auto pb-[120px] relative">
              {loadingVaults ? (
                <Loader2 className="animate-spin text-indigo-400 mx-auto my-20" />
              ) : vaults.length === 0 ? (
                <div className="text-center py-20 opacity-50 flex flex-col items-center gap-3">
                  <Lock size={48} className="text-brand-muted" strokeWidth={1} />
                  <span className="text-brand-muted font-black text-[13px] tracking-widest uppercase">אין כספות זמינות כרגע</span>
                </div>
              ) : (
                vaults.map(vault => <VaultCard key={vault.id} vault={vault} onUnlockSuccess={fetchVaults} />)
              )}

              {/* FAB: CREATE VAULT (Admin Only) */}
              {isOwner && (
                <button
                  onClick={() => navigate(`/circle/${slug}/vaults/create`)}
                  className="fixed bottom-[110px] left-6 w-14 h-14 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(99,102,241,0.4)] active:scale-90 transition-transform z-50"
                >
                  <Plus size={28} />
                </button>
              )}
            </div>
          )}

          {/* TAB CONTENT: MEMBERS */}
          {activeTab === 'members' && (
            <div className="flex-1 p-4 flex flex-col gap-3 bg-surface overflow-y-auto pb-[120px]">
              <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-2 mb-2">חברי המועדון ({membersList.length})</span>
              <div className="flex flex-col gap-2">
                {membersList.map((m) => (
                  <div key={m.profiles?.id} onClick={() => navigate(`/profile/${m.profiles?.id}`)} className="flex items-center justify-between bg-surface-card p-4 rounded-[24px] border border-surface-border shadow-sm cursor-pointer active:scale-[0.98] transition-transform">
                    <div className="flex items-center gap-4 text-right">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-surface flex items-center justify-center border border-surface-border shadow-inner">
                        {m.profiles?.avatar_url ? <img src={m.profiles?.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={24} className="text-brand-muted" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-brand font-black text-[15px] flex items-center gap-1.5">
                          {m.profiles?.full_name || 'אנונימי'}
                          {m.role === 'admin' && <ShieldAlert size={12} className="text-indigo-400" />}
                        </span>
                        <span className="text-brand-muted text-[11px] mt-0.5" dir="ltr">@{m.profiles?.username}</span>
                      </div>
                    </div>
                    {m.role === 'admin' && (
                      <span className="bg-indigo-400/10 text-indigo-400 px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase border border-indigo-400/20">מנהל</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </FadeIn>
  );
};
