import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, Wallet, Bell, Zap, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { triggerFeedback } from '../lib/sound';
import { BottomNav } from './BottomNav';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  // בדיקת התראות חדשות בטעינה ובמעבר עמוד
  useEffect(() => { 
    setIsSidebarOpen(false); 
    if (user) checkUnreadNotifications();
  }, [location.pathname, user]);

  const checkUnreadNotifications = async () => {
    try {
      const data = await apiFetch<any[]>('/api/notifications');
      if (data) {
        const unread = data.filter(n => !n.is_read).length;
        setUnreadCount(unread);
      }
    } catch (err) { console.error(err); }
  };

  if (location.pathname === '/auth') return <>{children}</>;

  const sidebarItems = [
    { path: '/create-circle', icon: PlusCircle, label: 'צור קהילה חדשה', color: 'text-green-400' },
    { path: '/wallet', icon: Wallet, label: 'ארנק וקרדיטים', color: 'text-white' },
    { path: '/notifications', icon: Bell, label: 'התראות פוש', color: 'text-white', badge: unreadCount > 0 },
    { path: '/store', icon: Zap, label: 'חנות בוסטים', color: 'text-yellow-400' },
    { path: '/settings', icon: Settings, label: 'הגדרות', color: 'text-white/70' }
  ];

  const handleNavigate = (path: string) => {
    triggerFeedback('pop');
    setIsSidebarOpen(false);
    navigate(path);
  };

  const handleLogout = async () => {
    triggerFeedback('pop');
    setIsSidebarOpen(false);
    await signOut();
    navigate('/auth');
  };

  return (
    <>
      <main className="relative z-0 pb-24">
        {children}
      </main>

      {/* הבר התחתון מקבל את משתנה ההתראות */}
      {user && <BottomNav onMenuClick={() => { triggerFeedback('pop'); setIsSidebarOpen(true); }} hasUnread={unreadCount > 0} />}

      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setIsSidebarOpen(false)}
            />

            <motion.div
              style={{ position: 'fixed', top: 0, bottom: 0, left: 0, width: '280px', zIndex: 60 }}
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-[#050505]/95 backdrop-blur-3xl border-r border-white/10 shadow-[20px_0_50px_rgba(0,0,0,0.8)] flex flex-col"
              dir="rtl"
            >
              <div className="flex items-center justify-center p-6 border-b border-white/5">
                <h2 className="text-3xl font-black text-white tracking-tighter italic mt-1">INNER</h2>
              </div>

              <div className="flex flex-col gap-2 p-4 flex-1 overflow-y-auto">
                {sidebarItems.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleNavigate(item.path)}
                    className="flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 active:scale-[0.98] transition-all w-full text-right group relative"
                  >
                    <div className="w-10 h-10 rounded-xl bg-black/50 border border-white/5 flex items-center justify-center shrink-0 group-hover:bg-white/10 shadow-inner relative">
                      <item.icon size={18} className={item.color} />
                      
                      {/* הנקודה האדומה - עכשיו עם אנימציית נשימה חלקה */}
                      {item.badge && (
                        <motion.span
                          animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                          className="absolute -top-1 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-[#050505] shadow-[0_0_10px_rgba(239,68,68,0.8)]"
                        ></motion.span>
                      )}
                    </div>
                    <span className={`font-black text-sm ${item.color === 'text-white/70' ? 'text-white/70' : 'text-white'}`}>{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="p-4 border-t border-white/5">
                <button onClick={handleLogout} className="flex items-center gap-4 p-4 rounded-2xl bg-red-500/5 hover:bg-red-500/10 active:scale-95 transition-all w-full text-right border border-red-500/10">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                    <LogOut size={18} className="text-red-400" />
                  </div>
                  <span className="font-black text-sm text-red-400">התנתק מהמערכת</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
