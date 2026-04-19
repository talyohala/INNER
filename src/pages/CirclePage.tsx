import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { FadeIn, Button } from '../components/ui';
import { VaultCard } from '../components/VaultCard';
import {
  Loader2,
  MessageSquare,
  Lock,
  ShieldAlert,
  Flame,
  Diamond,
  Handshake,
  Plus,
  Send,
  X,
  Coins,
  Image as ImageIcon,
  Users,
  Archive
} from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
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
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);

  const [data, setData] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem(`inner_circle_${slug}_cache` || '') || 'null');
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(!data);
  const [activeTab, setActiveTab] = useState<'chat' | 'vaults' | 'members'>('chat');

  const [vaults, setVaults] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`inner_vaults_${slug}_cache`) || '[]');
    } catch {
      return [];
    }
  });
  const [loadingVaults, setLoadingVaults] = useState(vaults.length === 0);

  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [joining, setJoining] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const [membersList, setMembersList] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`inner_members_${slug}_cache`) || '[]');
    } catch {
      return [];
    }
  });

  const [onlineCount, setOnlineCount] = useState(1);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let ch: any;

    const initCircle = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id || `guest_${Date.now()}`;
      setCurrentUserId(uid);

      await fetchCircleData(uid);

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
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'posts', filter: `circle_id=eq.${slug}` },
          async () => {
            await fetchCircleData(uid, true);
          }
        )
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            await ch.track({ isTyping: false });
          }
        });
    };

    initCircle();

    return () => {
      if (ch) supabase.removeChannel(ch);
    };
  }, [slug]);

  useEffect(() => {
    if (activeTab === 'vaults' && data?.circle?.id) {
      fetchVaults();
    }
  }, [activeTab, data?.circle?.id]);

  useEffect(() => {
    if (activeTab !== 'chat') return;
    if (!messagesRef.current) return;

    const el = messagesRef.current;
    requestAnimationFrame(() => {
      el.scrollTop = 0;
    });
  }, [activeTab, data?.posts?.length]);

  const sortedPosts = useMemo(() => {
    return [...(data?.posts || [])].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [data?.posts]);

  const fetchCircleData = async (uid: string, silent = false) => {
    if (!silent) setLoading(true);

    try {
      let circle: any = null;

      const { data: circleBySlug } = await supabase
        .from('circles')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      circle = circleBySlug;

      if (!circle) {
        const { data: circleById } = await supabase
          .from('circles')
          .select('*')
          .eq('id', slug)
          .maybeSingle();

        circle = circleById;
      }

      if (!circle) throw new Error('מועדון לא נמצא');

      let isMember = false;
      let membership = null;

      if (uid && !uid.startsWith('guest_')) {
        const { data: memberData } = await supabase
          .from('circle_members')
          .select('*')
          .eq('circle_id', circle.id)
          .eq('user_id', uid)
          .maybeSingle();

        if (memberData) {
          isMember = true;
          membership = memberData;
        }
      }

      const { data: pData } = await supabase
        .from('posts')
        .select('*, profiles!user_id(*)')
        .eq('circle_id', circle.id)
        .order('created_at', { ascending: false })
        .limit(50);

      fetchMembersList(circle.id);

      const newData = {
        circle,
        isMember,
        membership,
        posts: pData || []
      };

      setData(newData);
      localStorage.setItem(`inner_circle_${slug}_cache`, JSON.stringify(newData));
    } catch (err) {
      navigate('/');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchMembersList = async (circleId: string) => {
    try {
      const { data: membersData } = await supabase
        .from('circle_members')
        .select('role, profiles(*)')
        .eq('circle_id', circleId);

      if (membersData) {
        const sorted = membersData.sort((a, b) =>
          a.role === 'admin' ? -1 : b.role === 'admin' ? 1 : 0
        );
        setMembersList(sorted);
        localStorage.setItem(`inner_members_${slug}_cache`, JSON.stringify(sorted));
      }
    } catch {}
  };

  const fetchVaults = async () => {
    if (!data?.circle?.id) return;

    try {
      const { data: vaultData } = await supabase
        .from('vaults')
        .select('*')
        .eq('circle_id', data.circle.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      let unlockedIds: string[] = [];

      if (currentUserId && !currentUserId.startsWith('guest_')) {
        const { data: unlocks } = await supabase
          .from('vault_unlocks')
          .select('vault_id')
          .eq('user_id', currentUserId);

        unlockedIds = (unlocks || []).map((u: any) => u.vault_id);
      }

      const enrichedVaults = (vaultData || []).map((v: any) => ({
        ...v,
        is_unlocked: unlockedIds.includes(v.id) || v.creator_id === currentUserId
      }));

      setVaults(enrichedVaults);
      localStorage.setItem(`inner_vaults_${slug}_cache`, JSON.stringify(enrichedVaults));
    } catch {
    } finally {
      setLoadingVaults(false);
    }
  };

  const handleJoin = async (tier: 'INNER' | 'CORE') => {
    if (!currentUserId || currentUserId.startsWith('guest_')) {
      return toast.error('יש להתחבר תחילה');
    }

    const reqLevel = data.circle.min_level || 1;
    const curLevel = myProfile?.level || 1;

    if (curLevel < reqLevel) {
      triggerFeedback('error');
      return toast.error(`דרושה רמה ${reqLevel} להצטרפות.`);
    }

    setJoining(true);
    triggerFeedback('pop');

    try {
      if (data.isMember) {
        await apiFetch(`/api/circles/${data.circle.slug}/upgrade`, {
          method: 'POST',
          body: JSON.stringify({ tier })
        });
        triggerFeedback('success');
        toast.success(`שודרגת ל-${tier}! 👑`);
      } else {
        await apiFetch(`/api/circles/${data.circle.slug}/join`, { method: 'POST' });
        triggerFeedback('success');
        toast.success('ברוך הבא למועדון! 🎉');
      }

      await fetchCircleData(currentUserId);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewPost(val);

    if (channelRef.current) {
      channelRef.current.track({ isTyping: val.length > 0 });
    }
  };

  const handlePost = async () => {
    if (!newPost.trim() && !selectedFile) return;
    if (!data?.circle?.id) return;
    if (!currentUserId || currentUserId.startsWith('guest_')) {
      toast.error('יש להתחבר תחילה');
      return;
    }

    setPosting(true);
    triggerFeedback('pop');

    try {
      let media_url: string | null = null;
      let media_type = 'text';

      if (selectedFile) {
        const safeName = selectedFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const fileName = `circle_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${safeName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('feed_images')
          .upload(fileName, selectedFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw new Error('שגיאה בהעלאת הקובץ');

        const {
          data: { publicUrl }
        } = supabase.storage.from('feed_images').getPublicUrl(uploadData.path);

        media_url = publicUrl;
        media_type = selectedFile.type.startsWith('video/') ? 'video' : 'image';
      }

      const postData = {
        circle_id: data.circle.id,
        user_id: currentUserId,
        content: newPost.trim(),
        media_url,
        media_type,
        is_reveal_drop: false,
        reveal_status: 'revealed',
        required_crd: 0
      };

      const { data: insertedPost, error } = await supabase
        .from('posts')
        .insert(postData)
        .select('*, profiles!user_id(*)')
        .single();

      if (error) throw error;

      if (insertedPost) {
        setData((curr: any) => ({
          ...curr,
          posts: [insertedPost, ...(curr.posts || [])]
        }));
      }

      setNewPost('');
      setSelectedFile(null);

      if (channelRef.current) {
        channelRef.current.track({ isTyping: false });
      }

      triggerFeedback('success');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בשליחת ההודעה');
    } finally {
      setPosting(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
        <Loader2 className="animate-spin text-accent-primary" size={32} />
      </div>
    );
  }

  const { circle, isMember, membership } = data;
  const isOwner = circle.creator_id === currentUserId || membership?.role === 'admin';

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,video/*"
      />

      <FadeIn className="bg-surface h-[100dvh] font-sans flex flex-col relative overflow-hidden" dir="rtl">
        <div className="relative w-full h-[200px] shrink-0 bg-surface overflow-hidden flex flex-col justify-end pb-5 z-20">
          {circle.cover_url ? (
            <img
              src={circle.cover_url}
              className="absolute inset-0 w-full h-full object-cover opacity-60"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/20 to-surface" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-transparent" />

          <div className="relative z-10 px-5 text-center flex flex-col items-center">
            <h1 className="text-3xl font-black text-brand mb-3 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
              {circle.name}
            </h1>

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
              <h2 className="text-2xl font-black text-brand mb-2 uppercase tracking-widest">
                מועדון סגור
              </h2>
              <p className="text-brand-muted text-[13px] font-medium max-w-[250px] mx-auto">
                הצטרף עכשיו כדי לקבל גישה לתוכן בלעדי כספות ושיחות עם שאר חברי המועדון
              </p>
            </div>

            <Button
              onClick={() => handleJoin('INNER')}
              disabled={joining}
              className="w-full h-14 bg-white text-black font-black rounded-full uppercase tracking-widest text-[14px] shadow-[0_5px_20px_rgba(255,255,255,0.2)] active:scale-95 transition-all"
            >
              הצטרפות - {circle.join_price || 0} CRD
            </Button>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden relative">
            <div className="flex justify-center px-4 py-2 z-20 relative shrink-0">
              <div className="flex items-center bg-surface-card border border-surface-border rounded-full p-1 shadow-inner w-full max-w-[340px]">
                <button
                  onClick={() => {
                    triggerFeedback('pop');
                    setActiveTab('chat');
                  }}
                  className={`flex-1 py-2.5 text-[12px] font-black tracking-widest transition-all rounded-full flex items-center justify-center gap-2 ${
                    activeTab === 'chat'
                      ? 'bg-accent-primary text-white shadow-[0_2px_10px_rgba(var(--color-accent-primary),0.5)]'
                      : 'bg-transparent text-brand-muted hover:text-brand'
                  }`}
                >
                  <MessageSquare size={15} />
                  צ׳אט
                </button>

                <button
                  onClick={() => {
                    triggerFeedback('pop');
                    setActiveTab('vaults');
                  }}
                  className={`flex-1 py-2.5 text-[12px] font-black tracking-widest transition-all rounded-full flex items-center justify-center gap-2 ${
                    activeTab === 'vaults'
                      ? 'bg-accent-primary text-white shadow-[0_2px_10px_rgba(var(--color-accent-primary),0.5)]'
                      : 'bg-transparent text-brand-muted hover:text-brand'
                  }`}
                >
                  <Archive size={15} />
                  כספות
                </button>

                <button
                  onClick={() => {
                    triggerFeedback('pop');
                    setActiveTab('members');
                  }}
                  className={`flex-1 py-2.5 text-[12px] font-black tracking-widest transition-all rounded-full flex items-center justify-center gap-2 ${
                    activeTab === 'members'
                      ? 'bg-accent-primary text-white shadow-[0_2px_10px_rgba(var(--color-accent-primary),0.5)]'
                      : 'bg-transparent text-brand-muted hover:text-brand'
                  }`}
                >
                  <Users size={15} />
                  חברים
                </button>
              </div>
            </div>

            {activeTab === 'chat' && (
              <>
                <div
                  ref={messagesRef}
                  className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-2 pb-[190px] z-0"
                >
                  <div className="flex flex-col gap-4 min-h-full">
                    {sortedPosts.length === 0 ? (
                      <div className="text-center py-20 opacity-50 flex flex-col items-center gap-3 my-auto">
                        <div className="w-20 h-20 rounded-full bg-surface-card flex items-center justify-center border border-surface-border shadow-inner">
                          <MessageSquare size={32} className="text-brand-muted" />
                        </div>
                        <span className="text-brand-muted font-black text-[13px] tracking-widest uppercase">
                          הצ'אט שקט מדי
                          <br />
                          שבור את הקרח
                        </span>
                      </div>
                    ) : (
                      sortedPosts.map((post: any) => (
                        <div key={post.id} className="flex flex-col gap-1 w-full">
                          <div
                            className={`flex gap-3 w-full ${
                              post.user_id === currentUserId ? 'flex-row-reverse' : ''
                            }`}
                          >
                            <div
                              className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-surface-border bg-surface-card flex items-center justify-center shadow-sm cursor-pointer mt-auto"
                              onClick={() => navigate(`/profile/${post.user_id}`)}
                            >
                              {post.profiles?.avatar_url ? (
                                <img
                                  src={post.profiles.avatar_url}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-brand-muted font-black text-[10px]">
                                  {(post.profiles?.full_name || 'א')[0]}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-col gap-1.5 max-w-[75%]">
                              <div
                                className={`p-3.5 rounded-[24px] text-[14px] font-medium shadow-sm leading-relaxed ${
                                  post.user_id === currentUserId
                                    ? 'bg-accent-primary/10 border border-accent-primary/20 text-brand rounded-br-sm'
                                    : 'bg-surface-card border border-surface-border text-brand-muted rounded-bl-sm'
                                }`}
                              >
                                {post.user_id !== currentUserId && (
                                  <span className="text-accent-primary text-[10px] font-black block mb-1.5 uppercase tracking-widest">
                                    {post.profiles?.full_name || 'אנונימי'}
                                  </span>
                                )}

                                {post.media_url && (
                                  <div
                                    className={`rounded-[16px] overflow-hidden border border-surface-border bg-surface ${
                                      post.content ? 'mb-2' : ''
                                    }`}
                                  >
                                    {post.media_type === 'video' ? (
                                      <video
                                        src={post.media_url}
                                        controls
                                        playsInline
                                        preload="metadata"
                                        className="w-full h-auto max-h-[300px] object-cover"
                                      />
                                    ) : (
                                      <img
                                        src={post.media_url}
                                        className="w-full h-auto max-h-[300px] object-cover"
                                        loading="lazy"
                                      />
                                    )}
                                  </div>
                                )}

                                {post.content && <span>{post.content}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div
                  className="fixed left-0 right-0 z-[70] px-4"
                  style={{ bottom: 'calc(78px + env(safe-area-inset-bottom, 0px))' }}
                >
                  <div className="max-w-[900px] mx-auto">
                    <AnimatePresence>
                      {selectedFile && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: 'auto' }}
                          exit={{ opacity: 0, y: 10, height: 0 }}
                          className="mb-3"
                        >
                          <div className="relative w-28 h-28 rounded-[20px] overflow-hidden border border-surface-border shadow-[0_10px_40px_rgba(0,0,0,0.35)] bg-surface-card">
                            {selectedFile.type.startsWith('video/') ? (
                              <video
                                src={URL.createObjectURL(selectedFile)}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <img
                                src={URL.createObjectURL(selectedFile)}
                                className="w-full h-full object-cover"
                              />
                            )}

                            <button
                              onClick={() => setSelectedFile(null)}
                              className="absolute top-2 right-2 w-7 h-7 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="w-full bg-surface-card/95 backdrop-blur-xl rounded-full flex items-center pr-4 pl-1.5 py-1.5 min-h-[60px] shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                      <input
                        type="text"
                        value={newPost}
                        onChange={handleInputChange}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handlePost();
                        }}
                        placeholder="הקלד הודעה תמונה או וידאו"
                        className="flex-1 bg-transparent border-none outline-none text-brand font-medium text-[14px] placeholder:text-brand-muted/60"
                      />

                      <div className="flex items-center gap-1.5 shrink-0 mr-2">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="h-11 min-w-[44px] px-3 rounded-full flex items-center justify-center gap-1.5 text-brand-muted hover:text-brand bg-surface active:scale-95 transition-all shadow-inner"
                          title="העלאת תמונה או וידאו"
                        >
                          <ImageIcon size={18} />
                        </button>

                        <button
                          onClick={handlePost}
                          disabled={posting || (!newPost.trim() && !selectedFile)}
                          className="w-11 h-11 rounded-full bg-accent-primary text-white flex items-center justify-center active:scale-95 disabled:opacity-30 transition-all shadow-[0_0_15px_rgba(var(--color-accent-primary),0.4)]"
                        >
                          {posting ? (
                            <Loader2 size={18} className="animate-spin text-white" />
                          ) : (
                            <Send size={18} className="rtl:-scale-x-100 -ml-0.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'vaults' && (
              <div className="flex-1 p-4 flex flex-col gap-6 bg-surface overflow-y-auto pb-[120px] relative">
                {loadingVaults ? (
                  <Loader2 className="animate-spin text-accent-primary mx-auto my-20" />
                ) : vaults.length === 0 ? (
                  <div className="text-center py-20 opacity-50 flex flex-col items-center">
                    <Lock size={48} className="text-brand-muted mb-4" />
                    <h3 className="text-lg font-black text-brand-muted tracking-widest uppercase">
                      אין כספות עדיין
                    </h3>
                  </div>
                ) : (
                  vaults.map((vault) => (
                    <VaultCard key={vault.id} vault={vault} onUnlockSuccess={fetchVaults} />
                  ))
                )}

                {isOwner && (
                  <button
                    onClick={() => navigate(`/circle/${slug}/vaults/create`)}
                    className="fixed bottom-[100px] left-6 w-14 h-14 bg-accent-primary text-white rounded-full flex items-center justify-center shadow-[0_5px_20px_rgba(var(--color-accent-primary),0.4)] active:scale-90 transition-transform z-50"
                  >
                    <Plus size={28} />
                  </button>
                )}
              </div>
            )}

            {activeTab === 'members' && (
              <div className="flex-1 p-4 flex flex-col gap-3 bg-surface overflow-y-auto pb-[120px]">
                {membersList.map((m) => (
                  <div
                    key={m.profiles?.id}
                    onClick={() => navigate(`/profile/${m.profiles?.id}`)}
                    className="flex items-center justify-between bg-surface-card p-4 rounded-[28px] border border-surface-border cursor-pointer active:scale-95 transition-all shadow-sm hover:border-accent-primary/30 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-surface flex items-center justify-center border border-surface-border shadow-inner group-hover:border-accent-primary/50 transition-colors">
                        {m.profiles?.avatar_url ? (
                          <img src={m.profiles.avatar_url} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-brand-muted font-black text-[14px]">
                            {(m.profiles?.full_name || 'א')[0]}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col text-right">
                        <span className="text-brand font-black text-[15px] flex items-center gap-1.5">
                          {m.profiles?.full_name || 'אנונימי'}
                          {m.role === 'admin' && (
                            <ShieldAlert size={14} className="text-accent-primary" />
                          )}
                        </span>
                        <span className="text-brand-muted text-[11px]" dir="ltr">
                          @{m.profiles?.username}
                        </span>
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
