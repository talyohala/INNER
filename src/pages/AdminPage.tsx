import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, CheckCircle, XCircle, Loader2, Users, ArrowLeft, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [pendingCashouts, setPendingCashouts] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalPendingCrd: 0 });

  useEffect(() => {
    // חסימת גישה למי שאינו אדמין
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
      // משיכת בקשות ממתינות
      const { data: txs, error: txError } = await supabase
        .from('transactions')
        .select('*, profiles(full_name, username, avatar_url)')
        .eq('type', 'withdrawal_pending')
        .order('created_at', { ascending: false });

      if (txError) throw txError;

      // ספירת משתמשים
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const pending = txs || [];
      const totalPendingCrd = pending.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

      setPendingCashouts(pending);
      setStats({ totalUsers: usersCount || 0, totalPendingCrd });
    } catch (err) {
      toast.error('שגיאה בטעינת נתוני אדמין');
    } finally {
      setLoading(false);
    }
  };

  const handleCashoutAction = async (tx: any, action: 'approve' | 'reject') => {
    triggerFeedback('pop');
    const tid = toast.loading('מעדכן בקשה...');
    try {
      if (action === 'approve') {
        // אישור: פשוט משנים את הסטטוס (הכסף כבר ירד למשתמש בבקשה)
        await supabase.from('transactions').update({ type: 'withdrawal_completed', description: 'משיכה אושרה ובוצעה' }).eq('id', tx.id);
        toast.success('בקשת המשיכה אושרה בהצלחה!', { id: tid });
      } else {
        // דחייה: מחזירים את ה-CRD למשתמש ומשנים סטטוס
        const { data: userProfile } = await supabase.from('profiles').select('crd_balance').eq('id', tx.user_id).single();
        const amountToRefund = Math.abs(tx.amount);
        await supabase.from('profiles').update({ crd_balance: (userProfile?.crd_balance || 0) + amountToRefund }).eq('id', tx.user_id);
        await supabase.from('transactions').update({ type: 'withdrawal_rejected', description: 'משיכה נדחתה (הכסף הוחזר)' }).eq('id', tx.id);
        toast.success('הבקשה נדחתה והכסף הוחזר למשתמש', { id: tid });
      }
      
      triggerFeedback('success');
      await fetchAdminData();
    } catch (err) {
      toast.error('שגיאה בעדכון הבקשה', { id: tid });
    }
  };

  if (loading) return <div className="min-h-screen bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" size={32} /></div>;

  return (
    <FadeIn className="bg-[#030303] min-h-[100dvh] font-sans flex flex-col relative overflow-hidden pb-24" dir="rtl">
      
      {/* HEADER */}
      <div className="relative z-50 pt-[calc(env(safe-area-inset-top)+16px)] px-6 flex items-center justify-between pb-6">
        <button onClick={() => { triggerFeedback('pop'); navigate(-1); }} className="w-10 h-10 bg-surface-card border border-surface-border rounded-full flex items-center justify-center text-brand active:scale-95 transition-all">
          <ArrowLeft size={20} className="rtl:-scale-x-100" />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-xl font-black text-white tracking-widest uppercase flex items-center gap-2">
            מרכז בקרה <ShieldCheck size={20} className="text-indigo-400" />
          </h1>
        </div>
        <div className="w-10" />
      </div>

      <div className="px-4 flex flex-col gap-6">
        
        {/* STATS */}
        <div className="flex gap-3">
          <div className="flex-1 bg-surface-card border border-surface-border rounded-[28px] p-5 shadow-sm flex flex-col">
            <span className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">סך משתמשים</span>
            <span className="text-brand font-black text-2xl flex items-center gap-2">{stats.totalUsers} <Users size={16} className="text-indigo-400" /></span>
          </div>
          <div className="flex-1 bg-surface-card border border-surface-border rounded-[28px] p-5 shadow-sm flex flex-col">
            <span className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">ממתין למשיכה</span>
            <span className="text-amber-400 font-black text-2xl flex items-center gap-2">{stats.totalPendingCrd} <DollarSign size={16} /></span>
          </div>
        </div>

        {/* CASHOUT REQUESTS */}
        <div className="flex flex-col gap-3">
          <h3 className="text-brand-muted text-[11px] font-black uppercase tracking-[0.2em] px-2">בקשות משיכה ממתינות</h3>
          <div className="bg-surface-card border border-surface-border rounded-[32px] overflow-hidden shadow-sm">
            {pendingCashouts.length === 0 ? (
              <div className="p-10 flex flex-col items-center text-center opacity-50">
                <ShieldCheck size={40} className="text-brand-muted mb-3" strokeWidth={1} />
                <span className="text-brand-muted font-bold text-[13px]">אין בקשות ממתינות</span>
              </div>
            ) : (
              pendingCashouts.map((tx, idx) => (
                <div key={tx.id} className={`flex flex-col p-4 px-5 ${idx !== pendingCashouts.length - 1 ? 'border-b border-surface-border' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-surface overflow-hidden border border-surface-border">
                        {tx.profiles?.avatar_url ? <img src={tx.profiles.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-surface-border" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-brand font-black text-[14px]">{tx.profiles?.full_name}</span>
                        <span className="text-brand-muted text-[10px] font-bold tracking-widest" dir="ltr">@{tx.profiles?.username}</span>
                      </div>
                    </div>
                    <span className="text-amber-400 font-black text-[18px]" dir="ltr">{Math.abs(tx.amount)} CRD</span>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleCashoutAction(tx, 'approve')} className="flex-1 h-10 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[12px] rounded-xl flex items-center justify-center gap-1">
                      <CheckCircle size={16} /> אשר וסמן כשולם
                    </Button>
                    <Button onClick={() => { if(window.confirm('לדחות ולהחזיר כסף?')) handleCashoutAction(tx, 'reject'); }} className="flex-1 h-10 bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[12px] rounded-xl flex items-center justify-center gap-1">
                      <XCircle size={16} /> דחה בקשה
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </FadeIn>
  );
};
