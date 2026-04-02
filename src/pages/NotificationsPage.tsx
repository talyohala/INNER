import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import { 
  Bell, Loader2, Heart, Gift, MessageSquare, 
  UserPlus, ShieldAlert, Trash2, CheckCheck, UserCircle, MoreVertical, ExternalLink 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FadeIn } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
  action_url?: string;
  actor_id?: string;
  actor_profiles?: {
    full_name: string;
    avatar_url: string;
    username: string;
  };
}

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeMenuNotif, setActiveMenuNotif] = useState<Notification | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: scrollRef });
  const [showHeader, setShowHeader] = useState(true);
  const lastY = useRef(0);

  // הדר שנעלם בגלילה
  useMotionValueEvent(scrollY, "change", (latest) => {
    const diff = latest - lastY.current;
    if (Math.abs(diff) > 5) {
      if (diff > 0 && latest > 30) setShowHeader(false);
      else setShowHeader(true);
    }
    lastY.current = latest;
  });

  const fetchNotifs = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      setCurrentUserId(authData.user.id);

      // שולף התראות יחד עם פרטי המשתמש שעשה את הפעולה
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          actor_profiles:profiles!notifications_actor_id_fkey(full_name, avatar_url, username)
        `)
        .eq('user_id', authData.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
      
      // מסמן כנקרא
      if (data && data.some(n => !n.is_read)) {
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', authData.user.id).eq('is_read', false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();

    // האזנה בזמן אמת (Realtime) להתראות חדשות
    const channel = supabase.channel('realtime_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        if (currentUserId && payload.new.user_id === currentUserId) {
          fetchNotifs(); // רענון כדי למשוך את תמונת הפרופיל של ה-actor
          triggerFeedback('pop');
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  const deleteNotification = async (id: string) => {
    triggerFeedback('error');
    setNotifications(prev => prev.filter(n => n.id !== id));
    await supabase.from('notifications').delete().eq('id', id);
    setActiveMenuNotif(null);
  };

  const markAllAsRead = async () => {
    triggerFeedback('success');
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    if (currentUserId) {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUserId);
      toast.success('סומן כנקרא');
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    if (notif.action_url) {
      triggerFeedback('pop');
      navigate(notif.action_url);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return { Icon: Heart, color: 'text-[#e91e63]', bg: 'bg-[#e91e63]' };
      case 'comment': return { Icon: MessageSquare, color: 'text-[#2196f3]', bg: 'bg-[#2196f3]' };
      case 'follow': return { Icon: UserPlus, color: 'text-[#8bc34a]', bg: 'bg-[#8bc34a]' };
      case 'gift': return { Icon: Gift, color: 'text-[#ff9800]', bg: 'bg-[#ff9800]' };
      case 'system': return { Icon: ShieldAlert, color: 'text-white', bg: 'bg-white' };
      default: return { Icon: Bell, color: 'text-white', bg: 'bg-white' };
    }
  };

  const stopPropagation = (e: React.MouseEvent | React.TouchEvent) => e.stopPropagation();

  if (loading) return <div className="fixed inset-0 bg-[#0C0C0C] flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  return (
    <div className="fixed inset-0 flex flex-col h-[100dvh] bg-[#0C0C0C]" dir="rtl">
      {/* רקע עדין */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-white/[0.02] blur-[120px] rounded-full mix-blend-screen"></div>
      </div>

      {/* הדר מודרני וצף (ללא חץ) */}
      <motion.div 
        initial={{ y: 0 }}
        animate={{ y: showHeader ? 0 : -100 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="fixed top-0 left-0 right-0 z-[50] flex items-center justify-between px-6 pt-10 pb-4 bg-[#111]/95 backdrop-blur-xl border-b border-white/5 rounded-b-[24px] shadow-lg"
      >
        <div className="w-10"></div> {/* Spacer for centering */}
        
        <h1 className="text-xl font-black text-white flex items-center gap-2 drop-shadow-md">
          <Bell size={22} className="text-white" /> התראות
        </h1>

        <button onClick={markAllAsRead} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full active:scale-90 transition-transform hover:bg-white/10 border border-white/5">
          <CheckCheck size={18} className="text-white/60" />
        </button>
      </motion.div>

      {/* אזור ההתראות הנגלל */}
      <div className="flex-1 overflow-y-auto px-4 pt-28 pb-32 flex flex-col gap-3 relative z-10 scrollbar-hide" ref={scrollRef}>
        <AnimatePresence mode='popLayout'>
          {notifications.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-40 opacity-30">
              <Bell size={48} className="mb-4" />
              <p className="font-bold text-[14px]">אין התראות חדשות</p>
            </motion.div>
          ) : (
            notifications.map((notif) => {
              const { Icon, bg, color } = getIcon(notif.type);
              const actor = notif.actor_profiles;

              return (
                <motion.div 
                  key={notif.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => handleNotificationClick(notif)}
                  className={`relative p-4 rounded-[28px] border transition-all flex gap-3.5 items-center group cursor-pointer ${notif.is_read ? 'bg-white/[0.03] border-white/5' : 'bg-white/[0.06] border-white/10 shadow-lg'}`}
                >
                  {/* תמונת פרופיל / אייקון */}
                  <div 
                    className="relative shrink-0"
                    onClick={(e) => {
                      if (actor) {
                        e.stopPropagation();
                        triggerFeedback('pop');
                        navigate(`/profile/${notif.actor_id}`);
                      }
                    }}
                  >
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-black flex items-center justify-center border border-white/10">
                      {actor?.avatar_url ? (
                        <img src={actor.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        <UserCircle size={24} className="text-white/20" />
                      )}
                    </div>
                    {/* באדג' סוג הפעולה קטן למטה */}
                    <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-[#111] flex items-center justify-center shadow-sm ${bg}`}>
                      <Icon size={10} className="text-white" />
                    </div>
                  </div>

                  {/* תוכן ההתראה */}
                  <div className="flex flex-col flex-1 pr-1">
                    <div className="flex justify-between items-start">
                      <span className="text-white font-bold text-[14px] leading-tight mb-1 pr-4">
                        {notif.title}
                      </span>
                    </div>
                    <p className="text-white/50 text-[13px] line-clamp-2 leading-snug">{notif.content}</p>
                    <span className="text-[10px] text-white/30 font-bold mt-2 tracking-widest uppercase">
                      {new Date(notif.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute:'2-digit' })}
                    </span>
                  </div>

                  {/* כפתור 3 נקודות */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); triggerFeedback('pop'); setActiveMenuNotif(notif); }}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 active:scale-90 transition-transform shrink-0"
                  >
                    <MoreVertical size={16} className="text-white/60" />
                  </button>

                  {/* נקודה כחולה אם לא נקרא */}
                  {!notif.is_read && (
                    <div className="absolute top-1/2 -translate-y-1/2 right-2 w-2 h-2 bg-[#2196f3] rounded-full shadow-[0_0_8px_#2196f3]"></div>
                  )}
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* בוטום שיט (Z-9999999 כדי לעלות מעל ה-Nav Bar) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {activeMenuNotif && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActiveMenuNotif(null)} />
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="relative z-10 bg-white rounded-t-[36px] p-6 flex flex-col gap-3 pb-12 shadow-[0_-10px_50px_rgba(0,0,0,0.2)]">
                <div className="w-full flex justify-center mb-2"><div className="w-16 h-1.5 bg-black/10 rounded-full"/></div>
                
                {activeMenuNotif.action_url && (
                  <button onClick={() => { setActiveMenuNotif(null); handleNotificationClick(activeMenuNotif); }} className="w-full p-4 bg-black/5 rounded-2xl text-black font-black flex justify-between items-center text-lg active:bg-black/10 transition-colors">
                    צפה בתוכן <ExternalLink size={20} className="text-black/40" />
                  </button>
                )}
                
                {activeMenuNotif.actor_id && (
                  <button onClick={() => { setActiveMenuNotif(null); navigate(`/profile/${activeMenuNotif.actor_id}`); }} className="w-full p-4 bg-black/5 rounded-2xl text-black font-black flex justify-between items-center text-lg active:bg-black/10 transition-colors">
                    פרופיל משתמש <UserCircle size={20} className="text-black/40" />
                  </button>
                )}

                <button onClick={() => deleteNotification(activeMenuNotif.id)} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 font-black flex justify-between items-center text-lg active:bg-red-500/20 transition-colors mt-2">
                  מחק התראה <Trash2 size={20} />
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
