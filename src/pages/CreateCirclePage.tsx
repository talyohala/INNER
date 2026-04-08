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
  ChevronLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
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
      const tid = toast.loading('מעלה תמונת נושא...');

      // יצירת שם קובץ בטוח והעלאה ישירה (ללא דחיסה שנתקעת במובייל)
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const fileName = `circle_cover_${Date.now()}_${Math.random().toString(36).slice(2)}_${safeName}`;

      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(data.path);
      if (!publicUrl) throw new Error("Failed to get public URL");

      setCoverUrl(publicUrl);
      triggerFeedback('success');
      toast.success('התמונה הועלתה בהצלחה', { id: tid });
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
      const tid = toast.loading('מקים את המועדון במערכת...');

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      
      if (!userId) throw new Error("משתמש לא מחובר");

      // יצירת Slug ייחודי באנגלית או עברית (לינק)
      const slug = name.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w\u0590-\u05FF-]/g, '') + '-' + Math.random().toString(36).substring(2, 6);

      const circleData = {
        name: name.trim(),
        description: description.trim(),
        cover_url: coverUrl,
        is_private: isPaid,
        join_price: isPaid ? Number(price) : 0,
        min_level: Number(minLevel) || 1,
        slug: slug
      };

      // 1. יצירת המועדון ישירות לדאטה-בייס
      const { data: newCircle, error: circleError } = await supabase
        .from('circles')
        .insert(circleData)
        .select()
        .single();

      if (circleError) throw circleError;

      // 2. הוספת המשתמש כאדמין של המועדון
      await supabase.from('circle_members').insert({
        circle_id: newCircle.id,
        user_id: userId,
        role: 'admin'
      });

      triggerFeedback('success');
      toast.success('המועדון הוקם בהצלחה! 🥂', { id: tid });
      navigate(`/circle/${newCircle.slug}`);

    } catch (err: any) {
      triggerFeedback('error');
      toast.error(err?.message || 'שגיאה בהקמת המועדון, נסה שנית');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FadeIn className="px-4 pt-6 pb-32 bg-surface min-h-screen font-sans relative overflow-x-hidden" dir="rtl">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => { triggerFeedback('pop'); navigate(-1); }}
          className="w-10 h-10 flex justify-center items-center bg-surface-card border border-surface-border rounded-full shadow-sm active:scale-90 transition-all"
        >
          <ChevronLeft size={20} className="text-brand" />
        </button>
        <h1 className="text-2xl font-black text-brand tracking-widest uppercase">מועדון חדש</h1>
        <div className="w-10" />
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      <div className="relative z-10 flex flex-col gap-6">
        
        {/* Cover Image Upload */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-52 rounded-[32px] bg-surface-card border border-surface-border flex flex-col items-center justify-center relative overflow-hidden shadow-inner cursor-pointer active:scale-[0.98] transition-transform group"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={30} className="animate-spin text-accent-primary" />
              <span className="text-accent-primary text-[11px] font-black tracking-widest uppercase">מעבד תמונה...</span>
            </div>
          ) : coverUrl ? (
            <>
              <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white font-black text-[12px] uppercase tracking-widest bg-black/50 px-5 py-2.5 rounded-full border border-white/20 backdrop-blur-md">
                  החלף תמונה
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-surface border border-surface-border flex items-center justify-center mb-3 shadow-sm group-hover:border-accent-primary/50 transition-colors">
                <ImageIcon size={28} className="text-brand-muted group-hover:text-accent-primary transition-colors" />
              </div>
              <span className="text-brand text-[15px] font-black">בחר תמונת נושא</span>
              <span className="text-brand-muted text-[11px] font-bold mt-2 uppercase tracking-widest">יחס מומלץ 16:9</span>
            </>
          )}
        </div>

        {/* Info Form */}
        <div className="bg-surface-card border border-surface-border rounded-[32px] p-6 shadow-sm flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-2">שם המועדון</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: יזמי הייטק"
              className="bg-surface border border-surface-border rounded-[20px] h-[52px] px-5 text-brand font-bold placeholder:text-brand-muted/50 outline-none focus:border-accent-primary/50 transition-all shadow-inner"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-2">תיאור קצר</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="על מה הולכים לדבר במועדון? מה הווייב?"
              className="w-full bg-surface border border-surface-border rounded-[24px] p-5 text-brand font-medium transition-all h-28 resize-none shadow-inner text-[14px] placeholder:text-brand-muted/50 outline-none focus:border-accent-primary/50 leading-relaxed"
            />
          </div>

          {/* Access Type Slider */}
          <div className="flex flex-col gap-3 pt-4 border-t border-surface-border">
            <label className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-2">סוג גישה</label>
            <div className="flex bg-surface p-1 rounded-[20px] border border-surface-border relative shadow-inner">
              <button
                type="button"
                onClick={() => { triggerFeedback('pop'); setIsPaid(false); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-[13px] uppercase tracking-widest transition-colors z-10 ${!isPaid ? 'text-black' : 'text-brand-muted'}`}
              >
                <Unlock size={16} /> חופשי
              </button>
              <button
                type="button"
                onClick={() => { triggerFeedback('pop'); setIsPaid(true); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-[13px] uppercase tracking-widest transition-colors z-10 ${isPaid ? 'text-black' : 'text-brand-muted'}`}
              >
                <Lock size={16} /> סגור
              </button>
              <motion.div
                layout
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
                className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-[16px] shadow-md pointer-events-none"
                animate={{ right: !isPaid ? "4px" : "calc(50%)" }}
              />
            </div>

            {/* Paid Fields */}
            <AnimatePresence>
              {isPaid && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden flex flex-col gap-5 mt-2"
                >
                  <div className="relative group">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-accent-primary font-black text-[11px] tracking-widest">CRD</span>
                    <input
                      type="number"
                      value={price}
                      onChange={(e: any) => setPrice(e.target.value)}
                      placeholder="דמי כניסה..."
                      className="w-full bg-surface h-[52px] border border-surface-border text-brand shadow-inner focus:border-accent-primary/50 text-[15px] font-bold transition-all rounded-[20px] px-14 outline-none text-left"
                      dir="ltr"
                    />
                  </div>

                  <div className="relative group">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-accent-primary font-black text-[11px] tracking-widest flex items-center gap-1">
                      LEVEL <Shield size={12} />
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={minLevel}
                      onChange={(e: any) => setMinLevel(e.target.value)}
                      placeholder="רמת מינימום..."
                      className="w-full bg-surface h-[52px] border border-surface-border text-brand shadow-inner focus:border-accent-primary/50 text-[15px] font-bold transition-all rounded-[20px] px-24 outline-none text-left"
                      dir="ltr"
                    />
                    <p className="text-brand-muted/70 text-[10px] font-bold mt-2 px-2 text-right">
                      רק משתמשים שהגיעו לרמה זו יוכלו להצטרף למועדון.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border p-5 rounded-[28px] flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-surface border border-surface-border flex items-center justify-center shrink-0">
            <ShieldCheck size={22} className="text-accent-primary" />
          </div>
          <p className="text-brand-muted text-[12px] font-medium leading-relaxed">
            תוגדר אוטומטית כ<strong className="text-brand font-black mx-1">מנהל הראשי</strong>. תוכל להעלות תוכן, לנהל חברים ולהרוויח.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || uploading || !name.trim()}
          className="w-full h-16 mt-2 rounded-full bg-white text-black font-black text-[15px] uppercase tracking-widest shadow-[0_10px_30px_rgba(255,255,255,0.15)] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={24} className="animate-spin text-black" /> : 'הקם מועדון עכשיו'}
        </button>

      </div>
    </FadeIn>
  );
};
