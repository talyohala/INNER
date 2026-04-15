import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2, Image as ImageIcon, ShieldCheck, Lock, Unlock, Shield, Camera, Zap, Coins } from 'lucide-react';
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
      const tid = toast.loading('מעלה תמונה...');
      const fileName = `circle_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
      const { data, error } = await supabase.storage.from('avatars').upload(fileName, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(data.path);
      setCoverUrl(publicUrl);
      triggerFeedback('success');
      toast.success('תמונת נושא עודכנה', { id: tid });
    } catch (err: any) {
      triggerFeedback('error');
      toast.error('שגיאה בהעלאת תמונה');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error('חובה לתת שם למועדון');
    
    setSaving(true);
    triggerFeedback('pop');
    const tid = toast.loading('מקים מועדון...');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("משתמש לא מחובר");

      const slug = `${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.random().toString(36).substring(2, 6)}`;

      const { data: newCircle, error: circleError } = await supabase
        .from('circles')
        .insert({
          name: name.trim(),
          description: description.trim(),
          cover_url: coverUrl,
          is_private: isPaid,
          join_price: isPaid ? Number(price) : 0,
          min_level: Number(minLevel) || 1,
          slug: slug,
          owner_id: user.id
        })
        .select()
        .single();

      if (circleError) throw new Error(circleError.message);

      await supabase.from('circle_members').insert({
        circle_id: newCircle.id,
        user_id: user.id,
        role: 'admin'
      });

      triggerFeedback('success');
      toast.success('המועדון הוקם!', { id: tid });
      navigate(`/circle/${newCircle.slug}`);
    } catch (err: any) {
      triggerFeedback('error');
      toast.error(`שגיאה: ${err.message}`, { id: tid });
      setSaving(false);
    }
  };

  return (
    <FadeIn className="bg-surface min-h-screen pb-32 flex flex-col font-sans" dir="rtl">
      {/* HEADER */}
      <div className="sticky top-0 z-50 bg-surface/90 backdrop-blur-xl pt-6 pb-3 px-4 flex items-center justify-center">
        <h1 className="text-lg font-black text-brand tracking-widest uppercase italic">צור מועדון</h1>
      </div>

      <div className="flex-1 px-4 pt-4 flex flex-col gap-6">
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
        
        {/* Cover Picker */}
        <div onClick={() => fileInputRef.current?.click()} className="w-full h-52 rounded-[32px] bg-surface-card border border-surface-border flex items-center justify-center relative overflow-hidden cursor-pointer active:scale-[0.99] transition-all shadow-sm">
          {uploading ? <Loader2 size={30} className="animate-spin text-accent-primary" /> : coverUrl ? <img src={coverUrl} className="w-full h-full object-cover" /> : (
            <div className="flex flex-col items-center gap-2">
              <Camera size={32} className="text-brand-muted" />
              <span className="text-[10px] font-black text-brand-muted uppercase tracking-widest">בחר תמונת נושא</span>
            </div>
          )}
        </div>

        {/* Form Body */}
        <div className="bg-surface-card border border-surface-border rounded-[32px] p-6 space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest pr-2">שם המועדון</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: יזמי הייטק" className="w-full h-14 bg-surface border border-surface-border rounded-[20px] px-5 text-brand font-bold outline-none focus:border-accent-primary/50 transition-all shadow-inner" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest pr-2">תיאור</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="על מה המועדון?" className="w-full h-28 bg-surface border border-surface-border rounded-[24px] p-5 text-brand font-medium outline-none focus:border-accent-primary/50 transition-all resize-none shadow-inner" />
          </div>

          {/* Access Switcher */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button type="button" onClick={() => setIsPaid(false)} className={`h-14 rounded-full border flex items-center justify-center gap-2 transition-all ${!isPaid ? 'bg-accent-primary/10 border-accent-primary/30 text-accent-primary font-bold shadow-inner' : 'bg-surface border-surface-border text-brand-muted'}`}><Unlock size={16} /> חופשי</button>
            <button type="button" onClick={() => setIsPaid(true)} className={`h-14 rounded-full border flex items-center justify-center gap-2 transition-all ${isPaid ? 'bg-accent-primary/10 border-accent-primary/30 text-accent-primary font-bold shadow-inner' : 'bg-surface border-surface-border text-brand-muted'}`}><Lock size={16} /> בתשלום</button>
          </div>

          <AnimatePresence>
            {isPaid && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 pt-2 overflow-hidden">
                
                {/* Entry Fee Field */}
                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <span className="text-[10px] font-black text-accent-primary uppercase tracking-tighter">CRD</span>
                    <Coins size={14} className="text-accent-primary" />
                  </div>
                  <input 
                    type="number" 
                    value={price} 
                    onChange={(e: any) => setPrice(e.target.value)} 
                    placeholder="דמי כניסה" 
                    className="w-full h-14 bg-surface border border-surface-border rounded-[20px] pl-24 pr-5 text-brand font-black text-left outline-none focus:border-accent-primary/50 transition-all" 
                    dir="ltr"
                  />
                </div>

                {/* Min Level Field */}
                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-tighter">LEVEL</span>
                    <Zap size={14} className="text-amber-400 fill-amber-400" />
                  </div>
                  <input 
                    type="number" 
                    value={minLevel} 
                    onChange={(e: any) => setMinLevel(e.target.value)} 
                    placeholder="רמת מינימום" 
                    className="w-full h-14 bg-surface border border-surface-border rounded-[20px] pl-24 pr-5 text-brand font-black text-left outline-none focus:border-accent-primary/50 transition-all" 
                    dir="ltr"
                  />
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Button */}
        <Button onClick={handleSave} disabled={saving || uploading || !name.trim()} className="w-full h-16 rounded-full bg-white text-black font-black text-[14px] uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all mt-4">
          {saving ? <Loader2 size={24} className="animate-spin" /> : 'צור מועדון'}
        </Button>
      </div>
    </FadeIn>
  );
};
