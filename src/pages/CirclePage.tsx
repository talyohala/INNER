import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { FadeIn, Button } from '../components/ui';
import {
  Users, Loader2, MessageSquare, Heart, Crown, Radio,
  Send, Lock, X, UserCircle, Trash2, Edit2, Reply, MoreVertical, Paperclip, Share2, Download, Link as LinkIcon, Bookmark, ShieldAlert, Image as ImageIcon, Gift, Flame, Eye
} from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { Share } from '@capacitor/share';
import { useAuth } from '../context/AuthContext';

// רכיב וידאו חכם לביצועים
const FeedVideo = ({ src, className }: { src: string; className?: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          videoRef.current?.play().catch(() => {});
        } else {
          videoRef.current?.pause();
        }
      },
      { threshold: 0.4 }
    );

    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  return <video ref={videoRef} src={src} loop muted playsInline preload="metadata" className={className} />;
};

export const CirclePage: React.FC = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { profile: myProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const commentsDragControls = useDragControls();
  const membersDragControls = useDragControls();

  const [mounted, setMounted] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Tabs State
  const [activeTab, setActiveTab] = useState<'chat' | 'drops' | 'members'>('chat');

  // Posts / Chat State
  const [page, setPage] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const POSTS_PER_PAGE = 20;
  const [loadingMore, setLoadingMore] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [joining, setJoining] = useState(false);

  // Comments State
  const [activePost, setActivePost] = useState<any>(null);
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [commentActionModal, setCommentActionModal] = useState<any | null>(null);

  // Overlays State
  const [optionsMenuPost, setOptionsMenuPost] = useState<any>(null);
  const [activeDescPost, setActiveDescPost] = useState<any>(null);
  const [fullScreenMedia, setFullScreenMedia] = useState<any[] | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const scrollTimeout = useRef<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Live & Members State
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [membersList, setMembersList] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [liveStats, setLiveStats] = useState({ active: 0, typing: 0, giftsSent: 0 });

  const stateRef = useRef({
    comments: false, options: false, desc: false,
    fullscreen: false, commentAction: false, create: false,
  });

  useEffect(() => { setMounted(true); setPortalReady(true); }, []);

  useEffect(() => {
    stateRef.current = {
      comments: !!activeCommentsPostId, options: !!optionsMenuPost, desc: !!activeDescPost,
      fullscreen: !!fullScreenMedia, commentAction: !!commentActionModal, create: showCreatePost,
    };
  }, [activeCommentsPostId, optionsMenuPost, activeDescPost, fullScreenMedia, commentActionModal, showCreatePost]);

  useEffect(() => {
    const handlePopState = () => {
      const s = stateRef.current;
      if (s.commentAction) setCommentActionModal(null);
      else if (s.comments) { setActiveCommentsPostId(null); setActivePost(null); setReplyingTo(null); }
      else if (s.options) setOptionsMenuPost(null);
      else if (s.desc) setActiveDescPost(null);
      else if (s.fullscreen) setFullScreenMedia(null);
      else if (s.create) { setShowCreatePost(false); setEditingPost(null); }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openOverlay = (action: () => void) => { window.history.pushState({ overlay: true }, ''); action(); };
  const closeOverlay = () => { window.history.back(); };

  useEffect(() => {
    fetchCircleData();
    const channel = supabase.channel(`circle_${slug}`).on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
      if (page === 0) fetchCircleData();
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [slug]);

  useEffect(() => {
    if (!currentUserId || !myProfile || !data?.circle?.id) return;
    const presenceChannel = supabase.channel(`presence_${data.circle.id}`, { config: { presence: { key: currentUserId } } });
    
    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      const activeUsers = Object.values(state).map((s: any) => s[0]);
      const uniqueUsers = Array.from(new Map(activeUsers.map(item => [item.id, item])).values());
      setOnlineUsers(uniqueUsers);
      setLiveStats(prev => ({ ...prev, active: uniqueUsers.length > 0 ? uniqueUsers.length : prev.active }));
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({ id: currentUserId, full_name: myProfile.full_name, username: myProfile.username, avatar_url: myProfile.avatar_url });
      }
    });
    return () => { supabase.removeChannel(presenceChannel); };
  }, [currentUserId, myProfile, data?.circle?.id]);

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
        if (memberData) {
          isMember = true;
          membership = memberData;
        }
      }

      const { data: pData } = await supabase.from('posts')
        .select('*, profiles!user_id(*), likes(user_id), comments(id)')
        .eq('circle_id', circle.id)
        .order('created_at', { ascending: false })
        .limit(POSTS_PER_PAGE);

      let formattedPosts: any[] = [];
      if (pData) {
        formattedPosts = pData.map((p: any) => ({
          ...p,
          likes_count: p.likes?.length || 0,
          comments_count: p.comments?.length || 0,
          is_liked: !!uid && p.likes?.some((l: any) => l.user_id === uid),
        }));
      }

      // חברי מועדון לטאב חברים
      fetchMembersList(circle.id);

      // סטטיסטיקות לייב מזויפות (FOMO Engine)
      setLiveStats({
        active: Math.max(1, Math.floor((circle.members_count || 10) * 0.2 + Math.random() * 5)),
        typing: Math.floor(Math.random() * 4),
        giftsSent: Math.floor(Math.random() * 200) * 10
      });

      setPage(0);
      setHasMorePosts(pData?.length === POSTS_PER_PAGE);
      setData({ circle, isMember, membership, posts: formattedPosts });
    } catch { navigate('/'); } finally { setLoading(false); }
  };

  const fetchMembersList = async (circleId: string) => {
    try {
      const { data: membersData } = await supabase.from('circle_members').select('role, profiles(*)').eq('circle_id', circleId);
      if (membersData) setMembersList(membersData.sort((a, b) => (a.role === 'admin' ? -1 : b.role === 'admin' ? 1 : 0)));
    } catch (err) {}
  };

  const loadMorePosts = async () => {
    if (loadingMore || !hasMorePosts || !data?.circle) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const { data: pData } = await supabase.from('posts')
        .select('*, profiles!user_id(*), likes(user_id), comments(id)')
        .eq('circle_id', data.circle.id)
        .order('created_at', { ascending: false })
        .range(nextPage * POSTS_PER_PAGE, (nextPage + 1) * POSTS_PER_PAGE - 1);

      if (pData && pData.length > 0) {
        const formatted = pData.map((p: any) => ({
          ...p,
          likes_count: p.likes?.length || 0,
          comments_count: p.comments?.length || 0,
          is_liked: !!currentUserId && p.likes?.some((l: any) => l.user_id === currentUserId),
        }));
        setData((curr: any) => ({ ...curr, posts: [...curr.posts, ...formatted] }));
        setPage(nextPage);
        if (pData.length < POSTS_PER_PAGE) setHasMorePosts(false);
      } else {
        setHasMorePosts(false);
      }
    } catch (err) { toast.error('שגיאה בטעינת פוסטים נוספים'); } finally { setLoadingMore(false); }
  };

  const handleJoin = async (tier: 'INNER' | 'CORE') => {
    if (!currentUserId) return toast.error('יש להתחבר תחילה');
    const reqLevel = data.circle.min_level || 1;
    const curLevel = myProfile?.level || 1;
    if (curLevel < reqLevel) { triggerFeedback('error'); return toast.error(`הסלקטור חסם אותך. דרושה רמה ${reqLevel}.`); }
    
    setJoining(true); triggerFeedback('pop');
    
    try {
      if (data.isMember) {
        // Upgrade flow if already member
        await apiFetch(`/api/circles/${data.circle.slug}/upgrade`, { method: 'POST', headers: { 'x-user-id': currentUserId }, body: JSON.stringify({ tier }) });
        triggerFeedback('success'); toast.success(`שודרגת ל-${tier}! 👑`);
      } else {
        // New join flow
        await apiFetch(`/api/circles/${data.circle.slug}/join`, { method: 'POST', headers: { 'x-user-id': currentUserId } });
        triggerFeedback('success'); toast.success('ברוך הבא למועדון! 🎉');
      }
      fetchCircleData();
    } catch (err: any) { 
      toast.error(err?.message || 'שגיאה בהצטרפות/שדרוג'); 
    } finally { 
      setJoining(false); 
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) setSelectedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePost = async (isGift = false, giftAmount = 0) => {
    if (!newPost.trim() && !selectedFile && !editingPost && !isGift) return;
    setPosting(true);
    try {
      if (isGift) {
        if ((myProfile?.credits || 0) < giftAmount) {
          toast.error('אין לך מספיק CRD. קפוץ לארנק.');
          setPosting(false);
          return;
        }
        triggerFeedback('coin');
      }

      if (editingPost) {
        await supabase.from('posts').update({ content: newPost.trim() }).eq('id', editingPost.id);
        toast.success('עודכן בהצלחה'); closeOverlay();
      } else {
        let media_url: string | null = null;
        let media_type = 'text';
        if (selectedFile) {
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
          const { data: uploadData, error: uploadError } = await supabase.storage.from('feed_images').upload(fileName, selectedFile);
          if (uploadError) throw uploadError;
          if (uploadData) {
            media_url = supabase.storage.from('feed_images').getPublicUrl(uploadData.path).data.publicUrl;
            media_type = selectedFile.type.startsWith('video/') ? 'video' : 'image';
          }
        }
        
        const { data: insertedPost, error } = await supabase.from('posts').insert({
          circle_id: data.circle.id,
          user_id: currentUserId,
          content: newPost.trim() || (isGift ? `שלח מתנה בשווי ${giftAmount} CRD 🎁` : ''),
          media_url,
          media_type,
        }).select('*, profiles!user_id(*), likes(user_id), comments(id)').single();

        if (error) throw error;
        
        if (insertedPost) {
          // If it's a gift, we append it visually to look like a highlighted message
          const newMsg = { ...insertedPost, likes_count: 0, comments_count: 0, is_liked: false, gift_amount: giftAmount };
          setData((curr: any) => ({ ...curr, posts: [newMsg, ...curr.posts] }));
        }
      }
      setNewPost(''); setSelectedFile(null); setEditingPost(null); triggerFeedback('pop');
    } catch { toast.error('שגיאה בשליחה'); } finally { setPosting(false); }
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    if (!currentUserId) return;
    triggerFeedback('pop');
    const update = (list: any[]) => list.map((p) => p.id === postId ? { ...p, is_liked: !isLiked, likes_count: isLiked ? Math.max(0, p.likes_count - 1) : p.likes_count + 1 } : p);
    setData((curr: any) => ({ ...curr, posts: update(curr.posts) }));
    if (fullScreenMedia) setFullScreenMedia(update(fullScreenMedia));
    try {
      if (isLiked) await supabase.from('likes').delete().match({ post_id: postId, user_id: currentUserId });
      else await supabase.from('likes').insert({ post_id: postId, user_id: currentUserId });
    } catch {}
  };

  const submitComment = async () => {
    if (!newComment.trim() || !activePost || !currentUserId) return;
    try {
      if (editingCommentId) {
        await supabase.from('comments').update({ content: newComment.trim() }).eq('id', editingCommentId);
        setComments((prev) => prev.map((c) => (c.id === editingCommentId ? { ...c, content: newComment.trim() } : c)));
        setEditingCommentId(null);
      } else {
        const payload: any = { post_id: activePost.id, user_id: currentUserId, content: newComment.trim() };
        if (replyingTo) payload.parent_id = replyingTo.id;
        const { data: inserted, error } = await supabase.from('comments').insert(payload).select('*, profiles(*)').single();
        if (error) throw error;
        if (inserted) {
          setComments((prev) => [...prev, inserted]);
          const update = (list: any[]) => list.map((p) => p.id === activePost.id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p);
          setData((curr: any) => ({ ...curr, posts: update(curr.posts) }));
          if (fullScreenMedia) setFullScreenMedia(update(fullScreenMedia));
          if (replyingTo) setExpandedThreads((prev) => ({ ...prev, [replyingTo.id]: true }));
          triggerFeedback('coin');
        }
      }
      setNewComment(''); setReplyingTo(null);
    } catch { toast.error('שגיאה בשרת'); }
  };

  const deleteComment = async (commentId: string) => {
    triggerFeedback('error');
    setComments((curr) => curr.filter((c) => c && c.id !== commentId && c.parent_id !== commentId));
    const update = (list: any[]) => list.map((p) => p.id === activePost?.id ? { ...p, comments_count: Math.max(0, (p.comments_count || 0) - 1) } : p);
    setData((curr: any) => ({ ...curr, posts: update(curr.posts) }));
    if (fullScreenMedia) setFullScreenMedia(update(fullScreenMedia));
    try { await supabase.from('comments').delete().eq('id', commentId); } catch {}
  };

  const deletePost = async (postId: string) => {
    triggerFeedback('error'); closeOverlay();
    setData((curr: any) => ({ ...curr, posts: curr.posts.filter((p: any) => p.id !== postId) }));
    try { await supabase.from('posts').delete().eq('id', postId); } catch { toast.error('שגיאה במחיקת פוסט'); }
  };

  const handleShare = async (post: any) => {
    triggerFeedback('pop');
    const publicUrl = `https://inner-app.com/post/${post.id}`;
    try {
      const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor && (window as any).Capacitor.isNativePlatform?.();
      if (isNative) { await Share.share({ title: 'INNER', text: post.content || 'צפה בפוסט ב-INNER', url: publicUrl }); }
      else if (navigator.share && window.isSecureContext) { await navigator.share({ title: 'INNER', text: post.content || 'צפה בפוסט ב-INNER', url: publicUrl }); }
      else { await navigator.clipboard.writeText(publicUrl); toast.success('הקישור הועתק'); }
    } catch {}
  };

  const handleCopyLink = async (post: any) => {
    const url = `https://inner-app.com/post/${post.id}`;
    try { await navigator.clipboard.writeText(url); toast.success('הקישור הועתק ללוח', { icon: '🔗' }); } catch { toast.error('שגיאה בהעתקה'); }
    closeOverlay();
  };

  const handleDownloadMedia = async (mediaUrl: string) => {
    try {
      toast.loading('מוריד קובץ...', { id: 'dl' });
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `INNER_${Date.now()}`;
      document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a);
      toast.success('נשמר בהצלחה', { id: 'dl' });
    } catch { toast.error('שגיאה בהורדה', { id: 'dl' }); }
    closeOverlay();
  };

  const toggleCommentLike = (commentId: string) => {
    setLikedComments((prev) => { const next = new Set(prev); if (next.has(commentId)) next.delete(commentId); else next.add(commentId); return next; });
    triggerFeedback('pop');
  };

  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (scrollTimeout.current) return;
    scrollTimeout.current = setTimeout(() => {
      scrollTimeout.current = null;
      const index = Math.round(target.scrollTop / target.clientHeight);
      if (index !== currentMediaIndex) setCurrentMediaIndex(index);
      if (target.scrollHeight - target.scrollTop <= target.clientHeight * 2 && fullScreenMedia) {
        const mediaPosts = data.posts.filter((p: any) => p.media_url);
        if (mediaPosts.length > 0) {
          const more = Array.from({ length: 3 }).map(() => mediaPosts[Math.floor(Math.random() * mediaPosts.length)]);
          setFullScreenMedia((prev) => [...(prev || []), ...more.map((p) => ({ ...p, _uid: Math.random().toString() }))]);
        }
      }
    }, 150);
  };

  const stopPropagation = (e: any) => e.stopPropagation();

  if (loading || !data) return <div className="min-h-screen bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" /></div>;

  const { circle, isMember, membership, posts } = data;
  const requiredLevel = circle.min_level || 1;
  const currentLevel = myProfile?.level || 1;
  const levelTooLow = requiredLevel > currentLevel;

  const portalTarget = typeof document !== 'undefined' ? document.body || document.getElementById('root') : null;

  return (
    <>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />

      <FadeIn className="bg-surface min-h-screen font-sans flex flex-col relative overflow-x-hidden pb-0" dir="rtl">
        
        {/* 🔝 HERO SECTION */}
        <div className="relative w-full h-64 bg-black overflow-hidden shrink-0">
          {circle.cover_url ? (
            <img src={circle.cover_url} className="w-full h-full object-cover opacity-50 mix-blend-luminosity" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/20 to-surface"></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-transparent"></div>
          
          <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col items-center text-center pb-8">
            <h1 className="text-3xl font-black text-white drop-shadow-lg tracking-tight mb-2">{circle.name}</h1>
            <p className="text-brand-muted text-[13px] font-medium max-w-[280px] line-clamp-2 leading-relaxed">{circle.description}</p>
            
            {/* User Status Badge */}
            {isMember && (
              <div className="mt-4 bg-white/10 backdrop-blur-md border border-white/20 px-4 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                <Crown size={14} className={membership?.tier === 'CORE' ? 'text-yellow-400' : 'text-brand-muted'} />
                <span className="text-[11px] font-black text-white uppercase tracking-widest">{membership?.tier || 'INNER'} MEMBER</span>
              </div>
            )}
          </div>
        </div>

        {/* 🎯 STATS LIVE */}
        <div className="flex justify-center items-center gap-3 py-4 border-b border-surface-border shrink-0 bg-surface -mt-4 relative z-10 rounded-t-[32px]">
          <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-md">
            <Eye size={12} className="text-green-500" />
            <span className="text-[10px] font-black text-green-400">{liveStats.active} עכשיו בפנים</span>
          </div>
          <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-md">
            <Flame size={12} className="text-red-500 animate-pulse" />
            <span className="text-[10px] font-black text-red-400">{liveStats.typing} מדברים</span>
          </div>
          <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-md">
            <Gift size={12} className="text-yellow-500" />
            <span className="text-[10px] font-black text-yellow-400">{liveStats.giftsSent} CRD היום</span>
          </div>
        </div>

        {/* 💎 JOIN AREA (If not member) */}
        {!isMember ? (
          <div className="flex-1 flex flex-col items-center p-6 gap-5 mt-4">
            <div className="w-20 h-20 rounded-[24px] bg-surface-card border border-surface-border flex items-center justify-center mb-2 shadow-2xl">
              {levelTooLow ? <ShieldAlert size={32} className="text-accent-primary" /> : <Lock size={32} className="text-brand-muted" />}
            </div>
            
            <div className="text-center px-4">
              <h2 className="text-2xl font-black text-brand mb-2">{levelTooLow ? 'נעול ע"י הסלקטור' : 'מועדון סגור'}</h2>
              <p className="text-brand-muted text-sm font-medium leading-relaxed">
                {levelTooLow ? `כדי להיכנס אתה חייב להיות לפחות רמה ${requiredLevel}. תהיה פעיל ותחזור כשתעלה רמה.` : 'הצטרף כדי לפתוח גישה מלאה לתוכן, לדרופים הסודיים וללייב צ׳אט.'}
              </p>
            </div>
            
            {!levelTooLow && (
              <div className="w-full flex flex-col gap-3 mt-4">
                <Button onClick={() => handleJoin('INNER')} disabled={joining} className="w-full h-14 bg-surface-card border border-surface-border text-brand font-black rounded-2xl shadow-lg active:scale-95 transition-transform">
                  {joining ? <Loader2 size={18} className="animate-spin" /> : `כניסה רגילה - ${circle.join_price} CRD`}
                </Button>
                
                <Button onClick={() => handleJoin('CORE')} disabled={joining} className="w-full h-14 bg-gradient-to-r from-purple-600/80 to-accent-primary/80 border border-accent-primary/50 text-white font-black rounded-2xl shadow-[0_0_20px_rgba(168,85,247,0.2)] flex items-center justify-center gap-2 active:scale-95 transition-transform">
                  {joining ? <Loader2 size={18} className="animate-spin" /> : <><Crown size={18} className="text-yellow-400" /> שדרוג ל-CORE - {circle.vip_price} CRD</>}
                </Button>
                <span className="text-[10px] font-bold text-accent-primary tracking-widest uppercase text-center w-full block">כולל תג כתר יוקרתי והודעות מודגשות</span>
              </div>
            )}
          </div>
        ) : (
          /* 📱 TABS AREA */
          <div className="flex flex-col flex-1 pb-20">
            <div className="flex border-b border-surface-border shrink-0 px-2 mt-2">
              {['chat', 'drops', 'members'].map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`flex-1 py-3 text-[12px] font-black uppercase tracking-widest transition-colors rounded-t-2xl ${activeTab === tab ? 'text-accent-primary bg-accent-primary/10 border-b-2 border-accent-primary' : 'text-brand-muted hover:text-brand'}`}
                >
                  {tab === 'chat' ? 'לייב צ׳אט' : tab === 'drops' ? 'דרופים' : 'חברים'}
                </button>
              ))}
            </div>

            {/* 💬 LIVE CHAT / POSTS */}
            {activeTab === 'chat' && (
              <div className="flex flex-col flex-1 bg-surface relative min-h-[50vh]">
                
                {/* Chat Feed */}
                <div className="flex-1 p-4 flex flex-col gap-6">
                  {posts?.map((post: any) => {
                    const hasMedia = !!post.media_url;
                    const isVideo = post.media_url?.match(/\.(mp4|webm|mov)$/i);
                    const isMine = post.user_id === currentUserId;
                    const isCore = post.profiles?.role_label === 'CORE' || post.gift_amount > 0;
                    
                    // אם זה רק טקסט, נציג כמו בועת צ'אט כדי להרגיש "חי"
                    if (!hasMedia) {
                      return (
                        <div key={post.id} className={`flex gap-3 w-full ${isMine ? 'flex-row-reverse' : ''}`}>
                          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-white/5 bg-surface cursor-pointer" onClick={() => navigate(`/profile/${post.user_id}`)}>
                            {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full p-1.5 text-brand-muted" />}
                          </div>
                          
                          <div className={`flex flex-col max-w-[80%] ${isMine ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center gap-1.5 mb-1 px-1">
                              <span className="text-[11px] font-bold text-brand-muted">{post.profiles?.full_name || 'אנונימי'}</span>
                              {isCore && <span className="bg-yellow-500/10 text-yellow-500 text-[8px] font-black px-1.5 py-0.5 rounded border border-yellow-500/20 uppercase">CORE</span>}
                            </div>
                            
                            <div className={`p-3.5 rounded-[20px] shadow-sm ${
                              post.gift_amount 
                                ? 'bg-yellow-500/10 border border-yellow-500/30' 
                                : isMine ? 'bg-accent-primary/10 border border-accent-primary/20 rounded-tr-sm' : 'bg-surface-card border border-surface-border rounded-tl-sm'
                            }`}>
                              {post.gift_amount > 0 && (
                                <div className="flex items-center gap-1 text-yellow-500 text-[10px] font-black mb-1.5">
                                  <Gift size={12} /> שלח מתנה {post.gift_amount} CRD
                                </div>
                              )}
                              <p className={`text-[14px] leading-relaxed whitespace-pre-wrap ${post.gift_amount ? 'text-yellow-100' : 'text-brand'}`}>{post.content}</p>
                            </div>
                            
                            {/* פעולות מתחת לבועה */}
                            <div className={`flex items-center gap-3 mt-1.5 px-1 ${isMine ? 'flex-row-reverse' : ''}`}>
                              <button onClick={() => handleLike(post.id, post.is_liked)} className={`flex items-center gap-1 active:scale-90 ${post.is_liked ? 'text-red-500' : 'text-brand-muted'}`}>
                                <Heart size={12} fill={post.is_liked ? 'currentColor' : 'none'} />
                                <span className="text-[10px] font-bold">{post.likes_count}</span>
                              </button>
                              <button onClick={() => openOverlay(() => { setActivePost(post); setActiveCommentsPostId(post.id); setLoadingComments(true); supabase.from('comments').select('*, profiles!user_id(*)').eq('post_id', post.id).order('created_at', { ascending: true }).then((r) => { setComments(r.data || []); setLoadingComments(false); }); })} className="flex items-center gap-1 text-brand-muted active:scale-90">
                                <MessageSquare size={12} />
                                <span className="text-[10px] font-bold">{post.comments_count}</span>
                              </button>
                              <button onClick={() => openOverlay(() => setOptionsMenuPost(post))} className="text-brand-muted active:scale-90 ml-1">
                                <MoreVertical size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // אם יש מדיה, נציג ככרטיס ענק ויפה
                    return (
                      <div key={post.id} className="flex flex-col bg-black border border-white/[0.05] overflow-hidden shadow-xl rounded-[28px] w-full relative">
                        <div className="w-full relative cursor-pointer overflow-hidden bg-black flex flex-col" onClick={() => openOverlay(() => { const vids = posts.filter((p: any) => p.media_url); setFullScreenMedia([post, ...vids.filter((v: any) => v.id !== post.id).sort(() => Math.random() - 0.5)]); setCurrentMediaIndex(0); })}>
                          {isVideo ? (
                            <FeedVideo src={post.media_url} className="w-full max-h-[400px] aspect-[4/5] object-cover" />
                          ) : (
                            <img src={post.media_url} loading="lazy" className="w-full max-h-[400px] aspect-[4/5] object-cover" />
                          )}
                          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none"></div>
                          {post.content && (
                            <div className="absolute bottom-0 left-0 right-0 p-4 pt-32 bg-gradient-to-t from-black via-black/40 to-transparent flex items-end pointer-events-none z-10">
                              <p onClick={(e) => { e.stopPropagation(); openOverlay(() => setActiveDescPost(post)); }} className="text-white text-[14px] font-medium leading-relaxed text-right line-clamp-2 w-full pr-1 cursor-pointer active:opacity-70 pointer-events-auto drop-shadow-md">
                                {post.content}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between px-4 py-3 bg-black">
                          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(`/profile/${post.user_id}`)}>
                            <div className="w-9 h-9 rounded-full bg-surface-card border border-white/[0.05] overflow-hidden shrink-0">
                              {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full p-1.5 text-brand-muted" />}
                            </div>
                            <div className="flex flex-col text-right">
                              <div className="flex items-center gap-1.5">
                                <span className="text-white font-bold text-[13px] leading-tight">{post.profiles?.full_name || 'אנונימי'}</span>
                                {isCore && <Crown size={10} className="text-yellow-400" />}
                              </div>
                              <span className="text-brand-muted text-[10px]">{new Date(post.created_at).toLocaleDateString('he-IL')}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <button onClick={() => handleLike(post.id, post.is_liked)} className={`flex items-center gap-1.5 active:scale-90 ${post.is_liked ? 'text-red-500' : 'text-brand-muted'}`}>
                              <Heart size={18} fill={post.is_liked ? 'currentColor' : 'none'} />
                              <span className="text-[13px] font-black text-white">{post.likes_count}</span>
                            </button>
                            <button onClick={() => openOverlay(() => { setActivePost(post); setActiveCommentsPostId(post.id); setLoadingComments(true); supabase.from('comments').select('*, profiles!user_id(*)').eq('post_id', post.id).order('created_at', { ascending: true }).then((r) => { setComments(r.data || []); setLoadingComments(false); }); })} className="flex items-center gap-1.5 text-brand-muted active:scale-90">
                              <MessageSquare size={18} />
                              <span className="text-[13px] font-black text-white">{post.comments_count}</span>
                            </button>
                            <button onClick={() => openOverlay(() => setOptionsMenuPost(post))} className="text-brand-muted active:scale-90 ml-1">
                              <MoreVertical size={20} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {hasMorePosts && posts.length > 0 && (
                    <div className="flex justify-center mt-2 mb-4">
                      <button onClick={loadMorePosts} disabled={loadingMore} className="bg-surface-card border border-white/[0.05] rounded-full px-6 py-2.5 text-brand font-bold text-[13px] tracking-widest uppercase flex items-center gap-2 shadow-lg active:scale-95 transition-transform">
                        {loadingMore ? <Loader2 size={16} className="animate-spin text-accent-primary" /> : 'טען עוד'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+70px)] left-0 right-0 p-3 bg-surface/90 backdrop-blur-xl border-t border-surface-border flex flex-col gap-2 z-40">
                  {selectedFile && (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden mb-1">
                      {selectedFile.type.startsWith('video/') ? (
                        <video src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover" />
                      ) : (
                        <img src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover" />
                      )}
                      <button onClick={() => setSelectedFile(null)} className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white"><X size={10} /></button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button onClick={() => handlePost(true, 50)} className="w-11 h-11 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500 shrink-0 shadow-inner active:scale-90 transition-transform">
                      <Gift size={20} />
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="w-11 h-11 rounded-full bg-surface-card border border-surface-border flex items-center justify-center text-brand-muted shrink-0 shadow-inner active:scale-90 transition-transform">
                      <Paperclip size={18} />
                    </button>
                    <div className="flex-1 bg-surface-card border border-surface-border rounded-full flex items-center px-4 h-11 shadow-inner">
                      <input 
                        type="text" 
                        value={newPost} 
                        onChange={(e) => setNewPost(e.target.value)} 
                        placeholder="הודעה..." 
                        className="flex-1 bg-transparent border-none outline-none text-brand text-[15px]"
                      />
                      <button onClick={() => handlePost(false)} disabled={posting || (!newPost.trim() && !selectedFile)} className="text-accent-primary disabled:opacity-50 active:scale-90 transition-transform pr-2">
                        {posting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="rtl:-scale-x-100" />}
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* 📦 DROPS (Locked Content FOMO) */}
            {activeTab === 'drops' && (
              <div className="flex-1 p-4 grid grid-cols-2 gap-3 bg-surface min-h-[50vh]">
                {[1, 2, 3, 4].map((drop) => (
                  <div key={drop} className="aspect-[3/4] bg-surface-card rounded-[24px] border border-surface-border overflow-hidden relative group cursor-pointer shadow-lg">
                    <img src={`https://source.unsplash.com/random/400x600?sig=${drop}`} className="w-full h-full object-cover blur-xl opacity-60 scale-110" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-black/40 gap-3">
                      <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                        <Lock size={20} className="text-white" />
                      </div>
                      <span className="text-[10px] font-black text-white uppercase tracking-widest text-center bg-black/40 px-3 py-1.5 rounded-md backdrop-blur-sm border border-white/10">
                        דרופ ל-CORE בלבד
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 👥 MEMBERS */}
            {activeTab === 'members' && (
              <div className="flex-1 p-4 flex flex-col gap-3 bg-surface min-h-[50vh]">
                {membersList.length === 0 ? (
                  <div className="text-center text-brand-muted text-sm mt-10 font-bold">אין חברים במועדון</div>
                ) : (
                  membersList.map((member) => (
                    <div key={member.profiles?.id} onClick={() => navigate(`/profile/${member.profiles?.id}`)} className="flex items-center gap-4 bg-surface-card p-3 rounded-[24px] border border-surface-border cursor-pointer active:scale-95 transition-transform shadow-sm">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-surface border border-surface-border shrink-0">
                        {member.profiles?.avatar_url ? <img src={member.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full p-2 text-brand-muted" />}
                      </div>
                      <div className="flex flex-col flex-1 text-right">
                        <span className="text-brand font-black text-[15px] flex items-center gap-1.5">
                          {member.profiles?.full_name || 'אנונימי'} 
                          {member.role === 'admin' && <Crown size={12} className="text-accent-primary" />}
                        </span>
                        <span className="text-brand-muted text-[11px] font-bold mt-0.5" dir="ltr">@{member.profiles?.username || 'user'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

          </div>
        )}
      </FadeIn>

      {/* OVERLAYS (Bottom Sheets) */}
      {portalReady && portalTarget && createPortal(
        <>
          <AnimatePresence>
            {/* FULL SCREEN MEDIA */}
            {fullScreenMedia && (
              <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed inset-0 z-[999999] bg-[#000]">
                <div className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide" onScroll={handleContainerScroll}>
                  {fullScreenMedia.map((vid, idx) => {
                    const isVid = vid.media_url?.match(/\.(mp4|webm|mov)$/i);
                    const keyVal = vid._uid ? vid._uid : `${vid.id}-${idx}`;
                    return (
                      <div key={keyVal} className="w-full h-screen snap-center relative bg-[#000] flex items-center justify-center">
                        {isVid ? <video src={vid.media_url} loop playsInline className="w-full h-full object-cover full-media-item" onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())} /> : <img src={vid.media_url} className="w-full h-full object-contain full-media-item" onError={(e) => { e.currentTarget.src = 'https://placehold.co/500x500/111/333?text=Media+Unavailable'; }} />}
                        <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setOptionsMenuPost(vid)); }} className="absolute bottom-6 left-4 z-[60] active:scale-90 transition-transform drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"><MoreVertical size={26} strokeWidth={2.5} className="text-white" /></button>
                        <div className="absolute bottom-48 left-4 flex flex-col gap-6 items-center z-50">
                          <button onClick={(e) => { e.stopPropagation(); handleLike(vid.id, vid.is_liked); }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform"><Heart size={30} className={vid.is_liked ? 'text-[#ff4757]' : 'text-white'} fill={vid.is_liked ? 'currentColor' : 'none'} strokeWidth={1.5} /><span className="text-white text-[13px] font-black drop-shadow-md">{vid.likes_count}</span></button>
                          <button onClick={(e) => { e.stopPropagation(); openOverlay(() => { setActivePost(vid); setActiveCommentsPostId(vid.id); setLoadingComments(true); supabase.from('comments').select('*, profiles!user_id(*)').eq('post_id', vid.id).order('created_at', { ascending: true }).then((r) => { setComments(r.data || []); setLoadingComments(false); }); }); }} className="flex flex-col items-center gap-1 active:scale-90 transition-transform"><MessageSquare size={30} className="text-white" strokeWidth={1.5} /><span className="text-white text-[13px] font-black drop-shadow-md">{vid.comments_count}</span></button>
                          <button onClick={(e) => { e.stopPropagation(); handleShare(vid); }} className="active:scale-90 transition-transform"><Share2 size={30} className="text-white" strokeWidth={1.5} /></button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-surface/90 via-surface/40 to-transparent flex flex-col justify-end pointer-events-none">
                          <div className="flex items-center gap-3 mb-2 cursor-pointer w-fit pr-2 pointer-events-auto" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${vid.user_id}`), 50); }}>
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-card border-2 border-white/[0.05] shrink-0 shadow-lg">{vid.profiles?.avatar_url ? <img src={vid.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={24} className="text-brand-muted w-full h-full p-2" />}</div>
                            <span className="text-white font-black text-[17px] drop-shadow-md">{vid.profiles?.full_name || 'אנונימי'}</span>
                          </div>
                          <p className="text-white text-[15px] font-medium text-right pr-2 w-5/6 line-clamp-3 pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); openOverlay(() => setActiveDescPost(vid)); }}>{vid.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* COMMENTS */}
            {activeCommentsPostId && (
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" dir="rtl" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="relative z-10 bg-white rounded-t-[40px] h-[85vh] flex flex-col overflow-hidden pb-10 shadow-[0_-20px_50px_rgba(0,0,0,0.15)] border-t border-black/[0.05]">
                  <div className="w-full py-5 flex justify-center cursor-grab active:cursor-grabbing border-b border-black/[0.05]" onPointerDown={(e) => commentsDragControls.start(e)} style={{ touchAction: 'none' }}><div className="w-16 h-1.5 bg-black/10 rounded-full" /></div>
                  <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-hide">
                    {loadingComments ? <Loader2 className="animate-spin mx-auto text-accent-primary mt-10" /> : comments.filter((c) => c && !c.parent_id).map((c) => {
                      const replies = comments.filter((r) => r && r.parent_id === c.id);
                      return (
                        <div key={c.id} className="flex flex-col gap-2">
                          <div className="flex gap-3">
                            <div className="w-10 h-10 min-w-[40px] rounded-full bg-neutral-100 shrink-0 overflow-hidden cursor-pointer border border-neutral-200 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>
                              {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover object-center" /> : <UserCircle className="w-full h-full p-2 text-neutral-400" />}
                            </div>
                            <div className="flex flex-col flex-1">
                              <div className="bg-neutral-100 p-3 rounded-[24px] rounded-tr-sm cursor-pointer" onClick={() => openOverlay(() => setCommentActionModal(c))}>
                                <span className="text-black font-bold text-xs mb-1 inline-block" onClick={(e) => { e.stopPropagation(); closeOverlay(); setTimeout(() => navigate(`/profile/${c.user_id}`), 50); }}>{c.profiles?.full_name || 'אנונימי'}</span>
                                <p className="text-neutral-700 text-sm whitespace-pre-wrap leading-relaxed">{c.content}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="p-4 bg-white border-t border-neutral-200 flex gap-2 pb-8">
                    <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="הוסף תגובה..." className="flex-1 bg-neutral-100 border border-neutral-200 text-black rounded-full px-5 outline-none text-[15px] placeholder:text-neutral-400" />
                    <Button onClick={submitComment} disabled={!newComment.trim()} className="w-14 h-14 p-0 rounded-full shrink-0 bg-accent-primary text-white shadow-md hover:bg-accent-primary/90"><Send size={20} className="rtl:-scale-x-100 -ml-1" /></Button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* OPTIONS MENU */}
            {optionsMenuPost && (
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-white rounded-t-[40px] p-6 flex flex-col gap-2 pb-12 shadow-[0_-10px_50px_rgba(0,0,0,0.15)] border-t border-black/[0.05]">
                  <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-black/10 rounded-full" /></div>
                  <button onClick={() => { closeOverlay(); setTimeout(() => handleShare(optionsMenuPost), 100); }} className="w-full p-4 bg-neutral-100 rounded-full text-black font-bold flex justify-between items-center text-lg active:bg-neutral-200 transition-colors border border-neutral-200/50"><span>שתף פוסט</span><Share2 size={20} className="text-neutral-500" /></button>
                  {optionsMenuPost.media_url && <button onClick={() => handleDownloadMedia(optionsMenuPost.media_url)} className="w-full p-4 bg-neutral-100 rounded-full text-black font-bold flex justify-between items-center text-lg active:bg-neutral-200 transition-colors mt-2 border border-neutral-200/50"><span>שמור למכשיר</span><Download size={20} className="text-neutral-500" /></button>}
                  <button onClick={async () => { try { await supabase.from('saved_posts').insert({ user_id: currentUserId, post_id: optionsMenuPost.id }); toast.success('הפוסט נשמר במועדפים!'); } catch { toast.error('הפוסט כבר שמור אצלך'); } closeOverlay(); }} className="w-full p-4 bg-neutral-100 rounded-full text-black font-bold flex justify-between items-center text-lg active:bg-neutral-200 transition-colors mt-2 border border-neutral-200/50"><span>שמור במועדפים</span><Bookmark size={20} className="text-neutral-500" /></button>
                  <button onClick={() => handleCopyLink(optionsMenuPost)} className="w-full p-4 bg-neutral-100 rounded-full text-black font-bold flex justify-between items-center text-lg active:bg-neutral-200 transition-colors mt-2 border border-neutral-200/50"><span>העתק קישור</span><LinkIcon size={20} className="text-neutral-500" /></button>
                  {optionsMenuPost.user_id === currentUserId && (
                    <>
                      <button onClick={() => { closeOverlay(); setTimeout(() => { openOverlay(() => { setEditingPost(optionsMenuPost); setNewPost(optionsMenuPost.content || ''); setShowCreatePost(true); }); }, 100); }} className="w-full p-4 bg-neutral-100 rounded-full text-black font-bold flex justify-between items-center text-lg active:bg-neutral-200 transition-colors mt-4 border border-neutral-200/50"><span>ערוך פוסט</span><Edit2 size={20} className="text-neutral-500" /></button>
                      <button onClick={() => { if (window.confirm('למחוק פוסט?')) { deletePost(optionsMenuPost.id); } }} className="w-full p-4 bg-red-50 border border-red-100 rounded-full text-red-500 font-bold flex justify-between items-center text-lg mt-2 active:bg-red-100 transition-colors"><span>מחק פוסט</span><Trash2 size={20} className="text-red-500" /></button>
                    </>
                  )}
                </motion.div>
              </div>
            )}

            {/* DESC POST */}
            {activeDescPost && (
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm" onClick={closeOverlay} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-white rounded-t-[40px] flex flex-col overflow-hidden pb-10 max-h-[75vh] shadow-[0_-10px_50px_rgba(0,0,0,0.15)] border-t border-black/[0.05]">
                  <div className="w-full py-6 flex justify-center cursor-grab active:cursor-grabbing border-b border-neutral-200/50"><div className="w-16 h-1.5 bg-black/10 rounded-full" /></div>
                  <div className="px-6 py-4 border-b border-neutral-200/50"><h2 className="text-black font-black text-lg text-center">תיאור מלא</h2></div>
                  <div className="p-6 overflow-y-auto" onPointerDown={stopPropagation} onTouchStart={stopPropagation}><p className="text-neutral-700 text-[15px] leading-relaxed text-right whitespace-pre-wrap">{activeDescPost.content}</p></div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>,
        portalTarget
      )}
    </>
  );
};
