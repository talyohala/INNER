import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusCircle,
  Wallet,
  Bell,
  ShoppingBag,
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
    },
    {
      path: '/wallet',
      icon: Wallet,
      label: 'ארנק CRD',
    },
    {
      path: '/notifications',
      icon: Bell,
      label: 'התראות',
      badge: unreadCount > 0,
    },
    {
      path: '/store',
      icon: ShoppingBag,
      label: 'חנות סטטוס',
    },
    {
      path: '/settings',
      icon: Settings,
      label: 'הגדרות',
    },
  ];

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="bg-transparent min-h-screen text-white overflow-x-hidden">
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
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[50]"
              onClick={closeSidebar}
            />

            <motion.div
              style={{ position: 'fixed', top: 0, bottom: 0, right: 0, width: '55%', maxWidth: '280px', zIndex: 60 }}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="bg-white/[0.03] backdrop-blur-[40px] border-l border-white/20 flex flex-col shadow-[-20px_0_60px_rgba(0,0,0,0.5)]"
              dir="rtl"
            >
              <div className="px-5 pt-10 pb-6 border-b border-white/10 relative">
                 {/* ענן השתקפות פנימי שייתן לזכוכית ברק */}
                 <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/10 to-transparent pointer-events-none opacity-50" />
                 <div className="flex items-center justify-center relative z-10">
                  <h2 className="text-[26px] font-black tracking-tight text-white text-center">INNER</h2>
                 </div>
              </div>

              <div className="flex flex-col gap-2 p-3 flex-1 overflow-y-auto scrollbar-hide">
                {sidebarItems.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      triggerFeedback('pop');
                      navigate(item.path);
                      closeSidebar();
                    }}
                    className="flex items-center gap-4 p-3 rounded-[20px] hover:bg-white/10 active:bg-white/15 transition-all w-full text-right group relative"
                  >
                    <div
                      className="w-10 h-10 rounded-[14px] bg-white/5 border border-white/10 flex items-center justify-center shrink-0 relative shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] group-hover:bg-white/10 transition-colors"
                    >
                      <item.icon size={18} className="text-white/80 group-hover:text-white" />
                      {item.badge && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-surface shadow-[0_0_8px_rgba(239,68,68,0.95)]" />
                      )}
                    </div>

                    <div className="flex-1 text-right">
                      <span className="font-black text-[13px] text-white/80 group-hover:text-white transition-colors">{item.label}</span>
                    </div>

                    <ChevronLeft size={16} className="text-white/20 group-hover:text-white/50 transition-colors" />
                  </button>
                ))}
              </div>

              <div className="p-4 border-t border-white/10">
                <button
                  onClick={async () => {
                    triggerFeedback('pop');
                    closeSidebar();
                    try {
                      await signOut?.();
                    } catch {}
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-[20px] hover:bg-red-500/10 border border-transparent hover:border-red-500/20 active:scale-[0.98] transition-all group"
                >
                  <div className="w-10 h-10 rounded-[14px] bg-white/5 group-hover:bg-red-500/10 border border-white/10 group-hover:border-red-500/20 flex items-center justify-center shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                    <LogOut size={16} className="text-white/60 group-hover:text-red-400 transition-colors" />
                  </div>
                  <div className="flex-1 text-right">
                    <div className="text-white/60 group-hover:text-red-400 transition-colors text-[13px] font-black">התנתק</div>
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
