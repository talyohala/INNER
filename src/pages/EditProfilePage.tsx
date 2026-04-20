import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { 
  UserCircle, Loader2, Users, MessageSquare, Link as LinkIcon, 
  UserCheck, MapPin, Calendar, GraduationCap, HeartHandshake, Camera, 
  Briefcase, Sparkles, ChevronDown, Zap, Save, AtSign, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { FadeIn } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

const ZODIAC_SIGNS = [
  { name: 'טלה', icon: '♈' }, { name: 'שור', icon: '♉' }, { name: 'תאומים', icon: '♊' },
  { name: 'סרטן', icon: '♋' }, { name: 'אריה', icon: '♌' }, { name: 'בתולה', icon: '♍' },
  { name: 'מאזניים', icon: '♎' }, { name: 'עקרב', icon: '♏' }, { name: 'קשת', icon: '♐' },
  { name: 'גדי', icon: '♑' }, { name: 'דלי', icon: '♒' }, { name: 'דגים', icon: '♓' }
];

const RELATIONSHIP_STATUSES = [
  { name: 'רווק/ה' }, { name: 'במערכת יחסים' }, { name: 'נשוי/ה' },
  { name: 'גרוש/ה' }, { name: 'אלמן/ה' }, { name: 'זה מסובך' }, { name: 'פתוח/ה להצעות' }
];

const GENDER_OPTIONS = [
  { name: 'זכר', icon: <span className="text-blue-400 text-[18px] leading-none font-black drop-shadow-md">♂</span> },
  { name: 'נקבה', icon: <span className="text-pink-400 text-[18px] leading-none font-black drop-shadow-md">♀</span> },
  { name: 'אחר / מעדיף לא לציין', icon: <Sparkles size={18} className="text-white/40" /> }
];

export const EditProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, reloadProfile, loading: authLoading } = useAuth() as any;

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [showZodiacPicker, setShowZodiacPicker] = useState(false);
  const [showRelationshipPicker, setShowRelationshipPicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);

  const dragControls = useDragControls();

  const [formData, setFormData] = useState({
    full_name: '', username: '', bio: '', social_link: '', zodiac: '', location: '',
    birth_date: '', relationship_status: '', education: '', job_title: '', gender: '', signal_price: 50
  });

  const [data, setData] = useState<any>({ profile: {} });

  useEffect(() => {
    setMounted(true);
    setPortalNode(document.getElementById('root') || document.body);
  }, []);

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        setLoadingData(true);
        if (!user?.id) return;
        const { data: profileData, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (error) throw error;
        
        setData({ profile: profileData });
        if (profileData) {
          setFormData({
            full_name: profileData.full_name || '', username: profileData.username || '',
            bio: profileData.bio || '', social_link: profileData.social_link || '',
            zodiac: profileData.zodiac || '', location: profileData.location || '',
            birth_date: profileData.birth_date ? profileData.birth_date.split('T')[0] : '',
            relationship_status: profileData.relationship_status || '',
            education: profileData.education || '', job_title: profileData.job_title || '',
            gender: profileData.gender || '', signal_price: profileData.signal_price || 50,
          });
        }
      } catch (err: any) {
        toast.error(`שגיאה: ${err.message}`);
      } finally { setLoadingData(false); }
    };

    if (user && !authLoading) loadProfileData();
  }, [user, authLoading]);

  const handleMediaUpload = async (file: File, type: 'avatar' | 'cover') => {
    if (!file || !user?.id) return;
    const setUploading = type === 'avatar' ? setUploadingAvatar : setUploadingCover;
    setUploading(true);
    const tid = toast.loading(`מעדכן תמונה...`);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}_${type}_${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from('feed_images').upload(fileName, file);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('feed_images').getPublicUrl(uploadData.path);
      const fieldToUpdate = type === 'avatar' ? 'avatar_url' : 'cover_url';
      
      const { error: updateError } = await supabase.from('profiles').update({ [fieldToUpdate]: publicUrl }).eq('id', user.id);
      if (updateError) throw updateError;
      
      if (reloadProfile) reloadProfile();
      setData((prev: any) => ({ ...prev, profile: { ...prev.profile, [fieldToUpdate]: publicUrl } }));
      toast.success(`התמונה עודכנה!`, { id: tid });
    } catch (err: any) {
      toast.error(`שגיאה: ${err.message}`, { id: tid });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!user?.id || savingDetails) return;
    setSavingDetails(true);
    triggerFeedback('pop');
    const tid = toast.loading('מעדכן נתונים...');
    try {
      const updates = { ...formData, birth_date: formData.birth_date === '' ? null : formData.birth_date };
      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (error) throw error;
      if (reloadProfile) reloadProfile();
      toast.success('פרופיל עודכן בהצלחה', { id: tid });
      setTimeout(() => navigate(-1), 500);
    } catch (err: any) {
      toast.error(`שגיאה: ${err.message}`, { id: tid });
    } finally {
      setSavingDetails(false);
    }
  };

  const closeOverlay = (setter: any) => { triggerFeedback('pop'); setter(false); };

  if (authLoading || loadingData) {
    return <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" size={32} /></div>;
  }

  const selectedZodiac = ZODIAC_SIGNS.find(s => s.name === formData.zodiac);
  const selectedRelationship = RELATIONSHIP_STATUSES.find(s => s.name === formData.relationship_status);
  const selectedGender = GENDER_OPTIONS.find(s => s.name === formData.gender);
  
  return (
    <FadeIn className="bg-[#0d0d0f] min-h-[100dvh] font-sans text-white overflow-x-hidden relative pb-12" dir="rtl">
      
      {/* 🚀 Top Floating Header (Save & Exit) */}
      <div className="fixed top-0 left-0 w-full z-50 bg-[#0d0d0f]/80 backdrop-blur-2xl border-b border-white/5 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 px-5 flex justify-between items-center transition-all">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-white/50 hover:text-white hover:bg-white/10 active:scale-95 transition-all">
          <X size={18} strokeWidth={2.5} />
        </button>
        <button onClick={handleSaveDetails} disabled={savingDetails} className="bg-accent-primary text-white rounded-full px-5 py-2.5 font-black text-[12px] uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_15px_rgba(var(--color-accent-primary),0.3)] active:scale-95 disabled:opacity-50 transition-transform">
          {savingDetails ? <Loader2 size={16} className="animate-spin" /> : <><Save size={14} /> שמור</>}
        </button>
      </div>

      {/* 🌌 Cover & Avatar Area */}
      <div className="relative w-full h-[220px] mt-[calc(env(safe-area-inset-top)+60px)]">
        {/* Hidden inputs */}
        <input type="file" ref={coverInputRef} onChange={(e) => { if (e.target.files?.[0]) handleMediaUpload(e.target.files[0], 'cover'); if (coverInputRef.current) coverInputRef.current.value = ''; }} accept="image/*" className="hidden" />
        <input type="file" ref={avatarInputRef} onChange={(e) => { if (e.target.files?.[0]) handleMediaUpload(e.target.files[0], 'avatar'); if (avatarInputRef.current) avatarInputRef.current.value = ''; }} accept="image/*" className="hidden" />

        {/* Cover Image */}
        <div className="absolute inset-0 z-0">
          {data.profile?.cover_url ? (
            <img src={data.profile.cover_url} className="w-full h-full object-cover opacity-60" />
          ) : (
            <div className="w-full h-full bg-accent-primary/10" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d0f]/20 via-[#0d0d0f]/80 to-[#0d0d0f]" />
        </div>

        {/* Cover Edit Button */}
        <button onClick={() => coverInputRef.current?.click()} disabled={uploadingCover} className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white/80 hover:text-white active:scale-95 transition-transform disabled:opacity-50">
          {uploadingCover ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />} ערוך רקע
        </button>

        {/* Center Avatar */}
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
          <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
            <div className="w-24 h-24 rounded-full border-2 border-[#0d0d0f] overflow-hidden bg-[#111] shadow-[0_10px_30px_rgba(0,0,0,0.8)] relative">
              {data.profile?.avatar_url ? (
                <img src={data.profile.avatar_url} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><UserCircle size={40} className="text-white/20" /></div>
              )}
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingAvatar ? <Loader2 size={20} className="animate-spin text-white" /> : <Camera size={20} />}
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-accent-primary border-2 border-[#0d0d0f] flex items-center justify-center shadow-lg pointer-events-none text-white">
              <Camera size={12} />
            </div>
          </div>
        </div>
      </div>

      {/* 📝 Borderless Form Container (The OS Look) */}
      <div className="px-6 mt-16 flex flex-col gap-2">

        <div className="flex flex-col gap-1 py-3 border-b border-white/5 focus-within:border-accent-primary/50 transition-colors group">
          <label className="text-white/30 group-focus-within:text-accent-primary/80 transition-colors text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 pointer-events-none">
            <Zap size={12} /> תעריף סיגנל (CRD)
          </label>
          <input type="number" value={formData.signal_price} onChange={e => setFormData(p=>({...p, signal_price: Number(e.target.value)}))} className="bg-transparent text-white text-[16px] font-medium outline-none placeholder:text-white/20 w-full mt-1" placeholder="50" dir="ltr" />
        </div>

        <InputField label="שם מלא" icon={UserCheck} value={formData.full_name} onChange={v => setFormData(p=>({...p, full_name: v}))} placeholder="השם שלך" />
        <InputField label="שם משתמש" icon={AtSign} value={formData.username} onChange={v => setFormData(p=>({...p, username: v.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '')}))} placeholder="username" dir="ltr" />
        
        {/* Borderless Bio */}
        <div className="flex flex-col gap-1 py-4 border-b border-white/5 focus-within:border-accent-primary/50 transition-colors group">
          <label className="text-white/30 group-focus-within:text-accent-primary/80 transition-colors text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 pointer-events-none">
            <MessageSquare size={12} /> אודות
          </label>
          <textarea value={formData.bio} onChange={e => setFormData(p=>({...p, bio: e.target.value}))} className="bg-transparent text-white text-[15px] font-medium outline-none placeholder:text-white/20 w-full h-16 resize-none leading-relaxed mt-1" placeholder="ספר על עצמך בקצרה..." />
        </div>

        <InputField label="קישור חברתי" icon={LinkIcon} value={formData.social_link} onChange={v => setFormData(p=>({...p, social_link: v}))} placeholder="instagram.com/user" dir="ltr" />
        <InputField label="עיסוק / מקצוע" icon={Briefcase} value={formData.job_title} onChange={v => setFormData(p=>({...p, job_title: v}))} placeholder="מעצב מוצר, משקיע..." />
        
        <SelectField label="מין" icon={Users} value={selectedGender ? selectedGender.name : ''} placeholder="בחר מין" onClick={() => setShowGenderPicker(true)} />
        <SelectField label="מזל" icon={Sparkles} value={selectedZodiac ? `${selectedZodiac.icon} ${selectedZodiac.name}` : ''} placeholder="בחר מזל" onClick={() => setShowZodiacPicker(true)} />
        
        <InputField label="מיקום" icon={MapPin} value={formData.location} onChange={v => setFormData(p=>({...p, location: v}))} placeholder="עיר, מדינה" />
        <InputField label="תאריך לידה" icon={Calendar} value={formData.birth_date} onChange={v => setFormData(p=>({...p, birth_date: v}))} placeholder="" type="date" />
        
        <SelectField label="מצב משפחתי" icon={HeartHandshake} value={selectedRelationship ? selectedRelationship.name : ''} placeholder="בחר מצב" onClick={() => setShowRelationshipPicker(true)} />
        <InputField label="השכלה" icon={GraduationCap} value={formData.education} onChange={v => setFormData(p=>({...p, education: v}))} placeholder="מוסד לימודים..." />
      </div>

      {/* 🌑 DARK GLASS MODALS FOR SELECTIONS */}
      {mounted && portalNode && createPortal(
        <>
          {/* ZODIAC PICKER */}
          <AnimatePresence>
            {showZodiacPicker && (
              <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => closeOverlay(setShowZodiacPicker)} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(setShowZodiacPicker); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 400 }} className="relative z-10 bg-[#0d0d0f] rounded-t-[32px] p-6 pb-12 border-t border-white/5 max-h-[85vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)]" onPointerDown={(e) => dragControls.start(e)} style={{ touchAction: 'none' }}>
                  <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6 shrink-0 cursor-grab" />
                  <h3 className="text-white font-black text-[15px] uppercase tracking-widest text-center mb-6">בחר מזל אסטרולוגי</h3>
                  <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2 scrollbar-hide">
                    {ZODIAC_SIGNS.map((sign) => (
                      <button key={sign.name} onClick={() => { setFormData(p => ({ ...p, zodiac: sign.name })); triggerFeedback('pop'); setShowZodiacPicker(false); }} className={`flex items-center justify-center gap-2 p-4 rounded-[20px] transition-all border ${formData.zodiac === sign.name ? 'bg-accent-primary/20 border-accent-primary/50 text-accent-primary shadow-[0_0_15px_rgba(var(--color-accent-primary),0.2)]' : 'bg-transparent border-white/5 text-white/60 hover:bg-white/5 hover:text-white'}`}>
                        <span className="text-xl drop-shadow-md">{sign.icon}</span>
                        <span className="font-black text-[13px]">{sign.name}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* RELATIONSHIP PICKER */}
          <AnimatePresence>
            {showRelationshipPicker && (
              <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => closeOverlay(setShowRelationshipPicker)} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(setShowRelationshipPicker); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 400 }} className="relative z-10 bg-[#0d0d0f] rounded-t-[32px] p-6 pb-12 border-t border-white/5 max-h-[85vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)]" onPointerDown={(e) => dragControls.start(e)} style={{ touchAction: 'none' }}>
                  <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6 shrink-0 cursor-grab" />
                  <h3 className="text-white font-black text-[15px] uppercase tracking-widest text-center mb-6">מצב משפחתי</h3>
                  <div className="flex-1 overflow-y-auto flex flex-col gap-2 scrollbar-hide">
                    {RELATIONSHIP_STATUSES.map((status) => (
                      <button key={status.name} onClick={() => { setFormData(p => ({ ...p, relationship_status: status.name })); triggerFeedback('pop'); setShowRelationshipPicker(false); }} className={`flex items-center justify-center p-4 rounded-[20px] transition-all border ${formData.relationship_status === status.name ? 'bg-accent-primary/20 border-accent-primary/50 text-accent-primary shadow-[0_0_15px_rgba(var(--color-accent-primary),0.2)]' : 'bg-transparent border-white/5 text-white/60 hover:bg-white/5 hover:text-white'}`}>
                        <span className="font-black text-[14px]">{status.name}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* GENDER PICKER */}
          <AnimatePresence>
            {showGenderPicker && (
              <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => closeOverlay(setShowGenderPicker)} />
                <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeOverlay(setShowGenderPicker); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 400 }} className="relative z-10 bg-[#0d0d0f] rounded-t-[32px] p-6 pb-12 border-t border-white/5 max-h-[85vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)]" onPointerDown={(e) => dragControls.start(e)} style={{ touchAction: 'none' }}>
                  <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6 shrink-0 cursor-grab" />
                  <h3 className="text-white font-black text-[15px] uppercase tracking-widest text-center mb-6">מגדר אישי</h3>
                  <div className="flex-1 overflow-y-auto flex flex-col gap-2 scrollbar-hide">
                    {GENDER_OPTIONS.map((gender) => (
                      <button key={gender.name} onClick={() => { setFormData(p => ({ ...p, gender: gender.name })); triggerFeedback('pop'); setShowGenderPicker(false); }} className={`flex items-center justify-center gap-3 p-4 rounded-[20px] transition-all border ${formData.gender === gender.name ? 'bg-accent-primary/20 border-accent-primary/50 text-accent-primary shadow-[0_0_15px_rgba(var(--color-accent-primary),0.2)]' : 'bg-transparent border-white/5 text-white/60 hover:bg-white/5 hover:text-white'}`}>
                        {formData.gender === gender.name ? <span className="text-white">{gender.icon}</span> : gender.icon}
                        <span className="font-black text-[14px]">{gender.name}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>,
        portalNode
      )}
    </FadeIn>
  );
};

// 🌌 Ultra Minimalist Input
interface InputFieldProps { label: string; icon: React.ElementType; value: string | number; onChange: (value: string) => void; placeholder: string; type?: string; dir?: string;}
const InputField: React.FC<InputFieldProps> = ({ label, icon: Icon, value, onChange, placeholder, type = 'text', dir = 'rtl' }) => (
  <div className="flex flex-col gap-1 py-3 border-b border-white/5 focus-within:border-accent-primary/50 transition-colors group">
    <label className="text-white/30 group-focus-within:text-accent-primary/80 transition-colors text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 pointer-events-none">
      <Icon size={12} /> {label}
    </label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} className="bg-transparent text-white text-[16px] font-medium outline-none placeholder:text-white/20 w-full mt-1" placeholder={placeholder} dir={dir} style={{ colorScheme: 'dark' }} />
  </div>
);

// 🌌 Ultra Minimalist Select
interface SelectFieldProps { label: string; icon: React.ElementType; value: string; placeholder: string; onClick: () => void; }
const SelectField: React.FC<SelectFieldProps> = ({ label, icon: Icon, value, placeholder, onClick }) => (
  <div className="flex flex-col gap-1 py-3 border-b border-white/5 cursor-pointer active:opacity-70 transition-opacity group" onClick={onClick}>
    <label className="text-white/30 group-hover:text-accent-primary/80 transition-colors text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 pointer-events-none">
      <Icon size={12} /> {label}
    </label>
    <div className="flex justify-between items-center mt-1 pointer-events-none">
      <span className={`text-[16px] font-medium truncate ${value ? 'text-white' : 'text-white/20'}`}>{value || placeholder}</span>
      <ChevronDown size={14} className="text-white/20" />
    </div>
  </div>
);
