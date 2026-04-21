import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { triggerFeedback } from '../lib/sound';
import { supabase } from '../lib/supabase';

// טוסט לבן שקוף ויוקרתי (Glassmorphism)
const cleanToastStyle = {
  background: 'rgba(255, 255, 255, 0.5)',
  backdropFilter: 'blur(12px)',
  color: '#0f172a',
  border: '1px solid rgba(255, 255, 255, 0.4)',
  borderRadius: '100px',
  fontSize: '14px',
  fontWeight: 700,
  padding: '12px 24px',
  boxShadow: '0 10px 40px rgba(0,0,0,0.05)',
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
          className="flex flex-col items-center mb-14 -mt-10 relative"
        >
          <div className="absolute inset-0 bg-white/40 blur-[45px] rounded-full scale-[1.4]" />
          
          <div className="relative flex flex-col items-center justify-center gap-4 select-none z-10" dir="ltr">
            
            {/* סמל I מוגדל */}
            <div className="flex flex-col items-center gap-3 text-slate-900 drop-shadow-[0_2px_15px_rgba(255,255,255,1)]">
              <svg width="100" height="100" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M171 113 C171 113 323 113 342 113 C339 118 333 123 327 128 L226 197 C220 201 214 205 208 209 L210 157 C211 142 205 127 171 113Z" fill="currentColor"/>
                <path d="M208 233 L287 178 L276 392 C275 429 289 446 316 460 L173 460 C181 451 186 443 187 430 L208 233Z" fill="currentColor"/>
              </svg>
              <h1 className="text-[14px] font-sans font-black tracking-[0.6em] uppercase pl-2 opacity-90">
                INNER
              </h1>
            </div>

            {/* ברק שעובר פעם אחת */}
            <motion.div 
              className="absolute inset-0 flex flex-col items-center gap-3 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.9)]"
              style={{
                WebkitMaskImage: 'linear-gradient(120deg, transparent 20%, black 50%, transparent 80%)',
                WebkitMaskSize: '300% 100%',
                WebkitMaskRepeat: 'no-repeat'
              }}
              initial={{ WebkitMaskPosition: '150% 0%' }}
              animate={{ WebkitMaskPosition: '-50% 0%' }}
              transition={{ duration: 2.2, ease: "easeInOut", delay: 0.6 }}
            >
              <svg width="100" height="100" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M171 113 C171 113 323 113 342 113 C339 118 333 123 327 128 L226 197 C220 201 214 205 208 209 L210 157 C211 142 205 127 171 113Z" fill="currentColor"/>
                <path d="M208 233 L287 178 L276 392 C275 429 289 446 316 460 L173 460 C181 451 186 443 187 430 L208 233Z" fill="currentColor"/>
              </svg>
              <h1 className="text-[14px] font-sans font-black tracking-[0.6em] uppercase pl-2">
                INNER
              </h1>
            </motion.div>

          </div>
        </motion.div>

        <motion.form
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 w-full px-2"
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
                  <label className="text-slate-600 text-[13px] mb-1.5 font-bold tracking-wide pl-1">שם מלא</label>
                  <input
                    type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                    placeholder="שם מלא"
                    className="w-full bg-white/40 backdrop-blur-md border border-white/60 rounded-[14px] h-[54px] px-4 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-accent-primary/60 focus:bg-white/60 transition-all font-bold shadow-sm"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-slate-600 text-[13px] mb-1.5 font-bold tracking-wide pl-1">שם משתמש</label>
                  <input
                    type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ''))}
                    placeholder="username" dir="ltr"
                    className="w-full bg-white/40 backdrop-blur-md border border-white/60 rounded-[14px] h-[54px] px-4 text-[15px] text-left text-slate-900 placeholder:text-slate-400 outline-none focus:border-accent-primary/60 focus:bg-white/60 transition-all font-bold shadow-sm placeholder:text-right"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col">
            <label className="text-slate-600 text-[13px] mb-1.5 font-bold tracking-wide pl-1">אימייל</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com" dir="ltr"
              className="w-full bg-white/40 backdrop-blur-md border border-white/60 rounded-[14px] h-[54px] px-4 text-[15px] text-left text-slate-900 placeholder:text-slate-400 outline-none focus:border-accent-primary/60 focus:bg-white/60 transition-all font-bold shadow-sm placeholder:text-right"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-slate-600 text-[13px] mb-1.5 font-bold tracking-wide pl-1">סיסמה</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" dir="ltr"
              className="w-full bg-white/40 backdrop-blur-md border border-white/60 rounded-[14px] h-[54px] px-4 text-[15px] text-left text-slate-900 placeholder:text-slate-400 outline-none focus:border-accent-primary/60 focus:bg-white/60 transition-all font-bold shadow-sm placeholder:text-right"
            />
          </div>

          <div className="flex justify-center mt-6 w-full">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center w-[110px] h-[50px] rounded-[14px] bg-white text-slate-900 active:scale-[0.96] transition-all disabled:opacity-50 shadow-[0_5px_15px_rgba(0,0,0,0.06)] hover:bg-gray-50 border border-white/80"
            >
              {loading ? (
                <Loader2 size={22} className="animate-spin text-slate-900" />
              ) : (
                <ArrowLeft size={24} strokeWidth={2.5} />
              )}
            </button>
          </div>
        </motion.form>

        <div className="mt-10 text-center">
          <button
            onClick={() => { triggerFeedback('pop'); setIsLogin(!isLogin); }}
            className="text-slate-500 font-bold text-[13px] hover:text-slate-900 transition-colors drop-shadow-sm"
          >
            {isLogin ? 'אין לך חשבון? הירשם עכשיו' : 'כבר יש לך חשבון? התחבר'}
          </button>
        </div>

      </div>
    </div>
  );
};
