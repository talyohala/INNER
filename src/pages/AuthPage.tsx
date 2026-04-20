import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2, Mail, Lock, User, AtSign, ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { triggerFeedback } from '../lib/sound';
import { supabase } from '../lib/supabase';

import MainLogoImage from '../assets/brand/icon-1024.png'; 
import CosmicBackgroundImage from '../assets/brand/Inner-wordmark.png'; 

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();

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
        if (!fullName || !username) {
          throw new Error('חובה למלא שם מלא ושם משתמש');
        }
        const authRes = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });

        if (authRes.error) throw authRes.error;

        if (authRes.data?.user) {
          const { error: profileError } = await supabase.from('profiles').insert({
            id: authRes.data.user.id,
            full_name: fullName.trim(),
            username: username.trim().toLowerCase(),
            level: 1,
            xp: 0,
            crd_balance: 100,
            role_label: 'MEMBER'
          });

          if (profileError) throw profileError;
        }

        triggerFeedback('success');
        toast.success('ההרשמה הצליחה! 👑 קיבלת 100 CRD במתנה.', { id: tid });
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
    <div className="min-h-[100dvh] bg-[#050505] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden" dir="rtl">
      
      {/* 🌌 אטמוספירה קוסמית חיה (ללא גבולות) */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <motion.img 
          src={CosmicBackgroundImage} 
          alt="Cosmic Background"
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.5 }}
          transition={{ duration: 3, ease: "easeOut" }}
          className="absolute inset-0 w-full h-full object-cover filter blur-[3px]"
        />
        
        {/* ענני ערפילית רכים להענקת עומק */}
        <motion.div 
          animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.05, 1], x: [0, 20, 0], y: [0, -10, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] right-[-15%] w-[80%] h-[60%] bg-accent-primary/10 blur-[130px] rounded-full"
        />
        <motion.div 
          animate={{ opacity: [0.1, 0.3, 0.1], scale: [1, 1.1, 1], x: [0, -15, 0], y: [0, 15, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-15%] left-[-20%] w-[70%] h-[50%] bg-white/5 blur-[110px] rounded-full"
        />

        {/* חלקיקי אבק כוכבים */}
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              scale: Math.random() * 0.7 + 0.3,
            }}
            animate={{ opacity: [0, 0.8, 0] }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 5,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-sm z-10 flex flex-col items-center">
        
        {/* 👑 לוגו מרכזי צף - עם mix-blend-screen להעלמת הרקע השחור */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8, y: -30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 relative flex justify-center w-full"
        >
          <motion.img 
            src={MainLogoImage} 
            alt="INNER Logo" 
            // mix-blend-screen הוא קסם ה-CSS שמעלים את הרקע השחור של התמונה ומשאיר רק את הלבן!
            className="h-32 w-auto select-none drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] origin-bottom z-10 object-contain mix-blend-screen"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        {/* 💎 אזור הטופס - ללא מסגרת רקע (Borderless) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 1.2, delay: 0.5, ease: "easeOut" }}
          className="w-full flex flex-col"
        >
          {/* Tab Switcher - מעודן ומרחף */}
          <div className="flex bg-white/5 backdrop-blur-md p-1 rounded-full mb-10 border border-white/10 relative shadow-inner mx-4">
            <button
              type="button"
              onClick={() => { triggerFeedback('pop'); setIsLogin(true); }}
              className={`flex-1 py-3 rounded-full font-black text-[13px] uppercase tracking-widest transition-all z-10 ${isLogin ? 'text-white' : 'text-white/40 hover:text-white/80'}`}
            >
              כניסה
            </button>
            <button
              type="button"
              onClick={() => { triggerFeedback('pop'); setIsLogin(false); }}
              className={`flex-1 py-3 rounded-full font-black text-[13px] uppercase tracking-widest transition-all z-10 ${!isLogin ? 'text-white' : 'text-white/40 hover:text-white/80'}`}
            >
              הרשמה
            </button>
            <motion.div
              layout
              transition={springConfig}
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white/20 border border-white/20 rounded-full shadow-md pointer-events-none"
              animate={{ right: isLogin ? "4px" : "calc(50%)" }}
            />
          </div>

          {/* Form Container */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <AnimatePresence initial={false}>
              {!isLogin && (
                <motion.div
                  key="signup-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ opacity: { duration: 0.2 }, height: springConfig }}
                  className="overflow-hidden flex flex-col gap-4"
                >
                  <div className="relative group">
                    <User className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-accent-primary transition-colors" size={18} />
                    <input
                      type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                      placeholder="שם מלא"
                      className="w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-full h-[56px] pr-12 pl-5 text-white placeholder:text-white/30 outline-none focus:border-accent-primary/50 focus:bg-white/10 transition-all font-bold shadow-inner"
                    />
                  </div>
                  <div className="relative group">
                    <AtSign className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-accent-primary transition-colors" size={18} />
                    <input
                      type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ''))}
                      placeholder="שם משתמש באנגלית" dir="ltr"
                      className="w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-full h-[56px] pr-12 pl-5 text-left text-white placeholder:text-white/30 outline-none focus:border-accent-primary/50 focus:bg-white/10 transition-all font-bold placeholder:text-right shadow-inner"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div layout transition={springConfig} className="relative group">
              <Mail className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-accent-primary transition-colors" size={18} />
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="אימייל" dir="ltr"
                className="w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-full h-[56px] pr-12 pl-5 text-left text-white placeholder:text-white/30 outline-none focus:border-accent-primary/50 focus:bg-white/10 transition-all font-bold placeholder:text-right shadow-inner"
              />
            </motion.div>

            <motion.div layout transition={springConfig} className="relative group mb-2">
              <Lock className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-accent-primary transition-colors" size={18} />
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="סיסמה" dir="ltr"
                className="w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-full h-[56px] pr-12 pl-5 text-left text-white placeholder:text-white/30 outline-none focus:border-accent-primary/50 focus:bg-white/10 transition-all font-bold placeholder:text-right shadow-inner"
              />
            </motion.div>

            {/* 💡 כפתור פעולה מורחב ואלגנטי */}
            <motion.div layout transition={springConfig} className="mt-6 relative">
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full h-[60px] rounded-full overflow-hidden flex items-center justify-center active:scale-[0.98] transition-all disabled:opacity-50 shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
              >
                {/* רקע הכפתור */}
                <div className="absolute inset-0 bg-accent-primary/20 group-hover:bg-accent-primary/30 transition-colors backdrop-blur-md" />
                {/* גבול בוהק עדין */}
                <div className="absolute inset-0 border border-accent-primary/50 rounded-full" />
                
                <div className="relative z-10 flex items-center gap-3 text-white">
                  {loading ? (
                    <Loader2 size={22} className="animate-spin" />
                  ) : (
                    <>
                      <span className="font-black text-[15px] uppercase tracking-widest">
                        {isLogin ? 'היכנס למערכת' : 'הצטרף עכשיו'}
                      </span>
                      <ChevronLeft size={20} className="transition-transform group-hover:-translate-x-1" strokeWidth={2.5} />
                    </>
                  )}
                </div>
              </button>
            </motion.div>
          </form>
        </motion.div>
      </div>

      {/* שכבת עומק: אפקט כוכבים נופלים עדין (Subtle Shooting Stars) */}
      {[...Array(2)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-[150px] h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent rotate-[-45deg]"
          style={{
            top: `${Math.random() * 30}%`,
            left: `${Math.random() * 30 + 70}%`,
          }}
          animate={{ x: [-300, 500], y: [300, -500], opacity: [0, 1, 0] }}
          transition={{
            duration: Math.random() * 2 + 1.5,
            repeat: Infinity,
            delay: Math.random() * 15 + 5,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
};
