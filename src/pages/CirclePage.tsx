import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { Button } from '../components/ui';
import { VaultCard } from '../components/VaultCard';
import {
  Loader2, MessageSquare, Lock, ShieldAlert, Flame, Diamond, Handshake,
  Plus, Send, X, Coins, Users, Archive, Sparkles, Trophy,
  Pin, BarChart3, Target, ChevronLeft, Eye, Activity, Paperclip, Camera, Copy, Edit2, Trash2
} from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const SEAL_TYPES = [
  { id: 'fire', icon: <Flame size={14} />, label: 'אש', color: 'text-orange-500 bg-orange-500/10 border-orange-500/30', xp: 15 },
  { id: 'diamond', icon: <Diamond size={14} />, label: 'יהלום', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30', xp: 50 },
  { id: 'alliance', icon: <Handshake size={14} />, label: 'ברית', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30', xp: 100 }
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
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(1, Math.floor((now - then) / 1000));
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

export const CirclePage: React.FC = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { profile: myProfile } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const storyInputRef = useRef<HTMLInputElement>(null);
  const instantPhotoRef = useRef<HTMLInputElement>(null);
  const instantVideoRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const cameraPressTimer = useRef<NodeJS.Timeout | null>(null);

  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem(`inner_circle_${slug}_cache`) || 'null'); } catch { return null; }
  });

  const [loading, setLoading] = useState(!data);
  const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'vaults' | 'members'>('chat');

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
  const [fullScreenMedia, setFullScreenMedia] = useState<{url: string, type: string} | null>(null);

  const [uploadingStory, setUploadingStory] = useState(false);
  const [joining, setJoining] = useState(false);
  const [contributingDrop, setContributingDrop] = useState(false);
  const [dropAmount, setDropAmount] = useState<number | ''>(50);

  const [actionPost, setActionPost] = useState<any | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [isCameraPressed, setIsCameraPressed] = useState(false);

  // סדר כרונולוגי: הודעות ישנות למעלה, חדשות למטה
  const sortedPosts = useMemo(() => {
    return [...(data?.posts || [])].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [data?.posts]);

  useEffect(() => { setMounted(true); }, []);

  // גלילה אוטומטית למטה כשנוספת הודעה
  useEffect(() => {
    if (activeTab === 'chat' && messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [sortedPosts, activeTab]);

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
        setOverview(overviewData);
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
    } catch {} finally { setLoadingVaults(false); }
  };

  const handleJoin = async (tier: 'INNER' | 'CORE') => {
    if (!currentUserId || currentUserId.startsWith('guest_')) return toast.error('יש להתחבר תחילה');
    setJoining(true); triggerFeedback('pop');
    try {
      if (data.isMember) {
        await apiFetch(`/api/circles/${data.circle.slug}/upgrade`, { method: 'POST', body: JSON.stringify({ tier }) });
        toast.success(`שודרגת ל-${tier}!`);
      } else {
        await apiFetch(`/api/circles/${data.circle.slug}/join`, { method: 'POST' });
        toast.success('ברוך הבא למועדון!');
        try { await supabase.from('circle_activity').insert({ circle_id: data.circle.id, actor_user_id: currentUserId, activity_type: 'join_circle', payload: { tier } }); } catch {}
      }
      await supabase.rpc('ensure_circle_user_stats', { p_circle_id: data.circle.id, p_user_id: currentUserId });
      await fetchCircleData(currentUserId);
      await fetchOverview(currentUserId);
    } catch (err: any) { toast.error(err?.message || 'שגיאה בהצטרפות'); } finally { setJoining(false); triggerFeedback('success'); }
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
    
    setUploadingStory(true); triggerFeedback('pop');
    
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const fileName = `story_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${safeName}`;
      const { data: uploadData, error } = await supabase.storage.from('feed_images').upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('feed_images').getPublicUrl(uploadData.path);
      
      const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 24);
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

      const { error: dbError } = await supabase.from('circle_stories').insert({ circle_id: data.circle.id, user_id: currentUserId, media_url: publicUrl, media_type: mediaType, expires_at: expiresAt.toISOString() });
      if (dbError) throw dbError;

      supabase.rpc('add_circle_xp', { p_circle_id: data.circle.id, p_user_id: currentUserId, p_amount: 20, p_reason: 'story_upload' }).then();

      await fetchOverview(currentUserId, true);
      toast.success('הרגע עלה בהצלחה');
    } catch (err: any) { 
      toast.error('שגיאה בהעלאת רגע'); 
    } finally { 
      setUploadingStory(false); 
      if (storyInputRef.current) storyInputRef.current.value = ''; 
      if (instantPhotoRef.current) instantPhotoRef.current.value = '';
      if (instantVideoRef.current) instantVideoRef.current.value = '';
    }
  };

  // מנגנון לחיצה ארוכה למצלמה
  const handleCameraStart = () => {
    setIsCameraPressed(true);
    cameraPressTimer.current = setTimeout(() => {
      // עברה חצי שניה - לחיצה ארוכה -> פותח מצלמת וידאו
      triggerFeedback('heavy');
      instantVideoRef.current?.click();
      setIsCameraPressed(false);
    }, 500);
  };

  const handleCameraEnd = () => {
    if (isCameraPressed) {
      if (cameraPressTimer.current) clearTimeout(cameraPressTimer.current);
      // שוחרר לפני חצי שניה - לחיצה קצרה -> פותח מצלמת תמונות
      triggerFeedback('pop');
      instantPhotoRef.current?.click();
      setIsCameraPressed(false);
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
      if (editingPostId) {
        const { error } = await supabase.from('posts').update({ content: newPost.trim() }).eq('id', editingPostId);
        if (error) throw error;
        toast.success('הודעה עודכנה');
      } else {
        let media_url: string | null = null;
        let media_type = 'text';

        if (selectedFile) {
          const fileName = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const { data: uploadData, error } = await supabase.storage.from('feed_images').upload(fileName, selectedFile);
          if (error) throw error;
          media_url = supabase.storage.from('feed_images').getPublicUrl(uploadData.path).data.publicUrl;
          media_type = selectedFile.type.startsWith('video/') ? 'video' : 'image';
        }

        const { error } = await supabase.from('posts').insert({
          circle_id: data.circle.id, user_id: currentUserId, content: newPost.trim(), media_url, media_type, is_reveal_drop: false, reveal_status: 'revealed', required_crd: 0
        });

        if (error) throw error;
        supabase.rpc('add_circle_xp', { p_circle_id: data.circle.id, p_user_id: currentUserId, p_amount: selectedFile ? 20 : 8, p_reason: 'post' }).then();
      }

      setNewPost(''); setSelectedFile(null); setEditingPostId(null);
      if (channelRef.current) channelRef.current.track({ isTyping: false });
    } catch { toast.error('שגיאה בשליחה'); } finally { setPosting(false); }
  };

  const handleContributeToDrop = async () => {
    if (!overview?.drop?.id || !dropAmount || Number(dropAmount) <= 0) return;
    setContributingDrop(true); triggerFeedback('pop');
    try {
      const { error } = await supabase.rpc('circle_contribute_to_drop', { p_drop_id: overview.drop.id, p_user_id: currentUserId, p_amount: Number(dropAmount) });
      if (error) throw error;
      await fetchOverview(currentUserId, true);
      setDropAmount(50);
      toast.success('התרומה התקבלה!');
    } catch { toast.error('שגיאה בתרומה'); } finally { setContributingDrop(false); }
  };

  const handleSealToggle = async (postId: string, sealType: string, isRemoving: boolean) => {
    triggerFeedback('pop');
    try {
      if (isRemoving) {
        const { error } = await supabase.from('post_seals').delete().match({ post_id: postId, user_id: currentUserId, seal_type: sealType });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('post_seals').insert({ post_id: postId, user_id: currentUserId, seal_type: sealType });
        if (error && error.code !== '23505') throw error;
        if (!error) {
          const xpAmount = SEAL_TYPES.find(s => s.id === sealType)?.xp || 10;
          supabase.rpc('add_circle_xp', { p_circle_id: data.circle.id, p_user_id: currentUserId, p_amount: xpAmount, p_reason: 'gave_seal' }).then();
        }
      }
      await fetchCircleData(currentUserId, true);
    } catch { toast.error('שגיאה בעדכון חותם'); }
  };

  let touchStartActionY = 0;
  const handleMessageTouchStart = (e: React.TouchEvent, post: any) => {
    touchStartActionY = e.touches[0].clientY;
    timerRef.current = setTimeout(() => { triggerFeedback('pop'); setActionPost(post); }, 450);
  };
  const handleMessageTouchMove = (e: React.TouchEvent) => {
    if (Math.abs(e.touches[0].clientY - touchStartActionY) > 10 && timerRef.current) clearTimeout(timerRef.current);
  };
  const handleMessageTouchEnd = () => { if (timerRef.current) clearTimeout(timerRef.current); };

  const handleCopyText = () => {
    if (actionPost?.content) { navigator.clipboard.writeText(actionPost.content); toast.success('הועתק ללוח'); }
    setActionPost(null);
  };

  const handleDeletePost = async () => {
    if (!actionPost) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', actionPost.id);
      if (error) throw error;
      toast.success('הודעה נמחקה');
    } catch { toast.error('שגיאה במחיקה'); } finally { setActionPost(null); }
  };

  const handleEditPost = () => {
    if (!actionPost) return;
    setNewPost(actionPost.content || '');
    setEditingPostId(actionPost.id);
    setActionPost(null);
  };

  if (loading || !data) {
    return <div className="fixed inset-0 z-[999999] bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" size={32} /></div>;
  }

  const { circle, isMember, membership } = data;
  const isOwner = circle.creator_id === currentUserId || membership?.role === 'admin';
  const myStats = overview?.my_stats || null;
  const myLevel = myStats?.level || 1;
  const myXP = myStats?.xp || 0;
  const xpToNext = myLevel * 100;
  const xpProgress = Math.min(100, Math.round((myXP / xpToNext) * 100));
  const memberCount = membersList.length || circle.members_count || 0;

  return mounted && typeof document !== 'undefined' ? createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[99999999] bg-[#050505] font-sans flex flex-col overflow-hidden" dir="rtl">
      
      {/* Hidden Inputs */}
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />
      <input type="file" ref={storyInputRef} onChange={handleStoryChange} className="hidden" accept="image/*,video/*" />
      <input type="file" ref={instantPhotoRef} onChange={handleStoryChange} className="hidden" accept="image/*" capture="environment" />
      <input type="file" ref={instantVideoRef} onChange={handleStoryChange} className="hidden" accept="video/*" capture="environment" />

      {/* FULLSCREEN MEDIA OVERLAY */}
      <AnimatePresence>
        {fullScreenMedia && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999999999] bg-black flex items-center justify-center" onClick={() => setFullScreenMedia(null)}>
            {fullScreenMedia.type === 'video' ? (
               <video src={fullScreenMedia.url} controls autoPlay className="w-full h-full object-contain" onClick={(e) => e.stopPropagation()} />
            ) : (
               <img src={fullScreenMedia.url} className="w-full h-full object-contain" onClick={(e) => e.stopPropagation()} />
            )}
            <button className="absolute top-[calc(env(safe-area-inset-top)+16px)] left-4 p-3 text-white/70 hover:text-white transition-all active:scale-90 z-50 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              <X size={28} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM SHEET: ACTION MENU */}
      <AnimatePresence>
        {actionPost && (
          <div className="fixed inset-0 z-[999999999] flex flex-col justify-end" dir="rtl">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActionPost(null)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="relative bg-[#111] rounded-t-[32px] p-6 pb-[calc(env(safe-area-inset-bottom)+32px)] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />
              
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-white/5 border border-white/10 shrink-0">
                  {actionPost.profiles?.avatar_url ? <img src={actionPost.profiles.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/40 font-black text-[14px]">{(actionPost.profiles?.full_name || 'א')[0]}</div>}
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-black text-[16px]">{actionPost.profiles?.full_name || 'אנונימי'}</span>
                  <span className="text-white/40 text-[11px] uppercase tracking-widest">{formatTime(actionPost.created_at)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {actionPost.content && (
                  <button onClick={handleCopyText} className="flex items-center gap-4 p-4 rounded-[20px] bg-white/5 hover:bg-white/10 text-white font-black text-[14px] transition-colors active:scale-95">
                    <Copy size={20} className="text-white/50" /> העתק טקסט
                  </button>
                )}
                {actionPost.user_id === currentUserId && (
                  <button onClick={handleEditPost} className="flex items-center gap-4 p-4 rounded-[20px] bg-white/5 hover:bg-white/10 text-white font-black text-[14px] transition-colors active:scale-95">
                    <Edit2 size={20} className="text-white/50" /> ערוך הודעה
                  </button>
                )}
                {(actionPost.user_id === currentUserId || isOwner) && (
                  <button onClick={handleDeletePost} className="flex items-center gap-4 p-4 rounded-[20px] bg-red-500/10 hover:bg-red-500/20 text-red-500 font-black text-[14px] transition-colors active:scale-95 border border-red-500/10">
                    <Trash2 size={20} /> מחק הודעה
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BACK BUTTON */}
      <button onClick={() => navigate(-1)} className="absolute top-[calc(env(safe-area-inset-top)+16px)] right-4 p-2 text-white/80 hover:text-white z-50 transition-all active:scale-90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
        <ChevronLeft size={32} className="rtl:rotate-180" />
      </button>

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
          
          {/* NAVIGATION */}
          <div className="flex items-center justify-center gap-8 px-6 mb-6 shrink-0 relative z-20">
            {[
              { id: 'chat', label: 'לייב' },
              { id: 'overview', label: 'דשבורד' },
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

          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="flex-1 overflow-y-auto px-5 pb-[120px] flex flex-col gap-4 scrollbar-hide">
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

          {/* TAB: CHAT */}
          {activeTab === 'chat' && (
            <div className="flex-1 relative flex flex-col overflow-hidden">
              
              {/* STORIES ROW */}
              {overview.stories && overview.stories.length > 0 && (
                <div className="shrink-0 pt-1 pb-3">
                  <div className="flex gap-4 overflow-x-auto scrollbar-hide px-5">
                    {overview.stories.map((story: any) => (
                      <div key={story.id} className="flex flex-col items-center gap-1 shrink-0" onClick={() => window.open(story.media_url, '_blank')}>
                        <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-accent-primary via-white/20 to-transparent cursor-pointer active:scale-95 transition-transform">
                          <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#050505] bg-white/5">
                             {story.media_type === 'video' ? <video src={story.media_url} className="w-full h-full object-cover" /> : <img src={story.media_url} className="w-full h-full object-cover" />}
                          </div>
                        </div>
                        <span className="text-[9px] font-black text-white/60 tracking-wider truncate max-w-[55px] text-center">{story.full_name?.split(' ')[0]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MESSAGES LIST */}
              <div ref={messagesRef} className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-2 pb-[100px]">
                <div className="flex flex-col gap-6 min-h-full">
                  {sortedPosts.length === 0 ? (
                    <div className="text-center py-20 flex flex-col items-center justify-center h-full">
                      <span className="text-white/20 font-black text-[12px] tracking-[0.3em] uppercase">שקט כאן.</span>
                    </div>
                  ) : (
                    sortedPosts.map((post: any) => (
                      <div 
                        key={post.id} 
                        className={`flex flex-col gap-1 w-full select-none ${post.user_id === currentUserId ? 'items-end' : 'items-start'}`}
                      >
                        
                        {post.user_id !== currentUserId && !post.media_url && (
                          <div className="flex items-center gap-2 pl-2 mb-1" onClick={() => navigate(`/profile/${post.user_id}`)}>
                            <div className="w-5 h-5 rounded-full overflow-hidden bg-white/5">
                              {post.profiles?.avatar_url && <img src={post.profiles.avatar_url} className="w-full h-full object-cover" />}
                            </div>
                            <span className="text-white/40 text-[10px] font-black uppercase tracking-wider">{post.profiles?.full_name?.split(' ')[0]}</span>
                          </div>
                        )}

                        <div 
                          className={`relative flex flex-col max-w-[85%] rounded-[24px] ${post.user_id === currentUserId ? 'rounded-br-sm' : 'rounded-bl-sm'} overflow-hidden shadow-sm ${!post.media_url ? (post.user_id === currentUserId ? 'bg-accent-primary/20 border border-accent-primary/30 text-white' : 'bg-white/5 border border-white/5 text-white/90') : 'bg-black/20'}`}
                          onTouchStart={(e) => handleMessageTouchStart(e, post)}
                          onTouchMove={handleMessageTouchMove}
                          onTouchEnd={handleMessageTouchEnd}
                          onMouseDown={(e) => { timerRef.current = setTimeout(() => { triggerFeedback('pop'); setActionPost(post); }, 450); }}
                          onMouseMove={() => { if(timerRef.current) clearTimeout(timerRef.current); }}
                          onMouseUp={() => { if(timerRef.current) clearTimeout(timerRef.current); }}
                        >
                          {post.media_url ? (
                            <div className="relative w-full group min-w-[200px] cursor-pointer" onClick={() => setFullScreenMedia({url: post.media_url, type: post.media_type})}>
                              {post.media_type === 'video' ? <video src={post.media_url} autoPlay muted loop playsInline className="w-full h-auto max-h-[350px] object-cover" /> : <img src={post.media_url} className="w-full h-auto max-h-[350px] object-cover" loading="lazy" />}
                              {(post.content || post.user_id !== currentUserId) && (
                                <>
                                  {post.user_id !== currentUserId && <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />}
                                  {post.content && <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />}
                                </>
                              )}
                              {post.user_id !== currentUserId && <span className="absolute top-3 left-4 text-white/90 text-[10px] font-black uppercase tracking-widest drop-shadow-md z-10" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${post.user_id}`); }}>{post.profiles?.full_name || 'אנונימי'}</span>}
                              {post.content && <div className="absolute bottom-3 left-4 right-4 z-10 pointer-events-none"><span className="text-white text-[14px] leading-relaxed font-medium whitespace-pre-wrap break-words drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{post.content}</span></div>}
                            </div>
                          ) : (
                            <div className="px-4 py-3"><span className="text-[14px] leading-relaxed font-medium whitespace-pre-wrap break-words">{post.content}</span></div>
                          )}
                        </div>

                        <div className={`flex items-center gap-1.5 px-2 mt-0.5 w-full ${post.user_id === currentUserId ? 'justify-end' : 'justify-start'}`}>
                          {SEAL_TYPES.map((sealDef) => {
                            const sealsOfType = post.post_seals?.filter((s:any) => s.seal_type === sealDef.id) || [];
                            const count = sealsOfType.length;
                            const hasSealed = sealsOfType.some((s:any) => s.user_id === currentUserId);
                            return (
                              <button
                                key={sealDef.id}
                                onClick={() => handleSealToggle(post.id, sealDef.id, hasSealed)}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black border transition-all active:scale-95 ${count > 0 ? (hasSealed ? sealDef.color : 'text-white/60 bg-white/5 border-white/10') : 'bg-white/5 border-white/5 text-white/30 hover:text-white/60'}`}
                                title={sealDef.meaning}
                              >
                                {sealDef.icon}
                                {count > 0 && <span>{count}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* INPUT BAR WITH CAMERA BUTTON */}
              <div className="absolute bottom-0 left-0 right-0 px-4 z-[100] pb-[calc(env(safe-area-inset-bottom)+16px)] bg-gradient-to-t from-[#050505] via-[#050505]/90 to-transparent">
                <AnimatePresence>
                  {selectedFile && (
                    <motion.div initial={{ opacity: 0, y: 10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: 10, height: 0 }} className="mb-3">
                      <div className="relative w-20 h-20 rounded-[16px] overflow-hidden border border-white/10 shadow-2xl bg-black ml-[64px]">
                        {selectedFile.type.startsWith('video/') ? <video src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover" /> : <img src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover" />}
                        <button onClick={() => setSelectedFile(null)} className="absolute top-1.5 right-1.5 bg-black/60 p-1.5 rounded-full text-white backdrop-blur-md hover:bg-black/80 transition-colors"><X size={10} /></button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-end gap-3 max-w-[600px] mx-auto">
                  {(!newPost.trim() && !selectedFile && !editingPostId) && (
                    <button 
                      onTouchStart={handleCameraStart}
                      onTouchEnd={handleCameraEnd}
                      onMouseDown={handleCameraStart}
                      onMouseUp={handleCameraEnd}
                      className={`shrink-0 w-[54px] h-[54px] rounded-full bg-accent-primary text-white flex items-center justify-center shadow-[0_5px_20px_rgba(var(--color-accent-primary),0.4)] transition-all ${isCameraPressed ? 'scale-90 bg-accent-primary/80' : 'hover:bg-accent-primary/90'}`}
                      title="לחיצה קצרה לתמונה, ארוכה לוידאו"
                    >
                      {uploadingStory ? <Loader2 size={24} className="animate-spin text-white" /> : <Camera size={24} />}
                    </button>
                  )}

                  <div className={`flex-1 backdrop-blur-3xl bg-white/5 border border-white/10 rounded-[28px] min-h-[54px] flex items-center px-2 pr-4 shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all ${editingPostId ? 'ring-2 ring-accent-primary border-transparent' : ''}`}>
                    <input
                      type="text" value={newPost} onChange={handleInputChange} onKeyDown={(e) => { if (e.key === 'Enter') handlePost(); }}
                      placeholder={editingPostId ? "ערוך הודעה..." : "הודעה למעגל..."} 
                      className="flex-1 bg-transparent border-none outline-none text-white text-[14px] font-medium placeholder:text-white/30 py-3"
                    />
                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                      {!editingPostId && (
                        <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 flex items-center justify-center rounded-full text-white/30 hover:text-white/70 transition-colors" title="צרף תמונה"><Paperclip size={18} /></button>
                      )}
                      {(newPost.trim() || selectedFile || editingPostId) && (
                        <button onClick={handlePost} disabled={posting} className="w-10 h-10 rounded-full bg-accent-primary text-white flex items-center justify-center active:scale-90 disabled:opacity-30 transition-all shadow-[0_0_15px_rgba(var(--color-accent-primary),0.4)]">
                          {posting ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={16} className="rtl:-scale-x-100 -ml-0.5" />}
                        </button>
                      )}
                    </div>
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
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-black/50 flex items-center justify-center border border-white/5">
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
    </motion.div>, 
    document.body
  ) : null;
};
