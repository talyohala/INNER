import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2, Mail, Lock, User, AtSign, ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { triggerFeedback } from '../lib/sound';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerFeedback('pop');
    
    if (!email || !password) {
      triggerFeedback('error');
      return toast.error('נא למלא את כל הפרטים');
    }
    
    setLoading(true);
    const tid = toast.loading(isLogin ? 'מתחבר...' : 'יוצר חשבון...');
    
    try {
      if (isLogin) {
        await signIn(email, password);
        triggerFeedback('success');
        toast.success('ברוך הבא! 🍸', { id: tid });
        navigate('/');
      } else {
        if (!fullName || !username) throw new Error('חובה למלא שם מלא ושם משתמש');
        await signUp(email, password, { full_name: fullName, username: username.toLowerCase() });
        triggerFeedback('success');
        toast.success('ההרשמה הצליחה! 👑', { id: tid });
        navigate('/');
      }
    } catch (err: any) {
      triggerFeedback('error');
      toast.error(err.message || 'שגיאה באימות', { id: tid });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden" dir="rtl">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.05, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-15%] right-[-10%] w-[70%] h-[50%] bg-white/[0.03] blur-[120px] rounded-full" 
        />
        <motion.div 
          animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.1, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[40%] bg-white/[0.02] blur-[100px] rounded-full" 
        />
      </div>

      <div className="w-full max-w-sm z-10">
        
        {/* Animated Logo (Intro Effect) */}
        <motion.div 
          initial={{ opacity: 0, scale: 1.15, filter: "blur(12px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="mb-14 text-center flex justify-center"
        >
          <h1 className="text-7xl font-black text-white tracking-tighter italic select-none drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]">
            INNER
          </h1>
        </motion.div>

        {/* Content Container (Fades in slightly after the logo) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
        >
          {/* Tab Switcher */}
          <div className="flex bg-white/[0.03] p-1 rounded-2xl mb-10 border border-white/5 relative">
            <button 
              type="button"
              onClick={() => { triggerFeedback('pop'); setIsLogin(true); }}
              className={`flex-1 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all z-10 ${isLogin ? 'text-black' : 'text-white/40 hover:text-white/70'}`}
            >
              כניסה
            </button>
            <button 
              type="button"
              onClick={() => { triggerFeedback('pop'); setIsLogin(false); }}
              className={`flex-1 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all z-10 ${!isLogin ? 'text-black' : 'text-white/40 hover:text-white/70'}`}
            >
              הרשמה
            </button>
            <motion.div
              layout
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white/90 backdrop-blur-md rounded-xl shadow-xl pointer-events-none"
              animate={{ right: isLogin ? "4px" : "calc(50%)" }}
            />
          </div>

          {/* Form Container */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div 
                  key="signup-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-col gap-5 overflow-hidden"
                >
                  <div className="relative group">
                    <User className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white/50 transition-colors" size={18} />
                    <input 
                      type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                      placeholder="שם מלא"
                      className="w-full bg-white/[0.02] border border-white/10 rounded-[22px] h-14 pr-12 pl-4 text-white placeholder:text-white/20 outline-none focus:border-white/30 focus:bg-white/[0.05] transition-all font-medium"
                    />
                  </div>
                  <div className="relative group">
                    <AtSign className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white/50 transition-colors" size={18} />
                    <input 
                      type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      placeholder="שם משתמש באנגלית" dir="ltr"
                      className="w-full bg-white/[0.02] border border-white/10 rounded-[22px] h-14 pr-12 pl-4 text-left text-white placeholder:text-white/20 outline-none focus:border-white/30 focus:bg-white/[0.05] transition-all font-medium placeholder:text-right"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative group">
              <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white/50 transition-colors" size={18} />
              <input 
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="אימייל" dir="ltr"
                className="w-full bg-white/[0.02] border border-white/10 rounded-[22px] h-14 pr-12 pl-4 text-left text-white placeholder:text-white/20 outline-none focus:border-white/30 focus:bg-white/[0.05] transition-all font-medium placeholder:text-right"
              />
            </div>

            <div className="relative group">
              <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white/50 transition-colors" size={18} />
              <input 
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="סיסמה" dir="ltr"
                className="w-full bg-white/[0.02] border border-white/10 rounded-[22px] h-14 pr-12 pl-4 text-left text-white placeholder:text-white/20 outline-none focus:border-white/30 focus:bg-white/[0.05] transition-all font-medium placeholder:text-right"
              />
            </div>

            {/* Centered Circular Submit Button (Translucent White) */}
            <div className="flex justify-center mt-8">
              <button 
                type="submit" 
                disabled={loading}
                className="group relative w-[64px] h-[64px] bg-white/85 backdrop-blur-xl hover:bg-white active:scale-90 rounded-full flex items-center justify-center transition-all disabled:opacity-50 disabled:scale-100 shadow-[0_0_25px_rgba(255,255,255,0.1)] hover:shadow-[0_0_35px_rgba(255,255,255,0.2)] border border-white/40"
              >
                {loading ? (
                  <Loader2 size={28} className="animate-spin text-black/80" />
                ) : (
                  <ChevronLeft size={30} className="text-black/90 transition-transform group-hover:-translate-x-1" strokeWidth={2.5} />
                )}
              </button>
            </div>
          </form>
        </motion.div>

      </div>
    </div>
  );
};
