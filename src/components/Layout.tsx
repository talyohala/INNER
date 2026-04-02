import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, Wallet, Bell, Zap, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { triggerFeedback } from '../lib/sound';
import { BottomNav } from './BottomNav';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  // שואב את המונה הגלובלי! בלי בדיקות מקומיות
  const { user, signOut, unreadCount } = useAuth();

  useEffect(() => { 
    setIsSidebarOpen(false); 
  }, [location.pathname]);

  if (location.pathname === '/auth') return <>{children}</>;

  const sidebarItems = [
    { path: '/create-circle', icon: PlusCircle, label: 'צור מועדון', color: 'text-green-400', bg: 'bg-green-500/10' },
    { path: '/wallet', icon: Wallet, label: 'ארנק', color: 'text-white', bg: 'bg-white/10' },
    { path: '/notifications', icon: Bell, label: 'התראות', color: 'text-white', bg: 'bg-white/10', badge: unreadCount > 0 },
    { path: '/store', icon: Zap, label: 'חנות בוסטים', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { path: '/settings', icon: Settings, label: 'הגדרות', color: 'text-white/50', bg: 'bg-white/5' }
  ];

  return (
    <div className="bg-[#0A0A0A] min-h-screen text-white overflow-x-hidden">
      <main className="relative z-0 pb-24 min-h-screen">{children}</main>
      {user && <BottomNav onMenuClick={() => { triggerFeedback('pop'); setIsSidebarOpen(true); }} hasUnread={unreadCount > 0} />}

      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[50]" onClick={() => setIsSidebarOpen(false)} />
            <motion.div style={{ position: 'fixed', top: 0, bottom: 0, right: 0, width: '280px', zIndex: 60 }} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="bg-[#050505] border-l border-white/10 flex flex-col" dir="rtl">
              <div className="flex items-center justify-center p-8 border-b border-white/5"><h2 className="text-3xl font-black italic">INNER</h2></div>
              <div className="flex flex-col gap-2 p-4 flex-1 overflow-y-auto">
                {sidebarItems.map((item, idx) => (
                  <button key={idx} onClick={() => { triggerFeedback('pop'); navigate(item.path); setIsSidebarOpen(false); }} className="flex items-center gap-4 p-4 rounded-[20px] hover:bg-white/5 active:scale-95 transition-all w-full text-right group relative">
                    <div className={`w-11 h-11 rounded-[16px] ${item.bg} border border-white/5 flex items-center justify-center shrink-0 relative`}>
                      <item.icon size={20} className={item.color} />
                      {item.badge && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#050505] shadow-[0_0_10px_#ef4444]"></span>}
                    </div>
                    <span className="font-black text-[15px]">{item.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
