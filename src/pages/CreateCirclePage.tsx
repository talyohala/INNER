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
import imageCompression from 'browser-image-compression';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
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

      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };

      const compressedFile = await imageCompression(file, options);

      const fileName = `circle_cover_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, compressedFile);

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(data.path);

      setCoverUrl(publicUrl);
      triggerFeedback('success');
      toast.success('התמונה מוכנה', { id: tid });
    } catch {
      triggerFeedback('error');
      toast.error('שגיאה בהעלאת התמונה');
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

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;

      const newCircle = await apiFetch<any>('/api/circles', {
        method: 'POST',
        headers: { 'x-user-id': userId || '' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          cover_url: coverUrl,
          is_private: isPaid,
          join_price: isPaid ? Number(price) : 0,
          min_level: Number(minLevel) || 1,
        }),
      });

      triggerFeedback('success');
      toast.success('המועדון הוקם בהצלחה');
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
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex justify-center">
        <div className="absolute top-[-8%] left-[-10%] w-[55%] h-[38%] bg-white/5 blur-[110px] rounded-full" />
      </div>

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
          className="w-full h-52 rounded-[34px] bg-surface-card border border-surface-border flex flex-col items-center justify-center relative shadow-[0_20px_50px_rgba(0,0,0,0.16)] overflow-hidden group cursor-pointer active:scale-[0.99] transition-all"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={30} className="animate-spin text-brand-muted" />
              <span className="text-brand-muted text-[10px] font-black tracking-widest uppercase">
                מעבד תמונה
              </span>
            </div>
          ) : coverUrl ? (
            <>
              <img src={coverUrl} className="w-full h-full object-cover" alt="Cover" />
              <div className="absolute inset-0 bg-black/35 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white font-black text-[11px] uppercase tracking-widest bg-white/10 px-4 py-2 rounded-full border border-white/20">
                  החלף תמונה
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-full bg-surface border border-surface-border flex items-center justify-center mb-3 shadow-inner">
                <ImageIcon size={24} className="text-brand-muted" />
              </div>
              <span className="text-brand text-[13px] font-black">בחר תמונת נושא למועדון</span>
              <span className="text-brand-muted text-[9px] font-bold mt-2 uppercase tracking-widest">
                יחס מומלץ 16:9
              </span>
            </>
          )}
        </div>

        <div className="bg-surface-card border border-surface-border rounded-[34px] p-6 flex flex-col gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.14)]">
          <div className="flex flex-col gap-2">
            <label className="text-brand-muted text-[11px] font-black uppercase px-1 tracking-widest">
              שם המועדון
            </label>
            <Input
              value={name}
              onChange={(e: any) => setName(e.target.value)}
              placeholder="לדוגמה: יזמי הייטק"
              className="bg-surface rounded-full border border-surface-border text-brand"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-brand-muted text-[11px] font-black uppercase px-1 tracking-widest">
              תיאור קצר
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="על מה הולכים לדבר במועדון ומה הווייב"
              className="w-full bg-surface border border-surface-border rounded-[28px] p-4 text-brand text-right font-medium transition-all h-28 resize-none shadow-inner text-[15px] placeholder:text-brand-muted outline-none leading-relaxed"
            />
          </div>

          <div className="flex flex-col gap-4 pt-4 border-t border-surface-border">
            <label className="text-brand-muted text-[11px] font-black uppercase px-1 tracking-widest">
              סוג גישה
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  triggerFeedback('pop');
                  setIsPaid(false);
                }}
                className={`flex items-center justify-center gap-2 h-14 rounded-full border transition-all ${
                  !isPaid
                    ? 'bg-accent-primary/10 border-accent-primary/20 text-accent-primary shadow-inner font-bold'
                    : 'bg-surface border-surface-border text-brand-muted font-medium'
                }`}
              >
                <Unlock size={16} />
                חופשי
              </button>

              <button
                onClick={() => {
                  triggerFeedback('pop');
                  setIsPaid(true);
                }}
                className={`flex items-center justify-center gap-2 h-14 rounded-full border transition-all ${
                  isPaid
                    ? 'bg-orange-500/10 border-orange-500/20 text-orange-500 shadow-inner font-bold'
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
                  className="mt-2 overflow-hidden flex flex-col gap-4"
                >
                  <div>
                    <label className="text-orange-500 text-[10px] font-bold px-1 mb-1 block text-right">
                      דמי כניסה (תשלום חד-פעמי)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500/60 font-black text-xs tracking-wider">
                        CRD
                      </span>
                      <input
                        type="number"
                        value={price}
                        onChange={(e: any) => setPrice(e.target.value)}
                        placeholder="סכום כניסה"
                        className="w-full bg-surface text-left font-black h-14 border border-orange-500/20 text-orange-500 shadow-inner focus:border-orange-500/40 text-[16px] transition-all rounded-full px-12 outline-none"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-purple-500 text-[10px] font-bold px-1 mb-1 flex items-center gap-1 text-right">
                      <Shield size={12} />
                      הסלקטור רמת מינימום לכניסה
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-500/60 font-black text-xs tracking-wider">
                        LEVEL
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={minLevel}
                        onChange={(e: any) => setMinLevel(e.target.value)}
                        placeholder="1"
                        className="w-full bg-surface text-left font-black h-14 border border-purple-500/20 text-purple-500 shadow-inner focus:border-purple-500/40 text-[16px] transition-all rounded-full px-12 outline-none"
                        dir="ltr"
                      />
                    </div>

                    <p className="text-brand-muted text-[10px] font-bold mt-2.5 text-right px-1 leading-relaxed">
                      משתמשים יצטרכו להגיע לרמה הזו באפליקציה כדי להיכנס למועדון
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border p-5 rounded-[30px] flex items-start gap-4 shadow-inner">
          <div className="w-11 h-11 rounded-full bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center shrink-0">
            <ShieldCheck size={18} className="text-accent-primary" />
          </div>

          <p className="text-brand-muted text-[11px] font-medium leading-relaxed">
            עם הקמת המועדון תוגדר אוטומטית כמנהל הראשי
            <strong className="text-brand font-black"> </strong>
            תוכל לנהל את השיח להעלות פוסטים ולקבל קרדיטים ישירות מהחברים
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || uploading || !name.trim()}
          className="w-full h-14 mt-1 rounded-full bg-accent-primary text-white shadow-[0_0_24px_rgba(161,180,254,0.22)]"
        >
          {saving ? <Loader2 size={24} className="animate-spin" /> : 'הקם מועדון עכשיו'}
        </Button>
      </div>
    </FadeIn>
  );
};
