import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { Button } from '../components/ui';
import { VaultCard } from '../components/VaultCard';
import {
  Loader2, Lock, ShieldAlert, Flame, Diamond, Handshake,
  Plus, Send, X, Camera, Copy, Edit2, Trash2, Paperclip, ChevronLeft
} from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const SEAL_TYPES = [
  { id: 'fire', icon: <Flame size={14} />, label: 'אש', color: 'text-orange-500 bg-orange-500/10 border-orange-500/30', xp: 15 },
  { id: 'diamond', icon: <Diamond size={14} />, label: 'יהלום', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30', xp: 50 },
  { id: 'alliance', icon: <Handshake size={14} />, label: 'ברית', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30', xp: 100 }
];

const formatTime = (dateStr?: string | null) => {
  if (!dateStr) return '';
  try { return new Date(dateStr).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
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

  const [overview, setOverview] = useState<any>({});

  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [onlineCount, setOnlineCount] = useState(1);

  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fullScreenMedia, setFullScreenMedia] = useState<{url: string, type: string} | null>(null);

  const [uploadingStory, setUploadingStory] = useState(false);
  const [joining, setJoining] = useState(false);
  const [contributingDrop, setContributingDrop] = useState(false);
  const [dropAmount, setDropAmount] = useState<number | ''>(50);

  // בוטום שיט (לחיצה ארוכה)
  const [actionPost, setActionPost] = useState<any | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // מצלמה פנימית
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [capturedStoryBlob, setCapturedStoryBlob] = useState<Blob | null>(null);
  const [capturedMediaType, setCapturedMediaType] = useState<'image' | 'video'>('image');
  const videoFeedRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const recordPressTimer = useRef<NodeJS.Timeout | null>(null);

  const sortedPosts = useMemo(() => {
    return [...(data?.posts || [])].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [data?.posts]);

  useEffect(() => { setMounted(true); }, []);

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
        for (const id in state) count += state[id].length;
        setOnlineCount(Math.max(1, count));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, async () => { await fetchCircleData(uid, true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'circle_stories' }, async () => { await fetchOverview(uid, true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_seals' }, async () => { await fetchCircleData(uid, true); })
      .subscribe();
    };

    initCircle();
    return () => { if (ch) supabase.removeChannel(ch); };
  }, [slug]);

  const fetchCircleData = async (uid: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: cData } = await supabase.from('circles').select('*').or(`slug.eq.${slug},id.eq.${slug}`).maybeSingle();
      if (!cData) throw new Error('Not found');

      let isMember = false;
      let membership = null;
      if (uid && !uid.startsWith('guest_')) {
        const { data: mData } = await supabase.from('circle_members').select('*').eq('circle_id', cData.id).eq('user_id', uid).maybeSingle();
        if (mData) { isMember = true; membership = mData; }
      }

      const { data: posts } = await supabase.from('posts').select('*, profiles!user_id(*), post_seals(*)').eq('circle_id', cData.id).order('created_at', { ascending: false }).limit(60);
      const { data: membersData } = await supabase.from('circle_members').select('role, created_at, tier, profiles(*)').eq('circle_id', cData.id);

      setData({ circle: cData, isMember, membership, posts: posts || [] });
      if (membersData) setMembersList(membersData.sort((a, b) => a.role === 'admin' ? -1 : 1));
    } catch { navigate('/'); } finally { if (!silent) setLoading(false); }
  };

  const fetchOverview = async (uid: string, silent = false) => {
    try {
      if (!data?.circle?.id) return;
      const { data: oData } = await supabase.rpc('get_circle_overview', { p_circle_id: data.circle.id, p_user_id: uid && !uid.startsWith('guest_') ? uid : null });
      if (oData) setOverview(oData);
    } catch {}
  };

  const fetchVaults = async () => {
    if (!data?.circle?.id) return;
    const { data: vData } = await supabase.from('vaults').select('*').eq('circle_id', data.circle.id).eq('is_active', true).order('created_at', { ascending: false });
    const { data: unlocks } = await supabase.from('vault_unlocks').select('vault_id').eq('user_id', currentUserId);
    const unlockedIds = (unlocks || []).map((u: any) => u.vault_id);
    setVaults((vData || []).map((v: any) => ({ ...v, is_unlocked: unlockedIds.includes(v.id) || v.creator_id === currentUserId })));
  };

  useEffect(() => { if (activeTab === 'vaults' && data?.circle?.id) fetchVaults(); }, [activeTab, data?.circle?.id]);

  const handleJoin = async (tier: 'INNER' | 'CORE') => {
    if (!currentUserId || currentUserId.startsWith('guest_')) return toast.error('יש להתחבר תחילה');
    setJoining(true); triggerFeedback('pop');
    try {
      if (data.isMember) {
        await apiFetch(`/api/circles/${data.circle.slug}/upgrade`, { method: 'POST', body: JSON.stringify({ tier }) });
      } else {
        await apiFetch(`/api/circles/${data.circle.slug}/join`, { method: 'POST' });
      }
      await fetchCircleData(currentUserId);
      await fetchOverview(currentUserId);
      toast.success('הצטרפת בהצלחה!');
    } catch (err: any) { toast.error(err?.message || 'שגיאה'); } finally { setJoining(false); }
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

      await supabase.from('circle_stories').insert({ circle_id: data.circle.id, user_id: currentUserId, media_url: publicUrl, media_type: mediaType, expires_at: expiresAt.toISOString() });
      await supabase.rpc('add_circle_xp', { p_circle_id: data.circle.id, p_user_id: currentUserId, p_amount: 20, p_reason: 'story_upload' });

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

  // מנגנון מצלמה פנימית
  const openCamera = async () => {
    setIsCameraOpen(true); setCapturedStoryBlob(null); triggerFeedback('pop');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
      streamRef.current = stream;
      if (videoFeedRef.current) videoFeedRef.current.srcObject = stream;
    } catch (e) {
      toast.error('אין גישה למצלמה'); setIsCameraOpen(false);
    }
  };

  const closeCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setIsCameraOpen(false); setCapturedStoryBlob(null); setIsRecording(false);
  };

  const handleCameraDown = () => {
    recordPressTimer.current = setTimeout(() => {
      setIsRecording(true); triggerFeedback('heavy');
      videoChunksRef.current = [];
      try {
        const recorder = new MediaRecorder(streamRef.current!);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => { if (e.data.size > 0) videoChunksRef.current.push(e.data); };
        recorder.onstop = () => {
          setCapturedStoryBlob(new Blob(videoChunksRef.current, { type: 'video/webm' }));
          setCapturedMediaType('video');
        };
        recorder.start();
      } catch (e) { toast.error('וידאו לא נתמך'); setIsRecording(false); }
    }, 500);
  };

  const handleCameraUp = () => {
    if (recordPressTimer.current) clearTimeout(recordPressTimer.current);
    if (isRecording) {
      mediaRecorderRef.current?.stop(); setIsRecording(false);
    } else {
      triggerFeedback('pop');
      if (videoFeedRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = videoFeedRef.current.videoWidth; canvas.height = videoFeedRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoFeedRef.current, 0, 0);
          canvas.toBlob((blob) => { if (blob) { setCapturedStoryBlob(blob); setCapturedMediaType('image'); } }, 'image/jpeg', 0.9);
        }
      }
    }
  };

  const uploadCapturedStory = async () => {
    if (!capturedStoryBlob) return;
    setUploadingStory(true); triggerFeedback('pop');
    
    const tempStory = { id: `temp-${Date.now()}`, media_url: URL.createObjectURL(capturedStoryBlob), media_type: capturedMediaType, full_name: myProfile?.full_name || 'אני' };
    setOverview(prev => ({ ...prev, stories: [tempStory, ...(prev.stories || [])] }));
    closeCamera();

    try {
      const file = new File([capturedStoryBlob], `story_${Date.now()}.${capturedMediaType === 'video' ? 'webm' : 'jpg'}`, { type: capturedMediaType === 'video' ? 'video/webm' : 'image/jpeg' });
      const { data: uploadData, error } = await supabase.storage.from('feed_images').upload(file.name, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('feed_images').getPublicUrl(uploadData.path);
      
      const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 24);
      await supabase.from('circle_stories').insert({ circle_id: data.circle.id, user_id: currentUserId, media_url: publicUrl, media_type: capturedMediaType, expires_at: expiresAt.toISOString() });
      toast.success('עלה לסטורי!');
    } catch { toast.error('שגיאה בהעלאה'); } finally { setUploadingStory(false); }
  };

  // פונקציית הקלדה שתוקנה והוחזרה
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPost(e.target.value);
    if (channelRef.current) channelRef.current.track({ isTyping: e.target.value.length > 0 });
  };

  const handlePost = async () => {
    if (!newPost.trim() && !selectedFile) return;
    triggerFeedback('pop');

    if (editingPostId) {
      setData((curr: any) => ({ ...curr, posts: curr.posts.map((p:any) => p.id === editingPostId ? { ...p, content: newPost.trim() } : p) }));
      await supabase.from('posts').update({ content: newPost.trim() }).eq('id', editingPostId);
      setNewPost(''); setEditingPostId(null);
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const tempPost = {
      id: tempId, user_id: currentUserId, content: newPost.trim(),
      media_url: selectedFile ? URL.createObjectURL(selectedFile) : null,
      media_type: selectedFile?.type.startsWith('video') ? 'video' : 'image',
      created_at: new Date().toISOString(), profiles: myProfile, post_seals: []
    };

    setData((curr: any) => ({ ...curr, posts: [...(curr.posts || []), tempPost] }));
    const contentToSend = newPost.trim(); const fileToSend = selectedFile;
    setNewPost(''); setSelectedFile(null);

    try {
      let media_url = null; let media_type = 'text';
      if (fileToSend) {
        const { data: uploadData } = await supabase.storage.from('feed_images').upload(`chat_${Date.now()}`, fileToSend);
        if (uploadData) {
          media_url = supabase.storage.from('feed_images').getPublicUrl(uploadData.path).data.publicUrl;
          media_type = fileToSend.type.startsWith('video') ? 'video' : 'image';
        }
      }
      await supabase.from('posts').insert({ circle_id: data.circle.id, user_id: currentUserId, content: contentToSend, media_url, media_type });
    } catch { toast.error('שגיאה בשליחה'); }
  };

  const handleSealToggle = async (postId: string, sealType: string, isRemoving: boolean) => {
    triggerFeedback('pop');
    setData((curr: any) => ({
      ...curr, posts: curr.posts.map((p: any) => {
        if (p.id !== postId) return p;
        let newSeals = [...(p.post_seals || [])];
        if (isRemoving) newSeals = newSeals.filter((s:any) => !(s.user_id === currentUserId && s.seal_type === sealType));
        else newSeals.push({ post_id: postId, user_id: currentUserId, seal_type: sealType });
        return { ...p, post_seals: newSeals };
      })
    }));

    if (isRemoving) {
      await supabase.from('post_seals').delete().match({ post_id: postId, user_id: currentUserId, seal_type: sealType });
    } else {
      await supabase.from('post_seals').insert({ post_id: postId, user_id: currentUserId, seal_type: sealType });
    }
  };

  let touchStartActionY = 0;
  const handleMessageTouchStart = (e: React.TouchEvent | React.MouseEvent, post: any) => {
    touchStartActionY = ('touches' in e) ? e.touches[0].clientY : e.clientY;
    pressTimerRef.current = setTimeout(() => { triggerFeedback('heavy'); setActionPost(post); }, 450);
  };
  const handleMessageTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    const currentY = ('touches' in e) ? e.touches[0].clientY : e.clientY;
    if (Math.abs(currentY - touchStartActionY) > 10 && pressTimerRef.current) clearTimeout(pressTimerRef.current);
  };
  const handleMessageTouchEnd = () => { if (pressTimerRef.current) clearTimeout(pressTimerRef.current); };

  const handleDeletePost = async () => {
    if (!actionPost) return;
    setData((curr: any) => ({ ...curr, posts: curr.posts.filter((p: any) => p.id !== actionPost.id) }));
    await supabase.from('posts').delete().eq('id', actionPost.id);
    setActionPost(null); toast.success('נמחק');
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

  if (!mounted || typeof document === 'undefined') return null;

  const { circle, isMember, membership } = data;
  const isOwner = circle.creator_id === currentUserId || membership?.role === 'admin';
  const myStats = overview?.my_stats || null;
  const myLevel = myStats?.level || 1;
  const myXP = myStats?.xp || 0;
  const xpToNext = myLevel * 100;
  const xpProgress = Math.min(100, Math.round((myXP / xpToNext) * 100));

  return createPortal(
    <FadeIn className="fixed inset-0 z-[99999] bg-[#050505] font-sans flex flex-col overflow-hidden" dir="rtl">
      
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />
      <input type="file" ref={storyInputRef} onChange={handleStoryChange} className="hidden" accept="image/*,video/*" />
      <input type="file" ref={instantPhotoRef} onChange={handleStoryChange} className="hidden" accept="image/*" capture="user" />
      <input type="file" ref={instantVideoRef} onChange={handleStoryChange} className="hidden" accept="video/*" capture="user" />

      <AnimatePresence>
        {isCameraOpen && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed inset-0 z-[99999999] bg-black flex flex-col">
            <div className="absolute top-[calc(env(safe-area-inset-top)+16px)] right-4 z-20">
              <button onClick={closeCamera} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white active:scale-90 transition-transform"><X size={24} /></button>
            </div>
            <div className="flex-1 relative bg-[#111] overflow-hidden rounded-b-[32px] shadow-2xl">
              {!capturedStoryBlob ? (
                <video ref={videoFeedRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
              ) : (
                capturedMediaType === 'video' ? <video src={URL.createObjectURL(capturedStoryBlob)} autoPlay loop playsInline className="w-full h-full object-cover scale-x-[-1]" /> : <img src={URL.createObjectURL(capturedStoryBlob)} className="w-full h-full object-cover scale-x-[-1]" />
              )}
              {isRecording && <div className="absolute top-[100px] left-1/2 -translate-x-1/2 bg-red-500/20 text-red-500 border border-red-500/50 px-4 py-2 rounded-full font-black animate-pulse shadow-lg flex items-center gap-2"><div className="w-2 h-2 bg-red-500 rounded-full" /> מקליט וידאו...</div>}
            </div>
            <div className="h-[140px] shrink-0 bg-[#050505] flex items-center justify-center px-6 pb-[env(safe-area-inset-bottom)]">
              {!capturedStoryBlob ? (
                <button onTouchStart={handleCameraDown} onTouchEnd={handleCameraUp} onMouseDown={handleCameraDown} onMouseUp={handleCameraUp} className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all ${isRecording ? 'border-red-500 scale-110 bg-red-500/10' : 'border-white bg-white/10 active:scale-95'}`}>
                  <div className={`w-16 h-16 rounded-full transition-all ${isRecording ? 'bg-red-500 scale-50 rounded-lg' : 'bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]'}`} />
                </button>
              ) : (
                <div className="flex gap-4 w-full">
                  <button onClick={() => { setCapturedStoryBlob(null); setIsRecording(false); }} className="flex-1 h-14 rounded-full bg-white/10 text-white font-black active:scale-95 transition-all">צלם שוב</button>
                  <button onClick={uploadCapturedStory} className="flex-1 h-14 rounded-full bg-accent-primary text-white font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[0_0_20px_rgba(var(--color-accent-primary),0.4)]"><Send size={18} className="rtl:-scale-x-100" /> לסטורי</button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {fullScreenMedia && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999999] bg-black flex items-center justify-center" onClick={() => setFullScreenMedia(null)}>
            {fullScreenMedia.type === 'video' ? <video src={fullScreenMedia.url} controls autoPlay className="w-full h-full object-contain" onClick={(e) => e.stopPropagation()} /> : <img src={fullScreenMedia.url} className="w-full h-full object-contain" onClick={(e) => e.stopPropagation()} />}
            <button className="absolute top-[calc(env(safe-area-inset-top)+16px)] left-4 p-3 text-white/70 hover:text-white transition-all active:scale-90 z-50 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"><X size={28} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {actionPost && (
          <div className="fixed inset-0 z-[9999999] flex flex-col justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActionPost(null)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="relative bg-[#111] rounded-t-[32px] p-6 pb-[calc(env(safe-area-inset-bottom)+32px)] border-t border-white/10 shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-white/5 shrink-0 border border-white/10 shadow-lg"><img src={actionPost.profiles?.avatar_url} className="w-full h-full object-cover" /></div>
                <div className="flex flex-col"><span className="text-white font-black text-[18px]">{actionPost.profiles?.full_name}</span><span className="text-white/40 text-[12px] uppercase font-bold">{formatTime(actionPost.created_at)}</span></div>
              </div>
              <div className="flex flex-col gap-3">
                {actionPost.content && <button onClick={() => { navigator.clipboard.writeText(actionPost.content); toast.success('הועתק'); setActionPost(null); }} className="flex items-center gap-4 p-4 bg-white/5 rounded-[20px] text-white font-black hover:bg-white/10 active:scale-95 transition-all"><Copy size={20} className="text-white/50" /> העתק טקסט</button>}
                {actionPost.user_id === currentUserId && <button onClick={() => { setNewPost(actionPost.content); setEditingPostId(actionPost.id); setActionPost(null); }} className="flex items-center gap-4 p-4 bg-white/5 rounded-[20px] text-white font-black hover:bg-white/10 active:scale-95 transition-all"><Edit2 size={20} className="text-white/50" /> ערוך הודעה</button>}
                {(actionPost.user_id === currentUserId || isOwner) && <button onClick={handleDeletePost} className="flex items-center gap-4 p-4 bg-red-500/10 text-red-500 font-black rounded-[20px] border border-red-500/20 hover:bg-red-500/20 active:scale-95 transition-all"><Trash2 size={20} /> מחק הודעה</button>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <button onClick={() => navigate(-1)} className="absolute top-[calc(env(safe-area-inset-top)+16px)] right-4 p-2 text-white/80 hover:text-white z-50 drop-shadow-md active:scale-90 transition-transform"><ChevronLeft size={32} className="rtl:rotate-180" /></button>
      <div className="absolute top-0 left-0 right-0 h-[30vh] pointer-events-none z-0">
        {circle.cover_url && <img src={circle.cover_url} className="w-full h-full object-cover opacity-20 mix-blend-luminosity" />}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/40 via-[#050505]/80 to-[#050505]" />
      </div>
      <div className="relative z-20 pt-[calc(env(safe-area-inset-top)+20px)] px-6 text-center shrink-0">
        <h1 className="text-3xl font-black text-white drop-shadow-lg tracking-widest">{circle.name}</h1>
      </div>

      {!isMember ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
          <Button onClick={() => handleJoin('INNER')} disabled={joining} className="w-full max-w-[300px] h-14 bg-white/10 rounded-[20px] text-white font-black shadow-2xl backdrop-blur-md">בקשת גישה ({circle.join_price || 0} CRD)</Button>
        </div>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden relative z-10 mt-6">
          <div className="flex justify-center gap-8 mb-4">
            {['chat', 'overview', 'vaults', 'members'].map(t => (
              <button key={t} onClick={() => setActiveTab(t as any)} className={`relative text-[12px] font-black uppercase tracking-widest transition-colors ${activeTab === t ? 'text-white' : 'text-white/30 hover:text-white/60'}`}>
                {t === 'chat' ? 'לייב' : t === 'overview' ? 'דשבורד' : t === 'vaults' ? 'כספות' : 'קהילה'}
                {activeTab === t && <motion.div layoutId="indicator" className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-accent-primary rounded-full shadow-[0_0_10px_rgba(var(--color-accent-primary),1)]" />}
              </button>
            ))}
          </div>

          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {overview.stories?.length > 0 && (
                <div className="shrink-0 pb-3 flex gap-4 overflow-x-auto px-5 border-b border-white/5">
                  <div onClick={openCamera} className="flex flex-col items-center gap-1 shrink-0 cursor-pointer active:scale-95 transition-transform">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-white/60 border border-white/10 hover:bg-white/10 hover:text-white"><Plus size={24} /></div>
                    <span className="text-[10px] text-white/50 font-black tracking-wider">רגע חדש</span>
                  </div>
                  {overview.stories.map((s:any) => (
                    <div key={s.id} onClick={() => window.open(s.media_url, '_blank')} className="flex flex-col items-center gap-1 shrink-0 cursor-pointer active:scale-95 transition-transform">
                      <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-accent-primary via-white/20 to-transparent"><div className="w-full h-full rounded-full overflow-hidden border-[3px] border-[#050505] bg-white/5"><img src={s.media_url} className="w-full h-full object-cover"/></div></div>
                      <span className="text-[10px] text-white/60 font-black tracking-wider truncate max-w-[60px]">{s.full_name}</span>
                    </div>
                  ))}
                </div>
              )}

              <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 pb-[100px] flex flex-col gap-6">
                {sortedPosts.map((post: any) => {
                  const isMe = post.user_id === currentUserId;
                  return (
                    <div key={post.id} className={`flex flex-col gap-1 w-full ${isMe ? 'items-end' : 'items-start'}`}>
                      
                      {!isMe && !post.media_url && (
                        <div className="flex items-center gap-2 px-2 cursor-pointer active:opacity-70 transition-opacity" onClick={() => navigate(`/profile/${post.user_id}`)}>
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-white/5 shrink-0"><img src={post.profiles?.avatar_url} className="w-full h-full object-cover" /></div>
                          <span className="text-[12px] text-white/50 font-black tracking-widest">{post.profiles?.full_name}</span>
                        </div>
                      )}
                      
                      <div 
                        className={`relative max-w-[85%] rounded-[24px] ${isMe ? 'bg-accent-primary/20 text-white rounded-br-[8px] border border-accent-primary/20' : 'bg-white/5 text-white/90 rounded-bl-[8px] border border-white/5'} shadow-sm`}
                        onTouchStart={(e) => handleMessageTouchStart(e, post)} onTouchMove={handleMessageTouchMove} onTouchEnd={handleMessageTouchEnd}
                        onMouseDown={(e) => handleMessageTouchStart(e, post)} onMouseMove={handleMessageTouchMove} onMouseUp={handleMessageTouchEnd}
                      >
                        {post.media_url ? (
                          <div className="relative w-full cursor-pointer p-1" onClick={() => setFullScreenMedia({url: post.media_url, type: post.media_type})}>
                            <div className="relative rounded-[20px] overflow-hidden pointer-events-none group">
                              {post.media_type === 'video' ? <video src={post.media_url} autoPlay muted loop className="w-full max-h-[350px] object-cover" /> : <img src={post.media_url} className="w-full max-h-[350px] object-cover" loading="lazy" />}
                              {(post.content || !isMe) && <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/60 pointer-events-none" />}
                              {!isMe && <span className="absolute top-4 left-4 text-white/90 text-[11px] font-black drop-shadow-md z-10 pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${post.user_id}`); }}>{post.profiles?.full_name}</span>}
                              {post.content && <div className="absolute bottom-4 left-4 right-4 z-10"><span className="text-white text-[15px] font-medium leading-relaxed drop-shadow-md">{post.content}</span></div>}
                            </div>
                          </div>
                        ) : (
                          <div className="px-5 py-3.5"><span className="text-[15px] leading-relaxed font-medium whitespace-pre-wrap">{post.content}</span></div>
                        )}
                      </div>

                      <div className={`flex gap-1.5 px-2 mt-0.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {SEAL_TYPES.map(seal => {
                          const count = post.post_seals?.filter((s:any)=>s.seal_type === seal.id).length || 0;
                          const hasSealed = post.post_seals?.some((s:any)=>s.user_id === currentUserId && s.seal_type === seal.id);
                          return (
                            <button key={seal.id} onClick={() => handleSealToggle(post.id, seal.id, hasSealed)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black border transition-all active:scale-95 ${count > 0 ? (hasSealed ? seal.color : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10') : 'bg-transparent border-transparent text-white/20 hover:text-white/50'}`}>
                              {seal.icon} {count > 0 && <span>{count}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#050505] via-[#050505]/90 to-transparent pb-[calc(env(safe-area-inset-bottom)+16px)] z-50">
                <AnimatePresence>
                  {selectedFile && (
                    <motion.div initial={{ opacity: 0, y: 10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: 10, height: 0 }} className="mb-3 ml-[64px]">
                      <div className="relative w-24 h-24 rounded-[20px] overflow-hidden border border-white/10 shadow-2xl bg-black">
                        {selectedFile.type.startsWith('video/') ? <video src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover" /> : <img src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover" />}
                        <button onClick={() => setSelectedFile(null)} className="absolute top-1.5 right-1.5 bg-black/60 p-1.5 rounded-full text-white backdrop-blur-md hover:bg-black/80 transition-colors"><X size={14} /></button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-end gap-3 max-w-[600px] mx-auto">
                  {(!newPost && !selectedFile && !editingPostId) && (
                    <button onClick={openCamera} className="w-[54px] h-[54px] rounded-full bg-accent-primary text-white flex items-center justify-center shrink-0 shadow-[0_5px_20px_rgba(var(--color-accent-primary),0.4)] active:scale-90 transition-transform"><Camera size={24} /></button>
                  )}
                  <div className={`flex-1 bg-white/5 border border-white/10 rounded-[28px] flex items-center px-2 pr-4 min-h-[54px] backdrop-blur-3xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all ${editingPostId ? 'ring-2 ring-accent-primary border-transparent' : ''}`}>
                    <input type="text" value={newPost} onChange={handleInputChange} onKeyDown={e => e.key === 'Enter' && handlePost()} placeholder={editingPostId ? "ערוך הודעה..." : "הודעה למעגל..."} className="flex-1 bg-transparent outline-none text-[15px] font-medium placeholder:text-white/30 py-3" />
                    {!editingPostId && <button onClick={() => fileInputRef.current?.click()} className="text-white/30 hover:text-white/70 mx-2 transition-colors"><Paperclip size={20} /></button>}
                    {(newPost || selectedFile || editingPostId) && <button onClick={handlePost} disabled={posting} className="w-10 h-10 bg-accent-primary text-white rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-[0_0_15px_rgba(var(--color-accent-primary),0.5)]"><Send size={18} className="rtl:-scale-x-100 -ml-1" /></button>}
                  </div>
                </div>
              </div>
            </div>
          )}

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
            </div>
          )}

          {activeTab === 'vaults' && <div className="flex-1 p-5 overflow-y-auto pb-[120px]">{vaults.map(v => <VaultCard key={v.id} vault={v} onUnlockSuccess={fetchVaults} />)}</div>}
          
          {activeTab === 'members' && (
            <div className="flex-1 p-5 flex flex-col gap-3 overflow-y-auto pb-[120px] scrollbar-hide">
              {membersList.map((m) => (
                <div key={m.profiles?.id} onClick={() => navigate(`/profile/${m.profiles?.id}`)} className="flex items-center gap-4 bg-white/5 border border-white/5 p-4 rounded-[24px] cursor-pointer active:scale-95 transition-all">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-black/50 flex items-center justify-center border border-white/5">
                    {m.profiles?.avatar_url ? <img src={m.profiles.avatar_url} className="w-full h-full object-cover" /> : <span className="text-white/40 font-black text-[14px]">{(m.profiles?.full_name || 'א')[0]}</span>}
                  </div>
                  <div className="flex flex-col text-right flex-1">
                    <span className="text-white font-black text-[15px] flex items-center gap-1.5">{m.profiles?.full_name} {m.role === 'admin' && <ShieldAlert size={14} className="text-accent-primary" />}</span>
                    <span className="text-white/30 text-[11px] font-bold tracking-widest mt-0.5 uppercase">{m.tier || 'חבר מועדון'}</span>
                  </div>
                  <ChevronLeft size={16} className="text-white/20 rtl:rotate-180" />
                </div>
              ))}
            </div>
          )}

        </div>
      )}
    </FadeIn>,
    document.body
  );
};
