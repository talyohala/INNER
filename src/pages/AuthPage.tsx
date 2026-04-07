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

  const springConfig = { type: "spring", stiffness: 400, damping: 30 };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden" dir="rtl">

      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div
          animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.05, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-15%] right-[-10%] w-[70%] h-[50%] bg-accent-primary/10 blur-[120px] rounded-full"
        />
      </div>

      <div className="w-full max-w-sm z-10">

        {/* Cinematic Logo */}
        <div className="mb-14 text-center flex justify-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
            className="text-7xl font-black text-brand italic select-none drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]"
          >
            INNER
          </motion.h1>
        </div>

        {/* Tab Switcher - THE SLIDER PART */}
        <div className="flex bg-surface-card p-1 rounded-[20px] mb-10 border border-surface-border relative shadow-inner overflow-hidden">
          <button
            type="button"
            onClick={() => { triggerFeedback('pop'); setIsLogin(true); }}
            className={`flex-1 py-4 rounded-xl font-black text-[13px] uppercase tracking-widest transition-colors duration-300 z-10 ${isLogin ? 'text-black' : 'text-brand-muted'}`}
          >
            כניסה
          </button>
          <button
            type="button"
            onClick={() => { triggerFeedback('pop'); setIsLogin(false); }}
            className={`flex-1 py-4 rounded-xl font-black text-[13px] uppercase tracking-widest transition-colors duration-300 z-10 ${!isLogin ? 'text-black' : 'text-brand-muted'}`}
          >
            הרשמה
          </button>
          
          {/* המעבר הלבן החלק */}
          <motion.div
            layout
            initial={false}
            transition={{ 
              type: "spring", 
              stiffness: 500, 
              damping: 38, 
              mass: 1 
            }}
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-[16px] shadow-[0_2px_10px_rgba(0,0,0,0.2)] pointer-events-none"
            animate={{ 
              right: isLogin ? "4px" : "calc(50%)",
            }}
          />
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex flex-col">
          <AnimatePresence initial={false} mode="wait">
            {!isLogin && (
              <motion.div
                key="signup"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={springConfig}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-5 pb-5">
                  <div className="relative group">
                    <User className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-muted group-focus-within:text-accent-primary transition-colors" size={18} />
                    <input
                      type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                      placeholder="שם מלא"
                      className="w-full bg-surface-card border border-surface-border rounded-[24px] h-[56px] pr-12 pl-5 text-brand outline-none focus:border-accent-primary/50 transition-all font-bold shadow-sm"
                    />
                  </div>
                  <div className="relative group">
                    <AtSign className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-muted group-focus-within:text-accent-primary transition-colors" size={18} />
                    <input
                      type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      placeholder="username" dir="ltr"
                      className="w-full bg-surface-card border border-surface-border rounded-[24px] h-[56px] pr-12 pl-5 text-left text-brand outline-none focus:border-accent-primary/50 transition-all font-bold placeholder:text-right shadow-sm"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-5">
            <div className="relative group">
              <Mail className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-muted group-focus-within:text-accent-primary transition-colors" size={18} />
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="אימייל" dir="ltr"
                className="w-full bg-surface-card border border-surface-border rounded-[24px] h-[56px] pr-12 pl-5 text-left text-brand outline-none focus:border-accent-primary/50 transition-all font-bold placeholder:text-right shadow-sm"
              />
            </div>

            <div className="relative group">
              <Lock className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-muted group-focus-within:text-accent-primary transition-colors" size={18} />
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="סיסמה" dir="ltr"
                className="w-full bg-surface-card border border-surface-border rounded-[24px] h-[56px] pr-12 pl-5 text-left text-brand outline-none focus:border-accent-primary/50 transition-all font-bold placeholder:text-right shadow-sm"
              />
            </div>
          </div>

          <div className="flex justify-center mt-10">
            <button
              type="submit"
              disabled={loading}
              className="group relative w-[68px] h-[68px] bg-white text-black active:scale-90 rounded-full flex items-center justify-center transition-all disabled:opacity-50 shadow-[0_10px_40px_rgba(255,255,255,0.1)]"
            >
              {loading ? (
                <Loader2 size={26} className="animate-spin text-black" />
              ) : (
                <ChevronLeft size={30} className="transition-transform group-hover:-translate-x-1" strokeWidth={2.5} />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
