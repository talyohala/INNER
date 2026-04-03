import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusCircle,
  Wallet,
  Bell,
  Zap,
  Settings,
  LogOut,
  ChevronLeft,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { triggerFeedback } from '../lib/sound';
import { BottomNav } from './BottomNav';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, unreadCount } = useAuth() as any;

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  if (location.pathname === '/auth') return <>{children}</>;

  const sidebarItems = [
    {
      path: '/create-circle',
      icon: PlusCircle,
      label: 'צור מועדון',
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
    },
    {
      path: '/wallet',
      icon: Wallet,
      label: 'ארנק',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      path: '/notifications',
      icon: Bell,
      label: 'התראות',
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      badge: unreadCount > 0,
    },
    {
      path: '/store',
      icon: Zap,
      label: 'חנות בוסטים',
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/20',
    },
    {
      path: '/settings',
      icon: Settings,
      label: 'הגדרות',
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
    },
  ];

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="bg-[#0A0A0A] min-h-screen text-white overflow-x-hidden">
      <main className="relative z-0 pb-24 min-h-screen">{children}</main>

      {user && (
        <BottomNav
          onMenuClick={() => {
            triggerFeedback('pop');
            setIsSidebarOpen(true);
          }}
          hasUnread={unreadCount > 0}
        />
      )}

      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[50]"
              onClick={closeSidebar}
            />

            <motion.div
              style={{ position: 'fixed', top: 0, bottom: 0, left: 0, width: '320px', maxWidth: '88vw', zIndex: 60 }}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="bg-[#050505]/96 backdrop-blur-3xl border-r border-white/10 flex flex-col shadow-[20px_0_60px_rgba(0,0,0,0.55)]"
              dir="rtl"
            >
              <div className="px-5 pt-7 pb-5 border-b border-white/5">
                <div className="flex items-center justify-center">
                  <h2 className="text-[30px] font-black tracking-tight text-white text-center">INNER</h2>
                </div>
              </div>

              <div className="flex flex-col gap-2 p-4 flex-1 overflow-y-auto">
                {sidebarItems.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      triggerFeedback('pop');
                      navigate(item.path);
                      closeSidebar();
                    }}
                    className="flex items-center gap-4 p-4 rounded-[24px] hover:bg-white/[0.05] active:scale-[0.98] transition-all w-full text-right group relative border border-transparent hover:border-white/5"
                  >
                    <div
                      className={`w-12 h-12 rounded-[18px] ${item.bg} ${item.border} border flex items-center justify-center shrink-0 relative shadow-inner`}
                    >
                      <item.icon size={20} className={item.color} />
                      {item.badge && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#050505] shadow-[0_0_10px_#ef4444]" />
                      )}
                    </div>

                    <div className="flex-1 text-right">
                      <span className="font-black text-[15px] text-white/92">{item.label}</span>
                    </div>

                    <ChevronLeft size={17} className="text-white/20 group-hover:text-white/40 transition-colors" />
                  </button>
                ))}
              </div>

              <div className="p-4 border-t border-white/5">
                <button
                  onClick={async () => {
                    triggerFeedback('pop');
                    closeSidebar();
                    try {
                      await signOut?.();
                    } catch {}
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-[22px] bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 active:scale-[0.98] transition-all"
                >
                  <div className="w-11 h-11 rounded-[16px] bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                    <LogOut size={18} className="text-red-400" />
                  </div>
                  <div className="flex-1 text-right">
                    <div className="text-red-400 text-[14px] font-black">התנתק</div>
                  </div>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
