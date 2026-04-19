import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { FadeIn, Button } from '../components/ui';
import { VaultCard } from '../components/VaultCard';
import {
  Loader2, MessageSquare, Lock, ShieldAlert, Flame, Diamond, Handshake,
  Plus, Send, X, Coins, Paperclip, Users, ChevronLeft, ChevronDown,
  Gift, Medal, Crown, UserCircle, Archive, Sparkles, Pin, Target, Radio,
  BarChart3, Calendar, BadgeCheck, Eye, Activity, Trophy, Image as ImageIcon
} from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const SEAL_TYPES = [
  { id: 'fire', icon: <Flame size={18} />, label: 'אש', color: 'text-orange-500', xp: 15, meaning: 'פוסט חם' },
  { id: 'diamond', icon: <Diamond size={18} />, label: 'יהלום', color: 'text-blue-400', xp: 50, meaning: 'תוכן איכותי' },
  { id: 'alliance', icon: <Handshake size={18} />, label: 'ברית', color: 'text-emerald-400', xp: 100, meaning: 'תרומה לקהילה' }
];

type OverviewPayload = {
  pins?: any[]; stories?: any[]; drop?: any | null; events?: any[];
  activity?: any[]; leaderboard?: any[]; my_stats?: any | null; tasks?: any[]; trust_rules?: any | null;
};

