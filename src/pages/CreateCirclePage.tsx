import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Loader2,
  Image as ImageIcon,
  ShieldCheck,
  Lock,
  Unlock,
  Shield,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FadeIn, Input, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

export const CreateCirclePage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState<number | ''>(50);
  const [minLevel, setMinLevel] = useState<number | ''>(1);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      triggerFeedback('pop');
      const tid = toast.loading('מעבד תמונת נושא...');

      // תיקון: העלאה ישירה ללא דחיסה (שנתקעת במובייל)
      // יצירת שם קובץ בטוח
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const fileName = `circle_cover_${Date.now()}_${Math.floor(Math.random() * 1000)}_${safeName}`;

      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(data.path);

      setCoverUrl(publicUrl);
      triggerFeedback('success');
      toast.success('התמונה מוכנה', { id: tid });
    } catch (err: any) {
      triggerFeedback('error');
      toast.error(err.message || 'שגיאה בהעלאת התמונה');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      triggerFeedback('error');
      return toast.error('חובה לתת שם למועדון שלך');
    }

    if (isPaid && (price === '' || Number(price) <= 0)) {
      triggerFeedback('error');
      return toast.error('אנא הזן דמי כניסה תקינים ב-CRD');
    }

    try {
      setSaving(true);
      triggerFeedback('pop');
      const tid = toast.loading('מקים מועדון...');

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) throw new Error("משתמש לא מחובר");

      // יצירת Slug בסיסי מהשם
      const slug = name.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]/g, '') + '-' + Math.random().toString(36).substring(2, 6);

      // תיקון: שמירה ישירה ל-Supabase (בלי API מתווך)
      const { data: newCircle, error: circleError } = await supabase
        .from('circles')
        .insert({
          name: name.trim(),
          description: description.trim(),
          cover_url: coverUrl,
          is_private: isPaid,
          join_price: isPaid ? Number(price) : 0,
          min_level: Number(minLevel) || 1,
          slug: slug
        })
        .select()
        .single();

      if (circleError) throw circleError;

      // הוספת המשתמש כאדמין של המועדון
      await supabase.from('circle_members').insert({
        circle_id: newCircle.id,
        user_id: userId,
        role: 'admin'
      });

      triggerFeedback('success');
      toast.success('המועדון הוקם בהצלחה!', { id: tid });
      navigate(`/circle/${newCircle.slug}`);
    } catch (err: any) {
      triggerFeedback('error');
      toast.error(err?.message || 'שגיאה בהקמת המועדון');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FadeIn
      className="px-4 pt-5 pb-32 bg-surface min-h-screen font-sans relative overflow-x-hidden"
      dir="rtl"
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      <div className="relative z-10 flex flex-col gap-5">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-52 rounded-[32px] bg-surface-card border border-surface-border flex flex-col items-center justify-center relative overflow-hidden shadow-[0_10px_35px_rgba(0,0,0,0.18)] cursor-pointer active:scale-[0.99] transition-transform"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={30} className="animate-spin text-brand-muted" />
              <span className="text-brand-muted text-[10px] font-black tracking-widest uppercase">
                מעבד תמונה...
              </span>
            </div>
          ) : coverUrl ? (
            <>
              <img
                src={coverUrl}
                alt="Cover"
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <span className="text-white font-black text-[11px] uppercase tracking-widest bg-black/30 px-4 py-2 rounded-full border border-white/15 backdrop-blur-sm">
                  החלף תמונה
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-surface border border-surface-border flex items-center justify-center mb-3 shadow-inner">
                <ImageIcon size={24} className="text-brand-muted" />
              </div>
              <span className="text-brand text-[14px] font-black">בחר תמונת נושא למועדון</span>
              <span className="text-brand-muted text-[10px] font-bold mt-2 uppercase tracking-widest">
                יחס מומלץ 16:9
              </span>
            </>
          )}
        </div>

        <div className="bg-surface-card border border-surface-border rounded-[32px] p-5 shadow-[0_10px_35px_rgba(0,0,0,0.14)] flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-1">
              שם המועדון
            </label>
            <Input
              value={name}
              onChange={(e: any) => setName(e.target.value)}
              placeholder="לדוגמה: יזמי הייטק"
              className="bg-surface border border-surface-border rounded-full text-brand"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-1">
              תיאור קצר
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="על מה הולכים לדבר במועדון? מה הווייב?"
              className="w-full bg-surface border border-surface-border rounded-[24px] p-4 text-brand text-right font-medium transition-all h-28 resize-none shadow-inner text-[15px] placeholder:text-brand-muted outline-none leading-relaxed"
            />
          </div>

          <div className="flex flex-col gap-4 pt-2 border-t border-surface-border">
            <label className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-1">
              סוג גישה
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  triggerFeedback('pop');
                  setIsPaid(false);
                }}
                className={`flex items-center justify-center gap-2 h-14 rounded-full border transition-all ${
                  !isPaid
                    ? 'bg-accent-primary/10 border-accent-primary/25 text-accent-primary shadow-inner font-bold'
                    : 'bg-surface border-surface-border text-brand-muted font-medium'
                }`}
              >
                <Unlock size={16} />
                חופשי
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerFeedback('pop');
                  setIsPaid(true);
                }}
                className={`flex items-center justify-center gap-2 h-14 rounded-full border transition-all ${
                  isPaid
                    ? 'bg-accent-primary/10 border-accent-primary/25 text-accent-primary shadow-inner font-bold'
                    : 'bg-surface border-surface-border text-brand-muted font-medium'
                }`}
              >
                <Lock size={16} />
                סגור / בתשלום
              </button>
            </div>

            <AnimatePresence>
              {isPaid && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden flex flex-col gap-4"
                >
                  <div>
                    <label className="text-brand-muted text-[10px] font-bold px-1 mb-1 block text-right">
                      דמי כניסה
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-primary/70 font-black text-xs tracking-widest">
                        CRD
                      </span>
                      <input
                        type="number"
                        value={price}
                        onChange={(e: any) => setPrice(e.target.value)}
                        placeholder="סכום כניסה..."
                        className="w-full bg-surface text-left font-black h-14 border border-accent-primary/20 text-brand shadow-inner focus:border-accent-primary/45 text-[16px] transition-all rounded-full px-12 outline-none"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-brand-muted text-[10px] font-bold px-1 mb-1 flex items-center gap-1 text-right">
                      <Shield size={13} className="text-accent-primary/80" />
                      הסלקטור: רמת מינימום לכניסה
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-primary/70 font-black text-xs tracking-widest">
                        LEVEL
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={minLevel}
                        onChange={(e: any) => setMinLevel(e.target.value)}
                        placeholder="1"
                        className="w-full bg-surface text-left font-black h-14 border border-accent-primary/20 text-brand shadow-inner focus:border-accent-primary/45 text-[16px] transition-all rounded-full px-14 outline-none tracking-widest"
                        dir="ltr"
                      />
                    </div>
                    <p className="text-brand-muted text-[10px] font-bold mt-2.5 text-right px-1 leading-relaxed">
                      משתמשים יצטרכו להגיע לרמה זו באפליקציה כדי לקבל אישור להיכנס למועדון.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border p-5 rounded-[28px] flex items-start gap-4 shadow-inner">
          <div className="w-10 h-10 rounded-full bg-accent-primary/10 border border-accent-primary/15 flex items-center justify-center shrink-0">
            <ShieldCheck size={18} className="text-accent-primary" />
          </div>
          <p className="text-brand-muted text-[12px] font-medium leading-relaxed">
            עם הקמת המועדון, תוגדר אוטומטית כ
            <strong className="text-brand font-black">מנהל הראשי</strong>.
            תוכל לנהל את השיח, להעלות פוסטים ולקבל קרדיטים ישירות מהחברים.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || uploading || !name.trim()}
          className="w-full h-14 mt-1 rounded-full bg-white text-black font-black shadow-[0_10px_25px_rgba(255,255,255,0.12)] active:scale-[0.98]"
        >
          {saving ? <Loader2 size={22} className="animate-spin" /> : 'הקם מועדון עכשיו'}
        </Button>
      </div>
    </FadeIn>
  );
};
