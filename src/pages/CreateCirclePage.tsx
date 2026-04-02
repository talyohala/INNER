import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2, Image as ImageIcon, Sparkles, ShieldCheck, Users, Lock, Unlock, Shield } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { FadeIn, Input, Button, GlassCard } from '../components/ui';
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
      
      const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);
      
      const fileName = `club_cover_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const { data, error } = await supabase.storage.from('avatars').upload(fileName, compressedFile);
      
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(data.path);
      setCoverUrl(publicUrl);
      
      triggerFeedback('success');
      toast.success('התמונה מוכנה!', { id: tid });
    } catch (err) {
      triggerFeedback('error');
      toast.error('שגיאה בהעלאת התמונה');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      triggerFeedback('error');
      return toast.error('חובה לתת שם למועדון שלך');
    }
    
    if (isPaid && (price === '' || price <= 0)) {
      triggerFeedback('error');
      return toast.error('אנא הזן דמי כניסה תקינים ב-CRD');
    }

    try {
      setSaving(true);
      triggerFeedback('pop');
      
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      
      const newClub = await apiFetch<any>('/api/circles', {
        method: 'POST',
        headers: { 'x-user-id': userId || '' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          cover_url: coverUrl,
          is_private: isPaid,
          join_price: isPaid ? Number(price) : 0,
          min_level: Number(minLevel) || 1
        })
      });
      
      triggerFeedback('success');
      toast.success('המועדון הוקם בהצלחה!');
      navigate(`/circle/${newClub.slug}`);
    } catch (err: any) {
      triggerFeedback('error');
      toast.error(err.message || 'שגיאה בהקמת המועדון');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FadeIn className="px-4 pt-12 pb-32 bg-[#0A0A0A] min-h-screen font-sans relative overflow-x-hidden" dir="rtl">
      <div className="flex flex-col items-center justify-center mb-10 relative z-10 px-1">
          <h1 className="text-3xl font-black text-white tracking-tighter drop-shadow-lg">הקמת מועדון</h1>
      </div>

      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />

      <div className="flex flex-col gap-6 relative z-10">
        <div onClick={() => fileInputRef.current?.click()} className="w-full h-48 rounded-3xl bg-white/[0.02] border-2 border-dashed border-white/10 flex flex-col items-center justify-center relative shadow-2xl overflow-hidden group cursor-pointer active:scale-95 transition-all">
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} className="animate-spin text-white/20" />
              <span className="text-white/30 text-[10px] font-black tracking-widest uppercase">מעבד תמונה...</span>
            </div>
          ) : coverUrl ? (
            <>
              <img src={coverUrl} className="w-full h-full object-cover opacity-80" alt="Cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white font-black text-[11px] uppercase tracking-widest bg-white/10 px-4 py-2 rounded-full border border-white/20">החלף תמונה</span>
              </div>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-3 shadow-inner"><ImageIcon size={24} className="text-white/20" /></div>
              <span className="text-white/60 text-[13px] font-black">בחר תמונת נושא למועדון</span>
              <span className="text-white/20 text-[9px] font-bold mt-2 uppercase tracking-widest">יחס מומלץ 16:9</span>
            </>
          )}
        </div>

        <GlassCard className="p-6 flex flex-col gap-6 rounded-[32px]">
          <div className="flex flex-col gap-2">
            <label className="text-white/40 text-[11px] font-black uppercase px-1 tracking-widest flex items-center gap-1.5">שם המועדון</label>
            <Input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="לדוגמה: יזמי הייטק" className="bg-black/60 rounded-full" />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-white/40 text-[11px] font-black uppercase px-1 tracking-widest flex items-center gap-1.5">תיאור קצר</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="על מה הולכים לדבר במועדון? מה הווייב?" className="w-full bg-black/60 border border-white/10 rounded-[28px] p-4 text-white text-right font-medium focus:border-white/30 transition-all h-28 resize-none shadow-inner text-[15px] placeholder:text-white/20 outline-none leading-relaxed" />
          </div>

          <div className="flex flex-col gap-4 pt-4 border-t border-white/5">
            <label className="text-white/40 text-[11px] font-black uppercase px-1 tracking-widest flex items-center gap-1.5">סוג גישה</label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { triggerFeedback('pop'); setIsPaid(false); }} className={`flex items-center justify-center gap-2 h-14 rounded-full border transition-all ${!isPaid ? 'bg-white/10 border-white/30 text-white shadow-inner font-bold' : 'bg-black/40 border-white/5 text-white/40 font-medium'}`}>חופשי</button>
              <button onClick={() => { triggerFeedback('pop'); setIsPaid(true); }} className={`flex items-center justify-center gap-2 h-14 rounded-full border transition-all ${isPaid ? 'bg-[#ff9800]/10 border-[#ff9800]/30 text-[#ff9800] shadow-inner font-bold' : 'bg-black/40 border-white/5 text-white/40 font-medium'}`}>סגור / בתשלום</button>
            </div>

            <AnimatePresence>
              {isPaid && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 overflow-hidden flex flex-col gap-4">
                  <div>
                    <label className="text-white/40 text-[10px] font-bold px-1 mb-1 block text-right">דמי כניסה (תשלום חד-פעמי)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ff9800]/50 font-black text-xs tracking-wider">CRD</span>
                      <input type="number" value={price} onChange={(e: any) => setPrice(e.target.value)} placeholder="סכום כניסה..." className="w-full bg-black/60 text-left font-black h-14 border border-[#ff9800]/20 text-[#ff9800] shadow-inner focus:border-[#ff9800]/50 text-[16px] transition-all rounded-full px-12 outline-none" dir="ltr" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[#a855f7]/80 text-[10px] font-bold px-1 mb-1 flex items-center gap-1 text-right">הסלקטור: רמת מינימום לכניסה</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a855f7]/50 font-black text-xs tracking-wider">LEVEL</span>
                      <input type="number" min="1" value={minLevel} onChange={(e: any) => setMinLevel(e.target.value)} placeholder="1" className="w-full bg-black/60 text-left font-black h-14 border border-[#a855f7]/20 text-[#a855f7] shadow-inner focus:border-[#a855f7]/50 text-[16px] transition-all rounded-full px-12 outline-none" dir="ltr" />
                    </div>
                    <p className="text-white/30 text-[10px] font-bold mt-2.5 text-right px-1 leading-relaxed">משתמשים יצטרכו להגיע לרמה זו באפליקציה כדי לקבל אישור להיכנס למועדון.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </GlassCard>

        <div className="bg-green-500/5 border border-green-500/10 p-5 rounded-[28px] flex items-start gap-4 shadow-inner">
          <p className="text-white/60 text-[11px] font-medium leading-relaxed">עם הקמת המועדון, תוגדר אוטומטית כ<strong className="text-white font-black">מנהל הראשי</strong>. תוכל לנהל את השיח, להעלות פוסטים ולקבל קרדיטים ישירות מהחברים.</p>
        </div>

        <Button onClick={handleSave} disabled={saving || uploading || !name.trim()} className="w-full h-14 mt-2 rounded-full shadow-[0_0_30px_rgba(255,255,255,0.1)]">
          {saving ? <Loader2 size={24} className="animate-spin" /> : 'הקם מועדון עכשיו'}
        </Button>
      </div>
    </FadeIn>
  );
};
