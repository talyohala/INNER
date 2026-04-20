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
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden bg-[#0d0d0f]" dir="rtl">
      
      {/* רקע גרדיאנט סטטי וחלק (ללא ריצודים) בהשראת התמונה */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute bottom-[-20%] right-[-10%] w-[80%] h-[70%] bg-[#4f46e5] rounded-full mix-blend-screen opacity-50 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[70%] h-[60%] bg-[#e11d48] rounded-full mix-blend-screen opacity-50 blur-[100px]" />
        <div className="absolute bottom-[-30%] left-[20%] w-[60%] h-[60%] bg-[#d946ef] rounded-full mix-blend-screen opacity-40 blur-[120px]" />
      </div>

      <div className="w-full max-w-sm z-10 flex flex-col">
        
        {/* לוגו מקודד (ללא תמונה, ללא רקע שחור) */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center mb-8"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#ff3366] via-[#a855f7] to-[#3b82f6] flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.4)] mb-6">
            <span className="text-white font-serif font-black text-3xl italic tracking-tighter pr-1 select-none">I</span>
          </div>
          
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {isLogin ? 'התחברות לחשבון' : 'יצירת חשבון'}
          </h1>
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
                    placeholder="טל יהואלה"
                    className="w-full bg-[#1C1C1E] border border-transparent rounded-[12px] h-[52px] px-4 text-white placeholder:text-white/30 outline-none focus:border-white/20 transition-all font-medium"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-white/90 text-[14px] mb-2 font-medium">שם משתמש</label>
                  <input
                    type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ''))}
                    placeholder="tal_y" dir="ltr"
                    className="w-full bg-[#1C1C1E] border border-transparent rounded-[12px] h-[52px] px-4 text-left text-white placeholder:text-white/30 outline-none focus:border-white/20 transition-all font-medium placeholder:text-right"
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
              className="w-full bg-[#1C1C1E] border border-transparent rounded-[12px] h-[52px] px-4 text-left text-white placeholder:text-white/30 outline-none focus:border-white/20 transition-all font-medium placeholder:text-right"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-white/90 text-[14px] mb-2 font-medium">סיסמה</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" dir="ltr"
              className="w-full bg-[#1C1C1E] border border-transparent rounded-[12px] h-[52px] px-4 text-left text-white placeholder:text-white/30 outline-none focus:border-white/20 transition-all font-medium placeholder:text-right"
            />
          </div>

          {/* כפתור אישור לבן נקי (כמו בתמונה) */}
          <div className="flex justify-center mt-6">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-white text-black px-8 h-[48px] rounded-full font-medium text-[15px] active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100 shadow-md hover:bg-gray-100"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin text-black" />
              ) : (
                <>
                  {isLogin ? 'המשך' : 'צור חשבון'}
                  <ArrowLeft size={18} />
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
