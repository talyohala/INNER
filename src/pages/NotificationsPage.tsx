import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle, Loader2, ArrowRight, Heart, Gift, MessageSquare, UserPlus, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { FadeIn } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
  action_url?: string;
}

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const data = await apiFetch<Notification[]>('/api/notifications');
        setNotifications(data || []);
        if (data && data.some(n => !n.is_read)) {
          await apiFetch('/api/notifications/read', { method: 'POST' });
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchNotifs();
  }, []);

  // סגנון מונוכרומטי יוקרתי לכל ההתראות
  const getNotificationStyle = (type: string, isRead: boolean) => {
    if (isRead) return { icon: CheckCircle, color: 'text-white/30', bg: 'bg-white/5', border: 'border-white/5' };

    return { 
      icon: type === 'like' ? Heart : type === 'gift' ? Gift : type === 'comment' ? MessageSquare : type === 'follow' ? UserPlus : type === 'system' ? ShieldAlert : Bell, 
      color: 'text-white', 
      bg: 'bg-white/10', 
      border: 'border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.08)]' 
    };
  };

  const handleNotificationClick = (notif: Notification) => {
    triggerFeedback('pop');
    if (notif.action_url) navigate(notif.action_url);
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  return (
    <FadeIn className="px-4 pt-8 pb-32 bg-black min-h-screen font-sans relative overflow-x-hidden" dir="rtl">
      
      {/* תאורת אווירה */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex justify-center">
        <div className="absolute top-[-5%] left-[-10%] w-[50%] h-[40%] bg-white/10 blur-[100px] rounded-full mix-blend-screen"></div>
      </div>

      <div className="flex items-center justify-between mb-8 relative z-10 px-1">
        <div className="w-10"></div>
        <div className="flex flex-col items-center">
          <h1 className="text-2xl font-black text-white flex items-center gap-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            <Bell size={20} className="text-white/40" /> התראות
          </h1>
          <span className="text-[10px] text-white/50 uppercase tracking-widest mt-1 font-bold">מה שפספסת</span>
        </div>
        <button onClick={() => { triggerFeedback('pop'); navigate(-1); }} className="w-10 h-10 flex justify-center items-center bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-full shadow-lg active:scale-90 transition-all hover:bg-white/10">
          <ArrowRight size={18} className="text-white/80" />
        </button>
      </div>

      <div className="flex flex-col gap-4 relative z-10">
        <AnimatePresence>
          {notifications.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32 gap-5">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                transition={{ repeat: Infinity, duration: 4, repeatDelay: 2 }}
                className="w-24 h-24 rounded-full bg-black border border-white/10 flex items-center justify-center shadow-2xl"
              >
                <Bell size={36} className="text-white/20" />
              </motion.div>
              <div className="text-center">
                <span className="text-white font-black text-[18px] block mb-1">הכל שקט בינתיים</span>
                <span className="text-white/40 text-[11px] font-black uppercase tracking-widest">אין לך התראות חדשות</span>
              </div>
            </motion.div>
          ) : (
            notifications.map((notif, idx) => {
              const style = getNotificationStyle(notif.type, notif.is_read);
              const Icon = style.icon;
              
              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => handleNotificationClick(notif)}
                  className={notif.action_url ? 'cursor-pointer' : ''}
                >
                  <div className={`p-5 rounded-[28px] transition-all flex gap-4 items-start bg-white/[0.06] backdrop-blur-xl border ${style.border} ${notif.action_url ? 'hover:bg-white/[0.08] active:scale-[0.98]' : ''}`}>
                    <div className={`w-14 h-14 rounded-[20px] flex items-center justify-center shrink-0 shadow-inner mt-0.5 border border-white/5 ${style.bg}`}>
                      <Icon size={24} className={style.color} />
                    </div>
                    
                    <div className="flex flex-col flex-1 text-right mt-1">
                      <h3 className="text-white font-black text-[16px] mb-1.5 flex items-center justify-between">
                        {notif.title}
                        {!notif.is_read && <span className="w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] shrink-0 ml-1"></span>}
                      </h3>
                      <p className="text-white/60 text-[14px] font-medium leading-relaxed">{notif.content}</p>
                      <span className="text-white/30 text-[10px] font-bold uppercase mt-3" dir="ltr">
                        {new Date(notif.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute:'2-digit' })}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </FadeIn>
  );
};