const formatTime = (dateStr?: string | null) => {
  if (!dateStr) return '';
  try { return new Date(dateStr).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
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
  return 'חדש';
};

const getActivityLabel = (type: string, payload: any) => {
  switch (type) {
    case 'new_post': return 'פרסם פוסט חדש';
    case 'xp_gain': return `צבר ${payload?.amount || 0} XP`;
    case 'task_completed': return `השלים משימה`;
    case 'drop_contribution': return `תרם ${payload?.amount || 0} CRD לדרופ`;
    case 'new_story': return 'העלה רגע חדש';
    case 'join_circle': return 'הצטרף למועדון';
    default: return 'ביצע פעילות חדשה';
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
  const [selectedStoryFile, setSelectedStoryFile] = useState<File | null>(null);
  const [uploadingStory, setUploadingStory] = useState(false);
  const [joining, setJoining] = useState(false);
  const [contributingDrop, setContributingDrop] = useState(false);
  const [dropAmount, setDropAmount] = useState<number | ''>(50);

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
    const el = messagesRef.current;
    requestAnimationFrame(() => { el.scrollTop = 0; });
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

      const { data: posts } = await supabase.from('posts').select('*, profiles!user_id(*)').eq('circle_id', circle.id).order('created_at', { ascending: false }).limit(60);

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
      const { data: membersData } = await supabase.from('circle_members').select('role, created_at, profiles(*)').eq('circle_id', circleId);
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
      if (!circleId) {
        const { data: bySlug } = await supabase.from('circles').select('id').eq('slug', slug).maybeSingle();
        circleId = bySlug?.id;
        if (!circleId) {
          const { data: byId } = await supabase.from('circles').select('id').eq('id', slug).maybeSingle();
          circleId = byId?.id;
        }
      }
      if (!circleId) return;

      const { data: overviewData, error } = await supabase.rpc('get_circle_overview', {
        p_circle_id: circleId,
        p_user_id: uid && !uid.startsWith('guest_') ? uid : null
      });

      if (!error && overviewData) {
        setOverview({
          pins: overviewData.pins || [], stories: overviewData.stories || [], drop: overviewData.drop || null,
          events: overviewData.events || [], activity: overviewData.activity || [], leaderboard: overviewData.leaderboard || [],
          my_stats: overviewData.my_stats || null, tasks: overviewData.tasks || [], trust_rules: overviewData.trust_rules || null
        });
        if (!silent) localStorage.setItem(`inner_overview_${slug}_cache`, JSON.stringify(overviewData));
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
    } catch {} finally {
      setLoadingVaults(false);
    }
  };

  const ensureStatsRow = async () => {
    if (!data?.circle?.id || !currentUserId || currentUserId.startsWith('guest_')) return;
    try { await supabase.rpc('ensure_circle_user_stats', { p_circle_id: data.circle.id, p_user_id: currentUserId }); } catch {}
  };

  const handleJoin = async (tier: 'INNER' | 'CORE') => {
    if (!currentUserId || currentUserId.startsWith('guest_')) return toast.error('יש להתחבר תחילה');
    setJoining(true); triggerFeedback('pop');
    try {
      if (data.isMember) {
        await apiFetch(`/api/circles/${data.circle.slug}/upgrade`, { method: 'POST', body: JSON.stringify({ tier }) });
        triggerFeedback('success'); toast.success(`שודרגת ל-${tier === 'CORE' ? 'ליבה' : 'מועדון'}! 👑`);
      } else {
        await apiFetch(`/api/circles/${data.circle.slug}/join`, { method: 'POST' });
        triggerFeedback('success'); toast.success('ברוך הבא למועדון! 🎉');
        try { await supabase.from('circle_activity').insert({ circle_id: data.circle.id, actor_user_id: currentUserId, activity_type: 'join_circle', payload: { tier } }); } catch {}
      }
      await ensureStatsRow();
      await fetchCircleData(currentUserId);
      await fetchOverview(currentUserId);
    } catch (err: any) {
      toast.error(err?.message || 'שגיאה בהצטרפות');
    } finally {
      setJoining(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      setSelectedFile(file);
      triggerFeedback('pop');
    } else if (file) {
      toast.error('אנא בחר קובץ תמונה או וידאו תקין');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStoryChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return toast.error('העלה תמונה או וידאו בלבד');

    setSelectedStoryFile(file);
    await handleUploadStory(file);
    if (storyInputRef.current) storyInputRef.current.value = '';
  };

  const handleUploadStory = async (file: File) => {
    if (!data?.circle?.id || !currentUserId || currentUserId.startsWith('guest_')) return toast.error('יש להתחבר תחילה');
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
      setSelectedStoryFile(null);
      triggerFeedback('success'); toast.success('הרגע עלה בהצלחה');
    } catch {
      toast.error('שגיאה בהעלאת רגע');
    } finally {
      setUploadingStory(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewPost(val);
    if (channelRef.current) channelRef.current.track({ isTyping: val.length > 0 });
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

      await ensureStatsRow();
      const xpAmount = selectedFile ? 20 : 8;
      await supabase.rpc('add_circle_xp', { p_circle_id: data.circle.id, p_user_id: currentUserId, p_amount: xpAmount, p_reason: selectedFile ? 'media_post' : 'text_post' });
      await supabase.from('circle_activity').insert({ circle_id: data.circle.id, actor_user_id: currentUserId, activity_type: 'new_post', payload: { has_media: !!selectedFile, media_type: selectedFile ? media_type : null } });
      await supabase.from('circle_user_stats').update({ last_active_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('circle_id', data.circle.id).eq('user_id', currentUserId);

      setNewPost(''); setSelectedFile(null);
      if (channelRef.current) channelRef.current.track({ isTyping: false });
      await fetchOverview(currentUserId, true);
      triggerFeedback('success');
    } catch (err: any) {
      toast.error(err?.message || 'שגיאה בשליחת ההודעה');
    } finally {
      setPosting(false);
    }
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
    return <div className="min-h-[100dvh] bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" size={32} /></div>;
  }

  const { circle, isMember, membership } = data;
  const isOwner = circle.creator_id === currentUserId || membership?.role === 'admin';
  const isCoreMember = membership?.tier === 'CORE' || membership?.role === 'admin';
  const myStats = overview?.my_stats || null;
  const myLevel = myStats?.level || 1;
  const myXP = myStats?.xp || 0;
  const xpToNext = myLevel * 100;
  const xpProgress = Math.min(100, Math.round((myXP / xpToNext) * 100));
  const memberCount = membersList.length || circle.members_count || 0;

  return (
    <>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />
      <input type="file" ref={storyInputRef} onChange={handleStoryChange} className="hidden" accept="image/*,video/*" />

      <FadeIn className="bg-surface h-[100dvh] font-sans flex flex-col relative overflow-hidden" dir="rtl">
        <div className="relative w-full h-[220px] shrink-0 bg-surface overflow-hidden flex flex-col justify-end pb-5 z-20">
          {circle.cover_url ? (
            <img src={circle.cover_url} className="absolute inset-0 w-full h-full object-cover opacity-60" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/20 via-surface-card to-surface" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-transparent" />

          <div className="relative z-10 px-5 text-center flex flex-col items-center">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-accent-primary/15 text-accent-primary text-[10px] font-black tracking-[0.2em] uppercase border border-accent-primary/20">
                מועדון
              </span>
              {isCoreMember && (
                <span className="px-3 py-1 rounded-full bg-amber-400/10 text-amber-300 text-[10px] font-black tracking-[0.2em] uppercase border border-amber-400/20">
                  ליבה
                </span>
              )}
              {isOwner && (
                <span className="px-3 py-1 rounded-full bg-emerald-400/10 text-emerald-300 text-[10px] font-black tracking-[0.2em] uppercase border border-emerald-400/20">
                  מנהל
                </span>
              )}
            </div>

            <h1 className="text-3xl font-black text-brand mb-2 drop-shadow-md">{circle.name}</h1>

            <p className="text-[13px] text-white/80 font-medium max-w-[320px] leading-relaxed mb-3">
              {circle.description || 'מועדון סגור עם תוכן פרימיום, שיחות פנימיות, רגעים ואתגרי קהילה'}
            </p>

            <div className="flex items-center justify-center gap-3 bg-surface-card/80 backdrop-blur-xl border border-white/10 px-5 py-2.5 rounded-full shadow-[0_5px_15px_rgba(0,0,0,0.3)]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_#34d399]" />
                <span className="text-[12px] font-black text-white tracking-widest">
                  {onlineCount} מחוברים
                </span>
              </div>
              {isMember && typingUsers.size > 0 && (
                <>
                  <div className="w-px h-3 bg-white/20" />
                  <div className="flex items-center gap-1.5">
                    <MessageSquare size={14} className="text-brand-muted" />
                    <span className="text-[11px] font-bold text-white/80">
                      {typingUsers.size} מקלידים...
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {!isMember ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 relative z-10">
            <div className="w-28 h-28 rounded-full bg-surface-card border border-surface-border flex items-center justify-center shadow-2xl relative">
              <div className="absolute inset-0 bg-accent-primary/5 rounded-full animate-pulse blur-xl" />
              <Lock size={40} className="text-brand-muted relative z-10" />
            </div>

            <div className="text-center">
              <h2 className="text-2xl font-black text-brand mb-2 uppercase tracking-widest">מועדון סגור</h2>
              <p className="text-brand-muted text-[13px] font-medium max-w-[250px] mx-auto">
                הצטרף עכשיו כדי לקבל גישה לתוכן בלעדי, כספות, רגעים ואתגרי קהילה
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 w-full max-w-[340px]">
              <Button onClick={() => handleJoin('INNER')} disabled={joining} className="w-full h-14 bg-white text-black font-black rounded-full uppercase tracking-widest text-[14px] shadow-lg active:scale-95 transition-all">
                הצטרפות - {circle.join_price || 0} CRD
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden relative">
            <div className="flex justify-center px-4 py-2 z-20 relative shrink-0">
              <div className="flex items-center bg-surface-card border border-surface-border rounded-full p-1 shadow-inner w-full max-w-[420px] overflow-x-auto scrollbar-hide">
                {['overview', 'chat', 'vaults', 'members'].map((t) => (
                  <button
                    key={t}
                    onClick={() => { triggerFeedback('pop'); setActiveTab(t as any); }}
                    className={`flex-1 min-w-[70px] py-2.5 text-[12px] font-black tracking-widest transition-all rounded-full flex items-center justify-center ${
                      activeTab === t ? 'bg-accent-primary text-white shadow-md' : 'bg-transparent text-brand-muted hover:text-brand'
                    }`}
                  >
                    {t === 'overview' ? 'הבית' : t === 'chat' ? 'צ׳אט' : t === 'vaults' ? 'כספות' : 'חברים'}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'overview' && (
              <div className="flex-1 overflow-y-auto px-4 pb-[120px] pt-2 flex flex-col gap-4 scrollbar-hide">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[24px] bg-surface-card border border-surface-border p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-brand-muted text-[11px] font-black tracking-widest uppercase">המעמד שלך</span>
                      <BadgeCheck size={16} className="text-accent-primary" />
                    </div>
                    <div className="text-brand text-[18px] font-black">{getLevelName(myLevel)}</div>
                    <div className="text-brand-muted text-[12px] mt-1">רמה {myLevel}</div>
                    <div className="mt-3 w-full h-1.5 rounded-full bg-surface overflow-hidden">
                      <div className="h-full bg-accent-primary rounded-full" style={{ width: `${xpProgress}%` }} />
                    </div>
                    <div className="text-brand-muted text-[11px] mt-2 font-bold">{myXP} / {xpToNext} XP</div>
                  </div>

                  <div className="rounded-[24px] bg-surface-card border border-surface-border p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-brand-muted text-[11px] font-black tracking-widest uppercase">מצב המועדון</span>
                      <Activity size={16} className="text-emerald-400" />
                    </div>
                    <div className="text-brand text-[18px] font-black">{memberCount} חברים</div>
                    <div className="text-brand-muted text-[11px] mt-0.5">{onlineCount} אונליין עכשיו</div>
                    <div className="text-accent-primary text-[10px] font-black mt-4 uppercase tracking-widest bg-accent-primary/10 w-fit px-2 py-1 rounded-md">
                      {overview?.activity?.length || 0} פעילויות לאחרונה
                    </div>
                  </div>
                </div>

                {(overview?.pins?.length || 0) > 0 && (
                  <div className="rounded-[28px] bg-surface-card border border-surface-border p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Pin size={16} className="text-accent-primary" />
                      <span className="text-brand font-black text-[13px] tracking-widest uppercase">נעוצים</span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {overview.pins?.map((pin: any) => (
                        <div key={pin.id} className="rounded-[20px] bg-surface border border-surface-border p-4">
                          <div className="text-brand text-[14px] font-black">{pin.title}</div>
                          {pin.content && <div className="text-brand-muted text-[13px] mt-1.5 leading-relaxed">{pin.content}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-[28px] bg-surface-card border border-surface-border p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Eye size={16} className="text-accent-primary" />
                      <span className="text-brand font-black text-[13px] tracking-widest uppercase">רגעים</span>
                    </div>
                    <button onClick={() => storyInputRef.current?.click()} disabled={uploadingStory} className="px-4 py-1.5 rounded-full bg-accent-primary text-white text-[11px] font-black tracking-widest active:scale-95 transition-all shadow-sm">
                      {uploadingStory ? 'מעלה...' : '+ הוסף רגע'}
                    </button>
                  </div>

                  {overview?.stories?.length ? (
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide">
                      {overview.stories.map((story: any) => (
                        <div key={story.id} className="w-[90px] shrink-0" onClick={() => window.open(story.media_url, '_blank')}>
                          <div className="relative w-full h-[130px] rounded-[20px] overflow-hidden border border-surface-border bg-surface cursor-pointer active:scale-95 transition-transform">
                            {story.media_type === 'video' ? <video src={story.media_url} className="w-full h-full object-cover" /> : <img src={story.media_url} className="w-full h-full object-cover" />}
                            <div className="absolute inset-x-0 bottom-0 p-2 pt-6 bg-gradient-to-t from-black/80 to-transparent">
                              <div className="text-white text-[10px] font-black truncate drop-shadow-md">{story.full_name || story.username || 'מישהו'}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-brand-muted text-[12px] font-medium">אין רגעים עדיין, תהיה הראשון לשתף!</div>
                  )}
                </div>

                {overview?.drop && (
                  <div className="rounded-[28px] bg-surface-card border border-surface-border p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-brand-muted font-black text-[11px] tracking-widest uppercase">דרופ קהילתי</span>
                      <span className="text-accent-primary text-[10px] font-black bg-accent-primary/10 px-2 py-0.5 rounded-md">{overview.drop?.expires_at ? formatTime(overview.drop.expires_at) : 'ללא הגבלת זמן'}</span>
                    </div>

                    <div className="text-brand text-[18px] font-black mb-1">{overview.drop.title || 'דרופ פתוח'}</div>
                    {overview.drop.description && <div className="text-brand-muted text-[13px] leading-relaxed mb-4">{overview.drop.description}</div>}

                    <div className="w-full h-2.5 rounded-full bg-surface overflow-hidden mb-2">
                      <div className="h-full bg-accent-primary rounded-full shadow-[0_0_10px_rgba(var(--color-accent-primary),0.5)]" style={{ width: `${Math.min(100, Math.round(((overview.drop.current_crd || 0) / Math.max(1, overview.drop.target_crd || 1)) * 100))}%` }} />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-black text-brand-muted mb-4 uppercase tracking-widest">
                      <span>{overview.drop.current_crd || 0} נאסף</span>
                      <span>{overview.drop.target_crd || 0} יעד</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-12 rounded-[20px] bg-surface border border-surface-border px-4 flex items-center shadow-inner">
                        <Coins size={16} className="text-brand-muted ml-2" />
                        <input type="number" value={dropAmount} onChange={(e) => setDropAmount(Number(e.target.value))} className="bg-transparent w-full outline-none text-brand font-black" placeholder="50" />
                      </div>
                      <button onClick={handleContributeToDrop} disabled={contributingDrop || !dropAmount} className="h-12 px-6 rounded-[20px] bg-accent-primary text-white font-black text-[12px] uppercase tracking-widest active:scale-95 disabled:opacity-50 transition-all shadow-[0_5px_15px_rgba(var(--color-accent-primary),0.3)]">
                        {contributingDrop ? <Loader2 size={16} className="animate-spin" /> : 'תרום'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="rounded-[28px] bg-surface-card border border-surface-border p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Target size={16} className="text-accent-primary" />
                    <span className="text-brand font-black text-[13px] tracking-widest uppercase">משימות פעילות</span>
                  </div>
                  {overview?.tasks?.length ? (
                    <div className="flex flex-col gap-3">
                      {overview.tasks.map((task: any) => {
                        const progressPercent = Math.min(100, Math.round(((task.progress || 0) / Math.max(1, task.target_count || 1)) * 100));
                        return (
                          <div key={task.id} className="rounded-[20px] bg-surface border border-surface-border p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-brand font-black text-[15px]">{task.title}</div>
                                {task.description && <div className="text-brand-muted text-[12px] mt-1">{task.description}</div>}
                              </div>
                              <div className="text-accent-primary bg-accent-primary/10 px-2 py-1 rounded-lg text-[10px] font-black whitespace-nowrap border border-accent-primary/20">+{task.reward_xp} XP</div>
                            </div>
                            <div className="mt-4 w-full h-1.5 rounded-full bg-surface-card overflow-hidden">
                              <div className={`h-full rounded-full ${task.completed ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-accent-primary shadow-[0_0_8px_rgba(var(--color-accent-primary),0.5)]'}`} style={{ width: `${progressPercent}%` }} />
                            </div>
                            <div className="flex items-center justify-between mt-2 text-[10px] text-brand-muted font-black uppercase tracking-widest">
                              <span>{task.progress || 0} / {task.target_count || 1}</span>
                              <span>{task.completed ? 'הושלם' : task.task_type}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-brand-muted text-[12px] font-medium">אין משימות פעילות כרגע.</div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="rounded-[28px] bg-surface-card border border-surface-border p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <Trophy size={16} className="text-accent-primary" />
                      <span className="text-brand font-black text-[13px] tracking-widest uppercase">מובילים במועדון</span>
                    </div>
                    {overview?.leaderboard?.length ? (
                      <div className="flex flex-col gap-3">
                        {overview.leaderboard.slice(0, 5).map((userStat: any, idx: number) => (
                          <div key={`${userStat.user_id}-${idx}`} className="flex items-center gap-3 bg-surface rounded-[20px] p-3 pr-4 border border-surface-border cursor-pointer active:scale-95 transition-all hover:border-accent-primary/30" onClick={() => navigate(`/profile/${userStat.user_id}`)}>
                            <div className="w-6 h-6 rounded-full bg-surface-card border border-surface-border flex items-center justify-center font-black text-[10px] text-brand-muted">{idx + 1}</div>
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-card border border-surface-border shrink-0">
                              {userStat.avatar_url ? <img src={userStat.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-brand-muted font-black">{(userStat.full_name || 'א')[0]}</div>}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col">
                              <div className="text-brand font-black text-[13px] truncate">{userStat.full_name || 'אנונימי'}</div>
                              <div className="text-brand-muted text-[11px] font-bold">רמה {userStat.level || 1} • {userStat.xp || 0} XP</div>
                            </div>
                            {idx === 0 && <Medal size={18} className="text-amber-400 drop-shadow-md ml-2" />}
                            {idx === 1 && <Medal size={18} className="text-slate-300 drop-shadow-md ml-2" />}
                            {idx === 2 && <Medal size={18} className="text-orange-400 drop-shadow-md ml-2" />}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-brand-muted text-[12px] font-medium">אין דירוג עדיין.</div>
                    )}
                  </div>

                  <div className="rounded-[28px] bg-surface-card border border-surface-border p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 size={16} className="text-accent-primary" />
                      <span className="text-brand font-black text-[13px] tracking-widest uppercase">מה חדש (פעילות)</span>
                    </div>
                    {overview?.activity?.length ? (
                      <div className="flex flex-col gap-4">
                        {overview.activity.slice(0, 8).map((item: any) => (
                          <div key={item.id} className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-surface border border-surface-border shrink-0">
                              {item.avatar_url ? <img src={item.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-brand-muted font-black text-[12px]">{(item.full_name || 'א')[0]}</div>}
                            </div>
                            <div className="flex-1 pt-0.5">
                              <div className="text-brand text-[13px] leading-relaxed"><span className="font-black">{item.full_name || 'משתמש'}</span> <span className="text-brand-muted">{getActivityLabel(item.activity_type, item.payload)}</span></div>
                              <div className="text-accent-primary/70 font-black tracking-widest uppercase text-[9px] mt-1">{formatRelative(item.created_at)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-brand-muted text-[12px] font-medium">עדיין אין פעילות להצגה.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="flex-1 relative flex flex-col overflow-hidden">
                <div ref={messagesRef} className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-2 pb-[120px] z-0">
                  <div className="flex flex-col gap-4 min-h-full">
                    {sortedPosts.length === 0 ? (
                      <div className="text-center py-20 opacity-50 flex flex-col items-center gap-3 my-auto">
                        <div className="w-20 h-20 rounded-[24px] bg-surface-card flex items-center justify-center border border-surface-border shadow-inner">
                          <MessageSquare size={32} className="text-brand-muted" />
                        </div>
                        <span className="text-brand-muted font-black text-[13px] tracking-widest uppercase mt-2">הצ'אט שקט מדי...<br />שבור את הקרח!</span>
                      </div>
                    ) : (
                      sortedPosts.map((post: any) => (
                        <div key={post.id} className="flex flex-col gap-1 w-full">
                          <div className={`flex gap-3 w-full ${post.user_id === currentUserId ? 'flex-row-reverse' : ''}`}>
                            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-surface-border bg-surface-card flex items-center justify-center shadow-sm cursor-pointer mt-auto" onClick={() => navigate(`/profile/${post.user_id}`)}>
                              {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <span className="text-brand-muted font-black text-[12px]">{(post.profiles?.full_name || 'א')[0]}</span>}
                            </div>
                            <div className="flex flex-col gap-1.5 max-w-[78%]">
                              <div className={`p-4 rounded-[24px] text-[14px] font-medium shadow-sm leading-relaxed ${post.user_id === currentUserId ? 'bg-accent-primary/10 border border-accent-primary/20 text-brand rounded-br-sm' : 'bg-surface-card border border-surface-border text-brand-muted rounded-bl-sm'}`}>
                                {post.user_id !== currentUserId && <span className="text-accent-primary text-[10px] font-black block mb-1.5 uppercase tracking-widest">{post.profiles?.full_name || 'אנונימי'}</span>}
                                {post.media_url && (
                                  <div className={`rounded-[16px] overflow-hidden border border-surface-border bg-surface ${post.content ? 'mb-3' : ''}`}>
                                    {post.media_type === 'video' ? <video src={post.media_url} controls playsInline className="w-full h-auto max-h-[300px] object-cover" /> : <img src={post.media_url} className="w-full h-auto max-h-[300px] object-cover" loading="lazy" />}
                                  </div>
                                )}
                                {post.content && <span className="whitespace-pre-wrap break-words">{post.content}</span>}
                              </div>
                              <div className={`flex items-center gap-2 px-1.5 ${post.user_id === currentUserId ? 'justify-end' : 'justify-start'}`}>
                                {SEAL_TYPES.map((seal) => (
                                  <div key={`${post.id}-${seal.id}`} className={`text-[10px] font-black flex items-center gap-1 ${seal.color}`} title={seal.meaning}>
                                    {seal.icon}
                                    <span>{seal.label}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* FLOATING CHAT INPUT */}
                <div className="fixed left-4 right-4 z-[80]" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 90px)' }}>
                  <div className="flex flex-col items-start w-full">
                    <AnimatePresence>
                      {selectedFile && (
                        <motion.div initial={{ opacity: 0, y: 10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: 10, height: 0 }} className="mb-3">
                          <div className="relative w-24 h-24 rounded-[20px] overflow-hidden border border-surface-border shadow-lg bg-surface-card ml-2">
                            {selectedFile.type.startsWith('video/') ? <video src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover" /> : <img src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover" />}
                            <button onClick={() => setSelectedFile(null)} className="absolute top-1.5 right-1.5 bg-black/60 p-1.5 rounded-full flex items-center justify-center text-white backdrop-blur-md hover:bg-black/80 transition-colors"><X size={12} /></button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="w-full bg-surface-card/95 backdrop-blur-2xl border border-surface-border rounded-full flex items-center pr-4 pl-1.5 py-1.5 min-h-[60px] shadow-[0_15px_40px_rgba(0,0,0,0.6)]">
                      <input
                        type="text" value={newPost} onChange={handleInputChange} onKeyDown={(e) => { if (e.key === 'Enter') handlePost(); }}
                        placeholder="הקלד הודעה..." className="flex-1 bg-transparent border-none outline-none text-brand font-medium text-[14px] placeholder:text-brand-muted/60"
                      />
                      <div className="flex items-center gap-1.5 shrink-0 mr-2 bg-surface p-1 rounded-full border border-surface-border shadow-inner">
                        <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 flex items-center justify-center rounded-full text-brand-muted hover:text-brand hover:bg-white/5 transition-all">
                          <Paperclip size={18} />
                        </button>
                        <button onClick={handlePost} disabled={posting || (!newPost.trim() && !selectedFile)} className="w-10 h-10 rounded-full bg-accent-primary text-white flex items-center justify-center active:scale-90 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(var(--color-accent-primary),0.5)]">
                          {posting ? <Loader2 size={18} className="animate-spin text-white" /> : <Send size={16} className="rtl:-scale-x-100 -ml-0.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'vaults' && (
              <div className="flex-1 p-4 flex flex-col gap-5 bg-surface overflow-y-auto pb-[120px] relative scrollbar-hide">
                <span className="text-brand-muted font-black text-[11px] tracking-widest uppercase block text-center mt-2">כספות תוכן</span>
                {loadingVaults ? (
                  <Loader2 className="animate-spin text-accent-primary mx-auto my-20" />
                ) : vaults.length === 0 ? (
                  <div className="text-center py-20 opacity-50 flex flex-col items-center">
                    <div className="w-20 h-20 rounded-[24px] bg-surface-card flex items-center justify-center border border-surface-border shadow-inner mb-4"><Lock size={32} className="text-brand-muted" /></div>
                    <h3 className="text-[13px] font-black text-brand-muted tracking-widest uppercase">אין כספות עדיין</h3>
                  </div>
                ) : (
                  vaults.map((vault) => <VaultCard key={vault.id} vault={vault} onUnlockSuccess={fetchVaults} />)
                )}

                {isOwner && (
                  <button onClick={() => navigate(`/circle/${slug}/vaults/create`)} className="fixed bottom-[100px] left-6 w-14 h-14 bg-accent-primary text-white rounded-full flex items-center justify-center shadow-[0_5px_20px_rgba(var(--color-accent-primary),0.5)] active:scale-90 transition-transform z-50">
                    <Plus size={28} />
                  </button>
                )}
              </div>
            )}

            {activeTab === 'members' && (
              <div className="flex-1 p-4 flex flex-col gap-3 bg-surface overflow-y-auto pb-[120px] scrollbar-hide">
                <span className="text-brand-muted font-black text-[11px] tracking-widest uppercase block text-center mb-2 mt-2">חברי מועדון ({memberCount})</span>
                {membersList.map((m, idx) => (
                  <div key={m.profiles?.id} onClick={() => navigate(`/profile/${m.profiles?.id}`)} className="flex items-center justify-between bg-surface-card p-4 rounded-[28px] border border-surface-border cursor-pointer active:scale-95 transition-all shadow-sm hover:border-accent-primary/30 group">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-surface flex items-center justify-center border border-surface-border shadow-inner group-hover:border-accent-primary/50 transition-colors">
                          {m.profiles?.avatar_url ? <img src={m.profiles.avatar_url} className="w-full h-full object-cover" /> : <span className="text-brand-muted font-black text-[14px]">{(m.profiles?.full_name || 'א')[0]}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col text-right min-w-0">
                        <span className="text-brand font-black text-[15px] flex items-center gap-1.5 truncate">
                          {m.profiles?.full_name || 'אנונימי'}
                          {m.role === 'admin' && <ShieldAlert size={14} className="text-accent-primary shrink-0" />}
                        </span>
                        <span className="text-brand-muted text-[11px] font-bold truncate mt-0.5" dir="ltr">@{m.profiles?.username}</span>
                      </div>
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
