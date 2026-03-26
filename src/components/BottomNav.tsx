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
    { path: '/explore', icon: Compass, label: 'גלה' },
    { path: '/profile', icon: User, label: 'פרופיל' }
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full px-5 pb-6 pt-4 pointer-events-none z-40" dir="rtl">
      <div className="bg-[#080808]/80 backdrop-blur-2xl border border-white/10 h-16 rounded-[24px] flex items-center justify-around shadow-[0_8px_32px_rgba(0,0,0,0.8)] pointer-events-auto px-2">
        
        {items.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => { triggerFeedback('pop'); navigate(item.path); }}
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all active:scale-90 ${
                isActive ? 'text-white' : 'text-white/30 hover:text-white/60'
              }`}
            >
              <Icon size={22} className={isActive ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : ''} />
              {isActive && <span className="w-1 h-1 bg-white rounded-full mt-1 shadow-[0_0_5px_white]"></span>}
            </button>
          );
        })}

        <div className="w-px h-8 bg-white/10 mx-1"></div>

        {/* כפתור המבורגר עם הנקודה האדומה המהבהבת */}
        <button
          onClick={onMenuClick}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all active:scale-90 text-white/30 hover:text-white relative"
        >
          <Menu size={24} />
          {hasUnread && (
            <motion.span
              animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#080808] shadow-[0_0_8px_rgba(239,68,68,0.8)]"
            ></motion.span>
          )}
        </button>
      </div>
    </div>
  );
};
