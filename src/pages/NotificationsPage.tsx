import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
  Loader2, Bell, CheckCheck, UserCircle, MoreHorizontal, Trash2,
  Circle, CheckCircle2, ExternalLink, RefreshCw, Award, MessageSquare,
  Gift, Crown, Flame, Diamond, Handshake, Coins, Zap, UserPlus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

type ActorProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

const getActorIdFromNotification = (notif: any): string | null => {
  return notif?.actor_id || notif?.sender_id || notif?.from_user_id || notif?.initiator_id || notif?.profile_id || notif?.target_user_id || null;
};

const getNotifIcon = (text: string = '') => {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('אש') || lowerText.includes('fire')) return <Flame size={14} className="text-orange-500" />;
  if (lowerText.includes('יהלום') || lowerText.includes('diamond')) return <Diamond size={14} className="text-blue-400" />;
  if (lowerText.includes('ברית') || lowerText.includes('alliance')) return <Handshake size={14} className="text-emerald-400" />;
  if (lowerText.includes('חותם') || lowerText.includes('לייק') || lowerText.includes('אהב')) return <Award size={14} className="text-pink-500" />;
  if (lowerText.includes('הד') || lowerText.includes('הגיב') || lowerText.includes('תגובה') || lowerText.includes('צ\'אט')) return <MessageSquare size={14} className="text-accent-primary" />;
  if (lowerText.includes('crd') || lowerText.includes('תשלום') || lowerText.includes('נאמנות') || lowerText.includes('העביר')) return <Coins size={14} className="text-amber-400" />;
  if (lowerText.includes('מתנה') || lowerText.includes('דרופ') || lowerText.includes('נפתח')) return <Gift size={14} className="text-emerald-400" />;
  if (lowerText.includes('xp') || lowerText.includes('רמה') || lowerText.includes('סיגנל')) return <Zap size={14} className="text-amber-400 fill-amber-400" />;
  if (lowerText.includes('מועדון') || lowerText.includes('הצטרף') || lowerText.includes('core')) return <Crown size={14} className="text-purple-400" />;
  if (lowerText.includes('עוקב') || lowerText.includes('follow')) return <UserPlus size={14} className="text-blue-400" />;

  return <Bell size={14} className="text-white" />;
};

