import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { FadeIn, Button } from '../components/ui';
import { VaultCard } from '../components/VaultCard';
import {
  Loader2, MessageSquare, Crown, Send, Lock, UserCircle, Trash2, Edit2, MoreVertical,
  Paperclip, Share2, Download, Link as LinkIcon, Bookmark, ShieldAlert, Gift, Flame,
  Eye, ChevronDown, ChevronUp, Reply, X, Diamond, Handshake, Coins, Plus, CheckCircle2
} from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export const CirclePage: React.FC = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { profile: myProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);
  
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem(`inner_circle_${slug}_cache`) || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(!data);
  const [activeTab, setActiveTab] = useState<'chat' | 'vaults' | 'members'>('chat');
  
  const [vaults, setVaults] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(`inner_vaults_${slug}_cache`) || '[]'); } catch { return []; }
  });
  const [loadingVaults, setLoadingVaults] = useState(vaults.length === 0);
  
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [joining, setJoining] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [membersList, setMembersList] = useState<any[]>([]);
  const [onlineCount, setOnlineCount] = useState(1);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  useEffect(() => { setMounted(true); }, []);

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => { fetchCircleData(uid); })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') { await ch.track({ isTyping: false }); }
      });
    };
    initCircle();
    return () => { if (ch) supabase.removeChannel(ch); };
  }, [slug]);

  useEffect(() => {
    if (activeTab === 'vaults' && data?.circle?.id) { fetchVaults(); }
  }, [activeTab, data?.circle?.id]);

  const fetchCircleData = async (uid: string) => {
    try {
      let circle: any = null;
      const { data: cData } = await supabase.from('circles').select('*').or(`slug.eq.${slug},id.eq.${slug}`).maybeSingle();
      if (!cData) throw new Error();
      circle = cData;
      
      let isMember = false;
      let membership = null;
      if (uid && !uid.startsWith('guest_')) {
        const { data: mData } = await supabase.from('circle_members').select('*').eq('circle_id', circle.id).eq('user_id', uid).maybeSingle();
        if (mData) { isMember = true; membership = mData; }
      }
      
      const { data: pData } = await supabase.from('posts').select('*, profiles!user_id(*)').eq('circle_id', circle.id).order('created_at', { ascending: false }).limit(40);
      
      fetchMembersList(circle.id);
      const res = { circle, isMember, membership, posts: pData || [] };
      setData(res);
      localStorage.setItem(`inner_circle_${slug}_cache`, JSON.stringify(res));
    } catch { navigate('/'); } finally { setLoading(false); }
  };

  const fetchMembersList = async (cid: string) => {
    const { data } = await supabase.from('circle_members').select('role, profiles(*)').eq('circle_id', cid);
    if (data) setMembersList(data.sort((a) => a.role === 'admin' ? -1 : 1));
  };

  const fetchVaults = async () => {
    const { data: vData } = await supabase.from('vaults').select('*').eq('circle_id', data.circle.id).eq('is_active', true).order('created_at', { ascending: false });
    if (vData) setVaults(vData);
    setLoadingVaults(false);
  };

  const handleJoin = async () => {
    setJoining(true); triggerFeedback('pop');
    try {
      await apiFetch(`/api/circles/${data.circle.slug}/join`, { method: 'POST' });
      triggerFeedback('success'); toast.success('ברוך הבא! 🎉');
      fetchCircleData(currentUserId);
    } catch { toast.error('שגיאה בהצטרפות'); } finally { setJoining(false); }
  };

  const handlePost = async () => {
    if (!newPost.trim() && !selectedFile) return;
    setPosting(true); triggerFeedback('pop');
    try {
      let media_url = null;
      if (selectedFile) {
        const fileName = `circle_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        const { data: up } = await supabase.storage.from('feed_images').upload(fileName, selectedFile);
        if (up) media_url = supabase.storage.from('feed_images').getPublicUrl(up.path).data.publicUrl;
      }
      const { data: post, error } = await supabase.from('posts').insert({
        circle_id: data.circle.id, user_id: currentUserId, content: newPost.trim(),
        media_url, media_type: selectedFile ? (selectedFile.type.startsWith('video') ? 'video' : 'image') : 'text'
      }).select('*, profiles!user_id(*)').single();
      if (error) throw error;
      setData((c: any) => ({ ...c, posts: [post, ...c.posts] }));
      setNewPost(''); setSelectedFile(null);
      triggerFeedback('success');
    } catch { toast.error('שגיאה בשליחה'); } finally { setPosting(false); }
  };

  if (loading || !data) return <div className="min-h-screen bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" size={32} /></div>;

  const isOwner = data.circle.creator_id === currentUserId || data.membership?.role === 'admin';

  return (
    <FadeIn className="bg-surface h-[100dvh] flex flex-col relative overflow-hidden" dir="rtl">
      {/* Header / Hero */}
      <div className="relative h-[180px] shrink-0 overflow-hidden flex flex-col justify-end pb-4 z-10">
        {data.circle.cover_url ? <img src={data.circle.cover_url} className="absolute inset-0 w-full h-full object-cover opacity-50" /> : <div className="absolute inset-0 bg-accent-primary/10" />}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
        <div className="relative z-10 px-5 flex flex-col items-center">
          <h1 className="text-2xl font-black text-white mb-2">{data.circle.name}</h1>
          <div className="flex items-center gap-3 bg-surface-card/60 backdrop-blur-md border border-white/5 px-4 py-1.5 rounded-full shadow-lg">
             <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
             <span className="text-[11px] font-black text-white">{onlineCount} אונליין</span>
          </div>
        </div>
      </div>

      {!data.isMember ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-6">
          <div className="w-20 h-20 rounded-[28px] bg-surface-card border border-white/5 flex items-center justify-center shadow-2xl"><Lock size={32} className="text-brand-muted" /></div>
          <h2 className="text-xl font-black text-brand uppercase tracking-widest">מועדון סגור</h2>
          <Button onClick={handleJoin} disabled={joining} className="w-full h-14 bg-white text-black font-black rounded-2xl uppercase tracking-widest shadow-xl">הצטרפות • {data.circle.join_price || 0} CRD</Button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Tabs */}
          <div className="flex justify-center py-2 px-4 shrink-0 z-20">
            <div className="flex bg-surface-card/50 border border-white/5 rounded-full p-1 w-full max-w-[320px]">
              {['chat', 'vaults', 'members'].map((t) => (
                <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-1 py-2 text-[11px] font-black uppercase transition-all rounded-full ${activeTab === t ? 'bg-accent-primary text-white shadow-lg' : 'text-brand-muted hover:text-brand'}`}>
                  {t === 'chat' ? 'צ׳אט' : t === 'vaults' ? 'כספות' : 'חברים'}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Content */}
          {activeTab === 'chat' && (
            <div className="flex-1 relative flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto scrollbar-hide p-4 flex flex-col-reverse gap-4 pb-40">
                {data.posts.map((p: any) => (
                  <div key={p.id} className={`flex gap-3 ${p.user_id === currentUserId ? 'flex-row-reverse' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-surface-card border border-white/5 shrink-0 mt-auto overflow-hidden">
                      {p.profiles?.avatar_url ? <img src={p.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={32} className="text-white/20" />}
                    </div>
                    <div className={`max-w-[75%] p-3.5 rounded-[22px] shadow-sm ${p.user_id === currentUserId ? 'bg-accent-primary/20 border border-accent-primary/30 text-white rounded-br-sm' : 'bg-surface-card border border-white/5 text-white/90 rounded-bl-sm'}`}>
                      {p.user_id !== currentUserId && <span className="text-[10px] font-black text-accent-primary block mb-1 uppercase tracking-tighter">{p.profiles?.full_name}</span>}
                      {p.media_url && (
                        <div className="mb-2 rounded-lg overflow-hidden border border-white/5">
                          {p.media_type === 'video' ? <video src={p.media_url} className="w-full" controls /> : <img src={p.media_url} className="w-full" />}
                        </div>
                      )}
                      <p className="text-[14px] leading-relaxed">{p.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* FLOATING FIXED INPUT */}
              <div className="fixed bottom-[100px] left-4 right-4 z-[999] pointer-events-none">
                <div className="flex flex-col items-start w-full pointer-events-auto">
                  <AnimatePresence>
                    {selectedFile && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mb-3 w-24 h-24 rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative">
                        <img src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover" />
                        <button onClick={() => setSelectedFile(null)} className="absolute top-1 right-1 bg-black/60 p-1 rounded-full text-white"><X size={12}/></button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <div className="w-full bg-surface-card/90 backdrop-blur-2xl border border-white/10 rounded-full h-[60px] flex items-center px-2 pr-4 shadow-[0_15px_40px_rgba(0,0,0,0.6)]">
                    <input 
                      type="text" value={newPost} onChange={(e) => { setNewPost(e.target.value); if(channelRef.current) channelRef.current.track({ isTyping: e.target.value.length > 0 }); }}
                      placeholder="הקלד הודעה..." className="flex-1 bg-transparent border-none outline-none text-white text-[14px] placeholder:text-white/30" 
                      onKeyDown={(e) => e.key === 'Enter' && handlePost()}
                    />
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => fileInputRef.current?.click()} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-white/5 text-white/40 transition-colors">
                        <Paperclip size={20} />
                      </button>
                      <button onClick={handlePost} disabled={posting || (!newPost.trim() && !selectedFile)} className="w-11 h-11 rounded-full bg-accent-primary text-white flex items-center justify-center active:scale-90 transition-all shadow-[0_0_15px_rgba(var(--color-accent-primary),0.4)]">
                        {posting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="rtl:-scale-x-100" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vaults' && (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-32">
              {vaults.map(v => <VaultCard key={v.id} vault={v} onUnlockSuccess={fetchVaults} />)}
              {isOwner && (
                <button onClick={() => navigate(`/circle/${slug}/vaults/create`)} className="fixed bottom-[110px] left-6 w-14 h-14 bg-accent-primary text-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 z-50">
                  <Plus size={28} />
                </button>
              )}
            </div>
          )}

          {activeTab === 'members' && (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 pb-32">
              {membersList.map((m: any) => (
                <div key={m.profiles.id} className="flex items-center gap-4 bg-surface-card p-4 rounded-[24px] border border-white/5 active:scale-[0.98] transition-all" onClick={() => navigate(`/profile/${m.profiles.id}`)}>
                  <div className="w-11 h-11 rounded-full overflow-hidden border border-white/5 bg-surface">
                    {m.profiles.avatar_url ? <img src={m.profiles.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={44} className="text-white/10" />}
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-white font-black text-sm flex items-center gap-1.5">{m.profiles.full_name} {m.role === 'admin' && <ShieldAlert size={12} className="text-accent-primary" />}</span>
                    <span className="text-white/30 text-[10px] font-bold">@{m.profiles.username}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <input type="file" ref={fileInputRef} onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="hidden" accept="image/*,video/*" />
    </FadeIn>
  );
};
