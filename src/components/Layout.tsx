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
  X,
  UserCircle,
  ChevronLeft,
  Shield,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { triggerFeedback } from '../lib/sound';
import { BottomNav } from './BottomNav';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, unreadCount, profile } = useAuth() as any;

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
    },
    {
      path: '/wallet',
      icon: Wallet,
      label: 'ארנק',
      color: 'text-white',
      bg: 'bg-white/10',
    },
    {
      path: '/notifications',
      icon: Bell,
      label: 'התראות',
      color: 'text-white',
      bg: 'bg-white/10',
      badge: unreadCount > 0,
    },
    {
      path: '/store',
      icon: Zap,
      label: 'חנות בוסטים',
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
    },
    {
      path: '/settings',
      icon: Settings,
      label: 'הגדרות',
      color: 'text-white/70',
      bg: 'bg-white/5',
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
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

              <div className="px-5 pt-6 pb-4 border-b border-white/5">
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={closeSidebar}
                    className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-white/70 active:scale-90 transition-all hover:bg-white/[0.07]"
                    aria-label="סגור תפריט"
                  >
                    <X size={20} />
                  </button>

                  <div className="flex-1 text-right">
                    <h2 className="text-[28px] font-black tracking-tight text-white">INNER</h2>
                    <p className="text-white/25 text-[10px] font-black tracking-[0.25em] uppercase mt-1">
                      Navigation
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    triggerFeedback('pop');
                    navigate('/profile');
                    closeSidebar();
                  }}
                  className="mt-5 w-full bg-white/[0.03] border border-white/10 rounded-[28px] p-4 flex items-center gap-4 active:scale-[0.99] transition-all hover:bg-white/[0.05]"
                >
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-black border border-white/10 shrink-0">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                      <UserCircle className="w-full h-full p-2 text-white/25" />
                    )}
                  </div>

                  <div className="flex-1 text-right min-w-0">
                    <div className="text-white font-black text-[15px] truncate">
                      {profile?.full_name || user?.email || 'INNER User'}
                    </div>
                    <div className="text-white/35 text-[11px] mt-1 truncate" dir="ltr">
                      @{profile?.username || 'user'}
                    </div>
                  </div>

                  <ChevronLeft size={18} className="text-white/25 shrink-0" />
                </button>
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
                      className={`w-12 h-12 rounded-[18px] ${item.bg} border border-white/5 flex items-center justify-center shrink-0 relative shadow-inner`}
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

              <div className="p-4 border-t border-white/5 flex flex-col gap-2">
                <button
                  onClick={() => {
                    triggerFeedback('pop');
                    navigate('/settings');
                    closeSidebar();
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-[22px] bg-white/[0.03] border border-white/8 hover:bg-white/[0.05] active:scale-[0.98] transition-all"
                >
                  <div className="w-11 h-11 rounded-[16px] bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <Shield size={18} className="text-white/75" />
                  </div>
                  <div className="flex-1 text-right">
                    <div className="text-white/90 text-[14px] font-black">פרטיות ואבטחה</div>
                  </div>
                </button>

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

                <div className="pt-2 text-center">
                  <p className="text-[10px] font-black text-white/20 tracking-[0.22em] uppercase">
                    Inner Core
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
