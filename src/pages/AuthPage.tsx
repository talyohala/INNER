import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
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
    const tid = toast.loading(isLogin ? 'מתחבר...' : 'יוצר משתמש...');
    
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
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-5 font-sans" dir="rtl">
      
      {/* לוגו מרכזי */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-10 text-center"
      >
        <h1 className="text-5xl font-black text-white tracking-tighter italic">INNER</h1>
      </motion.div>

      {/* כרטיס הטופס בסגנון מינימליסטי */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm bg-[#141414] border border-[#222] rounded-[32px] p-6 shadow-2xl"
      >
        
        {/* טאבים: כניסה / הרשמה */}
        <div className="flex bg-[#0A0A0A] p-1 rounded-2xl mb-8 border border-[#222]">
          <button 
            type="button"
            onClick={() => handleTabSwitch(true)}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${isLogin ? 'bg-[#2A2A2A] text-white shadow-md' : 'text-white/40 hover:text-white/70'}`}
          >
            כניסה
          </button>
          <button 
            type="button"
            onClick={() => handleTabSwitch(false)}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${!isLogin ? 'bg-[#2A2A2A] text-white shadow-md' : 'text-white/40 hover:text-white/70'}`}
          >
            הרשמה
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          <AnimatePresence mode="wait">
            {!isLogin && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-col gap-4 overflow-hidden"
              >
                <input 
                  type="text" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                  placeholder="שם מלא" 
                  className="w-full bg-[#0A0A0A] border border-[#222] rounded-2xl h-14 px-4 text-right text-white placeholder:text-white/30 focus:border-[#444] outline-none transition-colors" 
                />
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value.toLowerCase())} 
                  placeholder="שם משתמש (באנגלית)" 
                  dir="ltr"
                  className="w-full bg-[#0A0A0A] border border-[#222] rounded-2xl h-14 px-4 text-left text-white placeholder:text-white/30 focus:border-[#444] outline-none transition-colors placeholder:text-right" 
                />
              </motion.div>
            )}
          </AnimatePresence>

          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            placeholder="אימייל" 
            dir="ltr"
            className="w-full bg-[#0A0A0A] border border-[#222] rounded-2xl h-14 px-4 text-left text-white placeholder:text-white/30 focus:border-[#444] outline-none transition-colors placeholder:text-right" 
          />

          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            placeholder="סיסמה" 
            dir="ltr"
            className="w-full bg-[#0A0A0A] border border-[#222] rounded-2xl h-14 px-4 text-left text-white placeholder:text-white/30 focus:border-[#444] outline-none transition-colors placeholder:text-right" 
          />

          <button 
            type="submit" 
            disabled={loading}
            className="w-full h-14 mt-4 bg-[#2A2A2A] hover:bg-[#333] active:scale-95 text-white rounded-2xl font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-[#333]"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : (isLogin ? 'כניסה' : 'הרשמה')}
          </button>
        </form>

      </motion.div>
    </div>
  );
};
