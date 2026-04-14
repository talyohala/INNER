import React, { useState, useRef } from 'react';         
import { useNavigate } from 'react-router-dom';          
import { motion, AnimatePresence } from 'framer-motion'; 
import toast from 'react-hot-toast';                     
import {                                                   
  Loader2, Image as ImageIcon, ShieldCheck, Lock, Unlock, Shield, X, ArrowRight, Camera                                                
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
      const tid = toast.loading('מעבד תמונת נושא...');                                                                  
      
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');                                                     
      const fileName = `circle_cover_${Date.now()}_${Math.floor(Math.random() * 1000)}_${safeName}`;                                                                             
      
      const { data, error } = await supabase.storage.from('avatars').upload(fileName, file);                                                                                        
      if (error) throw error;                                                                                           
      
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(data.path);                                                                                                              
      
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
      
      const slug = name.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]/g, '') + '-' + Math.random().toString(36).substring(2, 6);                                                                                           
      
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
          owner_id: userId                                             
        })                                                       
        .select()                                                .single();                                                                                                      
        
      if (circleError) throw circleError;                                                                               
      
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
    <FadeIn className="bg-surface min-h-[100dvh] font-sans relative overflow-x-hidden flex flex-col" dir="rtl">                                                          
      
      {/* 🔝 HEADER */}
      <div className="sticky top-0 z-50 bg-surface/90 backdrop-blur-xl border-b border-surface-border pt-[env(safe-area-inset-top)] pb-3 px-4 shadow-sm flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-2 active:scale-90 transition-transform">
          <ArrowRight size={24} className="text-brand" />
        </button>
        <h1 className="text-lg font-black text-brand tracking-widest uppercase">הקמת מועדון</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 px-4 pt-6 pb-32 flex flex-col gap-6">

        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />                                                                                                                
        
        {/* Cover Upload */}
        <div onClick={() => fileInputRef.current?.click()} className="w-full h-52 rounded-[32px] bg-surface-card border border-surface-border flex flex-col items-center justify-center relative overflow-hidden shadow-sm cursor-pointer active:scale-[0.99] transition-transform">                                                          
          {uploading ? (                                             
            <div className="flex flex-col items-center gap-3 z-10">                                                                  
              <Loader2 size={30} className="animate-spin text-accent-primary" />                                                   
              <span className="text-brand-muted text-[10px] font-black tracking-widest uppercase">מעבד תמונה...</span>                                                
            </div>                                                 
          ) : coverUrl ? (                                           
            <>                                                         
              <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" loading="lazy" />                                                       
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px] opacity-0 hover:opacity-100 transition-opacity">                                     
                <div className="flex items-center gap-2 bg-surface/80 backdrop-blur-md border border-white/20 px-5 py-2.5 rounded-full shadow-lg">
                  <Camera size={16} className="text-white" />
                  <span className="text-white font-black text-[11px] uppercase tracking-widest">החלף תמונה</span>                                             
                </div>
              </div>                                                 
            </>                                                    
          ) : (                                                      
            <>                                                         
              <div className="w-16 h-16 rounded-full bg-surface border border-surface-border flex items-center justify-center mb-3 shadow-inner">                                          
                <ImageIcon size={24} className="text-brand-muted" />                                                            
              </div>                                                   
              <span className="text-brand text-[14px] font-black">בחר תמונת נושא למועדון</span>                                 
              <span className="text-brand-muted text-[10px] font-bold mt-2 uppercase tracking-widest">יחס מומלץ 16:9</span>                                                
            </>                                                    
          )}                                                     
        </div>                                                                                                            
        
        {/* Main Form */}
        <div className="bg-surface-card border border-surface-border rounded-[32px] p-6 shadow-sm flex flex-col gap-6">                                  
          <div className="flex flex-col gap-1.5">                      
            <label className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-2">שם המועדון</label>                                                 
            <input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="לדוגמה: יזמי הייטק" className="bg-surface border border-surface-border rounded-[20px] px-5 h-14 text-brand text-[15px] font-medium outline-none focus:border-accent-primary/50 transition-colors shadow-inner" />                                                     
          </div>                                                                                                            
          
          <div className="flex flex-col gap-1.5">                      
            <label className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-2">תיאור קצר</label>                                                 
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="על מה הולכים לדבר במועדון? מה הווייב?" className="w-full bg-surface border border-surface-border rounded-[24px] p-5 text-brand text-right font-medium transition-all h-28 resize-none shadow-inner text-[15px] placeholder:text-brand-muted outline-none focus:border-accent-primary/50 leading-relaxed" />                                                     
          </div>                                                                                                            
          
          {/* Access Settings */}
          <div className="flex flex-col gap-5 pt-4 border-t border-surface-border mt-2">                                           
            <label className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-2">סוג גישה</label>                                                                                                          
            <div className="grid grid-cols-2 gap-3">                   
              <button type="button" onClick={() => { triggerFeedback('pop'); setIsPaid(false); }} className={`flex items-center justify-center gap-2 h-14 rounded-full border transition-all ${!isPaid ? 'bg-accent-primary/10 border-accent-primary/30 text-accent-primary shadow-inner font-bold' : 'bg-surface border-surface-border text-brand-muted font-medium'}`}>                                                          
                <Unlock size={16} /> חופשי                                                  
              </button>                                                                                                         
              <button type="button" onClick={() => { triggerFeedback('pop'); setIsPaid(true); }} className={`flex items-center justify-center gap-2 h-14 rounded-full border transition-all ${isPaid ? 'bg-accent-primary/10 border-accent-primary/30 text-accent-primary shadow-inner font-bold' : 'bg-surface border-surface-border text-brand-muted font-medium'}`}>                                                          
                <Lock size={16} /> סגור / בתשלום                                          
              </button>                                              
            </div>                                                                                                            
            
            <AnimatePresence>                                          
              {isPaid && (                                               
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden flex flex-col gap-5 pt-2">                                                          
                  
                  {/* Join Price */}
                  <div>                                                      
                    <label className="text-brand-muted text-[10px] font-bold px-2 mb-1.5 block text-right tracking-widest uppercase">דמי כניסה</label>                                                 
                    <div className="relative">                                 
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-accent-primary font-black text-xs tracking-widest">CRD</span>                                                  
                      <input type="number" value={price} onChange={(e: any) => setPrice(e.target.value)} placeholder="סכום כניסה..." dir="ltr" className="w-full bg-surface text-left font-black h-14 border border-surface-border focus:border-accent-primary/50 text-brand shadow-inner text-[16px] transition-all rounded-[20px] px-14 outline-none" />                                                     
                    </div>                                                 
                  </div>                                                                                                            
                  
                  {/* Min Level Selector */}
                  <div>                                                      
                    <label className="text-brand-muted text-[10px] font-bold px-2 mb-1.5 flex items-center gap-1.5 text-right tracking-widest uppercase">                                                                      
                      <Shield size={13} className="text-accent-primary" /> הסלקטור: רמת מינימום לכניסה                            
                    </label>                                                 
                    <div className="relative">                                 
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-accent-primary font-black text-xs tracking-widest">LEVEL</span>                                                  
                      <input type="number" min="1" value={minLevel} onChange={(e: any) => setMinLevel(e.target.value)} placeholder="1" dir="ltr" className="w-full bg-surface text-left font-black h-14 border border-surface-border focus:border-accent-primary/50 text-brand shadow-inner text-[16px] transition-all rounded-[20px] px-16 outline-none tracking-widest" />                                                     
                    </div>                                                   
                    <p className="text-brand-muted/70 text-[10px] font-bold mt-2 text-right px-2 leading-relaxed">                       
                      משתמשים יצטרכו להגיע לרמה זו באפליקציה כדי לקבל אישור להיכנס למועדון.                                           
                    </p>                                                   
                  </div>                                                 
                </motion.div>                                          
              )}                                                     
            </AnimatePresence>                                     
          </div>                                                 
        </div>                                                                                                            
        
        {/* Info Card */}
        <div className="bg-surface-card border border-surface-border p-5 rounded-[28px] flex items-start gap-4 shadow-sm">                                                        
          <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center shrink-0 border border-surface-border shadow-inner">                                      
            <ShieldCheck size={20} className="text-accent-primary" />                                                       
          </div>                                                   
          <p className="text-brand-muted text-[13px] font-medium leading-relaxed pt-1">                                            
            עם הקמת המועדון, תוגדר אוטומטית כ<strong className="text-brand font-black mx-1">מנהל הראשי</strong>. 
            תוכל לנהל את השיח, להעלות דרופים ולקבל קרדיטים ישירות מהחברים.                                                  
          </p>                                                   
        </div>                                                                                                            
        
        {/* Action Button */}
        <Button onClick={handleSave} disabled={saving || uploading || !name.trim()} className="w-full h-14 mt-4 rounded-full bg-white text-black font-black text-[14px] uppercase tracking-widest shadow-[0_5px_20px_rgba(255,255,255,0.15)] active:scale-95 transition-all flex items-center justify-center">                                                          
          {saving ? <Loader2 size={24} className="animate-spin text-black" /> : 'הקם מועדון עכשיו'}                                  
        </Button>                                              
      
      </div>                                                 
    </FadeIn>                                              
  );                                                     
};
