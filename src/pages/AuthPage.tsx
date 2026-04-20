import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2, Mail, Lock, User, AtSign, ChevronLeft, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { triggerFeedback } from '../lib/sound';
import { supabase } from '../lib/supabase';

// 🎨 coded logo: המעוצב בדיוק כפי שהמשתמש ביקש, וקטורי ונקי
const InnerCodedLogo: React.FC = () => {
  return (
    <div className="flex flex-col items-center gap-1.5 perspective-[1200px]">
      {/* לוגו ה-I המעוצב בדיוק: נטייה, חיתוך אלכסוני בראש (image_2.png) */}
      <motion.svg 
        width="44" height="74" viewBox="0 0 44 74" fill="none" xmlns="http://www.w3.org/2000/svg" 
        className="mix-blend-screen"
        animate={{ y: [0, -8, 0]}}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* אות 'I' סריפית, נטייה, יוקרתית (image_2.png) */}
        <path d="M41.818 18.232H37.018V55.602C37.018 58.752 36.748 60.972 36.208 62.262C35.668 63.552 34.438 64.602 32.518 65.412C30.598 66.222 27.988 66.672 24.688 66.762V70H43.798V66.762H43.438C42.088 66.672 41.068 66.192 40.378 65.322C39.688 64.452 39.318 62.742 39.268 60.192V18.232H41.818Z" fill="white"/>
        {/* ראש האות 'I' (cap) עם חיתוך אלכסוני דק שעובר דרכו (image_2.png) */}
        <path d="M13.66 21.08H12.16V0.380001H3.61C3.04 0.380001 2.58 0.650001 2.23 1.19C1.88 1.73 1.93 2.4 2.38 3.2L13.66 21.08Z" fill="white"/>
        {/* השלמה של ה-cap החתוך */}
        <path d="M29.7581 6.30005C27.0881 2.21005 22.6681 0.0000477196 16.4981 0.0000477196H14.1581V6.30005H15.6581L29.7581 21H31.2581L29.7581 6.30005Z" fill="white"/>
        {/* קו חיתוך אלכסוני דק המשלים את הצורה (image_2.png) */}
        <path d="M12.16 0.380001H13.66V6.30005H12.16V0.380001Z" fill="white"/>
        {/* חיבור אלכסוני קטן מתחת לחיתוך */}
        <path d="M25.508 11.232H15.658L25.508 21V11.232Z" fill="white"/>
      </motion.svg>
      {/* טקסט "INNER" נקי למטה, פונט סנס-סריף, מרווח אותיות רחב */}
      <span className="font-sans font-extrabold text-[12px] text-white/95 uppercase tracking-[0.25em]">
        INNER
      </span>
    </div>
  );
};

