import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
  Loader2, Bell, CheckCheck, UserCircle, MoreHorizontal, Trash2,
  Circle, CheckCircle2, ExternalLink, RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

const cleanToastStyle = {
  background: 'rgba(18, 18, 18, 0.95)',
  backdropFilter: 'blur(20px)',
  color: '#ffffff',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  borderRadius: '100px',
  fontSize: '13px',
  fontWeight: 700,
  padding: '12px 24px',
  boxShadow: '0 15px 40px rgba(0,0,0,0.6)',
};

type ActorProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

const getActorIdFromNotification = (notif: any): string | null => {
  return notif?.actor_id || notif?.sender_id || notif?.from_user_id || notif?.initiator_id || notif?.profile_id || notif?.target_user_id || null;
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            drag="y" dragControls={dragControls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.1}
            onDragEnd={(_, info) => { if (info.offset.y > 100 || info.velocity.y > 400) onClose(); }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 500 }}
            className="bg-[#121212] rounded-t-[40px] flex flex-col shadow-2xl relative overflow-hidden border-t border-white/5 pb-8"
          >
            <div className="w-full py-5 flex justify-center shrink-0 cursor-grab active:cursor-grabbing border-b border-white/5" onPointerDown={startSheetDrag} style={{ touchAction: 'none' }}>
              <div className="w-12 h-1.5 bg-white/10 rounded-full pointer-events-none" />
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
      toast.success(state ? 'סומן כנקרא' : 'סומן כלא נקרא', { style: cleanToastStyle });
    } catch { toast.error('שגיאה בעדכון', { style: cleanToastStyle }); } finally { setBusyId(null); setActiveMenuNotif(null); }
  };

  const deleteNotification = async (notifId: string | number) => {
    setBusyId(notifId);
    triggerFeedback('error');
    try {
      await supabase.from('notifications').delete().eq('id', notifId);
      const updated = notifications.filter((n) => n.id !== notifId);
      setNotifications(updated);
      localStorage.setItem('inner_notifs_cache', JSON.stringify(updated));
      toast.success('ההתראה נמחקה', { style: cleanToastStyle });
    } catch { toast.error('שגיאה במחיקה', { style: cleanToastStyle }); } finally { setBusyId(null); setActiveMenuNotif(null); }
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
      toast.success('הכל סומן כנקרא', { style: cleanToastStyle });
    } catch { toast.error('שגיאה בעדכון', { style: cleanToastStyle }); } finally { setBusyId(null); setShowGlobalActions(false); }
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
      toast.success('כל הנקראות נמחקו', { style: cleanToastStyle });
    } catch { toast.error('שגיאה במחיקה', { style: cleanToastStyle }); } finally { setBusyId(null); setShowGlobalActions(false); }
  };

  if (loading && notifications.length === 0) return <div className="min-h-screen bg-[#121212] flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" size={40} /></div>;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="px-5 pt-6 pb-[120px] bg-[#121212] min-h-[100dvh] flex flex-col font-sans relative overflow-x-hidden" dir="rtl">
      
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[40%] bg-accent-primary/5 rounded-full blur-[120px]" />
      </div>

      <div className="flex justify-between items-center mb-8 relative z-10">
        <h1 className="text-2xl font-black text-white tracking-[0.2em] uppercase">פעילות</h1>
        <button
          onClick={() => { triggerFeedback('pop'); setShowGlobalActions(true); }}
          className="w-12 h-12 flex items-center justify-center bg-[#1a1a1e] border border-white/5 rounded-full text-[#8b8b93] hover:text-white hover:bg-white/5 shadow-sm active:scale-95 transition-all"
        >
          <MoreHorizontal size={22} />
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-3 relative z-10">
        <AnimatePresence mode="popLayout">
          {notifications.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center opacity-50 mt-20">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 shadow-inner border border-white/5">
                <Bell size={40} className="text-[#8b8b93]" strokeWidth={1.5} />
              </div>
              <p className="font-black text-[#8b8b93] uppercase tracking-[0.2em] text-[13px]">אין התראות עדיין</p>
            </motion.div>
          ) : (
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex flex-col gap-4">
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
                    className={`p-5 rounded-[28px] border flex items-start gap-4 transition-all cursor-pointer active:scale-[0.98] ${
                      isUnread
                        ? 'bg-accent-primary/5 border-accent-primary/20 shadow-sm'
                        : 'bg-[#1a1a1e] border-white/5 opacity-80 hover:bg-white/5'
                    }`}
                  >
                    {/* עמודה ימנית: פרופיל עגול נקי ולחיץ למעבר לפרופיל */}
                    <div 
                      className="relative shrink-0 mt-1 cursor-pointer active:scale-95 transition-transform"
                      onClick={(e) => {
                        e.stopPropagation();
                        const actorId = getActorIdFromNotification(notif);
                        if (actorId) {
                          triggerFeedback('pop');
                          navigate(`/profile/${actorId}`);
                        }
                      }}
                    >
                      <div className="w-14 h-14 rounded-full overflow-hidden bg-[#121212] border border-white/5 flex items-center justify-center shadow-inner hover:opacity-80 transition-opacity">
                        {actor?.avatar_url ? (
                          <img src={actor.avatar_url} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[#8b8b93] font-black text-xl">{(actor?.full_name || notif.title || 'א')[0]}</span>
                        )}
                      </div>
                    </div>

                    {/* עמודה שמאלית: תוכן ותאריך בפינה למטה משמאל */}
                    <div className="flex-1 min-w-0 flex flex-col pt-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`font-black text-[15px] truncate ${isUnread ? 'text-white' : 'text-[#8b8b93]'}`}>
                          {actor?.full_name || notif.title}
                        </span>
                        {isUnread && (
                          <span className="text-[9px] font-black text-accent-primary bg-accent-primary/10 border border-accent-primary/20 px-2.5 py-1 rounded-md uppercase tracking-[0.2em] shadow-sm shrink-0">
                            חדש
                          </span>
                        )}
                      </div>
                      <p className={`text-[13px] leading-relaxed line-clamp-2 ${isUnread ? 'text-white/90 font-medium' : 'text-[#8b8b93] font-medium'}`}>
                        {notif.content}
                      </p>
                      
                      {/* תאריך מיושר לשמאל */}
                      <span className="text-[#8b8b93]/60 text-[10px] font-bold uppercase tracking-widest mt-2.5 block text-left" dir="ltr">
                        {new Date(notif.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* אפשרויות (More) */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveMenuNotif(notif); }}
                      className="p-2 -mr-2 text-[#8b8b93] hover:text-white transition-colors self-start mt-1 active:scale-90"
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
              <button onClick={handleRefresh} className="w-full flex items-center gap-4 p-4 rounded-[24px] bg-[#1a1a1e] hover:bg-white/5 border border-white/5 active:scale-[0.98] transition-all shadow-sm">
                <div className="w-12 h-12 rounded-[18px] bg-white/5 flex items-center justify-center shrink-0 border border-white/5"><RefreshCw size={20} className="text-white" /></div>
                <span className="flex-1 text-right text-white text-[15px] font-black tracking-wide">רענן התראות</span>
              </button>
              {unreadExists && (
                <button onClick={markAllAsRead} disabled={busyId === 'mark-all'} className="w-full flex items-center gap-4 p-4 rounded-[24px] bg-[#1a1a1e] hover:bg-white/5 border border-white/5 active:scale-[0.98] transition-all shadow-sm">
                  <div className="w-12 h-12 rounded-[18px] bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center shrink-0"><CheckCheck size={20} className="text-accent-primary" /></div>
                  <span className="flex-1 text-right text-white text-[15px] font-black tracking-wide">סמן הכל כנקרא</span>
                </button>
              )}
              {readExists && (
                <button onClick={deleteAllRead} disabled={busyId === 'delete-all'} className="w-full flex items-center gap-4 p-4 rounded-[24px] bg-[#1a1a1e] hover:bg-white/5 border border-rose-500/10 active:scale-[0.98] transition-all shadow-sm">
                  <div className="w-12 h-12 rounded-[18px] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0"><Trash2 size={20} className="text-rose-500" /></div>
                  <span className="flex-1 text-right text-rose-500 text-[15px] font-black tracking-wide">מחק את כל ההתראות שנקראו</span>
                </button>
              )}
            </div>
          </BottomSheet>

          {activeMenuNotif && (
            <BottomSheet open={!!activeMenuNotif} onClose={() => setActiveMenuNotif(null)}>
              <div className="flex flex-col gap-3">
                <button onClick={() => setReadState(activeMenuNotif, !activeMenuNotif.is_read)} className="w-full flex items-center gap-4 p-4 rounded-[24px] bg-[#1a1a1e] hover:bg-white/5 border border-white/5 active:scale-[0.98] transition-all shadow-sm">
                  <div className="w-12 h-12 rounded-[18px] bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
                    {activeMenuNotif.is_read ? <Circle size={20} className="text-[#8b8b93]" /> : <CheckCircle2 size={20} className="text-accent-primary" />}
                  </div>
                  <span className="flex-1 text-right text-white text-[15px] font-black tracking-wide">{activeMenuNotif.is_read ? 'סמן כלא נקראה' : 'סמן כנקראה'}</span>
                </button>
                <button onClick={() => { setActiveMenuNotif(null); navigate(`/profile/${getActorIdFromNotification(activeMenuNotif)}`); }} className="w-full flex items-center gap-4 p-4 rounded-[24px] bg-[#1a1a1e] hover:bg-white/5 border border-white/5 active:scale-[0.98] transition-all shadow-sm">
                  <div className="w-12 h-12 rounded-[18px] bg-white/5 flex items-center justify-center shrink-0 border border-white/5"><UserCircle size={20} className="text-white" /></div>
                  <span className="flex-1 text-right text-white text-[15px] font-black tracking-wide">מעבר לפרופיל</span>
                </button>
                {activeMenuNotif.action_url && (
                  <button onClick={() => { triggerFeedback('pop'); setActiveMenuNotif(null); navigate(activeMenuNotif.action_url); }} className="w-full flex items-center gap-4 p-4 rounded-[24px] bg-[#1a1a1e] hover:bg-white/5 border border-white/5 active:scale-[0.98] transition-all shadow-sm">
                    <div className="w-12 h-12 rounded-[18px] bg-white/5 flex items-center justify-center shrink-0 border border-white/5"><ExternalLink size={20} className="text-white" /></div>
                    <span className="flex-1 text-right text-white text-[15px] font-black tracking-wide">פתח יעד ההתראה</span>
                  </button>
                )}
                <button onClick={() => deleteNotification(activeMenuNotif.id)} className="w-full flex items-center gap-4 p-4 rounded-[24px] bg-[#1a1a1e] hover:bg-white/5 border border-rose-500/10 active:scale-[0.98] transition-all shadow-sm">
                  <div className="w-12 h-12 rounded-[18px] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0"><Trash2 size={20} className="text-rose-500" /></div>
                  <span className="flex-1 text-right text-rose-500 text-[15px] font-black tracking-wide">מחק התראה זו</span>
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
