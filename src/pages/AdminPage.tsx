import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { 
  ShieldCheck, CheckCircle, XCircle, Loader2, Users, DollarSign, 
  Search, Gift, Ban, MessageSquare, PlusCircle, Trash2, Activity,
  UserCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

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
    if (target.closest('input, button, a, [data-no-drag="true"]')) return;                                                                                          
    dragControls.start(e);                                 
  };                                                                                                                
  
  return (                                                   
    <AnimatePresence>                                          
      {open && (                                                 
        <div className="fixed inset-0 z-[9900] flex flex-col justify-end" dir="rtl">                                        
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />                                                                                                                
          <motion.div                                                
            drag="y" dragControls={dragControls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.1} dragMomentum={false}                                     
            onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 450) onClose(); }}                                                       
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 520 }}                                           
            className="bg-surface rounded-t-[40px] h-auto min-h-[50vh] max-h-[85vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden border-t border-surface-border"                                                                
          >                                                          
            <div className="w-full py-5 flex justify-center shrink-0 cursor-grab active:cursor-grabbing border-b border-surface-border" onPointerDown={startSheetDrag} style={{ touchAction: 'none' }}>                                                          
              <div className="w-16 h-1.5 bg-white/10 rounded-full pointer-events-none" />                                     
            </div>                                                                                                            
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6" onPointerDown={startSheetDrag}>                                                          
              {children}                                             
            </div>                                                 
          </motion.div>                                          
        </div>                                                 
      )}                                                     
    </AnimatePresence>                                     
  );                                                     
};

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cashouts' | 'users' | 'content'>('dashboard');
  
  const [adminData, setAdminData] = useState({
    total_users: 0, total_crd: 0, total_posts: 0, total_circles: 0,
    pending_cashouts: [] as any[], recent_users: [] as any[], recent_posts: [] as any[], chart_data: [] as any[]
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [grantAmount, setGrantAmount] = useState<number | ''>('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (profile && profile.role_label !== 'CORE') { navigate('/'); return; }
    if (profile?.role_label === 'CORE') fetchAdminData();
  }, [profile]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_admin_data');
      if (error) throw error;
      setAdminData(data as any);
    } catch (err) {
      toast.error('שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  };

  const handleCashoutAction = async (txId: string, action: 'approve' | 'reject') => {
    triggerFeedback('pop');
    const tid = toast.loading('מעדכן בקשה...');
    try {
      const { error } = await supabase.rpc('admin_resolve_cashout', { p_tx_id: txId, p_action: action });
      if (error) throw error;
      toast.success(action === 'approve' ? 'הבקשה אושרה והכסף ירד!' : 'הבקשה נדחתה והכסף הוחזר.', { id: tid });
      triggerFeedback('success');
      await fetchAdminData();
    } catch (err: any) {
      toast.error(err.message || 'שגיאה', { id: tid });
    }
  };

  const handleGrantCrd = async () => {
    if (!selectedUser || !grantAmount) return;
    setActionLoading(true);
    triggerFeedback('pop');
    try {
      const { error } = await supabase.rpc('admin_grant_crd', { p_user_id: selectedUser.id, p_amount: Number(grantAmount) });
      if (error) throw error;
      toast.success(`הועברו ${grantAmount} CRD בהצלחה!`);
      triggerFeedback('coin');
      setGrantAmount('');
      setSelectedUser(null);
      await fetchAdminData();
    } catch (err) {
      toast.error('שגיאה בהעברת CRD');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleBan = async (user: any) => {
    const newStatus = !user.is_banned;
    if (!window.confirm(newStatus ? 'לחסום משתמש זה?' : 'לשחרר חסימה למשתמש זה?')) return;
    setActionLoading(true);
    triggerFeedback('pop');
    try {
      const { error } = await supabase.rpc('admin_toggle_ban', { p_user_id: user.id, p_ban_status: newStatus });
      if (error) throw error;
      toast.success(newStatus ? 'המשתמש נחסם' : 'החסימה שוחררה');
      setSelectedUser(null);
      await fetchAdminData();
    } catch (err) {
      toast.error('שגיאה בעדכון חסימה');
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
      toast.success('הפוסט הוסר בהצלחה');
      await fetchAdminData();
    } catch (err) {
      toast.error('שגיאה במחיקת פוסט');
    }
  };

  const filteredUsers = adminData.recent_users.filter(u => 
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const maxChartValue = Math.max(...adminData.chart_data.map((d: any) => d.count), 1);

  if (loading) return <div className="min-h-screen bg-[#030303] flex items-center justify-center"><Loader2 className="animate-spin text-blue-400" size={32} /></div>;

  return (
    <FadeIn className="bg-[#030303] min-h-[100dvh] font-sans flex flex-col relative overflow-hidden pb-24" dir="rtl">
      
      {/* HEADER (Centered, No Icon) */}
      <div className="pt-[calc(env(safe-area-inset-top)+32px)] px-6 pb-8 flex flex-col items-center justify-center relative z-10 text-center">
        <span className="text-blue-400 text-[10px] font-black tracking-[0.25em] uppercase mb-2 drop-shadow-md">מערכת הליבה</span>
        <h1 className="text-3xl font-black text-white tracking-widest drop-shadow-lg">פאנל ניהול</h1>
      </div>

      {/* TABS (Styled exactly like the image top horizontal scroll) */}
      <div className="px-4 mb-6 relative z-10 overflow-x-auto scrollbar-hide">
        <div className="flex items-center justify-center gap-2 min-w-max pb-1">
          <button onClick={() => { triggerFeedback('pop'); setActiveTab('dashboard'); }} className={`px-5 py-2.5 rounded-full text-[13px] font-medium transition-all ${activeTab === 'dashboard' ? 'bg-surface-card border border-blue-400/30 text-blue-400' : 'bg-surface-card border border-surface-border text-brand-muted hover:text-brand'}`}>סקירה</button>
          <button onClick={() => { triggerFeedback('pop'); setActiveTab('cashouts'); }} className={`px-5 py-2.5 rounded-full text-[13px] font-medium transition-all relative ${activeTab === 'cashouts' ? 'bg-surface-card border border-blue-400/30 text-blue-400' : 'bg-surface-card border border-surface-border text-brand-muted hover:text-brand'}`}>
            משיכות {adminData.pending_cashouts.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 border border-surface rounded-full animate-pulse" />}
          </button>
          <button onClick={() => { triggerFeedback('pop'); setActiveTab('users'); }} className={`px-5 py-2.5 rounded-full text-[13px] font-medium transition-all ${activeTab === 'users' ? 'bg-surface-card border border-blue-400/30 text-blue-400' : 'bg-surface-card border border-surface-border text-brand-muted hover:text-brand'}`}>משתמשים</button>
          <button onClick={() => { triggerFeedback('pop'); setActiveTab('content'); }} className={`px-5 py-2.5 rounded-full text-[13px] font-medium transition-all ${activeTab === 'content' ? 'bg-surface-card border border-blue-400/30 text-blue-400' : 'bg-surface-card border border-surface-border text-brand-muted hover:text-brand'}`}>תוכן</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 scrollbar-hide pb-10">
        <AnimatePresence mode="wait">
          
          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <motion.div key="dash" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-6">
              
              {/* Premium Total Economy Card */}
              <div className="bg-surface-card border border-surface-border pt-10 pb-8 rounded-[40px] flex flex-col items-center text-center shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400/5 via-transparent to-transparent opacity-60" />
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-400/10 blur-[60px] rounded-full pointer-events-none" />
                <span className="text-brand-muted text-[11px] font-black uppercase tracking-[0.2em] mb-1 z-10 drop-shadow-md flex items-center gap-1.5"><DollarSign size={14}/> כלכלת CRD באפליקציה</span>
                
                <div className="flex flex-col items-center justify-center mt-2 z-10 relative">                                 
                  <span className="text-[56px] font-black text-brand tracking-tighter leading-none drop-shadow-lg">{adminData.total_crd.toLocaleString()}</span>                                                  
                  <span className="text-[11px] font-black text-blue-400 uppercase tracking-[0.4em] mt-3 drop-shadow-md">TOTAL CIRCULATION</span>                                                
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-card border border-surface-border rounded-[28px] p-5 shadow-sm flex flex-col items-center text-center">
                  <span className="text-brand-muted text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-2"><Users size={14} className="text-blue-400"/> משתמשים</span>
                  <span className="text-brand font-black text-2xl">{adminData.total_users.toLocaleString()}</span>
                </div>
                <div className="bg-surface-card border border-surface-border rounded-[28px] p-5 shadow-sm flex flex-col items-center text-center">
                  <span className="text-brand-muted text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-2"><MessageSquare size={14} className="text-blue-400"/> פוסטים באוויר</span>
                  <span className="text-brand font-black text-2xl">{adminData.total_posts.toLocaleString()}</span>
                </div>
              </div>

              {/* GRAPH SECTION */}
              <div className="bg-surface-card border border-surface-border rounded-[32px] p-6 shadow-sm">
                <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-6"><Activity size={14} className="text-blue-400"/> הרשמות השבוע</span>
                <div className="flex items-end justify-between h-32 gap-2">
                  {adminData.chart_data.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-brand-muted text-[12px] font-bold">אין נתונים מספיקים</div>
                  ) : (
                    adminData.chart_data.map((data: any, i: number) => {
                      const heightPercent = Math.max((data.count / maxChartValue) * 100, 5);
                      return (
                        <div key={i} className="flex flex-col items-center gap-2 flex-1">
                          <div className="w-full bg-surface rounded-t-md flex flex-col justify-end h-full relative group">
                            <motion.div initial={{ height: 0 }} animate={{ height: `${heightPercent}%` }} className="bg-blue-400/80 rounded-t-md w-full transition-opacity group-hover:bg-blue-400" />
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-[10px] text-white font-black">{data.count}</span>
                          </div>
                          <span className="text-[9px] font-black text-brand-muted">{data.date}</span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB: CASHOUTS */}
          {activeTab === 'cashouts' && (
            <motion.div key="cashouts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-3">
              {adminData.pending_cashouts.length === 0 ? (
                <div className="py-20 flex flex-col items-center text-center opacity-50 bg-surface-card border border-surface-border rounded-[32px]">
                  <CheckCircle size={48} className="text-brand-muted mb-4" strokeWidth={1} />
                  <span className="text-brand font-black text-[15px]">אין בקשות משיכה כרגע</span>
                </div>
              ) : (
                adminData.pending_cashouts.map((tx: any) => (
                  <div key={tx.id} className="bg-surface-card border border-surface-border rounded-[28px] p-5 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between border-b border-surface-border pb-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-surface border border-surface-border">
                          {tx.avatar_url ? <img src={tx.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="text-brand-muted w-full h-full" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-brand font-black text-[14px]">{tx.full_name}</span>
                          <span className="text-brand-muted text-[10px] font-bold" dir="ltr">@{tx.username}</span>
                        </div>
                      </div>
                      <span className="text-blue-400 font-black text-xl" dir="ltr">{Math.abs(tx.amount)} CRD</span>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleCashoutAction(tx.id, 'approve')} className="flex-1 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[12px] rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-transform">
                        <CheckCircle size={16} /> העברתי כסף
                      </Button>
                      <Button onClick={() => { if(window.confirm('לדחות ולהחזיר למשתמש את ה-CRD?')) handleCashoutAction(tx.id, 'reject'); }} className="flex-1 h-12 bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[12px] rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-transform">
                        <XCircle size={16} /> דחה בקשה
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {/* TAB: USERS */}
          {activeTab === 'users' && (
            <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-4">
              <div className="relative">
                <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-muted" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="חיפוש משתמשים..." className="w-full bg-surface-card border border-surface-border text-brand font-medium h-14 rounded-full pl-4 pr-12 outline-none focus:border-blue-400/50 transition-colors shadow-inner text-[14px]" />
              </div>
              <div className="flex flex-col gap-2">
                {filteredUsers.map((u: any) => (
                  <div key={u.id} onClick={() => { triggerFeedback('pop'); setSelectedUser(u); }} className={`flex items-center justify-between p-3 px-4 bg-surface-card border ${u.is_banned ? 'border-rose-500/30 bg-rose-500/5' : 'border-surface-border'} rounded-[24px] cursor-pointer active:scale-[0.98] transition-transform`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full overflow-hidden bg-surface border border-surface-border flex items-center justify-center ${u.is_banned ? 'grayscale opacity-50' : ''}`}>
                        {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={24} className="text-brand-muted" />}
                      </div>
                      <div className="flex flex-col">
                        <span className={`font-black text-[14px] flex items-center gap-1.5 ${u.is_banned ? 'text-rose-500 line-through' : 'text-brand'}`}>
                          {u.full_name} {u.role_label === 'CORE' && <ShieldCheck size={12} className="text-blue-400" />}
                        </span>
                        <span className="text-brand-muted text-[10px]" dir="ltr">@{u.username}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-surface px-3 py-1.5 rounded-xl border border-surface-border">
                      <span className="text-blue-400 font-black text-[13px]">{u.crd_balance}</span>
                      <DollarSign size={14} className="text-blue-400" />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB: CONTENT (MODERATION) */}
          {activeTab === 'content' && (
            <motion.div key="content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-4">
              {adminData.recent_posts.map((p: any) => (
                <div key={p.id} className="bg-surface-card border border-surface-border rounded-[24px] p-4 flex flex-col gap-3 shadow-sm">
                  <div className="flex items-center justify-between border-b border-surface-border pb-3">
                     <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-surface border border-surface-border flex items-center justify-center">
                           {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={16} className="text-brand-muted" />}
                        </div>
                        <span className="text-brand font-black text-[12px]">{p.full_name}</span>
                     </div>
                     <button onClick={() => handleDeletePost(p.id)} className="w-8 h-8 flex items-center justify-center bg-rose-500/10 text-rose-500 rounded-full border border-rose-500/20 active:scale-90">
                        <Trash2 size={14} />
                     </button>
                  </div>
                  {p.media_url && <img src={p.media_url} className="w-full h-32 object-cover rounded-xl" />}
                  <p className="text-brand text-[13px] leading-relaxed whitespace-pre-wrap">{p.content}</p>
                </div>
              ))}
            </motion.div>
          )}
          
        </AnimatePresence>
      </div>

      {/* USER MANAGEMENT MODAL (Wallet BottomSheet Style) */}
      {typeof document !== 'undefined' && createPortal(
        <BottomSheet open={!!selectedUser} onClose={() => setSelectedUser(null)}>
          {selectedUser && (
            <div className="flex flex-col gap-6 text-center items-center">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-surface shrink-0 border border-surface-border shadow-md flex items-center justify-center">
                {selectedUser.avatar_url ? <img src={selectedUser.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={32} className="text-brand-muted" />}
              </div>
              <div className="flex flex-col items-center">
                <h2 className="text-brand font-black text-2xl flex items-center gap-2">{selectedUser.full_name} {selectedUser.role_label === 'CORE' && <ShieldCheck size={18} className="text-blue-400" />}</h2>
                <span className="text-brand-muted text-[13px] font-medium mt-1" dir="ltr">@{selectedUser.username}</span>
              </div>
              
              <div className="w-full bg-surface-card border border-surface-border rounded-[24px] p-5 flex flex-col items-center gap-1 shadow-sm">
                <span className="text-[10px] text-brand-muted font-black uppercase tracking-[0.2em]">יתרה זמינה למשתמש</span>
                <span className="text-blue-400 font-black text-3xl flex items-center gap-2">{selectedUser.crd_balance} <DollarSign size={20} /></span>
              </div>

              <div className="w-full flex flex-col gap-3 mt-2">
                <h4 className="text-brand-muted text-[11px] font-black uppercase tracking-widest text-right px-2">פעולות הנהלה</h4>
                
                <div className="flex items-center gap-2 bg-surface-card border border-surface-border p-2 pr-4 rounded-2xl">
                  <Gift size={20} className="text-blue-400 shrink-0" />
                  <input type="number" value={grantAmount} onChange={(e) => setGrantAmount(Number(e.target.value))} placeholder="הזן בונוס (CRD)" className="flex-1 bg-transparent border-none text-brand font-black outline-none h-10 px-2" data-no-drag="true" />
                  <Button onClick={handleGrantCrd} disabled={actionLoading || !grantAmount} className="h-10 bg-blue-400/20 text-blue-400 rounded-xl px-4 text-[12px] font-black shadow-sm active:scale-95 disabled:opacity-50">שלח בונוס</Button>
                </div>

                <button onClick={() => handleToggleBan(selectedUser)} disabled={actionLoading} className={`w-full h-14 rounded-2xl flex items-center justify-center gap-2 font-black text-[13px] tracking-widest uppercase transition-all shadow-sm active:scale-95 ${selectedUser.is_banned ? 'bg-surface-card text-brand border border-surface-border' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
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
