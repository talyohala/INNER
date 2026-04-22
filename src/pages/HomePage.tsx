import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { FadeIn, Button } from '../components/ui';
import {
  Loader2, Bell, Users, MessageSquare, Send, X, Paperclip, RefreshCw,
  UserCircle, Trash2, Edit2, Share2, MoreVertical, ChevronLeft, Reply,
  ChevronDown, ChevronUp, ArrowUp, Download, Link as LinkIcon, Bookmark,
  Crown, Lock, Flame, Diamond, Handshake, Coins, Megaphone, Gift, ArrowLeft
} from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { Share } from '@capacitor/share';
import { useAuth } from '../context/AuthContext';

type AnyPost = any;
type AnyComment = any;

const SEAL_TYPES = [
  { id: 'fire', icon: <Flame size={24} />, label: 'אש', color: 'text-orange-500', xp: 15 },
  { id: 'diamond', icon: <Diamond size={24} />, label: 'יהלום', color: 'text-blue-400', xp: 50 },
  { id: 'alliance', icon: <Handshake size={24} />, label: 'ברית', color: 'text-emerald-400', xp: 100 }
];

const cleanToastStyle = {
  background: 'rgba(255, 255, 255, 0.5)',
  backdropFilter: 'blur(12px)',
  color: '#0f172a',
  border: '1px solid rgba(255, 255, 255, 0.4)',
  borderRadius: '100px',
  fontSize: '14px',
  fontWeight: 700,
  padding: '12px 24px',
  boxShadow: '0 10px 40px rgba(0,0,0,0.05)',
};

