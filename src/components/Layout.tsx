import React, { useState, useEffect } from 'react';      
import { createPortal } from 'react-dom';                
import { useLocation, useNavigate } from 'react-router-dom';                                                      
import { motion, AnimatePresence } from 'framer-motion'; 
import {                                                   
  PlusCircle, Wallet, Bell, ShoppingBag, Settings, LogOut, Radar, MessageSquare                                           
} from 'lucide-react';                                   
import { useAuth } from '../context/AuthContext';        
import { triggerFeedback } from '../lib/sound';          
import { BottomNav } from './BottomNav';                                                                          

export const Layout = ({ children }: { children: React.ReactNode }) => {                                            
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);                                                        
  const [mounted, setMounted] = useState(false);           
  const location = useLocation();                          
  const navigate = useNavigate();                          
  const { user, signOut, unreadCount, pendingSignalsCount } = useAuth() as any;                                                                                                                   
  
  useEffect(() => { setMounted(true); }, []);                                                                                                           
  useEffect(() => { setIsSidebarOpen(false); }, [location.pathname]);                                                                                          
  
  if (location.pathname === '/auth') return <>{children}</>;                                                                                                                 
  
  const gridItems = [
    { path: '/radar', icon: Radar, label: 'רדאר', badge: pendingSignalsCount > 0, colorClass: 'text-indigo-400', bgClass: 'bg-indigo-400/10' },                                                       
    { path: '/inbox', icon: MessageSquare, label: 'הודעות', colorClass: 'text-pink-400', bgClass: 'bg-pink-400/10' },                                                       
    { path: '/wallet', icon: Wallet, label: 'ארנק', colorClass: 'text-amber-400', bgClass: 'bg-amber-400/10' },                                                       
    { path: '/store', icon: ShoppingBag, label: 'חנות', colorClass: 'text-fuchsia-400', bgClass: 'bg-fuchsia-400/10' },                                                       
    { path: '/notifications', icon: Bell, label: 'התראות', badge: unreadCount > 0, colorClass: 'text-blue-400', bgClass: 'bg-blue-400/10' },                                                       
    { path: '/create-circle', icon: PlusCircle, label: 'מועדון', colorClass: 'text-emerald-400', bgClass: 'bg-emerald-400/10' },                                                     
  ];                                                                                                                
  
  const closeSidebar = () => setIsSidebarOpen(false);                                                               
  
  return (                                                   
    <div className="bg-surface min-h-screen text-brand overflow-x-hidden font-sans">                                          
      <main className="relative z-0 pb-24 min-h-screen">{children}</main>                                                                                                        
      
      {user && (                                                 
        <BottomNav                                                 
          onMenuClick={() => { triggerFeedback('pop'); setIsSidebarOpen(true); }}                                                       
          hasUnread={unreadCount > 0} 
          hasPendingSignals={pendingSignalsCount > 0}                           
        />                                                     
      )}                                                                                                                
      
      {mounted && createPortal(                                  
        <AnimatePresence>                                          
          {isSidebarOpen && (                                        
            <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl">                                      
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeSidebar} />                                                                                                                
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.3} onDragEnd={(_, info) => { if (info.offset.y > 100 || info.velocity.y > 500) closeSidebar(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="relative z-10 bg-surface rounded-t-[40px] p-6 pb-[calc(env(safe-area-inset-bottom)+24px)] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border touch-none">                                                          
                <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />                                                                                                       
                <div className="grid grid-cols-3 gap-3 mb-4">                      
                  {gridItems.map((item, idx) => (                         
                    <button key={idx} onClick={() => { triggerFeedback('pop'); navigate(item.path); closeSidebar(); }} className="flex flex-col items-center justify-center gap-3 p-4 rounded-[28px] bg-surface-card border border-surface-border hover:bg-white/5 active:scale-[0.95] transition-all shadow-sm relative group">                                                          
                      <div className={`w-12 h-12 rounded-[20px] ${item.bgClass} border border-white/5 flex items-center justify-center relative shadow-inner group-hover:scale-110 transition-transform`}>                                                          
                        <item.icon size={22} className={item.colorClass} strokeWidth={2} />                                           
                        {item.badge && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-surface-card shadow-sm" />}                                                     
                      </div>                                                                                                            
                      <span className="font-black text-[13px] text-brand tracking-wide">{item.label}</span>                                      
                    </button>                                              
                  ))}                                                                                                               
                </div>
                <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-surface-border/50">
                  <button onClick={() => { triggerFeedback('pop'); navigate('/settings'); closeSidebar(); }} className="w-full flex items-center justify-between p-4 rounded-[24px] bg-surface-card border border-surface-border hover:bg-white/5 active:scale-[0.98] transition-all shadow-sm">                                                          
                    <div className="flex items-center gap-3"><Settings size={20} className="text-slate-400" /><span className="text-brand text-[15px] font-black">הגדרות חשבון</span></div>
                  </button> 
                  <button onClick={async () => { triggerFeedback('pop'); closeSidebar(); try { await signOut?.(); } catch {} }} className="w-full flex items-center justify-center gap-2 p-4 rounded-[24px] bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 active:scale-[0.98] transition-all shadow-sm mt-1">                                                          
                    <LogOut size={18} className="text-red-500" strokeWidth={2.5} /><span className="text-red-500 text-[14px] font-black uppercase tracking-widest">התנתק מהמערכת</span>                                                
                  </button>                                              
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
