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

export const CirclePage: React.FC = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { profile: myProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);

  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'chat' | 'vaults' | 'members'>('chat');
  const [page, setPage] = useState(0);
  const POSTS_PER_PAGE = 20;

  const [vaults, setVaults] = useState<any[]>([]);
  const [loadingVaults, setLoadingVaults] = useState(false);

  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [joining, setJoining] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const [membersList, setMembersList] = useState<any[]>([]);
  
  // Realtime Presence States
  const [onlineCount, setOnlineCount] = useState(1);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  // --- Realtime Connection & Data Fetching ---
  useEffect(() => {
    let ch: any;
    
    const initCircle = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id || `guest_${Date.now()}`;
      setCurrentUserId(uid);

      await fetchCircleData(uid);

      // Connect to real-time channel with Presence
      ch = supabase.channel(`circle_${slug}`, {
        config: { presence: { key: uid } }
      });
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        fetchCircleData(uid);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({ isTyping: false });
        }
      });
    };

    initCircle();

    return () => { if (ch) supabase.removeChannel(ch); };
  }, [slug]);

  useEffect(() => {
    if (activeTab === 'vaults' && data?.circle?.id) {
      fetchVaults();
    }
  }, [activeTab, data?.circle?.id]);

  const fetchCircleData = async (uid: string) => {
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

      const { data: pData } = await supabase.from('posts')
        .select('*, profiles!user_id(*)')
        .eq('circle_id', circle.id)
        .is('parent_id', null)
        .order('created_at', { ascending: false })
        .limit(POSTS_PER_PAGE);

      fetchMembersList(circle.id);
      setData({ circle, isMember, membership, posts: pData || [] });
      
    } catch (err) { 
      navigate('/'); 
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
      const { data: vaultData } = await supabase.from('vaults').select('*').eq('circle_id', data.circle.id).eq('is_active', true).order('created_at', { ascending: false });
      let unlockedIds: string[] = [];
      if (currentUserId && !currentUserId.startsWith('guest_')) {
        const { data: unlocks } = await supabase.from('vault_unlocks').select('vault_id').eq('user_id', currentUserId);
        unlockedIds = (unlocks || []).map((u: any) => u.vault_id);
      }
      const enrichedVaults = (vaultData || []).map((v: any) => ({
        ...v,
        is_unlocked: unlockedIds.includes(v.id) || v.creator_id === currentUserId
      }));
      setVaults(enrichedVaults);
    } catch (err) {} finally { setLoadingVaults(false); }
  };

  const handleJoin = async (tier: 'INNER' | 'CORE') => {
    if (!currentUserId || currentUserId.startsWith('guest_')) return toast.error('יש להתחבר תחילה');
    const reqLevel = data.circle.min_level || 1;
    const curLevel = myProfile?.level || 1;
    if (curLevel < reqLevel) { triggerFeedback('error'); return toast.error(`דרושה רמה ${reqLevel} להצטרפות.`); }
    
    setJoining(true); triggerFeedback('pop');
    try {
      if (data.isMember) {
        await apiFetch(`/api/circles/${data.circle.slug}/upgrade`, { method: 'POST', body: JSON.stringify({ tier }) });
        triggerFeedback('success'); toast.success(`שודרגת ל-${tier}! 👑`);
      } else {
        await apiFetch(`/api/circles/${data.circle.slug}/join`, { method: 'POST' });
        triggerFeedback('success'); toast.success('ברוך הבא למועדון! 🎉');
      }
      fetchCircleData(currentUserId);
    } catch (err: any) { toast.error(err?.message || 'שגיאה בהצטרפות'); } finally { setJoining(false); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewPost(val);
    if (channelRef.current) {
      channelRef.current.track({ isTyping: val.length > 0 });
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
        media_url: null,
        media_type: 'text'
      };

      // מחזירים את התשובה כדי לדחוף מיד למסך המשתמש
      const { data: insertedPost, error } = await supabase
        .from('posts')
        .insert(postData)
        .select('*, profiles!user_id(*)')
        .single();
        
      if (error) throw error;
      
      // מעדכן את המסך באותו רגע
      if (insertedPost) {
        setData((curr: any) => ({ 
          ...curr, 
          posts: [insertedPost, ...curr.posts] 
        }));
      }
      
      setNewPost(''); 
      setSelectedFile(null); 
      if (channelRef.current) channelRef.current.track({ isTyping: false });
      triggerFeedback('pop');
    } catch (err: any) { toast.error(err.message); } finally { setPosting(false); }
  };

  if (loading || !data) return <div className="min-h-[100dvh] bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-brand" size={32} /></div>;

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
            <h1 className="text-2xl font-black text-white mb-3 drop-shadow-sm">{circle.name}</h1>
            <div className="flex items-center justify-center gap-4 bg-surface-card/60 backdrop-blur-md border border-white/10 px-5 py-2 rounded-full shadow-lg">
              <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]" /><span className="text-[11px] font-black text-white">{onlineCount} מחוברים</span></div>
              {isMember && typingUsers.size > 0 && (
                <>
                  <div className="w-px h-3 bg-white/20" />
                  <div className="flex items-center gap-1.5"><MessageSquare size={14} className="text-brand-muted" /><span className="text-[11px] font-bold text-white/80">{typingUsers.size} מקלידים...</span></div>
                </>
              )}
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
            
            {/* TABS */}
            <div className="flex justify-center gap-3 px-4 py-3 bg-surface z-10 relative shrink-0">
              {['chat', 'vaults', 'members'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => { triggerFeedback('pop'); setActiveTab(tab as any); }}
                  className={`px-5 py-2 text-[12px] font-black uppercase tracking-widest transition-all rounded-full border ${
                    activeTab === tab 
                      ? 'border-accent-primary text-accent-primary bg-accent-primary/5' 
                      : 'border-transparent text-brand-muted hover:text-brand'
                  }`}
                >
                  {tab === 'chat' ? 'לייב צ׳אט' : tab === 'vaults' ? 'כספות' : 'חברים'}
                </button>
              ))}
            </div>

            {/* TAB: CHAT */}
            {activeTab === 'chat' && (
              <div className="flex-1 flex flex-col bg-surface relative h-full">
                
                {/* Scrollable Messages Area */}
                <div className="absolute inset-0 overflow-y-auto scrollbar-hide p-4 flex flex-col-reverse gap-6 pb-[90px]">
                  {posts?.map((post: any) => (
                    <div key={post.id} className="flex flex-col gap-1 w-full">
                      <div className={`flex gap-3 w-full ${post.user_id === currentUserId ? 'flex-row-reverse' : ''}`}>
                        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-surface-border bg-surface-card flex items-center justify-center shadow-sm cursor-pointer" onClick={() => navigate(`/profile/${post.user_id}`)}>
                          {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> : <span className="text-brand-muted font-black text-[12px]">{(post.profiles?.full_name || 'א')[0]}</span>}
                        </div>
                        <div className={`bg-surface-card border border-surface-border p-3.5 rounded-[20px] max-w-[80%] text-brand text-sm shadow-sm ${post.user_id === currentUserId ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
                          {post.content}
                        </div>
                      </div>
                    </div>
                  ))}
                  {posts?.length === 0 && (
                    <div className="text-center py-20 opacity-50 flex flex-col items-center gap-3 my-auto">
                      <MessageSquare size={40} className="text-brand-muted" strokeWidth={1} />
                      <span className="text-brand-muted font-black text-[13px] tracking-widest uppercase">אין הודעות עדיין.<br/>תהיה הראשון לכתוב!</span>
                    </div>
                  )}
                </div>

                {/* Fixed Input Area */}
                <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+60px)] left-0 right-0 px-4 py-2 bg-surface/95 backdrop-blur-xl z-50">
                  <div className="w-full bg-surface-card border border-surface-border rounded-[28px] flex items-center px-2 py-1 h-14 shadow-sm">
                    <input 
                      type="text" 
                      value={newPost} 
                      onChange={handleInputChange} 
                      onKeyDown={(e) => e.key === 'Enter' && handlePost()}
                      placeholder="הודעה..." 
                      className="flex-1 bg-transparent px-3 border-none outline-none text-brand font-medium text-[15px]" 
                    />
                    <button onClick={handlePost} disabled={posting || !newPost.trim()} className="w-10 h-10 shrink-0 rounded-full bg-accent-primary text-white flex items-center justify-center active:scale-95 disabled:opacity-30 transition-opacity shadow-md">
                      {posting ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={16} className="rtl:-scale-x-100 -ml-0.5" />}
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* TAB: VAULTS */}
            {activeTab === 'vaults' && (
              <div className="flex-1 p-4 flex flex-col gap-6 bg-surface overflow-y-auto pb-[120px] relative">
                {loadingVaults ? <Loader2 className="animate-spin text-accent-primary mx-auto my-20" /> : vaults.length === 0 ? (
                  <div className="text-center py-20 opacity-50"><Lock size={48} className="mx-auto mb-4" /><h3 className="text-lg font-black">אין כספות זמינות</h3></div>
                ) : vaults.map(vault => <VaultCard key={vault.id} vault={vault} onUnlockSuccess={fetchVaults} />)}
                
                {isOwner && (
                  <button onClick={() => navigate(`/circle/${slug}/vaults/create`)} className="fixed bottom-[110px] left-6 w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform z-50">
                    <Plus size={28} />
                  </button>
                )}
              </div>
            )}

            {/* TAB: MEMBERS */}
            {activeTab === 'members' && (
              <div className="flex-1 p-4 flex flex-col gap-3 bg-surface overflow-y-auto pb-[120px]">
                {membersList.map((m) => (
                  <div key={m.profiles?.id} onClick={() => navigate(`/profile/${m.profiles?.id}`)} className="flex items-center gap-4 bg-surface-card p-4 rounded-[28px] border border-surface-border cursor-pointer active:scale-95 transition-transform">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-surface flex items-center justify-center border border-surface-border">
                      {m.profiles?.avatar_url ? <img src={m.profiles.avatar_url} className="w-full h-full object-cover" /> : <span className="text-brand-muted font-black text-[14px]">{(m.profiles?.full_name || 'א')[0]}</span>}
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-brand font-black text-[15px]">{m.profiles?.full_name || 'אנונימי'}</span>
                      <span className="text-brand-muted text-[11px]" dir="ltr">@{m.profiles?.username}</span>
                    </div>
                    {m.role === 'admin' && <ShieldAlert size={16} className="text-brand mr-auto" />}
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
