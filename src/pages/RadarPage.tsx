import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, Send, Zap, UserCircle, Loader2, Crown, Inbox, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

export const RadarPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, reloadProfile } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'scanner' | 'queue'>('scanner');
  
  // Scanner State
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [signalMessage, setSignalMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Queue State (Incoming Signals)
  const [incomingSignals, setIncomingSignals] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchRadarUsers();
      fetchIncomingSignals();
    }
  }, [profile?.id]);

  const fetchRadarUsers = async () => {
    setLoading(true);
    setScanning(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, bio, level, role_label, signal_price')
        .neq('id', profile!.id)
        .limit(15);
        
      if (error) throw error;
      
      const positionedUsers = (data || []).map(u => ({
        ...u,
        x: Math.random() * 80 + 10,
        y: Math.random() * 70 + 15,
        delay: Math.random() * 2
      }));
      
      setTimeout(() => {
        setUsers(positionedUsers);
        setScanning(false);
        triggerFeedback('success');
      }, 2500); 
      
    } catch (err) {
      setScanning(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchIncomingSignals = async () => {
    try {
      const { data, error } = await supabase
        .from('signals')
        .select('*, sender:profiles!from_user_id(id, full_name, username, avatar_url, level, role_label)')
        .eq('to_user_id', profile!.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setIncomingSignals(data || []);
    } catch (err) {
      console.error('Error fetching signals', err);
    }
  };

  const handleSendSignal = async () => {
    const costNum = selectedUser.signal_price || 50;
    if (!signalMessage.trim()) return toast.error('כתוב משהו בסיגנל');
    if ((profile?.crd_balance || 0) < costNum) {
      triggerFeedback('error');
      return toast.error('אין לך מספיק CRD בארנק');
    }

    setSending(true);
    triggerFeedback('pop');
    const tid = toast.loading('מעביר תשלום לנאמנות ומשדר...');

    try {
      // ניכוי מהארנק (נשמר בנאמנות עד אישור)
      const newBalance = (profile!.crd_balance || 0) - costNum;
      await supabase.from('profiles').update({ crd_balance: newBalance }).eq('id', profile!.id);
      await supabase.from('transactions').insert({
        user_id: profile!.id, amount: -costNum, type: 'signal_escrow', description: `נאמנות עבור סיגנל ל-${selectedUser.full_name}`
      });

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48); // תוקף 48 שעות

      await supabase.from('signals').insert({
        from_user_id: profile!.id,
        to_user_id: selectedUser.id,
        crd_cost: costNum,
        message: signalMessage.trim(),
        expires_at: expiresAt.toISOString()
      });

      await supabase.from('notifications').insert({
        user_id: selectedUser.id, actor_id: profile!.id, type: 'signal',
        title: 'סיגנל חדש ממתין ברדאר! 📡', content: `קיבלת בקשת חיבור בשווי ${costNum} CRD.`, action_url: '/radar'
      });

      if (reloadProfile) reloadProfile();
      triggerFeedback('success');
      toast.success('הסיגנל נשלח! ממתין לאישור הצד השני.', { id: tid });
      
      setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
      setSelectedUser(null);
      setSignalMessage('');
      
    } catch (err) {
      toast.error('שגיאה בשידור הסיגנל', { id: tid });
    } finally {
      setSending(false);
    }
  };

  const handleProcessSignal = async (signalId: string, action: 'accept' | 'decline') => {
    setProcessingId(signalId);
    triggerFeedback('pop');
    try {
      const { data, error } = await supabase.rpc('process_signal_response', { p_signal_id: signalId, p_action: action });
      if (error || !data) throw new Error('שגיאה בתהליך');

      triggerFeedback('success');
      setIncomingSignals(prev => prev.filter(s => s.id !== signalId));
      if (reloadProfile) reloadProfile();
      
      if (action === 'accept') {
        toast.success('הסיגנל אושר! הצ\'אט פתוח עכשיו.', { icon: '🎉' });
      } else {
        toast.success('הסיגנל נדחה והכסף הוחזר לשולח.');
      }
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בעדכון הסיגנל');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <FadeIn className="bg-[#030303] min-h-[100dvh] font-sans flex flex-col relative overflow-hidden" dir="rtl">
      
      {/* HEADER & TABS */}
      <div className="relative z-50 pt-[calc(env(safe-area-inset-top)+16px)] px-4 flex flex-col gap-4 bg-surface/90 backdrop-blur-2xl border-b border-surface-border pb-3 shadow-sm">
        
        <div className="flex items-center justify-between">
          <div className="w-16" />
          <div className="flex flex-col items-center">
            <h1 className="text-2xl font-black text-white tracking-widest uppercase drop-shadow-lg">
              רדאר
            </h1>
            <span className="text-accent-primary text-[10px] font-black uppercase tracking-[0.2em] mt-0.5">מרכז חיבורים</span>
          </div>
          <div className="flex flex-col items-end">
            <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5 shadow-inner">
              <span className="text-white font-black text-[13px]">{profile?.crd_balance || 0}</span>
              <Zap size={12} className="text-amber-400 fill-amber-400" />
            </div>
          </div>
        </div>

        {/* Custom Tabs */}
        <div className="flex gap-2 bg-black/40 p-1.5 rounded-full border border-white/5">
          <button onClick={() => { triggerFeedback('pop'); setActiveTab('scanner'); }} className={`flex-1 py-2.5 rounded-full text-[12px] font-black uppercase tracking-widest transition-all ${activeTab === 'scanner' ? 'bg-white text-black shadow-md' : 'text-brand-muted'}`}>
            סריקת תדרים
          </button>
          <button onClick={() => { triggerFeedback('pop'); setActiveTab('queue'); }} className={`relative flex-1 py-2.5 rounded-full text-[12px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'queue' ? 'bg-white text-black shadow-md' : 'text-brand-muted'}`}>
            בקשות נכנסות
            {incomingSignals.length > 0 && (
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeTab === 'queue' ? 'bg-accent-primary text-white' : 'bg-accent-primary text-white animate-pulse shadow-[0_0_10px_rgba(var(--color-accent-primary),0.5)]'}`}>
                {incomingSignals.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 relative flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: THE SCANNER MAP */}
          {activeTab === 'scanner' && (
            <motion.div key="scanner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                <div className="w-[300px] h-[300px] rounded-full border border-accent-primary/30 absolute" />
                <div className="w-[500px] h-[500px] rounded-full border border-accent-primary/20 absolute" />
                <div className="w-[700px] h-[700px] rounded-full border border-accent-primary/10 absolute" />
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} className="w-[350px] h-[350px] absolute rounded-full" style={{ background: 'conic-gradient(from 0deg, transparent 70%, rgba(var(--color-accent-primary), 0.4) 100%)' }} />
              </div>

              <div className="absolute z-30 flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-full border-2 border-accent-primary bg-surface overflow-hidden shadow-[0_0_30px_rgba(var(--color-accent-primary),0.6)] z-20">
                  {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-brand-muted p-1" />}
                </div>
                <div className="w-4 h-4 bg-accent-primary rounded-full absolute animate-ping opacity-50 z-10" />
              </div>

              <AnimatePresence>
                {scanning && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute z-40 flex flex-col items-center gap-3 bg-black/60 backdrop-blur-sm px-6 py-4 rounded-[32px] border border-white/10">
                    <Radar size={32} className="text-accent-primary animate-spin" />
                    <span className="text-white font-black tracking-widest uppercase text-[12px]">סורק תדרים...</span>
                  </motion.div>
                )}
              </AnimatePresence>

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
                    {/* Badge showing their price */}
                    <div className="absolute -bottom-2 -right-2 bg-black/80 border border-white/20 px-1.5 py-0.5 rounded-md text-[8px] font-black text-amber-400 backdrop-blur-md">
                      {u.signal_price || 50} ⚡
                    </div>
                  </div>
                  <span className="text-white text-[9px] font-black uppercase tracking-wider bg-black/60 px-2 py-0.5 rounded-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                    {u.full_name?.split(' ')[0]}
                  </span>
                </motion.div>
              ))}

              <div className="absolute bottom-28 left-0 right-0 flex justify-center z-30 pointer-events-none">
                <button onClick={() => { triggerFeedback('pop'); fetchRadarUsers(); }} className="pointer-events-auto bg-surface-card/80 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-full text-white font-black text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-2xl active:scale-95 transition-transform">
                  <Radar size={16} className="text-accent-primary" /> רענן סריקה
                </button>
              </div>
            </motion.div>
          )}

          {/* TAB 2: INCOMING QUEUE */}
          {activeTab === 'queue' && (
            <motion.div key="queue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col overflow-y-auto px-4 pt-6 pb-32 gap-4 scrollbar-hide">
              {incomingSignals.length === 0 ? (
                <div className="flex flex-col items-center justify-center m-auto opacity-40 gap-4">
                  <Inbox size={56} className="text-brand-muted" strokeWidth={1} />
                  <p className="text-brand-muted font-black text-[13px] tracking-widest uppercase">אין בקשות ממתינות</p>
                </div>
              ) : (
                incomingSignals.map((signal) => (
                  <div key={signal.id} className="bg-surface-card border border-surface-border rounded-[32px] p-5 shadow-lg flex flex-col gap-4">
                    <div className="flex items-start justify-between border-b border-surface-border pb-4">
                      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/profile/${signal.sender?.id}`)}>
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-surface border border-surface-border">
                          {signal.sender?.avatar_url ? <img src={signal.sender.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-brand-muted p-1" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-brand font-black text-[15px] flex items-center gap-1.5">{signal.sender?.full_name} {signal.sender?.role_label === 'CORE' && <Crown size={12} className="text-accent-primary" />}</span>
                          <span className="text-brand-muted text-[11px] font-bold tracking-widest" dir="ltr">@{signal.sender?.username}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black uppercase tracking-widest text-brand-muted mb-0.5">שווי בקשה</span>
                        <div className="bg-accent-primary/10 border border-accent-primary/20 px-3 py-1 rounded-full flex items-center gap-1.5">
                          <span className="text-accent-primary font-black text-[14px]">{signal.crd_cost}</span>
                          <Zap size={14} className="text-amber-400 fill-amber-400" />
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-brand text-[14px] font-medium leading-relaxed bg-surface/50 p-4 rounded-2xl border border-surface-border whitespace-pre-wrap">
                      {signal.message}
                    </p>

                    <div className="flex gap-2 pt-2">
                      <Button onClick={() => handleProcessSignal(signal.id, 'decline')} disabled={processingId === signal.id} className="flex-1 h-12 bg-surface border border-surface-border text-brand-muted hover:text-rose-500 hover:border-rose-500/50 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all">
                        {processingId === signal.id ? <Loader2 size={16} className="animate-spin mx-auto" /> : <><X size={16}/> דחה והחזר כסף</>}
                      </Button>
                      <Button onClick={() => handleProcessSignal(signal.id, 'accept')} disabled={processingId === signal.id} className="flex-1 h-12 bg-white text-black rounded-xl text-[12px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all">
                        {processingId === signal.id ? <Loader2 size={16} className="animate-spin mx-auto" /> : <><Check size={16}/> אשר ופתח צ'אט</>}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SELECTED USER BOTTOM SHEET (Sending Signal) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedUser && (
            <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedUser(null)} />
              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 400 }}
                className="relative z-10 bg-surface rounded-t-[40px] p-6 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border flex flex-col"
              >
                <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-6 cursor-grab active:cursor-grabbing" />
                
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
                    placeholder="היי, אשמח לדבר איתך..."
                    className="w-full h-24 bg-surface-card border border-surface-border rounded-[24px] p-4 text-brand font-medium outline-none focus:border-accent-primary/50 transition-all resize-none shadow-inner text-sm"
                  />
                </div>

                <div className="flex items-center justify-between bg-accent-primary/5 border border-accent-primary/20 rounded-[24px] p-5 mb-4">
                  <div className="flex flex-col">
                    <span className="text-brand font-black text-sm mb-1">דמי רצינות (Escrow)</span>
                    <span className="text-brand-muted text-[10px] font-bold leading-relaxed max-w-[200px]">הסכום יישמר בנאמנות. אם הבקשה תדחה - הכסף יחזור אליך אוטומטית למחרת.</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-accent-primary font-black text-2xl flex items-center gap-1.5">{selectedUser.signal_price || 50} <Zap size={18} className="fill-accent-primary" /></span>
                    <span className="text-accent-primary/60 text-[9px] font-black uppercase tracking-widest">CRD Required</span>
                  </div>
                </div>

                <Button onClick={handleSendSignal} disabled={sending || !signalMessage.trim()} className="w-full h-16 bg-white text-black font-black text-[15px] uppercase tracking-widest rounded-[24px] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                  {sending ? <Loader2 size={24} className="animate-spin text-black" /> : <><Send size={18} className="rtl:-scale-x-100" /> הפקד תשלום ושדר</>}
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
