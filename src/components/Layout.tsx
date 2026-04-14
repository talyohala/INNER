import React, { useState, useEffect } from 'react';      
import { createPortal } from 'react-dom';                
import { useLocation, useNavigate } from 'react-router-dom';                                                      
import { motion, AnimatePresence } from 'framer-motion'; 
import {                                                   
  PlusCircle, Wallet, Bell, ShoppingBag, Settings, LogOut, ChevronLeft                                           
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
    { path: '/create-circle', icon: PlusCircle, label: 'צור מועדון', colorClass: 'text-emerald-400' },                                                       
    { path: '/wallet', icon: Wallet, label: 'ארנק CRD', colorClass: 'text-amber-400' },                                                       
    { path: '/notifications', icon: Bell, label: 'התראות', badge: unreadCount > 0, colorClass: 'text-blue-400' },                                                       
    { path: '/store', icon: ShoppingBag, label: 'חנות', colorClass: 'text-fuchsia-400' },                                                       
    { path: '/settings', icon: Settings, label: 'הגדרות', colorClass: 'text-slate-400' },                                                     
  ];                                                                                                                
  
  const closeSidebar = () => setIsSidebarOpen(false);                                                               
  
  return (                                                   
    <div className="bg-surface min-h-screen text-brand overflow-x-hidden font-sans">                                          
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
              
              {/* Background Backdrop */}                              
              <motion.div                                                
                initial={{ opacity: 0 }}                                 
                animate={{ opacity: 1 }}                                 
                exit={{ opacity: 0 }}                                    
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"                                                         
                onClick={closeSidebar}                                 
              />                                                                                                                
              
              {/* Bottom Sheet - Premium Dark Glass */}                       
              <motion.div                                                
                initial={{ y: '100%' }}                                  
                animate={{ y: 0 }}                                       
                exit={{ y: '100%' }}                                     
                drag="y"                                                 
                dragConstraints={{ top: 0, bottom: 0 }}                  
                dragElastic={0.3}                                        
                onDragEnd={(_, info) => {                                  
                  if (info.offset.y > 100 || info.velocity.y > 500) closeSidebar();                                               
                }}                                                       
                transition={{ type: "spring", damping: 30, stiffness: 300 }}                                                      
                className="relative z-10 bg-surface rounded-t-[40px] p-6 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border touch-none"                                                                  
              >                                                          
                
                {/* Handle Bar */}                                       
                <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />                                                                                                       
                
                <div className="flex flex-col gap-3">                      
                  {sidebarItems.map((item, idx) => (                         
                    <button                                                    
                      key={idx}                                                
                      onClick={() => {                                           
                        triggerFeedback('pop');                                  
                        navigate(item.path);                                     
                        closeSidebar();                                        
                      }}                                                       
                      className="flex items-center gap-4 p-4 rounded-[24px] bg-surface-card border border-surface-border hover:bg-white/5 active:scale-[0.98] transition-all w-full text-right group shadow-sm"                                        
                    >                                                          
                      
                      {/* Icon Container */}                                                          
                      <div className="w-12 h-12 rounded-[18px] bg-surface border border-surface-border flex items-center justify-center shrink-0 relative shadow-inner group-hover:scale-105 transition-transform">                                                          
                        <item.icon size={22} className={item.colorClass} strokeWidth={2.5} />                                           
                        {item.badge && (                                           
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-surface-card shadow-sm" />                                                            
                        )}                                                     
                      </div>                                                                                                            
                      
                      <div className="flex-1 text-right">                        
                        <span className="font-black text-[16px] text-brand">{item.label}</span>                                      
                      </div>                                                                                                            
                      
                      <ChevronLeft size={18} className="text-brand-muted" />                                                             
                    </button>                                              
                  ))}                                                                                                               
                  
                  {/* Logout Button */}
                  <div className="mt-2 pt-2">                                                                 
                    <button                                                    
                      onClick={async () => {                                     
                        triggerFeedback('pop');                                  
                        closeSidebar();                                          
                        try { await signOut?.(); } catch {}                                             
                      }}                                                       
                      className="w-full flex items-center gap-4 p-4 rounded-[24px] bg-surface-card border border-red-500/30 hover:bg-red-500/10 active:scale-[0.98] transition-all group shadow-sm"                                                     
                    >                                                          
                      <div className="w-12 h-12 rounded-[18px] bg-surface border border-red-500/30 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">                                                
                        <LogOut size={22} className="text-red-500" strokeWidth={2.5} />                                                 
                      </div>                                                   
                      <div className="flex-1 text-right">                        
                        <div className="text-red-500 text-[16px] font-black">התנתק</div>                                                
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
