import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Heart, Gift, MessageSquare, Bell, UserPlus, CheckCheck, Wallet, ShoppingBag, Activity } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { triggerFeedback } from '../lib/sound';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { markNotificationsRead } = useAuth(); // שואב את פונקציית האיפוס הגלובלית!

  const fetchNotifs = async () => {
    try {
      const data = await apiFetch<any[]>('/api/notifications');
      setNotifications(data || []);
      
      if (data && data.some(n => !n.is_read)) {
        await apiFetch('/api/notifications/read', { method: 'POST' }).catch(() => {});
        markNotificationsRead(); // מאפס מיד את הנקודה האדומה בחוץ
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchNotifs(); }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return { Icon: Heart, color: 'text-[#e91e63]', bg: 'bg-[#e91e63]/10', border: 'border-[#e91e63]/20' };
      case 'comment': return { Icon: MessageSquare, color: 'text-[#2196f3]', bg: 'bg-[#2196f3]/10', border: 'border-[#2196f3]/20' };
      case 'follow': return { Icon: UserPlus, color: 'text-[#8bc34a]', bg: 'bg-[#8bc34a]/10', border: 'border-[#8bc34a]/20' };
      case 'wallet': return { Icon: Wallet, color: 'text-[#10b981]', bg: 'bg-[#10b981]/10', border: 'border-[#10b981]/20' };
      case 'store': return { Icon: ShoppingBag, color: 'text-[#9c27b0]', bg: 'bg-[#9c27b0]/10', border: 'border-[#9c27b0]/20' };
      case 'gift': return { Icon: Gift, color: 'text-[#ff9800]', bg: 'bg-[#ff9800]/10', border: 'border-[#ff9800]/20' };
      default: return { Icon: Activity, color: 'text-white/50', bg: 'bg-white/5', border: 'border-white/10' };
    }
  };

  if (loading) return <div className="fixed inset-0 bg-[#0A0A0A] flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  return (
    <div className="px-4 pt-12 pb-32 bg-[#0A0A0A] min-h-screen flex flex-col font-sans" dir="rtl">
      <div className="flex items-center justify-between mb-10 px-2">
        <div className="w-11"></div>
        <h1 className="text-3xl font-black text-white tracking-tighter drop-shadow-md">התראות</h1>
        <button onClick={() => { fetchNotifs(); markNotificationsRead(); }} className="w-11 h-11 flex items-center justify-center bg-white/5 border border-white/10 rounded-[16px] active:scale-90 transition-transform shadow-inner">
          <CheckCheck size={20} className="text-white/60" />
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-3">
        <AnimatePresence mode='popLayout'>
          {notifications.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center pb-20 opacity-80">
              <motion.div animate={{ rotate: [0, -15, 15, -10, 10, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", repeatDelay: 1 }} className="w-24 h-24 rounded-[32px] bg-white/[0.03] border border-white/10 flex items-center justify-center mb-6 shadow-2xl">
                <Bell size={40} className="text-white/20" />
              </motion.div>
              <p className="font-black text-white/30 uppercase tracking-widest text-[13px]">הכל שקט בינתיים</p>
            </motion.div>
          ) : (
            notifications.map((notif) => {
              const { Icon, color, bg, border } = getIcon(notif.type);
              return (
                <motion.div key={notif.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={() => notif.action_url && navigate(notif.action_url)} className={`p-4 flex gap-4 items-center rounded-[24px] border transition-all cursor-pointer ${notif.is_read ? 'bg-transparent border-white/5 opacity-50' : 'bg-white/[0.04] border-white/10 shadow-[0_8px_20px_rgba(0,0,0,0.4)] active:scale-[0.98]'}`}>
                  <div className={`w-14 h-14 rounded-[16px] ${bg} flex items-center justify-center shrink-0 border ${border} shadow-inner`}><Icon size={24} className={color} /></div>
                  <div className="flex flex-col flex-1 text-right min-w-0">
                    <span className="text-white font-black text-[15px] truncate drop-shadow-sm">{notif.title}</span>
                    <p className="text-white/60 text-[13px] line-clamp-2 leading-relaxed mt-0.5">{notif.content}</p>
                    <span className="text-white/30 text-[9px] font-bold mt-2 tracking-widest uppercase">{new Date(notif.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute:'2-digit' })}</span>
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
