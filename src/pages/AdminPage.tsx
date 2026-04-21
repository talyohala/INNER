import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls, LayoutGroup } from 'framer-motion';
import {
  Loader2, Users, Search, Gift, Ban, MessageSquare, Trash2, 
  Activity, UserCircle, ShieldAlert, Zap, Coins, Image as ImageIcon, 
  X, Link as LinkIcon, Compass, CheckCircle, BarChart3, CalendarDays
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

// טוסט שקוף-פחם אלגנטי ונקי
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

type BottomSheetProps = { open: boolean; onClose: () => void; children: React.ReactNode; };

const BottomSheet: React.FC<BottomSheetProps> = ({ open, onClose, children }) => {
  const dragControls = useDragControls();
  const startSheetDrag = (e: React.PointerEvent<HTMLElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target || target.closest('input, button, textarea, a, [data-no-drag="true"]')) return;
    dragControls.start(e);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9900] flex flex-col justify-end" dir="rtl">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
          <motion.div
            drag="y" dragControls={dragControls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.1} dragMomentum={false}
            onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 450) onClose(); }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 500 }}
            className="bg-[#121212] rounded-t-[32px] h-auto min-h-[50vh] max-h-[90vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden"
          >
            <div className="w-full py-4 shrink-0" onPointerDown={startSheetDrag} style={{ touchAction: 'none' }} />
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 pt-0" onPointerDown={startSheetDrag} style={{ touchAction: 'pan-y' }}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const PLACEMENTS = [
  { id: 'feed', label: 'פיד ראשי' }, { id: 'explore', label: 'חיפוש' },
  { id: 'wallet', label: 'ארנק' }, { id: 'profile', label: 'פרופיל' }
];

