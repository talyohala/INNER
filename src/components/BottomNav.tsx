import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Compass, User, Menu } from 'lucide-react';
import { motion } from 'framer-motion';
import { triggerFeedback } from '../lib/sound';

interface BottomNavProps {
  onMenuClick: () => void;
  hasUnread?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onMenuClick, hasUnread }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const items = [
    { path: '/', icon: Home, label: 'פיד' },
    { path: '/explore', icon: Compass, label: 'חיפוש' },
    { path: '/profile', icon: User, label: 'פרופיל' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none" dir="rtl">
      <div className="pointer-events-auto w-full bg-[#0A0A0A]/92 backdrop-blur-3xl border-t border-white/10 rounded-t-[30px] shadow-[0_-18px_40px_rgba(0,0,0,0.45)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        <div className="flex items-center justify-between px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+10px)] min-h-[74px]">
          <button
            onClick={() => {
              triggerFeedback('pop');
              onMenuClick();
            }}
            className="relative flex items-center justify-center w-12 h-12 rounded-2xl text-white/75 active:scale-90 transition-all hover:bg-white/[0.05]"
            aria-label="פתח תפריט"
          >
            <div className="absolute inset-0 rounded-2xl bg-white/[0.03] border border-white/8 shadow-inner" />
            <Menu size={22} className="relative z-10" />
            {hasUnread && (
              <motion.span
                animate={{ scale: [1, 1.35, 1], opacity: [0.65, 1, 0.65] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                className="absolute top-2 right-2 z-20 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#080808] shadow-[0_0_8px_rgba(239,68,68,0.8)]"
              />
            )}
          </button>

          <div className="flex items-center justify-center gap-2 flex-1">
            {items.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));
              const Icon = item.icon;

              return (
                <button
                  key={item.path}
                  onClick={() => {
                    triggerFeedback('pop');
                    navigate(item.path);
                  }}
                  className={`relative flex flex-col items-center justify-center min-w-[74px] h-12 rounded-2xl transition-all active:scale-90 ${
                    isActive
                      ? 'text-white'
                      : 'text-white/35 hover:text-white/65'
                  }`}
                  aria-label={item.label}
                >
                  {isActive && (
                    <motion.div
                      layoutId="bottom-nav-pill"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      className="absolute inset-0 rounded-2xl bg-white/[0.07] border border-white/10 shadow-inner"
                    />
                  )}

                  <Icon
                    size={21}
                    className={`relative z-10 transition-all ${
                      isActive ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]' : ''
                    }`}
                  />

                  <span
                    className={`relative z-10 mt-1 text-[10px] font-black tracking-wide ${
                      isActive ? 'text-white/95' : 'text-white/35'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
