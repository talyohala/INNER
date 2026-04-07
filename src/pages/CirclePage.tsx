import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { FadeIn, Button } from '../components/ui';
import {
  Loader2, MessageSquare, Heart, Crown, Send, Lock, UserCircle, Trash2, Edit2, MoreVertical, Paperclip, Share2, Download, Link as LinkIcon, Bookmark, ShieldAlert, Gift, Flame, Eye, ChevronDown, ChevronUp, Reply, X
} from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { Share } from '@capacitor/share';
import { useAuth } from '../context/AuthContext';

const RealFlame: React.FC = () => (
  <motion.span animate={{ scale: [1, 1.15, 1], rotate: [0, -5, 5, 0] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }} className="text-[12px] inline-block">🔥</motion.span>
);

const FeedVideo = ({ src, className }: { src: string; className?: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) videoRef.current?.play().catch(() => {});
      else videoRef.current?.pause();
    }, { threshold: 0.4 });
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

  const [mounted, setMounted] = useState(false);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<'chat' | 'drops' | 'members'>('chat');

  // Posts & Chat feed
  const [page, setPage] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const POSTS_PER_PAGE = 20;
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Input State
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [replyingToPost, setReplyingToPost] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // Threads / Comments
  const [postComments, setPostComments] = useState<Record<string, any[]>>({});
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});

  // Overlays
  const [optionsMenuPost, setOptionsMenuPost] = useState<any>(null);
  const [activeDescPost, setActiveDescPost] = useState<any>(null);
  const [fullScreenMedia, setFullScreenMedia] = useState<any[] | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const scrollTimeout = useRef<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Live Stats
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [membersList, setMembersList] = useState<any[]>([]);
  const [liveStats, setLiveStats] = useState({ active: 0, typing: 0, giftsSent: 0 });

  useEffect(() => { 
    setMounted(true); 
    setPortalNode(document.getElementById('root') || document.body);
  }, []);

  const openOverlay = (action: () => void) => { window.history.pushState({ overlay: true }, ''); action(); };
  const closeOverlay = () => { window.history.back(); };

  useEffect(() => {
    const handlePopState = () => {
      if (optionsMenuPost) setOptionsMenuPost(null);
      else if (activeDescPost) setActiveDescPost(null);
      else if (fullScreenMedia) setFullScreenMedia(null);
      else if (editingPost) setEditingPost(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [optionsMenuPost, activeDescPost, fullScreenMedia, editingPost]);

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
        if (memberData) { isMember = true; membership = memberData; }
      }

      const { data: pData } = await supabase.from('posts')
        .select('*, profiles!user_id(*), likes(user_id), comments(id)')
        .eq('circle_id', circle.id).order('created_at', { ascending: false }).limit(POSTS_PER_PAGE);

      let formattedPosts: any[] = [];
      if (pData) {
        formattedPosts = pData.map((p: any) => ({
          ...p, likes_count: p.likes?.length || 0, comments_count: p.comments?.length || 0, is_liked: !!uid && p.likes?.some((l: any) => l.user_id === uid),
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
      const { data: pData } = await supabase.from('posts').select('*, profiles!user_id(*), likes(user_id), comments(id)')
        .eq('circle_id', data.circle.id).order('created_at', { ascending: false }).range(nextPage * POSTS_PER_PAGE, (nextPage + 1) * POSTS_PER_PAGE - 1);

      if (pData && pData.length > 0) {
        const formatted = pData.map((p: any) => ({
          ...p, likes_count: p.likes?.length || 0, comments_count: p.comments?.length || 0, is_liked: !!currentUserId && p.likes?.some((l: any) => l.user_id === currentUserId),
        }));
        setData((curr: any) => ({ ...curr, posts: [...curr.posts, ...formatted] }));
        setPage(nextPage);
        if (pData.length < POSTS_PER_PAGE) setHasMorePosts(false);
      } else setHasMorePosts(false);
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
        await apiFetch(`/api/circles/${data.circle.slug}/upgrade`, { method: 'POST', headers: { 'x-user-id': currentUserId }, body: JSON.stringify({ tier }) });
        triggerFeedback('success'); toast.success(`שודרגת ל-${tier}! 👑`);
      } else {
        await apiFetch(`/api/circles/${data.circle.slug}/join`, { method: 'POST', headers: { 'x-user-id': currentUserId } });
        triggerFeedback('success'); toast.success('ברוך הבא למועדון! 🎉');
      }
      fetchCircleData();
    } catch (err: any) { toast.error(err?.message || 'שגיאה בהצטרפות/שדרוג'); } finally { setJoining(false); }
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
        if ((myProfile?.credits || 0) < giftAmount) { toast.error('אין לך מספיק CRD. קפוץ לארנק.'); setPosting(false); return; }
        triggerFeedback('coin');
      }

      // Reply to Thread
      if (replyingToPost && !isGift) {
        const { data: inserted, error } = await supabase.from('comments').insert({ post_id: replyingToPost, user_id: currentUserId, content: newPost.trim() }).select('*, profiles(*)').single();
        if (error) throw error;
        if (inserted) {
          setPostComments((prev) => ({ ...prev, [replyingToPost]: [...(prev[replyingToPost] || []), inserted] }));
          const update = (list: any[]) => list.map((p) => p.id === replyingToPost ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p);
          setData((curr: any) => ({ ...curr, posts: update(curr.posts) }));
          setExpandedThreads((prev) => ({ ...prev, [replyingToPost]: true }));
          triggerFeedback('pop');
        }
        setReplyingToPost(null);
        setNewPost('');
        setPosting(false);
        return;
      }

      // Edit Main Post
      if (editingPost) {
        const { error } = await supabase.from('posts').update({ content: newPost.trim() }).eq('id', editingPost.id);
        if (error) throw error;
        toast.success('עודכן בהצלחה'); closeOverlay();
      } else {
        // Create Main Post (Text or Media)
        let media_url: string | null = null;
        let media_type = 'text';
        
        if (selectedFile) {
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
          const { data: uploadData, error: uploadError } = await supabase.storage.from('feed_images').upload(fileName, selectedFile);
          
          if (uploadError) {
             throw new Error('שגיאה בהעלאת התמונה: ' + uploadError.message);
          }
          
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
          media_type
        }).select('*, profiles!user_id(*), likes(user_id), comments(id)').single();

        if (error) throw error;
        
        if (insertedPost) {
          const newMsg = { ...insertedPost, likes_count: 0, comments_count: 0, is_liked: false, gift_amount: isGift ? giftAmount : 0 };
          setData((curr: any) => ({ ...curr, posts: [newMsg, ...curr.posts] }));
        }
      }
      
      setNewPost(''); 
      setSelectedFile(null); 
      setEditingPost(null); 
      triggerFeedback('pop');
    } catch (err: any) { 
      toast.error(err.message || 'שגיאה בשליחת ההודעה'); 
    } finally { 
      setPosting(false); 
    }
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

  const toggleThread = async (postId: string) => {
    triggerFeedback('pop');
    const isExpanded = expandedThreads[postId];
    setExpandedThreads(prev => ({...prev, [postId]: !isExpanded}));
    
    if (!isExpanded && !postComments[postId]) {
      const { data } = await supabase.from('comments').select('*, profiles!user_id(*)').eq('post_id', postId).order('created_at', { ascending: true });
      setPostComments(prev => ({ ...prev, [postId]: data || [] }));
    }
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
    try { await navigator.clipboard.writeText(url); toast.success('הקישור הועתק ללוח'); } catch { toast.error('שגיאה בהעתקה'); }
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

  if (loading || !data) return <div className="min-h-[100dvh] bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" /></div>;

  const { circle, isMember, membership, posts } = data;
  const requiredLevel = circle.min_level || 1;
  const currentLevel = myProfile?.level || 1;
  const levelTooLow = requiredLevel > currentLevel;

  return (
    <>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />
      
      {/* MAIN LAYOUT: 100dvh flex-col to bound the content accurately */}
      <FadeIn className="bg-surface h-[100dvh] font-sans flex flex-col relative overflow-hidden" dir="rtl">
        
        {/* 🔝 HERO SECTION & STATS (Fixed Top) */}
        <div className="relative w-full h-[160px] shrink-0 bg-black overflow-hidden flex flex-col justify-end pb-3">
          {circle.cover_url ? (
            <img src={circle.cover_url} className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-luminosity" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-surface-card to-surface"></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-transparent"></div>
          
          <div className="relative z-10 px-5 text-center flex flex-col items-center">
            <h1 className="text-2xl font-black text-brand drop-shadow-md tracking-tight mb-2">{circle.name}</h1>
            
            {/* Inline Live Stats */}
            <div className="flex items-center justify-center gap-4 bg-surface/50 backdrop-blur-md border border-surface-border px-5 py-1.5 rounded-full shadow-sm">
              <div className="flex items-center gap-1.5">
                <Eye size={12} className="text-brand-muted" />
                <span className="text-[10px] font-black text-brand">{liveStats.active}</span>
              </div>
              <div className="w-px h-3 bg-surface-border" />
              <div className="flex items-center gap-1.5">
                {liveStats.typing > 0 ? <RealFlame /> : <MessageSquare size={12} className="text-brand-muted" />}
                <span className="text-[10px] font-black text-brand">{liveStats.typing}</span>
              </div>
              <div className="w-px h-3 bg-surface-border" />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black text-accent-primary tabular-nums">{liveStats.giftsSent}</span>
                <span className="text-[9px] font-black text-brand-muted">CRD</span>
              </div>
            </div>
          </div>
        </div>

        {/* 💎 JOIN AREA (If not member) */}
        {!isMember ? (
          <div className="flex-1 flex flex-col items-center p-6 gap-6 mt-2 overflow-y-auto">
            <div className="w-24 h-24 rounded-[32px] bg-surface-card border border-surface-border flex items-center justify-center mb-2 shadow-md">
              {levelTooLow ? <ShieldAlert size={36} className="text-red-500" /> : <Lock size={36} className="text-brand-muted" />}
            </div>
            
            <div className="text-center px-4">
              <h2 className="text-2xl font-black text-brand mb-3">{levelTooLow ? 'נעול ע"י הסלקטור' : 'מועדון סגור'}</h2>
              <p className="text-brand-muted text-[13px] font-medium leading-relaxed max-w-[260px] mx-auto">
                {levelTooLow ? `כדי להיכנס אתה חייב להיות לפחות רמה ${requiredLevel}. תהיה פעיל ותחזור כשתעלה רמה.` : 'הצטרף כדי לפתוח גישה מלאה לתוכן, לדרופים הסודיים וללייב צ׳אט.'}
              </p>
            </div>

            {!levelTooLow && (
              <div className="w-full flex flex-col gap-3 mt-4 pb-10">
                <Button onClick={() => handleJoin('INNER')} disabled={joining} className="w-full h-14 bg-surface border border-surface-border text-brand font-black rounded-2xl shadow-sm active:scale-95 transition-all uppercase tracking-widest text-[13px]">
                  {joining ? <Loader2 size={18} className="animate-spin" /> : `כניסה רגילה - ${circle.join_price} CRD`}
                </Button>
                
                <Button onClick={() => handleJoin('CORE')} disabled={joining} className="w-full h-14 bg-white text-black font-black rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all uppercase tracking-widest text-[13px]">
                  {joining ? <Loader2 size={18} className="animate-spin text-black" /> : <>שדרוג ל-CORE - {circle.vip_price} CRD</>}
                </Button>
                <span className="text-[10px] font-bold text-brand-muted tracking-widest uppercase text-center w-full block mt-2">כולל גישה לדרופים והודעות מודגשות</span>
              </div>
            )}
          </div>
        ) : (
          
          /* 📱 LOGGED IN MEMBER VIEW */
          <div className="flex flex-col flex-1 overflow-hidden">
            
            {/* TABS (Right, Center, Left alignment) */}
            <div className="flex justify-between border-b border-surface-border shrink-0 px-6 mt-1">
              {['chat', 'drops', 'members'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`py-3 text-[13px] font-black uppercase tracking-widest transition-colors relative whitespace-nowrap ${activeTab === tab ? 'text-brand' : 'text-brand-muted hover:text-brand'}`}
                >
                  {tab === 'chat' ? 'לייב צ׳אט' : tab === 'drops' ? 'דרופים' : 'חברים'}
                  {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-t-full" />}
                </button>
              ))}
            </div>

            {/* 💬 LIVE CHAT / POSTS (Scrollable Area) */}
            {activeTab === 'chat' && (
              <div className="flex-1 flex flex-col overflow-hidden bg-surface relative">
                
                {/* Chat Feed (flex-col-reverse = WhatsApp style, scrolls from bottom) */}
                <div className="flex-1 p-4 flex flex-col-reverse gap-5 overflow-y-auto scrollbar-hide">
                  
                  {hasMorePosts && posts.length > 0 && (
                    <div className="flex justify-center mt-2 mb-4">
                      <button onClick={loadMorePosts} disabled={loadingMore} className="bg-surface-card border border-surface-border rounded-full px-6 py-2.5 text-brand font-bold text-[12px] tracking-widest uppercase flex items-center gap-2 shadow-sm active:scale-95 transition-transform">
                        {loadingMore ? <Loader2 size={16} className="animate-spin text-brand-muted" /> : 'טען הודעות קודמות'}
                      </button>
                    </div>
                  )}

                  {posts?.map((post: any) => {
                    const hasMedia = !!post.media_url;
                    const isVideo = post.media_url?.match(/\.(mp4|webm|mov)$/i);
                    const isMine = post.user_id === currentUserId;
                    const isCore = post.profiles?.role_label === 'CORE' || post.gift_amount > 0;

                    return (
                      <div key={post.id} className="flex flex-col gap-1 w-full">
                        <div className={`flex gap-3 w-full ${isMine ? 'flex-row-reverse' : ''}`}>
                          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-surface-border bg-surface-card cursor-pointer flex items-center justify-center" onClick={() => navigate(`/profile/${post.user_id}`)}>
                            {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <span className="text-brand-muted font-black">{(post.profiles?.full_name || 'א')[0]}</span>}
                          </div>
                          
                          <div className={`flex flex-col max-w-[85%] ${isMine ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center gap-1.5 mb-1 px-1">
                              <span className="text-[11px] font-bold text-brand-muted">{post.profiles?.full_name || 'אנונימי'}</span>
                              {isCore && <span className="text-accent-primary text-[9px] font-black uppercase">CORE</span>}
                            </div>
                            
                            {/* UNIFIED BUBBLE FOR TEXT & MEDIA (Bleeds to edges) */}
                            <div className={`rounded-[22px] shadow-sm flex flex-col overflow-hidden ${
                              post.gift_amount 
                                ? 'bg-surface-card border border-accent-primary/50' 
                                : isMine ? 'bg-surface-card border border-surface-border rounded-tr-sm' : 'bg-surface border border-surface-border rounded-tl-sm'
                            }`}>
                              {post.gift_amount > 0 && (
                                <div className="flex items-center gap-1.5 text-accent-primary text-[10px] font-black mb-1 px-3 pt-3 uppercase tracking-widest">
                                  <Gift size={12} /> נשלח {post.gift_amount} CRD
                                </div>
                              )}
                              
                              {/* Media stretches to the edges of the bubble! */}
                              {hasMedia && (
                                <div className="w-full relative bg-black cursor-pointer" onClick={() => { if (!isVideo) openOverlay(() => { setFullScreenMedia([post]); setCurrentMediaIndex(0); }); }}>
                                  {isVideo ? (
                                    <FeedVideo src={post.media_url} className="w-full max-h-[300px] object-cover" />
                                  ) : (
                                    <img src={post.media_url} loading="lazy" className="w-full max-h-[300px] object-cover" />
                                  )}
                                </div>
                              )}

                              {/* Text content under the media */}
                              {post.content && (
                                <p className={`text-[14px] leading-relaxed whitespace-pre-wrap px-3 ${hasMedia ? 'py-3' : 'p-3'} ${post.gift_amount ? 'text-brand font-medium' : 'text-brand'}`}>
                                  {post.content}
                                </p>
                              )}
                            </div>
                            
                            {/* Actions under the bubble */}
                            <div className={`flex items-center gap-4 mt-1.5 px-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                              <button onClick={() => handleLike(post.id, post.is_liked)} className={`flex items-center gap-1 active:scale-90 transition-transform ${post.is_liked ? 'text-red-500' : 'text-brand-muted'}`}>
                                <Heart size={12} fill={post.is_liked ? 'currentColor' : 'none'} />
                                <span className="text-[10px] font-bold">{post.likes_count}</span>
                              </button>
                              <button onClick={() => { setReplyingToPost(post.id); document.getElementById('chat-input')?.focus(); }} className="flex items-center gap-1 text-brand-muted hover:text-brand active:scale-90 transition-transform">
                                <Reply size={12} className="rtl:-scale-x-100" />
                              </button>
                              <button onClick={() => openOverlay(() => setOptionsMenuPost(post))} className="flex items-center gap-1 text-brand-muted hover:text-brand active:scale-90 transition-transform">
                                <MoreVertical size={12} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* INLINE THREADS */}
                        {post.comments_count > 0 && (
                          <button onClick={() => toggleThread(post.id)} className={`flex items-center gap-1 text-[10px] font-black text-brand-muted hover:text-brand transition-colors mt-1 ${isMine ? 'mr-12 self-end' : 'ml-12 self-start'}`}>
                            {expandedThreads[post.id] ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                            {post.comments_count} תגובות בשרשור
                          </button>
                        )}

                        <AnimatePresence>
                          {expandedThreads[post.id] && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className={`flex flex-col gap-3 mt-2 overflow-hidden ${isMine ? 'mr-12' : 'ml-12'}`}>
                              {postComments[post.id]?.map(comment => (
                                <div key={comment.id} className={`flex gap-2 w-full ${comment.user_id === currentUserId ? 'flex-row-reverse' : ''}`}>
                                  <div className="w-6 h-6 rounded-full bg-surface border border-surface-border overflow-hidden shrink-0 flex items-center justify-center">
                                    {comment.profiles?.avatar_url ? <img src={comment.profiles.avatar_url} className="w-full h-full object-cover" /> : <span className="text-brand-muted font-black text-[8px]">{(comment.profiles?.full_name || 'א')[0]}</span>}
                                  </div>
                                  <div className="bg-surface-card border border-surface-border p-2.5 rounded-[18px] text-[12px] text-brand shadow-sm">
                                    <span className="font-black block mb-0.5 text-[10px] text-brand-muted">{comment.profiles?.full_name}</span>
                                    <p className="whitespace-pre-wrap">{comment.content}</p>
                                  </div>
                                </div>
                              ))}
                              <button onClick={() => { setReplyingToPost(post.id); document.getElementById('chat-input')?.focus(); }} className="text-[10px] font-black text-accent-primary flex items-center gap-1 mt-1">
                                <Reply size={10} className="rtl:-scale-x-100" /> הוסף תגובה לשרשור...
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>

                {/* 💡 SMART CHAT INPUT (Fixed above Bottom Nav with mb-[80px]) */}
                <div className="shrink-0 bg-surface border-t border-surface-border px-3 py-3 flex flex-col gap-2 z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.2)] mb-[80px]">
                  
                  {/* Thread Reply Indicator */}
                  <AnimatePresence>
                    {replyingToPost && (
                      <motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: 10}} className="flex items-center justify-between bg-surface-card border border-surface-border px-3 py-1.5 rounded-lg mb-1">
                        <div className="flex items-center gap-1.5">
                          <Reply size={12} className="text-brand-muted rtl:-scale-x-100" />
                          <span className="text-[11px] text-brand font-bold">מגיב לשרשור...</span>
                        </div>
                        <button onClick={() => setReplyingToPost(null)} className="p-1 active:scale-95"><X size={14} className="text-brand-muted" /></button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {selectedFile && (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-surface-border mb-1">
                      {selectedFile.type.startsWith('video/') ? (
                        <video src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover" />
                      ) : (
                        <img src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover" />
                      )}
                      <button onClick={() => setSelectedFile(null)} className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white"><X size={10} /></button>
                    </div>
                  )}
                  
                  {/* Combined Input Bar */}
                  <div className="w-full bg-surface-card border border-surface-border rounded-full flex items-center pr-1 pl-2 h-12 shadow-inner overflow-hidden">
                    <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-brand-muted hover:text-brand transition-colors active:scale-95 shrink-0">
                      <Paperclip size={18} />
                    </button>
                    {!replyingToPost && (
                      <button onClick={() => handlePost(true, 50)} className="p-2.5 text-accent-primary hover:text-yellow-400 transition-colors active:scale-95 shrink-0">
                        <Gift size={18} />
                      </button>
                    )}
                    <input
                      id="chat-input"
                      type="text"
                      value={newPost}
                      onChange={(e) => setNewPost(e.target.value)}
                      placeholder="הודעה..."
                      className="flex-1 bg-transparent border-none outline-none text-brand text-[14px] px-2 placeholder:text-brand-muted"
                    />
                    <button onClick={() => handlePost(false)} disabled={posting || (!newPost.trim() && !selectedFile)} className="w-9 h-9 shrink-0 rounded-full bg-white text-black flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform">
                      {posting ? <Loader2 size={16} className="animate-spin text-black" /> : <Send size={16} className="rtl:-scale-x-100 -ml-0.5" />}
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* 📦 DROPS */}
            {activeTab === 'drops' && (
              <div className="flex-1 p-4 grid grid-cols-2 gap-4 bg-surface overflow-y-auto mb-[80px]">
                {[1, 2, 3, 4].map((drop) => (
                  <div key={drop} className="aspect-[3/4] bg-surface-card rounded-[24px] border border-surface-border overflow-hidden relative group cursor-pointer shadow-md">
                    <img src={`https://images.unsplash.com/photo-${drop === 1 ? '1600880292203-757bb62b4baf' : drop === 2 ? '1571171637578-41bc2dd41cd2' : drop === 3 ? '1551028719-0c1bb9643c70' : '1564648351416-3eaf9a8eb5fc'}?auto=format&fit=crop&q=80&w=400`} className="w-full h-full object-cover blur-md opacity-40 scale-110" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-surface/40 gap-3">
                      <div className="w-12 h-12 rounded-full bg-surface-card flex items-center justify-center border border-surface-border shadow-inner">
                        <Lock size={20} className="text-brand-muted" />
                      </div>
                      <span className="text-[10px] font-black text-brand uppercase tracking-widest text-center bg-surface-card px-3 py-1.5 rounded-md border border-surface-border shadow-sm">
                        ל-CORE בלבד
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 👥 MEMBERS */}
            {activeTab === 'members' && (
              <div className="flex-1 p-4 flex flex-col gap-3 bg-surface overflow-y-auto mb-[80px]">
                {membersList.length === 0 ? (
                  <div className="text-center text-brand-muted text-[13px] mt-10 font-bold">אין חברים במועדון</div>
                ) : (
                  membersList.map((member) => (
                    <div key={member.profiles?.id} onClick={() => navigate(`/profile/${member.profiles?.id}`)} className="flex items-center gap-4 bg-surface-card p-4 rounded-[24px] border border-surface-border cursor-pointer active:scale-[0.98] transition-all shadow-sm">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-surface border border-surface-border shrink-0 flex items-center justify-center">
                        {member.profiles?.avatar_url ? <img src={member.profiles.avatar_url} className="w-full h-full object-cover" /> : <span className="text-brand-muted font-black">{(member.profiles?.full_name || 'א')[0]}</span>}
                      </div>
                      <div className="flex flex-col flex-1 text-right">
                        <div className="flex items-center gap-1.5">
                          <span className="text-brand font-black text-[15px]">{member.profiles?.full_name || 'אנונימי'}</span>
                          {member.role === 'admin' && <span className="text-accent-primary text-[9px] font-black uppercase bg-accent-primary/10 px-1.5 py-0.5 rounded">מנהל</span>}
                        </div>
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

      {/* OVERLAYS (Bottom Sheets & Fullscreen) */}
      {mounted && portalNode && createPortal(
        <>
          <AnimatePresence>
            {/* FULL SCREEN MEDIA */}
            {fullScreenMedia && (
              <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed inset-0 z-[999999] bg-surface">
                <div className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide" onScroll={handleContainerScroll}>
                  {fullScreenMedia.map((vid, idx) => {
                    const isVid = vid.media_url?.match(/\.(mp4|webm|mov)$/i);
                    const keyVal = vid._uid ? vid._uid : `${vid.id}-${idx}`;
                    return (
                      <div key={keyVal} className="w-full h-screen snap-center relative bg-surface flex items-center justify-center">
                        {isVid ? <video src={vid.media_url} loop playsInline className="w-full h-full object-cover" onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())} /> : <img src={vid.media_url} className="w-full h-full object-contain" onError={(e) => { e.currentTarget.src = 'https://placehold.co/500x500/111/333?text=Media+Unavailable'; }} />}
                        
                        <button onClick={(e) => { e.stopPropagation(); openOverlay(() => setOptionsMenuPost(vid)); }} className="absolute bottom-6 left-4 z-[60] active:scale-90 transition-transform"><MoreVertical size={26} strokeWidth={2.5} className="text-brand" /></button>
                        
                        <button onClick={(e) => { e.stopPropagation(); closeOverlay(); }} className="absolute top-6 left-4 z-[60] active:scale-90 transition-transform bg-surface-card border border-surface-border rounded-full p-2"><X size={20} className="text-brand" /></button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* OPTIONS MENU */}
            {optionsMenuPost && (
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
                
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] p-6 flex flex-col gap-3 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border text-center">
                  <div className="w-full py-2 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>
                  
                  <button onClick={() => { closeOverlay(); setTimeout(() => handleShare(optionsMenuPost), 100); }} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>שתף פוסט</span><Share2 size={20} className="text-brand-muted" /></button>
                  
                  {optionsMenuPost.media_url && <button onClick={() => handleDownloadMedia(optionsMenuPost.media_url)} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>שמור למכשיר</span><Download size={20} className="text-brand-muted" /></button>}
                  
                  <button onClick={async () => { try { await supabase.from('saved_posts').insert({ user_id: currentUserId, post_id: optionsMenuPost.id }); toast.success('הפוסט נשמר במועדפים!'); } catch { toast.error('הפוסט כבר שמור אצלך'); } closeOverlay(); }} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>שמור במועדפים</span><Bookmark size={20} className="text-brand-muted" /></button>
                  
                  <button onClick={() => handleCopyLink(optionsMenuPost)} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm"><span>העתק קישור</span><LinkIcon size={20} className="text-brand-muted" /></button>

                  {optionsMenuPost.user_id === currentUserId && (
                    <>
                      <button onClick={() => { closeOverlay(); setTimeout(() => { setEditingPost(optionsMenuPost); setNewPost(optionsMenuPost.content || ''); document.getElementById('chat-input')?.focus(); }, 100); }} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all border border-surface-border shadow-sm mt-2"><span>ערוך פוסט</span><Edit2 size={20} className="text-brand-muted" /></button>
                      <button onClick={() => { if (window.confirm('למחוק פוסט?')) { deletePost(optionsMenuPost.id); } }} className="w-full p-4 bg-surface-card border border-red-500/30 rounded-2xl text-red-500 font-black flex justify-between items-center text-[15px] active:scale-[0.98] transition-all mt-2"><span>מחק פוסט</span><Trash2 size={20} className="text-red-500" /></button>
                    </>
                  )}
                </motion.div>
              </div>
            )}

            {/* DESC POST FULL */}
            {activeDescPost && (
              <div className="fixed inset-0 z-[99999] flex flex-col justify-end" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/80 backdrop-blur-sm" onClick={closeOverlay} />
                
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative z-10 bg-surface rounded-t-[40px] flex flex-col overflow-hidden pb-10 max-h-[75vh] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border text-center">
                  <div className="w-full py-5 flex justify-center cursor-grab active:cursor-grabbing border-b border-surface-border"><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>
                  <div className="p-6 overflow-y-auto" onPointerDown={stopPropagation} onTouchStart={stopPropagation}>
                    <p className="text-brand text-[15px] leading-relaxed whitespace-pre-wrap">{activeDescPost.content}</p>
                  </div>
                </motion.div>
              </div>
            )}

          </AnimatePresence>
        </>,
        portalNode
      )}
    </>
  );
};