const Confetti = ({ active }: { active: boolean }) => {
  if (!active) return null;
  const colors = ['#8b5cf6', '#34d399', '#fb7185', '#fbbf24', '#60a5fa', '#ffffff'];
  return (
    <div className="fixed inset-0 pointer-events-none z-[99999] flex items-center justify-center overflow-hidden">
      {Array.from({ length: 60 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 1, x: 0, y: 0, scale: 0 }}
          animate={{
            opacity: 0,
            x: (Math.random() - 0.5) * 600,
            y: (Math.random() - 0.5) * 800 - 100,
            scale: Math.random() * 1.5 + 0.5,
            rotate: Math.random() * 720,
          }}
          transition={{ duration: 1.5 + Math.random(), ease: "easeOut" }}
          className="absolute w-3 h-3"
          style={{ backgroundColor: colors[Math.floor(Math.random() * colors.length)], borderRadius: Math.random() > 0.5 ? '50%' : '4px' }}
        />
      ))}
    </div>
  );
};

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pullStartY = useRef(0);
  const lastScrollY = useRef(0);

  const [mounted, setMounted] = useState(false);
  const [posts, setPosts] = useState<AnyPost[]>(() => {
    try {
      const cached = localStorage.getItem('inner_feed_cache');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });

  const [currentUserId, setCurrentUserId] = useState('');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [claimedCampaigns, setClaimedCampaigns] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentUserId) {
      try {
        const stored = JSON.parse(localStorage.getItem(`inner_claimed_camps_${currentUserId}`) || '[]');
        setClaimedCampaigns(new Set(stored));
      } catch { }
    }
  }, [currentUserId]);

  const [showConfetti, setShowConfetti] = useState(false);
  const [loading, setLoading] = useState(posts.length === 0);
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingPost, setEditingPost] = useState<AnyPost | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [isDropMode, setIsDropMode] = useState(false);
  const [dropTarget, setDropTarget] = useState<number | ''>(500);
  const [contributeModal, setContributeModal] = useState<AnyPost | null>(null);
  const [contributeAmount, setContributeAmount] = useState<number | ''>(50);
  const [contributing, setContributing] = useState(false);

  const [activePost, setActivePost] = useState<AnyPost | null>(null);
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<AnyComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<AnyComment | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});
  const [commentActionModal, setCommentActionModal] = useState<AnyComment | null>(null);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());

  const [optionsMenuPost, setOptionsMenuPost] = useState<AnyPost | null>(null);
  const [activeDescPost, setActiveDescPost] = useState<AnyPost | null>(null);
  const [fullScreenMedia, setFullScreenMedia] = useState<AnyPost[] | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [sealSelectorPost, setSealSelectorPost] = useState<AnyPost | null>(null);

  const [onlineUsers, setOnlineUsers] = useState(0);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [postCirclesModal, setPostCirclesModal] = useState<any[] | null>(null);

  const stateRef = useRef({
    comments: false, options: false, desc: false, create: false,
    fullscreen: false, commentAction: false, contribute: false, seals: false, postCircles: false
  });

  const mediaPosts = useMemo(() => posts.filter((p) => p.type === 'post' && !!p.media_url), [posts]);

  const getRandomMediaBatch = (size = 6, excludeId?: string) => {
    const pool = mediaPosts.filter((p) => (excludeId ? p.id !== excludeId : true));
    if (pool.length === 0) return [];
    const batch: AnyPost[] = [];
    for (let i = 0; i < size; i += 1) {
      const picked = pool[Math.floor(Math.random() * pool.length)];
      batch.push({ ...picked, _uid: `${picked.id}-${Math.random().toString(36).slice(2, 9)}` });
    }
    return batch;
  };

  useEffect(() => {
    stateRef.current = {
      comments: !!activeCommentsPostId, options: !!optionsMenuPost, desc: !!activeDescPost,
      create: showCreatePost, fullscreen: !!fullScreenMedia, commentAction: !!commentActionModal,
      contribute: !!contributeModal, seals: !!sealSelectorPost, postCircles: !!postCirclesModal
    };
  }, [activeCommentsPostId, optionsMenuPost, activeDescPost, showCreatePost, fullScreenMedia, commentActionModal, contributeModal, sealSelectorPost, postCirclesModal]);

  useEffect(() => {
    const handlePopState = () => {
      const s = stateRef.current;
      if (s.commentAction) setCommentActionModal(null);
      else if (s.postCircles) setPostCirclesModal(null);
      else if (s.contribute) setContributeModal(null);
      else if (s.seals) setSealSelectorPost(null);
      else if (s.comments) { setActiveCommentsPostId(null); setActivePost(null); setReplyingTo(null); setEditingCommentId(null); setNewComment(''); }
      else if (s.options) setOptionsMenuPost(null);
      else if (s.desc) setActiveDescPost(null);
      else if (s.create) { setShowCreatePost(false); setEditingPost(null); setSelectedFile(null); setNewPost(''); setIsDropMode(false); }
      else if (s.fullscreen) setFullScreenMedia(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY < lastScrollY.current && currentY > 300) setShowScrollTop(true);
      else setShowScrollTop(false);
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openOverlay = (action: () => void) => { window.history.pushState({ overlay: true }, ''); action(); };
  const closeOverlay = () => { window.history.back(); };
  const isAnyModalOpen = () => Object.values(stateRef.current).some(Boolean);
  const scrollToTop = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); };

  // ==========================================
  // מנגנון התראות חסין תקלות מהשורש (Bulletproof)
  // ==========================================
  const sendSecureNotification = async (targetUserId: string, notifTitle: string, notifContent: string, notifUrl: string) => {
    if (!targetUserId || targetUserId === currentUserId) return; // מונע שליחת התראה לעצמך

    const baseNotif = {
      user_id: targetUserId,
      title: notifTitle,
      content: notifContent,
      action_url: notifUrl,
      is_read: false
    };

    // ניסיון 1: מבנה מלא (כולל actor_id ו-type)
    let { error } = await supabase.from('notifications').insert({ 
      ...baseNotif, 
      actor_id: currentUserId, 
      type: 'activity' 
    });

    if (error) {
      // ניסיון 2: מבנה נפוץ חלופי (עם sender_id)
      const res2 = await supabase.from('notifications').insert({ 
        ...baseNotif, 
        sender_id: currentUserId 
      });
      
      if (res2.error) {
        // ניסיון 3: מבנה מינימלי הכרחי (רק עמודות חובה)
        const res3 = await supabase.from('notifications').insert(baseNotif);
        
        if (res3.error) {
          console.error("שגיאה קריטית בשליחת התראה ל-Supabase:", res3.error);
          toast.error(`תקלת שרת בהתראות: ${res3.error.message}`, { style: cleanToastStyle, duration: 4000 });
        }
      }
    }
  };

  const checkUnreadNotifications = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', authData.user.id).eq('is_read', false);
      setUnreadCount(count || 0);
    } catch { }
  };

  const fetchData = async (isSilentRefresh = false) => {
    if (!isSilentRefresh && posts.length === 0) setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id || null;
      if (uid) setCurrentUserId(uid);

      const [rawPosts, rawMembers, rawCircles, rawCamps] = await Promise.all([
        supabase.rpc('get_smart_feed', { p_user_id: uid, p_limit: 30, p_offset: 0 }).then((r) => r.data || []),
        supabase.from('circle_members').select('*').then((r) => r.data || []),
        supabase.from('circles').select('*').then((r) => r.data || []),
        supabase.from('campaigns').select('*').eq('placement', 'feed').eq('active', true).order('created_at', { ascending: false }).then(r => r.data || [])
      ]);

      const activeCamps = rawCamps.filter((c: any) => {
        if (c.expires_at && new Date(c.expires_at) < new Date()) return false;
        return true;
      });
      setCampaigns(activeCamps);

      const myCircleIds = new Set(rawMembers.filter((m: any) => m.user_id === uid).map((m: any) => m.circle_id));
      const recommendedClubs = rawCircles
        .filter((c: any) => !myCircleIds.has(c.id))
        .map((c: any) => ({
          ...c,
          memberCount: rawMembers.filter((m: any) => m.circle_id === c.id).length
        }));

      const fetchedPosts = rawPosts.map((p: any) => {
        const userCircles = rawCircles.filter((c: any) => rawMembers.some((m: any) => m.circle_id === c.id && m.user_id === p.user_id));
        return {
          ...p,
          type: 'post',
          profiles: { id: p.user_id, full_name: p.author_name, avatar_url: p.author_avatar, role_label: p.author_role, username: p.author_name },
          user_circles: userCircles,
        };
      });

      let mixedFeed: any[] = [];
      let clubIdx = 0;
      fetchedPosts.forEach((post: any, idx: number) => {
        mixedFeed.push(post);
        if ((idx + 1) % 4 === 0 && recommendedClubs[clubIdx]) {
          mixedFeed.push({ ...recommendedClubs[clubIdx], type: 'club_recommendation', _uid: `club-rec-${recommendedClubs[clubIdx].id}-${idx}` });
          clubIdx++;
        }
      });

      setPosts(mixedFeed);
      localStorage.setItem('inner_feed_cache', JSON.stringify(mixedFeed));
    } catch {
      if (posts.length === 0) toast('שגיאה בטעינת הפיד', { style: cleanToastStyle });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleClaimCampaign = async (camp: any) => {
    triggerFeedback('pop');
    const newSet = new Set(claimedCampaigns).add(camp.id);
    setClaimedCampaigns(newSet);
    localStorage.setItem(`inner_claimed_camps_${currentUserId}`, JSON.stringify(Array.from(newSet)));

    if (camp.reward > 0) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      try {
        await supabase.rpc('add_crd', { p_amount: camp.reward });
      } catch (err) { }
      toast(`קיבלת ${camp.reward} CRD מתנה`, { style: cleanToastStyle });
      triggerFeedback('coin');
    }

    if (camp.action_url) {
      setTimeout(() => {
        window.open(camp.action_url, '_blank');
      }, 300);
    }
  };

  const handleQuickRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setPullY(0);
    triggerFeedback('pop');
    toast('מרענן מערכת...', { style: cleanToastStyle });
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  useEffect(() => {
    setMounted(true);
    fetchData(true);
    checkUnreadNotifications();
  }, []);

  useEffect(() => {
    const presenceChannel = supabase.channel('global_online');
    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      let activeCount = 0;
      for (const key in state) activeCount += state[key].length;
      setOnlineUsers(activeCount > 0 ? activeCount : 1);
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({ online_at: new Date().toISOString(), user_id: currentUserId || 'guest' });
      }
    });
    return () => { supabase.removeChannel(presenceChannel); };
  }, [currentUserId]);

  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (scrollTimeout.current) return;
    scrollTimeout.current = setTimeout(() => {
      scrollTimeout.current = null;
      const index = Math.round(target.scrollTop / target.clientHeight);
      if (index !== currentMediaIndex) setCurrentMediaIndex(index);
      if (target.scrollHeight - target.scrollTop <= target.clientHeight * 2 && fullScreenMedia) {
        const more = getRandomMediaBatch(4);
        if (more.length) setFullScreenMedia((prev) => [...(prev || []), ...more]);
      }
    }, 120);
  };

  useEffect(() => {
    if (!fullScreenMedia) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const vid = entry.target as HTMLVideoElement;
        if (vid.tagName !== 'VIDEO') return;
        if (entry.isIntersecting) { vid.muted = false; vid.play().catch(() => { }); }
        else { vid.pause(); vid.muted = true; vid.currentTime = 0; }
      });
    }, { threshold: 0.7 });
    document.querySelectorAll('.full-media-item').forEach((v) => observer.observe(v));
    return () => observer.disconnect();
  }, [fullScreenMedia, currentMediaIndex]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAnyModalOpen() || refreshing) return;
    if (window.scrollY <= 5) pullStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isAnyModalOpen() || refreshing) return;
    if (pullStartY.current > 0 && window.scrollY <= 0) {
      const y = e.touches[0].clientY - pullStartY.current;
      if (y > 0) {
        setPullY(Math.min(Math.pow(y, 0.85), 100));
      }
    }
  };

  const handleTouchEnd = async () => {
    if (isAnyModalOpen() || refreshing) return;
    if (pullY > 60) {
      handleQuickRefresh();
    } else {
      setPullY(0);
    }
    pullStartY.current = 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      setSelectedFile(file);
    } else if (file) {
      toast('אנא בחר קובץ תמונה או וידאו תקין', { style: cleanToastStyle });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePost = async () => {
    if (!newPost.trim() && !selectedFile && !editingPost) return;
    if (isDropMode && (!dropTarget || dropTarget < 50)) {
      toast('יעד מינימלי לדרופ: 50 CRD', { style: cleanToastStyle });
      return;
    }
    setPosting(true);
    triggerFeedback('pop');
    try {
      if (editingPost) {
        await supabase.from('posts').update({ content: newPost.trim() }).eq('id', editingPost.id);
        setPosts((curr) => curr.map((p) => p.id === editingPost.id ? { ...p, content: newPost.trim() } : p));
        toast('עודכן בהצלחה', { style: cleanToastStyle });
        setNewPost(''); setEditingPost(null);
        closeOverlay();
        return;
      }

      let media_url: string | null = null;
      let media_type = 'text';

      if (selectedFile) {
        const safeName = selectedFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${safeName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('feed_images').upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });
        if (uploadError) throw new Error("שגיאה בהעלאת הקובץ: " + uploadError.message);
        if (!uploadData?.path) throw new Error("בעיה בקבלת נתיב הקובץ מהשרת");
        const { data: { publicUrl } } = supabase.storage.from('feed_images').getPublicUrl(uploadData.path);
        if (!publicUrl) throw new Error("לא הצלחנו לייצר קישור לקובץ");
        media_url = publicUrl;
        media_type = selectedFile.type.startsWith('video/') ? 'video' : 'image';
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const insertRes = await supabase.from('posts').insert({
        user_id: currentUserId,
        content: newPost.trim(),
        media_url,
        media_type,
        circle_id: null,
        is_reveal_drop: isDropMode,
        required_crd: isDropMode ? dropTarget : 0,
        drop_expires_at: isDropMode ? expiresAt.toISOString() : null,
        reveal_status: isDropMode ? 'locked' : 'revealed'
      });

      if (insertRes.error) throw insertRes.error;

      setNewPost('');
      setSelectedFile(null);
      setEditingPost(null);
      setIsDropMode(false);
      triggerFeedback('success');
      await fetchData(true);
    } catch (e: any) {
      console.error(e);
      toast(e.message || 'שגיאה בשמירה', { style: cleanToastStyle });
    } finally {
      setPosting(false);
    }
  };

  const handleJoinCircle = async (circleId: string) => {
    triggerFeedback('pop');
    try {
      const { error } = await supabase.from('circle_members').insert({ circle_id: circleId, user_id: currentUserId, role: 'member' });
      if (error) throw error;
      toast('הצטרפת למועדון', { style: cleanToastStyle });
      setPosts((prev) => prev.filter((item) => item.id !== circleId || item.type !== 'club_recommendation'));
      triggerFeedback('success');
    } catch (err) {
      toast('שגיאה בהצטרפות למועדון', { style: cleanToastStyle });
    }
  };

  const handleRemoveSeal = async (postId: string) => {
    triggerFeedback('pop');
    const update = (list: AnyPost[]) => list.map((p) => p.id === postId ? { ...p, has_sealed: false, seals_count: Math.max(0, p.seals_count - 1) } : p);
    setPosts((prev) => update(prev));
    if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));
    try {
      await supabase.from('post_seals').delete().match({ post_id: postId, user_id: currentUserId });
    } catch (err) {
      toast('שגיאה בהסרת חותם', { style: cleanToastStyle });
    }
  };

  const handleSeal = async (postId: string, sealType: string) => {
    triggerFeedback('pop');
    closeOverlay();
    
    const update = (list: AnyPost[]) => list.map((p) => p.id === postId ? { ...p, has_sealed: true, seals_count: p.seals_count + 1 } : p);
    setPosts((prev) => update(prev));
    if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));
    
    try {
      const { error } = await supabase.from('post_seals').insert({ post_id: postId, user_id: currentUserId, seal_type: sealType });
      
      if (error) {
        if (error.code === '23505') toast('כבר נתת חותם לפוסט זה', { style: cleanToastStyle });
        else throw error;
        const revert = (list: AnyPost[]) => list.map((p) => p.id === postId ? { ...p, has_sealed: false, seals_count: Math.max(0, p.seals_count - 1) } : p);
        setPosts((prev) => revert(prev));
      } else {
        triggerFeedback('success');
        
        // יצירת ההתראה הבטוחה לחלוטין (Bulletproof Notification)
        const targetPost = posts.find(p => p.id === postId) || (fullScreenMedia && fullScreenMedia.find(p => p.id === postId));
        if (targetPost && targetPost.user_id) {
          const sealLabels: Record<string, string> = { fire: 'חותם אש', diamond: 'חותם יהלום', alliance: 'חותם ברית' };
          const currentLabel = sealLabels[sealType] || 'חותם יוקרה';
          const senderName = profile?.full_name || profile?.username || 'משתמש';
          
          await sendSecureNotification(
            targetPost.user_id,
            `${currentLabel} חדש!`,
            `${senderName} העניק לך ${currentLabel} לפוסט שלך.`,
            `/post/${postId}`
          );
        }
      }
    } catch (err) {
      toast('שגיאה בהענקת חותם', { style: cleanToastStyle });
    }
  };

  const handleContribute = async () => {
    if (!contributeModal || !contributeAmount || contributeAmount <= 0) return;
    setContributing(true);
    triggerFeedback('pop');
    try {
      const { error } = await supabase.rpc('contribute_to_drop', {
        p_post_id: contributeModal.id,
        p_amount: contributeAmount
      });
      if (error) throw error;
      toast('תרומתך התקבלה', { style: cleanToastStyle });
      closeOverlay();
      await fetchData(true);
      triggerFeedback('coin');
    } catch (err: any) {
      triggerFeedback('error');
      toast(err.message || 'שגיאה בתרומה. בדוק יתרה בארנק.', { style: cleanToastStyle });
    } finally {
      setContributing(false);
    }
  };

  const handleShare = async (post: AnyPost) => {
    triggerFeedback('pop');
    const publicUrl = `https://inner-app.com/post/${post.id}`;
    const textToShare = `${post.content ? `${post.content}\n\n` : ''}צפה בפוסט הזה ב-INNER!`;
    try {
      const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor && (window as any).Capacitor.isNativePlatform?.();
      if (isNative) {
        await Share.share({ title: 'INNER', text: textToShare, url: publicUrl, dialogTitle: 'שתף עם חברים' });
      } else if (navigator.share && window.isSecureContext) {
        await navigator.share({ title: 'INNER', text: textToShare, url: publicUrl });
      } else {
        await navigator.clipboard.writeText(`${textToShare}\n${publicUrl}`);
        toast('הקישור הועתק ללוח', { style: cleanToastStyle });
      }
    } catch { }
  };

  const handleCopyLink = async (post: AnyPost) => {
    const publicUrl = `https://inner-app.com/post/${post.id}`;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast('הקישור הועתק ללוח', { style: cleanToastStyle });
    } catch { toast('שגיאה בהעתקה', { style: cleanToastStyle }); }
    closeOverlay();
  };

  const handleDownloadMedia = async (mediaUrl: string) => {
    try {
      toast('מוריד קובץ...', { id: 'dl', style: cleanToastStyle });
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `INNER_Media_${Date.now()}`;
      document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a);
      toast('הקובץ נשמר בהצלחה', { id: 'dl', style: cleanToastStyle });
    } catch { toast('לא ניתן להוריד את הקובץ', { id: 'dl', style: cleanToastStyle }); }
    closeOverlay();
  };

  const submitComment = async () => {
    if (!newComment.trim() || !activePost) return;
    try {
      if (editingCommentId) {
        const updateRes = await supabase.from('comments').update({ content: newComment.trim() }).eq('id', editingCommentId);
        if (updateRes.error) throw updateRes.error;
        setComments((prev) => prev.map((c) => c.id === editingCommentId ? { ...c, content: newComment.trim() } : c));
        setEditingCommentId(null);
      } else {
        const parentIdToUse = replyingTo ? (replyingTo.parent_id || replyingTo.id) : null;
        const data = await apiFetch(`/api/posts/${activePost.id}/comments`, {
          method: 'POST',
          headers: { 'x-user-id': currentUserId },
          body: JSON.stringify({ content: newComment.trim(), parent_id: parentIdToUse }),
        });
        if (data) {
          const newCommentObj = {
            ...data,
            parent_id: parentIdToUse,
            profiles: {
              full_name: profile?.full_name || 'משתמש',
              avatar_url: profile?.avatar_url
            }
          };
          setComments((prev) => [...prev, newCommentObj]);
          const update = (list: AnyPost[]) => list.map((p) => p.id === activePost.id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p);
          setPosts((prev) => update(prev));
          if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));
          if (parentIdToUse) setExpandedThreads((prev) => ({ ...prev, [parentIdToUse]: true }));
          triggerFeedback('coin');
          
          // התראה על תגובה חדשה!
          const senderName = profile?.full_name || profile?.username || 'משתמש';
          if (replyingTo && replyingTo.user_id) {
            await sendSecureNotification(replyingTo.user_id, 'תגובה חדשה', `${senderName} הגיב לתגובה שלך.`, `/post/${activePost.id}`);
          } else if (activePost.user_id) {
            await sendSecureNotification(activePost.user_id, 'תגובה חדשה', `${senderName} הגיב על הפוסט שלך.`, `/post/${activePost.id}`);
          }
        }
      }
      setNewComment(''); setReplyingTo(null);
    } catch { toast('שגיאה בשרת', { style: cleanToastStyle }); }
  };

  const toggleCommentLike = (id: string) => {
    setLikedComments(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    triggerFeedback('pop');
  };

  const deletePost = async (postId: string) => {
    triggerFeedback('error'); closeOverlay();
    setPosts((curr) => curr.filter((p) => p.id !== postId));
    await supabase.from('posts').delete().eq('id', postId);
  };

  const deleteComment = async (commentId: string) => {
    triggerFeedback('error');
    setComments((curr) => curr.filter((c) => c && c.id !== commentId && c.parent_id !== commentId));
    const update = (list: AnyPost[]) => list.map((p) => p.id === activePost?.id ? { ...p, comments_count: Math.max(0, (p.comments_count || 0) - 1) } : p);
    setPosts((prev) => update(prev));
    if (fullScreenMedia) setFullScreenMedia((prev) => (prev ? update(prev) : prev));
    try { await supabase.from('comments').delete().eq('id', commentId); } catch { }
  };

  const handleOpenFullscreen = (post: AnyPost) => {
    if (post.is_reveal_drop && post.reveal_status === 'locked') {
      openOverlay(() => setContributeModal(post));
      return;
    }
    openOverlay(() => {
      setFullScreenMedia([
        { ...post, _uid: `${post.id}-${Math.random().toString(36).slice(2, 9)}` },
        ...getRandomMediaBatch(10, post.id),
      ]);
      setCurrentMediaIndex(0);
    });
  };

  const renderCommentText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(@[\wא-ת]+)/g);
    return parts.map((part, i) => part.startsWith('@') ? <span key={i} className="text-accent-primary font-bold">{part}</span> : <span key={i}>{part}</span>);
  };

  const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

  const sortedParentComments = useMemo(() => {
    return comments
      .filter((c) => c && !c.parent_id)
      .sort((a, b) => {
        const repliesA = comments.filter((r) => r && r.parent_id === a.id).length;
        const repliesB = comments.filter((r) => r && r.parent_id === b.id).length;
        if (repliesB !== repliesA) return repliesB - repliesA;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [comments]);

  if (loading && posts.length === 0) {
    return <div className="min-h-screen bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" size={32} /></div>;
  }

  return (
    <>
      <Confetti active={showConfetti} />
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />

      <AnimatePresence>
        {showScrollTop && !isAnyModalOpen() && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.5, y: 20 }}
            onClick={scrollToTop} className="fixed bottom-24 right-5 z-[80] w-12 h-12 bg-surface-card/90 backdrop-blur-xl border border-surface-border text-brand rounded-[18px] flex items-center justify-center shadow-[0_10px_40px_rgba(0,0,0,0.5)] active:scale-90 transition-transform"
          >
            <ArrowUp size={20} className="text-accent-primary" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {refreshing && (
          <motion.div initial={{ opacity: 0, scale: 0.8, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: -20 }} className="fixed top-24 left-0 right-0 flex justify-center z-[999] pointer-events-none">
            <div className="bg-surface-card/95 backdrop-blur-2xl border border-surface-border px-5 py-3 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center gap-3">
              <Loader2 size={16} className="animate-spin text-accent-primary" />
              <span className="text-[12px] font-black tracking-widest uppercase text-brand">מרענן מערכת...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <FadeIn className="pt-[env(safe-area-inset-top)] pb-32 bg-surface min-h-screen relative overflow-x-hidden touch-pan-y" dir="rtl" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        {!refreshing && pullY > 0 && (
          <div className="fixed top-0 left-0 right-0 flex justify-center z-[100] pointer-events-none" style={{ transform: `translateY(${pullY - 50}px)`, opacity: pullY / 60 }}>
            <div className="bg-surface-card p-3 rounded-full shadow-lg border border-surface-border mt-10">
              <RefreshCw size={20} className="text-brand-muted" style={{ transform: `rotate(${pullY * 3}deg)` }} />
            </div>
          </div>
        )}

        <div className="relative z-10 px-4">
          <div className="sticky top-0 z-[60] bg-surface/80 backdrop-blur-xl pt-4 pb-3 flex justify-between items-center -mx-4 px-6 mb-4">
            <div className="w-10" />
            <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2">
              <h1 className="text-2xl font-black text-brand tracking-widest uppercase drop-shadow-sm">INNER</h1>
              <div className="flex items-center gap-1.5 mt-0.5 bg-surface-card border border-surface-border px-3 py-0.5 rounded-full shadow-inner">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_#22d3ee]" />
                <span className="text-[10px] font-black text-cyan-400 tracking-widest drop-shadow-[0_0_5px_#22d3ee]">{onlineUsers.toLocaleString()} אונליין</span>
              </div>
            </div>
            <button onClick={() => navigate('/notifications')} className="w-10 h-10 flex justify-center items-center bg-surface-card border border-surface-border rounded-full active:scale-90 relative shadow-sm transition-transform">
              <Bell size={18} className="text-brand" />
              {unreadCount > 0 && <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border border-surface animate-pulse shadow-[0_0_5px_#f43f5e]" />}
            </button>
          </div>

          <AnimatePresence>
            {campaigns.filter(c => !claimedCampaigns.has(c.id)).map(camp => {
              if (camp.style === 'hero') {
                return (
                  <motion.div key={camp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="-mx-4 mb-4 relative min-h-[350px] flex flex-col justify-end overflow-hidden group shadow-lg cursor-pointer" onClick={() => handleClaimCampaign(camp)}>
                    {camp.media_url ? (
                      camp.media_type === 'video' ?
                        <video src={camp.media_url} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" /> :
                        <img src={camp.media_url} className="absolute inset-0 w-full h-full object-cover" />
                    ) : <div className="absolute inset-0 bg-accent-primary" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                    <button onClick={(e) => { e.stopPropagation(); handleClaimCampaign(camp); }} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white border border-white/20 z-20 transition-colors">
                      <X size={16} />
                    </button>
                    <div className="relative z-10 p-6 flex flex-col gap-2">
                      <span className="text-white/80 font-black text-[10px] uppercase tracking-[0.2em]">{camp.reward > 0 ? 'מתנה מיוחדת' : 'הודעת מערכת'}</span>
                      <h3 className="text-white font-black text-2xl leading-tight">{camp.title}</h3>
                      <p className="text-white/90 text-[13px] font-medium line-clamp-3">{camp.body}</p>
                      <div className="mt-2 flex">
                        {camp.reward > 0 ? (
                          <div className="h-12 px-6 bg-white text-black font-black text-[13px] uppercase tracking-widest rounded-full shadow-[0_5px_20px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2">
                            <Gift size={16} /> קבל {camp.reward} CRD
                          </div>
                        ) : camp.action_url ? (
                          <div className="h-12 px-6 bg-blue-500 text-white font-black text-[13px] uppercase tracking-widest rounded-full flex items-center justify-center gap-2 shadow-sm">
                            <LinkIcon size={16} /> פתח קישור
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </motion.div>
                );
              }
              else if (camp.style === 'compact') {
                return (
                  <motion.div key={camp.id} initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9, height: 0, marginBottom: 0 }} className="mb-4 relative bg-surface-card border border-surface-border rounded-[20px] p-2 pr-2.5 flex items-center gap-3 shadow-sm cursor-pointer active:scale-[0.98] transition-transform" onClick={() => handleClaimCampaign(camp)}>
                    {camp.media_url && (
                      <div className="w-12 h-12 rounded-[14px] overflow-hidden shrink-0 border border-surface-border bg-surface">
                        {camp.media_type === 'video' ? <video src={camp.media_url} autoPlay loop muted playsInline className="w-full h-full object-cover" /> : <img src={camp.media_url} className="w-full h-full object-cover" />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                      <h3 className="text-brand font-black text-[13px] truncate">{camp.title}</h3>
                      {camp.body && <span className="text-brand-muted font-medium text-[11px] truncate">{camp.body}</span>}
                    </div>
                    <div className="flex items-center gap-2 pl-1">
                      {camp.reward > 0 ? (
                        <div className="bg-accent-primary/10 text-accent-primary font-black text-[10px] px-3 py-1.5 rounded-full whitespace-nowrap">
                          +{camp.reward} CRD
                        </div>
                      ) : camp.action_url ? (
                        <div className="bg-blue-500/10 text-blue-500 font-black text-[10px] px-3 py-1.5 rounded-full whitespace-nowrap">
                          פתיחה
                        </div>
                      ) : null}
                      <button onClick={(e) => { e.stopPropagation(); handleClaimCampaign(camp); }} className="w-6 h-6 flex items-center justify-center shrink-0 text-brand-muted hover:text-brand bg-surface rounded-full">
                        <X size={14} />
                      </button>
                    </div>
                  </motion.div>
                );
              }
              return (
                <motion.div key={camp.id} initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9, height: 0, marginBottom: 0 }} className="mb-4 relative bg-surface-card border border-surface-border hover:border-accent-primary/30 rounded-[28px] overflow-hidden shadow-sm flex flex-col group cursor-pointer active:scale-[0.98] transition-all" onClick={() => handleClaimCampaign(camp)}>
                  <div className="absolute top-3 right-3 z-20">
                    <button onClick={(e) => { e.stopPropagation(); handleClaimCampaign(camp); }} className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                  {camp.media_url && (
                    <div className="w-full h-36 bg-surface relative">
                      {camp.media_type === 'video' ? <video src={camp.media_url} autoPlay loop muted playsInline className="w-full h-full object-cover" /> : <img src={camp.media_url} className="w-full h-full object-cover" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-surface-card to-transparent opacity-50" />
                    </div>
                  )}
                  <div className="p-5 pt-4 flex flex-col gap-1.5">
                    <span className="text-accent-primary font-black text-[10px] uppercase tracking-widest">{camp.reward > 0 ? 'מתנה מחכה לך' : 'הודעת מערכת'}</span>
                    <h3 className="text-brand font-black text-[16px] leading-tight">{camp.title}</h3>
                    {camp.body && <p className="text-brand-muted text-[12px] leading-relaxed line-clamp-2">{camp.body}</p>}
                    <div className="mt-3">
                      {camp.reward > 0 ? (
                        <div className="w-full h-12 rounded-[16px] bg-accent-primary text-white font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_5px_15px_rgba(var(--color-accent-primary),0.3)]">
                          <Gift size={16} /> קבל {camp.reward} CRD
                        </div>
                      ) : camp.action_url ? (
                        <div className="w-full h-12 rounded-[16px] bg-blue-500 text-white font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm">
                          <LinkIcon size={16} /> פתח קישור
                        </div>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          <div className="mb-4">
            <div className="p-3 px-4 rounded-[20px] border border-surface-border bg-surface-card shadow-sm relative z-10 flex flex-col gap-2">
              {selectedFile && (
                <div className="relative w-full h-44 rounded-[16px] overflow-hidden bg-surface border border-surface-border flex items-center justify-center shadow-inner mt-2">
                  {selectedFile.type.startsWith('video/') ? (
                    <video src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover opacity-90" preload="metadata" playsInline />
                  ) : (
                    <img src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover opacity-90" loading="lazy" />
                  )}
                  <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="absolute top-3 right-3 w-8 h-8 bg-black/60 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white z-10">
                    <X size={14} />
                  </button>
                </div>
              )}
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="מה בא לך לשתף עם כולם?"
                className="w-full bg-transparent border-none text-brand text-[15px] font-medium outline-none resize-none placeholder:text-brand-muted/50 px-2 min-h-[44px] mt-1"
                rows={Math.min(Math.max(newPost.split('\n').length, 1), 4)}
              />
              <AnimatePresence>
                {isDropMode && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 bg-surface border border-accent-primary/30 p-3 rounded-2xl mt-1">
                    <div className="flex flex-col flex-1">
                      <span className="text-[11px] font-black text-accent-primary tracking-widest uppercase mb-1">יעד פתיחה (CRD)</span>
                      <input type="number" value={dropTarget} onChange={(e) => setDropTarget(e.target.value === '' ? '' : Number(e.target.value))} className="bg-transparent border-none text-brand font-black outline-none w-full" placeholder="500" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex justify-between items-center border-t border-surface-border pt-2 mt-1">
                <div className="flex gap-1">
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-brand-muted hover:text-brand px-2 py-1.5 rounded-full transition-colors">
                    <Paperclip size={18} />
                  </button>
                  <button onClick={() => setIsDropMode(!isDropMode)} className={`flex items-center gap-2 px-2 py-1.5 rounded-full transition-colors ${isDropMode ? 'text-accent-primary' : 'text-brand-muted hover:text-brand'}`}>
                    <Lock size={18} />
                  </button>
                </div>
                <button onClick={handlePost} disabled={posting || (!newPost.trim() && !selectedFile && !editingPost)} className="w-10 h-10 shrink-0 rounded-full bg-accent-primary text-white flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform shadow-md">
                  {posting ? <Loader2 size={18} className="animate-spin text-white" /> : <Send size={18} className="rtl:-scale-x-100 -ml-0.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 relative z-10 pb-10">
            {loading && posts.length === 0 ? (
              <div className="flex flex-col gap-4 w-full opacity-60">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-full h-48 bg-surface-card border border-surface-border rounded-[24px] animate-pulse"></div>
                ))}
              </div>
            ) : posts.map((post) => {
              if (post.type === 'club_recommendation') {
                const price = Number(post.entry_crd_price || post.price || post.crd_price || post.entry_price || 0);
                const isPremium = price > 0;
                return (
                  <div key={post._uid} onClick={() => navigate(`/circle/${post.slug || post.id}`)} className="relative bg-surface-card border border-surface-border hover:border-accent-primary/30 rounded-[24px] overflow-hidden shadow-sm flex flex-col p-6 gap-4 cursor-pointer group active:scale-[0.98] transition-all">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent-primary/5 blur-[50px] rounded-full pointer-events-none group-hover:bg-accent-primary/10 transition-colors" />
                    <div className="flex items-center justify-between gap-3 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-[14px] overflow-hidden bg-surface border border-surface-border flex items-center justify-center shrink-0 shadow-inner">
                          {post.cover_url ? <img src={post.cover_url} className="w-full h-full object-cover" loading="lazy" /> : <Users className="w-6 h-6 text-brand-muted" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-accent-primary text-[10px] font-black uppercase tracking-widest mb-0.5 flex items-center gap-1">מועדון מומלץ עבורך</span>
                          <h3 className="text-brand font-black text-[16px] leading-tight line-clamp-1">{post.name}</h3>
                        </div>
                      </div>
                    </div>
                    {post.description && (
                      <p className="text-brand-muted text-[13px] font-medium leading-relaxed line-clamp-2 relative z-10">{post.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-2 pt-4 border-t border-surface-border/50 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-brand-muted">
                          <Users size={14} />
                          <span className="text-[12px] font-bold">{post.memberCount || 0} חברים</span>
                        </div>
                        <div className="w-1 h-1 rounded-full bg-surface-border" />
                        {isPremium ? (
                          <div className="flex items-center gap-1 text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20 shadow-sm">
                            <Coins size={12} />
                            <span className="text-[11px] font-black tracking-widest">{price} CRD</span>
                          </div>
                        ) : (
                          <div className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-lg border border-emerald-400/20 text-[11px] font-black tracking-widest shadow-sm">חינם</div>
                        )}
                      </div>
                      <div className="text-brand text-[12px] font-black uppercase tracking-widest group-hover:text-accent-primary transition-colors flex items-center gap-1">
                        סייר במועדון <ChevronLeft size={14} className="rtl:rotate-180" />
                      </div>
                    </div>
                  </div>
                );
              }

              const hasMedia = !!post.media_url;
              const isVideo = post.media_url?.match(/\.(mp4|webm|mov)$/i);
              const isCore = post.profiles?.role_label === 'CORE';
              const isLockedDrop = post.is_reveal_drop && post.reveal_status === 'locked';

              return (
                <div key={post.id} className="flex flex-col rounded-[24px] bg-surface-card border border-surface-border overflow-hidden shadow-sm">
                  {hasMedia && (
                    <div className="w-full relative cursor-pointer bg-surface" onClick={() => { if (!isLockedDrop) handleOpenFullscreen(post); }}>
                      {isVideo ? (
                        <video src={post.media_url} autoPlay loop muted playsInline preload="metadata" className={`w-full max-h-[550px] object-cover ${isLockedDrop ? 'blur-xl grayscale' : ''}`} />
                      ) : (
                        <img src={post.media_url} onError={(e) => { e.currentTarget.src = 'https://placehold.co/500x500/111/333?text=Media+Unavailable'; }} className={`w-full max-h-[550px] object-cover ${isLockedDrop ? 'blur-xl grayscale' : ''}`} loading="lazy" decoding="async" />
                      )}
                      {isLockedDrop && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-20 gap-3 p-6" onClick={(e) => { e.stopPropagation(); openOverlay(() => setContributeModal(post)); }}>
                          <div className="w-16 h-16 rounded-full bg-surface/80 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-lg mb-2">
                            <Lock size={28} className="text-white" />
                          </div>
                          <span className="text-white font-black text-lg tracking-widest">דרופ נעול</span>
                          <div className="w-full max-w-[200px] flex flex-col gap-1 mt-2">
                            <div className="flex justify-between text-[11px] font-black text-white/80 tracking-widest uppercase">
                              <span>{post.current_crd} נאסף</span>
                              <span>{post.required_crd} יעד</span>
                            </div>
                            <div className="w-full h-2 bg-surface/50 rounded-full overflow-hidden border border-white/10">
                              <div className="h-full bg-accent-primary" style={{ width: `${Math.min(100, (post.current_crd / post.required_crd) * 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-24 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex flex-col justify-end pointer-events-none z-20">
                        {post.content && (
                          <p onClick={(e) => { e.stopPropagation(); if (isLockedDrop) openOverlay(() => setContributeModal(post)); else openOverlay(() => setActiveDescPost(post)); }} className={`text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-[15px] font-medium text-right line-clamp-2 pointer-events-auto cursor-pointer mb-3 ${isLockedDrop ? 'select-none blur-sm opacity-50' : ''}`}>
                            {post.content}
                          </p>
                        )}
                        {post.user_circles && post.user_circles.length > 0 && !isLockedDrop && (
                          <div className="flex gap-2 overflow-x-auto scrollbar-hide items-center mb-3 pointer-events-auto">
                            {(() => {
                              const sortedCircles = [...post.user_circles].sort((a, b) => {
                                const aOwner = a.owner_id === post.user_id ? -1 : 1;
                                const bOwner = b.owner_id === post.user_id ? -1 : 1;
                                return aOwner - bOwner;
                              });
                              const displayCircles = sortedCircles.slice(0, 20);
                              const hasMore = sortedCircles.length > 20;

                              return (
                                <>
                                  {displayCircles.map((circle: any) => {
                                    const isOwnerOfThisCircle = circle.owner_id === post.user_id;
                                    return (
                                      <div key={circle.id} onClick={(e) => { e.stopPropagation(); navigate(`/circle/${circle.slug || circle.id}`); }} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform">
                                        <div className={`w-8 h-8 rounded-full overflow-hidden shadow-sm bg-surface flex items-center justify-center ${isOwnerOfThisCircle ? 'border-[1.5px] border-accent-primary shadow-[0_0_8px_rgba(var(--color-accent-primary),0.4)]' : 'border border-white/20'}`}>
                                          {circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover" loading="lazy" /> : <Users className="w-4 h-4 text-white/70" />}
                                        </div>
                                        <span className="text-[9px] text-white drop-shadow-md font-bold max-w-[55px] truncate text-center uppercase tracking-wider">{circle.name}</span>
                                      </div>
                                    );
                                  })}
                                  {hasMore && (
                                    <div onClick={(e) => { e.stopPropagation(); openOverlay(() => setPostCirclesModal(sortedCircles)); }} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform">
                                      <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white backdrop-blur-md">
                                        <ArrowLeft size={14} />
                                      </div>
                                      <span className="text-[9px] text-white drop-shadow-md font-bold text-center uppercase tracking-wider">הכל</span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 mt-1 pointer-events-auto">
                          <div className="flex items-center gap-2.5 cursor-pointer group" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${post.user_id}`); }}>
                            <div className="w-10 h-10 rounded-full border border-white/20 overflow-hidden shrink-0 shadow-sm bg-surface flex items-center justify-center">
                              {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" loading="lazy" /> : <span className="text-white font-black text-lg flex items-center justify-center leading-none">{(post.profiles?.full_name || 'א')[0]}</span>}
                            </div>
                            <div className="flex flex-col text-right">
                              <div className="flex items-center gap-1.5">
                                <span className="text-white font-black text-[14px] drop-shadow-md">{post.profiles?.full_name || 'אנונימי'}</span>
                                {isCore && <Crown size={12} className="text-accent-primary drop-shadow-md" />}
                              </div>
                              <span className="text-white/80 text-[10px] font-bold drop-shadow-md">{new Date(post.created_at).toLocaleDateString('he-IL')}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 flex-row-reverse mr-auto">
                            {!isLockedDrop && (
                              <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setOptionsMenuPost(post)); }} className="active:scale-90 text-white drop-shadow-md hover:text-white/80 transition-colors">
                                <MoreVertical size={20} />
                              </button>
                            )}
                            {!isLockedDrop && (
                              <button onClick={(e) => { e.stopPropagation(); openOverlay(() => { setActivePost(post); setActiveCommentsPostId(post.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at', { ascending: true }).then((r) => { setComments(r.data || []); setLoadingComments(false); }); }); }} className="flex items-center gap-1.5 active:scale-90 text-white drop-shadow-md hover:text-white/80 transition-colors">
                                <MessageSquare size={20} />
                                <span className="text-[13px] font-black">{post.comments_count}</span>
                              </button>
                            )}
                            {!isLockedDrop && (
                              <button onClick={(e) => { e.stopPropagation(); if (post.has_sealed) handleRemoveSeal(post.id); else openOverlay(() => setSealSelectorPost(post)); }} className={`flex items-center gap-1.5 active:scale-90 transition-transform drop-shadow-md ${post.has_sealed ? 'text-orange-500' : 'text-white hover:text-orange-400'}`}>
                                <Flame size={22} fill={post.has_sealed ? 'currentColor' : 'none'} />
                                <span className="text-[13px] font-black">{post.seals_count || 0}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!hasMedia && (
                    <div className="w-full relative bg-[#0a0a0a] min-h-[380px] max-h-[550px] flex flex-col justify-between cursor-pointer group rounded-[24px]" onClick={() => { if (isLockedDrop) openOverlay(() => setContributeModal(post)); else openOverlay(() => setActiveDescPost(post)); }}>
                      {isLockedDrop && (
                        <div className="absolute inset-0 bg-surface/80 backdrop-blur-md flex flex-col items-center justify-center z-30 gap-2 rounded-[24px]">
                          <Lock size={24} className="text-brand-muted" />
                          <span className="text-[12px] font-black tracking-widest uppercase">דרופ נעול</span>
                          <div className="w-[150px] bg-surface-card border border-surface-border rounded-full h-1.5 mt-1 overflow-hidden">
                            <div className="h-full bg-accent-primary" style={{ width: `${Math.min(100, (post.current_crd / post.required_crd) * 100)}%` }} />
                          </div>
                        </div>
                      )}
                      <div className={`p-6 pt-8 pb-32 flex-1 flex flex-col relative z-10 ${isLockedDrop ? 'blur-sm opacity-50' : ''}`}>
                        <p className={`text-white/90 text-[17px] font-medium leading-relaxed text-right whitespace-pre-wrap break-words ${(post.content || '').length > 200 ? 'line-clamp-6' : ''}`}>
                          {post.content}
                        </p>
                        {(post.content || '').length > 200 && (
                          <div className="mt-2 flex items-center gap-1 text-accent-primary text-[12px] font-bold">
                            קרא הכל <ChevronDown size={14} />
                          </div>
                        )}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-24 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end pointer-events-none z-20 rounded-b-[24px]">
                        {post.user_circles && post.user_circles.length > 0 && !isLockedDrop && (
                          <div className="flex gap-2 overflow-x-auto scrollbar-hide items-center mb-3 pointer-events-auto">
                            {(() => {
                              const sortedCircles = [...post.user_circles].sort((a, b) => {
                                const aOwner = a.owner_id === post.user_id ? -1 : 1;
                                const bOwner = b.owner_id === post.user_id ? -1 : 1;
                                return aOwner - bOwner;
                              });
                              const displayCircles = sortedCircles.slice(0, 20);
                              const hasMore = sortedCircles.length > 20;

                              return (
                                <>
                                  {displayCircles.map((circle: any) => {
                                    const isOwnerOfThisCircle = circle.owner_id === post.user_id;
                                    return (
                                      <div key={circle.id} onClick={(e) => { e.stopPropagation(); navigate(`/circle/${circle.slug || circle.id}`); }} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform">
                                        <div className={`w-8 h-8 rounded-full overflow-hidden shadow-sm bg-surface flex items-center justify-center ${isOwnerOfThisCircle ? 'border-[1.5px] border-accent-primary shadow-[0_0_8px_rgba(var(--color-accent-primary),0.5)]' : 'border border-white/20'}`}>
                                          {circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover" loading="lazy" /> : <Users className="w-4 h-4 text-white/70" />}
                                        </div>
                                        <span className="text-[9px] text-white drop-shadow-md font-bold max-w-[55px] truncate text-center uppercase tracking-wider">{circle.name}</span>
                                      </div>
                                    );
                                  })}
                                  {hasMore && (
                                    <div onClick={(e) => { e.stopPropagation(); openOverlay(() => setPostCirclesModal(sortedCircles)); }} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform">
                                      <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white backdrop-blur-md">
                                        <ArrowLeft size={14} />
                                      </div>
                                      <span className="text-[9px] text-white drop-shadow-md font-bold text-center uppercase tracking-wider">הכל</span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 mt-1 pointer-events-auto">
                          <div className="flex items-center gap-2.5 cursor-pointer group" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${post.user_id}`); }}>
                            <div className="w-10 h-10 rounded-full border border-white/20 overflow-hidden shrink-0 shadow-sm bg-surface flex items-center justify-center">
                              {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" loading="lazy" /> : <span className="text-white font-black text-lg flex items-center justify-center leading-none">{(post.profiles?.full_name || 'א')[0]}</span>}
                            </div>
                            <div className="flex flex-col text-right">
                              <div className="flex items-center gap-1.5">
                                <span className="text-white font-black text-[14px] drop-shadow-md">{post.profiles?.full_name || 'אנונימי'}</span>
                                {isCore && <Crown size={12} className="text-accent-primary drop-shadow-md" />}
                              </div>
                              <span className="text-white/80 text-[10px] font-bold drop-shadow-md">{new Date(post.created_at).toLocaleDateString('he-IL')}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 flex-row-reverse mr-auto">
                            {!isLockedDrop && (
                              <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setOptionsMenuPost(post)); }} className="active:scale-90 text-white drop-shadow-md hover:text-white/80 transition-colors">
                                <MoreVertical size={20} />
                              </button>
                            )}
                            {!isLockedDrop && (
                              <button onClick={(e) => { e.stopPropagation(); openOverlay(() => { setActivePost(post); setActiveCommentsPostId(post.id); setLoadingComments(true); supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at', { ascending: true }).then((r) => { setComments(r.data || []); setLoadingComments(false); }); }); }} className="flex items-center gap-1.5 active:scale-90 text-white drop-shadow-md hover:text-white/80 transition-colors">
                                <MessageSquare size={20} />
                                <span className="text-[13px] font-black">{post.comments_count}</span>
                              </button>
                            )}
                            {!isLockedDrop && (
                              <button onClick={(e) => { e.stopPropagation(); if (post.has_sealed) handleRemoveSeal(post.id); else openOverlay(() => setSealSelectorPost(post)); }} className={`flex items-center gap-1.5 active:scale-90 transition-transform drop-shadow-md ${post.has_sealed ? 'text-orange-500' : 'text-white hover:text-orange-400'}`}>
                                <Flame size={22} fill={post.has_sealed ? 'currentColor' : 'none'} />
                                <span className="text-[13px] font-black">{post.seals_count || 0}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </FadeIn>

      {/* OVERLAYS / PORTALS */}
      {mounted && typeof document !== 'undefined' && document.body && createPortal(
        <>
          {/* 1. SEAL SELECTOR MODAL */}
          <AnimatePresence>
            {sealSelectorPost && (
              <div className="fixed inset-0 z-[9999999] flex flex-col justify-end p-4" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div initial={{ y: '100%', scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: '100%', scale: 0.95 }} transition={{ type: 'spring', damping: 25, stiffness: 400 }} className="relative z-10 bg-surface border border-surface-border rounded-[32px] p-8 shadow-2xl flex flex-col items-center gap-6">
                  <div className="w-12 h-1.5 bg-white/10 rounded-full mb-2" />
                  <div className="text-center">
                    <h3 className="text-brand font-black text-xl tracking-tighter uppercase">הענק חותם יוקרה</h3>
                    <p className="text-brand-muted text-[13px] mt-2 font-medium">החותם יישאר לשבוע ויעניק ליוצר XP</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 w-full">
                    {SEAL_TYPES.map((type) => (
                      <button key={type.id} onClick={() => handleSeal(sealSelectorPost.id, type.id)} className="flex flex-col items-center gap-3 p-5 rounded-[24px] bg-surface-card border border-surface-border hover:bg-white/5 transition-all active:scale-95 shadow-sm">
                        <div className={`${type.color} drop-shadow-lg`}>{type.icon}</div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-brand font-black text-[12px] uppercase tracking-widest">{type.label}</span>
                          <span className="text-accent-primary bg-accent-primary/10 border border-accent-primary/20 px-2 py-0.5 rounded-md text-[10px] font-black tracking-widest">+{type.xp} XP</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* 2. FULL SCREEN MEDIA */}
          <AnimatePresence>
            {fullScreenMedia && (
              <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed inset-0 z-[999999] bg-surface">
                <div className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide" onScroll={handleContainerScroll}>
                  {fullScreenMedia.map((vid, idx) => {
                    const isVid = vid.media_url?.match(/\.(mp4|webm|mov)$/i);
                    return (
                      <div key={vid._uid || `${vid.id}-${idx}`} className="w-full h-screen snap-center relative bg-surface flex items-center justify-center">
                        {isVid ? (
                          <video src={vid.media_url} loop playsInline className="w-full h-full object-cover full-media-item" onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())} />
                        ) : (
                          <img src={vid.media_url} className="w-full h-full object-contain full-media-item" onError={(e) => { e.currentTarget.src = 'https://placehold.co/500x500/111/333?text=Media+Unavailable'; }} loading="lazy" />
                        )}

                        <div className="absolute bottom-32 left-4 flex flex-col gap-6 items-center z-50 pointer-events-auto">
                          <button onClick={(e) => {
                            e.stopPropagation();
                            if (vid.has_sealed) { handleRemoveSeal(vid.id); }
                            else { openOverlay(() => setSealSelectorPost(vid)); }
                          }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
                            <Flame size={32} className={vid.has_sealed ? 'text-orange-500' : 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]'} fill={vid.has_sealed ? 'currentColor' : 'none'} strokeWidth={1.5} />
                            <span className="text-white text-[13px] font-black drop-shadow-md">{vid.seals_count || 0}</span>
                          </button>
                          <button onClick={(e) => {
                            e.stopPropagation();
                            openOverlay(() => {
                              setActivePost(vid);
                              setActiveCommentsPostId(vid.id);
                              setLoadingComments(true);
                              supabase.from('comments').select('*, profiles(*)').eq('post_id', vid.id).order('created_at', { ascending: true }).then((r) => { setComments(r.data || []); setLoadingComments(false); });
                            });
                          }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            <MessageSquare size={32} strokeWidth={1.5} />
                            <span className="text-white text-[13px] font-black drop-shadow-md">{vid.comments_count}</span>
                          </button>
                        </div>

                        <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setOptionsMenuPost(vid)); }} className="absolute bottom-8 left-5 z-[60] active:scale-90 transition-transform p-1 pointer-events-auto">
                          <MoreVertical size={28} className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                        </button>

                        <div className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-32 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex flex-col pointer-events-none">
                          {vid.content && (
                            <p className="text-white drop-shadow-md text-[15px] font-medium text-right max-w-[85%] line-clamp-3 pointer-events-auto cursor-pointer mb-4" onClick={(e) => { e.stopPropagation(); openOverlay(() => setActiveDescPost(vid)); }}>
                              {vid.content}
                            </p>
                          )}
                          {vid.user_circles && vid.user_circles.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto scrollbar-hide items-center mb-3 pointer-events-auto">
                              {(() => {
                                const sortedCircles = [...vid.user_circles].sort((a, b) => {
                                  const aOwner = a.owner_id === vid.user_id ? -1 : 1;
                                  const bOwner = b.owner_id === vid.user_id ? -1 : 1;
                                  return aOwner - bOwner;
                                });
                                const displayCircles = sortedCircles.slice(0, 20);
                                const hasMore = sortedCircles.length > 20;

                                return (
                                  <>
                                    {displayCircles.map((circle: any) => {
                                      const isOwnerOfThisCircle = circle.owner_id === vid.user_id;
                                      return (
                                        <div key={circle.id} onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/circle/${circle.slug || circle.id}`), 50); }} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform">
                                          <div className={`w-8 h-8 rounded-full overflow-hidden shadow-sm bg-surface flex items-center justify-center ${isOwnerOfThisCircle ? 'border-[1.5px] border-accent-primary shadow-[0_0_8px_rgba(var(--color-accent-primary),0.5)]' : 'border border-white/20'}`}>
                                            {circle.cover_url ? <img src={circle.cover_url} className="w-full h-full object-cover" loading="lazy" /> : <Users className="w-4 h-4 text-white/70" />}
                                          </div>
                                          <span className="text-[9px] text-white drop-shadow-md font-bold max-w-[55px] truncate text-center uppercase tracking-wider">{circle.name}</span>
                                        </div>
                                      );
                                    })}
                                    {hasMore && (
                                      <div onClick={(e) => { e.stopPropagation(); openOverlay(() => setPostCirclesModal(sortedCircles)); }} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform">
                                        <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white backdrop-blur-md">
                                          <ArrowLeft size={14} />
                                        </div>
                                        <span className="text-[9px] text-white drop-shadow-md font-bold text-center uppercase tracking-wider">הכל</span>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          )}
                          <div className="flex items-center justify-start pointer-events-auto">
                            <div className="flex items-center gap-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${vid.user_id}`), 50); }}>
                              <div className="w-10 h-10 rounded-full border border-white/20 overflow-hidden shrink-0 shadow-sm bg-surface flex items-center justify-center">
                                {vid.profiles?.avatar_url ? <img src={vid.profiles.avatar_url} className="w-full h-full object-cover" loading="lazy" /> : <span className="text-white font-black text-lg flex items-center justify-center leading-none">{(vid.profiles?.full_name || 'א')[0]}</span>}
                              </div>
                              <div className="flex flex-col text-right">
                                <span className="text-white font-black text-[15px] drop-shadow-md">{vid.profiles?.full_name || 'אנונימי'}</span>
                                <span className="text-white/80 text-[10px] font-bold drop-shadow-md">{new Date(vid.created_at).toLocaleDateString('he-IL')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 3. COMMENTS MODAL */}
          <AnimatePresence>
            {activeCommentsPostId && (
              <div className="fixed inset-0 z-[9999999]" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 400 }} className="absolute bottom-0 w-full bg-surface rounded-t-[32px] h-[80vh] flex flex-col overflow-hidden pb-10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border">
                  <div className="w-full py-5 flex justify-center cursor-grab active:cursor-grabbing border-b border-surface-border"><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 scrollbar-hide">
                    {loadingComments ? (
                      <Loader2 className="animate-spin mx-auto text-brand-muted mt-10" />
                    ) : sortedParentComments.length === 0 ? (
                      <div className="text-center text-brand-muted text-[13px] font-bold mt-10 tracking-widest uppercase">אין תגובות עדיין</div>
                    ) : (
                      sortedParentComments.map((c) => {
                        const replies = comments.filter((r) => r && r.parent_id === c.id).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                        const isThreadExpanded = expandedThreads[c.id];
                        return (
                          <div key={c.id} className="flex flex-col gap-2 relative">
                            <div className="flex gap-3 relative z-10">
                              <div className="w-10 h-10 min-w-[40px] rounded-full bg-surface-card shrink-0 overflow-hidden cursor-pointer border border-surface-border flex items-center justify-center shadow-inner" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>
                                {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover object-center" loading="lazy" /> : <span className="text-brand-muted font-black text-sm flex items-center justify-center leading-none">{(c.profiles?.full_name || 'א')[0]}</span>}
                              </div>
                              <div className="flex flex-col flex-1">
                                <div className="bg-surface-card p-4 rounded-[20px] rounded-tr-sm cursor-pointer shadow-sm border border-surface-border w-fit max-w-[95%]" onClick={() => openOverlay(() => setCommentActionModal(c))}>
                                  <span className="text-brand font-black text-[13px] mb-1.5 inline-block uppercase tracking-widest" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>{c.profiles?.full_name || 'אנונימי'}</span>
                                  <p className="text-brand text-[14px] whitespace-pre-wrap leading-relaxed">{renderCommentText(c.content)}</p>
                                </div>
                                <div className="flex items-center gap-4 mt-2 px-2">
                                  <span className="text-[11px] text-brand-muted cursor-pointer font-bold hover:text-brand transition-colors" onClick={() => { setReplyingTo(c); setNewComment(`@${c.profiles?.full_name} `); }}>השב</span>
                                  <button onClick={() => toggleCommentLike(c.id)} className={`ml-auto flex items-center gap-1 active:scale-90 transition-transform ${likedComments.has(c.id) ? 'text-orange-500' : 'text-brand-muted hover:text-orange-400'}`}>
                                    <Flame size={14} fill={likedComments.has(c.id) ? 'currentColor' : 'none'} />
                                  </button>
                                </div>
                                {replies.length > 0 && (
                                  <button onClick={() => setExpandedThreads((prev) => ({ ...prev, [c.id]: !prev[c.id] }))} className="text-right text-[12px] font-black text-accent-primary hover:text-accent-primary/80 transition-colors mt-2 flex items-center gap-1.5 pr-1">
                                    {isThreadExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    {isThreadExpanded ? 'הסתר שרשור' : `צפה ב-${replies.length} תגובות נוספות בשיחה`}
                                  </button>
                                )}
                              </div>
                            </div>
                            {isThreadExpanded && (
                              <div className="pr-12 flex flex-col gap-4 mt-3 relative">
                                <div className="absolute right-5 top-0 bottom-4 w-[1.5px] bg-surface-border z-0" />
                                {replies.map((reply) => (
                                  <div key={reply.id} className="flex gap-3 relative z-10">
                                    <div className="absolute right-[-28px] top-[-12px] w-[20px] h-6 border-r-[1.5px] border-b-[1.5px] border-surface-border rounded-br-[12px] z-0" />
                                    <div className="w-8 h-8 min-w-[32px] rounded-full bg-surface-card shrink-0 overflow-hidden cursor-pointer border border-surface-border flex items-center justify-center shadow-inner relative z-10" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${reply.user_id}`), 50); }}>
                                      {reply.profiles?.avatar_url ? <img src={reply.profiles.avatar_url} className="w-full h-full object-cover object-center" loading="lazy" /> : <span className="text-brand-muted font-black text-[10px] flex items-center justify-center leading-none">{(reply.profiles?.full_name || 'א')[0]}</span>}
                                    </div>
                                    <div className="flex flex-col flex-1">
                                      <div className="bg-surface/50 p-3 rounded-[16px] rounded-tr-sm cursor-pointer border border-surface-border shadow-sm w-fit max-w-[95%]" onClick={() => openOverlay(() => setCommentActionModal(reply))}>
                                        <span className="text-brand font-black text-[11px] mb-1.5 inline-block tracking-widest uppercase" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${reply.user_id}`), 50); }}>{reply.profiles?.full_name || 'אנונימי'}</span>
                                        <p className="text-brand text-[13px] whitespace-pre-wrap leading-relaxed">{renderCommentText(reply.content)}</p>
                                      </div>
                                      <div className="flex items-center gap-4 mt-2 px-2">
                                        <span className="text-[10px] text-brand-muted cursor-pointer font-bold hover:text-brand transition-colors" onClick={() => { setReplyingTo(c); setNewComment(`@${reply.profiles?.full_name} `); }}>השב</span>
                                        <button onClick={() => toggleCommentLike(reply.id)} className={`ml-auto flex items-center gap-1 active:scale-90 transition-transform ${likedComments.has(reply.id) ? 'text-orange-500' : 'text-brand-muted hover:text-orange-400'}`}>
                                          <Flame size={12} fill={likedComments.has(reply.id) ? 'currentColor' : 'none'} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="p-4 border-t border-surface-border flex flex-col gap-2 bg-surface">
                    {replyingTo && !editingCommentId && (
                      <div className="text-[11px] text-brand flex items-center justify-between px-4 py-2 bg-surface-card border border-surface-border rounded-[12px] w-fit mb-1 shadow-sm gap-2">
                        <span className="font-bold mr-1.5 flex items-center gap-2"><Reply size={12} className="rtl:-scale-x-100 text-brand-muted" /> משיב ל-@{replyingTo.profiles?.full_name}</span>
                        <X size={14} className="cursor-pointer text-brand-muted hover:text-brand" onClick={() => { setReplyingTo(null); setNewComment(''); }} />
                      </div>
                    )}
                    {editingCommentId && (
                      <div className="text-[11px] text-accent-primary flex justify-between px-2 font-bold mb-1 uppercase tracking-widest">
                        <span>עורך תגובה...</span>
                        <span onClick={() => { setEditingCommentId(null); setNewComment(''); }} className="cursor-pointer text-brand-muted hover:text-brand">ביטול</span>
                      </div>
                    )}
                    <div className="flex gap-2 items-center bg-surface-card rounded-[20px] p-1.5 pl-2 border border-surface-border shadow-inner">
                      <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="הוסף תגובה לדיון..." className="flex-1 bg-transparent px-4 text-brand text-[14px] outline-none placeholder:text-brand-muted" />
                      <button
                        onClick={submitComment}
                        disabled={!newComment.trim()}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 disabled:opacity-30 ${newComment.trim() ? 'bg-accent-primary text-white opacity-100' : 'bg-surface-border text-brand-muted'}`}
                      >
                        <Send size={16} className="rtl:-scale-x-100 -ml-0.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* 4. COMMENT ACTION MODAL */}
          <AnimatePresence>
            {commentActionModal && (
              <div className="fixed inset-0 z-[99999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[32px] p-6 flex flex-col gap-3 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border">
                  <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/10 rounded-full pointer-events-none" /></div>
                  <button onClick={() => { closeOverlay(); setReplyingTo(commentActionModal.parent_id ? comments.find((c) => c?.id === commentActionModal.parent_id) : commentActionModal); setNewComment(`@${commentActionModal.profiles?.full_name} `); }} className="w-full p-4 bg-surface-card border border-surface-border rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-95 transition-all shadow-sm">
                    <span>השב לתגובה</span><Reply size={20} className="text-brand-muted" />
                  </button>
                  {commentActionModal.user_id === currentUserId && (
                    <>
                      <button onClick={() => { closeOverlay(); setEditingCommentId(commentActionModal.id); setNewComment(commentActionModal.content); }} className="w-full p-4 bg-surface-card border border-surface-border rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-95 transition-all shadow-sm mt-2">
                        <span>ערוך תגובה</span><Edit2 size={20} className="text-brand-muted" />
                      </button>
                      <button onClick={() => { if (window.confirm('למחוק תגובה?')) { closeOverlay(); deleteComment(commentActionModal.id); } }} className="w-full p-4 bg-surface-card border border-red-500/30 rounded-2xl text-red-500 font-black flex justify-between items-center text-[15px] active:scale-95 transition-all mt-2 shadow-sm">
                        <span>מחק תגובה</span><Trash2 size={20} className="text-red-500" />
                      </button>
                    </>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* 5. POST CIRCLES MODAL */}
          <AnimatePresence>
            {postCirclesModal && (
              <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[32px] p-6 flex flex-col gap-3 pb-12 max-h-[70vh] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border">
                  <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>
                  <h2 className="text-brand font-black text-lg mb-4">פורסם ב- ({postCirclesModal.length}) מועדונים</h2>
                  <div className="flex flex-col gap-3 overflow-y-auto pr-1" onPointerDown={stopPropagation} onTouchStart={stopPropagation}>
                    {postCirclesModal.map((c: any) => {
                      const isOwnerOfThisCircle = c.owner_id === (activePost || optionsMenuPost)?.user_id;
                      return (
                        <div key={c.id} onClick={() => { closeOverlay(); navigate(`/circle/${c.slug || c.id}`); }} className={`flex items-center gap-4 bg-surface-card p-4 rounded-2xl cursor-pointer active:scale-[0.98] transition-transform shadow-sm hover:bg-white/5 ${isOwnerOfThisCircle ? 'border-[1.5px] border-accent-primary' : 'border border-surface-border'}`}>
                          <div className={`w-12 h-12 rounded-full bg-surface overflow-hidden shrink-0 flex items-center justify-center shadow-inner ${isOwnerOfThisCircle ? 'border-none' : 'border border-surface-border'}`}>
                            {c.cover_url ? <img src={c.cover_url} className="w-full h-full object-cover" loading="lazy" /> : <Users size={20} className="text-brand-muted" />}
                          </div>
                          <div className="flex flex-col flex-1">
                            <span className="text-brand font-black text-[15px]">{c.name}</span>
                            {isOwnerOfThisCircle && <span className="text-[10px] text-accent-primary font-black uppercase tracking-widest mt-0.5">בניהולו</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* 6. OPTIONS MENU POST */}
          <AnimatePresence>
            {optionsMenuPost && (
              <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[32px] p-6 flex flex-col gap-3 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border text-center">
                  <div className="w-full py-2 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>
                  <button onClick={() => { closeOverlay(); setTimeout(() => handleShare(optionsMenuPost), 100); }} className="w-full p-4 bg-surface-card rounded-[20px] text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>שתף פוסט</span><Share2 size={20} className="text-brand-muted" /></button>
                  {optionsMenuPost.media_url && <button onClick={() => handleDownloadMedia(optionsMenuPost.media_url)} className="w-full p-4 bg-surface-card rounded-[20px] text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>שמור למכשיר</span><Download size={20} className="text-brand-muted" /></button>}
                  <button onClick={async () => { try { await supabase.from('saved_posts').insert({ user_id: currentUserId, post_id: optionsMenuPost.id }); toast('הפוסט נשמר במועדפים!', { style: cleanToastStyle }); } catch { toast('הפוסט כבר שמור אצלך', { style: cleanToastStyle }); } closeOverlay(); }} className="w-full p-4 bg-surface-card rounded-[20px] text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>שמור במועדפים</span><Bookmark size={20} className="text-brand-muted" /></button>
                  <button onClick={() => handleCopyLink(optionsMenuPost)} className="w-full p-4 bg-surface-card rounded-[20px] text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>העתק קישור</span><LinkIcon size={20} className="text-brand-muted" /></button>
                  {optionsMenuPost.user_id === currentUserId && (
                    <>
                      <button onClick={() => { closeOverlay(); setTimeout(() => { setEditingPost(optionsMenuPost); setNewPost(optionsMenuPost.content || ''); window.scrollTo({ top: 0, behavior: 'smooth' }); }, 100); }} className="w-full p-4 bg-surface-card rounded-[20px] text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm mt-2"><span>ערוך פוסט</span><Edit2 size={20} className="text-brand-muted" /></button>
                      <button onClick={() => { if (window.confirm('למחוק פוסט?')) { deletePost(optionsMenuPost.id); } }} className="w-full p-4 bg-surface-card border border-rose-500/30 rounded-[20px] text-rose-500 font-black flex justify-between items-center text-[15px] mt-2 active:scale-[0.98] transition-all"><span>מחק פוסט</span><Trash2 size={20} className="text-red-500" /></button>
                    </>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* 7. DESC POST FULL */}
          <AnimatePresence>
            {activeDescPost && (
              <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[32px] flex flex-col overflow-hidden pb-10 max-h-[75vh] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border text-center">
                  <div className="w-full py-5 flex justify-center cursor-grab active:cursor-grabbing border-b border-surface-border"><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>
                  <div className="p-6 overflow-y-auto" onPointerDown={stopPropagation} onTouchStart={stopPropagation}>
                    <p className="text-brand text-[15px] leading-relaxed whitespace-pre-wrap">{activeDescPost.content}</p>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* 8. CONTRIBUTE MODAL */}
          <AnimatePresence>
            {contributeModal && (
              <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation} dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[32px] p-6 flex flex-col gap-4 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border text-center">
                  <div className="w-full py-2 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>
                  <div className="flex flex-col items-center gap-2 mb-2">
                    <div className="w-16 h-16 bg-surface-card border border-surface-border rounded-full flex items-center justify-center shadow-inner mb-2">
                      <Lock size={28} className="text-accent-primary" />
                    </div>
                    <h2 className="text-xl font-black text-brand tracking-widest uppercase">שחרר את הדרופ</h2>
                    <p className="text-brand-muted text-[13px] font-medium leading-relaxed max-w-[250px]">
                      השקע CRD כדי לעזור לחשוף את הפוסט הזה לכולם.
                    </p>
                  </div>
                  <div className="bg-surface-card border border-surface-border p-4 rounded-[20px] flex flex-col gap-2">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-[11px] font-black text-brand-muted tracking-widest uppercase">התקדמות</span>
                      <span className="text-[13px] font-black text-brand">{contributeModal.current_crd} / {contributeModal.required_crd}</span>
                    </div>
                    <div className="w-full h-2.5 bg-surface rounded-full overflow-hidden border border-surface-border">
                      <div className="h-full bg-accent-primary" style={{ width: `${Math.min(100, (contributeModal.current_crd / contributeModal.required_crd) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-surface-card border border-surface-border rounded-[20px] p-2 pl-4 mt-2">
                    <div className="w-12 h-12 bg-surface rounded-xl flex items-center justify-center shrink-0">
                      <Coins size={20} className="text-brand-muted" />
                    </div>
                    <input type="number" value={contributeAmount} onChange={(e) => setContributeAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="50" className="flex-1 bg-transparent border-none text-xl font-black text-brand outline-none text-left" dir="ltr" />
                    <span className="text-brand-muted font-bold text-[13px] tracking-widest">CRD</span>
                  </div>
                  <Button onClick={handleContribute} disabled={contributing || !contributeAmount} className="h-14 bg-accent-primary text-white font-black text-[15px] uppercase tracking-widest rounded-full mt-2 shadow-md active:scale-95 transition-all">
                    {contributing ? <Loader2 className="animate-spin text-white" /> : 'השקע בדרופ'}
                  </Button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>,
        document.body
      )}
    </>
  );
};
