import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  Heart,
  Gift,
  MessageSquare,
  Bell,
  UserPlus,
  CheckCheck,
  Wallet,
  ShoppingBag,
  Activity,
  UserCircle,
  MoreHorizontal,
  Trash2,
  Circle,
  CheckCircle2,
  ExternalLink,
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
    null
  );
};

const extractProfileTargetFromActionUrl = (actionUrl?: string | null): string | null => {
  if (!actionUrl) return null;

  const match = actionUrl.match(/\/profile\/([^/?#]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);

  return null;
};

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [actorProfiles, setActorProfiles] = useState<Record<string, ActorProfile>>({});
  const [loading, setLoading] = useState(true);
  const [activeMenuNotif, setActiveMenuNotif] = useState<any | null>(null);
  const [busyId, setBusyId] = useState<string | number | null>(null);

  const navigate = useNavigate();
  const { user, markNotificationsRead, checkUnread } = useAuth();

  const channelRef = useRef<any>(null);

  const enrichActorProfiles = useCallback(async (list: any[]) => {
    const actorIds = Array.from(
      new Set(list.map((n) => getActorIdFromNotification(n)).filter(Boolean))
    ) as string[];

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
      (data || []).forEach((profile: any) => {
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

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
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
          if (payload.eventType === 'INSERT') {
            triggerFeedback('success');
          }
          await fetchNotifs(false);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, fetchNotifs]);

  const getProfileTarget = useCallback(
    (notif: any): string | null => {
      const actorId = getActorIdFromNotification(notif);
      const actor = actorId ? actorProfiles[actorId] : null;

      return (
        actor?.username ||
        actor?.id ||
        notif?.actor_username ||
        notif?.from_username ||
        notif?.username ||
        extractProfileTargetFromActionUrl(notif?.action_url) ||
        actorId ||
        null
      );
    },
    [actorProfiles]
  );

  const navigateToActorProfile = useCallback(
    async (notif: any) => {
      const target = getProfileTarget(notif);
      if (!target) {
        toast.error('לא נמצא פרופיל למעבר');
        return;
      }

      triggerFeedback('pop');
      navigate(`/profile/${target}`);
    },
    [getProfileTarget, navigate]
  );

  const handleRefresh = async () => {
    triggerFeedback('pop');
    setLoading(true);
    await fetchNotifs(true);
  };

  const setNotificationReadState = async (notif: any, nextReadState: boolean) => {
    try {
      setBusyId(notif.id);

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: nextReadState })
        .eq('id', notif.id);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: nextReadState } : n))
      );

      if (user?.id) {
        await checkUnread(user.id);
      }

      toast.success(nextReadState ? 'סומן כנקראה' : 'סומן כלא נקראה');
    } catch (err) {
      console.error('setNotificationReadState error:', err);
      toast.error('שגיאה בעדכון ההתראה');
    } finally {
      setBusyId(null);
      setActiveMenuNotif(null);
    }
  };

  const deleteNotification = async (notifId: string | number) => {
    try {
      setBusyId(notifId);

      const { error } = await supabase.from('notifications').delete().eq('id', notifId);
      if (error) throw error;

      setNotifications((prev) => prev.filter((n) => n.id !== notifId));

      if (user?.id) {
        await checkUnread(user.id);
      }

      toast.success('ההתראה נמחקה');
    } catch (err) {
      console.error('deleteNotification error:', err);
      toast.error('שגיאה במחיקת ההתראה');
    } finally {
      setBusyId(null);
      setActiveMenuNotif(null);
    }
  };

  const deleteAllReadNotifications = async () => {
    if (!user?.id) return;

    try {
      setBusyId('delete-read-all');

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('is_read', true);

      if (error) throw error;

      setNotifications((prev) => prev.filter((n) => !n.is_read));
      await checkUnread(user.id);
      toast.success('כל ההתראות שנקראו נמחקו');
    } catch (err) {
      console.error('deleteAllReadNotifications error:', err);
      toast.error('שגיאה במחיקת ההתראות');
    } finally {
      setBusyId(null);
      setActiveMenuNotif(null);
    }
  };

  const handleNotifClick = async (notif: any) => {
    triggerFeedback('pop');

    if (!notif.is_read) {
      try {
        await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
        setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)));
        if (user?.id) await checkUnread(user.id);
      } catch (err) {
        console.error('handleNotifClick mark read error:', err);
      }
    }

    if (notif.action_url) {
      navigate(notif.action_url);
      return;
    }

    await navigateToActorProfile(notif);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return { Icon: Heart, color: 'text-[#e91e63]' };
      case 'comment':
        return { Icon: MessageSquare, color: 'text-[#2196f3]' };
      case 'follow':
        return { Icon: UserPlus, color: 'text-[#8bc34a]' };
      case 'wallet':
        return { Icon: Wallet, color: 'text-[#10b981]' };
      case 'store':
        return { Icon: ShoppingBag, color: 'text-[#9c27b0]' };
      case 'gift':
        return { Icon: Gift, color: 'text-[#ff9800]' };
      default:
        return { Icon: Activity, color: 'text-white/50' };
    }
  };

  const unreadExists = useMemo(() => notifications.some((n) => !n.is_read), [notifications]);
  const readExists = useMemo(() => notifications.some((n) => n.is_read), [notifications]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-12 pb-32 bg-[#0A0A0A] min-h-screen flex flex-col font-sans" dir="rtl">
      <div className="flex items-center justify-between mb-8 px-2">
        <button
          onClick={handleRefresh}
          className="w-11 h-11 flex items-center justify-center bg-white/5 border border-white/10 rounded-[16px] active:scale-90 transition-transform shadow-inner"
        >
          <CheckCheck size={20} className="text-white/60" />
        </button>

        <div className="flex flex-col items-center">
          <h1 className="text-3xl font-black text-white tracking-tighter drop-shadow-md">התראות</h1>
          {unreadExists && (
            <span className="text-[10px] font-black text-red-400 tracking-[0.2em] uppercase mt-1">חדש</span>
          )}
        </div>

        <div className="w-11" />
      </div>

      <div className="flex-1 flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {notifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center pb-20 opacity-80"
            >
              <motion.div
                animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut', repeatDelay: 1 }}
                className="w-24 h-24 rounded-[32px] bg-white/[0.03] border border-white/10 flex items-center justify-center mb-6 shadow-2xl"
              >
                <Bell size={40} className="text-white/20" />
              </motion.div>
              <p className="font-black text-white/30 uppercase tracking-widest text-[13px]">הכל שקט בינתיים</p>
            </motion.div>
          ) : (
            notifications.map((notif) => {
              const actorId = getActorIdFromNotification(notif);
              const actor = actorId ? actorProfiles[actorId] : null;
              const { Icon, color } = getIcon(notif.type);

              return (
                <motion.div
                  key={notif.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => handleNotifClick(notif)}
                  className={`p-4 flex items-center gap-3 rounded-[24px] border transition-all cursor-pointer ${
                    notif.is_read
                      ? 'bg-transparent border-white/5 opacity-60'
                      : 'bg-white/[0.04] border-white/10 shadow-[0_8px_20px_rgba(0,0,0,0.4)] active:scale-[0.985]'
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateToActorProfile(notif);
                    }}
                    className="w-12 h-12 rounded-full overflow-hidden bg-black/30 border border-white/10 shrink-0 active:scale-95 transition-transform"
                  >
                    {actor?.avatar_url ? (
                      <img src={actor.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                      <UserCircle className="w-full h-full p-2 text-white/30" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0 text-right">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-2 shrink-0">
                        {!notif.is_read && (
                          <span className="text-[9px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                            חדש
                          </span>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuNotif(notif);
                          }}
                          className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/10 active:scale-90"
                        >
                          <MoreHorizontal size={16} className="text-white/65" />
                        </button>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToActorProfile(notif);
                        }}
                        className="text-white/90 font-black text-[14px] truncate hover:text-white transition-colors"
                      >
                        {actor?.full_name || notif.title}
                      </button>
                    </div>

                    <p className="text-white/72 text-[13px] leading-relaxed line-clamp-2">
                      {notif.content}
                    </p>

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-white/25 text-[9px] font-bold tracking-widest uppercase">
                        {new Date(notif.created_at).toLocaleDateString('he-IL', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      <div className="flex items-center gap-2 shrink-0">
                        {actor?.username && (
                          <span className="text-white/30 text-[10px] font-bold" dir="ltr">
                            @{actor.username}
                          </span>
                        )}
                        <Icon size={17} className={color} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {activeMenuNotif && (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end" dir="rtl">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setActiveMenuNotif(null)}
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 260 }}
              className="relative z-10 bg-[#0A0A0A] border-t border-white/10 rounded-t-[34px] p-5 pb-[calc(env(safe-area-inset-bottom)+92px)] shadow-[0_-20px_40px_rgba(0,0,0,0.5)]"
            >
              <div className="w-full flex justify-center mb-4">
                <div className="w-14 h-1.5 bg-white/15 rounded-full" />
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setNotificationReadState(activeMenuNotif, !activeMenuNotif.is_read)}
                  className="w-full flex items-center gap-4 p-4 rounded-[22px] bg-white/5 border border-white/10 active:scale-[0.98] transition-all"
                >
                  <div className="w-11 h-11 rounded-[16px] bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    {activeMenuNotif.is_read ? (
                      <Circle size={18} className="text-white/75" />
                    ) : (
                      <CheckCircle2 size={18} className="text-green-400" />
                    )}
                  </div>
                  <div className="flex-1 text-right">
                    <div className="text-white text-[14px] font-black">
                      {activeMenuNotif.is_read ? 'סמן כלא נקראה' : 'סמן כנקראה'}
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => navigateToActorProfile(activeMenuNotif)}
                  className="w-full flex items-center gap-4 p-4 rounded-[22px] bg-white/5 border border-white/10 active:scale-[0.98] transition-all"
                >
                  <div className="w-11 h-11 rounded-[16px] bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <UserCircle size={18} className="text-white/75" />
                  </div>
                  <div className="flex-1 text-right">
                    <div className="text-white text-[14px] font-black">מעבר לפרופיל</div>
                  </div>
                </button>

                {activeMenuNotif.action_url && (
                  <button
                    onClick={() => {
                      triggerFeedback('pop');
                      setActiveMenuNotif(null);
                      navigate(activeMenuNotif.action_url);
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-[22px] bg-white/5 border border-white/10 active:scale-[0.98] transition-all"
                  >
                    <div className="w-11 h-11 rounded-[16px] bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <ExternalLink size={18} className="text-white/75" />
                    </div>
                    <div className="flex-1 text-right">
                      <div className="text-white text-[14px] font-black">פתח יעד ההתראה</div>
                    </div>
                  </button>
                )}

                {readExists && (
                  <button
                    onClick={deleteAllReadNotifications}
                    className="w-full flex items-center gap-4 p-4 rounded-[22px] bg-white/5 border border-white/10 active:scale-[0.98] transition-all"
                  >
                    <div className="w-11 h-11 rounded-[16px] bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      {busyId === 'delete-read-all' ? (
                        <Loader2 size={18} className="animate-spin text-white/75" />
                      ) : (
                        <Trash2 size={18} className="text-white/75" />
                      )}
                    </div>
                    <div className="flex-1 text-right">
                      <div className="text-white text-[14px] font-black">מחק את כל מה שנקרא</div>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => deleteNotification(activeMenuNotif.id)}
                  className="w-full flex items-center gap-4 p-4 rounded-[22px] bg-red-500/10 border border-red-500/20 active:scale-[0.98] transition-all"
                >
                  <div className="w-11 h-11 rounded-[16px] bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                    {busyId === activeMenuNotif.id ? (
                      <Loader2 size={18} className="animate-spin text-red-400" />
                    ) : (
                      <Trash2 size={18} className="text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 text-right">
                    <div className="text-red-400 text-[14px] font-black">מחק התראה</div>
                  </div>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
