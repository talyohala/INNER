import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2, Image as ImageIcon, ArrowRight, Sparkles, ShieldCheck, Users, Crown, Lock, Unlock } from 'lucide-react';
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

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      triggerFeedback('pop');
      const tid = toast.loading('מעלה תמונת נושא...', { style: { background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } });
      
      const fileName = `circle_cover_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const { error } = await supabase.storage.from('avatars').upload(fileName, file);
      
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setCoverUrl(publicUrl);
      
      triggerFeedback('success');
      toast.success('התמונה מוכנה!', { id: tid, style: { background: '#111', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' } });
    } catch (err) {
      triggerFeedback('error');
      toast.error('שגיאה בהעלאת התמונה', { style: { background: '#111', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' } });
    } finally {
      setUploading(false);
    }
  };

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
      toast.error(err.message || 'שגיאה בהקמת המועדון', { style: { background: '#111', color: '#ef4444' } });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FadeIn className="px-4 pt-8 pb-32 flex flex-col gap-6 bg-black min-h-screen font-sans relative overflow-x-hidden" dir="rtl">
      
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex justify-center">
        <div className="absolute top-[-5%] left-[-10%] w-[50%] h-[40%] bg-white/10 blur-[100px] rounded-full mix-blend-screen"></div>
      </div>

      <div className="flex justify-between items-center mb-2 relative z-10 px-1">
        <div className="w-10"></div>
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 mb-1">
             <div className="relative flex items-center justify-center">
               <div className="absolute w-8 h-8 bg-[#ff9800]/20 rounded-full animate-pulse blur-[4px]"></div>
               <Crown size={18} className="text-[#ff9800] relative z-10 drop-shadow-[0_0_8px_rgba(255,152,0,0.5)]" />
             </div>
             <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">הקמת מועדון</h1>
          </div>
          <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">מרחב סודי ואקסקלוסיבי</span>
        </div>
        <button onClick={() => { triggerFeedback('pop'); navigate(-1); }} className="w-10 h-10 flex justify-center items-center bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-full shadow-lg active:scale-90 transition-all hover:bg-white/10">
          <ArrowRight size={18} className="text-white/80" />
        </button>
      </div>

      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />

      <div className="flex flex-col gap-2 relative z-10">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-48 rounded-[32px] bg-white/[0.02] backdrop-blur-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center relative shadow-2xl overflow-hidden group cursor-pointer active:scale-95 transition-all hover:border-white/20 hover:bg-white/[0.04]"
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
                <span className="text-white font-black text-[11px] uppercase tracking-widest flex items-center gap-2 bg-white/10 px-5 py-2.5 rounded-full border border-white/10 shadow-lg">
                  <ImageIcon size={14} /> החלף נושא
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-black border border-white/5 flex items-center justify-center mb-3 shadow-inner group-hover:bg-white/5 transition-colors">
                <ImageIcon size={28} className="text-white/20" />
              </div>
              <span className="text-white/60 text-[13px] font-black tracking-wide">בחר תמונת נושא למועדון</span>
              <span className="text-white/20 text-[9px] font-bold mt-2 uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded-md border border-white/5 shadow-inner">יחס מומלץ 16:9</span>
            </>
          )}
        </div>
      </div>

      <div className="bg-white/[0.04] backdrop-blur-3xl border border-white/10 p-6 rounded-[36px] flex flex-col gap-6 shadow-2xl relative z-10">
        
        <div className="text-right flex flex-col gap-2">
          <label className="text-white/40 text-[11px] font-black uppercase px-2 tracking-widest flex items-center gap-1.5">
            <Users size={14} className="text-[#2196f3]" /> שם המועדון החדש
          </label>
          <Input
            value={name}
            onChange={(e: any) => setName(e.target.value)}
            placeholder="לדוגמה: יזמי הייטק"
            className="bg-black/40 text-right font-medium h-14 border border-white/10 text-white shadow-inner focus:border-white/30 text-[15px] placeholder:text-white/20 transition-all rounded-[20px] px-4"
          />
        </div>

        <div className="text-right flex flex-col gap-2">
          <label className="text-white/40 text-[11px] font-black uppercase px-2 tracking-widest flex items-center gap-1.5">
            <Sparkles size={14} className="text-[#e91e63]" /> תיאור המועדון
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="על מה הולכים לדבר כאן? מה הווייב?"
            className="w-full bg-black/40 border border-white/10 rounded-[24px] p-4 text-white text-right font-medium focus:border-white/30 transition-all h-28 resize-none shadow-inner text-[15px] placeholder:text-white/20 outline-none leading-relaxed"
          />
        </div>

        <div className="text-right flex flex-col gap-3 pt-4 border-t border-white/5 mt-1">
          <label className="text-white/40 text-[11px] font-black uppercase px-2 tracking-widest flex items-center gap-1.5">
            <Lock size={14} className="text-[#ff9800]" /> סוג כניסה למועדון
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { triggerFeedback('pop'); setIsPaid(false); }}
              className={`flex items-center justify-center gap-2 h-14 rounded-[20px] border transition-all ${!isPaid ? 'bg-white/10 border-white/30 text-white shadow-inner font-bold' : 'bg-black/40 border-white/5 text-white/40 hover:bg-white/5 font-medium'}`}
            >
              <Unlock size={16} className={!isPaid ? "text-white" : ""} /> כניסה חופשית
            </button>
            <button
              onClick={() => { triggerFeedback('pop'); setIsPaid(true); }}
              className={`flex items-center justify-center gap-2 h-14 rounded-[20px] border transition-all ${isPaid ? 'bg-[#ff9800]/10 border-[#ff9800]/30 text-[#ff9800] shadow-[0_0_15px_rgba(255,152,0,0.1)] font-bold' : 'bg-black/40 border-white/5 text-white/40 hover:bg-white/5 font-medium'}`}
            >
              <Lock size={16} /> בתשלום (CRD)
            </button>
          </div>

          <AnimatePresence>
            {isPaid && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 overflow-hidden">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ff9800]/50 font-black text-xs tracking-wider">CRD</span>
                  <input
                    type="number"
                    value={price}
                    onChange={(e: any) => setPrice(e.target.value)}
                    placeholder="סכום כניסה..."
                    className="w-full bg-black/60 text-left font-black h-14 border border-[#ff9800]/20 text-[#ff9800] shadow-inner focus:border-[#ff9800]/50 text-[16px] transition-all rounded-[20px] px-12 outline-none"
                    dir="ltr"
                  />
                </div>
                <p className="text-white/30 text-[10px] font-bold mt-2.5 text-right px-1">המשתמשים ישלמו סכום זה פעם אחת בעת הכניסה.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-start gap-4 bg-white/[0.02] border border-white/5 p-5 rounded-[24px] relative overflow-hidden shadow-inner mt-2">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-[#8bc34a]/50"></div>
          <ShieldCheck size={24} className="text-[#8bc34a] shrink-0 mt-0.5 drop-shadow-[0_0_8px_rgba(139,195,74,0.4)]" />
          <p className="text-white/60 text-[11px] font-medium leading-relaxed text-right">
            עם הקמת המועדון, תוגדר אוטומטית כ<strong className="text-white font-black">מנהל הראשי</strong>. תוכל להזמין חברים, לנהל את השיח ולקבל טיפים (CRD) ישירות לארנק.
          </p>
        </div>
      </div>

      <div className="mt-2 relative z-10">
        <Button
          onClick={handleSave}
          disabled={saving || uploading || !name.trim()}
          className="w-full h-14 rounded-[20px] bg-white text-black font-black text-[14px] uppercase tracking-widest shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center justify-center active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
        >
          {saving ? <Loader2 size={24} className="animate-spin" /> : 'הקם מועדון'}
        </Button>
      </div>
    </FadeIn>
  );
};
