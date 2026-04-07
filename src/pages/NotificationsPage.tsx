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
  RefreshCw,
  X
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
  return (
    notif?.actor_id ||
    notif?.sender_id ||
    notif?.from_user_id ||
    notif?.initiator_id ||
    notif?.profile_id ||
    notif?.target_user_id ||
    null
  );
};

const extractProfileTargetFromActionUrl = (actionUrl?: string | null): string | null => {
  if (!actionUrl) return null;
  const match = actionUrl.match(/\/profile\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
};

const parseActorNameFromNotification = (notif: any): string | null => {
  const candidates = [notif?.content, notif?.title].filter(Boolean);
  const patterns = [
    /^(.+?)\s+הגיב\/ה/u,
    /^(.+?)\s+אהב\/ה/u,
    /^(.+?)\s+עקב\/ה/u,
    /^(.+?)\s+שלח\/ה/u,
    /^(.+?)\s+צפה\/תה/u,
    /^(.+?)\s+הזמין\/ה/u,
    /^(.+?)\s+הצטרף\/ה/u,
  ];

  for (const text of candidates) {
    for (const pattern of patterns) {
      const match = String(text).match(pattern);
      if (match?.[1]) return match[1].trim();
    }
  }

  return null;
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
  const [busyId, setBusyId] = useState<string | number | null>(null);

  const unreadExists = useMemo(() => notifications.some((n) => !n.is_read), [notifications]);
  const readExists = useMemo(() => notifications.some((n) => n.is_read), [notifications]);

  useEffect(() => {
    setMounted(true);
    setPortalNode(document.getElementById('root') || document.body);
  }, []);

  const enrichActorProfiles = useCallback(async (list: any[]) => {
    const actorIds = Array.from(new Set(list.map(getActorIdFromNotification).filter(Boolean))) as string[];

    if (actorIds.length === 0) {
      setActorProfiles({});
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', actorIds);

      if (error) throw error;

      const map: Record<string, ActorProfile> = {};
      data?.forEach((profile: any) => {
        map[profile.id] = profile;
      });

      setActorProfiles(map);
    } catch (err) {
      console.error('enrichActorProfiles error:', err);
    }
  }, []);

  const fetchNotifs = useCallback(
    async (markAsRead = true) => {
      if (!user?.id) {
        setNotifications([]);
        setActorProfiles({});
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const safeData = Array.isArray(data) ? data : [];
        setNotifications(safeData);
        await enrichActorProfiles(safeData);

        if (markAsRead && safeData.some((n) => !n.is_read)) {
          await markNotificationsRead();
        } else {
          await checkUnread(user.id);
        }
      } catch (err) {
        console.error('fetchNotifs error:', err);
      } finally {
        setLoading(false);
      }
    },
    [user?.id, markNotificationsRead, checkUnread, enrichActorProfiles]
  );

  useEffect(() => {
    fetchNotifs(true);
  }, [fetchNotifs]);

  useEffect(() => {
    if (!user?.id) return;

    if (channelRef.current) supabase.removeChannel(channelRef.current);

    channelRef.current = supabase
      .channel(`notifications_page_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') triggerFeedback('success');
          await fetchNotifs(false);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [user?.id, fetchNotifs]);

  const resolveProfileTarget = useCallback(
    async (notif: any): Promise<string | null> => {
      const actorId = getActorIdFromNotification(notif);

      if (actorId) {
        const actor = actorProfiles[actorId];
        if (actor?.username) return actor.username;
        if (actor?.id) return actor.id;
        return actorId;
      }

      if (notif?.actor_username) return notif.actor_username;
      if (notif?.from_username) return notif.from_username;
      if (notif?.username) return notif.username;

      const fromAction = extractProfileTargetFromActionUrl(notif?.action_url);
      if (fromAction) return fromAction;

      const parsedName = parseActorNameFromNotification(notif);
      if (parsedName) {
        const { data } = await supabase
          .from('profiles')
          .select('id, username')
          .or(`full_name.ilike.%${parsedName}%,username.ilike.%${parsedName}%`)
          .limit(1);

        if (data?.[0]) return data[0].username || data[0].id;
      }

      return user?.id || null;
    },
    [actorProfiles, user?.id]
  );

  const navigateToActorProfile = useCallback(
    async (notif: any) => {
      const target = await resolveProfileTarget(notif);

      if (!target) {
        triggerFeedback('error');
        toast.error('הפרופיל לא נמצא');
        return;
      }

      triggerFeedback('pop');
      setActiveMenuNotif(null);
      navigate(`/profile/${target}`);
    },
    [resolveProfileTarget, navigate]
  );

  const handleRefresh = async () => {
    triggerFeedback('pop');
    setActiveMenuNotif(null);
    setLoading(true);
    await fetchNotifs(true);
  };

  const handleNotifClick = async (notif: any) => {
    triggerFeedback('pop');

    if (!notif.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)));
      if (user?.id) await checkUnread(user.id);
    }

    if (notif.action_url) {
      navigate(notif.action_url);
      return;
    }

    await navigateToActorProfile(notif);
  };

  const setNotificationReadState = async (notif: any, nextReadState: boolean) => {
    setBusyId(notif.id);
    try {
      await supabase.from('notifications').update({ is_read: nextReadState }).eq('id', notif.id);
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: nextReadState } : n)));
      if (user?.id) await checkUnread(user.id);
      toast.success(nextReadState ? 'סומן כנקראה' : 'סומן כלא נקראה');
    } catch {
      toast.error('שגיאה בעדכון ההתראה');
    } finally {
      setBusyId(null);
      setActiveMenuNotif(null);
    }
  };

  const deleteNotification = async (notifId: string | number) => {
    setBusyId(notifId);
    try {
      await supabase.from('notifications').delete().eq('id', notifId);
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
      if (user?.id) await checkUnread(user.id);
      toast.success('ההתראה נמחקה');
    } catch {
      toast.error('שגיאה במחיקת ההתראה');
    } finally {
      setBusyId(null);
      setActiveMenuNotif(null);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;

    setBusyId('mark-all-read');
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      await checkUnread(user.id);
      toast.success('הכל סומן כנקרא');
    } catch {
      toast.error('שגיאה בעדכון');
    } finally {
      setBusyId(null);
    }
  };

  const deleteAllReadNotifications = async () => {
    if (!user?.id) return;

    setBusyId('delete-read-all');
    try {
      await supabase.from('notifications').delete().eq('user_id', user.id).eq('is_read', true);
      setNotifications((prev) => prev.filter((n) => !n.is_read));
      await checkUnread(user.id);
      toast.success('כל ההתראות שנקראו נמחקו');
    } catch {
      toast.error('שגיאה במחיקת ההתראות');
    } finally {
      setBusyId(null);
      setActiveMenuNotif(null);
    }
  };

  const stopPropagation = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    e.stopPropagation();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-surface flex items-center justify-center z-50">
        <Loader2 className="animate-spin text-accent-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-5 pb-32 bg-surface min-h-screen flex flex-col font-sans" dir="rtl">
      
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-6 px-1 z-10">
        <h1 className="text-2xl font-black text-brand tracking-tighter">התראות</h1>
        <div className="flex gap-3">
          {unreadExists && (
            <button onClick={markAllAsRead} disabled={busyId === 'mark-all-read'} className="text-brand-muted hover:text-brand active:scale-95 transition-all flex items-center justify-center p-2 bg-surface-card rounded-full border border-surface-border">
              {busyId === 'mark-all-read' ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />}
            </button>
          )}
          {readExists && (
            <button onClick={deleteAllReadNotifications} disabled={busyId === 'delete-read-all'} className="text-red-500 hover:text-red-400 active:scale-95 transition-all flex items-center justify-center p-2 bg-surface-card rounded-full border border-surface-border">
              {busyId === 'delete-read-all' ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-3 relative z-10">
        <AnimatePresence mode="popLayout">
          {notifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center pb-20 opacity-80"
            >
              <motion.div
                animate={{ rotate: [0, -12, 12, -8, 8, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut', repeatDelay: 1 }}
                className="w-24 h-24 rounded-full bg-surface-card border border-surface-border flex items-center justify-center mb-6 shadow-sm"
              >
                <Bell size={36} className="text-brand-muted" />
              </motion.div>
              <p className="font-black text-brand-muted uppercase tracking-widest text-[13px]">
                אין התראות חדשות
              </p>
            </motion.div>
          ) : (
            notifications.map((notif) => {
              const actorId = getActorIdFromNotification(notif);
              const actor = actorId ? actorProfiles[actorId] : null;

              return (
                <motion.div
                  key={notif.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => handleNotifClick(notif)}
                  className={`relative p-4 rounded-[24px] transition-all cursor-pointer flex items-center gap-4 ${
                    notif.is_read
                      ? 'bg-surface border border-surface-border opacity-70'
                      : 'bg-surface-card border border-accent-primary/40 shadow-sm active:scale-[0.985]'
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigateToActorProfile(notif);
                    }}
                    className="w-12 h-12 rounded-full overflow-hidden bg-surface border border-surface-border shrink-0 active:scale-95 transition-transform z-10 relative flex items-center justify-center"
                  >
                    {actor?.avatar_url ? (
                      <img src={actor.avatar_url} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-brand-muted font-black text-lg">{(actor?.full_name || notif.title || 'א')[0]}</span>
                    )}
                  </button>

                  <div className="flex-1 min-w-0 flex flex-col text-right">
                    <div className="flex items-center justify-between mb-1 gap-3">
                      <span className="text-brand font-black text-[14px] truncate">
                        {actor?.full_name || notif.title}
                      </span>
                      {!notif.is_read && (
                        <span className="text-[9px] font-black text-accent-primary bg-accent-primary/10 border border-accent-primary/20 px-2 py-0.5 rounded-md shrink-0 uppercase tracking-widest">
                          חדש
                        </span>
                      )}
                    </div>

                    <p className={`text-[13px] leading-relaxed line-clamp-2 pr-1 ${notif.is_read ? 'text-brand-muted font-medium' : 'text-brand font-bold'}`}>
                      {notif.content}
                    </p>

                    <div className="flex items-center justify-between mt-2 text-brand-muted text-[10px] font-bold">
                      <span className="tracking-widest uppercase">
                        {new Date(notif.created_at).toLocaleDateString('he-IL', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {actor?.username && <span dir="ltr">@{actor.username}</span>}
                    </div>
                  </div>

                  {/* Options Button inside the card aligned to left */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActiveMenuNotif(notif);
                    }}
                    className="w-8 h-8 flex items-center justify-center shrink-0 text-brand-muted hover:text-brand hover:bg-white/5 active:scale-90 transition-all rounded-full z-10 ml-1"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {mounted && portalNode && createPortal(
        <AnimatePresence>
          {activeMenuNotif && (
            <div
              className="fixed inset-0 z-[999999] flex flex-col justify-end"
              dir="rtl"
              onTouchStart={stopPropagation}
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={() => setActiveMenuNotif(null)}
              />

              <motion.div
                drag="y"
                dragControls={menuDragControls}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.22}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 120 || info.velocity.y > 700) {
                    setActiveMenuNotif(null);
                  }
                }}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 380 }}
                onPointerDownCapture={(e) => menuDragControls.start(e)}
                className="relative z-10 bg-surface rounded-t-[40px] p-6 pb-[calc(env(safe-area-inset-bottom)+28px)] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border max-h-[85vh] overflow-y-auto scrollbar-hide touch-pan-y"
                style={{ touchAction: 'pan-y' }}
              >
                <div className="w-full py-2 mb-6 flex justify-center">
                  <div className="w-16 h-1.5 bg-white/10 rounded-full" />
                </div>

                <div className="flex flex-col gap-2">
                  
                  <button
                    onClick={() => setNotificationReadState(activeMenuNotif, !activeMenuNotif.is_read)}
                    className="w-full flex items-center gap-4 p-4 rounded-[22px] bg-surface-card border border-surface-border hover:bg-white/5 active:scale-[0.98] transition-all shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-full bg-surface border border-surface-border flex items-center justify-center shrink-0">
                      {activeMenuNotif.is_read ? (
                        <Circle size={16} className="text-brand-muted" />
                      ) : (
                        <CheckCircle2 size={16} className="text-accent-primary" />
                      )}
                    </div>
                    <span className="flex-1 text-right text-brand text-[15px] font-black">
                      {activeMenuNotif.is_read ? 'סמן כלא נקראה' : 'סמן כנקראה'}
                    </span>
                  </button>

                  <button
                    onClick={() => navigateToActorProfile(activeMenuNotif)}
                    className="w-full flex items-center gap-4 p-4 rounded-[22px] bg-surface-card border border-surface-border hover:bg-white/5 active:scale-[0.98] transition-all shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-full bg-surface border border-surface-border flex items-center justify-center shrink-0">
                      <UserCircle size={16} className="text-brand-muted" />
                    </div>
                    <span className="flex-1 text-right text-brand text-[15px] font-black">
                      מעבר לפרופיל המשתמש
                    </span>
                  </button>

                  {activeMenuNotif.action_url && (
                    <button
                      onClick={() => {
                        triggerFeedback('pop');
                        setActiveMenuNotif(null);
                        navigate(activeMenuNotif.action_url);
                      }}
                      className="w-full flex items-center gap-4 p-4 rounded-[22px] bg-surface-card border border-surface-border hover:bg-white/5 active:scale-[0.98] transition-all shadow-sm"
                    >
                      <div className="w-10 h-10 rounded-full bg-surface border border-surface-border flex items-center justify-center shrink-0">
                        <ExternalLink size={16} className="text-brand-muted" />
                      </div>
                      <span className="flex-1 text-right text-brand text-[15px] font-black">
                        פתח יעד ההתראה
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => deleteNotification(activeMenuNotif.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-[22px] bg-surface-card border border-red-500/30 hover:bg-red-500/10 active:scale-[0.98] transition-all mt-2 shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-full bg-surface border border-surface-border flex items-center justify-center shrink-0">
                      {busyId === activeMenuNotif.id ? (
                        <Loader2 size={16} className="animate-spin text-red-500" />
                      ) : (
                        <Trash2 size={16} className="text-red-500" />
                      )}
                    </div>
                    <span className="flex-1 text-right text-red-500 text-[15px] font-black">
                      מחק התראה זו
                    </span>
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
