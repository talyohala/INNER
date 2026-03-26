import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Compass, User, Menu, X, Wallet, Zap, Bell, PlusSquare, Settings } from 'lucide-react';
import { triggerFeedback } from '../lib/sound';

export const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { icon: Home, label: 'פיד', path: '/feed' },
    { icon: Compass, label: 'ראדר', path: '/discover' },
    { icon: User, label: 'פרופיל', path: '/profile' },
  ];

  const menuItems = [
    { icon: Wallet, label: 'ארנק', path: '/wallet' },
    { icon: Zap, label: 'חנות בוסטים', path: '/boosts' },
    { icon: Bell, label: 'התראות', path: '/notifications' },
    { icon: PlusSquare, label: 'יצירת קהילה', path: '/create-circle' },
    { icon: Settings, label: 'הגדרות', path: '/settings' },
  ];

  const handleNav = (path: string) => {
    triggerFeedback('pop');
    navigate(path);
    setIsOpen(false);
  };

  return (
    <>
      {/* Bottom Nav Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-black/60 backdrop-blur-3xl border-t border-white/10 flex items-center justify-around px-6 z-40">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button key={item.path} onClick={() => handleNav(item.path)} className={`flex flex-col items-center gap-1 transition-all ${isActive ? 'text-white' : 'text-white/40 hover:text-white/70'}`}>
              <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : ''} />
              <span className="text-[10px] font-black tracking-widest uppercase">{item.label}</span>
            </button>
          );
        })}
        <button onClick={() => { triggerFeedback('pop'); setIsOpen(true); }} className="flex flex-col items-center gap-1 text-white/40 hover:text-white/70">
          <Menu size={24} />
          <span className="text-[10px] font-black tracking-widest uppercase">תפריט</span>
        </button>
      </nav>

      {/* Modern Sidebar Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          
          <div className="relative w-[80%] max-w-[320px] h-full bg-[#0d0f12]/90 backdrop-blur-2xl border-l border-white/10 shadow-2xl flex flex-col p-6 animate-in slide-in-from-left duration-300">
            <div className="flex items-center justify-between mb-12">
              <span className="text-3xl font-black text-white tracking-tighter">INNER</span>
              <button onClick={() => setIsOpen(false)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/50"><X size={20} /></button>
            </div>

            <div className="flex flex-col gap-2">
              {menuItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNav(item.path)}
                  className="flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all text-white/70 hover:text-white group"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center group-hover:bg-white/10 group-hover:border-white/20 transition-all">
                    <item.icon size={20} />
                  </div>
                  <span className="text-lg font-bold tracking-tight">{item.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-auto pt-6 border-t border-white/5">
              <p className="text-[10px] font-black text-white/20 tracking-widest text-center uppercase">Inner App v1.0.0 VIP</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
