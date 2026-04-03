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
  ChevronLeft,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { triggerFeedback } from '../lib/sound';

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

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [actorProfiles, setActorProfiles] = useState<Record<string, ActorProfile>>({});
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const { user, markNotificationsRead, checkUnread } = useAuth();

  const channelRef = useRef<any>(null);

  const enrichActorProfiles = useCallback(async (list: any[]) => {
    const actorIds = Array.from(
      new Set(
        list
          .map((n) => getActorIdFromNotification(n))
          .filter(Boolean)
      )
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

  const fetchNotifs = useCallback(async (markAsRead = true) => {
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
  }, [user?.id, markNotificationsRead, checkUnread, enrichActorProfiles]);

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

  const handleRefresh = async () => {
    triggerFeedback('pop');
    setLoading(true);
    await fetchNotifs(true);
  };

  const handleProfileNav = async (notif: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const actorId = getActorIdFromNotification(notif);
    if (!actorId) return;

    triggerFeedback('pop');

    if (!notif.is_read) {
      try {
        await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
        setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)));
        if (user?.id) await checkUnread(user.id);
      } catch (err) {
        console.error('handleProfileNav mark read error:', err);
      }
    }

    navigate(`/profile/${actorId}`);
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

    const actorId = getActorIdFromNotification(notif);
    if (actorId) {
      navigate(`/profile/${actorId}`);
    }
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
        <div className="w-11" />
        <div className="flex flex-col items-center">
          <h1 className="text-3xl font-black text-white tracking-tighter drop-shadow-md">התראות</h1>
          {unreadExists && (
            <span className="text-[10px] font-black text-red-400 tracking-[0.2em] uppercase mt-1">חדש</span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          className="w-11 h-11 flex items-center justify-center bg-white/5 border border-white/10 rounded-[16px] active:scale-90 transition-transform shadow-inner"
        >
          <CheckCheck size={20} className="text-white/60" />
        </button>
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
              const { Icon, color } = getIcon(notif.type);
              const actorId = getActorIdFromNotification(notif);
              const actor = actorId ? actorProfiles[actorId] : null;

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
                    onClick={(e) => handleProfileNav(notif, e)}
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
                      <button
                        onClick={(e) => handleProfileNav(notif, e)}
                        className="text-white/90 font-black text-[14px] truncate hover:text-white transition-colors"
                      >
                        {actor?.full_name || notif.title}
                      </button>

                      {!notif.is_read && (
                        <span className="text-[9px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full shrink-0">
                          חדש
                        </span>
                      )}
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
                        <Icon size={18} className={color} />
                        <ChevronLeft size={14} className="text-white/20" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
