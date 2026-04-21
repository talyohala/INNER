import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { triggerFeedback } from '../lib/sound';
import { supabase } from '../lib/supabase';

const cleanToastStyle = {
  background: 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(10px)',
  color: '#0f172a',
  border: '1px solid rgba(0,0,0,0.05)',
  borderRadius: '100px',
  fontSize: '14px',
  fontWeight: 600,
  padding: '12px 24px',
  boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
};

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
      return toast('נא למלא את כל הפרטים', { style: cleanToastStyle });
    }

    setLoading(true);
    const tid = toast(isLogin ? 'מתחבר למערכת...' : 'יוצר חשבון...', { style: cleanToastStyle });

    try {
      if (isLogin) {
        await signIn(email, password);
        triggerFeedback('success');
        toast('התחברת בהצלחה', { id: tid, style: cleanToastStyle });
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
        toast('החשבון נוצר בהצלחה', { id: tid, style: cleanToastStyle });
        navigate('/');
      }
    } catch (err: any) {
      triggerFeedback('error');
      toast(err.message || 'שגיאה באימות', { id: tid, style: cleanToastStyle });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden bg-[#e5edff]" dir="rtl">
      
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-[#c1bbf2] rounded-full opacity-70 blur-[100px]" />
        <div className="absolute top-[-20%] right-[-20%] w-[70%] h-[70%] bg-[#ffffff] rounded-full opacity-100 blur-[90px]" />
        <div className="absolute bottom-[-10%] left-[-20%] w-[70%] h-[70%] bg-[#a9a3f8] rounded-full opacity-50 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[80%] h-[80%] bg-[#a5d6ff] rounded-full opacity-60 blur-[120px]" />
      </div>

      <div className="w-full max-w-sm z-10 flex flex-col">
        
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center mb-10 mt-4 relative"
        >
          <div className="absolute inset-0 bg-white/40 blur-[30px] rounded-full scale-110" />
          
          {/* הוספת הלוגו הוקטורי (dir="ltr" כדי שהלוגו יישאר משמאל לטקסט האנגלי) */}
          <div className="flex items-center justify-center gap-4 mb-6 relative z-10" dir="ltr">
            <svg width="48" height="48" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-900 drop-shadow-[0_2px_15px_rgba(255,255,255,1)]">
              <path
                d="M171 113 C171 113 323 113 342 113 C339 118 333 123 327 128 L226 197 C220 201 214 205 208 209 L210 157 C211 142 205 127 171 113Z"
                fill="currentColor"
              />
              <path
                d="M208 233 L287 178 L276 392 C275 429 289 446 316 460 L173 460 C181 451 186 443 187 430 L208 233Z"
                fill="currentColor"
              />
            </svg>
            
            <h1 className="text-[44px] font-sans font-black tracking-[0.35em] uppercase select-none relative group pt-2">
              <span className="text-slate-900 drop-shadow-[0_2px_15px_rgba(255,255,255,1)]">
                INNER
              </span>
              <motion.span
                className="absolute inset-0 text-transparent bg-clip-text"
                style={{
                  backgroundImage: 'linear-gradient(120deg, transparent 25%, rgba(255,255,255,0.9) 50%, transparent 75%)',
                  backgroundSize: '200% 100%',
                  WebkitBackgroundClip: 'text',
                }}
                initial={{ backgroundPosition: '200% 0%' }}
                animate={{ backgroundPosition: ['200% 0%', '-100% 0%'] }}
                transition={{ duration: 2.5, ease: "easeInOut", repeat: 0, delay: 0.5 }}
              >
                INNER
              </motion.span>
            </h1>
          </div>

          <h2 className="text-2xl font-black text-slate-800 tracking-tight drop-shadow-sm relative z-10">
            {isLogin ? 'התחברות לחשבון' : 'יצירת חשבון'}
          </h2>
        </motion.div>

        <motion.form
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 w-full"
        >
          <AnimatePresence initial={false} mode="popLayout">
            {!isLogin && (
              <motion.div
                key="signup-fields"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-col gap-4 overflow-hidden"
              >
                <div className="flex flex-col">
                  <label className="text-slate-700 text-[13px] mb-1.5 font-bold tracking-wide pl-1">שם מלא</label>
                  <input
                    type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                    placeholder="שם מלא"
                    className="w-full bg-white/40 backdrop-blur-md border border-white/60 rounded-[16px] h-[52px] px-5 text-slate-900 placeholder:text-slate-500 outline-none focus:border-accent-primary/60 focus:bg-white/60 transition-all font-bold shadow-sm"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-slate-700 text-[13px] mb-1.5 font-bold tracking-wide pl-1">שם משתמש</label>
                  <input
                    type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ''))}
                    placeholder="username" dir="ltr"
                    className="w-full bg-white/40 backdrop-blur-md border border-white/60 rounded-[16px] h-[52px] px-5 text-left text-slate-900 placeholder:text-slate-500 outline-none focus:border-accent-primary/60 focus:bg-white/60 transition-all font-bold shadow-sm placeholder:text-right"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col">
            <label className="text-slate-700 text-[13px] mb-1.5 font-bold tracking-wide pl-1">אימייל</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com" dir="ltr"
              className="w-full bg-white/40 backdrop-blur-md border border-white/60 rounded-[16px] h-[52px] px-5 text-left text-slate-900 placeholder:text-slate-500 outline-none focus:border-accent-primary/60 focus:bg-white/60 transition-all font-bold shadow-sm placeholder:text-right"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-slate-700 text-[13px] mb-1.5 font-bold tracking-wide pl-1">סיסמה</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" dir="ltr"
              className="w-full bg-white/40 backdrop-blur-md border border-white/60 rounded-[16px] h-[52px] px-5 text-left text-slate-900 placeholder:text-slate-500 outline-none focus:border-accent-primary/60 focus:bg-white/60 transition-all font-bold shadow-sm placeholder:text-right"
            />
          </div>

          {/* כפתור מלבני וקטן יותר עם חץ שמאלה */}
          <div className="flex justify-center mt-6 w-full">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center w-[110px] h-[48px] rounded-[14px] bg-white text-slate-900 active:scale-[0.98] transition-all disabled:opacity-50 shadow-[0_5px_20px_rgba(0,0,0,0.08)] hover:bg-gray-50 border border-white/80"
            >
              {loading ? (
                <Loader2 size={24} className="animate-spin text-slate-900" />
              ) : (
                <ArrowLeft size={24} strokeWidth={2.5} />
              )}
            </button>
          </div>
        </motion.form>

        <div className="mt-10 text-center">
          <button
            onClick={() => { triggerFeedback('pop'); setIsLogin(!isLogin); }}
            className="text-slate-600 font-bold text-[14px] hover:text-slate-900 transition-colors drop-shadow-sm"
          >
            {isLogin ? 'אין לך חשבון? הירשם עכשיו' : 'כבר יש לך חשבון? התחבר'}
          </button>
        </div>

      </div>
    </div>
  );
};
