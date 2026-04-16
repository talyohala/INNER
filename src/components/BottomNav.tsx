import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Compass, User, Menu, Radar, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { triggerFeedback } from '../lib/sound';

interface BottomNavProps {
  onMenuClick: () => void;
  hasUnread?: boolean;
  hasPendingSignals?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onMenuClick, hasUnread, hasPendingSignals }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const items = [
    { path: '/', icon: Home, label: 'פיד' },
    { path: '/explore', icon: Compass, label: 'חיפוש' },
    { path: '/radar', icon: Radar, label: 'רדאר' },
    { path: '/profile', icon: User, label: 'פרופיל' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none" dir="rtl">
      <div className="pointer-events-auto w-full bg-surface/95 backdrop-blur-3xl border-t border-surface-border rounded-t-[30px]">
        
        <div className="flex items-center px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+6px)] min-h-[70px]">
          <div className="flex items-center justify-between gap-2 flex-1">
            {items.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              const Icon = item.icon;

              return (
                <button
                  key={item.path}
                  onClick={() => { triggerFeedback('pop'); navigate(item.path); }}
                  className={`relative flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all active:scale-90 ${isActive ? 'text-accent-primary' : 'text-brand-muted hover:text-brand'}`}
                >
                  <Icon size={28} strokeWidth={isActive ? 2.5 : 2} className="transition-all" />
                  
                  {/* הנקודה האדומה לאייקון הרדאר */}
                  {item.path === '/radar' && hasPendingSignals && (
                    <motion.span animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }} transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }} className="absolute top-2 right-2 z-20 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-surface" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 border-r border-surface-border pr-2 ml-1">
            <button onClick={() => { triggerFeedback('pop'); navigate('/inbox'); }} className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all active:scale-90 ${location.pathname.startsWith('/inbox') || location.pathname.startsWith('/chat') ? 'text-accent-primary' : 'text-brand-muted hover:text-brand'}`}>
              <MessageSquare size={28} strokeWidth={location.pathname.startsWith('/inbox') || location.pathname.startsWith('/chat') ? 2.5 : 2} />
            </button>

            <button onClick={() => { triggerFeedback('pop'); onMenuClick(); }} className="relative flex items-center justify-center w-12 h-12 rounded-full text-brand-muted active:scale-90 transition-all hover:text-brand">
              <Menu size={28} strokeWidth={2} />
              {hasUnread && <motion.span animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }} transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }} className="absolute top-2 right-2 z-20 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-surface" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
