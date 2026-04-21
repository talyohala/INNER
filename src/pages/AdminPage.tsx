import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
  CheckCircle, XCircle, Loader2, Users, Search, Gift, Ban, MessageSquare,
  Trash2, Activity, UserCircle, ShieldAlert, Zap, Coins, Image as ImageIcon, X, Link as LinkIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

// טוסט לבן שקוף ונקי (ללא אייקונים)
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

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

const BottomSheet: React.FC<BottomSheetProps> = ({ open, onClose, children }) => {
  const dragControls = useDragControls();
  const startSheetDrag = (e: React.PointerEvent<HTMLElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('input, button, textarea, a, [data-no-drag="true"]')) return;
    dragControls.start(e);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9900] flex flex-col justify-end" dir="rtl">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
          <motion.div
            drag="y" dragControls={dragControls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.1} dragMomentum={false}
            onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 450) onClose(); }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 500 }}
            className="bg-surface rounded-t-[40px] h-auto min-h-[50vh] max-h-[90vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden border-t border-white/10"
          >
            <div className="w-full py-5 flex justify-center shrink-0 cursor-grab active:cursor-grabbing border-b border-surface-border" onPointerDown={startSheetDrag} style={{ touchAction: 'none' }}>
              <div className="w-16 h-1.5 bg-white/20 rounded-full pointer-events-none" />
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6" onPointerDown={startSheetDrag} style={{ touchAction: 'pan-y' }}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const PLACEMENTS = [
  { id: 'feed', label: 'פיד ראשי' },
  { id: 'explore', label: 'חיפוש וגילוי' },
  { id: 'wallet', label: 'ארנק' },
  { id: 'radar', label: 'רדאר' },
  { id: 'profile', label: 'פרופיל אישי' },
  { id: 'shop', label: 'חנות' },
  { id: 'notifications', label: 'התראות' }
];