const STYLES = [
  { id: 'hero', label: 'מסך מלא' }, { id: 'standard', label: 'כרטיסייה' }, { id: 'compact', label: 'פס צר' }
];

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  const defaultAdminData = { total_users: 0, total_crd: 0, total_posts: 0, total_circles: 0, pending_cashouts: [], recent_users: [], recent_posts: [], chart_data: [] };
  const [adminData, setAdminData] = useState(defaultAdminData);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'campaigns' | 'cashouts' | 'users' | 'content'>('dashboard');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [grantAmount, setGrantAmount] = useState<number | ''>('');
  const [actionLoading, setActionLoading] = useState(false);

  const [campPlacement, setCampPlacement] = useState(PLACEMENTS[0].id);
  const [campStyle, setCampStyle] = useState(STYLES[1].id);
  const [campTitle, setCampTitle] = useState('');
  const [campBody, setCampBody] = useState('');
  
  // תאריך ושעה בלבד (קלנדר)
  const [campExpiresAt, setCampExpiresAt] = useState(''); 

  const [campActionType, setCampActionType] = useState<'reward' | 'link'>('reward');
  const [campReward, setCampReward] = useState<number | ''>('');
  const [campLink, setCampLink] = useState('');
  const [campFile, setCampFile] = useState<File | null>(null);
  const [campDeploying, setCampDeploying] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (profile && profile.role_label !== 'CORE') { navigate('/'); return; }
    if (profile?.role_label === 'CORE') fetchAdminDataPureJS();
  }, [profile]);

  const fetchAdminDataPureJS = async () => {
    setLoading(true);
    try {
      const { data: profData, error: profErr } = await supabase.from('profiles').select('id, crd_balance');
      if (profErr) throw profErr;
      const total_users = profData.length;
      const total_crd = profData.reduce((sum, p) => sum + (p.crd_balance || 0), 0);

      const { count: total_posts } = await supabase.from('posts').select('id', { count: 'exact', head: true });
      const { count: total_circles } = await supabase.from('circles').select('id', { count: 'exact', head: true });

      const { data: recent_users } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(20);

      const { data: recent_posts_raw } = await supabase.from('posts').select('id, content, media_url, user_id, created_at').order('created_at', { ascending: false }).limit(20);
      let recent_posts = [];
      if (recent_posts_raw && recent_posts_raw.length > 0) {
        const uIds = [...new Set(recent_posts_raw.map(p => p.user_id))];
        const { data: pProfs } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', uIds);
        recent_posts = recent_posts_raw.map(p => {
          const u = pProfs?.find(x => x.id === p.user_id) || {};
          return { ...p, full_name: u.full_name, avatar_url: u.avatar_url };
        });
      }

      let pending_cashouts = [];
      try {
        const { data: cashouts } = await supabase.from('wallet_transactions').select('id, amount, created_at, user_id').eq('type', 'cashout').eq('status', 'pending').order('created_at', { ascending: false });
        if (cashouts && cashouts.length > 0) {
          const userIds = cashouts.map(c => c.user_id);
          const { data: cProfs } = await supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', userIds);
          pending_cashouts = cashouts.map(c => {
            const p = cProfs?.find(x => x.id === c.user_id) || {};
            return { ...c, full_name: p.full_name, username: p.username, avatar_url: p.avatar_url };
          });
        }
      } catch(e) { }

      const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date(); d.setDate(d.getDate() - i);
        return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
      }).reverse();
      
      const chartMap: Record<string, number> = {};
      last7Days.forEach(date => chartMap[date] = 0);
      
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentProfiles } = await supabase.from('profiles').select('created_at').gte('created_at', sevenDaysAgo);
      
      if (recentProfiles) {
        recentProfiles.forEach(p => {
          const d = new Date(p.created_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
          if (chartMap[d] !== undefined) chartMap[d]++;
        });
      }
      const chart_data = Object.entries(chartMap).map(([date, count]) => ({ date, count }));

      setAdminData({
        total_users, total_crd, total_posts: total_posts || 0, total_circles: total_circles || 0,
        pending_cashouts, recent_users: recent_users || [], recent_posts, chart_data
      });

    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCashoutAction = async (txId: string, action: 'approve' | 'reject') => {
    triggerFeedback('pop'); const tid = toast('מעדכן בקשה...', { style: cleanToastStyle });
    try {
      await supabase.from('wallet_transactions').update({ status: action === 'approve' ? 'completed' : 'rejected' }).eq('id', txId);
      toast(action === 'approve' ? 'הבקשה אושרה' : 'הבקשה נדחתה', { id: tid, style: cleanToastStyle });
      triggerFeedback('success'); await fetchAdminDataPureJS();
    } catch (err: any) { toast('שגיאה בעדכון', { id: tid, style: cleanToastStyle }); }
  };

  const handleGrantCrd = async () => {
    if (!selectedUser || !grantAmount) return;
    setActionLoading(true); triggerFeedback('pop');
    try {
      const { data: u } = await supabase.from('profiles').select('crd_balance').eq('id', selectedUser.id).single();
      if (u) {
        await supabase.from('profiles').update({ crd_balance: (u.crd_balance || 0) + Number(grantAmount) }).eq('id', selectedUser.id);
        toast(`הועברו ${grantAmount} CRD בהצלחה`, { style: cleanToastStyle });
        triggerFeedback('coin');
      }
      setGrantAmount(''); setSelectedUser(null); await fetchAdminDataPureJS();
    } catch (err) { toast('שגיאה בהעברה', { style: cleanToastStyle }); } 
    finally { setActionLoading(false); }
  };

  const handleToggleBan = async (user: any) => {
    const newStatus = !user.is_banned;
    if (!window.confirm(newStatus ? 'לחסום משתמש זה?' : 'לשחרר חסימה למשתמש זה?')) return;
    setActionLoading(true); triggerFeedback('pop');
    try {
      await supabase.from('profiles').update({ is_banned: newStatus }).eq('id', user.id);
      toast(newStatus ? 'המשתמש נחסם' : 'החסימה שוחררה', { style: cleanToastStyle });
      setSelectedUser(null); await fetchAdminDataPureJS();
    } catch (err) { toast('שגיאה בעדכון חסימה', { style: cleanToastStyle }); } 
    finally { setActionLoading(false); }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('למחוק פעילות זו לצמיתות?')) return;
    triggerFeedback('pop');
    try {
      await supabase.from('posts').delete().eq('id', postId);
      toast('הפעילות נמחקה', { style: cleanToastStyle });
      await fetchAdminDataPureJS();
    } catch (err) { toast('שגיאה במחיקה', { style: cleanToastStyle }); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) { setCampFile(file); } 
    else if (file) { toast('קובץ מדיה בלבד', { style: cleanToastStyle }); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeployCampaign = async () => {
    if (!campTitle.trim()) return toast('חובה למלא כותרת', { style: cleanToastStyle });
    if (campActionType === 'link' && !campLink.trim()) return toast('חובה להזין קישור', { style: cleanToastStyle });

    setCampDeploying(true); triggerFeedback('pop');
    const tid = toast('מפרסם...', { style: cleanToastStyle });

    try {
      let media_url = null; let media_type = 'image'; let expires_at = null;

      if (campExpiresAt) {
        expires_at = new Date(campExpiresAt).toISOString();
      }

      if (campFile) {
        const safeName = campFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const fileName = `camp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${safeName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('feed_images').upload(fileName, campFile, { cacheControl: '3600', upsert: false });
        if (uploadError) throw new Error("שגיאה בהעלאת הקובץ");
        const { data: { publicUrl } } = supabase.storage.from('feed_images').getPublicUrl(uploadData.path);
        media_url = publicUrl; media_type = campFile.type.startsWith('video/') ? 'video' : 'image';
      }

      await supabase.from('campaigns').insert({
        placement: campPlacement, title: campTitle, body: campBody,
        reward: campActionType === 'reward' ? (Number(campReward) || 0) : 0,
        action_url: campActionType === 'link' ? campLink : null, active: true, style: campStyle, media_url, media_type, expires_at
      });

      toast('הקמפיין באוויר 🚀', { id: tid, style: cleanToastStyle }); triggerFeedback('success');
      setCampTitle(''); setCampBody(''); setCampReward(''); setCampLink(''); setCampFile(null); setCampExpiresAt('');
    } catch (err: any) {
      toast(`שגיאה: ${err.message}`, { id: tid, style: cleanToastStyle });
    } finally { setCampDeploying(false); }
  };

  const filteredUsers = (adminData.recent_users || []).filter((u: any) =>
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const maxChartValue = Math.max(...(adminData.chart_data || []).map((d: any) => d.count), 1);

  if (loading) return <div className="min-h-[100dvh] bg-[#121212] flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" size={32} /></div>;

  return (
    <FadeIn className="bg-[#121212] min-h-[100dvh] font-sans flex flex-col relative overflow-hidden pb-24" dir="rtl">
      
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />

      {/* HEADER */}
      <div className="pt-[calc(env(safe-area-inset-top)+20px)] px-6 pb-6 flex flex-col items-center justify-center relative z-10 text-center">
        <h1 className="text-[28px] font-black text-white tracking-widest drop-shadow-md">פאנל ניהול ושליטה</h1>
      </div>

      {/* MAIN TABS */}
      <div className="px-5 mb-8 relative z-10">
        <LayoutGroup id="mainTabs">
          <div className="flex flex-col items-center gap-4 bg-surface-card rounded-[24px] p-4 shadow-sm">
            <div className="flex items-center gap-x-8 gap-y-1">
              {['dashboard', 'campaigns', 'cashouts'].map(tab => {
                const isActive = activeTab === tab;
                const label = tab === 'dashboard' ? 'סקירה' : tab === 'campaigns' ? 'קמפיינים' : 'משיכות';
                return (
                  <button key={tab} onClick={() => { triggerFeedback('pop'); setActiveTab(tab as any); }} className="relative flex flex-col items-center min-w-max pb-2.5 active:scale-95 transition-all">
                    <span className={`text-[15px] transition-colors ${isActive ? 'text-brand font-black' : 'text-brand-muted font-bold hover:text-brand'}`}>
                      {label}
                    </span>
                    {isActive && <motion.div layoutId="main-tab-dot" className="absolute -bottom-1 w-1.5 h-1.5 bg-accent-primary rounded-full shadow-sm" />}
                    {tab === 'cashouts' && adminData.pending_cashouts.length > 0 && <span className="absolute top-0 -left-2.5 w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-x-8 gap-y-1">
              {['users', 'content'].map(tab => {
                const isActive = activeTab === tab;
                const label = tab === 'users' ? 'משתמשים' : 'פעילות';
                return (
                  <button key={tab} onClick={() => { triggerFeedback('pop'); setActiveTab(tab as any); }} className="relative flex flex-col items-center min-w-max pb-2.5 active:scale-95 transition-all">
                    <span className={`text-[15px] transition-colors ${isActive ? 'text-brand font-black' : 'text-brand-muted font-bold hover:text-brand'}`}>
                      {label}
                    </span>
                    {isActive && <motion.div layoutId="main-tab-dot" className="absolute -bottom-1 w-1.5 h-1.5 bg-accent-primary rounded-full shadow-sm" />}
                  </button>
                )
              })}
            </div>
          </div>
        </LayoutGroup>
      </div>

      <div className="flex-1 overflow-y-auto px-5 scrollbar-hide pb-10 relative z-10">
        <AnimatePresence mode="wait">
          
          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <motion.div key="dash" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-6">
              
              <div className="bg-surface-card pt-10 pb-8 rounded-[24px] flex flex-col items-center text-center shadow-sm relative overflow-hidden">
                <span className="text-brand-muted text-[11px] font-black uppercase tracking-[0.2em] mb-1 z-10 flex items-center gap-1.5"><Coins size={14}/> כלכלת האפליקציה</span>
                <div className="flex flex-col items-center justify-center mt-2 z-10 relative">
                  <span className="text-[52px] font-black text-brand tracking-tighter leading-none">{adminData.total_crd.toLocaleString()}</span>
                  <span className="text-[10px] font-black text-accent-primary uppercase tracking-[0.5em] mt-3">CRD במחזור הכללי</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-card rounded-[24px] p-5 shadow-sm flex flex-col items-center text-center">
                  <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-2"><Users size={14}/> משתמשים</span>
                  <span className="text-brand font-black text-2xl">{adminData.total_users.toLocaleString()}</span>
                </div>
                <div className="bg-surface-card rounded-[24px] p-5 shadow-sm flex flex-col items-center text-center">
                  <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-2"><Compass size={14}/> מועדונים</span>
                  <span className="text-brand font-black text-2xl">{adminData.total_circles.toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-surface-card rounded-[32px] p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5"><BarChart3 size={14}/> הרשמות אחרונות</span>
                  <span className="text-brand font-black text-[13px]">{adminData.total_posts.toLocaleString()} פוסטים באוויר</span>
                </div>
                <div className="flex items-end justify-between h-32 gap-2">
                  {adminData.chart_data.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-brand-muted text-[12px] font-bold">אין נתונים כרגע</div>
                  ) : (
                    adminData.chart_data.map((data: any, i: number) => {
                      const heightPercent = Math.max((data.count / maxChartValue) * 100, 5);
                      return (
                        <div key={i} className="flex flex-col items-center gap-2 flex-1 h-full">
                          <div className="w-full bg-black/20 rounded-t-[6px] flex flex-col justify-end h-full relative group overflow-hidden shadow-inner">
                            <motion.div initial={{ height: 0 }} animate={{ height: `${heightPercent}%` }} className="bg-accent-primary group-hover:opacity-100 opacity-60 rounded-t-sm w-full transition-opacity" />
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-[10px] text-brand font-black whitespace-nowrap">{data.count}</span>
                          </div>
                          <span className="text-[10px] font-bold text-brand-muted mt-1">{data.date}</span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

            </motion.div>
          )}
          
          {/* TAB: CAMPAIGNS */}
          {activeTab === 'campaigns' && (
            <motion.div key="campaigns" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-8">
              
              <div className="flex flex-col gap-3">
                <span className="text-brand-muted text-[11px] font-bold uppercase tracking-widest">מיקום הקמפיין</span>
                <LayoutGroup id="placementGroup">
                  <div className="flex items-center gap-x-8 gap-y-1 overflow-x-auto scrollbar-hide pb-2">
                    {PLACEMENTS.map(pos => {
                      const isActive = campPlacement === pos.id;
                      return (
                        <button key={pos.id} onClick={() => { triggerFeedback('pop'); setCampPlacement(pos.id); }} className="relative flex flex-col items-center min-w-max pb-3 active:scale-95 transition-transform">
                          <span className={`text-[15px] transition-colors ${isActive ? 'text-brand font-black' : 'text-brand-muted font-bold'}`}>{pos.label}</span>
                          {isActive && <motion.div layoutId="placementBar" className="absolute bottom-0 w-5 h-0.5 bg-accent-primary rounded-full" />}
                        </button>
                      )
                    })}
                  </div>
                </LayoutGroup>
              </div>

              <div className="flex flex-col gap-3">
                <span className="text-brand-muted text-[11px] font-bold uppercase tracking-widest">סגנון תצוגה</span>
                <LayoutGroup id="styleGroup">
                  <div className="flex items-center gap-x-8 gap-y-1 overflow-x-auto scrollbar-hide pb-2">
                    {STYLES.map(style => {
                      const isActive = campStyle === style.id;
                      return (
                        <button key={style.id} onClick={() => { triggerFeedback('pop'); setCampStyle(style.id); }} className="relative flex flex-col items-center min-w-max pb-3 active:scale-95 transition-transform">
                          <span className={`text-[15px] transition-colors ${isActive ? 'text-brand font-black' : 'text-brand-muted font-bold'}`}>{style.label}</span>
                          {isActive && <motion.div layoutId="styleBar" className="absolute bottom-0 w-5 h-0.5 bg-accent-primary rounded-full" />}
                        </button>
                      )
                    })}
                  </div>
                </LayoutGroup>
              </div>

              <div className="flex flex-col gap-3">
                <span className="text-brand-muted text-[11px] font-bold uppercase tracking-widest">תוקף וזמן באוויר</span>
                <div className="relative mt-1">
                  <CalendarDays size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-muted" />
                  <input 
                    type="datetime-local" 
                    value={campExpiresAt} 
                    onChange={e=>setCampExpiresAt(e.target.value)} 
                    style={{ colorScheme: 'dark' }} 
                    className="w-full bg-surface-card h-14 rounded-[20px] pl-4 pr-12 text-brand font-black outline-none focus:ring-2 focus:ring-accent-primary/50 transition-colors text-left shadow-sm border-none" 
                    dir="ltr" 
                  />
                  {!campExpiresAt && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted text-[12px] font-bold pointer-events-none">בחר תאריך ושעה (אופציונלי)</span>}
                </div>
              </div>

              <div className="flex flex-col gap-4 mt-2">
                <div onClick={() => fileInputRef.current?.click()} className={`w-full h-40 rounded-[20px] bg-surface-card border-2 ${campFile ? 'border-accent-primary/50' : 'border-dashed border-white/5'} flex flex-col items-center justify-center cursor-pointer relative overflow-hidden`}>
                  {campFile ? (
                    <>
                      {campFile.type.startsWith('video/') ? (
                        <video src={URL.createObjectURL(campFile)} className="w-full h-full object-cover" />
                      ) : (
                        <img src={URL.createObjectURL(campFile)} className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white font-black text-[12px]">החלף מדיה</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-brand-muted">
                      <ImageIcon size={24} />
                      <span className="text-[12px] font-medium">העלאת תמונה / וידאו</span>
                    </div>
                  )}
                </div>
                {campFile && <button onClick={() => setCampFile(null)} className="text-rose-500 text-[10px] font-black uppercase tracking-widest self-end px-2">הסר מדיה</button>}

                <input type="text" value={campTitle} onChange={e=>setCampTitle(e.target.value)} placeholder="כותרת הקמפיין..." className="w-full bg-surface-card h-14 rounded-[16px] px-5 text-brand font-black outline-none focus:ring-2 focus:ring-accent-primary/50 transition-colors placeholder:text-brand-muted border-none" />
                <textarea value={campBody} onChange={e=>setCampBody(e.target.value)} placeholder="תוכן הקמפיין..." className="w-full bg-surface-card h-24 rounded-[16px] p-5 text-brand font-bold outline-none focus:ring-2 focus:ring-accent-primary/50 transition-colors resize-none placeholder:text-brand-muted border-none" />
              </div>

              <div className="flex flex-col gap-3 mt-4">
                <span className="text-brand-muted text-[11px] font-bold uppercase tracking-widest">פעולת משתמש</span>
                <LayoutGroup id="actionGroup">
                  <div className="flex items-center gap-x-8 gap-y-1 overflow-x-auto scrollbar-hide pb-2">
                    {[
                      { id: 'reward', label: 'CRD' },
                      { id: 'link', label: 'קישור חיצוני' }
                    ].map(act => {
                      const isActive = campActionType === act.id;
                      return (
                        <button key={act.id} onClick={() => { triggerFeedback('pop'); setCampActionType(act.id as any); }} className="relative flex flex-col items-center min-w-max pb-3 active:scale-95 transition-transform">
                          <span className={`text-[15px] transition-colors ${isActive ? 'text-accent-primary font-black' : 'text-brand-muted font-bold'}`}>{act.label}</span>
                          {isActive && <motion.div layoutId="actionBar" className="absolute bottom-0 w-5 h-0.5 bg-accent-primary rounded-full" />}
                        </button>
                      )
                    })}
                  </div>
                </LayoutGroup>

                <AnimatePresence mode="wait">
                  {campActionType === 'reward' ? (
                    <motion.div key="reward" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="relative overflow-hidden mt-1">
                      <Zap size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted" />
                      <input type="number" value={campReward} onChange={e=>setCampReward(Number(e.target.value))} placeholder="סכום תגמול (CRD)..." dir="ltr" className="w-full bg-surface-card h-14 rounded-[16px] pl-12 pr-4 text-brand font-black outline-none focus:ring-2 focus:ring-accent-primary/50 transition-colors text-left placeholder:text-brand-muted border-none" />
                    </motion.div>
                  ) : (
                    <motion.div key="link" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="relative overflow-hidden mt-1">
                      <LinkIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted" />
                      <input type="url" value={campLink} onChange={e=>setCampLink(e.target.value)} placeholder="https://..." dir="ltr" className="w-full bg-surface-card h-14 rounded-[16px] pl-12 pr-4 text-brand font-bold outline-none focus:ring-2 focus:ring-accent-primary/50 transition-colors text-left placeholder:text-brand-muted border-none" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Button onClick={handleDeployCampaign} disabled={campDeploying || !campTitle.trim()} className="h-16 w-full mt-4 rounded-[20px] bg-white text-black font-black text-[15px] uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 border-none shadow-md">
                {campDeploying ? <Loader2 size={24} className="animate-spin text-black" /> : 'פרסם'}
              </Button>
            </motion.div>
          )}

          {/* TAB: CASHOUTS */}
          {activeTab === 'cashouts' && (
            <motion.div key="cashouts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-4">
              {adminData.pending_cashouts.length === 0 ? (
                <div className="py-24 flex flex-col items-center text-center">
                  <CheckCircle size={40} className="text-brand-muted mb-3" strokeWidth={1.5} />
                  <span className="text-brand-muted font-bold text-[14px]">אין משיכות ממתינות</span>
                </div>
              ) : (
                adminData.pending_cashouts.map((tx: any) => (
                  <div key={tx.id} className="bg-surface-card rounded-[24px] p-5 flex flex-col relative shadow-sm">
                    <div className="flex items-center justify-between pb-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-black/20">
                          {tx.avatar_url ? <img src={tx.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={20} className="text-brand-muted w-full h-full p-2" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-brand font-black text-[14px]">{tx.full_name}</span>
                          <span className="text-brand-muted text-[11px] font-bold mt-0.5" dir="ltr">@{tx.username}</span>
                        </div>
                      </div>
                      <span className="text-accent-primary font-black text-xl" dir="ltr">{Math.abs(tx.amount)}</span>
                    </div>
                    <div className="flex gap-2 relative z-10">
                      <button onClick={() => handleCashoutAction(tx.id, 'approve')} className="flex-1 h-12 bg-white/5 text-white hover:bg-white/10 text-[13px] font-black tracking-widest uppercase rounded-[16px] transition-colors border-none">
                        אישור
                      </button>
                      <button onClick={() => { if(window.confirm('לדחות ולהחזיר למשתמש את ה-CRD?')) handleCashoutAction(tx.id, 'reject'); }} className="flex-1 h-12 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-[13px] font-black tracking-widest uppercase rounded-[16px] transition-colors border-none">
                        דחייה
                      </button>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {/* TAB: USERS */}
          {activeTab === 'users' && (
            <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-4 relative z-10">
              <div className="relative">
                <Search size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-muted" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="איתור משתמש..." className="w-full bg-surface-card text-brand font-bold h-14 rounded-[20px] pl-5 pr-12 outline-none focus:ring-2 focus:ring-accent-primary/50 transition-colors text-[14px] placeholder:text-brand-muted border-none shadow-sm" />
              </div>
              <div className="flex flex-col gap-3">
                {filteredUsers.map((u: any) => (
                  <div key={u.id} onClick={() => { triggerFeedback('pop'); setSelectedUser(u); }} className={`flex items-center justify-between p-3 px-4 bg-surface-card ${u.is_banned ? 'border border-rose-500/30' : 'border-none'} rounded-[20px] cursor-pointer active:scale-[0.98] transition-all shadow-sm`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full overflow-hidden bg-black/20 flex items-center justify-center ${u.is_banned ? 'grayscale opacity-40' : ''}`}>
                        {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={20} className="text-brand-muted" />}
                      </div>
                      <div className="flex flex-col">
                        <span className={`font-black text-[14px] flex items-center gap-1.5 ${u.is_banned ? 'text-rose-500 line-through' : 'text-brand'}`}>
                          {u.full_name} {u.role_label === 'CORE' && <ShieldAlert size={12} className="text-accent-primary" />}
                        </span>
                        <span className="text-brand-muted text-[11px] font-bold" dir="ltr">@{u.username}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-[#0a0a0a] px-3 py-1 rounded-[10px] shadow-inner">
                      <span className="text-white font-black text-[13px]">{u.crd_balance}</span>
                      <Zap size={12} className="text-brand-muted" />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB: CONTENT (פעילות) */}
          {activeTab === 'content' && (
            <motion.div key="content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-4 relative z-10">
              {adminData.recent_posts.map((p: any) => (
                <div key={p.id} className="bg-surface-card rounded-[24px] p-5 flex flex-col gap-4 relative shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-[#0a0a0a] flex items-center justify-center">
                        {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={18} className="text-brand-muted" />}
                      </div>
                      <span className="text-brand font-black text-[13px]">{p.full_name}</span>
                    </div>
                    <button onClick={() => handleDeletePost(p.id)} className="text-brand-muted hover:text-rose-500 active:scale-90 transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {p.media_url && <img src={p.media_url} className="w-full h-40 object-cover rounded-[16px] relative z-10" />}
                  <p className="text-brand text-[14px] leading-relaxed whitespace-pre-wrap relative z-10">{p.content}</p>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* USER MANAGEMENT MODAL */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <BottomSheet open={!!selectedUser} onClose={() => setSelectedUser(null)}>
          {selectedUser && (
            <div className="flex flex-col gap-6 text-center items-center pb-6">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-surface-card shrink-0 flex items-center justify-center shadow-lg relative">
                {selectedUser.avatar_url ? <img src={selectedUser.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={32} className="text-brand-muted" />}
              </div>
              <div className="flex flex-col items-center gap-1">
                <h2 className="text-brand font-black text-2xl flex items-center gap-2">{selectedUser.full_name} {selectedUser.role_label === 'CORE' && <ShieldAlert size={18} className="text-accent-primary" />}</h2>
                <span className="text-brand-muted text-[13px] font-bold mt-1" dir="ltr">@{selectedUser.username}</span>
              </div>

              <div className="w-full bg-surface-card rounded-[24px] p-6 flex flex-col items-center gap-1 shadow-sm">
                <span className="text-[10px] text-brand-muted font-black uppercase tracking-widest">יתרה זמינה למשתמש</span>
                <span className="text-accent-primary font-black text-4xl flex items-center gap-2">{selectedUser.crd_balance} <Zap size={20} className="text-brand-muted" /></span>
              </div>

              <div className="w-full flex flex-col gap-3 mt-2">
                <h4 className="text-brand-muted text-[11px] font-bold uppercase tracking-widest text-right px-2">פעולות הנהלה</h4>

                <div className="flex items-center gap-2 bg-surface-card p-1.5 pl-4 rounded-[18px] shadow-sm">
                  <Gift size={18} className="text-brand-muted mr-2" />
                  <input type="number" value={grantAmount} onChange={(e) => setGrantAmount(Number(e.target.value))} placeholder="הזן בונוס (CRD)" className="flex-1 bg-transparent border-none text-brand font-black outline-none h-12 px-2 placeholder:text-brand-muted text-[15px]" data-no-drag="true" />
                  <Button onClick={handleGrantCrd} disabled={actionLoading || !grantAmount} className="h-10 bg-white text-black rounded-[14px] px-6 text-[13px] font-black active:scale-95 disabled:opacity-50 transition-all border-none">שגר</Button>
                </div>

                <button onClick={() => handleToggleBan(selectedUser)} disabled={actionLoading} className={`w-full h-14 rounded-[18px] flex items-center justify-center gap-2.5 font-black text-[14px] tracking-widest uppercase transition-all active:scale-[0.98] border-none ${selectedUser.is_banned ? 'bg-white/5 text-white' : 'bg-rose-500/10 text-rose-500'}`}>
                  <Ban size={16} /> {selectedUser.is_banned ? 'שחרר חסימה' : 'השעה משתמש'}
                </button>
              </div>
            </div>
          )}
        </BottomSheet>, document.body
      )}
    </FadeIn>
  );
};
