import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { FadeIn, Button } from '../components/ui';
import { VaultCard } from '../components/VaultCard';
import {
  Loader2, MessageSquare, Lock, ShieldAlert, Flame, Diamond, Handshake,
  Plus, Send, X, Coins, Image as ImageIcon, Users, Archive, Sparkles, Trophy,
  Pin, Calendar, BarChart3, Target, Crown, ChevronLeft, ChevronDown, Gift, Eye, Radio, BadgeCheck, Medal, Activity, Paperclip
} from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const SEAL_TYPES = [
  { id: 'fire', icon: <Flame size={14} />, label: 'אש', color: 'text-orange-500 bg-orange-500/10 border-orange-500/20', xp: 15 },
  { id: 'diamond', icon: <Diamond size={14} />, label: 'יהלום', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', xp: 50 },
  { id: 'alliance', icon: <Handshake size={14} />, label: 'ברית', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', xp: 100 }
];

type OverviewPayload = {
  pins?: any[]; stories?: any[]; drop?: any | null; events?: any[];
  activity?: any[]; leaderboard?: any[]; my_stats?: any | null; tasks?: any[]; trust_rules?: any | null;
};

const formatRelative = (dateStr?: string | null) => {
  if (!dateStr) return '';
  const diff = Math.max(1, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
  if (diff < 60) return 'הרגע';
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דק׳`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} ש׳`;
  return `לפני ${Math.floor(diff / 86400)} ימים`;
};

const getLevelName = (level: number) => {
  if (level >= 15) return 'אגדה';
  if (level >= 10) return 'ליבה';
  if (level >= 6) return 'מקורב';
  if (level >= 3) return 'פעיל';
  return 'מצטרף חדש';
};

const getActivityLabel = (type: string, payload: any) => {
  switch (type) {
    case 'new_post': return 'פרסם הודעה';
    case 'xp_gain': return `צבר ${payload?.amount || 0} XP`;
    case 'task_completed': return `השלים משימה: ${payload?.title || 'משימה'}`;
    case 'drop_contribution': return `תרם ${payload?.amount || 0} CRD לדרופ`;
    case 'new_story': return 'העלה רגע';
    case 'join_circle': return 'הצטרף למועדון';
    default: return 'ביצע פעילות';
  }
};

export const CirclePage: React.FC = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { profile: myProfile } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const storyInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const [data, setData] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem(`inner_circle_${slug}_cache`) || 'null'); } catch { return null; }
  });

  const [loading, setLoading] = useState(!data);
  const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'vaults' | 'members'>('overview');

  const [vaults, setVaults] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(`inner_vaults_${slug}_cache`) || '[]'); } catch { return []; }
  });
  const [loadingVaults, setLoadingVaults] = useState(vaults.length === 0);

  const [membersList, setMembersList] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(`inner_members_${slug}_cache`) || '[]'); } catch { return []; }
  });

  const [overview, setOverview] = useState<OverviewPayload>({
    pins: [], stories: [], drop: null, events: [], activity: [], leaderboard: [], my_stats: null, tasks: [], trust_rules: null
  });

  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [onlineCount, setOnlineCount] = useState(1);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [composerExpanded, setComposerExpanded] = useState(false);

  const [uploadingStory, setUploadingStory] = useState(false);
  const [joining, setJoining] = useState(false);
  const [contributingDrop, setContributingDrop] = useState(false);
  const [dropAmount, setDropAmount] = useState<number | ''>(50);

  const [sealSelectorPost, setSealSelectorPost] = useState<any | null>(null);

  const sortedPosts = useMemo(() => {
    return [...(data?.posts || [])].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [data?.posts]);

  useEffect(() => {
    let ch: any;
    const initCircle = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id || `guest_${Date.now()}`;
      setCurrentUserId(uid);

      await fetchCircleData(uid);
      await fetchOverview(uid);

      ch = supabase.channel(`circle_${slug}`, { config: { presence: { key: uid } } });
      channelRef.current = ch;

      ch.on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState();
        let count = 0;
        const typing = new Set<string>();
        for (const id in state) {
          count += state[id].length;
          for (const presence of state[id] as any[]) {
            if (presence.isTyping && id !== uid) typing.add(id);
          }
        }
        setOnlineCount(Math.max(1, count));
        setTypingUsers(typing);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, async () => { await fetchCircleData(uid, true); await fetchOverview(uid, true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'circle_activity' }, async () => { await fetchOverview(uid, true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'circle_drops' }, async () => { await fetchOverview(uid, true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'circle_stories' }, async () => { await fetchOverview(uid, true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_seals' }, async () => { await fetchCircleData(uid, true); })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') await ch.track({ isTyping: false });
      });
    };

    initCircle();
    return () => { if (ch) supabase.removeChannel(ch); };
  }, [slug]);

  useEffect(() => {
    if (activeTab === 'vaults' && data?.circle?.id) fetchVaults();
  }, [activeTab, data?.circle?.id]);

  useEffect(() => {
    if (activeTab !== 'chat') return;
    if (!messagesRef.current) return;
    requestAnimationFrame(() => { if (messagesRef.current) messagesRef.current.scrollTop = 0; });
  }, [activeTab, data?.posts?.length]);

  const fetchCircleData = async (uid: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
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
      if (uid && !uid.startsWith('guest_')) {
        const { data: memberData } = await supabase.from('circle_members').select('*').eq('circle_id', circle.id).eq('user_id', uid).maybeSingle();
        if (memberData) { isMember = true; membership = memberData; }
      }

      const { data: posts } = await supabase.from('posts').select('*, profiles!user_id(*), post_seals(*)').eq('circle_id', circle.id).order('created_at', { ascending: false }).limit(60);

      const nextData = { circle, isMember, membership, posts: posts || [] };
      setData(nextData);
      localStorage.setItem(`inner_circle_${slug}_cache`, JSON.stringify(nextData));
      fetchMembersList(circle.id);
    } catch {
      navigate('/');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchMembersList = async (circleId: string) => {
    try {
      const { data: membersData } = await supabase.from('circle_members').select('role, created_at, tier, profiles(*)').eq('circle_id', circleId);
      if (membersData) {
        const sorted = membersData.sort((a, b) => a.role === 'admin' ? -1 : b.role === 'admin' ? 1 : 0);
        setMembersList(sorted);
        localStorage.setItem(`inner_members_${slug}_cache`, JSON.stringify(sorted));
      }
    } catch {}
  };

  const fetchOverview = async (uid: string, silent = false) => {
    try {
      let circleId = data?.circle?.id;
      if (!circleId) return;

      const { data: overviewData, error } = await supabase.rpc('get_circle_overview', { p_circle_id: circleId, p_user_id: uid && !uid.startsWith('guest_') ? uid : null });

      if (!error && overviewData) {
        setOverview({
          pins: overviewData.pins || [], stories: overviewData.stories || [], drop: overviewData.drop || null,
          events: overviewData.events || [], activity: overviewData.activity || [], leaderboard: overviewData.leaderboard || [],
          my_stats: overviewData.my_stats || null, tasks: overviewData.tasks || [], trust_rules: overviewData.trust_rules || null
        });
        if (!silent) localStorage.setItem(`inner_overview_${slug}_cache`, JSON.stringify(overviewData || {}));
      }
    } catch {}
  };

  const fetchVaults = async () => {
    if (!data?.circle?.id) return;
    try {
      const { data: vaultData } = await supabase.from('vaults').select('*').eq('circle_id', data.circle.id).eq('is_active', true).order('created_at', { ascending: false });
      let unlockedIds: string[] = [];
      if (currentUserId && !currentUserId.startsWith('guest_')) {
        const { data: unlocks } = await supabase.from('vault_unlocks').select('vault_id').eq('user_id', currentUserId);
        unlockedIds = (unlocks || []).map((u: any) => u.vault_id);
      }
      const enrichedVaults = (vaultData || []).map((v: any) => ({ ...v, is_unlocked: unlockedIds.includes(v.id) || v.creator_id === currentUserId }));
      setVaults(enrichedVaults);
      localStorage.setItem(`inner_vaults_${slug}_cache`, JSON.stringify(enrichedVaults));
    } catch {} finally { setLoadingVaults(false); }
  };

  const handleJoin = async (tier: 'INNER' | 'CORE') => {
    if (!currentUserId || currentUserId.startsWith('guest_')) return toast.error('יש להתחבר תחילה');
    setJoining(true); triggerFeedback('pop');
    try {
      if (data.isMember) {
        await apiFetch(`/api/circles/${data.circle.slug}/upgrade`, { method: 'POST', body: JSON.stringify({ tier }) });
        triggerFeedback('success'); toast.success(`שודרגת ל-${tier}! 👑`);
      } else {
        await apiFetch(`/api/circles/${data.circle.slug}/join`, { method: 'POST' });
        triggerFeedback('success'); toast.success('ברוך הבא למועדון! 🎉');
        try { await supabase.from('circle_activity').insert({ circle_id: data.circle.id, actor_user_id: currentUserId, activity_type: 'join_circle', payload: { tier } }); } catch {}
      }
      await supabase.rpc('ensure_circle_user_stats', { p_circle_id: data.circle.id, p_user_id: currentUserId });
      await fetchCircleData(currentUserId);
      await fetchOverview(currentUserId);
    } catch (err: any) {
      toast.error(err?.message || 'שגיאה בהצטרפות');
    } finally {
      setJoining(false);
    }
  };

  const handleStoryChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return toast.error('העלה תמונה או וידאו בלבד');
    setUploadingStory(true); triggerFeedback('pop');
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const fileName = `circle_story_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${safeName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from('feed_images').upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('feed_images').getPublicUrl(uploadData.path);
      const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 24);
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

      await supabase.from('circle_stories').insert({ circle_id: data.circle.id, user_id: currentUserId, media_url: publicUrl, media_type: mediaType, expires_at: expiresAt.toISOString() });
      await supabase.from('circle_activity').insert({ circle_id: data.circle.id, actor_user_id: currentUserId, activity_type: 'new_story', payload: { media_type: mediaType } });
      await supabase.rpc('add_circle_xp', { p_circle_id: data.circle.id, p_user_id: currentUserId, p_amount: 20, p_reason: 'story_upload' });

      await fetchOverview(currentUserId);
      triggerFeedback('success'); toast.success('הרגע עלה בהצלחה');
    } catch { toast.error('שגיאה בהעלאת רגע'); } finally { setUploadingStory(false); if (storyInputRef.current) storyInputRef.current.value = ''; }
  };

  const handlePost = async () => {
    if (!newPost.trim() && !selectedFile) return;
    if (!data?.circle?.id || !currentUserId || currentUserId.startsWith('guest_')) return toast.error('יש להתחבר תחילה');

    setPosting(true); triggerFeedback('pop');

    try {
      let media_url: string | null = null;
      let media_type = 'text';

      if (selectedFile) {
        const safeName = selectedFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const fileName = `circle_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${safeName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('feed_images').upload(fileName, selectedFile, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('feed_images').getPublicUrl(uploadData.path);
        media_url = publicUrl;
        media_type = selectedFile.type.startsWith('video/') ? 'video' : 'image';
      }

      const { data: insertedPost, error } = await supabase.from('posts').insert({
        circle_id: data.circle.id, user_id: currentUserId, content: newPost.trim(), media_url, media_type, is_reveal_drop: false, reveal_status: 'revealed', required_crd: 0
      }).select('*, profiles!user_id(*)').single();

      if (error) throw error;
      if (insertedPost) setData((curr: any) => ({ ...curr, posts: [insertedPost, ...(curr.posts || [])] }));

      const xpAmount = selectedFile ? 20 : 8;
      await supabase.rpc('add_circle_xp', { p_circle_id: data.circle.id, p_user_id: currentUserId, p_amount: xpAmount, p_reason: selectedFile ? 'media_post' : 'text_post' });
      await supabase.from('circle_activity').insert({ circle_id: data.circle.id, actor_user_id: currentUserId, activity_type: 'new_post', payload: { has_media: !!selectedFile, media_type: selectedFile ? media_type : null } });
      await supabase.from('circle_user_stats').update({ last_active_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('circle_id', data.circle.id).eq('user_id', currentUserId);

      setNewPost(''); setSelectedFile(null); setComposerExpanded(false);
      if (channelRef.current) channelRef.current.track({ isTyping: false });
      await fetchOverview(currentUserId, true);
      triggerFeedback('success');
    } catch (err: any) {
      toast.error(err?.message || 'שגיאה בשליחת ההודעה');
    } finally {
      setPosting(false);
    }
  };

  const handleSeal = async (postId: string, sealType: string) => {
    triggerFeedback('pop'); setSealSelectorPost(null);
    try {
      const { error } = await supabase.from('post_seals').insert({ post_id: postId, user_id: currentUserId, seal_type: sealType });
      if (error) {
        if (error.code === '23505') toast.error('כבר נתת חותם מסוג זה'); else throw error;
      } else {
        const xpAmount = SEAL_TYPES.find(s => s.id === sealType)?.xp || 10;
        await supabase.rpc('add_circle_xp', { p_circle_id: data.circle.id, p_user_id: currentUserId, p_amount: xpAmount, p_reason: 'gave_seal' });
        await fetchCircleData(currentUserId, true);
        triggerFeedback('success');
      }
    } catch { toast.error('שגיאה בהענקת חותם'); }
  };

  const handleContributeToDrop = async () => {
    if (!overview?.drop?.id || !dropAmount || Number(dropAmount) <= 0 || !currentUserId || currentUserId.startsWith('guest_')) return;
    setContributingDrop(true); triggerFeedback('pop');
    try {
      const { error } = await supabase.rpc('circle_contribute_to_drop', { p_drop_id: overview.drop.id, p_user_id: currentUserId, p_amount: Number(dropAmount) });
      if (error) throw error;
      await fetchOverview(currentUserId, true);
      setDropAmount(50);
      triggerFeedback('success'); toast.success('התרומה התקבלה');
    } catch {
      toast.error('שגיאה בתרומה לדרופ');
    } finally {
      setContributingDrop(false);
    }
  };

  if (loading || !data) {
    return <div className="min-h-[100dvh] bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" size={32} /></div>;
  }

  const { circle, isMember, membership } = data;
  const myStats = overview?.my_stats || null;
  const myLevel = myStats?.level || 1;
  const myXP = myStats?.xp || 0;
  const xpToNext = myLevel * 100;
  const xpProgress = Math.min(100, Math.round((myXP / xpToNext) * 100));

  return (
    <>
      <input type="file" ref={fileInputRef} onChange={(e) => { if(e.target.files?.[0]) { setSelectedFile(e.target.files[0]); triggerFeedback('pop'); } if(fileInputRef.current) fileInputRef.current.value=''; }} className="hidden" accept="image/*,video/*" />
      <input type="file" ref={storyInputRef} onChange={handleStoryChange} className="hidden" accept="image/*,video/*" />

      {/* MODAL: SEAL SELECTOR */}
      <AnimatePresence>
        {sealSelectorPost && (
          <div className="fixed inset-0 z-[9999999] flex flex-col justify-end p-4" dir="rtl">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSealSelectorPost(null)} />
            <motion.div initial={{ y: '100%', scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: '100%', scale: 0.95 }} className="relative z-10 bg-surface-card border border-surface-border rounded-[32px] p-8 shadow-2xl flex flex-col items-center gap-6">
              <div className="w-12 h-1.5 bg-white/10 rounded-full mb-2" />
              <div className="text-center">
                <h3 className="text-brand font-black text-xl tracking-tighter uppercase">הענק חותם יוקרה</h3>
                <p className="text-brand-muted text-[13px] mt-2 font-medium">תן כבוד לתוכן איכותי. החותם מעניק XP ליוצר ולך.</p>
              </div>
              <div className="grid grid-cols-3 gap-4 w-full">
                {SEAL_TYPES.map((type) => (
                  <button key={type.id} onClick={() => handleSeal(sealSelectorPost.id, type.id)} className="flex flex-col items-center gap-3 p-5 rounded-[24px] bg-surface border border-surface-border hover:border-accent-primary/50 transition-all active:scale-95 shadow-sm">
                    <div className={`p-3 rounded-full ${type.color} drop-shadow-lg`}>{type.icon}</div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-brand font-black text-[12px] uppercase tracking-widest">{type.label}</span>
                      <span className="text-brand-muted text-[10px] font-black tracking-widest">+{type.xp} XP</span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <FadeIn className="bg-[#050505] h-[100dvh] font-sans flex flex-col relative overflow-hidden" dir="rtl">
        
        {/* HERO / BACKGROUND */}
        <div className="absolute top-0 left-0 right-0 h-[40vh] pointer-events-none z-0">
          {circle.cover_url && <img src={circle.cover_url} className="w-full h-full object-cover opacity-30 mix-blend-luminosity" />}
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/40 via-[#050505]/80 to-[#050505]" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-accent-primary/20 blur-[100px] rounded-full" />
        </div>

        {/* HEADER */}
        <div className="relative z-20 pt-[calc(env(safe-area-inset-top)+20px)] px-6 flex flex-col items-center text-center shrink-0">
          <h1 className="text-3xl font-black text-white tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] mb-1">{circle.name}</h1>
          <p className="text-white/50 text-[12px] font-medium tracking-wide max-w-[280px] leading-relaxed">
            {circle.description || 'מרחב פרימיום לחברי המועדון'}
          </p>
          
          {isMember && (
            <div className="flex items-center gap-4 mt-4">
              <span className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-accent-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(var(--color-accent-primary),0.8)]" />
                {onlineCount} אונליין
              </span>
              <span className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase">
                {membersList.length} חברים
              </span>
            </div>
          )}
        </div>

        {!isMember ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
            <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-2xl mb-8 relative">
              <Lock size={32} className="text-white/40" />
            </div>
            <Button onClick={() => handleJoin('INNER')} disabled={joining} className="w-full max-w-[300px] h-14 bg-white/10 backdrop-blur-md border border-white/20 text-white font-black rounded-[20px] uppercase tracking-widest text-[13px] hover:bg-white/20 transition-all shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
              בקשת גישה ({circle.join_price || 0} CRD)
            </Button>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden relative z-10 mt-6">
            
            {/* MINIMALIST NAVIGATION */}
            <div className="flex items-center justify-center gap-8 px-6 mb-6 shrink-0 relative z-20">
              {[
                { id: 'overview', label: 'דשבורד' },
                { id: 'chat', label: 'לייב' },
                { id: 'vaults', label: 'כספות' },
                { id: 'members', label: 'קהילה' }
              ].map((t) => {
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`relative text-[12px] font-black uppercase tracking-widest transition-colors ${isActive ? 'text-white' : 'text-white/30 hover:text-white/60'}`}
                  >
                    {t.label}
                    {isActive && (
                      <motion.div layoutId="nav-indicator" className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent-primary shadow-[0_0_10px_rgba(var(--color-accent-primary),1)]" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* TAB: OVERVIEW (HUD STYLE) */}
            {activeTab === 'overview' && (
              <div className="flex-1 overflow-y-auto px-5 pb-[120px] flex flex-col gap-4 scrollbar-hide">
                
                {/* HUD: Identity & Progress */}
                <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/5 rounded-[32px] p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-accent-primary/10 blur-[50px] pointer-events-none" />
                  <span className="text-[10px] font-black text-white/30 tracking-[0.2em] uppercase mb-1 block">הסטטוס שלך</span>
                  <div className="flex items-end justify-between">
                    <div>
                      <h2 className="text-3xl font-black text-white tracking-tight">{getLevelName(myLevel)}</h2>
                      <span className="text-[12px] font-black text-accent-primary tracking-widest mt-1 block">LEVEL {myLevel}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black text-white/50 tracking-widest uppercase">XP עד לרמה הבאה</span>
                      <div className="text-[16px] font-black text-white">{myXP} / <span className="text-white/30">{xpToNext}</span></div>
                    </div>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full mt-4 overflow-hidden">
                    <div className="h-full bg-accent-primary rounded-full shadow-[0_0_10px_rgba(var(--color-accent-primary),0.8)]" style={{ width: `${xpProgress}%` }} />
                  </div>
                </div>

                {/* HUD: Stories / Moments */}
                <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/5 rounded-[32px] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase">רגעים בלייב</span>
                    <button onClick={() => storyInputRef.current?.click()} className="text-[10px] font-black text-accent-primary tracking-widest uppercase hover:text-white transition-colors">
                      + העלה
                    </button>
                  </div>
                  <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
                    {overview.stories?.length ? overview.stories.map((story: any) => (
                      <div key={story.id} className="flex flex-col items-center gap-2 shrink-0" onClick={() => window.open(story.media_url, '_blank')}>
                        <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-accent-primary via-white/20 to-transparent cursor-pointer active:scale-95 transition-transform">
                          <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#050505] bg-white/5">
                             {story.media_type === 'video' ? <video src={story.media_url} className="w-full h-full object-cover" /> : <img src={story.media_url} className="w-full h-full object-cover" />}
                          </div>
                        </div>
                        <span className="text-[9px] font-black text-white/60 tracking-wider truncate max-w-[60px] text-center">{story.full_name?.split(' ')[0]}</span>
                      </div>
                    )) : (
                      <div className="text-[11px] font-medium text-white/30 py-4 w-full text-center">אין רגעים פעילים. תהיה הראשון.</div>
                    )}
                  </div>
                </div>

                {/* HUD: Active Drop */}
                {overview.drop && (
                  <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/5 rounded-[32px] p-6">
                    <span className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase mb-1 block">דרופ קהילתי</span>
                    <h3 className="text-xl font-black text-white mb-4">{overview.drop.title}</h3>
                    
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-[24px] font-black text-accent-primary leading-none">{overview.drop.current_crd || 0}</span>
                      <span className="text-[10px] font-black text-white/40 tracking-widest uppercase">מתוך {overview.drop.target_crd || 0}</span>
                    </div>
                    
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-5">
                      <div className="h-full bg-accent-primary rounded-full" style={{ width: `${Math.min(100, Math.round(((overview.drop.current_crd || 0) / Math.max(1, overview.drop.target_crd || 1)) * 100))}%` }} />
                    </div>

                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full p-1.5 pl-4">
                      <button onClick={handleContributeToDrop} disabled={contributingDrop || !dropAmount} className="h-10 px-6 bg-white text-black font-black text-[12px] uppercase tracking-widest rounded-full active:scale-95 transition-transform disabled:opacity-50">
                        {contributingDrop ? '...' : 'תרום CRD'}
                      </button>
                      <input type="number" value={dropAmount} onChange={(e) => setDropAmount(Number(e.target.value))} className="flex-1 bg-transparent border-none outline-none text-white font-black text-left text-[16px]" placeholder="50" dir="ltr" />
                    </div>
                  </div>
                )}

                {/* HUD: Tasks */}
                <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/5 rounded-[32px] p-6">
                  <span className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase mb-4 block">יעדים ומשימות</span>
                  {overview.tasks?.length ? (
                    <div className="flex flex-col gap-4">
                      {overview.tasks.map((task: any) => (
                        <div key={task.id} className="flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <span className={`text-[13px] font-black ${task.completed ? 'text-white/30 line-through' : 'text-white'}`}>{task.title}</span>
                            <span className="text-[10px] font-black text-accent-primary tracking-widest bg-accent-primary/10 px-2 py-0.5 rounded-sm">+{task.reward_xp} XP</span>
                          </div>
                          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${task.completed ? 'bg-white/20' : 'bg-accent-primary'}`} style={{ width: `${Math.min(100, Math.round(((task.progress || 0) / Math.max(1, task.target_count || 1)) * 100))}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] font-medium text-white/30">הכל נקי. אין משימות להיום.</div>
                  )}
                </div>

                {/* HUD: Leaderboard */}
                {overview.leaderboard?.length > 0 && (
                  <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/5 rounded-[32px] p-6">
                    <span className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase mb-4 block">טבלת מובילים</span>
                    <div className="flex flex-col gap-4">
                      {overview.leaderboard.slice(0, 3).map((userStat: any, idx: number) => (
                        <div key={userStat.user_id} className="flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/profile/${userStat.user_id}`)}>
                          <span className={`text-[12px] font-black w-4 text-center ${idx === 0 ? 'text-accent-primary' : 'text-white/30'}`}>{idx + 1}</span>
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-white/5 border border-white/10">
                            {userStat.avatar_url ? <img src={userStat.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/30 text-[10px]">{(userStat.full_name || 'א')[0]}</div>}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[13px] font-black text-white truncate max-w-[150px]">{userStat.full_name}</span>
                            <span className="text-[10px] font-bold text-white/40 tracking-widest uppercase">{userStat.xp} XP</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: CHAT (Clean Glass Edge-to-Edge Media) */}
            {activeTab === 'chat' && (
              <div className="flex-1 relative flex flex-col overflow-hidden">
                <div ref={messagesRef} className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-2 pb-[100px]">
                  <div className="flex flex-col gap-5 min-h-full">
                    {sortedPosts.length === 0 ? (
                      <div className="text-center py-20 flex flex-col items-center justify-center h-full">
                        <span className="text-white/20 font-black text-[12px] tracking-[0.3em] uppercase">שקט כאן.</span>
                      </div>
                    ) : (
                      sortedPosts.map((post: any) => (
                        <div key={post.id} className={`flex flex-col gap-1.5 w-full ${post.user_id === currentUserId ? 'items-end' : 'items-start'}`}>
                          
                          {/* Sender Info (Only if not me and no media) */}
                          {post.user_id !== currentUserId && !post.media_url && (
                            <div className="flex items-center gap-2 pl-2" onClick={() => navigate(`/profile/${post.user_id}`)}>
                              <div className="w-5 h-5 rounded-full overflow-hidden bg-white/5">
                                {post.profiles?.avatar_url && <img src={post.profiles.avatar_url} className="w-full h-full object-cover" />}
                              </div>
                              <span className="text-white/40 text-[10px] font-black uppercase tracking-wider">{post.profiles?.full_name?.split(' ')[0]}</span>
                            </div>
                          )}

                          {/* Message Bubble */}
                          <div className={`relative flex flex-col max-w-[80%] rounded-[20px] ${post.user_id === currentUserId ? 'rounded-br-sm' : 'rounded-bl-sm'} overflow-hidden shadow-sm ${!post.media_url ? (post.user_id === currentUserId ? 'bg-accent-primary/20 border border-accent-primary/30' : 'bg-white/5 border border-white/5') : ''}`}>
                            
                            {/* Media Full Edge-to-Edge */}
                            {post.media_url ? (
                              <div className="relative w-full group">
                                {post.media_type === 'video' ? (
                                  <video src={post.media_url} controls playsInline className="w-full h-auto max-h-[350px] object-cover" />
                                ) : (
                                  <img src={post.media_url} className="w-full h-auto max-h-[350px] object-cover" loading="lazy" />
                                )}

                                {/* Gradients & Overlays */}
                                {(post.content || post.user_id !== currentUserId) && (
                                  <>
                                    {post.user_id !== currentUserId && <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />}
                                    {post.content && <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />}
                                  </>
                                )}

                                {/* Sender Name Over Media */}
                                {post.user_id !== currentUserId && (
                                  <span className="absolute top-3 right-4 text-white text-[10px] font-black uppercase tracking-widest drop-shadow-md z-10" onClick={() => navigate(`/profile/${post.user_id}`)}>
                                    {post.profiles?.full_name || 'אנונימי'}
                                  </span>
                                )}

                                {/* Text Over Media */}
                                {post.content && (
                                  <div className="absolute bottom-3 left-4 right-4 z-10">
                                     <span className="text-white text-[14px] leading-relaxed font-medium whitespace-pre-wrap break-words drop-shadow-md">{post.content}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* Text Only */
                              <div className="px-4 py-3">
                                <span className="text-white/90 text-[14px] leading-relaxed font-medium whitespace-pre-wrap break-words">{post.content}</span>
                              </div>
                            )}
                          </div>

                          {/* Seals Display below bubble */}
                          <div className={`flex items-center gap-2 px-1 mt-0.5 ${post.user_id === currentUserId ? 'justify-end' : 'justify-start'}`}>
                            {SEAL_TYPES.map((sealDef) => {
                              const count = post.post_seals?.filter((s:any) => s.seal_type === sealDef.id).length || 0;
                              if (count === 0) return null;
                              return <span key={sealDef.id} className="text-[11px] opacity-80">{sealDef.label} {count}</span>;
                            })}
                            <button onClick={() => setSealSelectorPost(post)} className="text-white/20 hover:text-white/60 px-1 py-0.5 text-[10px] font-black active:scale-95 transition-all">
                              +
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* FLOATING GLASS INPUT */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#050505] via-[#050505]/90 to-transparent z-[100] pb-[calc(env(safe-area-inset-bottom)+16px)]">
                  
                  <AnimatePresence>
                    {selectedFile && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute -top-24 right-6 w-20 h-20 rounded-[16px] overflow-hidden border border-white/10 shadow-2xl bg-black">
                        {selectedFile.type.startsWith('video/') ? <video src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover" /> : <img src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover" />}
                        <button onClick={() => setSelectedFile(null)} className="absolute top-1 right-1 bg-black/60 p-1 rounded-full text-white backdrop-blur-md"><X size={10} /></button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="max-w-[600px] mx-auto backdrop-blur-3xl bg-white/5 border border-white/10 rounded-full h-[54px] flex items-center px-2 pr-4 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                    <input
                      type="text" value={newPost} onChange={(e) => { setNewPost(e.target.value); if (channelRef.current) channelRef.current.track({ isTyping: e.target.value.length > 0 }); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handlePost(); }}
                      placeholder="הודעה למעגל..." className="flex-1 bg-transparent border-none outline-none text-white text-[13px] font-medium placeholder:text-white/30"
                    />
                    <div className="flex items-center gap-1">
                      <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 flex items-center justify-center rounded-full text-white/30 hover:text-white/70 transition-colors">
                        <Paperclip size={18} />
                      </button>
                      <button onClick={handlePost} disabled={posting || (!newPost.trim() && !selectedFile)} className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center active:scale-90 disabled:opacity-30 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                        {posting ? <Loader2 size={16} className="animate-spin text-black" /> : <Send size={16} className="rtl:-scale-x-100 -ml-0.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: VAULTS */}
            {activeTab === 'vaults' && (
              <div className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto pb-[120px] scrollbar-hide">
                {loadingVaults ? (
                  <div className="flex justify-center py-20"><Loader2 className="animate-spin text-accent-primary" size={24} /></div>
                ) : vaults.length === 0 ? (
                  <div className="text-center py-20 text-[12px] font-black text-white/30 tracking-[0.2em] uppercase">הכספת ריקה</div>
                ) : (
                  vaults.map((vault) => <VaultCard key={vault.id} vault={vault} onUnlockSuccess={fetchVaults} />)
                )}
              </div>
            )}

            {/* TAB: MEMBERS */}
            {activeTab === 'members' && (
              <div className="flex-1 p-5 flex flex-col gap-3 overflow-y-auto pb-[120px] scrollbar-hide">
                {membersList.map((m) => (
                  <div key={m.profiles?.id} onClick={() => navigate(`/profile/${m.profiles?.id}`)} className="flex items-center gap-4 bg-white/5 border border-white/5 p-4 rounded-[24px] cursor-pointer active:scale-95 transition-all">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-black/50 flex items-center justify-center">
                      {m.profiles?.avatar_url ? <img src={m.profiles.avatar_url} className="w-full h-full object-cover" /> : <span className="text-white/40 font-black text-[12px]">{(m.profiles?.full_name || 'א')[0]}</span>}
                    </div>
                    <div className="flex flex-col text-right flex-1">
                      <span className="text-white font-black text-[14px] flex items-center gap-1.5">{m.profiles?.full_name} {m.role === 'admin' && <ShieldAlert size={12} className="text-accent-primary" />}</span>
                      <span className="text-white/30 text-[10px] font-bold tracking-widest mt-0.5 uppercase">{m.tier || 'MEMBER'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </FadeIn>
    </>
  );
};
