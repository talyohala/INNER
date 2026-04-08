import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, MapPin, Crown, UserCircle, ChevronLeft, Loader2, Sparkles, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

const ZODIAC_SIGNS = [
  { name: 'טלה', icon: '♈' }, { name: 'שור', icon: '♉' }, { name: 'תאומים', icon: '♊' },
  { name: 'סרטן', icon: '♋' }, { name: 'אריה', icon: '♌' }, { name: 'בתולה', icon: '♍' },
  { name: 'מאזניים', icon: '♎' }, { name: 'עקרב', icon: '♏' }, { name: 'קשת', icon: '♐' },
  { name: 'גדי', icon: '♑' }, { name: 'דלי', icon: '♒' }, { name: 'דגים', icon: '♓' }
];

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, reloadProfile } = useAuth();
  
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1); // 1 for forward, -1 for backward
  const [loading, setLoading] = useState(false);
  const [showZodiacPicker, setShowZodiacPicker] = useState(false);
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [zodiac, setZodiac] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      triggerFeedback('pop');
    }
  };

  const handleNextStep = () => {
    triggerFeedback('pop');
    setDirection(1);
    setStep(2);
  };

  const handlePrevStep = () => {
    triggerFeedback('pop');
    setDirection(-1);
    setStep(1);
  };

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);
    triggerFeedback('pop');
    const tid = toast.loading('מכין את הפרופיל שלך...');

    try {
      let avatar_url = null;

      // 1. Upload Avatar if selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.id}_avatar_${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('feed_images')
          .upload(fileName, avatarFile);

        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('feed_images').getPublicUrl(uploadData.path);
        avatar_url = publicUrl;
      }

      // 2. Update Profile
      const updates: any = { bio, location, zodiac };
      if (avatar_url) updates.avatar_url = avatar_url;

      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (error) throw error;

      await reloadProfile?.();
      toast.success('ברוך הבא למועדון! 🥂', { id: tid });
      
      // Animation delay before redirect
      setTimeout(() => navigate('/'), 800);

    } catch (err: any) {
      toast.error(err.message || 'שגיאה בשמירת הנתונים', { id: tid });
      setLoading(false);
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir === 1 ? 50 : -50, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir === 1 ? -50 : 50, opacity: 0 })
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center pt-20 px-6 font-sans relative overflow-hidden" dir="rtl">
      
      {/* Background Glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[40%] bg-accent-primary/10 blur-[120px] rounded-full pointer-events-none" />
      
      {/* Progress Indicator */}
      <div className="w-full max-w-sm flex justify-center gap-2 mb-10 z-10">
        <div className={`h-1.5 rounded-full transition-all duration-500 ${step >= 1 ? 'w-12 bg-white' : 'w-4 bg-white/20'}`} />
        <div className={`h-1.5 rounded-full transition-all duration-500 ${step >= 2 ? 'w-12 bg-white' : 'w-4 bg-white/20'}`} />
      </div>

      <div className="w-full max-w-sm flex-1 flex flex-col z-10">
        
        <div className="mb-8">
          <motion.h1 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black text-brand tracking-tight mb-2"
          >
            {step === 1 ? 'מי אתה?' : 'עוד קצת...'}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="text-brand-muted text-[15px]"
          >
            {step === 1 ? 'בוא נשים פנים ושם מאחורי הפרופיל.' : 'הפרטים הקטנים שעושים את ההבדל.'}
          </motion.p>
        </div>

        <div className="relative flex-1">
          <AnimatePresence mode="popLayout" custom={direction} initial={false}>
            
            {/* STEP 1: AVATAR & BIO */}
            {step === 1 && (
              <motion.div
                key="step1"
                custom={direction}
                variants={slideVariants}
                initial="enter" animate="center" exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="flex flex-col gap-8 items-center w-full"
              >
                {/* Avatar Upload */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-36 h-36 rounded-full bg-surface-card border-2 border-dashed border-surface-border flex items-center justify-center cursor-pointer group hover:border-accent-primary/50 transition-colors shadow-lg"
                >
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                  {avatarPreview ? (
                    <img src={avatarPreview} className="w-full h-full rounded-full object-cover p-1" />
                  ) : (
                    <UserCircle size={50} className="text-brand-muted group-hover:text-accent-primary transition-colors" />
                  )}
                  <div className="absolute bottom-0 right-0 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-surface text-black">
                    <Camera size={18} />
                  </div>
                </div>

                {/* Bio Input */}
                <div className="w-full">
                  <label className="text-brand-muted text-[12px] font-bold tracking-widest uppercase mb-2 block">ביו קצר</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="ספר על עצמך בכמה מילים..."
                    className="w-full bg-surface-card border border-surface-border rounded-[24px] p-5 text-brand text-[15px] outline-none focus:border-accent-primary/50 transition-all font-medium resize-none h-32 shadow-inner"
                  />
                </div>
              </motion.div>
            )}

            {/* STEP 2: LOCATION & ZODIAC */}
            {step === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={slideVariants}
                initial="enter" animate="center" exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="flex flex-col gap-6 w-full"
              >
                <div className="w-full relative">
                  <label className="text-brand-muted text-[12px] font-bold tracking-widest uppercase mb-2 block">עיר מגורים</label>
                  <div className="relative">
                    <MapPin className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-muted" size={20} />
                    <input
                      type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                      placeholder="תל אביב, ישראל"
                      className="w-full bg-surface-card border border-surface-border rounded-[24px] h-[60px] pr-14 pl-5 text-brand outline-none focus:border-accent-primary/50 transition-all font-bold shadow-sm"
                    />
                  </div>
                </div>

                <div className="w-full relative cursor-pointer" onClick={() => setShowZodiacPicker(true)}>
                  <label className="text-brand-muted text-[12px] font-bold tracking-widest uppercase mb-2 block">מזל</label>
                  <div className="relative">
                    <Crown className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-muted" size={20} />
                    <div className={`w-full bg-surface-card border border-surface-border rounded-[24px] h-[60px] pr-14 pl-5 flex items-center shadow-sm transition-all ${zodiac ? 'text-brand font-bold' : 'text-brand-muted/50 font-medium'}`}>
                      {zodiac ? ZODIAC_SIGNS.find(z => z.name === zodiac)?.icon + ' ' + zodiac : 'בחר מזל'}
                    </div>
                  </div>
                </div>

                <div className="mt-8 bg-surface-card border border-surface-border rounded-[24px] p-5 flex items-center justify-between shadow-inner">
                  <div className="flex flex-col">
                    <span className="text-brand font-black text-[14px]">מוכן להיכנס?</span>
                    <span className="text-brand-muted text-[12px] mt-0.5">תוכל תמיד לשנות את זה אחר כך.</span>
                  </div>
                  <Sparkles size={24} className="text-accent-primary" />
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* BOTTOM NAVIGATION BUTTONS */}
        <div className="w-full flex items-center justify-between pb-8 pt-4">
          {step === 2 ? (
            <button onClick={handlePrevStep} className="text-brand-muted font-bold text-[14px] px-4 py-2 hover:text-brand transition-colors">
              חזור
            </button>
          ) : (
            <div /> // Placeholder
          )}

          {step === 1 ? (
            <button 
              onClick={handleNextStep}
              className="bg-white text-black h-14 px-10 rounded-[20px] font-black text-[15px] uppercase tracking-widest shadow-[0_10px_40px_rgba(255,255,255,0.15)] active:scale-95 transition-all"
            >
              המשך
            </button>
          ) : (
            <button 
              onClick={handleFinish} disabled={loading}
              className="bg-accent-primary text-white h-14 px-8 rounded-[20px] font-black text-[15px] uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'הכנס למועדון'}
            </button>
          )}
        </div>

      </div>

      {/* ZODIAC BOTTOM SHEET */}
      <AnimatePresence>
        {showZodiacPicker && (
          <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowZodiacPicker(false)} />
            <motion.div 
              drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2}
              onDragEnd={(e, info) => { if (info.offset.y > 100) setShowZodiacPicker(false); }}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 400 }} 
              className="relative z-10 bg-surface rounded-t-[40px] p-6 pb-12 border-t border-surface-border max-h-[85vh] flex flex-col"
            >
              <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-6 shrink-0" />
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-brand font-black text-lg">בחר את המזל שלך</h3>
                <button onClick={() => setShowZodiacPicker(false)} className="text-brand-muted hover:text-brand"><X size={22} /></button>
              </div>
              <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-3 scrollbar-hide pr-1">
                {ZODIAC_SIGNS.map((sign) => (
                  <button key={sign.name} onClick={() => { setZodiac(sign.name); triggerFeedback('pop'); setShowZodiacPicker(false); }} className={`flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all ${zodiac === sign.name ? 'bg-white border-white text-black shadow-md' : 'bg-surface-card border-surface-border text-brand hover:border-brand/30'}`}>
                    <span className="text-2xl">{sign.icon}</span>
                    <span className="font-black text-[15px]">{sign.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
