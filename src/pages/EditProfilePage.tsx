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
  Sparkles,
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
        toast.error(`שגיאה בטעינת הנתונים: ${err.message}`, {
          style: { background: '#111', color: '#ef4444' },
        });
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

    const tid = toast.loading(`מעדכן תמונת ${type === 'avatar' ? 'פרופיל' : 'נושא'}...`, {
      style: { background: '#111', color: '#fff' },
    });

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

      toast.success(`תמונת ה${type === 'avatar' ? 'פרופיל' : 'נושא'} עודכנה בהצלחה!`, {
        id: tid,
        style: { background: '#111', color: '#e5e4e2', border: '1px solid rgba(229,228,226,0.2)' },
      });
    } catch (err: any) {
      toast.error(`שגיאה בהעלאה: ${err.message}`, {
        id: tid,
        style: { background: '#111', color: '#ef4444' },
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!user?.id || savingDetails) return;

    setSavingDetails(true);
    triggerFeedback('pop');

    const tid = toast.loading('שומר שינויים...', {
      style: { background: '#111', color: '#fff' },
    });

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

      toast.success('הפרטים עודכנו בהצלחה!', {
        id: tid,
        style: { background: '#111', color: '#e5e4e2', border: '1px solid rgba(229,228,226,0.2)' },
      });
    } catch (err: any) {
      toast.error(`שגיאה: ${err.message || 'נכשל בעדכון'}`, {
        id: tid,
        style: { background: '#111', color: '#ef4444' },
      });
    } finally {
      setSavingDetails(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!user?.id || updatingPassword) return;

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('הסיסמאות החדשות לא תואמות', {
        style: { background: '#111', color: '#ef4444' },
      });
      return;
    }

    if (passwordData.new_password.length < 6) {
      toast.error('הסיסמה החדשה חייבת להיות לפחות 6 תווים', {
        style: { background: '#111', color: '#ef4444' },
      });
      return;
    }

    setUpdatingPassword(true);
    triggerFeedback('pop');

    const tid = toast.loading('מעדכן סיסמה...', {
      style: { background: '#111', color: '#fff' },
    });

    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.new_password });
      if (error) throw error;

      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });

      toast.success('הסיסמה עודכנה בהצלחה!', {
        id: tid,
        style: { background: '#111', color: '#e5e4e2', border: '1px solid rgba(229,228,226,0.2)' },
      });
    } catch (err: any) {
      toast.error(`שגיאה: ${err.message}`, {
        id: tid,
        style: { background: '#111', color: '#ef4444' },
      });
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (authLoading || loadingData) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center">
        <Loader2 className="animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <div className="bg-[#0C0C0C] min-h-screen relative font-sans" dir="rtl">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex justify-center">
        <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[40%] bg-white/10 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-20%] w-[60%] h-[40%] bg-white/5 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <div className="fixed top-6 left-4 right-4 flex justify-between items-center z-[99999] pointer-events-none">
        <button
          onClick={() => {
            triggerFeedback('pop');
            navigate(-1);
          }}
          className="pointer-events-auto w-10 h-10 flex justify-center items-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-full shadow-lg active:scale-90 transition-all hover:bg-black/60"
        >
          <ChevronLeft size={20} className="text-white" />
        </button>

        <div className="bg-black/40 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
          <span className="text-white/60 font-black text-[13px] tracking-wide">עריכת פרופיל</span>
          <Edit2 size={16} className="text-[#e5e4e2]" />
        </div>
      </div>

      <div className="fixed top-0 left-0 w-full h-[220px] bg-[#111] z-0 rounded-b-[40px] overflow-hidden shadow-2xl origin-top border-b border-white/5 group">
        {data.profile?.cover_url ? (
          <img src={data.profile.cover_url} className="w-full h-full object-cover opacity-80" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#2196f3]/10 to-transparent" />
        )}
      </div>

      <div className="fixed top-[160px] right-6 z-[99999]">
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
        <button
          onClick={(e) => {
            e.preventDefault();
            coverInputRef.current?.click();
          }}
          disabled={uploadingCover}
          className="w-11 h-11 bg-black/80 backdrop-blur-2xl text-[#e5e4e2] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.8)] border border-white/20 active:scale-90 transition-all hover:bg-black disabled:opacity-50 pointer-events-auto"
        >
          {uploadingCover ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
        </button>
      </div>

      <FadeIn className="relative z-10 pt-[170px] pb-32 pointer-events-auto">
        <div className="bg-[#0C0C0C]/90 backdrop-blur-3xl rounded-t-[40px] px-4 min-h-screen flex flex-col items-center pt-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/5 relative z-10">
          <motion.div whileHover={{ scale: 1.05 }} className="w-[110px] h-[110px] rounded-full bg-[#0C0C0C] shadow-[0_10px_30px_rgba(0,0,0,0.8)] p-1.5 relative -mt-[55px] z-20 group">
            <div className="w-full h-full rounded-full overflow-hidden bg-[#1a1a1a] border border-white/5 relative">
              {data.profile?.avatar_url ? (
                <img src={data.profile.avatar_url} className="w-full h-full object-cover" alt="" />
              ) : (
                <UserCircle size={50} className="text-white/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              )}
            </div>

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

            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute bottom-1 left-1 w-9 h-9 bg-[#e5e4e2] text-black rounded-full flex items-center justify-center shadow-lg border-4 border-[#0C0C0C] active:scale-90 transition-all z-20 hover:bg-white disabled:opacity-50"
            >
              {uploadingAvatar ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} className="ml-0.5" />}
            </button>
          </motion.div>

          <div className="w-full mt-8 mb-5 px-4">
            <div className="bg-white/[0.03] border border-white/10 rounded-[24px] p-4 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="text-right">
                  <div className="text-white font-black text-[15px]">מצב פרופיל</div>
                  <div className="text-white/30 text-[10px] font-bold tracking-widest uppercase">PROFILE STATUS</div>
                </div>
                <div className="flex items-center gap-2 text-[#e5e4e2]">
                  <CheckCircle2 size={18} />
                  <span className="text-sm font-black">{profileCompleteness}%</span>
                </div>
              </div>

              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden shadow-inner">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${profileCompleteness}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-l from-[#2196f3] via-[#8b5cf6] to-[#e5e4e2]"
                />
              </div>

              <div className="mt-3 text-white/45 text-[11px] leading-5 text-right">
                תמונת פרופיל תמונת נושא ביו מיקום ועיסוק יעזרו לפרופיל שלך להיראות מלא ומדויק יותר.
              </div>
            </div>
          </div>

          <div className="px-4 flex flex-col gap-5 w-full mb-2">
            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 flex flex-col gap-5 rounded-[24px] p-6 shadow-2xl">
              <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-1">
                <div className="flex flex-col text-right">
                  <span className="text-white font-black text-[15px] tracking-wide">פרטים אישיים</span>
                  <span className="text-white/30 text-[10px] uppercase font-bold tracking-widest">PERSONAL DETAILS</span>
                </div>
                <Users size={18} className="text-[#e5e4e2]" />
              </div>

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col gap-1.5 text-right w-full">
                    <label className="text-white/40 text-[11px] font-bold tracking-widest uppercase flex items-center justify-start gap-1.5">
                      <span>שם מלא</span>
                      <UserCheck size={12} />
                    </label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, full_name: e.target.value }))}
                      className="bg-transparent border border-white/5 rounded-xl px-4 py-3 text-white text-[14px] font-medium placeholder:text-white/10 focus:border-[#e5e4e2]/50 transition-colors"
                      placeholder="ישראל ישראלי"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 text-right w-full">
                    <label className="text-white/40 text-[11px] font-bold tracking-widest uppercase flex items-center justify-start gap-1.5">
                      <span>שם משתמש (@)</span>
                      <Edit2 size={12} />
                    </label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                      className="bg-transparent border border-white/5 rounded-xl px-4 py-3 text-white text-[14px] font-medium placeholder:text-white/10 focus:border-[#e5e4e2]/50 transition-colors"
                      placeholder="user123"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 text-right w-full">
                    <label className="text-white/40 text-[11px] font-bold tracking-widest uppercase flex items-center justify-start gap-1.5">
                      <span>ביו</span>
                      <MessageSquare size={12} />
                    </label>
                    <textarea
                      value={formData.bio}
                      onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
                      className="bg-transparent border border-white/5 rounded-xl px-4 py-3 text-white text-[14px] font-medium placeholder:text-white/10 focus:border-[#e5e4e2]/50 transition-colors h-24 resize-none"
                      placeholder="ספר קצת על עצמך..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 text-right w-full">
                      <label className="text-white/40 text-[11px] font-bold tracking-widest uppercase flex items-center justify-start gap-1.5">
                        <span>קישור חברתי</span>
                        <LinkIcon size={12} />
                      </label>
                      <input
                        type="text"
                        value={formData.social_link}
                        onChange={(e) => setFormData((prev) => ({ ...prev, social_link: e.target.value }))}
                        className="bg-transparent border border-white/5 rounded-xl px-4 py-3 text-white text-[14px] font-medium placeholder:text-white/10 focus:border-[#e5e4e2]/50 transition-colors"
                        placeholder="instagram.com/user"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 text-right w-full">
                      <label className="text-white/40 text-[11px] font-bold tracking-widest uppercase flex items-center justify-start gap-1.5">
                        <span>מזל</span>
                        <Crown size={12} />
                      </label>
                      <input
                        type="text"
                        value={formData.zodiac}
                        onChange={(e) => setFormData((prev) => ({ ...prev, zodiac: e.target.value }))}
                        className="bg-transparent border border-white/5 rounded-xl px-4 py-3 text-white text-[14px] font-medium placeholder:text-white/10 focus:border-[#e5e4e2]/50 transition-colors"
                        placeholder="אריה"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 text-right w-full">
                      <label className="text-white/40 text-[11px] font-bold tracking-widest uppercase flex items-center justify-start gap-1.5">
                        <span>מתגורר ב</span>
                        <MapPin size={12} />
                      </label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                        className="bg-transparent border border-white/5 rounded-xl px-4 py-3 text-white text-[14px] font-medium placeholder:text-white/10 focus:border-[#e5e4e2]/50 transition-colors"
                        placeholder="תל אביב"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 text-right w-full">
                      <label className="text-white/40 text-[11px] font-bold tracking-widest uppercase flex items-center justify-start gap-1.5">
                        <span>תאריך לידה</span>
                        <Calendar size={12} />
                      </label>
                      <input
                        type="date"
                        value={formData.birth_date}
                        onChange={(e) => setFormData((prev) => ({ ...prev, birth_date: e.target.value }))}
                        className="bg-transparent border border-white/5 rounded-xl px-4 py-3 text-white text-[13px] font-medium placeholder:text-white/10 focus:border-[#e5e4e2]/50 transition-colors text-right"
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 text-right w-full">
                      <label className="text-white/40 text-[11px] font-bold tracking-widest uppercase flex items-center justify-start gap-1.5">
                        <span>מצב משפחתי</span>
                        <HeartHandshake size={12} />
                      </label>
                      <input
                        type="text"
                        value={formData.relationship_status}
                        onChange={(e) => setFormData((prev) => ({ ...prev, relationship_status: e.target.value }))}
                        className="bg-transparent border border-white/5 rounded-xl px-4 py-3 text-white text-[14px] font-medium placeholder:text-white/10 focus:border-[#e5e4e2]/50 transition-colors"
                        placeholder="במערכת יחסים"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 text-right w-full">
                      <label className="text-white/40 text-[11px] font-bold tracking-widest uppercase flex items-center justify-start gap-1.5">
                        <span>עיסוק</span>
                        <Briefcase size={12} />
                      </label>
                      <input
                        type="text"
                        value={formData.job_title}
                        onChange={(e) => setFormData((prev) => ({ ...prev, job_title: e.target.value }))}
                        className="bg-transparent border border-white/5 rounded-xl px-4 py-3 text-white text-[14px] font-medium placeholder:text-white/10 focus:border-[#e5e4e2]/50 transition-colors"
                        placeholder="מעצב מוצר"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 text-right w-full">
                    <label className="text-white/40 text-[11px] font-bold tracking-widest uppercase flex items-center justify-start gap-1.5">
                      <span>השכלה / קריירה</span>
                      <GraduationCap size={12} />
                    </label>
                    <input
                      type="text"
                      value={formData.education}
                      onChange={(e) => setFormData((prev) => ({ ...prev, education: e.target.value }))}
                      className="bg-transparent border border-white/5 rounded-xl px-4 py-3 text-white text-[14px] font-medium placeholder:text-white/10 focus:border-[#e5e4e2]/50 transition-colors"
                      placeholder="סטודנט למדעי המחשב"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mt-2 bg-white/[0.03] border border-white/8 rounded-[18px] px-4 py-3">
                <div className="text-right">
                  <div className="text-white text-[13px] font-black">תצוגת אודות בפרופיל</div>
                  <div className="text-white/35 text-[11px]">
                    הפרטים האלה יוצגו בתוך אזור אודות שנפתח עם חץ קטן בפרופיל.
                  </div>
                </div>
                <Sparkles size={16} className="text-[#e5e4e2]" />
              </div>

              <div className="flex justify-end mt-2">
                <Button
                  onClick={handleSaveDetails}
                  disabled={savingDetails}
                  className="bg-[#e5e4e2] text-black rounded-xl font-black text-[13px] tracking-wide flex items-center justify-center active:scale-95 transition-transform px-8 h-11"
                >
                  {savingDetails ? <Loader2 size={16} className="animate-spin" /> : 'שמור שינויים'}
                </Button>
              </div>
            </div>

            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 flex flex-col gap-5 rounded-[24px] p-6 shadow-2xl">
              <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-1">
                <div className="flex flex-col text-right">
                  <span className="text-white font-black text-[15px] tracking-wide">אבטחה וסיסמה</span>
                  <span className="text-white/30 text-[10px] uppercase font-bold tracking-widest">SECURITY</span>
                </div>
                <Key size={18} className="text-[#e5e4e2]" />
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 text-right w-full">
                  <label className="text-white/40 text-[11px] font-bold tracking-widest uppercase flex items-center justify-start gap-1.5">
                    <span>סיסמה נוכחית</span>
                    <Shield size={12} />
                  </label>
                  <input
                    type="password"
                    value={passwordData.current_password}
                    onChange={(e) => setPasswordData((prev) => ({ ...prev, current_password: e.target.value }))}
                    className="bg-transparent border border-white/5 rounded-xl px-4 py-3 text-white text-[14px] font-medium placeholder:text-white/10 focus:border-[#e5e4e2]/50 transition-colors"
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex flex-col gap-1.5 text-right w-full">
                  <label className="text-white/40 text-[11px] font-bold tracking-widest uppercase flex items-center justify-start gap-1.5">
                    <span>סיסמה חדשה</span>
                    <Shield size={12} />
                  </label>
                  <input
                    type="password"
                    value={passwordData.new_password}
                    onChange={(e) => setPasswordData((prev) => ({ ...prev, new_password: e.target.value }))}
                    className="bg-transparent border border-white/5 rounded-xl px-4 py-3 text-white text-[14px] font-medium placeholder:text-white/10 focus:border-[#e5e4e2]/50 transition-colors"
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex flex-col gap-1.5 text-right w-full">
                  <label className="text-white/40 text-[11px] font-bold tracking-widest uppercase flex items-center justify-start gap-1.5">
                    <span>אימות סיסמה חדשה</span>
                    <UserCheck size={12} />
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirm_password}
                    onChange={(e) => setPasswordData((prev) => ({ ...prev, confirm_password: e.target.value }))}
                    className="bg-transparent border border-white/5 rounded-xl px-4 py-3 text-white text-[14px] font-medium placeholder:text-white/10 focus:border-[#e5e4e2]/50 transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <Button
                  onClick={handleUpdatePassword}
                  disabled={updatingPassword}
                  className="bg-[#e5e4e2] text-black rounded-xl font-black text-[13px] tracking-wide flex items-center justify-center active:scale-95 transition-transform px-8 h-11"
                >
                  {updatingPassword ? <Loader2 size={16} className="animate-spin" /> : 'עדכן סיסמה'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  );
};
