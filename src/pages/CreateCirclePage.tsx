import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2, Lock, Unlock, Camera, Zap, Coins, Hash } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

const cleanToastStyle = {
  background: 'rgba(20, 20, 20, 0.85)',
  backdropFilter: 'blur(16px)',
  color: '#ffffff',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  borderRadius: '100px',
  fontSize: '14px',
  fontWeight: 700,
  padding: '12px 24px',
  boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
};

const CATEGORY_TREE = [
  { id: 'business', name: 'עסקים ויזמות', sub: ['סטארטאפים', 'שיווק', 'מסחר מקוון', 'הון סיכון', 'נדל"ן'] },
  { id: 'tech', name: 'טכנולוגיה', sub: ['בינה מלאכותית', 'פיתוח תוכנה', 'סייבר', 'חומרה', 'ספורט אלקטרוני'] },
  { id: 'finance', name: 'פיננסים', sub: ['קריפטו', 'שוק ההון', 'השקעות', 'כלכלה אישית'] },
  { id: 'lifestyle', name: 'סגנון חיים', sub: ['כושר ותזונה', 'אופנה', 'טיולים', 'חיי לילה', 'רכב'] },
  { id: 'creators', name: 'יוצרים ואמנות', sub: ['צילום ווידאו', 'עיצוב גרפי', 'מוזיקה', 'כתיבה', 'הסכתים'] },
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
      const tid = toast.loading('מעלה תמונה...', { style: cleanToastStyle });
      const fileName = `circle_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
      const { data, error } = await supabase.storage.from('avatars').upload(fileName, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(data.path);
      setCoverUrl(publicUrl);
      triggerFeedback('success');
      toast.success('תמונת נושא עודכנה', { id: tid, style: cleanToastStyle });
    } catch (err: any) {
      triggerFeedback('error');
      toast.error('שגיאה בהעלאת תמונה', { style: cleanToastStyle });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error('חובה לתת שם למועדון', { style: cleanToastStyle });
    setSaving(true);
    triggerFeedback('pop');
    const tid = toast.loading('צור מועדון...', { style: cleanToastStyle });
    
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
      toast.success('המועדון הוקם בהצלחה!', { id: tid, style: cleanToastStyle });
      navigate(`/circle/${newCircle.slug}`);
    } catch (err: any) {
      triggerFeedback('error');
      toast.error(`שגיאה: ${err.message}`, { id: tid, style: cleanToastStyle });
    } finally {
      setSaving(false);
    }
  };

  const activeCatObj = CATEGORY_TREE.find(c => c.id === category);

  return (
    <FadeIn className="bg-[#121212] min-h-[100dvh] font-sans flex flex-col relative overflow-x-hidden" dir="rtl">
      
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-accent-primary/5 rounded-full blur-[120px]" />
      </div>

      {/* HEADER - שכבה אחת חלקה עם הרקע, ללא שקיפות או טשטוש מבדל */}
      <div className="sticky top-0 z-50 bg-[#121212] pt-[calc(env(safe-area-inset-top)+16px)] pb-4 px-4 flex items-center justify-center">
        <h1 className="text-xl font-black text-white tracking-widest uppercase">יצירת מועדון</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-[120px] flex flex-col gap-8 scrollbar-hide relative z-10">
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />

        {/* Cover Picker */}
        <div onClick={() => fileInputRef.current?.click()} className="w-full h-52 rounded-[32px] bg-[#1a1a1e] border border-white/5 flex items-center justify-center relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform group shadow-md">
          {uploading ? (
            <Loader2 size={32} className="animate-spin text-accent-primary" />
          ) : coverUrl ? (
            <>
              <img src={coverUrl} className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-[16px] border border-white/10 flex items-center gap-2 shadow-sm">
                <Camera size={16} className="text-white" />
                <span className="text-white text-[11px] font-black uppercase tracking-widest">שנה תמונה</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-[24px] bg-[#121212] border border-white/5 flex items-center justify-center shadow-inner">
                <Camera size={28} className="text-[#8b8b93]" />
              </div>
              <span className="text-[12px] font-black text-[#8b8b93] uppercase tracking-widest">העלה תמונת נושא</span>
            </div>
          )}
        </div>

        {/* Basic Info */}
        <div className="bg-[#1a1a1e] border border-white/5 rounded-[32px] p-6 flex flex-col gap-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-black text-[#8b8b93] uppercase tracking-widest px-2">שם המועדון</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: קהילת מפתחי AI..."
              className="w-full h-14 bg-[#121212] border border-white/5 rounded-[20px] px-5 text-white font-black outline-none focus:ring-1 focus:ring-accent-primary/50 transition-all shadow-inner placeholder:text-[#4a4a52]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-black text-[#8b8b93] uppercase tracking-widest px-2">תיאור</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="על מה המועדון? מה המטרה שלו?"
              className="w-full h-28 bg-[#121212] border border-white/5 rounded-[24px] p-5 text-white font-medium outline-none focus:ring-1 focus:ring-accent-primary/50 transition-all resize-none shadow-inner placeholder:text-[#4a4a52]"
            />
          </div>
        </div>

        {/* Category Picker */}
        <div className="flex flex-col gap-4">
          <label className="text-[11px] font-black text-[#8b8b93] uppercase tracking-widest px-2 flex items-center gap-2">
            <Hash size={14} className="text-white" /> בחירת קטגוריה
          </label>
          
          <LayoutGroup id="createCategories">
            <div className="flex items-center gap-x-6 overflow-x-auto scrollbar-hide pb-2 px-2 snap-x">
              {CATEGORY_TREE.map(cat => {
                const isActive = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => { triggerFeedback('pop'); setCategory(cat.id); setSubCategory(''); }}
                    className="relative flex flex-col items-center min-w-max pb-2.5 active:scale-95 transition-all snap-start"
                  >
                    <span className={`text-[14px] transition-colors ${isActive ? 'text-white font-black' : 'text-[#8b8b93] font-bold hover:text-white/80'}`}>
                      {cat.name}
                    </span>
                    {isActive && <motion.div layoutId="catLine" className="absolute bottom-0 w-6 h-0.5 bg-accent-primary rounded-full shadow-[0_0_8px_rgba(var(--color-accent-primary),0.6)]" />}
                  </button>
                );
              })}
            </div>
          </LayoutGroup>

          <AnimatePresence mode="wait">
            {activeCatObj && activeCatObj.sub && activeCatObj.sub.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <LayoutGroup id="createSub">
                  <div className="flex items-center gap-x-6 overflow-x-auto scrollbar-hide pb-2 px-2 mt-2 snap-x">
                    {activeCatObj.sub.map(sub => {
                      const isActive = subCategory === sub;
                      return (
                        <button
                          key={sub}
                          onClick={() => { triggerFeedback('pop'); setSubCategory(sub === subCategory ? '' : sub); }}
                          className="relative flex flex-col items-center min-w-max pb-2.5 active:scale-95 transition-all snap-start"
                        >
                          <span className={`text-[12px] transition-colors ${isActive ? 'text-white font-black' : 'text-[#8b8b93] font-bold hover:text-white/80'}`}>
                            {sub}
                          </span>
                          {isActive && <motion.div layoutId="subLine" className="absolute bottom-0 w-4 h-0.5 bg-accent-primary rounded-full shadow-[0_0_8px_rgba(var(--color-accent-primary),0.6)]" />}
                        </button>
                      );
                    })}
                  </div>
                </LayoutGroup>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Access Settings */}
        <div className="bg-[#1a1a1e] border border-white/5 rounded-[32px] p-6 flex flex-col gap-6 shadow-sm">
          <label className="text-[11px] font-black text-[#8b8b93] uppercase tracking-widest px-2">הגדרות גישה ותשלום</label>
          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={() => { triggerFeedback('pop'); setIsPaid(false); }} className={`h-14 rounded-[20px] border flex items-center justify-center gap-2 transition-all active:scale-95 ${!isPaid ? 'bg-accent-primary/10 border-accent-primary/30 text-accent-primary font-black shadow-inner' : 'bg-[#121212] border-white/5 text-[#8b8b93]'}`}><Unlock size={16} /> חופשי</button>
            <button type="button" onClick={() => { triggerFeedback('pop'); setIsPaid(true); }} className={`h-14 rounded-[20px] border flex items-center justify-center gap-2 transition-all active:scale-95 ${isPaid ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 font-black shadow-inner' : 'bg-[#121212] border-white/5 text-[#8b8b93]'}`}><Lock size={16} /> בתשלום</button>
          </div>

          <AnimatePresence>
            {isPaid && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-4 overflow-hidden pt-2">
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-[#1a1a1e] border border-white/5 px-3 py-1.5 rounded-[12px] pointer-events-none shadow-sm">
                    <span className="text-[11px] font-black text-accent-primary uppercase tracking-widest">CRD</span>
                    <Coins size={14} className="text-accent-primary" />
                  </div>
                  <input
                    type="number" value={price} onChange={(e: any) => setPrice(e.target.value)}
                    placeholder="דמי כניסה" dir="ltr"
                    className="w-full h-14 bg-[#121212] border border-white/5 rounded-[20px] pl-24 pr-5 text-white font-black text-left outline-none focus:ring-1 focus:ring-accent-primary/50 transition-all shadow-inner placeholder:text-[#4a4a52]"
                  />
                </div>

                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-[#1a1a1e] border border-white/5 px-3 py-1.5 rounded-[12px] pointer-events-none shadow-sm">
                    <span className="text-[11px] font-black text-orange-500 uppercase tracking-widest">LEVEL</span>
                    <Zap size={14} className="text-orange-500 fill-orange-500" />
                  </div>
                  <input
                    type="number" value={minLevel} onChange={(e: any) => setMinLevel(e.target.value)}
                    placeholder="רמת מינימום" dir="ltr"
                    className="w-full h-14 bg-[#121212] border border-white/5 rounded-[20px] pl-28 pr-5 text-white font-black text-left outline-none focus:ring-1 focus:ring-orange-500/50 transition-all shadow-inner placeholder:text-[#4a4a52]"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Action */}
        <div className="pt-4">
          <Button onClick={handleSave} disabled={saving || uploading || !name.trim()} className="w-full h-16 rounded-[24px] bg-accent-primary text-white font-black text-[16px] uppercase tracking-[0.15em] shadow-md active:scale-95 transition-all flex items-center justify-center gap-3 border-none disabled:opacity-50">
            {saving ? <Loader2 size={24} className="animate-spin text-white" /> : 'צור מועדון'}
          </Button>
        </div>
      </div>
    </FadeIn>
  );
};
