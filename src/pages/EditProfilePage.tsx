import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { 
  UserCircle, Edit2, Loader2, Users, MessageSquare, Link as LinkIcon, 
  UserCheck, MapPin, Calendar, GraduationCap, HeartHandshake, Camera, 
  Crown, Briefcase, Sparkles, ChevronDown, Zap, ArrowLeft, Save
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
  
  const currentLevel = data.profile?.level || 1;
  const xpProgress = Math.min(100, ((data.profile?.xp || 0) % 1000) / 10);

  return (
    <FadeIn className="bg-[#0d0d0f] min-h-screen font-sans text-white overflow-x-hidden relative" dir="rtl">
      
      {/* 🌌 Hero Cover Background (OS Style) */}
      <div className="absolute top-0 left-0 w-full h-[320px] z-0 pointer-events-none">
        {data.profile?.cover_url ? (
          <div className="w-full h-full relative">
            <img src={data.profile.cover_url} className="w-full h-full object-cover opacity-50" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d0f]/20 via-[#0d0d0f]/60 to-[#0d0d0f]" />
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-accent-primary/20 via-[#0d0d0f]/80 to-[#0d0d0f]" />
        )}
      </div>

      <div className="relative z-10 w-full pt-[calc(env(safe-area-inset-top)+20px)] flex flex-col">
        
        {/* Header Actions */}
        <div className="px-6 flex justify-between items-center z-50 w-full mb-10">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 active:scale-90 transition-transform">
            <ArrowLeft size={20} />
          </button>
          <span className="text-white font-black text-[12px] tracking-[0.25em] uppercase drop-shadow-md">עריכת נתונים</span>
          <div className="w-10 h-10" /> {/* Spacer */}
        </div>

        {/* 📸 Media Upload Area */}
        <div className="flex flex-col items-center relative w-full mb-12">
          {/* Cover Edit Button */}
          <div className="absolute -top-6 right-6 z-20">
            <input type="file" ref={coverInputRef} onChange={(e) => { if (e.target.files?.[0]) handleMediaUpload(e.target.files[0], 'cover'); if (coverInputRef.current) coverInputRef.current.value = ''; }} accept="image/*" className="hidden" />
            <button onClick={() => coverInputRef.current?.click()} disabled={uploadingCover} className="flex items-center gap-2 bg-black/60 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg active:scale-95 transition-transform disabled:opacity-50">
              {uploadingCover ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} רקע
            </button>
          </div>

          {/* Avatar Area */}
          <div className="relative group">
            <div className="absolute -inset-1 rounded-full border border-accent-primary/20 blur-[2px]" />
            <div className="w-28 h-28 rounded-full p-1 bg-black/40 backdrop-blur-xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.8)] relative z-10">
              <div className="w-full h-full rounded-full overflow-hidden bg-[#111] relative">
                {data.profile?.avatar_url ? (
                  <img src={data.profile.avatar_url} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/20"><UserCircle size={40} /></div>
                )}
                {/* Upload Overlay */}
                <input type="file" ref={avatarInputRef} onChange={(e) => { if (e.target.files?.[0]) handleMediaUpload(e.target.files[0], 'avatar'); if (avatarInputRef.current) avatarInputRef.current.value = ''; }} accept="image/*" className="hidden" />
                <button onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} className="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100">
                  {uploadingAvatar ? <Loader2 size={24} className="animate-spin text-accent-primary" /> : <Camera size={24} />}
                </button>
              </div>
            </div>
            {/* Small camera badge */}
            <div className="absolute bottom-0 -right-1 w-8 h-8 rounded-full bg-accent-primary border-2 border-[#0d0d0f] flex items-center justify-center text-white shadow-lg z-20 pointer-events-none">
              <Camera size={12} />
            </div>
          </div>
        </div>

        <div className="px-5 flex flex-col gap-6 pb-32">
          
          {/* 📊 Core Stats Dashboard */}
          <div className="bg-[#111]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-lg flex flex-col gap-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-32 h-32 bg-accent-primary/10 blur-[50px] rounded-full pointer-events-none" />
            
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-[16px] bg-accent-primary/10 flex items-center justify-center border border-accent-primary/20">
                  <Crown size={20} className="text-accent-primary drop-shadow-md" />
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-white font-black text-[16px]">רמה {currentLevel}</span>
                  <span className="text-white/40 text-[10px] font-black tracking-widest uppercase mt-0.5">{data.profile?.role_label || 'Member'}</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-white font-black text-[18px] flex items-center gap-1.5">
                  {data.profile?.crd_balance || 0} <Zap size={16} className="text-amber-400 fill-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.6)]" />
                </span>
                <span className="text-white/40 text-[9px] font-black tracking-widest uppercase mt-0.5">CRD יתרה</span>
              </div>
            </div>
            
            <div className="flex flex-col gap-2 relative z-10">
              <div className="flex justify-between text-[9px] font-black text-white/50 tracking-widest uppercase px-1">
                <span>{data.profile?.xp || 0} XP</span>
                <span>לרמה {currentLevel + 1}</span>
              </div>
              <div className="w-full h-2 bg-[#0a0a0a] rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-accent-primary rounded-full shadow-[0_0_10px_rgba(var(--color-accent-primary),0.8)]" style={{ width: `${xpProgress}%` }} />
              </div>
            </div>
          </div>

          {/* 📝 Identity Form Fields */}
          <div className="flex flex-col gap-4">
            
            {/* Signal Price */}
            <div className="bg-[#111]/80 backdrop-blur-xl border border-white/5 rounded-[20px] p-4 flex items-center justify-between shadow-sm">
              <div className="flex flex-col">
                <span className="text-white font-black text-[13px]">תעריף סיגנל</span>
                <span className="text-white/40 text-[10px] font-bold mt-0.5">עלות שליחת הודעה אליך (CRD)</span>
              </div>
              <div className="flex items-center gap-2 bg-[#0a0a0a] border border-white/10 px-4 py-2 rounded-[14px]">
                <input type="number" value={formData.signal_price} onChange={(e) => setFormData(p => ({...p, signal_price: Number(e.target.value)}))} className="w-10 bg-transparent text-accent-primary font-black text-[15px] outline-none text-center" dir="ltr" />
                <Zap size={16} className="text-amber-400 fill-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.4)]" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <InputField label="שם מלא" icon={UserCheck} value={formData.full_name} onChange={v => setFormData(p=>({...p, full_name: v}))} placeholder="השם שלך" />
              <InputField label="שם משתמש" icon={AtSignIcon} value={formData.username} onChange={v => setFormData(p=>({...p, username: v.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '')}))} placeholder="username" dir="ltr" />
            </div>

            {/* Bio Field */}
            <div className="bg-[#111]/60 backdrop-blur-xl border border-white/5 rounded-[20px] p-4 flex flex-col gap-2 shadow-sm focus-within:border-accent-primary/40 transition-colors">
              <label className="text-white/40 text-[10px] font-black tracking-widest uppercase flex items-center gap-2"><MessageSquare size={14} className="text-accent-primary/80" /> אודות (Bio)</label>
              <textarea value={formData.bio} onChange={e => setFormData(p=>({...p, bio: e.target.value}))} className="bg-transparent border-none outline-none text-white text-[14px] font-medium placeholder:text-white/20 h-24 resize-none leading-relaxed" placeholder="ספר על עצמך בקצרה..." />
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
        </div>
      </div>

      {/* 🚀 Sticky Save Button */}
      <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-[#0d0d0f] via-[#0d0d0f]/90 to-transparent z-50">
        <button onClick={handleSaveDetails} disabled={savingDetails} className="w-full h-[60px] bg-accent-primary text-white rounded-full font-black text-[14px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(var(--color-accent-primary),0.4)] active:scale-95 disabled:opacity-50 transition-transform">
          {savingDetails ? <Loader2 size={20} className="animate-spin" /> : <><Save size={18} /> שמור שינויים</>}
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
                        {gender.icon}
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

// 🌌 Reusable Dark Glass Input
interface InputFieldProps { label: string; icon: React.ElementType; value: string | number; onChange: (value: string) => void; placeholder: string; type?: string; dir?: string;}
const InputField: React.FC<InputFieldProps> = ({ label, icon: Icon, value, onChange, placeholder, type = 'text', dir = 'rtl' }) => (
  <div className="bg-[#111]/60 backdrop-blur-xl border border-white/5 rounded-[20px] p-4 flex flex-col gap-2 shadow-sm focus-within:border-accent-primary/40 transition-colors h-[86px]">
    <label className="text-white/40 text-[9px] font-black tracking-widest uppercase flex items-center justify-start gap-1.5"><Icon size={12} className="text-accent-primary/80" />{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} className="bg-transparent border-none outline-none text-white text-[13px] font-bold placeholder:text-white/20 transition-colors w-full" placeholder={placeholder} dir={dir} style={{ colorScheme: 'dark' }} />
  </div>
);

// 🌌 Reusable Dark Glass Select
interface SelectFieldProps { label: string; icon: React.ElementType; value: string; placeholder: string; onClick: () => void; }
const SelectField: React.FC<SelectFieldProps> = ({ label, icon: Icon, value, placeholder, onClick }) => (
  <div className="bg-[#111]/60 backdrop-blur-xl border border-white/5 rounded-[20px] p-4 flex flex-col gap-2 shadow-sm cursor-pointer active:scale-95 transition-transform h-[86px]" onClick={onClick}>
    <label className="text-white/40 text-[9px] font-black tracking-widest uppercase flex items-center justify-start gap-1.5 pointer-events-none"><Icon size={12} className="text-accent-primary/80" />{label}</label>
    <div className="flex justify-between items-center pointer-events-none">
      <span className={`text-[13px] font-bold truncate ${value ? 'text-white' : 'text-white/20'}`}>{value || placeholder}</span>
      <ChevronDown size={14} className="text-white/30" />
    </div>
  </div>
);

// Helper Icon that was missing
const AtSignIcon = ({ size, className }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4.5 8.4"/></svg>
);