const BottomSheet: React.FC<{ open: boolean; onClose: () => void; children: React.ReactNode }> = ({ open, onClose, children }) => {
  const dragControls = useDragControls();
  const startSheetDrag = (e: React.PointerEvent<HTMLElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const interactive = target.closest('button, a');
    if (interactive) return;
    dragControls.start(e);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9900] flex flex-col justify-end" dir="rtl">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
          <motion.div
            drag="y" dragControls={dragControls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.1}
            onDragEnd={(_, info) => { if (info.offset.y > 100 || info.velocity.y > 400) onClose(); }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 500 }}
            className="bg-[#0a0a0a] rounded-t-[40px] flex flex-col shadow-2xl relative overflow-hidden border-t border-white/10 pb-8"
          >
            <div className="w-full py-4 flex justify-center shrink-0 cursor-grab active:cursor-grabbing border-b border-white/5" onPointerDown={startSheetDrag} style={{ touchAction: 'none' }}>
              <div className="w-12 h-1 bg-white/20 rounded-full pointer-events-none" />
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

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, markNotificationsRead, checkUnread } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('inner_notifs_cache') || '[]'); } catch { return []; }
  });
  const [actorProfiles, setActorProfiles] = useState<Record<string, ActorProfile>>(() => {
    try { return JSON.parse(localStorage.getItem('inner_notifs_actors_cache') || '{}'); } catch { return {}; }
  });
  
  const [loading, setLoading] = useState(notifications.length === 0);
  const [activeMenuNotif, setActiveMenuNotif] = useState<any | null>(null);
  const [showGlobalActions, setShowGlobalActions] = useState(false);
  const [busyId, setBusyId] = useState<string | number | null>(null);

  const unreadExists = useMemo(() => notifications.some((n) => !n.is_read), [notifications]);
  const readExists = useMemo(() => notifications.some((n) => n.is_read), [notifications]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const enrichActorProfiles = useCallback(async (list: any[]) => {
    const actorIds = Array.from(new Set(list.map(getActorIdFromNotification).filter(Boolean))) as string[];
    if (actorIds.length === 0) return;
    try {
      const { data } = await supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', actorIds);
      const map: Record<string, ActorProfile> = { ...actorProfiles };
      data?.forEach((p) => { map[p.id] = p; });
      setActorProfiles(map);
      localStorage.setItem('inner_notifs_actors_cache', JSON.stringify(map));
    } catch (err) {}
  }, [actorProfiles]);

  const fetchNotifs = useCallback(async (markAsRead = true) => {
    if (!user?.id) return;
    try {
      const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(40);
      const safeData = Array.isArray(data) ? data : [];
      setNotifications(safeData);
      localStorage.setItem('inner_notifs_cache', JSON.stringify(safeData));
      await enrichActorProfiles(safeData);
      if (markAsRead && safeData.some((n) => !n.is_read)) await markNotificationsRead();
      else await checkUnread(user.id);
    } catch (err) {} finally { setLoading(false); }
  }, [user?.id, markNotificationsRead, checkUnread, enrichActorProfiles]);

  useEffect(() => { fetchNotifs(true); }, [fetchNotifs]);

  const handleRefresh = async () => {
    triggerFeedback('pop');
    setLoading(true);
    await fetchNotifs(true);
    setShowGlobalActions(false);
    triggerFeedback('success');
  };

  const handleNotifClick = async (notif: any) => {
    triggerFeedback('pop');
    if (!notif.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
      const updated = notifications.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n));
      setNotifications(updated);
      localStorage.setItem('inner_notifs_cache', JSON.stringify(updated));
      if (user?.id) await checkUnread(user.id);
    }
    if (notif.action_url) navigate(notif.action_url);
  };

  const setReadState = async (notif: any, state: boolean) => {
    setBusyId(notif.id);
    try {
      await supabase.from('notifications').update({ is_read: state }).eq('id', notif.id);
      const updated = notifications.map((n) => (n.id === notif.id ? { ...n, is_read: state } : n));
      setNotifications(updated);
      localStorage.setItem('inner_notifs_cache', JSON.stringify(updated));
      if (user?.id) await checkUnread(user.id);
      triggerFeedback('success');
      toast.success(state ? 'סומן כנקרא' : 'סומן כלא נקרא');
    } catch { toast.error('שגיאה בעדכון'); } finally { setBusyId(null); setActiveMenuNotif(null); }
  };

  const deleteNotification = async (notifId: string | number) => {
    setBusyId(notifId);
    triggerFeedback('error');
    try {
      await supabase.from('notifications').delete().eq('id', notifId);
      const updated = notifications.filter((n) => n.id !== notifId);
      setNotifications(updated);
      localStorage.setItem('inner_notifs_cache', JSON.stringify(updated));
      toast.success('ההתראה נמחקה');
    } catch { toast.error('שגיאה במחיקה'); } finally { setBusyId(null); setActiveMenuNotif(null); }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    setBusyId('mark-all');
    triggerFeedback('pop');
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
      const updated = notifications.map((n) => ({ ...n, is_read: true }));
      setNotifications(updated);
      localStorage.setItem('inner_notifs_cache', JSON.stringify(updated));
      await checkUnread(user.id);
      toast.success('הכל סומן כנקרא');
    } catch { toast.error('שגיאה בעדכון'); } finally { setBusyId(null); setShowGlobalActions(false); }
  };

  const deleteAllRead = async () => {
    if (!user?.id) return;
    setBusyId('delete-all');
    triggerFeedback('error');
    try {
      await supabase.from('notifications').delete().eq('user_id', user.id).eq('is_read', true);
      const updated = notifications.filter((n) => !n.is_read);
      setNotifications(updated);
      localStorage.setItem('inner_notifs_cache', JSON.stringify(updated));
      toast.success('כל הנקראות נמחקו');
    } catch { toast.error('שגיאה במחיקה'); } finally { setBusyId(null); setShowGlobalActions(false); }
  };

  if (loading && notifications.length === 0) return <div className="min-h-screen bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" size={32} /></div>;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="px-4 pt-6 pb-32 bg-surface min-h-screen flex flex-col font-sans" dir="rtl">
      <div className="flex justify-between items-center mb-6 px-2">
        <h1 className="text-2xl font-black text-brand tracking-widest uppercase">פעילות</h1>
        <button
          onClick={() => { triggerFeedback('pop'); setShowGlobalActions(true); }}
          className="w-10 h-10 flex items-center justify-center bg-surface-card border border-surface-border rounded-full text-brand-muted hover:text-accent-primary shadow-sm active:scale-90 transition-all"
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {notifications.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center opacity-40 mt-32">
              <Bell size={56} className="text-brand-muted mb-4" strokeWidth={1} />
              <p className="font-black text-brand-muted uppercase tracking-widest text-[13px]">אין פעילות עדיין</p>
            </motion.div>
          ) : (
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex flex-col gap-3">
              {notifications.map((notif) => {
                const actor = actorProfiles[getActorIdFromNotification(notif) || ''];
                const isUnread = !notif.is_read;
                return (
                  <motion.div
                    key={notif.id}
                    variants={itemVariants}
                    layout
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => handleNotifClick(notif)}
                    className={`p-5 rounded-[32px] border flex items-start gap-4 transition-all cursor-pointer active:scale-[0.98] ${
                      isUnread
                        ? 'bg-surface-card border-accent-primary/40 shadow-[0_5px_15px_rgba(var(--color-accent-primary),0.08)]'
                        : 'bg-surface border-surface-border opacity-70 grayscale-[10%]'
                    }`}
                  >
                    <div className="relative shrink-0 mt-1">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-card border border-surface-border flex items-center justify-center shadow-inner">
                        {actor?.avatar_url ? (
                          <img src={actor.avatar_url} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-brand-muted font-black text-lg">{(actor?.full_name || notif.title || 'א')[0]}</span>
                        )}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-6 h-6 bg-surface-card border border-surface-border rounded-full flex items-center justify-center shadow-md ${isUnread ? 'bg-accent-primary/10 border-accent-primary/30' : ''}`}>
                        {getNotifIcon(notif.content || notif.title)}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col pt-0.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-black text-[15px] truncate ${isUnread ? 'text-brand' : 'text-brand-muted'}`}>
                          {actor?.full_name || notif.title}
                        </span>
                        {isUnread && (
                          <span className="text-[9px] font-black text-accent-primary bg-accent-primary/10 border border-accent-primary/20 px-2 py-0.5 rounded-md uppercase tracking-widest shadow-sm">
                            חדש
                          </span>
                        )}
                      </div>
                      <p className={`text-[13px] leading-relaxed line-clamp-2 ${isUnread ? 'text-brand font-medium' : 'text-brand-muted font-medium'}`}>
                        {notif.content}
                      </p>
                      <span className="text-brand-muted/50 text-[10px] font-bold uppercase tracking-widest mt-2 block">
                        {new Date(notif.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveMenuNotif(notif); }}
                      className="p-2 -mr-2 text-brand-muted hover:text-brand transition-colors self-center active:scale-90"
                    >
                      <MoreHorizontal size={20} />
                    </button>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {mounted && typeof document !== 'undefined' && createPortal(
        <>
          <BottomSheet open={showGlobalActions} onClose={() => setShowGlobalActions(false)}>
            <div className="flex flex-col gap-3">
              <button onClick={handleRefresh} className="w-full flex items-center gap-4 p-4 rounded-[24px] bg-[#111] hover:bg-white/5 border border-white/5 active:scale-[0.98] transition-all shadow-sm">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0"><RefreshCw size={18} className="text-white/60" /></div>
                <span className="flex-1 text-right text-white text-[15px] font-black">רענן התראות</span>
              </button>
              {unreadExists && (
                <button onClick={markAllAsRead} disabled={busyId === 'mark-all'} className="w-full flex items-center gap-4 p-4 rounded-[24px] bg-[#111] hover:bg-white/5 border border-white/5 active:scale-[0.98] transition-all shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center shrink-0"><CheckCheck size={18} className="text-accent-primary" /></div>
                  <span className="flex-1 text-right text-white text-[15px] font-black">סמן הכל כנקרא</span>
                </button>
              )}
              {readExists && (
                <button onClick={deleteAllRead} disabled={busyId === 'delete-all'} className="w-full flex items-center gap-4 p-4 rounded-[24px] bg-[#111] hover:bg-white/5 border border-rose-500/20 active:scale-[0.98] transition-all shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0"><Trash2 size={18} className="text-rose-500" /></div>
                  <span className="flex-1 text-right text-rose-500 text-[15px] font-black">מחק את כל ההתראות שנקראו</span>
                </button>
              )}
            </div>
          </BottomSheet>

          {activeMenuNotif && (
            <BottomSheet open={!!activeMenuNotif} onClose={() => setActiveMenuNotif(null)}>
              <div className="flex flex-col gap-3">
                <button onClick={() => setReadState(activeMenuNotif, !activeMenuNotif.is_read)} className="w-full flex items-center gap-4 p-4 rounded-[24px] bg-[#111] hover:bg-white/5 border border-white/5 active:scale-[0.98] transition-all shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                    {activeMenuNotif.is_read ? <Circle size={18} className="text-white/40" /> : <CheckCircle2 size={18} className="text-accent-primary" />}
                  </div>
                  <span className="flex-1 text-right text-white text-[15px] font-black">{activeMenuNotif.is_read ? 'סמן כלא נקראה' : 'סמן כנקראה'}</span>
                </button>
                <button onClick={() => { setActiveMenuNotif(null); navigate(`/profile/${getActorIdFromNotification(activeMenuNotif)}`); }} className="w-full flex items-center gap-4 p-4 rounded-[24px] bg-[#111] hover:bg-white/5 border border-white/5 active:scale-[0.98] transition-all shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0"><UserCircle size={18} className="text-white/60" /></div>
                  <span className="flex-1 text-right text-white text-[15px] font-black">מעבר לפרופיל</span>
                </button>
                {activeMenuNotif.action_url && (
                  <button onClick={() => { triggerFeedback('pop'); setActiveMenuNotif(null); navigate(activeMenuNotif.action_url); }} className="w-full flex items-center gap-4 p-4 rounded-[24px] bg-[#111] hover:bg-white/5 border border-white/5 active:scale-[0.98] transition-all shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0"><ExternalLink size={18} className="text-white/60" /></div>
                    <span className="flex-1 text-right text-white text-[15px] font-black">פתח יעד ההתראה</span>
                  </button>
                )}
                <button onClick={() => deleteNotification(activeMenuNotif.id)} className="w-full flex items-center gap-4 p-4 rounded-[24px] bg-[#111] hover:bg-white/5 border border-rose-500/20 active:scale-[0.98] transition-all shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0"><Trash2 size={18} className="text-rose-500" /></div>
                  <span className="flex-1 text-right text-rose-500 text-[15px] font-black">מחק התראה זו</span>
                </button>
              </div>
            </BottomSheet>
          )}
        </>,
        document.body
      )}
    </div>
  );
};
