import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { 
  UserCircle, Edit2, Loader2, Users, MessageSquare, Link as LinkIcon, 
  UserCheck, MapPin, Calendar, GraduationCap, HeartHandshake, Camera, 
  Briefcase, Sparkles, ChevronDown, Zap, Save, AtSign
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
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
    const tid = toast.loading('שומר נתונים במערכת...');
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
    <FadeIn className="bg-[#0d0d0f] min-h-[100dvh] font-sans text-white overflow-x-hidden relative pb-40" dir="rtl">
      
      {/* 🌌 Minimalist Cover & Avatar Area */}
      <div className="relative w-full h-[240px]">
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
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0d0d0f]/60 to-[#0d0d0f]" />
        </div>

        {/* Cover Edit Button (Floating Top Left) */}
        <button onClick={() => coverInputRef.current?.click()} disabled={uploadingCover} className="absolute top-6 left-6 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
          {uploadingCover ? <Loader2 size={16} className="animate-spin text-white" /> : <Camera size={16} className="text-white/80" />}
        </button>

        {/* Center Avatar Overlap */}
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
          <div className="relative group">
            <div className="w-28 h-28 rounded-full border-2 border-[#0d0d0f] overflow-hidden bg-[#111] shadow-2xl relative">
              {data.profile?.avatar_url ? (
                <img src={data.profile.avatar_url} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><UserCircle size={40} className="text-white/20" /></div>
              )}
              {/* Avatar Edit Overlay */}
              <button onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} className="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100">
                {uploadingAvatar ? <Loader2 size={24} className="animate-spin text-white" /> : <Camera size={24} />}
              </button>
            </div>
            {/* Small camera badge */}
            <div className="absolute bottom-1 -right-1 w-8 h-8 rounded-full bg-accent-primary border-2 border-[#0d0d0f] flex items-center justify-center shadow-lg pointer-events-none">
              <Camera size={12} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* 📊 Minimal Stats Strip */}
      <div className="mt-16 w-full flex justify-center items-center gap-3 text-[11px] font-black uppercase tracking-widest text-white/40">
        <span className="flex items-center gap-1"><Zap size={12} className="text-amber-400" /> {data.profile?.crd_balance || 0} CRD</span>
        <span>•</span>
        <span className="text-accent-primary drop-shadow-[0_0_5px_rgba(var(--color-accent-primary),0.5)]">LVL {data.profile?.level || 1}</span>
        <span>•</span>
        <span>{data.profile?.xp || 0} XP</span>
      </div>

      {/* 📝 OS Data Cells Container */}
      <div className="px-6 mt-10 flex flex-col gap-3">

        {/* Signal Price Cell */}
        <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex flex-col">
            <span className="text-white font-black text-[13px]">תעריף סיגנל</span>
            <span className="text-white/40 text-[10px] font-bold mt-0.5">עלות שליחת הודעה אליך</span>
          </div>
          <div className="flex items-center gap-2 bg-[#0a0a0a] border border-white/10 px-3 py-1.5 rounded-xl">
            <input type="number" value={formData.signal_price} onChange={(e) => setFormData(p => ({...p, signal_price: Number(e.target.value)}))} className="w-10 bg-transparent text-accent-primary font-black text-[15px] outline-none text-center" dir="ltr" />
            <Zap size={14} className="text-amber-400 fill-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.4)]" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-2">
          <InputField label="שם מלא" icon={UserCheck} value={formData.full_name} onChange={v => setFormData(p=>({...p, full_name: v}))} placeholder="השם שלך" />
          <InputField label="שם משתמש" icon={AtSign} value={formData.username} onChange={v => setFormData(p=>({...p, username: v.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '')}))} placeholder="username" dir="ltr" />
        </div>
        
        {/* Bio Cell */}
        <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-4 flex flex-col gap-1.5 focus-within:border-accent-primary/40 focus-within:bg-white/[0.05] transition-all relative shadow-sm">
          <label className="text-white/30 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 pointer-events-none">
            <MessageSquare size={12} className="text-white/20"/>אודות (Bio)
          </label>
          <textarea value={formData.bio} onChange={e => setFormData(p=>({...p, bio: e.target.value}))} className="bg-transparent text-white text-[14px] font-medium outline-none placeholder:text-white/20 w-full h-20 resize-none leading-relaxed mt-1" placeholder="ספר על עצמך..." />
        </div>

        <InputField label="קישור חברתי" icon={LinkIcon} value={formData.social_link} onChange={v => setFormData(p=>({...p, social_link: v}))} placeholder="instagram.com/user" dir="ltr" />
        <InputField label="עיסוק / מקצוע" icon={Briefcase} value={formData.job_title} onChange={v => setFormData(p=>({...p, job_title: v}))} placeholder="מעצב מוצר, משקיע..." />
        
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="מין" icon={Users} value={selectedGender ? selectedGender.name : ''} placeholder="בחר מין" onClick={() => setShowGenderPicker(true)} />
          <SelectField label="מזל" icon={Sparkles} value={selectedZodiac ? `${selectedZodiac.icon} ${selectedZodiac.name}` : ''} placeholder="בחר מזל" onClick={() => setShowZodiacPicker(true)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InputField label="מיקום" icon={MapPin} value={formData.location} onChange={v => setFormData(p=>({...p, location: v}))} placeholder="תל אביב" />
          <InputField label="תאריך לידה" icon={Calendar} value={formData.birth_date} onChange={v => setFormData(p=>({...p, birth_date: v}))} placeholder="" type="date" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SelectField label="מצב משפחתי" icon={HeartHandshake} value={selectedRelationship ? selectedRelationship.name : ''} placeholder="בחר מצב" onClick={() => setShowRelationshipPicker(true)} />
          <InputField label="השכלה" icon={GraduationCap} value={formData.education} onChange={v => setFormData(p=>({...p, education: v}))} placeholder="מוסד לימודים..." />
        </div>

      </div>

      {/* 🚀 Floating Save Button - Clear and Fixed */}
      <div className="fixed bottom-0 left-0 w-full px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-8 bg-gradient-to-t from-[#0d0d0f] via-[#0d0d0f]/95 to-transparent z-50 pointer-events-none">
        <button onClick={handleSaveDetails} disabled={savingDetails} className="w-full h-14 bg-white text-black rounded-full font-black text-[14px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_10px_40px_rgba(255,255,255,0.15)] active:scale-95 disabled:opacity-50 transition-transform pointer-events-auto">
          {savingDetails ? <Loader2 size={20} className="animate-spin text-black" /> : <><Save size={18} strokeWidth={2.5} /> שמור שינויים</>}
        </button>
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
                      <button key={sign.name} onClick={() => { setFormData(p => ({ ...p, zodiac: sign.name })); triggerFeedback('pop'); setShowZodiacPicker(false); }} className={`flex items-center justify-center gap-2 p-4 rounded-[20px] transition-all border ${formData.zodiac === sign.name ? 'bg-accent-primary/20 border-accent-primary/50 text-accent-primary shadow-[0_0_15px_rgba(var(--color-accent-primary),0.2)]' : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}>
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
                      <button key={status.name} onClick={() => { setFormData(p => ({ ...p, relationship_status: status.name })); triggerFeedback('pop'); setShowRelationshipPicker(false); }} className={`flex items-center justify-center p-4 rounded-[20px] transition-all border ${formData.relationship_status === status.name ? 'bg-accent-primary/20 border-accent-primary/50 text-accent-primary shadow-[0_0_15px_rgba(var(--color-accent-primary),0.2)]' : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}>
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
                      <button key={gender.name} onClick={() => { setFormData(p => ({ ...p, gender: gender.name })); triggerFeedback('pop'); setShowGenderPicker(false); }} className={`flex items-center justify-center gap-3 p-4 rounded-[20px] transition-all border ${formData.gender === gender.name ? 'bg-accent-primary/20 border-accent-primary/50 text-accent-primary shadow-[0_0_15px_rgba(var(--color-accent-primary),0.2)]' : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}>
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

// 🌌 Minimal Glass Input Cell
interface InputFieldProps { label: string; icon: React.ElementType; value: string | number; onChange: (value: string) => void; placeholder: string; type?: string; dir?: string;}
const InputField: React.FC<InputFieldProps> = ({ label, icon: Icon, value, onChange, placeholder, type = 'text', dir = 'rtl' }) => (
  <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-3.5 flex flex-col gap-1 focus-within:border-accent-primary/40 focus-within:bg-white/[0.05] transition-all shadow-sm">
    <label className="text-white/30 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 pointer-events-none">
      <Icon size={12} className="text-white/20" /> {label}
    </label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} className="bg-transparent text-white text-[14px] font-medium outline-none placeholder:text-white/20 w-full" placeholder={placeholder} dir={dir} style={{ colorScheme: 'dark' }} />
  </div>
);

// 🌌 Minimal Glass Select Cell
interface SelectFieldProps { label: string; icon: React.ElementType; value: string; placeholder: string; onClick: () => void; }
const SelectField: React.FC<SelectFieldProps> = ({ label, icon: Icon, value, placeholder, onClick }) => (
  <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-3.5 flex flex-col gap-1 cursor-pointer active:opacity-70 transition-opacity shadow-sm" onClick={onClick}>
    <label className="text-white/30 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 pointer-events-none">
      <Icon size={12} className="text-white/20" /> {label}
    </label>
    <div className="flex justify-between items-center mt-0.5 pointer-events-none">
      <span className={`text-[14px] font-medium truncate ${value ? 'text-white' : 'text-white/20'}`}>{value || placeholder}</span>
      <ChevronDown size={14} className="text-white/20" />
    </div>
  </div>
);
