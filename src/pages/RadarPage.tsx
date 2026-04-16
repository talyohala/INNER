import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, Send, X, ShieldAlert, Zap, UserCircle, Loader2, MessageSquare, Crown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

const SIGNAL_COST = 20; // עלות שליחת סיגנל ב-CRD

export const RadarPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, reloadProfile } = useAuth();
  
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(true);
  
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [signalMessage, setSignalMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (profile?.id) fetchRadarUsers();
  }, [profile?.id]);

  const fetchRadarUsers = async () => {
    setLoading(true);
    setScanning(true);
    try {
      // שליפת משתמשים אקראיים (במערכת אמיתית נסנן לפי תחומי עניין / מיקום)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, bio, level, role_label')
        .neq('id', profile!.id)
        .limit(15);
        
      if (error) throw error;
      
      // הוספת מיקומים אקראיים על הרדאר
      const positionedUsers = (data || []).map(u => ({
        ...u,
        x: Math.random() * 80 + 10, // 10% to 90%
        y: Math.random() * 70 + 15, // 15% to 85%
        delay: Math.random() * 2
      }));
      
      setTimeout(() => {
        setUsers(positionedUsers);
        setScanning(false);
        triggerFeedback('success');
      }, 2500); // אפקט סריקה פסיכולוגי
      
    } catch (err) {
      toast.error('שגיאה בסריקת הרדאר');
      setScanning(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSendSignal = async () => {
    if (!signalMessage.trim()) return toast.error('כתוב משהו בסיגנל');
    if ((profile?.crd_balance || 0) < SIGNAL_COST) {
      triggerFeedback('error');
      return toast.error('אין לך מספיק CRD בארנק');
    }

    setSending(true);
    triggerFeedback('pop');
    const tid = toast.loading('משדר סיגנל...');

    try {
      // 1. חיוב הארנק
      const newBalance = (profile!.crd_balance || 0) - SIGNAL_COST;
      await supabase.from('profiles').update({ crd_balance: newBalance }).eq('id', profile!.id);
      await supabase.from('transactions').insert({
        user_id: profile!.id, amount: -SIGNAL_COST, type: 'signal_fee', description: `סיגנל ל-${selectedUser.full_name}`
      });

      // 2. שמירת הסיגנל
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // תוקף ל-24 שעות

      await supabase.from('signals').insert({
        from_user_id: profile!.id,
        to_user_id: selectedUser.id,
        crd_cost: SIGNAL_COST,
        message: signalMessage.trim(),
        expires_at: expiresAt.toISOString()
      });

      // 3. התראה למקבל
      await supabase.from('notifications').insert({
        user_id: selectedUser.id,
        actor_id: profile!.id,
        type: 'signal',
        title: 'סיגנל חדש ברדאר! 📡',
        content: `מישהו שילם ${SIGNAL_COST} CRD כדי לשלוח לך סיגנל.`,
        action_url: '/inbox',
        is_read: false
      });

      if (reloadProfile) reloadProfile();
      triggerFeedback('success');
      toast.success('הסיגנל שודר בהצלחה!', { id: tid });
      
      // הסרת המשתמש מהרדאר (כי כבר שלחנו לו)
      setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
      setSelectedUser(null);
      setSignalMessage('');
      
    } catch (err) {
      toast.error('שגיאה בשידור הסיגנל', { id: tid });
    } finally {
      setSending(false);
    }
  };

  return (
    <FadeIn className="bg-[#030303] min-h-screen font-sans flex flex-col relative overflow-hidden" dir="rtl">
      
      {/* HEADER */}
      <div className="relative z-50 pt-[calc(env(safe-area-inset-top)+16px)] px-6 flex items-center justify-between pointer-events-none">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black text-white tracking-widest uppercase flex items-center gap-2 drop-shadow-lg">
            רדאר <Radar size={28} className="text-accent-primary animate-pulse" />
          </h1>
          <span className="text-accent-primary text-[11px] font-black uppercase tracking-[0.2em]">איתור חיבורים</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-brand-muted text-[10px] font-black uppercase tracking-widest mb-1">כוח שידור זמין</span>
          <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5 shadow-inner">
            <span className="text-white font-black text-[13px]">{profile?.crd_balance || 0}</span>
            <Zap size={12} className="text-amber-400 fill-amber-400" />
          </div>
        </div>
      </div>

      {/* RADAR UI (The Map) */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        
        {/* Radar Background Rings */}
        <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
          <div className="w-[300px] h-[300px] rounded-full border border-accent-primary/30 absolute" />
          <div className="w-[500px] h-[500px] rounded-full border border-accent-primary/20 absolute" />
          <div className="w-[700px] h-[700px] rounded-full border border-accent-primary/10 absolute" />
          
          {/* Sweeping Line */}
          <motion.div 
            animate={{ rotate: 360 }} 
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="w-[350px] h-[350px] absolute rounded-full"
            style={{ background: 'conic-gradient(from 0deg, transparent 70%, rgba(var(--color-accent-primary), 0.4) 100%)' }}
          />
        </div>

        {/* Center Node (You) */}
        <div className="absolute z-30 flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-full border-2 border-accent-primary bg-surface overflow-hidden shadow-[0_0_30px_rgba(var(--color-accent-primary),0.6)] z-20">
            {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-brand-muted" />}
          </div>
          <div className="w-4 h-4 bg-accent-primary rounded-full absolute animate-ping opacity-50 z-10" />
        </div>

        {/* Scanning State */}
        <AnimatePresence>
          {scanning && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute z-40 flex flex-col items-center gap-3 bg-black/60 backdrop-blur-sm px-6 py-4 rounded-[32px] border border-white/10">
              <Radar size={32} className="text-accent-primary animate-spin" />
              <span className="text-white font-black tracking-widest uppercase text-[12px]">סורק את האזור...</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Users Nodes */}
        {!scanning && users.map((u) => (
          <motion.div
            key={u.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: u.delay, type: 'spring' }}
            style={{ left: `${u.x}%`, top: `${u.y}%` }}
            className="absolute z-20 flex flex-col items-center gap-1 cursor-pointer group"
            onClick={() => { triggerFeedback('pop'); setSelectedUser(u); }}
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-white/20 bg-surface overflow-hidden shadow-lg group-hover:border-accent-primary transition-colors group-hover:scale-110 duration-300">
                {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-brand-muted p-1" />}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-[#030303] rounded-full" />
            </div>
            <span className="text-white text-[9px] font-black uppercase tracking-wider bg-black/60 px-2 py-0.5 rounded-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
              {u.full_name?.split(' ')[0]}
            </span>
          </motion.div>
        ))}

        {/* Action Bar at the bottom */}
        <div className="absolute bottom-28 left-0 right-0 flex justify-center z-30 pointer-events-none">
          <button onClick={() => { triggerFeedback('pop'); fetchRadarUsers(); }} className="pointer-events-auto bg-surface-card/80 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-full text-white font-black text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-2xl active:scale-95 transition-transform">
            <Radar size={16} className="text-accent-primary" /> רענן סריקה
          </button>
        </div>
      </div>

      {/* SELECTED USER BOTTOM SHEET */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedUser && (
            <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedUser(null)} />
              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 400 }}
                className="relative z-10 bg-surface rounded-t-[40px] p-6 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border flex flex-col"
              >
                <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />
                
                <div className="flex gap-4 items-start mb-6 border-b border-surface-border pb-6">
                  <div className="w-20 h-20 rounded-[24px] bg-surface-card border border-surface-border overflow-hidden shadow-inner shrink-0">
                    {selectedUser.avatar_url ? <img src={selectedUser.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-brand-muted p-2" />}
                  </div>
                  <div className="flex flex-col pt-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-brand font-black text-xl">{selectedUser.full_name}</h3>
                      {selectedUser.role_label === 'CORE' && <Crown size={14} className="text-accent-primary" />}
                    </div>
                    <span className="text-brand-muted text-[12px] font-bold tracking-widest mt-0.5" dir="ltr">@{selectedUser.username}</span>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md border border-emerald-400/20">רמה {selectedUser.level || 1}</span>
                      <button onClick={() => { setSelectedUser(null); navigate(`/profile/${selectedUser.id}`); }} className="text-[10px] font-black uppercase tracking-widest text-brand-muted hover:text-brand bg-white/5 px-2 py-1 rounded-md border border-white/10 transition-colors">
                        פרופיל מלא
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 mb-6">
                  <label className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-2">הודעת סיגנל</label>
                  <textarea 
                    value={signalMessage} onChange={(e) => setSignalMessage(e.target.value)}
                    placeholder="היי, ראיתי שאנחנו באותם מועדונים..."
                    className="w-full h-24 bg-surface-card border border-surface-border rounded-[24px] p-4 text-brand font-medium outline-none focus:border-accent-primary/50 transition-all resize-none shadow-inner text-sm"
                  />
                </div>

                <div className="flex items-center justify-between bg-accent-primary/5 border border-accent-primary/20 rounded-[20px] p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent-primary/10 flex items-center justify-center">
                      <Zap size={18} className="text-accent-primary fill-accent-primary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-brand font-black text-sm">עלות שידור</span>
                      <span className="text-brand-muted text-[10px] font-bold">הצד השני יראה ששילמת</span>
                    </div>
                  </div>
                  <span className="text-accent-primary font-black text-xl">{SIGNAL_COST} CRD</span>
                </div>

                <Button onClick={handleSendSignal} disabled={sending || !signalMessage.trim()} className="w-full h-16 bg-white text-black font-black text-[15px] uppercase tracking-widest rounded-[24px] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                  {sending ? <Loader2 size={24} className="animate-spin text-black" /> : <><Send size={18} className="rtl:-scale-x-100" /> שדר סיגנל</>}
                </Button>

              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </FadeIn>
  );
};
