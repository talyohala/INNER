import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Aperture, Send, Zap, UserCircle, Loader2, Crown, Inbox, Check, X, ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import { apiFetch } from '../lib/api';
import toast from 'react-hot-toast';

export const RadarPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, reloadProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<'scanner' | 'queue'>('scanner');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [signalMessage, setSignalMessage] = useState('');
  const [sending, setSending] = useState(false);
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
        x: Math.random() * 70 + 15,
        y: Math.random() * 60 + 20,
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
      const newBalance = (profile!.crd_balance || 0) - costNum;
      await supabase.from('profiles').update({ crd_balance: newBalance }).eq('id', profile!.id);
      
      await supabase.from('transactions').insert({
        user_id: profile!.id, amount: -costNum, type: 'signal_escrow', description: `נאמנות עבור סיגנל ל-${selectedUser.full_name}`
      });

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

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

      try {
        await apiFetch('/notifications/send-push', 'POST', {
          targetUserId: selectedUser.id,
          title: 'סיגנל יוקרתי ברדאר! 📡',
          body: `${profile?.full_name || 'מישהו'} שם ${costNum} CRD כדי לדבר איתך.`,
          data: { url: '/radar' }
        });
      } catch (pushErr) {
        console.error('Push failed, but signal sent', pushErr);
      }

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

  const handleProcessSignal = async (signalId: string, senderId: string, action: 'accept' | 'decline') => {
    setProcessingId(signalId);
    triggerFeedback('pop');
    try {
      const { data, error } = await supabase.rpc('process_signal_response', { p_signal_id: signalId, p_action: action });
      if (error || !data) throw new Error('שגיאה בתהליך');
      
      triggerFeedback('success');
      setIncomingSignals(prev => prev.filter(s => s.id !== signalId));
      if (reloadProfile) reloadProfile();

      if (action === 'accept') {
        toast.success('הסיגנל אושר! הצ\'אט נפתח.', { icon: '🎉' });
        navigate(`/chat/${senderId}`);
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
    <FadeIn className="bg-[#050505] min-h-[100dvh] font-sans flex flex-col relative overflow-x-hidden pb-32" dir="rtl">
      
      {/* 🌌 BACKGROUND HERO (Circle Style) */}
      <div className="absolute top-0 left-0 right-0 h-[45vh] pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/20 via-[#050505]/80 to-[#050505]" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-indigo-500/10 blur-[120px] rounded-full" />
      </div>

      {/* HEADER */}
      <div className="relative z-20 pt-[calc(env(safe-area-inset-top)+20px)] px-6 flex flex-col items-center text-center shrink-0">
        <h1 className="text-3xl font-black text-white tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] mb-1">
          רדאר
        </h1>
        <p className="text-white/50 text-[12px] font-medium tracking-wide max-w-[280px] leading-relaxed">
          איתור, סינון וחיבור ישיר עם אנשי מפתח
        </p>

        <div className="flex items-center gap-4 mt-4">
          <div className="bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5 shadow-inner">
            <span className="text-white font-black text-[13px]">{profile?.crd_balance || 0}</span>
            <Zap size={14} className="text-amber-400 fill-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]" />
          </div>
        </div>
      </div>

      {/* TABS (Clean Text Style) */}
      <div className="flex items-center justify-center gap-8 px-6 mt-8 mb-6 shrink-0 relative z-20">
        {[
          { id: 'scanner', label: 'סריקת תדרים' },
          { id: 'queue', label: 'בקשות נכנסות', count: incomingSignals.length }
        ].map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => { triggerFeedback('pop'); setActiveTab(t.id as any); }}
              className={`relative text-[12px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 ${
                isActive ? 'text-white' : 'text-white/30 hover:text-white/60'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${isActive ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white/50'}`}>
                  {t.count}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="radar-indicator"
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(99,102,241,1)]"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 relative flex flex-col z-10">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: FUTURISTIC SCANNER */}
          {activeTab === 'scanner' && (
            <motion.div key="scanner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center">
              
              {/* Radar Rings */}
              <div className="absolute inset-0 flex items-center justify-center opacity-40 pointer-events-none">
                <div className="w-[200px] h-[200px] rounded-full border border-indigo-400/30 absolute" />
                <div className="w-[350px] h-[350px] rounded-full border border-indigo-400/20 absolute border-dashed" />
                <div className="w-[550px] h-[550px] rounded-full border border-indigo-400/10 absolute" />
                <motion.div 
                  animate={{ rotate: 360 }} 
                  transition={{ duration: 6, repeat: Infinity, ease: "linear" }} 
                  className="w-[800px] h-[800px] absolute rounded-full" 
                  style={{ background: 'conic-gradient(from 0deg, transparent 70%, rgba(99, 102, 241, 0.15) 100%)' }} 
                />
              </div>

              {/* Center User Avatar */}
              <div className="absolute z-30 flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full border-2 border-indigo-500 bg-[#050505] overflow-hidden shadow-[0_0_30px_rgba(99,102,241,0.5)] z-20">
                  {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-brand-muted p-1" />}
                </div>
                <div className="w-4 h-4 bg-indigo-500 rounded-full absolute animate-ping opacity-50 z-10" />
              </div>

              {/* Scanning State */}
              <AnimatePresence>
                {scanning && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute z-40 flex flex-col items-center gap-3 bg-black/60 backdrop-blur-md px-8 py-5 rounded-[32px] border border-white/10 shadow-2xl">
                    <Aperture size={36} className="text-indigo-400 animate-spin" strokeWidth={1.5} />
                    <span className="text-white font-black tracking-widest uppercase text-[11px] drop-shadow-md">מאתר חיבורים חדשים...</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Positioned Users */}
              {!scanning && users.map((u) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: u.delay, type: 'spring' }}
                  style={{ left: `${u.x}%`, top: `${u.y}%` }}
                  className="absolute z-20 flex flex-col items-center gap-1.5 cursor-pointer group"
                  onClick={() => { triggerFeedback('pop'); setSelectedUser(u); }}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border border-white/20 bg-[#111] overflow-hidden shadow-lg group-hover:border-indigo-400 transition-all group-hover:scale-110 duration-300 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.6)]">
                      {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-brand-muted p-1" />}
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-black/80 border border-white/10 px-1.5 py-0.5 rounded-md text-[9px] font-black text-amber-400 backdrop-blur-md shadow-sm">
                      {u.signal_price || 50} ⚡
                    </div>
                  </div>
                  <span className="text-white text-[10px] font-black uppercase tracking-wider bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity mt-1 shadow-sm truncate max-w-[80px] text-center">
                    {u.full_name}
                  </span>
                </motion.div>
              ))}

              {/* Refresh Button */}
              <div className="absolute bottom-6 left-0 right-0 flex justify-center z-30 pointer-events-none">
                <button onClick={() => { triggerFeedback('pop'); fetchRadarUsers(); }} className="pointer-events-auto bg-white/5 backdrop-blur-3xl border border-white/10 px-6 py-3.5 rounded-full text-white font-black text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)] active:scale-95 transition-all hover:bg-white/10 hover:border-white/20">
                  <Aperture size={16} className="text-indigo-400" /> רענן סריקה
                </button>
              </div>
            </motion.div>
          )}

          {/* TAB 2: INCOMING QUEUE */}
          {activeTab === 'queue' && (
            <motion.div key="queue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col overflow-y-auto px-4 gap-4 scrollbar-hide pt-4">
              {incomingSignals.length === 0 ? (
                <div className="flex flex-col items-center justify-center m-auto opacity-40 gap-4 mt-20">
                  <Inbox size={48} className="text-brand-muted" strokeWidth={1} />
                  <p className="text-brand-muted font-black text-[12px] tracking-widest uppercase">אין תדרים ממתינים</p>
                </div>
              ) : (
                incomingSignals.map((signal) => (
                  <div key={signal.id} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[28px] p-5 shadow-lg flex flex-col gap-4 transition-all hover:border-white/20">
                    <div className="flex items-start justify-between border-b border-white/5 pb-4">
                      <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { triggerFeedback('pop'); navigate(`/profile/${signal.sender?.id}`); }}>
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-[#111] border border-white/10 group-hover:border-indigo-400 transition-colors">
                          {signal.sender?.avatar_url ? <img src={signal.sender.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-brand-muted p-1" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-white font-black text-[15px] flex items-center gap-1.5">{signal.sender?.full_name} {signal.sender?.role_label === 'CORE' && <Crown size={12} className="text-indigo-400" />}</span>
                          <span className="text-white/40 text-[11px] font-bold tracking-widest" dir="ltr">@{signal.sender?.username}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">שווי הבקשה</span>
                        <div className="bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full flex items-center gap-1.5">
                          <span className="text-indigo-400 font-black text-[14px]">{signal.crd_cost}</span>
                          <Zap size={14} className="text-amber-400 fill-amber-400" />
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-white/90 text-[14px] font-medium leading-relaxed bg-[#050505]/50 p-4 rounded-[20px] border border-white/5 whitespace-pre-wrap shadow-inner">
                      {signal.message}
                    </p>
                    
                    <div className="flex gap-2 pt-2">
                      <Button onClick={() => handleProcessSignal(signal.id, signal.sender?.id, 'decline')} disabled={processingId === signal.id} className="flex-1 h-12 bg-white/5 border border-white/10 text-white/50 hover:text-rose-500 hover:border-rose-500/30 hover:bg-rose-500/10 rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-none">
                        {processingId === signal.id ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'דחה תדר'}
                      </Button>
                      <Button onClick={() => handleProcessSignal(signal.id, signal.sender?.id, 'accept')} disabled={processingId === signal.id} className="flex-1 h-12 bg-indigo-500 hover:bg-indigo-400 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(99,102,241,0.4)] active:scale-95 transition-all border-none">
                        {processingId === signal.id ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'אשר ופתח צ\'אט'}
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
                className="relative z-10 bg-[#111] rounded-t-[32px] p-6 pb-[calc(env(safe-area-inset-bottom)+32px)] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-white/10 flex flex-col"
              >
                <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />
                
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                  <div className="w-16 h-16 rounded-[20px] bg-[#050505] border border-white/10 overflow-hidden shadow-lg shrink-0">
                    {selectedUser.avatar_url ? <img src={selectedUser.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-brand-muted p-2" />}
                  </div>
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <h3 className="text-white font-black text-[18px] flex items-center gap-1.5">{selectedUser.full_name} {selectedUser.role_label === 'CORE' && <Crown size={14} className="text-indigo-400" />}</h3>
                        <span className="text-white/40 text-[12px] font-bold tracking-widest mt-0.5" dir="ltr">@{selectedUser.username}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/70 bg-white/10 px-2 py-1 rounded-md">רמה {selectedUser.level || 1}</span>
                      <button onClick={() => { setSelectedUser(null); navigate(`/profile/${selectedUser.id}`); }} className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-md transition-colors active:scale-95 flex items-center gap-1">
                        פרופיל מלא <ChevronLeft size={12} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 mb-6">
                  <label className="text-white/40 text-[11px] font-black uppercase tracking-widest px-2">הודעת סיגנל</label>
                  <textarea
                    value={signalMessage} onChange={(e) => setSignalMessage(e.target.value)}
                    placeholder="היי, אשמח לדבר איתך..."
                    className="w-full h-24 bg-[#050505] border border-white/10 rounded-[20px] p-4 text-white font-medium outline-none focus:border-indigo-500/50 transition-all resize-none shadow-inner text-[14px]"
                  />
                </div>

                <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 rounded-[24px] p-5 mb-6">
                  <div className="flex flex-col">
                    <span className="text-indigo-100 font-black text-[14px] mb-1">דמי רצינות (Escrow)</span>
                    <span className="text-indigo-300/60 text-[10px] font-bold leading-relaxed max-w-[200px]">הסכום יישמר בנאמנות. אם התדר ידחה - הכסף יחזור אליך אוטומטית.</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-indigo-400 font-black text-2xl flex items-center gap-1.5">{selectedUser.signal_price || 50} <Zap size={18} className="fill-indigo-400" /></span>
                    <span className="text-indigo-400/50 text-[9px] font-black uppercase tracking-widest mt-0.5">CRD Required</span>
                  </div>
                </div>

                <button onClick={handleSendSignal} disabled={sending || !signalMessage.trim()} className="w-full h-14 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-black text-[14px] uppercase tracking-widest rounded-[20px] shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2">
                  {sending ? <Loader2 size={24} className="animate-spin text-white" /> : <><Send size={18} className="rtl:-scale-x-100" /> הפקד תשלום ושדר תדר</>}
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </FadeIn>
  );
};
