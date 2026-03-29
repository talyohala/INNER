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
    { icon: Zap, label: 'חנות בוסטים', path: '/store' },
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
      {/* Floating Bottom Nav Bar - זכוכית מעושנת מרחפת */}
      <nav className="fixed bottom-6 left-6 right-6 h-16 bg-white/[0.04] backdrop-blur-3xl border border-white/10 rounded-[32px] flex items-center justify-around px-2 z-40 shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button key={item.path} onClick={() => handleNav(item.path)} className={`flex flex-col items-center justify-center w-16 h-12 rounded-2xl transition-all ${isActive ? 'bg-white/10 text-white shadow-inner' : 'text-white/40 hover:text-white/70'}`}>
              <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]' : ''} />
            </button>
          );
        })}
        <button onClick={() => { triggerFeedback('pop'); setIsOpen(true); }} className="flex flex-col items-center justify-center w-16 h-12 rounded-2xl text-white/40 hover:text-white/70 transition-all">
          <Menu size={22} />
        </button>
      </nav>

      {/* Modern Sidebar Overlay - תפריט צד נקי */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setIsOpen(false)} />
          <div className="relative w-[80%] max-w-[320px] h-full bg-[#0A0A0A]/95 backdrop-blur-3xl border-l border-white/10 shadow-2xl flex flex-col p-6 animate-in slide-in-from-left duration-300">
            
            <div className="flex items-center justify-between mb-12">
              <span className="text-3xl font-black text-white tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">INNER</span>
              <button onClick={() => setIsOpen(false)} className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/60 hover:text-white transition-all"><X size={20} /></button>
            </div>

            <div className="flex flex-col gap-3">
              {menuItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNav(item.path)}
                  className="flex items-center gap-4 p-4 rounded-[24px] hover:bg-white/[0.06] border border-transparent hover:border-white/5 transition-all text-white/60 hover:text-white group"
                >
                  <div className="w-12 h-12 rounded-[18px] bg-black border border-white/10 flex items-center justify-center group-hover:bg-white/10 group-hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all">
                    <item.icon size={20} />
                  </div>
                  <span className="text-[16px] font-black tracking-tight">{item.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-auto pt-6 border-t border-white/5">
              <p className="text-[10px] font-black text-white/20 tracking-widest text-center uppercase">Inner VIP Core</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
