import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { FadeIn, Button } from '../components/ui';
import { VaultCard } from '../components/VaultCard';
import {
  Loader2, MessageSquare, Crown, Send, Lock, UserCircle, Trash2, Edit2, MoreVertical,
  Paperclip, Share2, Download, Link as LinkIcon, Bookmark, ShieldAlert, Gift, Flame,
  Eye, ChevronDown, ChevronUp, Reply, X, Diamond, Handshake, Coins, Plus
} from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { Share } from '@capacitor/share';
import { useAuth } from '../context/AuthContext';

const SEAL_TYPES = [
  { id: 'fire', icon: <Flame size={24} />, label: 'אש', color: 'text-orange-500', xp: 15 },
  { id: 'diamond', icon: <Diamond size={24} />, label: 'יהלום', color: 'text-blue-400', xp: 50 },
  { id: 'alliance', icon: <Handshake size={24} />, label: 'ברית', color: 'text-emerald-400', xp: 100 }
];

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

  const [mounted, setMounted] = useState(false);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
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
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [replyingToPost, setReplyingToPost] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const [postComments, setPostComments] = useState<Record<string, any[]>>({});
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});

  const [optionsMenuPost, setOptionsMenuPost] = useState<any>(null);
  const [activeDescPost, setActiveDescPost] = useState<any>(null);
  const [fullScreenMedia, setFullScreenMedia] = useState<any[] | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [sealSelectorPost, setSealSelectorPost] = useState<any | null>(null);
  
  const scrollTimeout = useRef<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');

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
      else if (sealSelectorPost) setSealSelectorPost(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [optionsMenuPost, activeDescPost, fullScreenMedia, editingPost, sealSelectorPost]);

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
        .order('created_at', { ascending: false }).limit(POSTS_PER_PAGE);

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
    } catch { navigate('/'); } finally { setLoading(false); }
  };

  const fetchMembersList = async (circleId: string) => {
    try {
      const { data: membersData } = await supabase.from('circle_members').select('role, profiles(*)').eq('circle_id', circleId);
      if (membersData) setMembersList(membersData.sort((a, b) => (a.role === 'admin' ? -1 : b.role === 'admin' ? 1 : 0)));
    } catch (err) {}
  };

  const fetchVaults = async () => {
    if(!data?.circle?.slug) return;
    setLoadingVaults(true);
    try {
      const res = await apiFetch(`/api/circles/${data.circle.slug}/vaults`);
      setVaults(res.vaults || []);
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
    if (curLevel < reqLevel) { triggerFeedback('error'); return toast.error(`הסלקטור חסם אותך. דרושה רמה ${reqLevel}.`); }
    setJoining(true); triggerFeedback('pop');
    try {
      if (data.isMember) {
        await apiFetch(`/api/circles/${data.circle.slug}/upgrade`, { method: 'POST', body: JSON.stringify({ tier }) });
        triggerFeedback('success'); toast.success(`שודרגת ל-${tier}! 👑`);
      } else {
        await apiFetch(`/api/circles/${data.circle.slug}/join`, { method: 'POST' });
        triggerFeedback('success'); toast.success('ברוך הבא למועדון! 🎉');
      }
      fetchCircleData();
    } catch (err: any) { toast.error(err?.message || 'שגיאה בהצטרפות/שדרוג'); } finally { setJoining(false); }
  };

  const handlePost = async (isGift = false, giftAmount = 0) => {
    if (!newPost.trim() && !selectedFile && !editingPost && !isGift) return;
    setPosting(true);
    try {
      if (isGift) {
        if ((myProfile?.crd_balance || 0) < giftAmount) { toast.error('אין לך מספיק CRD.'); setPosting(false); return; }
        triggerFeedback('coin');
      }
      const postData = {
        circle_id: data.circle.id,
        user_id: currentUserId,
        content: newPost.trim() || (isGift ? `שלח מתנה בשווי ${giftAmount} CRD 🎁` : ''),
        media_urls: [],
        media_types: [],
        tier_required: 'INNER'
      };
      const { data: insertedPost, error } = await supabase.from('posts').insert(postData).select('*, profiles!user_id(*), seals:post_seals(id, seal_type, user_id), comments(id)').single();
      if (error) throw error;
      if (insertedPost) {
        const newMsg = { ...insertedPost, seals_count: 0, comments_count: 0, has_sealed: false, gift_amount: isGift ? giftAmount : 0 };
        setData((curr: any) => ({ ...curr, posts: [newMsg, ...curr.posts] }));
      }
      setNewPost(''); setSelectedFile(null); triggerFeedback('pop');
    } catch (err: any) { toast.error(err.message); } finally { setPosting(false); }
  };

  if (loading || !data) return <div className="min-h-[100dvh] bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" size={32} /></div>;

  const { circle, isMember, membership, posts } = data;
  const isOwner = circle.creator_id === currentUserId || membership?.role === 'admin';

  return (
    <>
      <FadeIn className="bg-surface h-[100dvh] font-sans flex flex-col relative overflow-hidden" dir="rtl">
        {/* HERO SECTION */}
        <div className="relative w-full h-[180px] shrink-0 bg-surface overflow-hidden flex flex-col justify-end pb-4 border-b border-surface-border">
          {circle.cover_url ? <img src={circle.cover_url} className="absolute inset-0 w-full h-full object-cover opacity-50" /> : <div className="absolute inset-0 bg-gradient-to-br from-surface-card to-surface"></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-transparent"></div>
          <div className="relative z-10 px-5 text-center flex flex-col items-center">
            <h1 className="text-2xl font-black text-white mb-3">{circle.name}</h1>
            <div className="flex items-center justify-center gap-4 bg-surface-card/60 backdrop-blur-md border border-white/10 px-5 py-2 rounded-full shadow-lg">
              <div className="flex items-center gap-1.5"><Eye size={14} className="text-brand-muted" /><span className="text-[11px] font-black text-white">{liveStats.active}</span></div>
              <div className="w-px h-3 bg-white/20" />
              <div className="flex items-center gap-1.5"><MessageSquare size={14} className="text-brand-muted" /><span className="text-[11px] font-black text-white">{liveStats.typing}</span></div>
            </div>
          </div>
        </div>

        {!isMember ? (
          <div className="flex-1 flex flex-col items-center p-6 gap-6 mt-4">
             <div className="w-24 h-24 rounded-[32px] bg-surface-card border border-surface-border flex items-center justify-center mb-2 shadow-2xl"><Lock size={36} className="text-brand-muted" /></div>
             <h2 className="text-2xl font-black text-brand mb-3">מועדון סגור</h2>
             <Button onClick={() => handleJoin('INNER')} disabled={joining} className="w-full h-14 bg-white text-black font-black rounded-[20px] uppercase tracking-widest text-[13px]">הצטרפות - {circle.join_price || 0} CRD</Button>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden relative">
            <div className="flex justify-between border-b border-surface-border shrink-0 px-6 bg-surface z-10 relative">
              {['chat', 'vaults', 'members'].map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab as any)} className={`py-4 text-[13px] font-black uppercase tracking-widest transition-colors relative ${activeTab === tab ? 'text-brand' : 'text-brand-muted'}`}>
                  {tab === 'chat' ? 'לייב צ׳אט' : tab === 'vaults' ? 'כספות' : 'חברים'}
                  {activeTab === tab && <motion.div layoutId="circleTab" className="absolute bottom-0 left-0 right-0 h-[3px] bg-brand rounded-t-full" />}
                </button>
              ))}
            </div>

            {activeTab === 'chat' && (
              <div className="flex-1 flex flex-col overflow-hidden bg-surface relative">
                <div className="flex-1 p-4 flex flex-col-reverse gap-6 overflow-y-auto pb-[160px]">
                  {posts?.map((post: any) => (
                    <div key={post.id} className="flex flex-col gap-1 w-full">
                       <div className={`flex gap-3 w-full ${post.user_id === currentUserId ? 'flex-row-reverse' : ''}`}>
                          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-surface-border bg-surface-card flex items-center justify-center">
                            {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <span className="text-brand-muted font-black text-[12px]">{(post.profiles?.full_name || 'א')[0]}</span>}
                          </div>
                          <div className={`bg-surface-card border border-surface-border p-3 rounded-[20px] max-w-[80%] text-brand text-sm ${post.user_id === currentUserId ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
                            {post.content}
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
                <div className="absolute bottom-[85px] left-0 right-0 px-4 z-40">
                  <div className="w-full bg-surface-card/90 backdrop-blur-xl border border-surface-border rounded-[28px] flex items-center px-4 h-14 shadow-2xl">
                    <input type="text" value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder="הודעה..." className="flex-1 bg-transparent border-none outline-none text-brand font-medium" />
                    <button onClick={() => handlePost(false)} className="w-10 h-10 shrink-0 rounded-full bg-white text-black flex items-center justify-center active:scale-95"><Send size={18} className="rtl:-scale-x-100" /></button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'vaults' && (
              <div className="flex-1 p-4 flex flex-col gap-6 bg-surface overflow-y-auto pb-[120px] relative">
                {loadingVaults ? <Loader2 className="animate-spin text-accent-primary mx-auto my-20" /> : vaults.length === 0 ? (
                  <div className="text-center py-20 opacity-50"><Lock size={48} className="mx-auto mb-4" /><h3 className="text-lg font-black">אין כספות זמינות</h3></div>
                ) : vaults.map(vault => <VaultCard key={vault.id} vault={vault} onUnlockSuccess={fetchVaults} />)}
                
                {/* FAB: CREATE VAULT (Admin Only) */}
                {isOwner && (
                  <button 
                    onClick={() => navigate(`/circle/${slug}/vaults/create`)}
                    className="fixed bottom-[110px] left-6 w-14 h-14 bg-accent-primary text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(var(--color-accent-primary),0.4)] active:scale-90 transition-transform z-50"
                  >
                    <Plus size={28} />
                  </button>
                )}
              </div>
            )}

            {activeTab === 'members' && (
              <div className="flex-1 p-4 flex flex-col gap-3 bg-surface overflow-y-auto pb-[120px]">
                {membersList.map((m) => (
                  <div key={m.profiles?.id} className="flex items-center gap-4 bg-surface-card p-4 rounded-[28px] border border-surface-border">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-surface flex items-center justify-center border border-surface-border">
                      {m.profiles?.avatar_url ? <img src={m.profiles.avatar_url} className="w-full h-full object-cover" /> : <span className="text-brand-muted font-black text-[14px]">{(m.profiles?.full_name || 'א')[0]}</span>}
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-brand font-black text-[15px]">{m.profiles?.full_name || 'אנונימי'}</span>
                      <span className="text-brand-muted text-[11px]">@{m.profiles?.username}</span>
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
