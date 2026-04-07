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
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden" dir="rtl">

      {/* Background Decor (Accent Glow) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div
          animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.05, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-15%] right-[-10%] w-[70%] h-[50%] bg-accent-primary/10 blur-[120px] rounded-full"
        />
        <motion.div
          animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.1, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[40%] bg-white/5 blur-[100px] rounded-full"
        />
      </div>

      <div className="w-full max-w-sm z-10 perspective-[1200px]">

        {/* Cinematic Logo */}
        <div className="mb-14 text-center flex justify-center perspective-[1200px]">
          <motion.h1
            initial={{ opacity: 0, rotateX: 90, y: 40, letterSpacing: "0.4em", filter: "blur(10px)" }}
            animate={{ opacity: 1, rotateX: 0, y: 0, letterSpacing: "-0.05em", filter: "blur(0px)" }}
            transition={{ duration: 2.8, ease: [0.22, 1, 0.36, 1], opacity: { duration: 2 } }}
            className="text-7xl font-black text-brand italic select-none drop-shadow-[0_0_30px_rgba(255,255,255,0.1)] origin-bottom"
          >
            INNER
          </motion.h1>
        </div>

        {/* Content Container */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
        >
          {/* Tab Switcher */}
          <div className="flex bg-surface-card p-1 rounded-[20px] mb-10 border border-surface-border relative shadow-inner">
            <button
              type="button"
              onClick={() => { triggerFeedback('pop'); setIsLogin(true); }}
              className={`flex-1 py-3.5 rounded-xl font-black text-[13px] uppercase tracking-widest transition-all z-10 ${isLogin ? 'text-black' : 'text-brand-muted'}`}
            >
              כניסה
            </button>
            <button
              type="button"
              onClick={() => { triggerFeedback('pop'); setIsLogin(false); }}
              className={`flex-1 py-3.5 rounded-xl font-black text-[13px] uppercase tracking-widest transition-all z-10 ${!isLogin ? 'text-black' : 'text-brand-muted'}`}
            >
              הרשמה
            </button>
            <motion.div
              layout
              transition={{ type: "spring", stiffness: 800, damping: 45 }}
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-[16px] shadow-md pointer-events-none"
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
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-5 overflow-hidden"
                >
                  <div className="relative group">
                    <User className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-muted group-focus-within:text-accent-primary transition-colors" size={18} />
                    <input
                      type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                      placeholder="שם מלא"
                      className="w-full bg-surface-card border border-surface-border rounded-[24px] h-[56px] pr-12 pl-5 text-brand placeholder:text-brand-muted/50 outline-none focus:border-accent-primary/50 transition-all font-bold shadow-sm"
                    />
                  </div>
                  <div className="relative group">
                    <AtSign className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-muted group-focus-within:text-accent-primary transition-colors" size={18} />
                    <input
                      type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      placeholder="שם משתמש באנגלית" dir="ltr"
                      className="w-full bg-surface-card border border-surface-border rounded-[24px] h-[56px] pr-12 pl-5 text-left text-brand placeholder:text-brand-muted/50 outline-none focus:border-accent-primary/50 transition-all font-bold placeholder:text-right shadow-sm"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative group">
              <Mail className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-muted group-focus-within:text-accent-primary transition-colors" size={18} />
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="אימייל" dir="ltr"
                className="w-full bg-surface-card border border-surface-border rounded-[24px] h-[56px] pr-12 pl-5 text-left text-brand placeholder:text-brand-muted/50 outline-none focus:border-accent-primary/50 transition-all font-bold placeholder:text-right shadow-sm"
              />
            </div>

            <div className="relative group">
              <Lock className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-muted group-focus-within:text-accent-primary transition-colors" size={18} />
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="סיסמה" dir="ltr"
                className="w-full bg-surface-card border border-surface-border rounded-[24px] h-[56px] pr-12 pl-5 text-left text-brand placeholder:text-brand-muted/50 outline-none focus:border-accent-primary/50 transition-all font-bold placeholder:text-right shadow-sm"
              />
            </div>

            {/* Main Action Circular Button */}
            <div className="flex justify-center mt-8">
              <button
                type="submit"
                disabled={loading}
                className="group relative w-[64px] h-[64px] bg-white text-black active:scale-95 rounded-full flex items-center justify-center transition-all disabled:opacity-50 disabled:scale-100 shadow-[0_10px_40px_rgba(255,255,255,0.15)] hover:shadow-[0_10px_50px_rgba(255,255,255,0.2)]"
              >
                {loading ? (
                  <Loader2 size={26} className="animate-spin text-black" />
                ) : (
                  <ChevronLeft size={28} className="transition-transform group-hover:-translate-x-1" strokeWidth={2.5} />
                )}
              </button>
            </div>
          </form>
        </motion.div>

      </div>
    </div>
  );
};
