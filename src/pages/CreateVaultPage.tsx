import React, { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, Lock, EyeOff, Image as ImageIcon, 
  Video, Coins, Crown, Users, Loader2, ShieldCheck, Zap
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

export const CreateVaultPage: React.FC = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  const teaserInputRef = useRef<HTMLInputElement>(null);
  const contentInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    teaser: '',
    teaserFile: null as File | null,
    contentText: '',
    contentFile: null as File | null,
    unlockType: 'gift' as 'gift' | 'tier' | 'members',
    unlockValue: 50, // CRD amount or Members count
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, type: 'teaser' | 'content') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormData(prev => ({ ...prev, [type === 'teaser' ? 'teaserFile' : 'contentFile']: file }));
  };

  const uploadFile = async (file: File) => {
    const fileName = `vault_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const { data, error } = await supabase.storage.from('feed_images').upload(fileName, file);
    if (error) throw error;
    return supabase.storage.from('feed_images').getPublicUrl(data.path).data.publicUrl;
  };

  const handleCreate = async () => {
    if (!formData.title.trim()) return toast.error('חובה להזין כותרת לכספת');
    if (!formData.contentText.trim() && !formData.contentFile) return toast.error('חובה להזין תוכן סודי (טקסט או מדיה)');
    
    setSaving(true);
    triggerFeedback('pop');
    const tid = toast.loading('מייצר כספת מאובטחת...');

    try {
      let teaserUrl = null;
      let contentUrls = [];

      setUploading(true);
      if (formData.teaserFile) teaserUrl = await uploadFile(formData.teaserFile);
      if (formData.contentFile) contentUrls.push(await uploadFile(formData.contentFile));
      setUploading(false);

      const payload = {
        title: formData.title,
        teaser: formData.teaser,
        teaser_blur_url: teaserUrl,
        content_type: formData.contentFile?.type.startsWith('video/') ? 'video' : 'image',
        content_text: formData.contentText,
        content_media_urls: contentUrls,
        unlock_type: formData.unlockType,
        unlock_gift_crd: formData.unlockType === 'gift' ? formData.unlockValue : null,
        unlock_members: formData.unlockType === 'members' ? formData.unlockValue : null,
        unlock_tier: formData.unlockType === 'tier' ? 'CORE' : 'INNER'
      };

      await apiFetch(`/api/circles/${slug}/vaults`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      triggerFeedback('success');
      toast.success('הכספת ננעלה ופורסמה בהצלחה!', { id: tid });
      navigate(`/circle/${slug}`);
    } catch (err: any) {
      triggerFeedback('error');
      toast.error(err.message || 'שגיאה ביצירת הכספת', { id: tid });
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  return (
    <FadeIn className="bg-surface min-h-screen pb-32 flex flex-col font-sans relative" dir="rtl">
      {/* HEADER */}
      <div className="sticky top-0 z-50 bg-surface/90 backdrop-blur-xl pt-[env(safe-area-inset-top)] pb-3 px-4 flex items-center justify-between shadow-sm border-b border-surface-border">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-surface-card border border-surface-border rounded-full text-brand active:scale-95 transition-transform">
          <ChevronRight size={20} />
        </button>
        <h1 className="text-lg font-black text-brand tracking-widest uppercase flex items-center gap-2">
          <Lock size={18} className="text-accent-primary" /> יצירת כספת
        </h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 px-4 pt-6 flex flex-col gap-8">
        
        {/* STEP 1: TEASER */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 px-2">
            <div className="w-6 h-6 rounded-full bg-accent-primary/20 flex items-center justify-center text-accent-primary font-black text-xs">1</div>
            <h2 className="text-sm font-black text-brand uppercase tracking-widest">חלון הראווה (גלוי לכולם)</h2>
          </div>
          
          <div className="bg-surface-card border border-surface-border rounded-[32px] p-5 shadow-sm space-y-4">
            <input 
              value={formData.title} onChange={e => setFormData(p => ({...p, title: e.target.value}))} 
              placeholder="כותרת מושכת (למשל: אסטרטגיית ההשקעה שלי ל-2026)" 
              className="w-full h-14 bg-surface border border-surface-border rounded-[20px] px-5 text-brand font-black outline-none focus:border-accent-primary/50 transition-all shadow-inner" 
            />
            <textarea 
              value={formData.teaser} onChange={e => setFormData(p => ({...p, teaser: e.target.value}))} 
              placeholder="טיזר קצר: מה יקבלו מי שיפתח את הכספת?" 
              className="w-full h-24 bg-surface border border-surface-border rounded-[20px] p-5 text-brand font-medium outline-none focus:border-accent-primary/50 transition-all resize-none shadow-inner" 
            />
            
            {/* Teaser Media */}
            <div 
              onClick={() => teaserInputRef.current?.click()} 
              className="w-full h-32 border-2 border-dashed border-surface-border rounded-[24px] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/5 active:scale-[0.99] transition-all relative overflow-hidden"
            >
              {formData.teaserFile ? (
                <img src={URL.createObjectURL(formData.teaserFile)} className="absolute inset-0 w-full h-full object-cover opacity-60 blur-sm" alt="preview" />
              ) : (
                <>
                  <ImageIcon size={28} className="text-brand-muted" />
                  <span className="text-[10px] font-black text-brand-muted uppercase tracking-widest">העלה תמונת רקע (תוצג מטושטשת)</span>
                </>
              )}
              <input type="file" ref={teaserInputRef} onChange={e => handleFile(e, 'teaser')} className="hidden" accept="image/*" />
            </div>
          </div>
        </section>

        {/* STEP 2: SECRET CONTENT */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 px-2">
            <div className="w-6 h-6 rounded-full bg-emerald-400/20 flex items-center justify-center text-emerald-400 font-black text-xs">2</div>
            <h2 className="text-sm font-black text-brand uppercase tracking-widest">התוכן הסודי <EyeOff size={14} className="inline ml-1 text-emerald-400" /></h2>
          </div>

          <div className="bg-surface-card border border-surface-border rounded-[32px] p-5 shadow-sm space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-transparent opacity-50" />
            
            <textarea 
              value={formData.contentText} onChange={e => setFormData(p => ({...p, contentText: e.target.value}))} 
              placeholder="כתוב כאן את התוכן המלא שייחשף לאחר הפתיחה..." 
              className="w-full h-32 bg-surface border border-emerald-400/20 rounded-[20px] p-5 text-brand font-medium outline-none focus:border-emerald-400/50 transition-all resize-none shadow-inner" 
            />
            
            <div 
              onClick={() => contentInputRef.current?.click()} 
              className="w-full h-20 border border-emerald-400/20 bg-emerald-400/5 rounded-[20px] flex items-center justify-center gap-3 cursor-pointer hover:bg-emerald-400/10 active:scale-[0.99] transition-all"
            >
              {formData.contentFile ? (
                <span className="text-xs font-black text-emerald-400">{formData.contentFile.name} מצורף</span>
              ) : (
                <>
                  <Video size={20} className="text-emerald-400" />
                  <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">צרף תמונה או וידאו סודי</span>
                </>
              )}
              <input type="file" ref={contentInputRef} onChange={e => handleFile(e, 'content')} className="hidden" accept="image/*,video/*" />
            </div>
          </div>
        </section>

        {/* STEP 3: THE LOCK */}
        <section className="flex flex-col gap-4 mb-4">
          <div className="flex items-center gap-2 px-2">
            <div className="w-6 h-6 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400 font-black text-xs">3</div>
            <h2 className="text-sm font-black text-brand uppercase tracking-widest">מנגנון הנעילה</h2>
          </div>

          <div className="bg-surface-card border border-surface-border rounded-[32px] p-4 shadow-sm flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setFormData(p => ({...p, unlockType: 'gift'}))} className={`p-3 rounded-[20px] flex flex-col items-center gap-2 border transition-all ${formData.unlockType === 'gift' ? 'bg-amber-400/10 border-amber-400/30 text-amber-400' : 'bg-surface border-surface-border text-brand-muted'}`}>
                <Coins size={20} />
                <span className="text-[10px] font-black uppercase">תשלום CRD</span>
              </button>
              <button onClick={() => setFormData(p => ({...p, unlockType: 'tier'}))} className={`p-3 rounded-[20px] flex flex-col items-center gap-2 border transition-all ${formData.unlockType === 'tier' ? 'bg-accent-primary/10 border-accent-primary/30 text-accent-primary' : 'bg-surface border-surface-border text-brand-muted'}`}>
                <Crown size={20} />
                <span className="text-[10px] font-black uppercase">חברי CORE</span>
              </button>
              <button onClick={() => setFormData(p => ({...p, unlockType: 'members'}))} className={`p-3 rounded-[20px] flex flex-col items-center gap-2 border transition-all ${formData.unlockType === 'members' ? 'bg-fuchsia-400/10 border-fuchsia-400/30 text-fuchsia-400' : 'bg-surface border-surface-border text-brand-muted'}`}>
                <Users size={20} />
                <span className="text-[10px] font-black uppercase">יעד קהילה</span>
              </button>
            </div>

            <AnimatePresence mode="wait">
              {formData.unlockType === 'gift' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pt-2">
                  <label className="text-[10px] font-bold text-amber-400 uppercase tracking-widest px-2 mb-1 block">מחיר פתיחה ב-CRD</label>
                  <input type="number" value={formData.unlockValue} onChange={e => setFormData(p => ({...p, unlockValue: Number(e.target.value)}))} className="w-full h-14 bg-surface border border-amber-400/20 rounded-[20px] px-5 text-brand font-black outline-none focus:border-amber-400/50 text-left" dir="ltr" />
                </motion.div>
              )}
              {formData.unlockType === 'members' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pt-2">
                  <label className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-widest px-2 mb-1 block">ייפתח אוטומטית כשנגיע ל-X חברים:</label>
                  <input type="number" value={formData.unlockValue} onChange={e => setFormData(p => ({...p, unlockValue: Number(e.target.value)}))} className="w-full h-14 bg-surface border border-fuchsia-400/20 rounded-[20px] px-5 text-brand font-black outline-none focus:border-fuchsia-400/50 text-left" dir="ltr" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* ACTION BUTTON */}
        <Button 
          onClick={handleCreate} 
          disabled={saving} 
          className="w-full h-16 bg-white text-black font-black text-[14px] uppercase tracking-widest rounded-full shadow-[0_10px_30px_rgba(255,255,255,0.1)] active:scale-95 transition-all flex items-center justify-center gap-2 z-10"
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin text-black" size={20} />
              <span>{uploading ? 'מעלה קבצים...' : 'נועל כספת...'}</span>
            </>
          ) : (
            <>
              <ShieldCheck size={20} /> צור ופרסם כספת
            </>
          )}
        </Button>
      </div>
    </FadeIn>
  );
};
