import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { triggerFeedback } from '../lib/sound';
import { supabase } from '../lib/supabase';

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

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden bg-[#050505]" dir="rtl">
      
      {/* רקע גרדיאנט סטטי וחלק מבוסס על צבע האקסנט של האפליקציה (ללא ריצודים) */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {/* אקסנט פרימרי (הצבע הראשי של האפליקציה) */}
        <div className="absolute bottom-[-20%] right-[-10%] w-[80%] h-[70%] bg-accent-primary rounded-full mix-blend-screen opacity-40 blur-[100px]" />
        {/* צבע משלים בהיר (טורקיז/ציאן) להוספת עומק */}
        <div className="absolute bottom-[-10%] left-[-10%] w-[70%] h-[60%] bg-[#00DDFF] rounded-full mix-blend-screen opacity-20 blur-[100px]" />
        {/* צבע משלים כהה (סגול/כחול כהה) ליצירת מעבר חלק */}
        <div className="absolute bottom-[-30%] left-[20%] w-[60%] h-[60%] bg-[#4f46e5] rounded-full mix-blend-screen opacity-30 blur-[120px]" />
      </div>

      <div className="w-full max-w-sm z-10 flex flex-col">
        
        {/* לוגו INNER עם אנימציית מעבר אור מרהיבה (Shimmer Effect) */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center mb-10 mt-4 relative"
        >
          {/* הילה קבועה מתחת לטקסט */}
          <div className="absolute inset-0 bg-white/5 blur-[30px] rounded-full scale-110" />
          
          <h1 className="text-[42px] font-black tracking-[0.25em] uppercase mb-8 select-none pl-3 relative group">
            {/* הטקסט הלבן הבסיסי */}
            <span className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]">
              INNER
            </span>
            {/* שכבת האור המסתובבת - Shimmer */}
            <motion.span 
              className="absolute inset-0 text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(120deg, transparent 25%, rgba(255,255,255,0.8) 50%, transparent 75%)',
                backgroundSize: '200% 100%',
                WebkitBackgroundClip: 'text',
              }}
              animate={{
                backgroundPosition: ['100% 0%', '-100% 0%'],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              INNER
            </motion.span>
          </h1>
          
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {isLogin ? 'התחברות לחשבון' : 'יצירת חשבון'}
          </h2>
        </motion.div>

        {/* טופס */}
        <motion.form 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          transition={{ duration: 0.8, delay: 0.2 }}
          onSubmit={handleSubmit} 
          className="flex flex-col gap-5 w-full"
        >
          <AnimatePresence initial={false} mode="popLayout">
            {!isLogin && (
              <motion.div
                key="signup-fields"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-col gap-5 overflow-hidden"
              >
                <div className="flex flex-col">
                  <label className="text-white/90 text-[14px] mb-2 font-medium">שם מלא</label>
                  <input
                    type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                    placeholder="שם מלא"
                    className="w-full bg-[#1C1C1E]/60 backdrop-blur-sm border border-white/5 rounded-[12px] h-[52px] px-4 text-white placeholder:text-white/30 outline-none focus:border-accent-primary/50 transition-all font-medium"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-white/90 text-[14px] mb-2 font-medium">שם משתמש</label>
                  <input
                    type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ''))}
                    placeholder="username" dir="ltr"
                    className="w-full bg-[#1C1C1E]/60 backdrop-blur-sm border border-white/5 rounded-[12px] h-[52px] px-4 text-left text-white placeholder:text-white/30 outline-none focus:border-accent-primary/50 transition-all font-medium placeholder:text-right"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col">
            <label className="text-white/90 text-[14px] mb-2 font-medium">אימייל</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com" dir="ltr"
              className="w-full bg-[#1C1C1E]/60 backdrop-blur-sm border border-white/5 rounded-[12px] h-[52px] px-4 text-left text-white placeholder:text-white/30 outline-none focus:border-accent-primary/50 transition-all font-medium placeholder:text-right"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-white/90 text-[14px] mb-2 font-medium">סיסמה</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" dir="ltr"
              className="w-full bg-[#1C1C1E]/60 backdrop-blur-sm border border-white/5 rounded-[12px] h-[52px] px-4 text-left text-white placeholder:text-white/30 outline-none focus:border-accent-primary/50 transition-all font-medium placeholder:text-right"
            />
          </div>

          {/* כפתור אישור לבן נקי (כמו בתמונה) */}
          <div className="flex justify-center mt-6">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-white text-black px-8 h-[48px] rounded-full font-bold text-[15px] active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100 shadow-[0_4px_15px_rgba(0,0,0,0.3)] hover:bg-gray-100"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin text-black" />
              ) : (
                <>
                  {isLogin ? 'המשך' : 'צור חשבון'}
                  <ArrowLeft size={18} strokeWidth={2.5} />
                </>
              )}
            </button>
          </div>
        </motion.form>

        {/* Toggle Login/Signup */}
        <div className="mt-10 text-center">
          <button 
            onClick={() => { triggerFeedback('pop'); setIsLogin(!isLogin); }}
            className="text-white/50 text-[14px] hover:text-white transition-colors"
          >
            {isLogin ? 'אין לך חשבון? הירשם עכשיו' : 'כבר יש לך חשבון? התחבר'}
          </button>
        </div>

      </div>
    </div>
  );
};
