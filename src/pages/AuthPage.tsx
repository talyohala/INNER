import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2, Mail, Lock, User, AtSign } from 'lucide-react';
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
      return toast.error('חסרים פרטים לזיהוי');
    }
    
    setLoading(true);
    const tid = toast.loading(isLogin ? 'מתחבר למועדון...' : 'מכין לך מקום...');
    
    try {
      if (isLogin) {
        await signIn(email, password);
        triggerFeedback('success');
        toast.success('ברוך הבא למועדון 🍸', { id: tid });
        navigate('/');
      } else {
        if (!fullName || !username) {
          throw new Error('חובה למלא שם מלא ושם משתמש');
        }
        await signUp(email, password, { full_name: fullName, username: username.toLowerCase() });
        triggerFeedback('success');
        toast.success('ההרשמה בוצעה בהצלחה! 👑', { id: tid });
        navigate('/');
      }
    } catch (err: any) {
      triggerFeedback('error');
      toast.error(err.message || 'שגיאה באימות', { id: tid });
    } finally {
      setLoading(false);
    }
  };

  const handleTabSwitch = (loginMode: boolean) => {
    if (isLogin !== loginMode) {
      triggerFeedback('pop');
      setIsLogin(loginMode);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-5 font-sans relative overflow-hidden" dir="rtl">
      
      {/* תאורת רקע (Ambient Glow) */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex justify-center items-center">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-white/5 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-white/5 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <div className="w-full max-w-sm relative z-10 flex flex-col items-center">
        
        {/* לוגו מרכזי מרחף ונושם */}
        <motion.div 
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="mb-10 text-center relative"
        >
          <div className="relative inline-block">
            <h1 className="text-6xl font-black text-white tracking-tighter italic relative z-10">INNER</h1>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-full bg-white/10 blur-[30px] rounded-full pointer-events-none" />
          </div>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="text-white/40 text-[10px] font-black tracking-[0.4em] uppercase mt-2 drop-shadow-md"
          >
            The Core Circle
          </motion.div>
        </motion.div>

        {/* כרטיס הטופס (Glassmorphism סופר נקי) */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="w-full bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[36px] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        >
          
          {/* טאבים: כניסה / הרשמה בצורת פיל (Pill) */}
          <div className="flex bg-black/40 p-1.5 rounded-full mb-8 border border-white/5 relative shadow-inner">
            <button 
              type="button"
              onClick={() => handleTabSwitch(true)}
              className={`flex-1 py-3 rounded-full font-black text-[13px] tracking-wide transition-all z-10 ${isLogin ? 'text-black' : 'text-white/50 hover:text-white/80'}`}
            >
              כניסה
            </button>
            <button 
              type="button"
              onClick={() => handleTabSwitch(false)}
              className={`flex-1 py-3 rounded-full font-black text-[13px] tracking-wide transition-all z-10 ${!isLogin ? 'text-black' : 'text-white/50 hover:text-white/80'}`}
            >
              הרשמה
            </button>

            {/* האנימציה של הרקע בטאבים */}
            <motion.div
              layout
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-full shadow-md pointer-events-none"
              initial={false}
              animate={{ right: isLogin ? "6px" : "calc(50%)" }}
            />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            <AnimatePresence mode="popLayout">
              {!isLogin && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  className="flex flex-col gap-4 overflow-hidden"
                >
                  <div className="relative">
                    <User className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                    <input 
                      type="text" 
                      value={fullName} 
                      onChange={(e) => setFullName(e.target.value)} 
                      placeholder="שם מלא" 
                      className="w-full bg-[#050505] border border-white/5 rounded-2xl h-14 pr-12 pl-4 text-right text-white font-medium placeholder:text-white/30 focus:border-white/20 outline-none transition-colors shadow-inner" 
                    />
                  </div>
                  
                  <div className="relative">
                    <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                    <input 
                      type="text" 
                      value={username} 
                      onChange={(e) => setUsername(e.target.value.toLowerCase())} 
                      placeholder="שם משתמש (באנגלית)" 
                      dir="ltr"
                      className="w-full bg-[#050505] border border-white/5 rounded-2xl h-14 pl-12 pr-4 text-left text-white font-medium placeholder:text-white/30 focus:border-white/20 outline-none transition-colors placeholder:text-right shadow-inner" 
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="אימייל" 
                dir="ltr"
                className="w-full bg-[#050505] border border-white/5 rounded-2xl h-14 pl-12 pr-4 text-left text-white font-medium placeholder:text-white/30 focus:border-white/20 outline-none transition-colors placeholder:text-right shadow-inner" 
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="סיסמה" 
                dir="ltr"
                className="w-full bg-[#050505] border border-white/5 rounded-2xl h-14 pl-12 pr-4 text-left text-white font-medium placeholder:text-white/30 focus:border-white/20 outline-none transition-colors placeholder:text-right shadow-inner" 
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full h-14 mt-4 bg-white text-black hover:bg-[#e5e4e2] active:scale-95 rounded-[20px] font-black text-[15px] tracking-wide transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
            >
              {loading ? <Loader2 size={20} className="animate-spin text-black/50" /> : (isLogin ? 'כניסה למועדון' : 'יצירת פרופיל')}
            </button>
          </form>

        </motion.div>
      </div>
    </div>
  );
};
