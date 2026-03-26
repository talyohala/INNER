import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle, Loader2, ArrowRight, Heart, Gift, MessageSquare, UserPlus, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { FadeIn, GlassCard } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

// נגדיר את מבנה ההתראה האמיתי מהשרת
interface Notification {
  id: string;
  type: string; // 'like', 'gift', 'comment', 'follow', 'system'
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
  action_url?: string; // לאן ההתראה לוקחת אותך
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
        
        // סימון כנקרא רק אם יש באמת התראות שלא נקראו
        if (data && data.some(n => !n.is_read)) {
          await apiFetch('/api/notifications/read', { method: 'POST' });
        }
      } catch (err) { 
        console.error(err); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchNotifs();
  }, []);

  // פונקציה שמתאימה אייקון וצבע לפי סוג ההתראה
  const getNotificationStyle = (type: string, isRead: boolean) => {
    if (isRead) return { icon: CheckCircle, color: 'text-white/20', bg: 'bg-white/5', border: 'border-white/5' };
    
    switch (type) {
      case 'like': return { icon: Heart, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]' };
      case 'gift': return { icon: Gift, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.1)]' };
      case 'comment': return { icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]' };
      case 'follow': return { icon: UserPlus, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20 shadow-[0_0_15px_rgba(74,222,128,0.1)]' };
      case 'system': return { icon: ShieldAlert, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]' };
      default: return { icon: Bell, color: 'text-white', bg: 'bg-white/10', border: 'border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]' };
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    triggerFeedback('pop');
    if (notif.action_url) {
      navigate(notif.action_url);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#030303] flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  return (
    <FadeIn className="px-5 pt-8 pb-32 bg-[#030303] min-h-screen font-sans relative" dir="rtl">
      
      {/* כותרת מיושרת לאמצע */}
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="w-8"></div>
        <div className="flex flex-col items-center">
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Bell size={20} className="text-white/40" /> התראות
          </h1>
          <span className="text-[10px] text-white/40 uppercase tracking-widest mt-1 font-bold">מה שפספסת במועדון</span>
        </div>
        <button onClick={() => { triggerFeedback('pop'); navigate(-1); }} className="w-8 h-8 flex justify-center items-center bg-white/5 rounded-full shadow-inner active:scale-90 transition-all hover:bg-white/10">
          <ArrowRight size={16} className="text-white/80" />
        </button>
      </div>

      <div className="flex flex-col gap-3 relative z-10">
        <AnimatePresence>
          {notifications.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32 gap-5">
              <motion.div 
                animate={{ rotate: [0, -10, 10, -10, 10, 0] }} 
                transition={{ repeat: Infinity, duration: 4, repeatDelay: 2 }}
                className="w-20 h-20 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center shadow-inner"
              >
                <Bell size={32} className="text-white/10" />
              </motion.div>
              <div className="text-center">
                <span className="text-white/60 text-sm font-black block mb-1">הכל שקט בינתיים</span>
                <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest">אין לך התראות חדשות</span>
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
                  <GlassCard
                    className={`p-4 rounded-[28px] transition-all flex gap-4 items-start bg-white/[0.03] ${style.border} ${notif.action_url ? 'hover:bg-white/[0.05] active:scale-[0.98]' : ''}`}
                  >
                    <div className={`w-12 h-12 rounded-[18px] flex items-center justify-center shrink-0 shadow-inner mt-0.5 ${style.bg}`}>
                      <Icon size={20} className={style.color} />
                    </div>
                    
                    <div className="flex flex-col flex-1 text-right mt-1">
                      <h3 className="text-white font-black text-sm mb-1 flex items-center justify-between">
                        {notif.title}
                        {!notif.is_read && <span className="w-2 h-2 bg-purple-400 rounded-full shadow-[0_0_10px_#c084fc] animate-pulse shrink-0 ml-1"></span>}
                      </h3>
                      <p className="text-white/60 text-xs font-medium leading-relaxed">{notif.content}</p>
                      <span className="text-white/20 text-[9px] font-bold mt-2" dir="ltr">
                        {new Date(notif.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute:'2-digit' })}
                      </span>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </FadeIn>
  );
};
