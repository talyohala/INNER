import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Loader2, Heart, Gift, MessageSquare, Bell, UserPlus, 
  Trash2, CheckCheck, MoreVertical, ExternalLink, Wallet, 
  ShoppingBag, Activity, UserCircle, X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { FadeIn, GlassCard } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeMenuNotif, setActiveMenuNotif] = useState<any | null>(null);

  const fetchNotifs = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      setCurrentUserId(authData.user.id);

      // שליפה של ההתראות + פרופיל המשתמש שיצר את ההתראה
      const { data, error } = await supabase
        .from('notifications')
        .select('*, actor_profiles:profiles!notifications_actor_id_fkey(full_name, avatar_url, username)')
        .eq('user_id', authData.user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      setNotifications(data || []);
      
      // איפוס נקודה אדומה
      if (data && data.some(n => !n.is_read)) {
        await apiFetch('/api/notifications/read', { method: 'POST' }).catch(() => {});
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchNotifs();

    // מנוע האזנה בזמן אמת - מאזין ספציפית ל-ID של המשתמש!
    let channel: any;
    
    const setupRealtime = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;

      channel = supabase.channel(`notifs_${authData.user.id}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'notifications',
            filter: `user_id=eq.${authData.user.id}`
        }, () => {
          fetchNotifs();
          triggerFeedback('success'); // צליל ורטט כשיש התראה חדשה בזמן אמת
        })
        .subscribe();
    };

    setupRealtime();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const deleteNotification = async (id: string) => {
    triggerFeedback('error');
    setNotifications(prev => prev.filter(n => n.id !== id));
    await supabase.from('notifications').delete().eq('id', id);
    setActiveMenuNotif(null);
  };

  const markAllAsRead = async () => {
    triggerFeedback('pop');
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await apiFetch('/api/notifications/read', { method: 'POST' }).catch(() => {});
    toast.success('הכל סומן כנקרא');
  };

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

  const stopPropagation = (e: any) => e.stopPropagation();

  if (loading) return <div className="fixed inset-0 bg-[#0A0A0A] flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  return (
    <div className="px-4 pt-12 pb-32 bg-[#0A0A0A] min-h-screen flex flex-col font-sans relative overflow-x-hidden" dir="rtl">
      
      {/* Header */}
      <div className="flex justify-between items-start mb-10 h-12 px-1 relative z-10">
        <div className="w-11"></div>
        <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2">
          <h1 className="text-3xl font-black text-white tracking-tighter drop-shadow-md">התראות</h1>
          <span className="text-[10px] font-black text-white/60 tracking-widest mt-1 uppercase">עדכונים חיים</span>
        </div>
        <button onClick={markAllAsRead} className="w-11 h-11 flex justify-center items-center bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-[16px] shadow-lg active:scale-90 transition-transform">
          <CheckCheck size={20} className="text-white/80" />
        </button>
      </div>

      {/* Notifications List */}
      <div className="flex-1 flex flex-col gap-4 relative z-10">
        <AnimatePresence mode='popLayout'>
          {notifications.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="flex-1 flex flex-col items-center justify-center pb-32 opacity-80"
            >
              <motion.div 
                animate={{ rotate: [0, -15, 15, -10, 10, 0] }} 
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", repeatDelay: 1 }} 
                className="w-28 h-28 rounded-[36px] bg-white/[0.02] border border-white/5 flex items-center justify-center mb-6 shadow-2xl"
              >
                <Bell size={48} className="text-white/20" />
              </motion.div>
              <p className="font-black text-white/30 uppercase tracking-widest text-[13px]">הכל שקט בינתיים</p>
            </motion.div>
          ) : (
            notifications.map((notif) => {
              const { Icon, color, bg, border } = getIcon(notif.type);
              const actor = notif.actor_profiles;

              return (
                <motion.div key={notif.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <GlassCard 
                    onClick={() => { if(notif.action_url) { triggerFeedback('pop'); navigate(notif.action_url); } }}
                    className={`p-4 flex gap-4 items-center rounded-[32px] cursor-pointer transition-all ${notif.is_read ? 'opacity-60 bg-transparent border-white/5' : 'bg-[#111] border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]'}`}
                  >
                    <div 
                      className="relative shrink-0"
                      onClick={(e) => {
                        if (actor && notif.actor_id) {
                          e.stopPropagation(); triggerFeedback('pop'); navigate(`/profile/${notif.actor_id}`);
                        }
                      }}
                    >
                      <div className="w-14 h-14 rounded-[20px] bg-black overflow-hidden border border-white/10 shadow-inner p-0.5">
                        <div className="w-full h-full rounded-[16px] overflow-hidden bg-[#111] flex items-center justify-center">
                          {actor?.avatar_url ? (
                            <img src={actor.avatar_url} className="w-full h-full object-cover" />
                          ) : (
                            <Icon size={24} className={`${color} opacity-50`} />
                          )}
                        </div>
                      </div>
                      
                      {actor && (
                        <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-[#111] flex items-center justify-center shadow-lg ${bg} ${border}`}>
                          <Icon size={12} className={color} />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col flex-1 text-right min-w-0 pr-1">
                      <span className="text-white font-black text-[15px] truncate drop-shadow-sm">{notif.title}</span>
                      <p className="text-white/60 text-[13px] line-clamp-2 leading-relaxed mt-0.5">{notif.content}</p>
                      <span className="text-white/30 text-[10px] font-bold mt-1.5 tracking-widest uppercase">
                        {new Date(notif.created_at).toLocaleDateString('he-IL', { hour: '2-digit', minute:'2-digit' })}
                      </span>
                    </div>

                    <button 
                      onClick={(e) => { e.stopPropagation(); triggerFeedback('pop'); setActiveMenuNotif(notif); }}
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 active:scale-90 transition-all shrink-0 ml-1"
                    >
                      <MoreVertical size={18} className="text-white/50" />
                    </button>

                    {!notif.is_read && (
                      <div className="absolute top-1/2 -translate-y-1/2 right-3 w-2 h-2 bg-[#2196f3] rounded-full shadow-[0_0_8px_#2196f3]"></div>
                    )}
                  </GlassCard>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* MODAL PORTAL */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {activeMenuNotif && (
            <div className="fixed inset-0 z-[100000]" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setActiveMenuNotif(null)} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) setActiveMenuNotif(null); }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="relative z-10 bg-[#0A0A0A] rounded-t-[40px] p-6 flex flex-col gap-3 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.9)] border-t border-white/10" dir="rtl">
                <div className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing"><div className="w-16 h-1.5 bg-white/20 rounded-full"/></div>
                
                <div className="px-2 pb-2 flex justify-between items-center mb-2">
                  <h2 className="text-white font-black text-lg">אפשרויות התראה</h2>
                  <button onClick={() => setActiveMenuNotif(null)} className="text-white/40 hover:text-white"><X size={20} /></button>
                </div>

                {activeMenuNotif.action_url && (
                  <button onClick={() => { navigate(activeMenuNotif.action_url!); setActiveMenuNotif(null); }} className="w-full p-4 bg-[#111] border border-white/5 rounded-[24px] text-white font-black flex justify-between items-center text-[15px] active:bg-white/5 transition-colors shadow-inner">
                    צפה בתוכן <ExternalLink size={18} className="text-[#2196f3]" />
                  </button>
                )}
                
                {activeMenuNotif.actor_id && (
                  <button onClick={() => { navigate(`/profile/${activeMenuNotif.actor_id}`); setActiveMenuNotif(null); }} className="w-full p-4 bg-[#111] border border-white/5 rounded-[24px] text-white font-black flex justify-between items-center text-[15px] active:bg-white/5 transition-colors shadow-inner">
                    פרופיל משתמש <UserCircle size={18} className="text-white/40" />
                  </button>
                )}
                
                <button onClick={() => deleteNotification(activeMenuNotif.id)} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-[24px] text-red-500 font-black flex justify-between items-center text-[15px] mt-2 active:bg-red-500/20 transition-colors shadow-inner">
                  מחק התראה <Trash2 size={18} />
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
