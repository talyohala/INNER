import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [mounted, setMounted] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, unreadCount } = useAuth() as any;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  if (location.pathname === '/auth') return <>{children}</>;

  const sidebarItems = [
    {
      path: '/create-circle',
      icon: PlusCircle,
      label: 'צור מועדון',
      color: 'text-emerald-400',
      bg: 'bg-white/5',
      border: 'border-white/10',
    },
    {
      path: '/wallet',
      icon: Wallet,
      label: 'ארנק CRD',
      color: 'text-amber-400',
      bg: 'bg-white/5',
      border: 'border-white/10',
    },
    {
      path: '/notifications',
      icon: Bell,
      label: 'התראות',
      badge: unreadCount > 0,
      color: 'text-blue-400',
      bg: 'bg-white/5',
      border: 'border-white/10',
    },
    {
      path: '/store',
      icon: ShoppingBag,
      label: 'חנות סטטוס',
      color: 'text-fuchsia-400',
      bg: 'bg-white/5',
      border: 'border-white/10',
    },
    {
      path: '/settings',
      icon: Settings,
      label: 'הגדרות',
      color: 'text-slate-300',
      bg: 'bg-white/5',
      border: 'border-white/10',
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

      {mounted && createPortal(
        <AnimatePresence>
          {isSidebarOpen && (
            <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={closeSidebar}
              />

              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={0.4}
                onDragEnd={(_, info) => { if (info.offset.y > 100) closeSidebar(); }}
                transition={{ type: "spring", damping: 25, stiffness: 400 }}
                className="relative z-10 bg-[#0A0A0A] rounded-t-[40px] p-6 pb-12 border-t border-white/10 shadow-2xl touch-none"
              >
                <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-8 cursor-grab active:cursor-grabbing" />

                <div className="flex flex-col gap-2 overflow-y-auto scrollbar-hide">
                  {sidebarItems.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        triggerFeedback('pop');
                        navigate(item.path);
                        closeSidebar();
                      }}
                      className="flex items-center gap-4 p-3 rounded-[20px] hover:bg-white/5 active:bg-white/10 transition-all w-full text-right group relative"
                    >
                      <div
                        className={`w-10 h-10 rounded-[14px] ${item.bg} border ${item.border} flex items-center justify-center shrink-0 relative shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] group-hover:brightness-125 transition-all`}
                      >
                        <item.icon size={18} className={item.color} />
                        {item.badge && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-surface shadow-[0_0_8px_rgba(239,68,68,0.95)]" />
                        )}
                      </div>

                      <div className="flex-1 text-right">
                        <span className="font-black text-[14px] text-white/80 group-hover:text-white transition-colors">{item.label}</span>
                      </div>

                      <ChevronLeft size={16} className="text-white/20 group-hover:text-white/50 transition-colors" />
                    </button>
                  ))}

                  <div className="mt-2 pt-2 border-t border-white/10">
                    <button
                      onClick={async () => {
                        triggerFeedback('pop');
                        closeSidebar();
                        try {
                          await signOut?.();
                        } catch {}
                      }}
                      className="w-full flex items-center gap-4 p-3 rounded-[20px] hover:bg-white/5 active:bg-white/10 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-[14px] bg-white/5 border border-white/10 flex items-center justify-center shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] group-hover:brightness-125 transition-all">
                        <LogOut size={18} className="text-red-500" />
                      </div>
                      <div className="flex-1 text-right">
                        <div className="text-red-500 text-[14px] font-black">התנתק</div>
                      </div>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
