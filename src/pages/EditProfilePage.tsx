import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  UserCircle,
  Edit2,
  ChevronLeft,
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
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

export const EditProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile: authProfile, loading: authLoading, reloadProfile } = useAuth();

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    bio: '',
    social_link: '',
    zodiac: '',
    location: '',
    birth_date: '',
    relationship_status: '',
    education: '',
    job_title: '',
  });

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

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
          let safeDate = '';
          if (profileData.birth_date && typeof profileData.birth_date === 'string') {
            safeDate = profileData.birth_date.split('T')[0];
          }

          setFormData({
            full_name: profileData.full_name || '',
            username: profileData.username || '',
            bio: profileData.bio || '',
            social_link: profileData.social_link || '',
            zodiac: profileData.zodiac || '',
            location: profileData.location || '',
            birth_date: safeDate,
            relationship_status: profileData.relationship_status || '',
            education: profileData.education || '',
            job_title: profileData.job_title || '',
          });
        }
      } catch (err: any) {
        toast.error(`שגיאה בטעינת הנתונים: ${err.message}`);
      } finally {
        setLoadingData(false);
      }
    };

    if (user && !authLoading) loadProfileData();
  }, [user, authLoading]);

  const profileCompleteness = useMemo(() => {
    const fields = [
      formData.full_name,
      formData.username,
      formData.bio,
      formData.social_link,
      formData.zodiac,
      formData.location,
      formData.birth_date,
      formData.relationship_status,
      formData.education,
      formData.job_title,
      data.profile?.avatar_url,
      data.profile?.cover_url,
    ];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  }, [formData, data.profile]);

  const handleMediaUpload = async (file: File, type: 'avatar' | 'cover') => {
    if (!file || !user?.id) return;

    const setUploading = type === 'avatar' ? setUploadingAvatar : setUploadingCover;
    setUploading(true);

    const tid = toast.loading(`מעדכן תמונת ${type === 'avatar' ? 'פרופיל' : 'נושא'}...`);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}_${type}_${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage.from('feed_images').upload(fileName, file);
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('feed_images').getPublicUrl(uploadData.path);

      const fieldToUpdate = type === 'avatar' ? 'avatar_url' : 'cover_url';
      const { error: updateError } = await supabase.from('profiles').update({ [fieldToUpdate]: publicUrl }).eq('id', user.id);
      if (updateError) throw updateError;

      if (reloadProfile) reloadProfile();

      setData((prev: any) => ({
        ...prev,
        profile: {
          ...prev.profile,
          [fieldToUpdate]: publicUrl,
        },
      }));

      triggerFeedback('success');
      toast.success(`תמונת ה${type === 'avatar' ? 'פרופיל' : 'נושא'} עודכנה בהצלחה!`, { id: tid });
    } catch (err: any) {
      triggerFeedback('error');
      toast.error(`שגיאה בהעלאה: ${err.message}`, { id: tid });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!user?.id || savingDetails) return;

    setSavingDetails(true);
    triggerFeedback('pop');

    const tid = toast.loading('שומר שינויים...');

    try {
      const updates = {
        ...formData,
        birth_date: formData.birth_date === '' ? null : formData.birth_date,
      };

      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (error) throw error;

      if (reloadProfile) reloadProfile();

      setData((prev: any) => ({
        ...prev,
        profile: {
          ...prev.profile,
          ...updates,
        },
      }));

      triggerFeedback('success');
      toast.success('הפרטים עודכנו בהצלחה!', { id: tid });
    } catch (err: any) {
      triggerFeedback('error');
      toast.error(`שגיאה: ${err.message || 'נכשל בעדכון'}`, { id: tid });
    } finally {
      setSavingDetails(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!user?.id || updatingPassword) return;

    if (passwordData.new_password !== passwordData.confirm_password) {
      triggerFeedback('error');
      toast.error('הסיסמאות החדשות לא תואמות');
      return;
    }

    if (passwordData.new_password.length < 6) {
      triggerFeedback('error');
      toast.error('הסיסמה החדשה חייבת להיות לפחות 6 תווים');
      return;
    }

    setUpdatingPassword(true);
    triggerFeedback('pop');

    const tid = toast.loading('מעדכן סיסמה...');

    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.new_password });
      if (error) throw error;

      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });

      triggerFeedback('success');
      toast.success('הסיסמה עודכנה בהצלחה!', { id: tid });
    } catch (err: any) {
      triggerFeedback('error');
      toast.error(`שגיאה: ${err.message}`, { id: tid });
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (authLoading || loadingData) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 className="animate-spin text-accent-primary" />
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen relative font-sans" dir="rtl">
      
      {/* 🔝 HEADER */}
      <div className="fixed top-4 left-4 right-4 flex justify-between items-center z-50 pointer-events-none">
        <button
          onClick={() => { triggerFeedback('pop'); navigate(-1); }}
          className="pointer-events-auto w-10 h-10 flex justify-center items-center bg-surface-card border border-surface-border rounded-full shadow-sm active:scale-90 transition-all hover:bg-white/5"
        >
          <ChevronLeft size={20} className="text-brand" />
        </button>

        <div className="bg-surface-card border border-surface-border px-5 py-2.5 rounded-full shadow-sm flex items-center gap-2 pointer-events-auto">
          <span className="text-brand font-black text-[12px] tracking-widest uppercase">עריכת פרופיל</span>
        </div>
        
        <div className="w-10" /> {/* Spacer for symmetry */}
      </div>

      {/* 📸 COVER SECTION */}
      <div className="relative w-full h-[200px] bg-black overflow-hidden shrink-0 z-0">
        <input
          type="file"
          ref={coverInputRef}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) handleMediaUpload(e.target.files[0], 'cover');
            if (coverInputRef.current) coverInputRef.current.value = '';
          }}
          accept="image/*"
          className="hidden"
        />
        
        {data.profile?.cover_url ? (
          <img src={data.profile.cover_url} className="w-full h-full object-cover opacity-60 mix-blend-luminosity" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-surface-card to-surface" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />

        <button
          onClick={(e) => { e.preventDefault(); coverInputRef.current?.click(); }}
          disabled={uploadingCover}
          className="absolute bottom-4 left-4 w-10 h-10 bg-surface-card/80 backdrop-blur-md text-brand rounded-full flex items-center justify-center border border-surface-border active:scale-90 transition-all shadow-sm disabled:opacity-50 z-20"
        >
          {uploadingCover ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
        </button>
      </div>

      {/* 👤 AVATAR & FORM SECTION */}
      <FadeIn className="relative z-10 pb-32">
        <div className="bg-surface px-4 flex flex-col items-center pt-0">
          
          {/* Avatar Upload */}
          <div className="relative -mt-12 z-20 mb-6">
            <input
              type="file"
              ref={avatarInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) handleMediaUpload(e.target.files[0], 'avatar');
                if (avatarInputRef.current) avatarInputRef.current.value = '';
              }}
              accept="image/*"
              className="hidden"
            />
            
            <div className="w-[100px] h-[100px] rounded-full bg-surface p-1.5 shadow-sm">
              <div className="w-full h-full rounded-full overflow-hidden bg-surface-card border border-surface-border flex items-center justify-center relative">
                {data.profile?.avatar_url ? (
                  <img src={data.profile.avatar_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  <UserCircle size={40} className="text-brand-muted" />
                )}
              </div>
            </div>

            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute bottom-1 right-1 w-9 h-9 bg-surface-card text-brand border border-surface-border rounded-full flex items-center justify-center shadow-md active:scale-90 transition-all z-20 disabled:opacity-50"
            >
              {uploadingAvatar ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            </button>
          </div>

          {/* Profile Completeness Status */}
          <div className="w-full max-w-[500px] mb-6">
            <div className="bg-surface-card border border-surface-border rounded-[24px] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-right">
                  <div className="text-brand font-black text-[14px]">מצב פרופיל</div>
                  <div className="text-brand-muted text-[10px] font-black tracking-widest uppercase">Profile Status</div>
                </div>
                <div className="flex items-center gap-1.5 text-accent-primary">
                  <CheckCircle2 size={16} />
                  <span className="text-[16px] font-black tabular-nums">{profileCompleteness}%</span>
                </div>
              </div>

              <div className="w-full h-2.5 bg-surface rounded-full overflow-hidden shadow-inner border border-surface-border">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${profileCompleteness}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full bg-accent-primary"
                />
              </div>
            </div>
          </div>

          {/* FORM: PERSONAL DETAILS */}
          <div className="w-full max-w-[500px] flex flex-col gap-6">
            <div className="bg-surface-card border border-surface-border flex flex-col gap-5 rounded-[28px] p-6 shadow-sm">
              
              <div className="flex justify-between items-center border-b border-surface-border pb-4">
                <div className="flex flex-col text-right">
                  <span className="text-brand font-black text-[15px] tracking-wide">פרטים אישיים</span>
                  <span className="text-brand-muted text-[10px] uppercase font-black tracking-widest">Personal Details</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-surface border border-surface-border flex items-center justify-center text-brand-muted">
                  <Users size={18} />
                </div>
              </div>

              <div className="flex flex-col gap-4">
                
                {/* Name & Username */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5 text-right w-full">
                    <label className="text-brand-muted text-[11px] font-black tracking-widest uppercase flex items-center gap-1.5">
                      <UserCheck size={12} /> <span>שם מלא</span>
                    </label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, full_name: e.target.value }))}
                      className="w-full bg-surface border border-surface-border rounded-2xl px-4 py-3 text-brand text-[13px] font-bold focus:border-accent-primary/50 outline-none transition-colors"
                      placeholder="ישראל ישראלי"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 text-right w-full">
                    <label className="text-brand-muted text-[11px] font-black tracking-widest uppercase flex items-center gap-1.5">
                      <Edit2 size={12} /> <span>שם משתמש</span>
                    </label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                      className="w-full bg-surface border border-surface-border rounded-2xl px-4 py-3 text-brand text-[13px] font-bold focus:border-accent-primary/50 outline-none transition-colors"
                      placeholder="user123"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Bio */}
                <div className="flex flex-col gap-1.5 text-right w-full">
                  <label className="text-brand-muted text-[11px] font-black tracking-widest uppercase flex items-center gap-1.5">
                    <MessageSquare size={12} /> <span>ביו</span>
                  </label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
                    className="w-full bg-surface border border-surface-border rounded-2xl px-4 py-3 text-brand text-[13px] font-medium focus:border-accent-primary/50 outline-none transition-colors h-24 resize-none"
                    placeholder="ספר קצת על עצמך..."
                  />
                </div>

                {/* Social & Zodiac */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5 text-right w-full">
                    <label className="text-brand-muted text-[11px] font-black tracking-widest uppercase flex items-center gap-1.5">
                      <LinkIcon size={12} /> <span>קישור חברתי</span>
                    </label>
                    <input
                      type="text"
                      value={formData.social_link}
                      onChange={(e) => setFormData((prev) => ({ ...prev, social_link: e.target.value }))}
                      className="w-full bg-surface border border-surface-border rounded-2xl px-4 py-3 text-brand text-[13px] font-medium focus:border-accent-primary/50 outline-none transition-colors"
                      placeholder="instagram.com/user"
                      dir="ltr"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 text-right w-full">
                    <label className="text-brand-muted text-[11px] font-black tracking-widest uppercase flex items-center gap-1.5">
                      <Crown size={12} /> <span>מזל</span>
                    </label>
                    <input
                      type="text"
                      value={formData.zodiac}
                      onChange={(e) => setFormData((prev) => ({ ...prev, zodiac: e.target.value }))}
                      className="w-full bg-surface border border-surface-border rounded-2xl px-4 py-3 text-brand text-[13px] font-medium focus:border-accent-primary/50 outline-none transition-colors"
                      placeholder="אריה"
                    />
                  </div>
                </div>

                {/* Location & Birth Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5 text-right w-full">
                    <label className="text-brand-muted text-[11px] font-black tracking-widest uppercase flex items-center gap-1.5">
                      <MapPin size={12} /> <span>מתגורר ב</span>
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                      className="w-full bg-surface border border-surface-border rounded-2xl px-4 py-3 text-brand text-[13px] font-medium focus:border-accent-primary/50 outline-none transition-colors"
                      placeholder="תל אביב"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 text-right w-full">
                    <label className="text-brand-muted text-[11px] font-black tracking-widest uppercase flex items-center gap-1.5">
                      <Calendar size={12} /> <span>תאריך לידה</span>
                    </label>
                    <input
                      type="date"
                      value={formData.birth_date}
                      onChange={(e) => setFormData((prev) => ({ ...prev, birth_date: e.target.value }))}
                      className="w-full bg-surface border border-surface-border rounded-2xl px-4 py-3 text-brand text-[13px] font-medium focus:border-accent-primary/50 outline-none transition-colors text-right"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                </div>

                {/* Relationship & Job */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5 text-right w-full">
                    <label className="text-brand-muted text-[11px] font-black tracking-widest uppercase flex items-center gap-1.5">
                      <HeartHandshake size={12} /> <span>מצב משפחתי</span>
                    </label>
                    <input
                      type="text"
                      value={formData.relationship_status}
                      onChange={(e) => setFormData((prev) => ({ ...prev, relationship_status: e.target.value }))}
                      className="w-full bg-surface border border-surface-border rounded-2xl px-4 py-3 text-brand text-[13px] font-medium focus:border-accent-primary/50 outline-none transition-colors"
                      placeholder="רווק/ה"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 text-right w-full">
                    <label className="text-brand-muted text-[11px] font-black tracking-widest uppercase flex items-center gap-1.5">
                      <Briefcase size={12} /> <span>עיסוק</span>
                    </label>
                    <input
                      type="text"
                      value={formData.job_title}
                      onChange={(e) => setFormData((prev) => ({ ...prev, job_title: e.target.value }))}
                      className="w-full bg-surface border border-surface-border rounded-2xl px-4 py-3 text-brand text-[13px] font-medium focus:border-accent-primary/50 outline-none transition-colors"
                      placeholder="מעצב/ת"
                    />
                  </div>
                </div>

                {/* Education */}
                <div className="flex flex-col gap-1.5 text-right w-full">
                  <label className="text-brand-muted text-[11px] font-black tracking-widest uppercase flex items-center gap-1.5">
                    <GraduationCap size={12} /> <span>השכלה / רקע</span>
                  </label>
                  <input
                    type="text"
                    value={formData.education}
                    onChange={(e) => setFormData((prev) => ({ ...prev, education: e.target.value }))}
                    className="w-full bg-surface border border-surface-border rounded-2xl px-4 py-3 text-brand text-[13px] font-medium focus:border-accent-primary/50 outline-none transition-colors"
                    placeholder="לימודי מדעי המחשב"
                  />
                </div>
                
              </div>

              {/* Save Details Button */}
              <div className="mt-2">
                <Button
                  onClick={handleSaveDetails}
                  disabled={savingDetails}
                  className="w-full bg-white text-black rounded-2xl font-black text-[14px] tracking-widest uppercase flex items-center justify-center active:scale-95 transition-transform h-14 shadow-md"
                >
                  {savingDetails ? <Loader2 size={20} className="animate-spin text-black" /> : 'שמור פרופיל'}
                </Button>
              </div>

            </div>

            {/* FORM: SECURITY */}
            <div className="bg-surface-card border border-surface-border flex flex-col gap-5 rounded-[28px] p-6 shadow-sm mb-6">
              
              <div className="flex justify-between items-center border-b border-surface-border pb-4">
                <div className="flex flex-col text-right">
                  <span className="text-brand font-black text-[15px] tracking-wide">אבטחה וסיסמה</span>
                  <span className="text-brand-muted text-[10px] uppercase font-black tracking-widest">Security</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-surface border border-surface-border flex items-center justify-center text-brand-muted">
                  <Key size={18} />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5 text-right w-full">
                  <label className="text-brand-muted text-[11px] font-black tracking-widest uppercase flex items-center gap-1.5">
                    <Shield size={12} /> <span>סיסמה נוכחית</span>
                  </label>
                  <input
                    type="password"
                    value={passwordData.current_password}
                    onChange={(e) => setPasswordData((prev) => ({ ...prev, current_password: e.target.value }))}
                    className="w-full bg-surface border border-surface-border rounded-2xl px-4 py-3 text-brand text-[13px] font-medium focus:border-accent-primary/50 outline-none transition-colors"
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex flex-col gap-1.5 text-right w-full">
                  <label className="text-brand-muted text-[11px] font-black tracking-widest uppercase flex items-center gap-1.5">
                    <Shield size={12} /> <span>סיסמה חדשה</span>
                  </label>
                  <input
                    type="password"
                    value={passwordData.new_password}
                    onChange={(e) => setPasswordData((prev) => ({ ...prev, new_password: e.target.value }))}
                    className="w-full bg-surface border border-surface-border rounded-2xl px-4 py-3 text-brand text-[13px] font-medium focus:border-accent-primary/50 outline-none transition-colors"
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex flex-col gap-1.5 text-right w-full">
                  <label className="text-brand-muted text-[11px] font-black tracking-widest uppercase flex items-center gap-1.5">
                    <UserCheck size={12} /> <span>אימות סיסמה חדשה</span>
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirm_password}
                    onChange={(e) => setPasswordData((prev) => ({ ...prev, confirm_password: e.target.value }))}
                    className="w-full bg-surface border border-surface-border rounded-2xl px-4 py-3 text-brand text-[13px] font-medium focus:border-accent-primary/50 outline-none transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Save Password Button */}
              <div className="mt-2">
                <Button
                  onClick={handleUpdatePassword}
                  disabled={updatingPassword || !passwordData.new_password}
                  className="w-full bg-surface text-brand border border-surface-border rounded-2xl font-black text-[13px] tracking-widest uppercase flex items-center justify-center active:scale-95 transition-transform h-12 shadow-sm disabled:opacity-50"
                >
                  {updatingPassword ? <Loader2 size={18} className="animate-spin text-brand-muted" /> : 'עדכן סיסמה'}
                </Button>
              </div>

            </div>
          </div>

        </div>
      </FadeIn>
    </div>
  );
};
