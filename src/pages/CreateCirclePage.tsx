import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2, Image as ImageIcon, ArrowRight, Sparkles, ShieldCheck, Users, Crown, Lock, Unlock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { GlassCard, FadeIn, Input, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

export const CreateCirclePage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState<number | ''>(50);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // העלאת תמונת קאבר לסופבייס
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      triggerFeedback('pop');
      const tid = toast.loading('מעלה תמונת נושא...', { style: { background: '#111', color: '#fff' } });
      const fileName = `circle_cover_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      const { error } = await supabase.storage.from('avatars').upload(fileName, file);
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setCoverUrl(publicUrl);
      
      triggerFeedback('success');
      toast.success('התמונה מוכנה!', { id: tid });
    } catch (err) {
      triggerFeedback('error');
      toast.error('שגיאה בהעלאת התמונה', { style: { background: '#111', color: '#ef4444' } });
    } finally {
      setUploading(false);
    }
  };

  // שמירת הקהילה ב-Database
  const handleSave = async () => {
    if (!name.trim()) {
      triggerFeedback('error');
      return toast.error('חייב לתת שם למועדון שלך', { style: { background: '#111', color: '#ef4444' } });
    }

    if (isPaid && (price === '' || price <= 0)) {
      triggerFeedback('error');
      return toast.error('אנא הזן מחיר כניסה תקין ב-CRD', { style: { background: '#111', color: '#ef4444' } });
    }

    try {
      setSaving(true);
      triggerFeedback('pop');
      
      const newCircle = await apiFetch<any>('/api/circles', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          cover_url: coverUrl,
          is_private: isPaid,
          join_price: isPaid ? Number(price) : 0
        })
      });
      
      triggerFeedback('success');
      toast.success('המועדון הוקם בהצלחה! 👑', { style: { background: '#111', color: '#4ade80' } });
      navigate(`/circle/${newCircle.slug}`);
    } catch (err: any) {
      triggerFeedback('error');
      toast.error(err.message || 'שגיאה ביצירת הקהילה', { style: { background: '#111', color: '#ef4444' } });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FadeIn className="px-5 pt-8 pb-32 flex flex-col gap-6 bg-[#030303] min-h-screen font-sans" dir="rtl">
      
      {/* הדר מיושר לאמצע + כפתור חזור */}
      <div className="flex flex-col items-center justify-center relative z-10 mb-2 mt-2">
        <div className="absolute right-0 top-1/2 -translate-y-1/2">
          <button onClick={() => { triggerFeedback('pop'); navigate(-1); }} className="w-10 h-10 flex items-center justify-center text-white/30 hover:text-white transition-colors bg-white/5 rounded-full shadow-inner active:scale-90">
            <ArrowRight size={18} />
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center mt-1">
            <div className="absolute w-10 h-10 bg-green-500/10 rounded-full animate-pulse blur-sm"></div>
            <Crown size={20} className="text-white relative z-10" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            הקמת מועדון
          </h1>
        </div>
        <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">מרחב סודי ואקסקלוסיבי</span>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* אזור העלאת תמונת נושא (Cover) */}
      <div className="flex flex-col gap-2 mt-2">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-48 rounded-[32px] bg-[#0A0A0A] border-2 border-dashed border-white/10 flex flex-col items-center justify-center relative shadow-2xl overflow-hidden group cursor-pointer active:scale-95 transition-all hover:border-white/20 hover:bg-[#0f0f0f]"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} className="animate-spin text-white/40" />
              <span className="text-white/30 text-[10px] font-black tracking-widest uppercase">מעבד תמונה...</span>
            </div>
          ) : coverUrl ? (
            <>
              <img src={coverUrl} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" alt="Cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-md">
                <span className="text-white font-black text-xs uppercase tracking-widest flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/10">
                  <ImageIcon size={16} /> החלף קאבר
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-[#050505] border border-white/5 flex items-center justify-center mb-3 shadow-inner group-hover:bg-white/5 transition-colors">
                <ImageIcon size={28} className="text-white/20" />
              </div>
              <span className="text-white/60 text-xs font-black tracking-wide">בחר תמונת נושא למועדון</span>
              <span className="text-white/20 text-[9px] font-bold mt-1.5 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/5">יחס מומלץ 16:9</span>
            </>
          )}
        </div>
      </div>

      {/* טופס יצירה - Glass Card יוקרתי */}
      <GlassCard className="bg-[#0A0A0A] border border-white/5 p-6 rounded-[32px] flex flex-col gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
        
        <div className="text-right flex flex-col gap-2">
          <label className="text-white/40 text-[10px] font-black uppercase px-1 tracking-widest flex items-center gap-1.5">
            <Users size={12} className="text-white/30" /> שם המועדון החדש
          </label>
          <Input
            value={name}
            onChange={(e: any) => setName(e.target.value)}
            placeholder="לדוגמה: יזמי הייטק "
            className="bg-[#050505] text-right font-black h-14 border border-white/10 text-white shadow-inner focus:border-white/30 text-sm placeholder:text-white/20 transition-all rounded-2xl px-4"
          />
        </div>

        <div className="text-right flex flex-col gap-2">
          <label className="text-white/40 text-[10px] font-black uppercase px-1 tracking-widest flex items-center gap-1.5">
            <Sparkles size={12} className="text-white/30" /> תיאור קצר
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="על מה הולכים לדבר כאן? מה הווייב?"
            className="w-full bg-[#050505] border border-white/10 rounded-2xl p-4 text-white text-right font-medium focus:border-white/30 transition-all h-28 resize-none shadow-inner text-sm placeholder:text-white/20 outline-none"
          />
        </div>

        {/* --- הגדרות תשלום מתווספות לכאן --- */}
        <div className="text-right flex flex-col gap-3 pt-2 border-t border-white/5 mt-2">
          <label className="text-white/40 text-[10px] font-black uppercase px-1 tracking-widest flex items-center gap-1.5">
            <Lock size={12} className="text-white/30" /> סוג כניסה למעגל
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setIsPaid(false)}
              className={`flex items-center justify-center gap-2 h-14 rounded-2xl border transition-all ${!isPaid ? 'bg-white/10 border-white/30 text-white shadow-inner' : 'bg-black/40 border-white/5 text-white/40 hover:bg-white/5'}`}
            >
              <Unlock size={16} /> כניסה חופשית
            </button>
            <button
              onClick={() => setIsPaid(true)}
              className={`flex items-center justify-center gap-2 h-14 rounded-2xl border transition-all ${isPaid ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'bg-black/40 border-white/5 text-white/40 hover:bg-white/5'}`}
            >
              <Lock size={16} /> בתשלום (CRD)
            </button>
          </div>

          {isPaid && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 overflow-hidden">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-400/50 font-black text-xs">CRD</span>
                <input
                  type="number"
                  value={price}
                  onChange={(e: any) => setPrice(e.target.value)}
                  placeholder="סכום כניסה..."
                  className="w-full bg-[#050505] text-left font-black h-14 border border-yellow-500/20 text-yellow-400 shadow-inner focus:border-yellow-500/50 text-lg transition-all rounded-2xl px-12 outline-none"
                  dir="ltr"
                />
              </div>
              <p className="text-white/30 text-[10px] font-bold mt-2 text-right">המשתמשים ישלמו סכום זה פעם אחת בעת הכניסה.</p>
            </motion.div>
          )}
        </div>
        {/* ----------------------------------- */}

        <div className="flex items-start gap-3 bg-white/[0.02] border border-white/5 p-4 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-green-500/50"></div>
          <ShieldCheck size={20} className="text-green-400 shrink-0 mt-0.5" />
          <p className="text-white/50 text-[10px] font-bold leading-relaxed text-right">
            עם פתיחת המועדון, תוגדר אוטומטית כ<strong className="text-white font-black">יוצר ומנהל</strong>. תוכל להזמין חברים, לנהל את השיח ולקבל טיפים (CRD) ישירות לארנק שלך.
          </p>
        </div>

      </GlassCard>

      {/* כפתור יצירה ראשי */}
      <div className="mt-2">
        <Button
          onClick={handleSave}
          disabled={saving || uploading || !name.trim()}
          className="w-full h-16 rounded-2xl bg-white text-black font-black text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 hover:bg-white/90"
        >
          {saving ? <Loader2 size={24} className="animate-spin" /> : <>צור מועדון חדש</>}
        </Button>
      </div>

    </FadeIn>
  );
};
