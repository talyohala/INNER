import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2, Lock, Unlock, Camera, Zap, Coins, Hash } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

const CATEGORY_TREE = [
  { id: 'business', name: 'עסקים ויזמות', sub: ['סטארטאפים', 'שיווק', 'מסחר אלקטרוני', 'הון סיכון', 'נדל"ן'] },
  { id: 'tech', name: 'טכנולוגיה', sub: ['בינה מלאכותית', 'פיתוח תוכנה', 'סייבר', 'חומרה', 'גיימינג'] },
  { id: 'finance', name: 'פיננסים', sub: ['קריפטו', 'שוק ההון', 'השקעות', 'כלכלה אישית'] },
  { id: 'lifestyle', name: 'לייף סטייל', sub: ['כושר ותזונה', 'אופנה', 'טיולים', 'חיי לילה', 'רכב'] },
  { id: 'creators', name: 'יוצרים ואמנות', sub: ['צילום ווידאו', 'עיצוב גרפי', 'מוזיקה', 'כתיבה', 'פודקאסטים'] },
  { id: 'exclusive', name: 'המעגל הסגור', sub: ['לחברים בלבד', 'VIP', 'הזמנה בלבד'] }
];

export const CreateCirclePage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  
  const [category, setCategory] = useState(CATEGORY_TREE[0].id);
  const [subCategory, setSubCategory] = useState('');
  
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
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("משתמש לא מחובר או פג תוקף");
      
      const slug = `${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.random().toString(36).substring(2, 6)}`;
      
      const { data: newCircle, error: circleError } = await supabase
        .from('circles')
        .insert({
          name: name.trim(),
          description: description.trim(),
          cover_url: coverUrl,
          category: category,
          sub_category: subCategory,
          is_private: isPaid,
          join_price: isPaid ? Number(price) : 0,
          min_level: Number(minLevel) || 1,
          slug: slug,
          owner_id: user.id
        })
        .select()
        .single();
        
      if (circleError) throw new Error(circleError.message);
      
      const { error: memberError } = await supabase
        .from('circle_members')
        .insert({
          circle_id: newCircle.id,
          user_id: user.id,
          role: 'admin'
        });
        
      if (memberError) throw new Error("המועדון נוצר, אך קרתה שגיאה בהגדרת המנהל");
      
      triggerFeedback('success');
      toast.success('המועדון הוקם!', { id: tid });
      navigate(`/circle/${newCircle.slug}`);
      
    } catch (err: any) {
      triggerFeedback('error');
      toast.error(`שגיאה: ${err.message}`, { id: tid });
    } finally {
      setSaving(false);
    }
  };

  const activeCatObj = CATEGORY_TREE.find(c => c.id === category);

  return (
    <FadeIn className="bg-surface min-h-screen font-sans flex flex-col" dir="rtl">
      {/* HEADER - הוסר הפס התחתון והורם מעט למעלה */}
      <div className="sticky top-0 z-50 bg-surface/90 backdrop-blur-xl pt-[calc(env(safe-area-inset-top)+12px)] pb-2 px-4 flex items-center justify-center">
        <h1 className="text-xl font-black text-brand tracking-widest uppercase">הקמת מועדון</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32 flex flex-col gap-6 scrollbar-hide">
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
        
        {/* Cover Picker */}
        <div onClick={() => fileInputRef.current?.click()} className="w-full h-48 rounded-[32px] bg-surface-card border border-surface-border flex items-center justify-center relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform shadow-md group hover:border-accent-primary/30">
          {uploading ? <Loader2 size={30} className="animate-spin text-accent-primary" /> : coverUrl ? (
            <>
              <img src={coverUrl} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                <Camera size={14} className="text-white" />
                <span className="text-white text-[10px] font-black uppercase tracking-widest">שנה תמונה</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-surface border border-surface-border flex items-center justify-center shadow-inner">
                <Camera size={24} className="text-brand-muted" />
              </div>
              <span className="text-[11px] font-black text-brand-muted uppercase tracking-widest">העלה תמונת נושא</span>
            </div>
          )}
        </div>

        {/* Basic Info */}
        <div className="bg-surface-card border border-surface-border rounded-[32px] p-6 flex flex-col gap-5 shadow-sm">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest px-2">שם המועדון</label>
            <input 
              value={name} onChange={(e) => setName(e.target.value)} 
              placeholder="לדוגמה: קהילת מפתחי AI..." 
              className="w-full h-14 bg-surface border border-surface-border rounded-[20px] px-5 text-brand font-black outline-none focus:border-accent-primary/50 transition-all shadow-inner placeholder:text-brand-muted/50" 
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest px-2">תיאור</label>
            <textarea 
              value={description} onChange={(e) => setDescription(e.target.value)} 
              placeholder="על מה המועדון? מה המטרה שלו?" 
              className="w-full h-28 bg-surface border border-surface-border rounded-[24px] p-5 text-brand font-medium outline-none focus:border-accent-primary/50 transition-all resize-none shadow-inner placeholder:text-brand-muted/50" 
            />
          </div>
        </div>

        {/* Category Picker - בעברית מלאה */}
        <div className="flex flex-col gap-3">
          <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest px-2 flex items-center gap-2"><Hash size={12}/> בחירת קטגוריה</label>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            {CATEGORY_TREE.map(cat => (
              <button 
                key={cat.id} 
                onClick={() => { triggerFeedback('pop'); setCategory(cat.id); setSubCategory(''); }}
                className={`shrink-0 h-10 px-5 rounded-full font-black text-[12px] transition-all active:scale-95 border ${category === cat.id ? 'bg-accent-primary/10 border-accent-primary/40 text-accent-primary shadow-[0_0_15px_rgba(var(--color-accent-primary),0.1)]' : 'bg-surface-card border-surface-border text-brand-muted hover:text-brand'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeCatObj && activeCatObj.sub && activeCatObj.sub.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                {activeCatObj.sub.map(sub => (
                  <button 
                    key={sub} 
                    onClick={() => { triggerFeedback('pop'); setSubCategory(sub === subCategory ? '' : sub); }}
                    className={`shrink-0 h-8 px-4 rounded-full font-bold text-[11px] transition-all active:scale-95 border ${subCategory === sub ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-surface-border text-brand-muted hover:bg-white/5'}`}
                  >
                    {sub}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Access Settings */}
        <div className="bg-surface-card border border-surface-border rounded-[32px] p-6 flex flex-col gap-5 shadow-sm">
          <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest px-2">הגדרות גישה ותשלום</label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => { triggerFeedback('pop'); setIsPaid(false); }} className={`h-14 rounded-[20px] border flex items-center justify-center gap-2 transition-all active:scale-95 ${!isPaid ? 'bg-accent-primary/10 border-accent-primary/40 text-accent-primary font-black shadow-inner' : 'bg-surface border-surface-border text-brand-muted'}`}><Unlock size={16} /> חופשי</button>
            <button type="button" onClick={() => { triggerFeedback('pop'); setIsPaid(true); }} className={`h-14 rounded-[20px] border flex items-center justify-center gap-2 transition-all active:scale-95 ${isPaid ? 'bg-rose-500/10 border-rose-500/40 text-rose-400 font-black shadow-inner' : 'bg-surface border-surface-border text-brand-muted'}`}><Lock size={16} /> בתשלום</button>
          </div>

          <AnimatePresence>
            {isPaid && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-4 overflow-hidden pt-2">
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-surface-card px-2 py-1 rounded-lg border border-surface-border pointer-events-none">
                    <span className="text-[10px] font-black text-accent-primary uppercase tracking-tighter">CRD</span>
                    <Coins size={14} className="text-accent-primary" />
                  </div>
                  <input
                    type="number" value={price} onChange={(e: any) => setPrice(e.target.value)}
                    placeholder="דמי כניסה" dir="ltr"
                    className="w-full h-14 bg-surface border border-surface-border rounded-[20px] pl-20 pr-5 text-brand font-black text-left outline-none focus:border-accent-primary/50 transition-all shadow-inner placeholder:text-brand-muted/50"
                  />
                </div>
                
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-surface-card px-2 py-1 rounded-lg border border-surface-border pointer-events-none">
                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-tighter">LEVEL</span>
                    <Zap size={14} className="text-amber-400 fill-amber-400" />
                  </div>
                  <input
                    type="number" value={minLevel} onChange={(e: any) => setMinLevel(e.target.value)}
                    placeholder="רמת מינימום" dir="ltr"
                    className="w-full h-14 bg-surface border border-surface-border rounded-[20px] pl-24 pr-5 text-brand font-black text-left outline-none focus:border-amber-400/50 transition-all shadow-inner placeholder:text-brand-muted/50"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Action */}
        <div className="pt-2">
          <Button onClick={handleSave} disabled={saving || uploading || !name.trim()} className="w-full h-16 rounded-[24px] bg-accent-primary text-white font-black text-[15px] uppercase tracking-[0.2em] shadow-[0_5px_20px_rgba(var(--color-accent-primary),0.3)] active:scale-95 transition-all flex items-center justify-center gap-2">
            {saving ? <Loader2 size={24} className="animate-spin text-white" /> : 'הקם מועדון'}
          </Button>
        </div>
      </div>
    </FadeIn>
  );
};
