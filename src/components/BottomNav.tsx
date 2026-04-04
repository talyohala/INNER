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

        <div className="flex items-center px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+10px)] min-h-[74px]">
          <div className="flex items-center justify-center gap-8 flex-1">
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
                  className={`relative flex items-center justify-center w-14 h-14 rounded-full transition-all active:scale-90 ${
                    isActive ? 'text-white' : 'text-white/35 hover:text-white/65'
                  }`}
                  aria-label={item.label}
                >
                  <Icon
                    size={28}
                    className={`transition-all ${
                      isActive ? 'drop-shadow-[0_0_12px_rgba(255,255,255,0.5)]' : ''
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              triggerFeedback('pop');
              onMenuClick();
            }}
            className="relative flex items-center justify-center w-14 h-14 rounded-full text-white/75 active:scale-90 transition-all hover:text-white ml-2"
            aria-label="פתח תפריט"
          >
            <Menu size={28} />
            {hasUnread && (
              <motion.span
                animate={{ scale: [1, 1.35, 1], opacity: [0.65, 1, 0.65] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                className="absolute top-2.5 right-2.5 z-20 w-3 h-3 bg-red-500 rounded-full border-2 border-[#080808] shadow-[0_0_8px_rgba(239,68,68,0.8)]"
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
