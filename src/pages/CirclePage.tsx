import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { Button } from '../components/ui';
import { VaultCard } from '../components/VaultCard';
import {
  Loader2, Lock, ShieldAlert, Flame, Diamond, Handshake,
  Send, X, Camera, Copy, Edit2, Trash2, Paperclip, ChevronLeft, Plus,
  Trophy, Target, Zap, Info, Activity, CheckCircle2, Crown, BarChart3
} from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const cleanToastStyle = {
  background: 'rgba(20, 20, 20, 0.85)',
  backdropFilter: 'blur(16px)',
  color: '#ffffff',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  borderRadius: '100px',
  fontSize: '14px',
  fontWeight: 700,
  padding: '12px 24px',
  boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
};

const SEAL_TYPES = [
  { id: 'fire', icon: <Flame size={14} />, label: 'אש', color: 'text-orange-500 bg-orange-500/10 border-orange-500/30', xp: 15 },
  { id: 'diamond', icon: <Diamond size={14} />, label: 'יהלום', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30', xp: 50 },
  { id: 'alliance', icon: <Handshake size={14} />, label: 'ברית', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30', xp: 100 },
];

const formatTime = (dateStr?: string | null) => {
  if (!dateStr) return '';
  try { return new Date(dateStr).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); } 
  catch { return ''; }
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
  const { user, profile: myProfile } = useAuth();
  const queryClient = useQueryClient();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'vaults' | 'members'>('chat');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fullScreenMedia, setFullScreenMedia] = useState<{ url: string; type: string } | null>(null);

  const [joining, setJoining] = useState(false);
  const [contributingDrop, setContributingDrop] = useState(false);
  const [dropAmount, setDropAmount] = useState<number | ''>(50);

  const [actionPost, setActionPost] = useState<any | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isStoryCaptureOpen, setIsStoryCaptureOpen] = useState(false);
  const [isRecordingStory, setIsRecordingStory] = useState(false);
  const [capturedStoryBlob, setCapturedStoryBlob] = useState<Blob | null>(null);
  const [capturedMediaType, setCapturedMediaType] = useState<'video' | 'image'>('video');
  const [uploadingStory, setUploadingStory] = useState(false);

  const [onlineCount, setOnlineCount] = useState(1);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  const storyVideoRef = useRef<HTMLVideoElement>(null);
  const storyStreamRef = useRef<MediaStream | null>(null);
  const storyRecorderRef = useRef<MediaRecorder | null>(null);
  const storyChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setPortalNode(document.getElementById('root') || document.body);
    setMounted(true);
    if (user?.id) setCurrentUserId(user.id);
  }, [user]);

  // מנוע טעינה חסין שגיאות לחלוטין (Two-step query למשתמשים)
  const { data: circleData, isLoading, refetch } = useQuery({
    queryKey: ['circle', slug, currentUserId],
    queryFn: async () => {
      // 1. חילוץ המועדון
      let circle = null;
      const { data: circleBySlug } = await supabase.from('circles').select('*').eq('slug', slug).maybeSingle();
      circle = circleBySlug;
      if (!circle) {
        const { data: circleById } = await supabase.from('circles').select('*').eq('id', slug).maybeSingle();
        circle = circleById;
      }
      if (!circle) throw new Error('מועדון לא נמצא');

      // 2. סטטוס חברות
      let membership = null;
      if (currentUserId && !currentUserId.startsWith('guest_')) {
        const { data: mem } = await supabase.from('circle_members').select('*').eq('circle_id', circle.id).eq('user_id', currentUserId).maybeSingle();
        membership = mem;
      }

      // 3. חילוץ פוסטים
      const { data: posts } = await supabase
        .from('posts')
        .select('*, profiles!user_id(*), post_seals(*)')
        .eq('circle_id', circle.id)
        .order('created_at', { ascending: false })
        .limit(60);

      // 4. חילוץ חברי הקהילה בשיטה בטוחה ב-100%
      const { data: membersData } = await supabase.from('circle_members').select('*').eq('circle_id', circle.id);
      const userIds = membersData?.map((m: any) => m.user_id) || [];
      
      let profilesData: any[] = [];
      if (userIds.length > 0) {
        const { data: pData } = await supabase.from('profiles').select('id, full_name, username, avatar_url, xp, role_label').in('id', userIds);
        profilesData = pData || [];
      }

      const membersList = (membersData || []).map((m: any) => {
        const profileData = profilesData.find((p: any) => p.id === m.user_id);
        return { ...m, profileData };
      }).sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (b.role === 'admin' && a.role !== 'admin') return 1;
        const axp = a.profileData?.xp || 0;
        const bxp = b.profileData?.xp || 0;
        return bxp - axp; // סידור לפי XP
      });

      // 5. כספות
      const { data: vaultData } = await supabase.from('vaults').select('*').eq('circle_id', circle.id).eq('is_active', true).order('created_at', { ascending: false });
      let unlockedIds: string[] = [];
      if (currentUserId && !currentUserId.startsWith('guest_')) {
        const { data: unlocks } = await supabase.from('vault_unlocks').select('vault_id').eq('user_id', currentUserId);
        unlockedIds = (unlocks || []).map((u: any) => u.vault_id);
      }
      const vaults = (vaultData || []).map((v: any) => ({ ...v, is_unlocked: unlockedIds.includes(v.id) || v.creator_id === currentUserId }));

      // 6. אוברביו לדשבורד
      let overview = { stories: [], drop: null, my_stats: null };
      try {
        const { data: rpcOverview } = await supabase.rpc('get_circle_overview', { p_circle_id: circle.id, p_user_id: currentUserId || null });
        if (rpcOverview) overview = rpcOverview;
      } catch (e) {}

      return {
        circle,
        isMember: !!membership,
        membership,
        posts: posts || [],
        membersList,
        vaults,
        overview
      };
    },
    enabled: !!slug && mounted,
    staleTime: 1000 * 60 * 2,
  });

  // סנכרון בזמן אמת מדויק כולל ספירת משתמשים מחוברים אמיתית
  useEffect(() => {
    if (!circleData?.circle?.id) return;
    const cid = circleData.circle.id;
    
    // מזהה ייחודי כדי שלא נספור את אותו משתמש פעמיים
    const presenceKey = currentUserId || `guest_${Math.random().toString(36).substr(2, 9)}`;

    const channel = supabase.channel(`circle_room_${cid}`, {
      config: { presence: { key: presenceKey } }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const uniqueUsers = Object.keys(state).length;
        setOnlineCount(Math.max(1, uniqueUsers));
        
        const typing = new Set<string>();
        for (const id in state) {
          for (const presence of state[id] as any[]) {
            if (presence?.isTyping && id !== currentUserId) typing.add(id);
          }
        }
        setTypingUsers(typing);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `circle_id=eq.${cid}` }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_seals' }, () => refetch())
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ isTyping: false, online_at: new Date().toISOString() });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [circleData?.circle?.id, currentUserId, refetch]);

  const sortedPosts = useMemo(() => {
    return [...(circleData?.posts || [])].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [circleData?.posts]);

  useEffect(() => {
    if (activeTab === 'chat' && messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [sortedPosts, activeTab]);

  const handleJoin = async (tier: 'INNER' | 'CORE') => {
    const uid = user?.id || currentUserId;
    if (!uid || uid.startsWith('guest_')) return toast.error('יש להתחבר תחילה כדי לבקש גישה', { style: cleanToastStyle });

    setJoining(true);
    triggerFeedback('pop');
    const tid = toast.loading('מעבד בקשה...', { style: cleanToastStyle });

    try {
      if (circleData?.isMember) {
        await apiFetch(`/api/circles/${circleData.circle.slug}/upgrade`, {
          method: 'POST',
          headers: { 'x-user-id': uid },
          body: JSON.stringify({ tier, user_id: uid }),
        });
        toast.success(`שודרגת בהצלחה ל-${tier}!`, { id: tid, style: cleanToastStyle });
      } else {
        const res = await apiFetch(`/api/circles/${circleData?.circle.slug}/join`, { 
          method: 'POST',
          headers: { 'x-user-id': uid }
        });
        
        if (res && res.joined === false) {
           toast.success('עזבת את הקהילה', { id: tid, style: cleanToastStyle });
        } else {
           toast.success('ברוך הבא למועדון!', { id: tid, style: cleanToastStyle });
        }
      }
      await refetch();
    } catch (err: any) {
      toast.error(err?.message || 'שגיאה בהצטרפות. ודא שיש לך מספיק קרדיטים בארנק.', { id: tid, style: cleanToastStyle });
    } finally {
      setJoining(false);
      triggerFeedback('success');
    }
  };

  const handlePost = async () => {
    if (!newPost.trim() && !selectedFile) return;
    if (!circleData?.circle?.id || !currentUserId || currentUserId.startsWith('guest_')) {
      return toast.error('יש להתחבר תחילה', { style: cleanToastStyle });
    }

    setPosting(true);
    triggerFeedback('pop');

    try {
      if (editingPostId) {
        await supabase.from('posts').update({ content: newPost.trim() }).eq('id', editingPostId);
        toast.success('הודעה עודכנה', { style: cleanToastStyle });
        setNewPost(''); setEditingPostId(null);
      } else {
        let media_url: string | null = null;
        let media_type = 'text';

        if (selectedFile) {
          const { data: uploadData, error } = await supabase.storage.from('feed_images').upload(`chat_${Date.now()}`, selectedFile);
          if (!error && uploadData) {
            media_url = supabase.storage.from('feed_images').getPublicUrl(uploadData.path).data.publicUrl;
            media_type = selectedFile.type.startsWith('video') ? 'video' : 'image';
          }
        }

        const { error } = await supabase.from('posts').insert({
          circle_id: circleData.circle.id,
          user_id: currentUserId,
          content: newPost.trim(),
          media_url,
          media_type,
          is_reveal_drop: false,
          reveal_status: 'revealed',
          required_crd: 0,
        });

        if (error) throw error;
        setNewPost(''); setSelectedFile(null);
      }
    } catch {
      toast.error('שגיאה בשליחה', { style: cleanToastStyle });
    } finally {
      setPosting(false);
    }
  };

  const handleContributeToDrop = async () => {
    if (!circleData?.overview?.drop?.id || !dropAmount || Number(dropAmount) <= 0) return;
    setContributingDrop(true);
    triggerFeedback('pop');

    try {
      const { error } = await supabase.rpc('circle_contribute_to_drop', {
        p_drop_id: circleData.overview.drop.id,
        p_user_id: currentUserId,
        p_amount: Number(dropAmount),
      });

      if (error) throw error;
      await refetch();
      setDropAmount(50);
      toast.success('התרומה התקבלה!', { style: cleanToastStyle });
    } catch {
      toast.error('שגיאה בתרומה', { style: cleanToastStyle });
    } finally {
      setContributingDrop(false);
    }
  };

  const handleSealToggle = async (postId: string, sealType: string, isRemoving: boolean) => {
    triggerFeedback('pop');
    try {
      if (isRemoving) {
        await supabase.from('post_seals').delete().match({ post_id: postId, user_id: currentUserId, seal_type: sealType });
      } else {
        await supabase.from('post_seals').insert({ post_id: postId, user_id: currentUserId, seal_type: sealType });
      }
    } catch {}
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      setSelectedFile(file);
      triggerFeedback('pop');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleMessageTouchStart = (e: React.TouchEvent | React.MouseEvent, post: any) => {
    let touchStartY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    pressTimerRef.current = setTimeout(() => { triggerFeedback('heavy'); setActionPost(post); }, 450);
  };
  const handleMessageTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
  };
  const handleMessageTouchEnd = () => { if (pressTimerRef.current) clearTimeout(pressTimerRef.current); };
  
  const handleCopyText = () => { if (actionPost?.content) { navigator.clipboard.writeText(actionPost.content); toast.success('הועתק ללוח', { style: cleanToastStyle }); } setActionPost(null); };
  
  const handleDeletePost = async () => {
    if (!actionPost) return;
    try {
      await supabase.from('posts').delete().eq('id', actionPost.id);
      toast.success('הודעה נמחקה', { style: cleanToastStyle });
      refetch();
    } catch { toast.error('שגיאה במחיקה', { style: cleanToastStyle }); } finally { setActionPost(null); }
  };
  
  const handleEditPost = () => { if (!actionPost) return; setNewPost(actionPost.content || ''); setEditingPostId(actionPost.id); setActionPost(null); };

  const cleanupStoryCapture = () => {
    if (storyStreamRef.current) {
      storyStreamRef.current.getTracks().forEach((track) => track.stop());
      storyStreamRef.current = null;
    }
    if (storyRecorderRef.current && storyRecorderRef.current.state !== 'inactive') {
      try { storyRecorderRef.current.stop(); } catch {}
    }
    storyRecorderRef.current = null;
    storyChunksRef.current = [];
    setIsRecordingStory(false);
  };

  const openSelfieCamera = async () => {
    if (!currentUserId || currentUserId.startsWith('guest_')) return toast.error('יש להתחבר תחילה', { style: cleanToastStyle });
    try {
      setCapturedStoryBlob(null);
      setCapturedMediaType('image');
      setIsStoryCaptureOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
      storyStreamRef.current = stream;
      if (storyVideoRef.current) {
        storyVideoRef.current.srcObject = stream;
        try { await storyVideoRef.current.play(); } catch {}
      }
    } catch {
      cleanupStoryCapture();
      setIsStoryCaptureOpen(false);
      toast.error('אין גישה למצלמה', { style: cleanToastStyle });
    }
  };

  const openQuickStoryCapture = async () => {
    if (!currentUserId || currentUserId.startsWith('guest_')) return toast.error('יש להתחבר תחילה', { style: cleanToastStyle });
    try {
      setCapturedStoryBlob(null);
      setCapturedMediaType('video');
      setIsStoryCaptureOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true });
      storyStreamRef.current = stream;
      if (storyVideoRef.current) {
        storyVideoRef.current.srcObject = stream;
        try { await storyVideoRef.current.play(); } catch {}
      }
      storyChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      storyRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) storyChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(storyChunksRef.current, { type: 'video/webm' });
        setCapturedStoryBlob(blob);
        setCapturedMediaType('video');
        setIsRecordingStory(false);
        cleanupStoryCapture();
      };
      recorder.start();
      setIsRecordingStory(true);
      triggerFeedback('heavy');
    } catch {
      cleanupStoryCapture();
      setIsStoryCaptureOpen(false);
      toast.error('אין גישה למצלמה או מיקרופון', { style: cleanToastStyle });
    }
  };

  const startStoryLongPress = () => {
    if (storyHoldTimerRef.current) clearTimeout(storyHoldTimerRef.current);
    storyHoldTimerRef.current = setTimeout(async () => {
      await openQuickStoryCapture();
    }, 260);
  };

  const endStoryLongPress = () => {
    if (storyHoldTimerRef.current) { clearTimeout(storyHoldTimerRef.current); storyHoldTimerRef.current = null; }
    if (storyRecorderRef.current && storyRecorderRef.current.state === 'recording') { try { storyRecorderRef.current.stop(); } catch {} }
  };

  const uploadCapturedStory = async () => {
    if (!capturedStoryBlob || !circleData?.circle?.id || !currentUserId || currentUserId.startsWith('guest_')) return toast.error('שגיאה בגישה למשתמש', { style: cleanToastStyle });
    setUploadingStory(true);
    triggerFeedback('pop');
    
    setIsStoryCaptureOpen(false);
    try {
      const file = new File([capturedStoryBlob], `story_${Date.now()}.${capturedMediaType === 'video' ? 'webm' : 'jpg'}`, { type: capturedMediaType === 'video' ? 'video/webm' : 'image/jpeg' });
      const { data: uploadData, error } = await supabase.storage.from('feed_images').upload(file.name, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('feed_images').getPublicUrl(uploadData.path);
      const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 24);
      await supabase.from('circle_stories').insert({ circle_id: circleData.circle.id, user_id: currentUserId, media_url: publicUrl, media_type: capturedMediaType, expires_at: expiresAt.toISOString() });
      toast.success('הסטורי עלה ל־24 שעות', { style: cleanToastStyle });
      setCapturedStoryBlob(null);
      await refetch();
    } catch {
      toast.error('שגיאה בהעלאת הסטורי', { style: cleanToastStyle });
    } finally { setUploadingStory(false); }
  };

  if (!mounted || !portalNode) return null;

  if (isLoading || !circleData) {
    return createPortal(
      <div className="fixed inset-0 z-[90000] bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-accent-primary" size={32} />
      </div>,
      portalNode
    );
  }

  const { circle, isMember, membership, membersList, vaults, overview } = circleData;
  const isOwner = circle.creator_id === currentUserId || membership?.role === 'admin';
  const myStats = overview?.my_stats || null;
  const myLevel = myStats?.level || 1;
  const myXP = myStats?.xp || 0;
  const xpToNext = myLevel * 100;
  const xpProgress = Math.min(100, Math.round((myXP / xpToNext) * 100));

  const topContributors = membersList.filter((m: any) => m.profileData).slice(0, 3);
  
  const todayDateStr = new Date().toDateString();
  const hasPostedToday = sortedPosts.some(p => p.user_id === currentUserId && new Date(p.created_at).toDateString() === todayDateStr);
  
  const recentPostsCount = sortedPosts.filter(p => (Date.now() - new Date(p.created_at).getTime()) < 1000 * 60 * 60 * 24).length;
  const vibeScore = Math.min(100, Math.floor((recentPostsCount * 2) + (onlineCount * 5)));

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90000] bg-[#050505] font-sans flex flex-col overflow-hidden text-white" dir="rtl">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />

      <AnimatePresence>
        {fullScreenMedia && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999999] bg-black flex items-center justify-center" onClick={() => setFullScreenMedia(null)}>
            {fullScreenMedia.type === 'video' ? <video src={fullScreenMedia.url} controls autoPlay className="w-full h-full object-contain" onClick={(e) => e.stopPropagation()} /> : <img src={fullScreenMedia.url} className="w-full h-full object-contain" onClick={(e) => e.stopPropagation()} />}
            <button onClick={() => setFullScreenMedia(null)} className="absolute top-[calc(env(safe-area-inset-top)+16px)] left-4 p-3 text-white/70 hover:text-white transition-all active:scale-90 z-50 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"><X size={28} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {actionPost && (
          <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" dir="rtl">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActionPost(null)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="relative bg-[#111] rounded-t-[32px] p-6 pb-[calc(env(safe-area-inset-bottom)+32px)] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-[10000000]">
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
                {actionPost.content && <button onClick={handleCopyText} className="flex items-center gap-4 p-4 rounded-[20px] bg-white/5 hover:bg-white/10 text-white font-black text-[14px] transition-colors active:scale-95"><Copy size={20} className="text-white/50" /> העתק טקסט</button>}
                {actionPost.user_id === currentUserId && <button onClick={handleEditPost} className="flex items-center gap-4 p-4 rounded-[20px] bg-white/5 hover:bg-white/10 text-white font-black text-[14px] transition-colors active:scale-95"><Edit2 size={20} className="text-white/50" /> ערוך הודעה</button>}
                {(actionPost.user_id === currentUserId || isOwner) && <button onClick={handleDeletePost} className="flex items-center gap-4 p-4 rounded-[20px] bg-red-500/10 hover:bg-red-500/20 text-red-500 font-black text-[14px] transition-colors active:scale-95 border border-red-500/10"><Trash2 size={20} /> מחק הודעה</button>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isStoryCaptureOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999999999] bg-black">
            {!capturedStoryBlob ? (
              <div className="w-full h-full relative">
                <video ref={storyVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                <div className="absolute inset-x-0 top-0 p-6 pt-[calc(env(safe-area-inset-top)+18px)] flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
                  <button onClick={() => { cleanupStoryCapture(); setIsStoryCaptureOpen(false); }} className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white active:scale-90 transition-all"><X size={22} /></button>
                  {isRecordingStory && <div className="px-4 py-2 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-[12px] font-black tracking-widest flex items-center gap-2 animate-pulse"><span className="w-2 h-2 rounded-full bg-red-500" /> מקליט עכשיו</div>}
                </div>
                <div className="absolute inset-x-0 bottom-0 pb-[calc(env(safe-area-inset-bottom)+28px)] px-6 flex justify-center">
                  {isRecordingStory ? (
                    <div className="text-center text-white/80 text-[13px] font-black tracking-wide bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">שחרר את הלחיצה כדי לעצור</div>
                  ) : (
                    <button onClick={() => { triggerFeedback('pop'); if (storyVideoRef.current) { const canvas = document.createElement('canvas'); canvas.width = storyVideoRef.current.videoWidth; canvas.height = storyVideoRef.current.videoHeight; canvas.getContext('2d')?.drawImage(storyVideoRef.current, 0, 0); canvas.toBlob((b) => { if (b) { setCapturedStoryBlob(b); setCapturedMediaType('image'); } }, 'image/jpeg', 0.9); } }} className="w-20 h-20 rounded-full border-4 border-white bg-white/20 flex items-center justify-center active:scale-95 transition-transform">
                      <div className="w-16 h-16 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full h-full bg-black flex flex-col">
                <div className="flex-1 relative">
                  {capturedMediaType === 'video' ? <video src={URL.createObjectURL(capturedStoryBlob)} autoPlay loop controls playsInline className="w-full h-full object-cover scale-x-[-1]" /> : <img src={URL.createObjectURL(capturedStoryBlob)} className="w-full h-full object-cover scale-x-[-1]" />}
                  <div className="absolute top-0 left-0 right-0 p-6 pt-[calc(env(safe-area-inset-top)+18px)] bg-gradient-to-b from-black/70 to-transparent">
                    <div className="text-center text-white font-black text-[18px]">להעלות את זה לסטורי?</div>
                  </div>
                </div>
                <div className="p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] flex gap-3 bg-[#050505]">
                  <button onClick={() => { setCapturedStoryBlob(null); setIsStoryCaptureOpen(false); cleanupStoryCapture(); }} className="flex-1 h-14 rounded-full bg-white/10 text-white font-black active:scale-95 transition-all">לא</button>
                  <button onClick={uploadCapturedStory} disabled={uploadingStory} className="flex-1 h-14 rounded-full bg-accent-primary text-white font-black active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(var(--color-accent-primary),0.4)]">
                    {uploadingStory ? <Loader2 size={18} className="animate-spin" /> : <><Send size={18} className="rtl:-scale-x-100" /> העלה לסטורי</>}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={() => navigate(-1)} className="absolute top-[calc(env(safe-area-inset-top)+16px)] right-4 p-2 text-white/80 hover:text-white z-50 transition-all active:scale-90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"><ChevronLeft size={32} className="rtl:rotate-180" /></button>

      <div className="absolute top-0 left-0 right-0 h-[40vh] pointer-events-none z-0">
        {circle.cover_url && <img src={circle.cover_url} className="w-full h-full object-cover opacity-30 mix-blend-luminosity" />}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/40 via-[#050505]/80 to-[#050505]" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-accent-primary/20 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-20 pt-[calc(env(safe-area-inset-top)+20px)] px-6 flex flex-col items-center text-center shrink-0">
        <h1 className="text-3xl font-black text-white tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] mb-1">{circle.name}</h1>
        <p className="text-white/50 text-[12px] font-medium tracking-wide max-w-[280px] leading-relaxed">{circle.description || 'מרחב פרימיום לחברי המועדון'}</p>
        {isMember && (
          <div className="flex items-center gap-4 mt-4">
            <span className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-accent-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(var(--color-accent-primary),0.8)]" /> {onlineCount} מחוברים</span>
            <span className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase">{membersList.length} חברים</span>
          </div>
        )}
      </div>

      {!isMember ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
          <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-2xl mb-8 relative"><Lock size={32} className="text-white/40" /></div>
          <Button onClick={() => handleJoin('INNER')} disabled={joining} className="w-full max-w-[300px] h-14 bg-white/10 backdrop-blur-md border border-white/20 text-white font-black rounded-[20px] uppercase tracking-widest text-[13px] hover:bg-white/20 transition-all shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
            בקשת גישה ({circle.join_price || 0} CRD)
          </Button>
        </div>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden relative z-10 mt-6">
          <div className="flex items-center justify-center gap-8 px-6 mb-6 shrink-0 relative z-20">
            {[{ id: 'chat', label: 'לייב' }, { id: 'overview', label: 'דשבורד' }, { id: 'vaults', label: 'כספות' }, { id: 'members', label: 'קהילה' }].map((t) => {
              const isActive = activeTab === t.id;
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`relative text-[12px] font-black uppercase tracking-widest transition-colors flex flex-col items-center pb-2.5 ${isActive ? 'text-white' : 'text-white/30 hover:text-white/60'}`}>
                  {t.label}
                  {isActive && <motion.div layoutId="nav-indicator" className="absolute bottom-0 w-8 h-0.5 bg-accent-primary rounded-full shadow-[0_0_8px_rgba(var(--color-accent-primary),0.6)]" />}
                </button>
              );
            })}
          </div>

          {activeTab === 'overview' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 overflow-y-auto px-5 pb-[120px] flex flex-col gap-4 scrollbar-hide">
              
              {isOwner && (
                 <div className="bg-accent-primary/10 border border-accent-primary/30 rounded-[32px] p-6 shadow-sm flex items-center justify-between">
                   <div className="flex flex-col">
                     <span className="text-accent-primary text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 mb-1"><BarChart3 size={14} /> נתוני מנהל הקהילה</span>
                     <span className="text-white font-black text-xl">{circle.members_count || membersList.length} משתמשים</span>
                     <span className="text-white/60 text-[11px] font-bold mt-1">הכנסות פוטנציאליות: {((circle.join_price || 0) * membersList.length).toLocaleString()} CRD</span>
                   </div>
                 </div>
              )}

              <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/5 rounded-[32px] p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent-primary/10 blur-[50px] pointer-events-none" />
                <span className="text-[10px] font-black text-white/30 tracking-[0.2em] uppercase mb-1 block">הסטטוס שלך</span>
                <div className="flex items-end justify-between">
                  <div><h2 className="text-3xl font-black text-white tracking-tight">{getLevelName(myLevel)}</h2><span className="text-[12px] font-black text-accent-primary tracking-widest mt-1 block">LEVEL {myLevel}</span></div>
                  <div className="text-right"><span className="text-[10px] font-black text-white/50 tracking-widest uppercase">XP עד לרמה הבאה</span><div className="text-[16px] font-black text-white">{myXP} / <span className="text-white/30">{xpToNext}</span></div></div>
                </div>
                <div className="w-full h-1 bg-white/5 rounded-full mt-4 overflow-hidden"><div className="h-full bg-accent-primary rounded-full shadow-[0_0_10px_rgba(var(--color-accent-primary),0.8)]" style={{ width: `${xpProgress}%` }} /></div>
              </div>

              {/* Vibe Meter */}
              <div className="bg-[#1a1a1e] border border-white/5 rounded-[32px] p-6 shadow-sm">
                 <div className="flex items-center justify-between mb-3">
                   <span className="text-[11px] font-black text-[#8b8b93] tracking-[0.2em] uppercase flex items-center gap-1.5">
                     <Activity size={14} className="text-blue-400" /> מדד האנרגיה בקהילה
                   </span>
                   <span className="text-blue-400 font-black text-[12px]">{vibeScore}%</span>
                 </div>
                 <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${vibeScore}%` }} transition={{ duration: 1, ease: 'easeOut' }} className="h-full bg-gradient-to-l from-blue-400 to-indigo-500 rounded-full" />
                 </div>
              </div>

              {/* Daily Target */}
              <div className="bg-[#1a1a1e] border border-white/5 rounded-[32px] p-5 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-[18px] bg-accent-primary/10 flex items-center justify-center border border-accent-primary/20">
                    {hasPostedToday ? <CheckCircle2 size={20} className="text-emerald-400" /> : <Target size={20} className="text-accent-primary" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white font-black text-[14px]">משימת היום</span>
                    <span className="text-[#8b8b93] text-[11px] font-bold">שלח לפחות הודעה אחת לקהילה</span>
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase ${hasPostedToday ? 'bg-emerald-400/20 text-emerald-400 border border-emerald-400/30' : 'bg-white/5 text-[#8b8b93]'}`}>
                  {hasPostedToday ? '1/1' : '0/1'}
                </div>
              </div>

              {overview.drop && (
                <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/5 rounded-[32px] p-6">
                  <span className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase mb-1 block">דרופ קהילתי חם</span>
                  <h3 className="text-xl font-black text-white mb-4">{overview.drop.title}</h3>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-[24px] font-black text-accent-primary leading-none">{overview.drop.current_crd || 0}</span>
                    <span className="text-[10px] font-black text-white/40 tracking-widest uppercase">מתוך {overview.drop.target_crd || 0}</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-5"><div className="h-full bg-accent-primary rounded-full" style={{ width: `${Math.min(100, Math.round(((overview.drop.current_crd || 0) / Math.max(1, overview.drop.target_crd || 1)) * 100))}%` }} /></div>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full p-1.5 pl-4">
                    <button onClick={handleContributeToDrop} disabled={contributingDrop || !dropAmount} className="h-10 px-6 bg-white text-black font-black text-[12px] uppercase tracking-widest rounded-full active:scale-95 transition-transform disabled:opacity-50">{contributingDrop ? '...' : 'תרום CRD'}</button>
                    <input type="number" value={dropAmount} onChange={(e) => setDropAmount(Number(e.target.value))} className="flex-1 bg-transparent border-none outline-none text-white font-black text-left text-[16px]" placeholder="50" dir="ltr" />
                  </div>
                </div>
              )}

              {/* Top Contributors */}
              {topContributors.length > 0 && (
                <div className="bg-[#1a1a1e] border border-white/5 rounded-[32px] p-6 shadow-sm flex flex-col gap-4">
                  <span className="text-[10px] font-black text-[#8b8b93] tracking-[0.2em] uppercase flex items-center gap-2">
                    <Trophy size={14} className="text-yellow-400" /> מובילי הקהילה
                  </span>
                  <div className="flex flex-col gap-3">
                    {topContributors.map((m: any, idx: number) => (
                      <div key={m.user_id} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5 cursor-pointer active:scale-95 transition-transform" onClick={() => navigate(`/profile/${m.user_id}`)}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center overflow-hidden border border-white/10">
                             {m.profileData?.avatar_url ? <img src={m.profileData.avatar_url} className="w-full h-full object-cover" /> : <span className="text-white/40 font-black text-xs">{(m.profileData?.full_name || 'א')[0]}</span>}
                          </div>
                          <span className="text-white font-black text-[13px]">{m.profileData?.full_name || 'משתמש'}</span>
                        </div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${idx === 0 ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/30' : idx === 1 ? 'bg-slate-300/20 text-slate-300 border border-slate-300/30' : 'bg-amber-600/20 text-amber-500 border border-amber-600/30'}`}>
                          #{idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Space Rules */}
              <div className="bg-white/5 border border-white/5 rounded-[32px] p-6 shadow-sm">
                 <span className="text-[10px] font-black text-[#8b8b93] tracking-[0.2em] uppercase flex items-center gap-2 mb-3">
                    <Info size={14} className="text-blue-400" /> חוקי המרחב
                  </span>
                  <ul className="text-[12px] text-white/70 font-medium space-y-2 list-disc list-inside">
                    <li>אין להוציא מידע או צילומי מסך מהמועדון.</li>
                    <li>שמרו על שיח מכבד ורמה גבוהה.</li>
                    <li>תוכן פרסומי דורש אישור מנהל מראש.</li>
                  </ul>
              </div>

            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 relative flex flex-col overflow-hidden">
              <div ref={messagesRef} className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-2 pb-[120px]">
                <div className="flex flex-col gap-6 min-h-full justify-end pb-4">
                  {sortedPosts.length === 0 ? (
                    <div className="text-center py-20 flex flex-col items-center justify-center h-full"><span className="text-white/20 font-black text-[12px] tracking-[0.3em] uppercase">שקט כאן.</span></div>
                  ) : (
                    sortedPosts.map((post: any) => (
                      <div key={post.id} className={`flex flex-col gap-1 w-full select-none ${post.user_id === currentUserId ? 'items-end' : 'items-start'}`}>
                        {post.user_id !== currentUserId && !post.media_url && (
                          <div className="flex items-center gap-2 pl-2 mb-1 cursor-pointer active:opacity-70 transition-opacity" onClick={() => navigate(`/profile/${post.user_id}`)}>
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 shrink-0 border border-white/10 shadow-sm">
                              {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/40 font-black text-[10px]">{(post.profiles?.full_name || 'א')[0]}</div>}
                            </div>
                            <span className="text-white/60 text-[12px] font-black tracking-widest">{post.profiles?.full_name}</span>
                          </div>
                        )}
                        <div className={`relative flex flex-col max-w-[85%] rounded-[24px] ${post.user_id === currentUserId ? 'rounded-br-sm' : 'rounded-bl-sm'} overflow-hidden shadow-sm ${!post.media_url ? post.user_id === currentUserId ? 'bg-accent-primary/20 border border-accent-primary/30 text-white' : 'bg-white/5 border border-white/5 text-white/90' : 'bg-black/20'}`} onTouchStart={(e) => handleMessageTouchStart(e, post)} onTouchMove={handleMessageTouchMove} onTouchEnd={handleMessageTouchEnd} onMouseDown={(e) => handleMessageTouchStart(e, post)} onMouseMove={handleMessageTouchMove} onMouseUp={handleMessageTouchEnd}>
                          {post.media_url ? (
                            <div className="relative w-full group min-w-[200px] cursor-pointer" onClick={() => setFullScreenMedia({ url: post.media_url, type: post.media_type })}>
                              {post.media_type === 'video' ? <video src={post.media_url} autoPlay muted loop playsInline className="w-full h-auto max-h-[350px] object-cover" /> : <img src={post.media_url} className="w-full h-auto max-h-[350px] object-cover" loading="lazy" />}
                              {(post.content || post.user_id !== currentUserId) && (
                                <>
                                  {post.user_id !== currentUserId && <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />}
                                  {post.content && <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />}
                                </>
                              )}
                              {post.user_id !== currentUserId && <span className="absolute top-3 left-4 text-white/90 text-[12px] font-black tracking-widest drop-shadow-md z-10 pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${post.user_id}`); }}>{post.profiles?.full_name || 'אנונימי'}</span>}
                              {post.content && <div className="absolute bottom-3 left-4 right-4 z-10 pointer-events-none"><span className="text-white text-[14px] leading-relaxed font-medium whitespace-pre-wrap break-words drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{post.content}</span></div>}
                            </div>
                          ) : (
                            <div className="px-4 py-3"><span className="text-[14px] leading-relaxed font-medium whitespace-pre-wrap break-words">{post.content}</span></div>
                          )}
                        </div>
                        <div className={`flex items-center gap-1.5 px-2 mt-0.5 w-full ${post.user_id === currentUserId ? 'justify-end' : 'justify-start'}`}>
                          {SEAL_TYPES.map((sealDef) => {
                            const sealsOfType = post.post_seals?.filter((s: any) => s.seal_type === sealDef.id) || [];
                            const count = sealsOfType.length;
                            const hasSealed = sealsOfType.some((s: any) => s.user_id === currentUserId);
                            return (
                              <button key={sealDef.id} onClick={() => handleSealToggle(post.id, sealDef.id, hasSealed)} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black border transition-all active:scale-95 ${count > 0 ? hasSealed ? sealDef.color : 'text-white/60 bg-white/5 border-white/10' : 'bg-white/5 border-white/5 text-white/30 hover:text-white/60'}`} title={sealDef.label}>
                                {sealDef.icon}{count > 0 && <span>{count}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
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
                  <div className={`flex-1 backdrop-blur-3xl bg-white/5 border border-white/10 rounded-[28px] min-h-[54px] flex items-center px-2 pr-4 shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all ${editingPostId ? 'ring-2 ring-accent-primary border-transparent' : ''}`}>
                    <input type="text" value={newPost} onChange={(e) => setNewPost(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handlePost(); }} placeholder={editingPostId ? 'ערוך הודעה...' : 'הודעה למעגל...'} className="flex-1 bg-transparent border-none outline-none text-white text-[14px] font-medium placeholder:text-white/30 py-3" />
                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                      {!editingPostId && <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 flex items-center justify-center rounded-full text-white/30 hover:text-white/70 transition-colors" title="צרף תמונה"><Paperclip size={18} /></button>}
                      {(newPost.trim() || selectedFile || editingPostId) && (
                        <button onClick={handlePost} disabled={posting} className="w-10 h-10 rounded-full bg-accent-primary text-white flex items-center justify-center active:scale-90 disabled:opacity-30 transition-all shadow-[0_0_15px_rgba(var(--color-accent-primary),0.5)]">
                          {posting ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={16} className="rtl:-scale-x-100 -ml-0.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'vaults' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto pb-[120px] scrollbar-hide">
              {isLoading ? <div className="flex items-center justify-center py-10"><Loader2 className="animate-spin text-accent-primary" size={24} /></div> : vaults.map((v: any) => <VaultCard key={v.id} vault={v} onUnlockSuccess={refetch} />)}
            </motion.div>
          )}

          {activeTab === 'members' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 p-5 flex flex-col gap-3 overflow-y-auto pb-[120px] scrollbar-hide">
              {membersList.map((m: any) => (
                <div key={m.user_id} onClick={() => navigate(`/profile/${m.user_id}`)} className="flex items-center gap-4 bg-white/5 border border-white/5 p-4 rounded-[24px] cursor-pointer active:scale-95 transition-all">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-black/50 flex items-center justify-center border border-white/5">
                    {m.profileData?.avatar_url ? <img src={m.profileData.avatar_url} className="w-full h-full object-cover" /> : <span className="text-white/40 font-black text-[14px]">{(m.profileData?.full_name || 'א')[0]}</span>}
                  </div>
                  <div className="flex flex-col text-right flex-1">
                    <span className="text-white font-black text-[14px] flex items-center gap-1.5">{m.profileData?.full_name || 'משתמש'}{m.role === 'admin' && <ShieldAlert size={14} className="text-accent-primary" />}</span>
                    <span className="text-white/30 text-[10px] font-bold tracking-widest mt-0.5 uppercase">{m.tier || 'MEMBER'}</span>
                  </div>
                  <ChevronLeft size={16} className="text-white/20 rtl:rotate-180" />
                </div>
              ))}
            </motion.div>
          )}
        </div>
      )}
    </motion.div>,
    portalNode
  );
};
