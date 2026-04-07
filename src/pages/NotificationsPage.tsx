import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
  Loader2,
  Bell,
  CheckCheck,
  UserCircle,
  MoreHorizontal,
  Trash2,
  Circle,
  CheckCircle2,
  ExternalLink,
  RefreshCw
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

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, markNotificationsRead, checkUnread } = useAuth();
  const channelRef = useRef<any>(null);
  const menuDragControls = useDragControls();

  const [mounted, setMounted] = useState(false);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [actorProfiles, setActorProfiles] = useState<Record<string, ActorProfile>>({});
  const [loading, setLoading] = useState(true);
  const [activeMenuNotif, setActiveMenuNotif] = useState<any | null>(null);
  const [showGlobalActions, setShowGlobalActions] = useState(false);
  const [busyId, setBusyId] = useState<string | number | null>(null);

  const unreadExists = useMemo(() => notifications.some((n) => !n.is_read), [notifications]);
  const readExists = useMemo(() => notifications.some((n) => n.is_read), [notifications]);

  useEffect(() => {
    setMounted(true);
    setPortalNode(document.getElementById('root') || document.body);
  }, []);

  const enrichActorProfiles = useCallback(async (list: any[]) => {
    const actorIds = Array.from(new Set(list.map(getActorIdFromNotification).filter(Boolean))) as string[];
    if (actorIds.length === 0) return;
    try {
      const { data } = await supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', actorIds);
      const map: Record<string, ActorProfile> = {};
      data?.forEach((p) => { map[p.id] = p; });
      setActorProfiles(map);
    } catch (err) {}
  }, []);

  const fetchNotifs = useCallback(async (markAsRead = true) => {
    if (!user?.id) return;
    try {
      const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      const safeData = Array.isArray(data) ? data : [];
      setNotifications(safeData);
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
  };

  const handleNotifClick = async (notif: any) => {
    triggerFeedback('pop');
    if (!notif.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)));
      if (user?.id) await checkUnread(user.id);
    }
    if (notif.action_url) navigate(notif.action_url);
  };

  const setReadState = async (notif: any, state: boolean) => {
    setBusyId(notif.id);
    try {
      await supabase.from('notifications').update({ is_read: state }).eq('id', notif.id);
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: state } : n)));
      if (user?.id) await checkUnread(user.id);
      toast.success(state ? 'סומן כנקרא' : 'סומן כלא נקרא');
    } catch { toast.error('שגיאה'); } finally { setBusyId(null); setActiveMenuNotif(null); }
  };

  const deleteNotification = async (notifId: string | number) => {
    setBusyId(notifId);
    try {
      await supabase.from('notifications').delete().eq('id', notifId);
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
      toast.success('נמחק');
    } catch { toast.error('שגיאה'); } finally { setBusyId(null); setActiveMenuNotif(null); }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    setBusyId('mark-all');
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      await checkUnread(user.id);
      toast.success('הכל סומן כנקרא');
    } catch { toast.error('שגיאה'); } finally { setBusyId(null); setShowGlobalActions(false); }
  };

  const deleteAllRead = async () => {
    if (!user?.id) return;
    setBusyId('delete-all');
    try {
      await supabase.from('notifications').delete().eq('user_id', user.id).eq('is_read', true);
      setNotifications((prev) => prev.filter((n) => !n.is_read));
      toast.success('כל הנקראות נמחקו');
    } catch { toast.error('שגיאה'); } finally { setBusyId(null); setShowGlobalActions(false); }
  };

  if (loading) return <div className="fixed inset-0 bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" /></div>;

  return (
    <div className="px-4 pt-6 pb-32 bg-surface min-h-screen flex flex-col font-sans" dir="rtl">
      
      <div className="flex justify-end mb-4 px-1">
        <button 
          onClick={() => { triggerFeedback('pop'); setShowGlobalActions(true); }}
          className="w-10 h-10 flex items-center justify-center bg-surface-card border border-surface-border rounded-full text-brand-muted hover:text-brand transition-all"
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {notifications.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center opacity-60 mt-20">
              <Bell size={48} className="text-brand-muted mb-4" />
              <p className="font-black text-brand-muted uppercase tracking-widest text-[11px]">אין התראות</p>
            </div>
          ) : (
            notifications.map((notif) => {
              const actor = actorProfiles[getActorIdFromNotification(notif) || ''];
              return (
                <motion.div
                  key={notif.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => handleNotifClick(notif)}
                  className={`p-4 rounded-[24px] border flex items-center gap-4 ${notif.is_read ? 'bg-surface border-surface-border opacity-70' : 'bg-surface-card border-accent-primary/30 shadow-sm'}`}
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-surface border border-surface-border shrink-0 flex items-center justify-center">
                    {actor?.avatar_url ? <img src={actor.avatar_url} className="w-full h-full object-cover" /> : <span className="text-brand-muted font-black text-lg">{(actor?.full_name || notif.title || 'א')[0]}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-brand font-black text-[14px] truncate">{actor?.full_name || notif.title}</span>
                      {!notif.is_read && <span className="text-[8px] font-black text-accent-primary bg-accent-primary/10 border border-accent-primary/20 px-2 py-0.5 rounded-md uppercase">חדש</span>}
                    </div>
                    <p className={`text-[13px] leading-relaxed line-clamp-2 ${notif.is_read ? 'text-brand-muted font-medium' : 'text-brand font-bold'}`}>{notif.content}</p>
                    <span className="text-brand-muted text-[9px] font-bold uppercase tracking-widest mt-1 block">
                      {new Date(notif.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setActiveMenuNotif(notif); }} className="p-2 text-brand-muted hover:text-brand"><MoreHorizontal size={18} /></button>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {mounted && portalNode && createPortal(
        <AnimatePresence>
          {/* Global Actions Bottom Sheet */}
          {showGlobalActions && (
            <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowGlobalActions(false)} />
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 400 }} className="relative z-10 bg-surface rounded-t-[40px] p-6 pb-12 border-t border-surface-border">
                <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
                <div className="flex flex-col gap-3">
                  <button onClick={handleRefresh} className="w-full flex items-center gap-4 p-4 rounded-[22px] bg-surface-card border border-surface-border active:scale-95 transition-all">
                    <div className="w-10 h-10 rounded-full bg-surface border border-surface-border flex items-center justify-center shrink-0"><RefreshCw size={18} className="text-brand-muted" /></div>
                    <span className="flex-1 text-right text-brand text-[15px] font-black">רענן התראות</span>
                  </button>
                  {unreadExists && (
                    <button onClick={markAllAsRead} disabled={busyId === 'mark-all'} className="w-full flex items-center gap-4 p-4 rounded-[22px] bg-surface-card border border-surface-border active:scale-95 transition-all">
                      <div className="w-10 h-10 rounded-full bg-surface border border-surface-border flex items-center justify-center shrink-0"><CheckCheck size={18} className="text-accent-primary" /></div>
                      <span className="flex-1 text-right text-brand text-[15px] font-black">סמן הכל כנקרא</span>
                    </button>
                  )}
                  {readExists && (
                    <button onClick={deleteAllRead} disabled={busyId === 'delete-all'} className="w-full flex items-center gap-4 p-4 rounded-[22px] bg-surface-card border border-red-500/20 active:scale-95 transition-all">
                      <div className="w-10 h-10 rounded-full bg-surface border border-red-500/20 flex items-center justify-center shrink-0"><Trash2 size={18} className="text-red-500" /></div>
                      <span className="flex-1 text-right text-red-500 text-[15px] font-black">מחק את כל ההתראות שנקראו</span>
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          )}

          {/* Single Notif Bottom Sheet */}
          {activeMenuNotif && (
            <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setActiveMenuNotif(null)} />
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 400 }} className="relative z-10 bg-surface rounded-t-[40px] p-6 pb-12 border-t border-surface-border">
                <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
                <div className="flex flex-col gap-3">
                  <button onClick={() => setReadState(activeMenuNotif, !activeMenuNotif.is_read)} className="w-full flex items-center gap-4 p-4 rounded-[22px] bg-surface-card border border-surface-border active:scale-95 transition-all">
                    <div className="w-10 h-10 rounded-full bg-surface border border-surface-border flex items-center justify-center shrink-0">
                      {activeMenuNotif.is_read ? <Circle size={16} className="text-brand-muted" /> : <CheckCircle2 size={16} className="text-accent-primary" />}
                    </div>
                    <span className="flex-1 text-right text-brand text-[15px] font-black">{activeMenuNotif.is_read ? 'סמן כלא נקראה' : 'סמן כנקראה'}</span>
                  </button>
                  <button onClick={() => navigate(`/profile/${getActorIdFromNotification(activeMenuNotif)}`)} className="w-full flex items-center gap-4 p-4 rounded-[22px] bg-surface-card border border-surface-border active:scale-95 transition-all">
                    <div className="w-10 h-10 rounded-full bg-surface border border-surface-border flex items-center justify-center shrink-0"><UserCircle size={18} className="text-brand-muted" /></div>
                    <span className="flex-1 text-right text-brand text-[15px] font-black">מעבר לפרופיל</span>
                  </button>
                  {activeMenuNotif.action_url && (
                    <button onClick={() => { triggerFeedback('pop'); setActiveMenuNotif(null); navigate(activeMenuNotif.action_url); }} className="w-full flex items-center gap-4 p-4 rounded-[22px] bg-surface-card border border-surface-border active:scale-95 transition-all">
                      <div className="w-10 h-10 rounded-full bg-surface border border-surface-border flex items-center justify-center shrink-0"><ExternalLink size={18} className="text-brand-muted" /></div>
                      <span className="flex-1 text-right text-brand text-[15px] font-black">פתח יעד ההתראה</span>
                    </button>
                  )}
                  <button onClick={() => deleteNotification(activeMenuNotif.id)} className="w-full flex items-center gap-4 p-4 rounded-[22px] bg-surface-card border border-red-500/30 active:scale-95 transition-all">
                    <div className="w-10 h-10 rounded-full bg-surface border border-red-500/30 flex items-center justify-center shrink-0"><Trash2 size={18} className="text-red-500" /></div>
                    <span className="flex-1 text-right text-red-500 text-[15px] font-black">מחק התראה זו</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        portalNode
      )}
    </div>
  );
};
