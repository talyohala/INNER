import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, CheckCircle, XCircle, Loader2, Users, DollarSign, 
  Search, BarChart3, Gift, Ban, MessageSquare, PlusCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cashouts' | 'users'>('dashboard');
  
  const [adminData, setAdminData] = useState({
    total_users: 0, total_crd: 0, total_posts: 0, total_circles: 0,
    pending_cashouts: [] as any[], recent_users: [] as any[]
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
    } catch (err: any) {
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
      toast.success(action === 'approve' ? 'הבקשה אושרה!' : 'הבקשה נדחתה והכסף הוחזר.', { id: tid });
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
    } catch (err: any) {
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
    } catch (err: any) {
      toast.error('שגיאה בעדכון חסימה');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredUsers = adminData.recent_users.filter(u => 
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="min-h-screen bg-[#030303] flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>;

  return (
    <FadeIn className="bg-[#030303] min-h-[100dvh] font-sans flex flex-col relative overflow-hidden pb-24" dir="rtl">
      
      {/* HEADER (No Back Button) */}
      <div className="pt-[calc(env(safe-area-inset-top)+20px)] px-6 pb-6 flex justify-between items-end relative z-10">
        <div className="flex flex-col">
          <span className="text-indigo-400 text-[11px] font-black tracking-[0.2em] uppercase mb-1">מערכת הליבה</span>
          <h1 className="text-3xl font-black text-white tracking-widest flex items-center gap-2">INNER <ShieldCheck size={28} className="text-indigo-500" /></h1>
        </div>
        <div className="w-12 h-12 bg-surface-card border border-surface-border rounded-full flex items-center justify-center shadow-inner overflow-hidden">
          {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <ShieldCheck className="text-brand-muted" />}
        </div>
      </div>

      {/* TABS */}
      <div className="px-4 mb-6 relative z-10">
        <div className="flex bg-surface-card p-1.5 rounded-2xl border border-surface-border shadow-inner">
          <button onClick={() => { triggerFeedback('pop'); setActiveTab('dashboard'); }} className={`flex-1 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all ${activeTab === 'dashboard' ? 'bg-indigo-500 text-white shadow-lg' : 'text-brand-muted hover:text-brand'}`}>סקירה</button>
          <button onClick={() => { triggerFeedback('pop'); setActiveTab('cashouts'); }} className={`flex-1 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'cashouts' ? 'bg-indigo-500 text-white shadow-lg' : 'text-brand-muted hover:text-brand'}`}>
            משיכות {adminData.pending_cashouts.length > 0 && <span className="absolute top-1 right-2 w-2.5 h-2.5 bg-emerald-400 border border-surface rounded-full animate-pulse" />}
          </button>
          <button onClick={() => { triggerFeedback('pop'); setActiveTab('users'); }} className={`flex-1 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-indigo-500 text-white shadow-lg' : 'text-brand-muted hover:text-brand'}`}>משתמשים</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 scrollbar-hide pb-10">
        <AnimatePresence mode="wait">
          
          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <motion.div key="dash" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-2 gap-4">
              <div className="col-span-2 bg-gradient-to-br from-indigo-500/20 to-surface-card border border-indigo-500/30 rounded-[32px] p-6 shadow-lg relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 blur-[40px] rounded-full pointer-events-none" />
                <span className="text-indigo-300 text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-2"><DollarSign size={14} /> סך הכל כלכלה בתוך האפליקציה</span>
                <span className="text-white font-black text-5xl tracking-tight">{adminData.total_crd.toLocaleString()}</span>
              </div>
              
              <div className="bg-surface-card border border-surface-border rounded-[28px] p-5 shadow-sm">
                <span className="text-brand-muted text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-1"><Users size={12} /> משתמשים</span>
                <span className="text-brand font-black text-2xl">{adminData.total_users.toLocaleString()}</span>
              </div>
              
              <div className="bg-surface-card border border-surface-border rounded-[28px] p-5 shadow-sm">
                <span className="text-brand-muted text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-1"><MessageSquare size={12} /> פוסטים באוויר</span>
                <span className="text-brand font-black text-2xl">{adminData.total_posts.toLocaleString()}</span>
              </div>

              <div className="col-span-2 bg-surface-card border border-surface-border rounded-[28px] p-5 shadow-sm flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">מועדונים וקהילות פעילות</span>
                  <span className="text-brand font-black text-2xl">{adminData.total_circles.toLocaleString()}</span>
                </div>
                <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                  <PlusCircle size={20} className="text-emerald-400" />
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
                      <span className="text-emerald-400 font-black text-xl" dir="ltr">{Math.abs(tx.amount)} CRD</span>
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
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="חיפוש משתמשים לניהול..." 
                  className="w-full bg-surface-card border border-surface-border text-brand font-black h-14 rounded-full pl-4 pr-12 outline-none focus:border-indigo-500/50 transition-colors shadow-inner text-[14px]"
                />
              </div>
              <div className="flex flex-col gap-2">
                {filteredUsers.map((u: any) => (
                  <div key={u.id} onClick={() => { triggerFeedback('pop'); setSelectedUser(u); }} className={`flex items-center justify-between p-3 px-4 bg-surface-card border ${u.is_banned ? 'border-rose-500/30 bg-rose-500/5' : 'border-surface-border'} rounded-[24px] cursor-pointer active:scale-[0.98] transition-transform`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full overflow-hidden bg-surface ${u.is_banned ? 'grayscale opacity-50' : ''}`}>
                        {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-surface-border" />}
                      </div>
                      <div className="flex flex-col">
                        <span className={`font-black text-[14px] flex items-center gap-1.5 ${u.is_banned ? 'text-rose-500 line-through' : 'text-brand'}`}>
                          {u.full_name} {u.role_label === 'CORE' && <ShieldCheck size={12} className="text-indigo-400" />}
                        </span>
                        <span className="text-brand-muted text-[10px]" dir="ltr">@{u.username}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-xl border border-white/5">
                      <span className="text-amber-400 font-black text-[13px]">{u.crd_balance}</span>
                      <DollarSign size={14} className="text-amber-400" />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
          
        </AnimatePresence>
      </div>

      {/* USER MANAGEMENT MODAL */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedUser && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedUser(null)} />
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 400 }} className="relative z-10 bg-surface rounded-t-[40px] p-6 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border flex flex-col">
                <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />
                
                <div className="flex items-center gap-4 mb-8 bg-surface-card border border-surface-border p-4 rounded-3xl">
                   <div className="w-16 h-16 rounded-full overflow-hidden bg-surface shrink-0">
                      {selectedUser.avatar_url ? <img src={selectedUser.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-surface-border" />}
                   </div>
                   <div className="flex flex-col flex-1">
                      <span className="text-brand font-black text-lg">{selectedUser.full_name}</span>
                      <span className="text-brand-muted text-[12px]">@{selectedUser.username}</span>
                   </div>
                   <div className="flex flex-col items-end">
                      <span className="text-[10px] text-brand-muted font-black uppercase tracking-widest mb-0.5">יתרה נוכחית</span>
                      <span className="text-amber-400 font-black text-lg">{selectedUser.crd_balance} CRD</span>
                   </div>
                </div>

                <div className="flex flex-col gap-3 mb-6">
                   <h4 className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-2">פעולות הנהלה</h4>
                   
                   {/* הענקת CRD */}
                   <div className="flex items-center gap-2 bg-surface-card border border-surface-border p-2 pr-4 rounded-2xl">
                      <Gift size={20} className="text-emerald-400 shrink-0" />
                      <input 
                        type="number" value={grantAmount} onChange={(e) => setGrantAmount(Number(e.target.value))} 
                        placeholder="סכום להעברה..." 
                        className="flex-1 bg-transparent border-none text-brand font-black outline-none h-10 px-2"
                      />
                      <Button onClick={handleGrantCrd} disabled={actionLoading || !grantAmount} className="h-10 bg-emerald-500 text-white rounded-xl px-4 text-[12px] font-black shadow-md active:scale-95 disabled:opacity-50">שלח בונוס</Button>
                   </div>

                   {/* חסימה */}
                   <button onClick={() => handleToggleBan(selectedUser)} disabled={actionLoading} className={`w-full h-14 rounded-2xl flex items-center justify-center gap-2 font-black text-[13px] tracking-widest uppercase transition-all shadow-sm active:scale-95 ${selectedUser.is_banned ? 'bg-surface-card text-brand border border-surface-border' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
                      <Ban size={18} /> {selectedUser.is_banned ? 'שחרר חסימה למשתמש' : 'חסום משתמש מהאפליקציה'}
                   </button>
                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>, document.body
      )}

    </FadeIn>
  );
};
