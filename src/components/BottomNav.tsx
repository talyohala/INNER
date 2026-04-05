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
      {/* רקע אביס עמוק ויוקרתי */}
      <div className="pointer-events-auto w-full bg-[#020617]/95 backdrop-blur-3xl border-t border-slate-800/50 rounded-t-[30px] shadow-[0_-15px_40px_rgba(0,0,0,0.6)]">
        
        <div className="flex items-center px-6 pt-2 pb-[calc(env(safe-area-inset-bottom)+6px)] min-h-[70px]">
          <div className="flex items-center justify-center gap-10 flex-1">
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
                  className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-full transition-all active:scale-90 ${
                    isActive ? 'text-sky-400' : 'text-slate-500 hover:text-slate-200'
                  }`}
                  aria-label={item.label}
                >
                  <Icon
                    size={28}
                    strokeWidth={isActive ? 2.5 : 2}
                    className="transition-all"
                  />
                  
                  {/* פס הדגשה תחתון חלק */}
                  {isActive && (
                    <motion.div 
                        layoutId="activeNavTab"
                        className="absolute -bottom-1.5 w-6 h-1 bg-sky-400 rounded-full"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              triggerFeedback('pop');
              onMenuClick();
            }}
            className="relative flex items-center justify-center w-14 h-14 rounded-full text-slate-500 active:scale-90 transition-all hover:text-slate-200 ml-2"
            aria-label="פתח תפריט"
          >
            <Menu size={28} />
            {hasUnread && (
              <motion.span
                animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                className="absolute top-3 right-3 z-20 w-3 h-3 bg-red-500 rounded-full border-2 border-[#020617] shadow-[0_0_10px_rgba(239,68,68,0.9)]"
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
