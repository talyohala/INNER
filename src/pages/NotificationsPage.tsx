import React, { useEffect, useState, useCallback, useRef } from 'react';
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
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { triggerFeedback } from '../lib/sound';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const { user, markNotificationsRead, checkUnread } = useAuth();

  const channelRef = useRef<any>(null);

  const fetchNotifs = useCallback(async (markAsRead = true) => {
    if (!user?.id) {
      setNotifications([]);
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
  }, [user?.id, markNotificationsRead, checkUnread]);

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

  const handleNotifClick = async (notif: any) => {
    triggerFeedback('pop');

    if (!notif.is_read) {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notif.id);

        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );

        if (user?.id) {
          await checkUnread(user.id);
        }
      } catch (err) {
        console.error('handleNotifClick mark read error:', err);
      }
    }

    if (notif.action_url) {
      navigate(notif.action_url);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return {
          Icon: Heart,
          color: 'text-[#e91e63]',
          bg: 'bg-[#e91e63]/10',
          border: 'border-[#e91e63]/20',
        };
      case 'comment':
        return {
          Icon: MessageSquare,
          color: 'text-[#2196f3]',
          bg: 'bg-[#2196f3]/10',
          border: 'border-[#2196f3]/20',
        };
      case 'follow':
        return {
          Icon: UserPlus,
          color: 'text-[#8bc34a]',
          bg: 'bg-[#8bc34a]/10',
          border: 'border-[#8bc34a]/20',
        };
      case 'wallet':
        return {
          Icon: Wallet,
          color: 'text-[#10b981]',
          bg: 'bg-[#10b981]/10',
          border: 'border-[#10b981]/20',
        };
      case 'store':
        return {
          Icon: ShoppingBag,
          color: 'text-[#9c27b0]',
          bg: 'bg-[#9c27b0]/10',
          border: 'border-[#9c27b0]/20',
        };
      case 'gift':
        return {
          Icon: Gift,
          color: 'text-[#ff9800]',
          bg: 'bg-[#ff9800]/10',
          border: 'border-[#ff9800]/20',
        };
      default:
        return {
          Icon: Activity,
          color: 'text-white/50',
          bg: 'bg-white/5',
          border: 'border-white/10',
        };
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-12 pb-32 bg-[#0A0A0A] min-h-screen flex flex-col font-sans" dir="rtl">
      <div className="flex items-center justify-between mb-10 px-2">
        <div className="w-11" />
        <h1 className="text-3xl font-black text-white tracking-tighter drop-shadow-md">התראות</h1>
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
              const { Icon, color, bg, border } = getIcon(notif.type);

              return (
                <motion.div
                  key={notif.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => handleNotifClick(notif)}
                  className={`p-4 flex gap-4 items-center rounded-[24px] border transition-all cursor-pointer ${
                    notif.is_read
                      ? 'bg-transparent border-white/5 opacity-50'
                      : 'bg-white/[0.04] border-white/10 shadow-[0_8px_20px_rgba(0,0,0,0.4)] active:scale-[0.98]'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-[16px] ${bg} flex items-center justify-center shrink-0 border ${border} shadow-inner`}>
                    <Icon size={24} className={color} />
                  </div>

                  <div className="flex flex-col flex-1 text-right min-w-0">
                    <span className="text-white font-black text-[15px] truncate drop-shadow-sm">{notif.title}</span>
                    <p className="text-white/60 text-[13px] line-clamp-2 leading-relaxed mt-0.5">{notif.content}</p>
                    <span className="text-white/30 text-[9px] font-bold mt-2 tracking-widest uppercase">
                      {new Date(notif.created_at).toLocaleDateString('he-IL', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
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