const STYLES = [
  { id: 'hero', label: 'מסך מלא (מקצה לקצה)' },
  { id: 'standard', label: 'כרטיסייה רגילה' },
  { id: 'compact', label: 'פס צר וקומפקטי' }
];

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultAdminData = { total_users: 0, total_crd: 0, total_posts: 0, total_circles: 0, pending_cashouts: [], recent_users: [], recent_posts: [], chart_data: [] };

  const [adminData, setAdminData] = useState(() => {
    try { return JSON.parse(localStorage.getItem('inner_admin_cache') || 'null') || defaultAdminData; } catch { return defaultAdminData; }
  });
  const [loading, setLoading] = useState(adminData.total_users === 0);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cashouts' | 'users' | 'content' | 'campaigns'>('dashboard');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [grantAmount, setGrantAmount] = useState<number | ''>('');
  const [actionLoading, setActionLoading] = useState(false);

  const [campPlacement, setCampPlacement] = useState(PLACEMENTS[0].id);
  const [campStyle, setCampStyle] = useState(STYLES[1].id);
  const [campTitle, setCampTitle] = useState('');
  const [campBody, setCampBody] = useState('');
  const [campExpiresDays, setCampExpiresDays] = useState<number | ''>(''); // תוקף בימים

  const [campActionType, setCampActionType] = useState<'reward' | 'link'>('reward');
  const [campReward, setCampReward] = useState<number | ''>('');
  const [campLink, setCampLink] = useState('');
  const [campFile, setCampFile] = useState<File | null>(null);
  const [campDeploying, setCampDeploying] = useState(false);

  useEffect(() => {
    if (profile && profile.role_label !== 'CORE') { navigate('/'); return; }
    if (profile?.role_label === 'CORE') fetchAdminData();
  }, [profile]);

  const fetchAdminData = async () => {
    try {
      const { data, error } = await supabase.rpc('get_admin_data');
      if (error) throw error;
      setAdminData(data as any);
      localStorage.setItem('inner_admin_cache', JSON.stringify(data));
    } catch (err) {
      toast('שגיאה בטעינת נתונים', { style: cleanToastStyle });
    } finally {
      setLoading(false);
    }
  };

  const handleCashoutAction = async (txId: string, action: 'approve' | 'reject') => {
    triggerFeedback('pop');
    const tid = toast('מעדכן בקשה...', { style: cleanToastStyle });
    try {
      const { error } = await supabase.rpc('admin_resolve_cashout', { p_tx_id: txId, p_action: action });
      if (error) throw error;
      toast(action === 'approve' ? 'הבקשה אושרה והכסף ירד' : 'הבקשה נדחתה והכסף הוחזר', { id: tid, style: cleanToastStyle });
      triggerFeedback('success');
      await fetchAdminData();
    } catch (err: any) {
      toast(err.message || 'שגיאה', { id: tid, style: cleanToastStyle });
    }
  };

  const handleGrantCrd = async () => {
    if (!selectedUser || !grantAmount) return;
    setActionLoading(true); triggerFeedback('pop');
    try {
      const { error } = await supabase.rpc('admin_grant_crd', { p_user_id: selectedUser.id, p_amount: Number(grantAmount) });
      if (error) throw error;
      toast(`הועברו ${grantAmount} CRD בהצלחה`, { style: cleanToastStyle });
      triggerFeedback('coin');
      setGrantAmount(''); setSelectedUser(null); await fetchAdminData();
    } catch (err) {
      toast('שגיאה בהעברת CRD', { style: cleanToastStyle });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleBan = async (user: any) => {
    const newStatus = !user.is_banned;
    if (!window.confirm(newStatus ? 'לחסום משתמש זה?' : 'לשחרר חסימה למשתמש זה?')) return;
    setActionLoading(true); triggerFeedback('pop');
    try {
      const { error } = await supabase.rpc('admin_toggle_ban', { p_user_id: user.id, p_ban_status: newStatus });
      if (error) throw error;
      toast(newStatus ? 'המשתמש נחסם' : 'החסימה שוחררה', { style: cleanToastStyle });
      setSelectedUser(null); await fetchAdminData();
    } catch (err) {
      toast('שגיאה בעדכון חסימה', { style: cleanToastStyle });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('למחוק פוסט זה לצמיתות מהמערכת?')) return;
    triggerFeedback('pop');
    try {
      const { error } = await supabase.rpc('admin_delete_post', { p_post_id: postId });
      if (error) throw error;
      toast('הפוסט הוסר בהצלחה', { style: cleanToastStyle });
      await fetchAdminData();
    } catch (err) {
      toast('שגיאה במחיקת פוסט', { style: cleanToastStyle });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      setCampFile(file);
    } else if (file) {
      toast('יש לבחור קובץ תמונה או וידאו בלבד', { style: cleanToastStyle });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeployCampaign = async () => {
    if (!campTitle.trim()) return toast('חובה למלא כותרת', { style: cleanToastStyle });
    if (campActionType === 'link' && !campLink.trim()) return toast('חובה להזין קישור לפרסומת', { style: cleanToastStyle });

    setCampDeploying(true);
    triggerFeedback('pop');
    const tid = toast('משגר קמפיין לאוויר...', { style: cleanToastStyle });

    try {
      let media_url = null;
      let media_type = 'image';
      let expires_at = null;

      // חישוב תאריך התפוגה אם הוגדר
      if (campExpiresDays && Number(campExpiresDays) > 0) {
        const d = new Date();
        d.setDate(d.getDate() + Number(campExpiresDays));
        expires_at = d.toISOString();
      }

      if (campFile) {
        const safeName = campFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const fileName = `camp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${safeName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('feed_images').upload(fileName, campFile, {
          cacheControl: '3600',
          upsert: false
        });
        if (uploadError) throw new Error("שגיאה בהעלאת הקובץ");
        const { data: { publicUrl } } = supabase.storage.from('feed_images').getPublicUrl(uploadData.path);
        media_url = publicUrl;
        media_type = campFile.type.startsWith('video/') ? 'video' : 'image';
      }

      const { error } = await supabase.from('campaigns').insert({
        placement: campPlacement,
        title: campTitle,
        body: campBody,
        reward: campActionType === 'reward' ? (Number(campReward) || 0) : 0,
        action_url: campActionType === 'link' ? campLink : null,
        active: true,
        style: campStyle,
        media_url: media_url,
        media_type: media_type,
        expires_at: expires_at
      }).select();

      if (error) throw error;

      toast('הקמפיין שוגר בהצלחה', { id: tid, style: cleanToastStyle });
      triggerFeedback('success');

      // Reset form
      setCampTitle(''); setCampBody(''); setCampReward(''); setCampLink(''); setCampFile(null); setCampExpiresDays('');
    } catch (err: any) {
      toast(`שגיאה בשיגור: ${err.message}`, { id: tid, style: cleanToastStyle });
    } finally {
      setCampDeploying(false);
    }
  };

  const filteredUsers = (adminData.recent_users || []).filter((u: any) =>
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const maxChartValue = Math.max(...(adminData.chart_data || []).map((d: any) => d.count), 1);

  if (loading) return <div className="min-h-screen bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" size={32} /></div>;

  return (
    <FadeIn className="bg-surface min-h-[100dvh] font-sans flex flex-col relative overflow-hidden pb-24" dir="rtl">
      
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />

      {/* HEADER */}
      <div className="pt-[calc(env(safe-area-inset-top)+32px)] px-6 pb-8 flex flex-col items-center justify-center relative z-10 text-center">
        <span className="text-accent-primary text-[10px] font-black tracking-[0.25em] uppercase mb-2 drop-shadow-md">מערכת הליבה</span>
        <h1 className="text-3xl font-black text-brand tracking-widest drop-shadow-lg">פאנל ניהול</h1>
      </div>

      {/* TABS - עיצוב יוקרתי לכרטיסיות */}
      <div className="px-4 mb-6 relative z-10 overflow-x-auto scrollbar-hide">
        <div className="flex items-center justify-center gap-2 min-w-max pb-1">
          {['dashboard', 'campaigns', 'cashouts', 'users', 'content'].map(tab => (
            <button key={tab} onClick={() => { triggerFeedback('pop'); setActiveTab(tab as any); }} className={`px-6 py-2.5 rounded-full text-[13px] font-black uppercase tracking-widest transition-all relative active:scale-95 shadow-sm border ${activeTab === tab ? 'bg-accent-primary/15 border-accent-primary/40 text-accent-primary shadow-[0_5px_20px_rgba(var(--color-accent-primary),0.15)]' : 'bg-white/5 backdrop-blur-sm border-white/5 text-brand-muted hover:text-brand hover:bg-white/10'}`}>
              {tab === 'dashboard' ? 'סקירה' : tab === 'campaigns' ? 'קמפיינים' : tab === 'cashouts' ? 'משיכות' : tab === 'users' ? 'משתמשים' : 'תוכן'}
              {tab === 'cashouts' && adminData.pending_cashouts.length > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 border-2 border-surface rounded-full animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.6)]" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 scrollbar-hide pb-10 relative z-10">
        <AnimatePresence mode="wait">
          
          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <motion.div key="dash" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-6">
              
              <div className="bg-white/5 backdrop-blur-xl border border-white/5 pt-10 pb-8 rounded-[40px] flex flex-col items-center text-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/10 via-transparent to-transparent opacity-60" />
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-accent-primary/20 blur-[80px] rounded-full pointer-events-none" />
                <span className="text-brand-muted text-[11px] font-black uppercase tracking-[0.2em] mb-1 z-10 drop-shadow-md flex items-center gap-1.5"><Coins size={14} className="text-accent-primary"/> כלכלת האפליקציה</span>
                <div className="flex flex-col items-center justify-center mt-2 z-10 relative">
                  <span className="text-[56px] font-black text-brand tracking-tighter leading-none drop-shadow-[0_0_20px_rgba(var(--color-accent-primary),0.3)]">{adminData.total_crd.toLocaleString()}</span>
                  <span className="text-[11px] font-black text-accent-primary uppercase tracking-[0.4em] mt-3 drop-shadow-md">סה״כ במחזור</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 backdrop-blur-lg border border-white/5 rounded-[28px] p-5 shadow-sm flex flex-col items-center text-center">
                  <span className="text-brand-muted text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-2"><Users size={14} className="text-accent-primary"/> משתמשים</span>
                  <span className="text-brand font-black text-2xl">{adminData.total_users.toLocaleString()}</span>
                </div>
                <div className="bg-white/5 backdrop-blur-lg border border-white/5 rounded-[28px] p-5 shadow-sm flex flex-col items-center text-center">
                  <span className="text-brand-muted text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-2"><MessageSquare size={14} className="text-accent-primary"/> פוסטים באוויר</span>
                  <span className="text-brand font-black text-2xl">{adminData.total_posts.toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-lg border border-white/5 rounded-[32px] p-6 shadow-sm">
                <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-6"><Activity size={14} className="text-accent-primary"/> הרשמות השבוע</span>
                <div className="flex items-end justify-between h-32 gap-2">
                  {adminData.chart_data.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-brand-muted text-[12px] font-bold">אין נתונים מספיקים</div>
                  ) : (
                    adminData.chart_data.map((data: any, i: number) => {
                      const heightPercent = Math.max((data.count / maxChartValue) * 100, 5);
                      return (
                        <div key={i} className="flex flex-col items-center gap-2 flex-1 h-full">
                          <div className="w-full bg-black/30 rounded-t-md flex flex-col justify-end h-full relative group border border-white/5 border-b-0 overflow-hidden shadow-inner">
                            <motion.div initial={{ height: 0 }} animate={{ height: `${heightPercent}%` }} className="bg-accent-primary/60 rounded-t-sm w-full transition-all group-hover:bg-accent-primary shadow-[0_0_10px_rgba(var(--color-accent-primary),0.5)]" />
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-[10px] text-white font-black whitespace-nowrap">{data.count}</span>
                          </div>
                          <span className="text-[9px] font-black text-brand-muted mt-1">{data.date}</span>
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
            <motion.div key="campaigns" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-5">
              <div className="bg-white/5 backdrop-blur-lg border border-white/5 rounded-[32px] p-6 shadow-sm flex flex-col gap-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/5 via-transparent to-transparent opacity-40 pointer-events-none" />
                <div className="flex flex-col gap-1 border-b border-surface-border pb-4 relative z-10">
                  <h2 className="text-brand font-black text-[16px] uppercase tracking-widest">שיגור קמפיין</h2>
                  <span className="text-brand-muted text-[11px] font-medium">פרסום מותגים, מבצעים ועדכונים</span>
                </div>

                <div className="flex flex-col gap-2 relative z-10">
                  <label className="text-brand-muted text-[10px] font-black uppercase tracking-widest px-2">מיקום הקמפיין</label>
                  <div className="flex flex-wrap gap-2">
                    {PLACEMENTS.map(pos => (
                      <button key={pos.id} onClick={() => { triggerFeedback('pop'); setCampPlacement(pos.id); }} className={`px-4 py-2.5 rounded-full font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 border ${campPlacement === pos.id ? 'bg-accent-primary/15 border-accent-primary/40 text-accent-primary shadow-sm' : 'bg-surface border-surface-border text-brand-muted hover:text-brand'}`}>
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 relative z-10">
                  <label className="text-brand-muted text-[10px] font-black uppercase tracking-widest px-2">עיצוב הקמפיין</label>
                  <div className="grid grid-cols-3 gap-2">
                    {STYLES.map(style => (
                      <button key={style.id} onClick={() => { triggerFeedback('pop'); setCampStyle(style.id); }} className={`h-12 rounded-2xl font-black text-[10px] text-center px-1 uppercase tracking-wider transition-all active:scale-95 border ${campStyle === style.id ? 'bg-accent-primary/15 border-accent-primary/40 text-accent-primary shadow-sm' : 'bg-surface border-surface-border text-brand-muted hover:text-brand'}`}>
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 relative z-10">
                  <label className="text-brand-muted text-[10px] font-black uppercase tracking-widest px-2">מדיה (תמונה / וידאו)</label>
                  <div onClick={() => fileInputRef.current?.click()} className={`w-full h-32 rounded-[20px] bg-black/30 backdrop-blur-inner border border-dashed flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden ${campFile ? 'border-accent-primary' : 'border-surface-border hover:border-brand-muted'}`}>
                    {campFile ? (
                      <>
                        {campFile.type.startsWith('video/') ? (
                          <video src={URL.createObjectURL(campFile)} className="w-full h-full object-cover opacity-80" />
                        ) : (
                          <img src={URL.createObjectURL(campFile)} className="w-full h-full object-cover opacity-80" />
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="text-white font-black text-[12px] bg-black/60 px-3 py-1 rounded-full border border-white/20">החלף מדיה</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-brand-muted">
                        <ImageIcon size={24} />
                        <span className="text-[11px] font-bold uppercase tracking-widest">בחר קובץ (אופציונלי)</span>
                      </div>
                    )}
                  </div>
                  {campFile && (
                    <button onClick={() => setCampFile(null)} className="text-rose-500 text-[10px] font-black uppercase tracking-widest self-end px-2 mt-1">הסר קובץ</button>
                  )}
                </div>

                <div className="flex flex-col gap-2 relative z-10">
                  <label className="text-brand-muted text-[10px] font-black uppercase tracking-widest px-2">כותרת הודעה</label>
                  <input type="text" value={campTitle} onChange={e=>setCampTitle(e.target.value)} placeholder="לדוגמה: קולקציה חדשה NIKE" className="w-full bg-black/30 backdrop-blur-inner border border-surface-border h-14 rounded-[20px] px-5 text-brand font-black outline-none focus:border-accent-primary/50 transition-all shadow-inner placeholder:text-brand-muted/50" />
                </div>

                <div className="flex flex-col gap-2 relative z-10">
                  <label className="text-brand-muted text-[10px] font-black uppercase tracking-widest px-2">תוכן הקמפיין (אופציונלי)</label>
                  <textarea value={campBody} onChange={e=>setCampBody(e.target.value)} placeholder="הזן טקסט הסבר..." className="w-full bg-black/30 backdrop-blur-inner border border-surface-border h-24 rounded-[24px] p-5 text-brand font-medium outline-none focus:border-accent-primary/50 transition-all resize-none shadow-inner placeholder:text-brand-muted/50" />
                </div>

                <div className="flex flex-col gap-3 mt-2 border-t border-surface-border pt-4 relative z-10">
                  <label className="text-brand-muted text-[10px] font-black uppercase tracking-widest px-2">סוג פעולה</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setCampActionType('reward')} className={`h-12 rounded-[16px] font-black text-[12px] uppercase tracking-widest transition-all active:scale-95 border flex items-center justify-center gap-2 ${campActionType === 'reward' ? 'bg-amber-400/15 border-amber-400/40 text-amber-400 shadow-sm' : 'bg-surface border-surface-border text-brand-muted hover:text-brand'}`}>
                      תגמול (CRD) <Coins size={14} />
                    </button>
                    <button onClick={() => setCampActionType('link')} className={`h-12 rounded-[16px] font-black text-[12px] uppercase tracking-widest transition-all active:scale-95 border flex items-center justify-center gap-2 ${campActionType === 'link' ? 'bg-blue-400/15 border-blue-400/40 text-blue-400 shadow-sm' : 'bg-surface border-surface-border text-brand-muted hover:text-brand'}`}>
                      קישור (URL) <LinkIcon size={14} />
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    {campActionType === 'reward' ? (
                      <motion.div key="reward" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="relative mt-2">
                        <Zap size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-accent-primary fill-accent-primary" />
                        <input type="number" value={campReward} onChange={e=>setCampReward(Number(e.target.value))} placeholder="סכום הבונוס ב-CRD..." dir="ltr" className="w-full bg-black/30 backdrop-blur-inner border border-surface-border h-14 rounded-[20px] pl-12 pr-5 text-brand font-black outline-none focus:border-accent-primary/50 transition-all shadow-inner text-left placeholder:text-brand-muted/50" />
                      </motion.div>
                    ) : (
                      <motion.div key="link" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="relative mt-2">
                        <input type="url" value={campLink} onChange={e=>setCampLink(e.target.value)} placeholder="https://..." dir="ltr" className="w-full bg-black/30 backdrop-blur-inner border border-surface-border h-14 rounded-[20px] px-5 text-brand font-medium outline-none focus:border-blue-400/50 transition-all shadow-inner text-left placeholder:text-brand-muted/50" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* שדה תוקף הקמפיין */}
                  <div className="flex flex-col gap-2 relative z-10 mt-2">
                    <label className="text-brand-muted text-[10px] font-black uppercase tracking-widest px-2">תוקף הקמפיין בימים (אופציונלי)</label>
                    <input type="number" value={campExpiresDays} onChange={e=>setCampExpiresDays(e.target.value === '' ? '' : Number(e.target.value))} placeholder="השאר ריק לתוקף תמידי" dir="ltr" className="w-full bg-black/30 backdrop-blur-inner border border-surface-border h-14 rounded-[20px] px-5 text-brand font-medium outline-none focus:border-accent-primary/50 transition-all shadow-inner text-left placeholder:text-brand-muted/50" />
                  </div>

                </div>

                <Button onClick={handleDeployCampaign} disabled={campDeploying || !campTitle.trim()} className="h-16 w-full mt-4 rounded-[24px] bg-accent-primary text-white font-black text-[15px] uppercase tracking-widest shadow-[0_5px_20px_rgba(var(--color-accent-primary),0.35)] active:scale-95 transition-all flex items-center justify-center gap-2 relative z-10">
                  {campDeploying ? <Loader2 size={24} className="animate-spin text-white" /> : 'שגר לאוויר'}
                </Button>
              </div>
            </motion.div>
          )}

          {/* TAB: CASHOUTS */}
          {activeTab === 'cashouts' && (
            <motion.div key="cashouts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-3">
              {adminData.pending_cashouts.length === 0 ? (
                <div className="py-20 flex flex-col items-center text-center backdrop-blur-lg opacity-60 bg-white/5 border border-white/5 rounded-[32px] shadow-lg">
                  <CheckCircle size={48} className="text-brand-muted mb-4" strokeWidth={1} />
                  <span className="text-brand font-black text-[15px]">אין בקשות משיכה כרגע</span>
                </div>
              ) : (
                adminData.pending_cashouts.map((tx: any) => (
                  <div key={tx.id} className="bg-white/5 backdrop-blur-lg border border-white/5 rounded-[32px] p-5 shadow-sm flex flex-col relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-30" />
                    <div className="flex items-center justify-between border-b border-surface-border pb-4 mb-4 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-black/20 border border-white/5 flex items-center justify-center shadow-inner">
                          {tx.avatar_url ? <img src={tx.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={28} className="text-brand-muted w-full h-full" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-brand font-black text-[14px]">{tx.full_name}</span>
                          <span className="text-brand-muted text-[10px] font-bold" dir="ltr">@{tx.username}</span>
                        </div>
                      </div>
                      <span className="text-accent-primary font-black text-2xl drop-shadow-md" dir="ltr">{Math.abs(tx.amount)} CRD</span>
                    </div>
                    <div className="flex gap-2 relative z-10">
                      <Button onClick={() => handleCashoutAction(tx.id, 'approve')} className="flex-1 h-14 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[13px] font-black tracking-widest uppercase rounded-[20px] flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-sm">
                        אושר
                      </Button>
                      <Button onClick={() => { if(window.confirm('לדחות ולהחזיר למשתמש את ה-CRD?')) handleCashoutAction(tx.id, 'reject'); }} className="flex-1 h-14 bg-rose-500/15 text-rose-500 border border-rose-500/20 text-[13px] font-black tracking-widest uppercase rounded-[20px] flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-sm">
                        דחה
                      </Button>
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
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="חיפוש משתמשים..." className="w-full bg-black/30 backdrop-blur-inner border border-surface-border text-brand font-bold h-14 rounded-[20px] pl-4 pr-12 outline-none focus:border-accent-primary/50 transition-colors shadow-inner text-[14px] placeholder:text-brand-muted/50" />
              </div>
              <div className="flex flex-col gap-2">
                {filteredUsers.map((u: any) => (
                  <div key={u.id} onClick={() => { triggerFeedback('pop'); setSelectedUser(u); }} className={`flex items-center justify-between p-3 px-4 bg-white/5 backdrop-blur-lg border ${u.is_banned ? 'border-rose-500/30 bg-rose-500/5' : 'border-white/5 hover:border-accent-primary/30 hover:bg-white/10'} rounded-[24px] cursor-pointer active:scale-[0.98] transition-all shadow-sm`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full overflow-hidden bg-black/20 border border-white/5 flex items-center justify-center shadow-inner ${u.is_banned ? 'grayscale opacity-50' : ''}`}>
                        {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={24} className="text-brand-muted" />}
                      </div>
                      <div className="flex flex-col">
                        <span className={`font-black text-[14px] flex items-center gap-1.5 ${u.is_banned ? 'text-rose-500 line-through' : 'text-brand'}`}>
                          {u.full_name} {u.role_label === 'CORE' && <ShieldAlert size={12} className="text-accent-primary drop-shadow-md" />}
                        </span>
                        <span className="text-brand-muted text-[10px]" dir="ltr">@{u.username}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-[12px] border border-white/5 shadow-inner">
                      <span className="text-accent-primary font-black text-[13px]">{u.crd_balance}</span>
                      <Zap size={14} className="text-accent-primary fill-accent-primary" />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB: CONTENT (MODERATION) */}
          {activeTab === 'content' && (
            <motion.div key="content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-4 relative z-10">
              {adminData.recent_posts.map((p: any) => (
                <div key={p.id} className="bg-white/5 backdrop-blur-lg border border-white/5 rounded-[32px] p-5 flex flex-col gap-3 shadow-sm relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/3 to-transparent opacity-30 pointer-events-none" />
                  <div className="flex items-center justify-between border-b border-surface-border pb-3 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-black/20 border border-white/5 flex items-center justify-center shadow-inner">
                        {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={20} className="text-brand-muted" />}
                      </div>
                      <span className="text-brand font-black text-[13px]">{p.full_name}</span>
                    </div>
                    <button onClick={() => handleDeletePost(p.id)} className="p-2 bg-transparent border-none text-brand-muted hover:text-rose-500 active:scale-90 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                  {p.media_url && <img src={p.media_url} className="w-full h-40 object-cover rounded-[20px] border border-white/5 shadow-inner relative z-10" />}
                  <p className="text-brand text-[13px] leading-relaxed whitespace-pre-wrap relative z-10">{p.content}</p>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* רקע גרדיאנט סטטי - קרבון ופסטל */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute bottom-[-20%] right-[-10%] w-[80%] h-[70%] bg-[#4f46e5] rounded-full mix-blend-screen opacity-20 blur-[120px]" />
        <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[60%] bg-[#1a1c24] rounded-full opacity-60" />
      </div>

      {/* USER MANAGEMENT MODAL */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <BottomSheet open={!!selectedUser} onClose={() => setSelectedUser(null)}>
          {selectedUser && (
            <div className="flex flex-col gap-6 text-center items-center pb-6">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-black/20 shrink-0 border-2 border-surface-border shadow-lg flex items-center justify-center relative">
                <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/10 to-transparent" />
                {selectedUser.avatar_url ? <img src={selectedUser.avatar_url} className="w-full h-full object-cover relative z-10" /> : <UserCircle size={40} className="text-brand-muted w-full h-full p-4 relative z-10" />}
              </div>
              <div className="flex flex-col items-center">
                <h2 className="text-brand font-black text-2xl flex items-center gap-2 drop-shadow-md">{selectedUser.full_name} {selectedUser.role_label === 'CORE' && <ShieldAlert size={20} className="text-accent-primary drop-shadow-md" />}</h2>
                <span className="text-brand-muted text-[13px] font-medium mt-1" dir="ltr">@{selectedUser.username}</span>
              </div>

              <div className="w-full bg-white/5 backdrop-blur-lg border border-white/5 rounded-[32px] p-6 flex flex-col items-center gap-2 shadow-sm">
                <span className="text-[10px] text-brand-muted font-black uppercase tracking-[0.2em]">יתרה זמינה למשתמש</span>
                <span className="text-accent-primary font-black text-4xl flex items-center gap-2 drop-shadow-[0_0_15px_rgba(var(--color-accent-primary),0.35)]">{selectedUser.crd_balance} <Zap size={24} className="fill-accent-primary" /></span>
              </div>

              <div className="w-full flex flex-col gap-3 mt-2">
                <h4 className="text-brand-muted text-[11px] font-black uppercase tracking-widest text-right px-2">פעולות הנהלה</h4>

                <div className="flex items-center gap-2 bg-black/30 backdrop-blur-inner border border-surface-border p-2 pr-4 rounded-[24px] shadow-sm">
                  <Gift size={20} className="text-accent-primary shrink-0" />
                  <input type="number" value={grantAmount} onChange={(e) => setGrantAmount(Number(e.target.value))} placeholder="הזן בונוס (CRD)" className="flex-1 bg-transparent border-none text-brand font-black outline-none h-12 px-2 placeholder:text-brand-muted/50 text-[15px]" data-no-drag="true" />
                  <Button onClick={handleGrantCrd} disabled={actionLoading || !grantAmount} className="h-12 bg-accent-primary/20 text-accent-primary border border-accent-primary/30 rounded-[18px] px-6 text-[13px] font-black shadow-sm active:scale-95 disabled:opacity-50 transition-all">שלח</Button>
                </div>

                <button onClick={() => handleToggleBan(selectedUser)} disabled={actionLoading} className={`w-full h-16 rounded-[24px] flex items-center justify-center gap-2 font-black text-[14px] tracking-widest uppercase transition-all shadow-sm active:scale-95 ${selectedUser.is_banned ? 'bg-surface-card text-brand border border-surface-border' : 'bg-rose-500/15 text-rose-500 border border-rose-500/20'}`}>
                  <Ban size={18} /> {selectedUser.is_banned ? 'שחרר חסימה למשתמש' : 'חסום משתמש מהאפליקציה'}
                </button>
              </div>
            </div>
          )}
        </BottomSheet>, document.body
      )}
    </FadeIn>
  );
};
