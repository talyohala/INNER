import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCircle,
  Edit2,
  Loader2,
  Users,
  MessageSquare,
  Link as LinkIcon,
  UserCheck,
  MapPin,
  Calendar,
  GraduationCap,
  HeartHandshake,
  Shield,
  Camera,
  Key,
  Crown,
  Briefcase,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  X
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

export const EditProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, reloadProfile, loading: authLoading } = useAuth();

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [showZodiacPicker, setShowZodiacPicker] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '', username: '', bio: '', social_link: '', zodiac: '', location: '', birth_date: '', relationship_status: '', education: '', job_title: '',
  });

  const [passwordData, setPasswordData] = useState({ current_password: '', new_password: '', confirm_password: '', });

  const [data, setData] = useState<any>({ profile: {} });

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
            full_name: profileData.full_name || '', username: profileData.username || '', bio: profileData.bio || '', social_link: profileData.social_link || '', zodiac: profileData.zodiac || '', location: profileData.location || '', birth_date: profileData.birth_date ? profileData.birth_date.split('T')[0] : '', relationship_status: profileData.relationship_status || '', education: profileData.education || '', job_title: profileData.job_title || '',
          });
        }
      } catch (err: any) {
        toast.error(`שגיאה: ${err.message}`);
      } finally { setLoadingData(false); }
    };
    if (user && !authLoading) loadProfileData();
  }, [user, authLoading]);

  const profileCompleteness = useMemo(() => {
    const fields = [formData.full_name, formData.username, formData.bio, formData.social_link, formData.zodiac, formData.location, formData.birth_date, formData.relationship_status, formData.education, formData.job_title, data.profile?.avatar_url, data.profile?.cover_url];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  }, [formData, data.profile]);

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
    } catch (err: any) { toast.error(`שגיאה: ${err.message}`, { id: tid }); } finally { setUploading(false); }
  };

  const handleSaveDetails = async () => {
    if (!user?.id || savingDetails) return;
    setSavingDetails(true);
    triggerFeedback('pop');
    const tid = toast.loading('שומר שינויים...');
    try {
      const updates = { ...formData, birth_date: formData.birth_date === '' ? null : formData.birth_date };
      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (error) throw error;
      if (reloadProfile) reloadProfile();
      toast.success('הפרטים עודכנו!', { id: tid });
    } catch (err: any) { toast.error(`שגיאה: ${err.message}`, { id: tid }); } finally { setSavingDetails(false); }
  };

  const handleUpdatePassword = async () => {
    if (!user?.id || updatingPassword) return;
    if (passwordData.new_password !== passwordData.confirm_password) { toast.error('הסיסמאות לא תואמות'); return; }
    if (passwordData.new_password.length < 6) { toast.error('הסיסמה קצרה מדי'); return; }
    setUpdatingPassword(true);
    triggerFeedback('pop');
    const tid = toast.loading('מעדכן סיסמה...');
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.new_password });
      if (error) throw error;
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      toast.success('הסיסמה עודכנה!', { id: tid });
    } catch (err: any) { toast.error(`שגיאה: ${err.message}`, { id: tid }); } finally { setUpdatingPassword(false); }
  };

  if (authLoading || loadingData) {
    return <div className="min-h-screen bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" /></div>;
  }

  const selectedZodiac = ZODIAC_SIGNS.find(s => s.name === formData.zodiac);

  return (
    <div className="bg-surface min-h-screen relative font-sans" dir="rtl">
      {/* 🎇 ORIGINAL BACKGROUND GLOSS */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex justify-center">
        <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[40%] bg-white/5 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-20%] w-[60%] h-[40%] bg-white/5 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      {/* 🔝 ORIGINAL HEADER (NO BACK BUTTON) */}
      <div className="fixed top-6 left-4 right-4 flex justify-center items-center z-[99999] pointer-events-none">
        <div className="bg-surface-card/60 backdrop-blur-xl border border-surface-border px-6 py-3 rounded-full shadow-lg flex items-center gap-2.5">
          <span className="text-brand font-black text-[14px] tracking-wide">עריכת פרופיל</span>
          <Edit2 size={16} className="text-accent-primary" />
        </div>
      </div>

      {/* 📸 ORIGINAL COLORFUL COVER SECTION */}
      <div className="fixed top-0 left-0 w-full h-[220px] bg-surface-card z-0 rounded-b-[40px] overflow-hidden shadow-2xl origin-top border-b border-surface-border group">
        {data.profile?.cover_url ? (
          <img src={data.profile.cover_url} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-accent-primary/10 to-transparent" />
        )}
      </div>

      {/* 📷 COVER CAMERA ICON (LEFT POSITION KEPT) */}
      <div className="fixed top-[160px] left-6 z-[99999]">
        <input type="file" ref={coverInputRef} onChange={(e) => { if (e.target.files?.[0]) handleMediaUpload(e.target.files[0], 'cover'); if (coverInputRef.current) coverInputRef.current.value = ''; }} accept="image/*" className="hidden" />
        <button onClick={() => coverInputRef.current?.click()} disabled={uploadingCover} className="w-11 h-11 bg-surface-card/80 backdrop-blur-2xl text-brand rounded-full flex items-center justify-center shadow-xl border border-surface-border active:scale-90 transition-all disabled:opacity-50 pointer-events-auto">
          {uploadingCover ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
        </button>
      </div>

      {/* 👤 AVATAR & FORM SECTION */}
      <FadeIn className="relative z-10 pt-[170px] pb-32 pointer-events-auto">
        <div className="bg-surface/90 backdrop-blur-3xl rounded-t-[40px] px-4 min-h-screen flex flex-col items-center pt-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-surface-border relative z-10">
          
          {/* Avatar Upload */}
          <motion.div whileHover={{ scale: 1.05 }} className="w-[110px] h-[110px] rounded-full bg-surface shadow-[0_10px_30px_rgba(0,0,0,0.6)] p-1.5 relative -mt-[55px] z-20 group">
            <div className="w-full h-full rounded-full overflow-hidden bg-surface-card border border-surface-border relative">
              {data.profile?.avatar_url ? <img src={data.profile.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={50} className="text-brand-muted absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
            </div>
            <input type="file" ref={avatarInputRef} onChange={(e) => { if (e.target.files?.[0]) handleMediaUpload(e.target.files[0], 'avatar'); if (avatarInputRef.current) avatarInputRef.current.value = ''; }} accept="image/*" className="hidden" />
            <button onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} className="absolute bottom-1 left-1 w-9 h-9 bg-accent-primary text-surface rounded-full flex items-center justify-center shadow-lg border-4 border-surface active:scale-90 transition-all z-20 disabled:opacity-50"><Camera size={16} /></button>
          </motion.div>

          {/* Status Card */}
          <div className="w-full mt-8 mb-5 px-4 max-w-[500px]">
            <div className="bg-surface-card border border-surface-border rounded-[24px] p-5 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center justify-between mb-3.5">
                <div className="text-right">
                  <div className="text-brand font-black text-[16px]">מצב פרופיל</div>
                  <div className="text-brand-muted text-[10px] font-bold tracking-widest uppercase">PROFILE STATUS</div>
                </div>
                <div className="flex items-center gap-2 text-accent-primary"><CheckCircle2 size={18} /><span className="text-lg font-black">{profileCompleteness}%</span></div>
              </div>
              <div className="w-full h-2.5 bg-surface rounded-full overflow-hidden shadow-inner border border-surface-border"><motion.div initial={{ width: 0 }} animate={{ width: `${profileCompleteness}%` }} transition={{ duration: 0.8 }} className="h-full rounded-full bg-gradient-to-l from-accent-primary via-indigo-500 to-purple-500" /></div>
            </div>
          </div>

          {/* PERSONAL DETAILS */}
          <div className="px-4 flex flex-col gap-5 w-full mb-2 max-w-[500px]">
            <div className="bg-surface-card backdrop-blur-xl border border-surface-border flex flex-col gap-6 rounded-[28px] p-7 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent-primary/5 blur-3xl rounded-full" />
              <div className="flex justify-between items-center border-b border-surface-border pb-5 mb-1 relative z-10">
                <div className="flex flex-col text-right"><span className="text-brand font-black text-[17px] tracking-wide">פרטים אישיים</span><span className="text-brand-muted text-[11px] uppercase font-bold tracking-widest">PERSONAL DETAILS</span></div>
                <Users size={20} className="text-accent-primary" />
              </div>

              <div className="grid grid-cols-1 gap-5 relative z-10">
                <InputField label="שם מלא" icon={UserCheck} value={formData.full_name} onChange={v => setFormData(p=>({...p, full_name: v}))} placeholder="ישראל ישראלי" />
                <InputField label="שם משתמש (@)" icon={Edit2} value={formData.username} onChange={v => setFormData(p=>({...p, username: v}))} placeholder="user123" />
                <div className="flex flex-col gap-2 text-right"><label className="text-brand-muted text-[12px] font-bold tracking-widest uppercase flex items-center gap-2"><MessageSquare size={14} /><span>ביו</span></label><textarea value={formData.bio} onChange={e => setFormData(p=>({...p, bio: e.target.value}))} className="bg-surface border border-surface-border rounded-xl px-4 py-3 text-brand text-[15px] font-medium placeholder:text-brand-muted focus:border-accent-primary/50 h-28 resize-none shadow-inner" placeholder="ספר קצת על עצמך..." /></div>
                <InputField label="קישור חברתי" icon={LinkIcon} value={formData.social_link} onChange={v => setFormData(p=>({...p, social_link: v}))} placeholder="instagram.com/user" />

                <div className="grid grid-cols-2 gap-4">
                  {/* ⭐ ZODIAC SELECTOR */}
                  <div className="flex flex-col gap-2 text-right cursor-pointer" onClick={() => setShowZodiacPicker(true)}>
                    <label className="text-brand-muted text-[12px] font-bold tracking-widest uppercase flex items-center gap-2"><Crown size={14} /><span>מזל</span></label>
                    <div className="bg-surface border border-surface-border rounded-xl px-4 py-3 text-brand text-[15px] font-medium flex items-center justify-between h-[48px] shadow-inner">
                      {selectedZodiac ? <span>{selectedZodiac.icon} {selectedZodiac.name}</span> : <span className="text-brand-muted">בחר מזל...</span>}
                      <ChevronDown size={18} className="text-brand-muted" />
                    </div>
                  </div>
                  <InputField label="מתגורר ב" icon={MapPin} value={formData.location} onChange={v => setFormData(p=>({...p, location: v}))} placeholder="תל אביב" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2 text-right"><label className="text-brand-muted text-[12px] font-bold tracking-widest uppercase flex items-center gap-2"><Calendar size={14} /><span>תאריך לידה</span></label><input type="date" value={formData.birth_date} onChange={e => setFormData(p=>({...p, birth_date: e.target.value}))} className="bg-surface border border-surface-border rounded-xl px-4 py-3 text-brand text-[15px] font-medium text-right shadow-inner" style={{ colorScheme: 'dark' }} /></div>
                  <InputField label="מצב משפחתי" icon={HeartHandshake} value={formData.relationship_status} onChange={v => setFormData(p=>({...p, relationship_status: v}))} placeholder="במערכת יחסים" />
                </div>

                <InputField label="עיסוק" icon={Briefcase} value={formData.job_title} onChange={v => setFormData(p=>({...p, job_title: v}))} placeholder="מעצב מוצר" />
                <InputField label="השכלה / קריירה" icon={GraduationCap} value={formData.education} onChange={v => setFormData(p=>({...p, education: v}))} placeholder="סטודנט למדעי המחשב" />
              </div>

              <div className="flex justify-between items-center mt-3 bg-surface/50 border border-surface-border rounded-[20px] px-5 py-4 relative z-10"><div className="text-right"><div className="text-brand text-[14px] font-black">תצוגת אודות בפרופיל</div><div className="text-brand-muted text-[12px]">הפרטים יוצגו בתוך אזור אודות שנפתח בפרופיל.</div></div><Sparkles size={18} className="text-accent-primary" /></div>
              <div className="flex justify-end mt-2 relative z-10"><Button onClick={handleSaveDetails} disabled={savingDetails} className="bg-accent-primary text-surface rounded-xl font-black text-[14px] tracking-wide px-10 h-12 shadow-lg">{savingDetails ? <Loader2 size={18} className="animate-spin" /> : 'שמור שינויים'}</Button></div>
            </div>

            {/* SECURITY */}
            <div className="bg-surface-card backdrop-blur-xl border border-surface-border flex flex-col gap-6 rounded-[28px] p-7 shadow-2xl mb-6 relative overflow-hidden">
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full" />
              <div className="flex justify-between items-center border-b border-surface-border pb-5 mb-1 relative z-10">
                <div className="flex flex-col text-right"><span className="text-brand font-black text-[17px] tracking-wide">אבטחה וסיסמה</span><span className="text-brand-muted text-[11px] uppercase font-bold tracking-widest">SECURITY</span></div>
                <Key size={20} className="text-accent-primary" />
              </div>
              <div className="flex flex-col gap-4 relative z-10"><InputField label="סיסמה נוכחית" icon={Shield} value={passwordData.current_password} onChange={v => setPasswordData(p=>({...p, current_password: v}))} placeholder="••••••••" type="password" /><InputField label="סיסמה חדשה" icon={Shield} value={passwordData.new_password} onChange={v => setPasswordData(p=>({...p, new_password: v}))} placeholder="••••••••" type="password" /><InputField label="אימות סיסמה חדשה" icon={UserCheck} value={passwordData.confirm_password} onChange={v => setPasswordData(p=>({...p, confirm_password: v}))} placeholder="••••••••" type="password" /></div>
              <div className="flex justify-end mt-3 relative z-10"><Button onClick={handleUpdatePassword} disabled={updatingPassword} className="bg-surface border border-surface-border text-brand rounded-xl font-black text-[14px] px-10 h-12 shadow-md">{updatingPassword ? <Loader2 size={18} className="animate-spin" /> : 'עדכן סיסמה'}</Button></div>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* 🔮 ZODIAC PICKER BOTTOM SHEET */}
      <AnimatePresence>
        {showZodiacPicker && (
          <div className="fixed inset-0 z-[100000] flex flex-col justify-end" dir="rtl">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowZodiacPicker(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 400 }} className="relative z-10 bg-surface rounded-t-[40px] p-6 pb-12 border-t border-surface-border max-h-[80vh] flex flex-col">
              <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-6 shrink-0" />
              <div className="flex justify-between items-center mb-6 shrink-0"><h3 className="text-brand font-black text-lg">בחר את המזל שלך</h3><button onClick={() => setShowZodiacPicker(false)} className="text-brand-muted hover:text-brand"><X size={22} /></button></div>
              <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-3 scrollbar-hide pr-1">
                {ZODIAC_SIGNS.map((sign) => (
                  <button key={sign.name} onClick={() => { setFormData(p => ({ ...p, zodiac: sign.name })); triggerFeedback('pop'); setShowZodiacPicker(false); }} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${formData.zodiac === sign.name ? 'bg-accent-primary border-accent-primary text-surface' : 'bg-surface-card border-surface-border text-brand hover:border-brand/30'}`}>
                    <span className="text-2xl">{sign.icon}</span>
                    <span className="font-bold text-[15px]">{sign.name}</span>
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

interface InputFieldProps { label: string; icon: React.ElementType; value: string; onChange: (value: string) => void; placeholder: string; type?: string; }
const InputField: React.FC<InputFieldProps> = ({ label, icon: Icon, value, onChange, placeholder, type = 'text' }) => (
  <div className="flex flex-col gap-2 text-right">
    <label className="text-brand-muted text-[12px] font-bold tracking-widest uppercase flex items-center justify-start gap-2"><Icon size={14} /><span>{label}</span></label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} className="bg-surface border border-surface-border rounded-xl px-4 py-3 text-brand text-[15px] font-medium placeholder:text-brand-muted focus:border-accent-primary/50 transition-colors shadow-inner" placeholder={placeholder} />
  </div>
);