// 🌌 coded background: טקסטורת אקסנט משודרגת, עשירה ומודרנית
const InnerCodedBackground: React.FC = () => {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      {/* צבע בסיס: אקסנט פרימרי עמוק (Deep Accent base) */}
      <div className="absolute inset-0 bg-[#07051A]" />
      
      {/* שכבה 1: פלזמה אקסנט ראשית (Main Accent Plasma) */}
      <motion.div 
        animate={{ opacity: [0.6, 0.9, 0.6], scale: [1, 1.05, 1], x: [0, -15, 0], y: [0, 10, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-20%] left-[-15%] w-[90%] h-[70%] bg-accent-primary blur-[120px] rounded-full opacity-25"
      />
      
      {/* שכבה 2: ערפילית ורוד-מג'נטה (Magenta Nebula) */}
      <motion.div 
        animate={{ opacity: [0.5, 0.8, 0.5], scale: [1, 1.1, 1], x: [0, 20, 0], y: [0, -15, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-[-15%] right-[-20%] w-[80%] h-[60%] bg-[#FF0077] blur-[140px] rounded-full opacity-15 mix-blend-screen"
      />
      
      {/* שכבה 3: קשת אור כחול-טורקיז (Turquoise Light Arc) */}
      <motion.div 
        animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.15, 1], rotate: [0, 10, 0] }}
        transition={{ duration: 19, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        className="absolute top-[20%] right-[10%] w-[60%] h-[50%] bg-[#00DDFF] blur-[130px] rounded-full opacity-10"
      />

      {/* שכבה 4: פרטי אור דינמיים (Dynamic Light Details) - שימוש ב-Sparkles */}
      <motion.div 
        animate={{ opacity: [0, 0.7, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 z-10 text-white/40 flex items-center justify-center p-20"
      >
        <Sparkles size={200} strokeWidth={1} />
      </motion.div>

      {/* שכבה 5: conic gradient עדין לשילוב (Conic gradient for blending) */}
      <motion.div 
        animate={{ opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-white/5 blur-[120px]"
        style={{ background: 'conic-gradient(from 180deg at 50% 50%, #FF0077 0deg, var(--color-accent-primary) 120deg, #00DDFF 240deg, #FF0077 360deg)'}}
      />
    </div>
  );
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
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden" dir="rtl">
      
      {/* 🌌 Coded Background: טקסטורת אקסנט עשירה (Borderless and Textured) */}
      <InnerCodedBackground />

      <div className="w-full max-w-sm z-10 flex flex-col items-center">
        
        {/* 👑 Coded Logo: המעוצב המדויק */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8, y: -30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 relative flex justify-center"
        >
          {/* הילת הולוגרמה צפה סביב הלוגו הקודד (Logo Glow) */}
          <motion.div 
            animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.1, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-accent-primary/25 blur-[60px] rounded-full scale-150"
          />
          <InnerCodedLogo />
        </motion.div>

        {/* 💎 אזור הטופס: Borderless TabLayout with Glassmorphism Borderless שדות טקסט */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 1.2, delay: 0.8, ease: "easeOut" }}
          className="w-full flex flex-col p-4"
        >
          {/* TabLayout: מעודן ומרחף, ללא מסגרת רקע (Borderless Glassmorphism) */}
          <div className="flex bg-white/5 backdrop-blur-lg p-1 rounded-full mb-10 border border-white/10 relative shadow-inner">
            <button
              type="button"
              onClick={() => { triggerFeedback('pop'); setIsLogin(true); }}
              className={`flex-1 py-3.5 rounded-full font-black text-[13px] uppercase tracking-widest transition-all z-10 ${isLogin ? 'text-black' : 'text-white/60 hover:text-white'}`}
            >
              כניסה
            </button>
            <button
              type="button"
              onClick={() => { triggerFeedback('pop'); setIsLogin(false); }}
              className={`flex-1 py-3.5 rounded-full font-black text-[13px] uppercase tracking-widest transition-all z-10 ${!isLogin ? 'text-black' : 'text-white/60 hover:text-white'}`}
            >
              הרשמה
            </button>
            <motion.div
              layout
              transition={springConfig}
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-full shadow-md pointer-events-none"
              animate={{ right: isLogin ? "4px" : "calc(50%)" }}
            />
          </div>

          {/* Form Container: Borderless שדות טקסט הצפים על הרקע (Borderless Glassmorphism) */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <AnimatePresence initial={false} mode="popLayout">
              {!isLogin && (
                <motion.div
                  key="signup-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ opacity: { duration: 0.2 }, height: springConfig }}
                  className="overflow-hidden flex flex-col gap-5"
                >
                  <div className="relative group">
                    <User className="absolute right-5 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-accent-primary transition-colors" size={18} />
                    <input
                      type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                      placeholder="שם מלא"
                      className="w-full bg-black/30 backdrop-blur-xl border border-white/10 rounded-full h-[56px] pr-12 pl-5 text-white placeholder:text-white/30 outline-none focus:border-accent-primary/50 focus:bg-white/10 transition-all font-bold shadow-inner"
                    />
                  </div>
                  <div className="relative group">
                    <AtSign className="absolute right-5 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-accent-primary transition-colors" size={18} />
                    <input
                      type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ''))}
                      placeholder="שם משתמש באנגלית" dir="ltr"
                      className="w-full bg-black/30 backdrop-blur-xl border border-white/10 rounded-full h-[56px] pr-12 pl-5 text-left text-white placeholder:text-white/30 outline-none focus:border-accent-primary/50 focus:bg-white/10 transition-all font-bold placeholder:text-right shadow-inner"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div layout transition={springConfig} className="relative group">
              <Mail className="absolute right-5 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-accent-primary transition-colors" size={18} />
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="אימייל" dir="ltr"
                className="w-full bg-black/30 backdrop-blur-xl border border-white/10 rounded-full h-[56px] pr-12 pl-5 text-left text-white placeholder:text-white/30 outline-none focus:border-accent-primary/50 focus:bg-white/10 transition-all font-bold placeholder:text-right shadow-inner"
              />
            </motion.div>

            <motion.div layout transition={springConfig} className="relative group">
              <Lock className="absolute right-5 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-accent-primary transition-colors" size={18} />
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="סיסמה" dir="ltr"
                className="w-full bg-black/30 backdrop-blur-xl border border-white/10 rounded-full h-[56px] pr-12 pl-5 text-left text-white placeholder:text-white/30 outline-none focus:border-accent-primary/50 focus:bg-white/10 transition-all font-bold placeholder:text-right shadow-inner"
              />
            </motion.div>

            {/* כפתור פרימיום מורחב ואלגנטי: Premium Action Button */}
            <motion.div layout transition={springConfig} className="mt-8 relative flex justify-center">
              {/* הילה הולוגרפית אנרגטית סביב הכפתור (Button Pulse Glow) */}
              <motion.div 
                animate={{ opacity: [0.5, 0.8, 0.5], scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-accent-primary/30 blur-[25px] rounded-full scale-50"
              />

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full max-w-[280px] h-[64px] rounded-full overflow-hidden flex items-center justify-center active:scale-[0.97] transition-all disabled:opacity-50 disabled:scale-100 shadow-[0_15px_60px_rgba(255,255,255,0.1)] hover:shadow-[0_20px_80px_rgba(255,255,255,0.2)]"
              >
                {/* רקע הכפתור: אקסנט עמוק עם מטאליות מבריקה (Deep Accent with Metalic Shine) */}
                <div className="absolute inset-0 bg-gradient-to-r from-accent-primary/10 via-accent-primary/30 to-accent-primary/10 backdrop-blur-md" />
                {/* גבול בוהק עדין: Rim Lighting */}
                <div className="absolute inset-0 border border-accent-primary/50 rounded-full" />
                {/* אפקט הולוגרפי דק דרך הטקסט (Holographic effect through text) */}
                <div className="absolute inset-0 bg-[linear-gradient(120deg,#FF0077_0%,#00DDFF_100%)] opacity-0 group-hover:opacity-100 transition-opacity blur-[5px] scale-150" />
                
                <div className="relative z-10 flex items-center gap-3 text-white">
                  {loading ? (
                    <Loader2 size={24} className="animate-spin" />
                  ) : (
                    <>
                      <span className="font-sans font-extrabold text-[15px] uppercase tracking-[0.2em] mix-blend-difference">
                        {isLogin ? 'היכנס למערכת' : 'הצטרף עכשיו'}
                      </span>
                      <ChevronLeft size={22} className="transition-transform group-hover:-translate-x-1" strokeWidth={2.5} />
                    </>
                  )}
                </div>
              </button>
            </motion.div>
          </form>
        </motion.div>
      </div>

      {/* שכבת עומק: אפקט כוכבים נופלים עדין מאוד (Very Subtle Shooting Stars) */}
      {[...Array(2)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-[180px] h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent rotate-[-45deg]"
          style={{
            top: `${Math.random() * 40}%`,
            left: `${Math.random() * 40 + 70}%`,
          }}
          animate={{ x: [-350, 550], y: [350, -550], opacity: [0, 0.8, 0] }}
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
