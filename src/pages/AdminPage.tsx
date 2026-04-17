import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, CheckCircle, XCircle, Loader2, Users, ArrowLeft, DollarSign, Activity, Wallet, Search } from 'lucide-react';
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
    total_users: 0,
    total_crd: 0,
    pending_cashouts: [] as any[],
    recent_users: [] as any[]
  });

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (profile && profile.role_label !== 'CORE') {
      navigate('/');
      return;
    }
    if (profile?.role_label === 'CORE') {
      fetchAdminData();
    }
  }, [profile]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_admin_data');
      if (error) throw error;
      setAdminData(data as any);
    } catch (err) {
      toast.error('שגיאה בטעינת נתוני אדמין');
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
      
      toast.success(action === 'approve' ? 'בקשת המשיכה אושרה!' : 'הבקשה נדחתה והכסף הוחזר.', { id: tid });
      triggerFeedback('success');
      await fetchAdminData();
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בעדכון הבקשה', { id: tid });
    }
  };

  const filteredUsers = adminData.recent_users.filter(u => 
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="min-h-screen bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" size={32} /></div>;

  return (
    <FadeIn className="bg-[#030303] min-h-[100dvh] font-sans flex flex-col relative overflow-hidden pb-24" dir="rtl">
      
      {/* HEADER */}
      <div className="relative z-50 pt-[calc(env(safe-area-inset-top)+16px)] px-6 flex items-center justify-between pb-4">
        <button onClick={() => { triggerFeedback('pop'); navigate(-1); }} className="w-10 h-10 bg-surface-card border border-surface-border rounded-full flex items-center justify-center text-brand active:scale-95 transition-all">
          <ArrowLeft size={20} className="rtl:-scale-x-100" />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-xl font-black text-white tracking-widest uppercase flex items-center gap-2">
            פאנל ניהול <ShieldCheck size={20} className="text-indigo-400" />
          </h1>
        </div>
        <div className="w-10" />
      </div>

      {/* TABS */}
      <div className="px-4 mb-6 relative z-10">
        <div className="flex bg-surface-card p-1.5 rounded-full border border-surface-border shadow-inner">
          <button onClick={() => { triggerFeedback('pop'); setActiveTab('dashboard'); }} className={`flex-1 py-2 rounded-full text-[12px] font-black uppercase tracking-widest transition-all ${activeTab === 'dashboard' ? 'bg-indigo-500/20 text-indigo-400' : 'text-brand-muted'}`}>דשבורד</button>
          <button onClick={() => { triggerFeedback('pop'); setActiveTab('cashouts'); }} className={`flex-1 py-2 rounded-full text-[12px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'cashouts' ? 'bg-emerald-500/20 text-emerald-400' : 'text-brand-muted'}`}>
            משיכות
            {adminData.pending_cashouts.length > 0 && <span className="absolute top-1 right-2 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
          </button>
          <button onClick={() => { triggerFeedback('pop'); setActiveTab('users'); }} className={`flex-1 py-2 rounded-full text-[12px] font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-amber-500/20 text-amber-400' : 'text-brand-muted'}`}>משתמשים</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 scrollbar-hide pb-10">
        <AnimatePresence mode="wait">
          
          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <motion.div key="dash" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-4">
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-[32px] p-6 shadow-sm">
                <span className="text-indigo-400 text-[11px] font-black uppercase tracking-widest flex items-center gap-2 mb-2"><Users size={14} /> משתמשים רשומים</span>
                <span className="text-white font-black text-4xl">{adminData.total_users.toLocaleString()}</span>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-[32px] p-6 shadow-sm">
                <span className="text-amber-400 text-[11px] font-black uppercase tracking-widest flex items-center gap-2 mb-2"><DollarSign size={14} /> CRD במערכת (מחזור)</span>
                <span className="text-white font-black text-4xl">{adminData.total_crd.toLocaleString()}</span>
                <p className="text-amber-400/60 text-[10px] mt-2 font-bold leading-relaxed">סך המטבעות שקיימים כרגע בארנקים של כל המשתמשים באפליקציה.</p>
              </div>
            </motion.div>
          )}

          {/* TAB: CASHOUTS */}
          {activeTab === 'cashouts' && (
            <motion.div key="cashouts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-3">
              {adminData.pending_cashouts.length === 0 ? (
                <div className="py-20 flex flex-col items-center text-center opacity-50 bg-surface-card border border-surface-border rounded-[32px]">
                  <Wallet size={48} className="text-brand-muted mb-4" strokeWidth={1} />
                  <span className="text-brand font-black text-[15px]">אין בקשות משיכה</span>
                  <span className="text-brand-muted text-[12px] mt-1">הכל נקי ומסודר.</span>
                </div>
              ) : (
                adminData.pending_cashouts.map((tx: any) => (
                  <div key={tx.id} className="bg-surface-card border border-surface-border rounded-[28px] p-5 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between border-b border-surface-border pb-4 mb-4">
                      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/profile/${tx.user_id}`)}>
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-surface">
                          {tx.avatar_url ? <img src={tx.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-surface-border" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-brand font-black text-[15px]">{tx.full_name}</span>
                          <span className="text-brand-muted text-[11px] font-bold" dir="ltr">@{tx.username}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] uppercase font-black text-brand-muted tracking-widest">סכום למשיכה</span>
                        <span className="text-emerald-400 font-black text-xl" dir="ltr">{Math.abs(tx.amount)} CRD</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleCashoutAction(tx.id, 'approve')} className="flex-1 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[12px] rounded-xl flex items-center justify-center gap-1 active:scale-95">
                        <CheckCircle size={16} /> בוצע תשלום (אשר)
                      </Button>
                      <Button onClick={() => { if(window.confirm('לדחות ולהחזיר למשתמש את ה-CRD?')) handleCashoutAction(tx.id, 'reject'); }} className="flex-1 h-12 bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[12px] rounded-xl flex items-center justify-center gap-1 active:scale-95">
                        <XCircle size={16} /> דחה משיכה
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
                  placeholder="חיפוש משתמשים..." 
                  className="w-full bg-surface-card border border-surface-border text-brand font-medium h-12 rounded-full pl-4 pr-12 outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-2">
                {filteredUsers.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-3 px-4 bg-surface-card border border-surface-border rounded-[20px] cursor-pointer active:scale-[0.98] transition-transform" onClick={() => navigate(`/profile/${u.id}`)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-surface">
                        {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-surface-border" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-brand font-black text-[13px] flex items-center gap-1.5">{u.full_name} {u.role_label === 'CORE' && <ShieldCheck size={12} className="text-indigo-400" />}</span>
                        <span className="text-brand-muted text-[10px]" dir="ltr">@{u.username}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                      <span className="text-amber-400 font-black text-[12px]">{u.crd_balance}</span>
                      <DollarSign size={12} className="text-amber-400" />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
          
        </AnimatePresence>
      </div>
    </FadeIn>
  );
};
