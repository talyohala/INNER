import React, { useEffect, useRef, useState } from 'react';                                                       
import { useNavigate } from 'react-router-dom';          
import { motion, AnimatePresence } from 'framer-motion'; 
import {                                                   
  UserCircle, Edit2, Loader2, Users, MessageSquare,                                           
  Link as LinkIcon, UserCheck, MapPin, Calendar, GraduationCap,                                           
  HeartHandshake, Shield, Camera, Key, Crown, Briefcase,                                               
  Sparkles, ChevronDown, Zap, ChevronRight                                            
} from 'lucide-react';                                   
import { createPortal } from 'react-dom';                
import { useAuth } from '../context/AuthContext';        
import { supabase } from '../lib/supabase';              
import { FadeIn, Button } from '../components/ui';       
import { triggerFeedback } from '../lib/sound';          
import toast from 'react-hot-toast';                                                                              

const ZODIAC_SIGNS = [                                     
  { name: 'טלה', icon: '♈' }, { name: 'שור', icon: '♉' }, { name: 'תאומים', icon: '♊' },                         
  { name: 'סרטן', icon: '♋' }, { name: 'אריה', icon: '♌' }, { name: 'בתולה', icon: '♍' },                        
  { name: 'מאזניים', icon: '♎' }, { name: 'עקרב', icon: '♏' }, { name: 'קשת', icon: '♐' },                       
  { name: 'גדי', icon: '♑' }, { name: 'דלי', icon: '♒' }, { name: 'דגים', icon: '♓' }                          
];                                                                                                                

const RELATIONSHIP_STATUSES = [                            
  { name: 'רווק/ה' }, { name: 'במערכת יחסים' }, { name: 'נשוי/ה' },                                      
  { name: 'גרוש/ה' }, { name: 'אלמן/ה' }, { name: 'זה מסובך' }, { name: 'פתוח/ה להצעות' }                              
];                                                                                                                

export const EditProfilePage: React.FC = () => {           
  const navigate = useNavigate();
  const { user, reloadProfile, loading: authLoading } = useAuth();                                                                                                           
  
  const avatarInputRef = useRef<HTMLInputElement>(null);   
  const coverInputRef = useRef<HTMLInputElement>(null);                                                             
  
  const [mounted, setMounted] = useState(false);           
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);                                                                                                    
  const [uploadingAvatar, setUploadingAvatar] = useState(false);                                                    
  const [uploadingCover, setUploadingCover] = useState(false);                                                      
  const [savingDetails, setSavingDetails] = useState(false);                                                        
  const [updatingPassword, setUpdatingPassword] = useState(false);                                                  
  const [loadingData, setLoadingData] = useState(true);                                                             
  const [showZodiacPicker, setShowZodiacPicker] = useState(false);                                                  
  const [showRelationshipPicker, setShowRelationshipPicker] = useState(false);                                                                                               
  
  const [formData, setFormData] = useState({                 
    full_name: '', username: '', bio: '', social_link: '', zodiac: '', location: '', 
    birth_date: '', relationship_status: '', education: '', job_title: '', signal_price: 50                 
  });                                                                                                               
  
  const [passwordData, setPasswordData] = useState({ current_password: '', new_password: '', confirm_password: '' });                                                       
  const [data, setData] = useState<any>({ profile: {} });                                                           
  
  useEffect(() => {                                          
    setMounted(true);                                        
    setPortalNode(document.getElementById('root') || document.body);                                                
  }, []);                                                                                                           
  
  useEffect(() => {                                          
    const loadProfileData = async () => {                      
      try {                                                      
        setLoadingData(true);                                    
        if (!user?.id) return;                                   
        const { data: profileData, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();                                                               
        if (error) throw error;                                  
        
        setData({ profile: profileData });                       
        if (profileData) {                                         
          setFormData({                                              
            full_name: profileData.full_name || '', 
            username: profileData.username || '', 
            bio: profileData.bio || '', 
            social_link: profileData.social_link || '', 
            zodiac: profileData.zodiac || '', 
            location: profileData.location || '', 
            birth_date: profileData.birth_date ? profileData.birth_date.split('T')[0] : '', 
            relationship_status: profileData.relationship_status || '', 
            education: profileData.education || '', 
            job_title: profileData.job_title || '',             
            signal_price: profileData.signal_price || 50,             
          });                                                    
        }                                                      
      } catch (err: any) {                                       
        toast.error(`שגיאה: ${err.message}`);                  
      } finally { setLoadingData(false); }                   
    };                                                       
    
    if (user && !authLoading) loadProfileData();           
  }, [user, authLoading]);                                                                                          
  
  const handleMediaUpload = async (file: File, type: 'avatar' | 'cover') => {                                         
    if (!file || !user?.id) return;                          
    const setUploading = type === 'avatar' ? setUploadingAvatar : setUploadingCover;                                  
    setUploading(true);                                      
    const tid = toast.loading(`מעדכן תמונה...`);             
    try {                                                      
      const fileExt = file.name.split('.').pop();              
      const fileName = `${user.id}_${type}_${Date.now()}.${fileExt}`;                                                   
      const { data: uploadData, error: uploadError } = await supabase.storage.from('feed_images').upload(fileName, file);                                                        
      
      if (uploadError) throw uploadError;                      
      
      const { data: { publicUrl } } = supabase.storage.from('feed_images').getPublicUrl(uploadData.path);               
      const fieldToUpdate = type === 'avatar' ? 'avatar_url' : 'cover_url';                                             
      const { error: updateError } = await supabase.from('profiles').update({ [fieldToUpdate]: publicUrl }).eq('id', user.id);                                                   
      
      if (updateError) throw updateError;                      
      if (reloadProfile) reloadProfile();                      
      setData((prev: any) => ({ ...prev, profile: { ...prev.profile, [fieldToUpdate]: publicUrl } }));                  
      toast.success(`התמונה עודכנה!`, { id: tid });          
    } catch (err: any) { 
      toast.error(`שגיאה: ${err.message}`, { id: tid }); 
    } finally { 
      setUploading(false); 
    }      
  };                                                                                                                
  
  const handleSaveDetails = async () => {                    
    if (!user?.id || savingDetails) return;                  
    setSavingDetails(true);
    triggerFeedback('pop');                                  
    const tid = toast.loading('שומר שינויים...');            
    try {                                                      
      // התיקון כאן: אנחנו שולחים את ה-formData כמו שהוא בלי לסנן עמודות
      const updates = { ...formData, birth_date: formData.birth_date === '' ? null : formData.birth_date };                                                                      
      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);                              
      
      if (error) throw error;                                                                                           
      if (reloadProfile) reloadProfile();                      
      toast.success('הפרטים עודכנו!', { id: tid });          
    } catch (err: any) { 
      toast.error(`שגיאה: ${err.message}`, { id: tid }); 
    } finally { 
      setSavingDetails(false); 
    }  
  };                                                                                                                
  
  const handleUpdatePassword = async () => {                 
    if (!user?.id || updatingPassword) return;               
    if (passwordData.new_password !== passwordData.confirm_password) { toast.error('הסיסמאות לא תואמות'); return; }                                                            
    if (passwordData.new_password.length < 6) { toast.error('הסיסמה קצרה מדי'); return; }                             
    
    setUpdatingPassword(true);                               
    triggerFeedback('pop');                                  
    const tid = toast.loading('מעדכן סיסמה...');             
    try {                                                      
      const { error } = await supabase.auth.updateUser({ password: passwordData.new_password });                        
      if (error) throw error;                                  
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });                                
      toast.success('הסיסמה עודכנה!', { id: tid });          
    } catch (err: any) { 
      toast.error(`שגיאה: ${err.message}`, { id: tid }); 
    } finally { 
      setUpdatingPassword(false); 
    }
  };

  if (authLoading || loadingData) {                          
    return <div className="min-h-screen bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" size={32} /></div>;                         
  }                                                                                                                 
  
  const selectedZodiac = ZODIAC_SIGNS.find(s => s.name === formData.zodiac);                                        
  const selectedRelationship = RELATIONSHIP_STATUSES.find(s => s.name === formData.relationship_status);                                                                     
  
  const xpProgress = Math.min(100, ((data.profile?.xp || 0) % 1000) / 10);

  return (                                                   
    <div className="bg-surface min-h-screen relative font-sans overflow-x-hidden" dir="rtl">                                                                                     
      <FadeIn className="relative w-full flex flex-col pb-32">                                                                                                                     
        
        <div className="absolute top-0 left-0 w-full h-[240px] bg-surface-card z-0 overflow-hidden">                                                                                 
          <div className="absolute top-6 left-0 right-0 flex justify-center items-center z-30 pointer-events-none">                                                                    
            <span className="text-white font-black text-[13px] tracking-[0.2em] uppercase drop-shadow-md">עריכת פרופיל</span>                                                        
          </div>                                                                                                            
          <input type="file" ref={coverInputRef} onChange={(e) => { if (e.target.files?.[0]) handleMediaUpload(e.target.files[0], 'cover'); if (coverInputRef.current) coverInputRef.current.value = ''; }} accept="image/*" className="hidden" />                                                                                                              
          
          {data.profile?.cover_url ? (                               
            <img src={data.profile.cover_url} className="w-full h-full object-cover opacity-90" />                          
          ) : (                                                      
            <div className="absolute inset-0 bg-gradient-to-b from-accent-primary/10 to-transparent" />                     
          )}                                                                                                                
          
          <button onClick={() => navigate(-1)} className="absolute top-5 right-5 w-10 h-10 bg-surface-card/80 backdrop-blur-xl text-brand rounded-full flex items-center justify-center shadow-lg border border-surface-border active:scale-90 transition-all z-20 pointer-events-auto">
            <ChevronRight size={24} className="mr-0.5" />
          </button>

          <button                                                    
            onClick={() => coverInputRef.current?.click()}                                                                    
            disabled={uploadingCover}                                
            className="absolute top-5 left-5 w-10 h-10 bg-surface-card/80 backdrop-blur-xl text-brand rounded-full flex items-center justify-center shadow-lg border border-surface-border active:scale-90 transition-all disabled:opacity-50 z-20 pointer-events-auto"                                
          >                                                          
            {uploadingCover ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}                        
          </button>                                              
        </div>                                                                                                            
        
        <div className="relative z-10 w-full pt-[200px] px-2">                                                              
          <div className="bg-surface rounded-t-[40px] w-full min-h-screen flex flex-col items-center shadow-[0_-20px_40px_rgba(0,0,0,0.7)] border-t border-surface-border">                                                                     
            
            <motion.div whileHover={{ scale: 1.05 }} className="w-[110px] h-[110px] rounded-full bg-surface shadow-xl p-1.5 relative -mt-[55px] z-20 mb-8">                              
              <div className="w-full h-full rounded-full overflow-hidden bg-surface-card border border-surface-border relative flex items-center justify-center">                                                           
                {data.profile?.avatar_url ? (
                  <img src={data.profile.avatar_url} className="w-full h-full object-cover" /> 
                ) : (
                  <UserCircle size={50} className="text-brand-muted" />
                )}                                                              
              </div>
              <input type="file" ref={avatarInputRef} onChange={(e) => { if (e.target.files?.[0]) handleMediaUpload(e.target.files[0], 'avatar'); if (avatarInputRef.current) avatarInputRef.current.value = ''; }} accept="image/*" className="hidden" />                                                                                                          
              <button                                                    
                onClick={() => avatarInputRef.current?.click()}                                                                   
                disabled={uploadingAvatar}                               
                className="absolute bottom-0 right-0 w-10 h-10 bg-white/20 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-white/20 active:scale-90 transition-all z-20 disabled:opacity-50"                                                             
              >                                                          
                {uploadingAvatar ? <Loader2 size={18} className="animate-spin text-white" /> : <Camera size={18} />}                                                                     
              </button>                                              
            </motion.div>
            
            <div className="w-full flex flex-col gap-6 px-1">                                                                                                                            
              
              <div className="w-full px-1">
                <div className="bg-surface-card border border-surface-border rounded-[32px] p-6 shadow-sm flex flex-col gap-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-accent-primary/5 blur-[40px] rounded-full pointer-events-none" />
                  
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-accent-primary/10 flex items-center justify-center border border-accent-primary/20 shadow-inner">
                        <Crown size={20} className="text-accent-primary" />
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-brand font-black text-[16px]">רמה {data.profile?.level || 1}</span>
                        <span className="text-brand-muted text-[11px] font-bold tracking-widest uppercase">{data.profile?.role_label || 'Member'}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-brand font-black text-[16px] flex items-center gap-1.5">
                        {data.profile?.crd_balance || 0} <Zap size={16} className="text-amber-400 fill-amber-400" />
                      </span>
                      <span className="text-brand-muted text-[11px] font-bold tracking-widest uppercase">יתרת CRD</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 relative z-10 mt-1">
                    <div className="flex justify-between text-[10px] font-black text-brand-muted tracking-widest uppercase">
                      <span>{data.profile?.xp || 0} XP</span>
                      <span>לרמה הבאה</span>
                    </div>
                    <div className="w-full h-2.5 bg-surface rounded-full overflow-hidden border border-surface-border shadow-inner">
                      <div className="h-full bg-accent-primary" style={{ width: `${xpProgress}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-surface-card border border-surface-border flex flex-col gap-6 rounded-[32px] p-6 shadow-sm relative overflow-hidden">                                     
                <div className="absolute top-0 left-0 w-40 h-40 bg-accent-primary/5 blur-[50px] rounded-full pointer-events-none" />                                                                                                                
                
                <div className="flex justify-between items-center border-b border-surface-border pb-4 relative z-10">                                                                        
                  <div className="flex flex-col text-right"><span className="text-brand font-black text-[16px] tracking-wide">פרטים אישיים</span></div>                                      
                  <Users size={20} className="text-accent-primary" />                                                             
                </div>                                                                                                            
                
                <div className="grid grid-cols-1 gap-6 relative z-10 px-1">                                                                                                                  
                  
                  <div className="bg-surface border border-surface-border rounded-[24px] p-4 flex items-center justify-between shadow-inner mb-2">
                    <div className="flex flex-col">
                      <span className="text-brand font-black text-[14px]">מחיר סיגנל (DMs)</span>
                      <span className="text-brand-muted text-[10px] font-bold">כמה CRD עולה לפנות אליך?</span>
                    </div>
                    <div className="flex items-center gap-2 bg-surface-card border border-surface-border px-3 py-1.5 rounded-xl">
                       <input type="number" value={formData.signal_price} onChange={(e) => setFormData(p => ({...p, signal_price: Number(e.target.value)}))} className="w-12 bg-transparent text-accent-primary font-black text-[15px] outline-none text-center" dir="ltr" />
                       <Zap size={14} className="text-amber-400" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">                                                                            
                    <InputField label="שם מלא" icon={UserCheck} value={formData.full_name} onChange={v => setFormData(p=>({...p, full_name: v}))} placeholder="ישראל ישראלי" />                                                                         
                    <InputField label="שם משתמש" icon={Edit2} value={formData.username} onChange={v => setFormData(p=>({...p, username: v}))} placeholder="user123" dir="ltr" />                                                                      
                  </div>                                                                                                            
                  
                  <div className="flex flex-col gap-1.5 text-right border-b border-surface-border pb-2.5">                            
                    <label className="text-brand-muted text-[11px] font-black tracking-widest uppercase flex items-center gap-2"><MessageSquare size={14} /><span>ביו</span></label>                                                                    
                    <textarea value={formData.bio} onChange={e => setFormData(p=>({...p, bio: e.target.value}))} className="bg-transparent border-none outline-none text-brand text-[15px] font-bold placeholder:text-brand-muted/40 h-24 resize-none px-1" placeholder="ספר קצת על עצמך..." />                                                                         
                  </div>                                                                                                            
                  
                  <InputField label="קישור חברתי" icon={LinkIcon} value={formData.social_link} onChange={v => setFormData(p=>({...p, social_link: v}))} placeholder="instagram.com/user" dir="ltr" />                                                                                                          
                  
                  <div className="grid grid-cols-2 gap-4">                                                                            
                    <SelectField label="מזל" icon={Crown} value={selectedZodiac ? `${selectedZodiac.icon} ${selectedZodiac.name}` : ''} placeholder="בחר מזל..." onClick={() => setShowZodiacPicker(true)} />                                           
                    <InputField label="עיר מגורים" icon={MapPin} value={formData.location} onChange={v => setFormData(p=>({...p, location: v}))} placeholder="תל אביב" />                    
                  </div>                                                                                                            
                  
                  <div className="grid grid-cols-2 gap-4">                                                                            
                    <InputField label="תאריך לידה" icon={Calendar} value={formData.birth_date} onChange={v => setFormData(p=>({...p, birth_date: v}))} placeholder="בחר..." type="date" />                                                              
                    <SelectField label="מצב משפחתי" icon={HeartHandshake} value={selectedRelationship ? selectedRelationship.name : ''} placeholder="בחר מצב..." onClick={() => setShowRelationshipPicker(true)} />                                   
                  </div>                                                                                                            
                  
                  <InputField label="עיסוק / מקצוע" icon={Briefcase} value={formData.job_title} onChange={v => setFormData(p=>({...p, job_title: v}))} placeholder="מעצב מוצר, מפתח..." />                                                            
                  <InputField label="השכלה" icon={GraduationCap} value={formData.education} onChange={v => setFormData(p=>({...p, education: v}))} placeholder="סטודנט, תואר ראשון..." />                                                           
                </div>                                                                                                            
                
                <div className="flex justify-end mt-2 relative z-10">                                                               
                  <Button onClick={handleSaveDetails} disabled={savingDetails} className="w-full bg-white text-black rounded-[20px] font-black text-[14px] uppercase tracking-widest h-14 shadow-lg active:scale-[0.98] transition-all">                                                                         
                    {savingDetails ? <Loader2 size={20} className="animate-spin text-black" /> : 'שמור שינויים'}                    
                  </Button>                                              
                </div>                                                 
              </div>                                                                                                            
              
              <div className="bg-surface-card backdrop-blur-xl border border-surface-border flex flex-col gap-6 rounded-[32px] p-7 shadow-sm relative overflow-hidden mb-6">
                <div className="flex justify-between items-center border-b border-surface-border pb-4 relative z-10">                                                                        
                  <div className="flex flex-col text-right"><span className="text-brand font-black text-[16px] tracking-wide">אבטחה וסיסמה</span></div>                                      
                  <Key size={20} className="text-accent-primary" />                                                               
                </div>                                                                                                            
                
                <div className="flex flex-col gap-6 relative z-10 px-1">                                                            
                  <InputField label="סיסמה נוכחית" icon={Shield} value={passwordData.current_password} onChange={v => setPasswordData(p=>({...p, current_password: v}))} placeholder="••••••••" type="password" />                                    
                  <InputField label="סיסמה חדשה" icon={Shield} value={passwordData.new_password} onChange={v => setPasswordData(p=>({...p, new_password: v}))} placeholder="••••••••" type="password" />                                              
                  <InputField label="אימות סיסמה חדשה" icon={UserCheck} value={passwordData.confirm_password} onChange={v => setPasswordData(p=>({...p, confirm_password: v}))} placeholder="••••••••" type="password" />                           
                </div>                                                                                                            
                
                <div className="flex justify-end mt-2 relative z-10">                                                               
                  <Button onClick={handleUpdatePassword} disabled={updatingPassword || !passwordData.new_password} className="w-full bg-surface border border-surface-border text-brand rounded-[20px] font-black text-[14px] uppercase tracking-widest h-14 shadow-sm disabled:opacity-50 active:scale-[0.98] transition-all">                                           
                    {updatingPassword ? <Loader2 size={20} className="animate-spin text-brand-muted" /> : 'עדכן סיסמה'}                                                                      
                  </Button>                                              
                </div>                                                 
              </div>

            </div>                                                                                                          
          </div>                                                 
        </div>                                                 
      </FadeIn>                                                                                                         
      
      {mounted && portalNode && createPortal(                    
        <>                                                         
          <AnimatePresence>                                          
            {showZodiacPicker && (                                     
              <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl">                                      
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowZodiacPicker(false)} />                                         
                <motion.div                                                
                  drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2}                                        
                  onDragEnd={(e, info) => { if (info.offset.y > 100 || info.velocity.y > 500) setShowZodiacPicker(false); }}                                                                 
                  initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}                                     
                  transition={{ type: 'spring', damping: 25, stiffness: 400 }}                                                      
                  className="relative z-10 bg-surface rounded-t-[40px] p-6 pb-12 border-t border-surface-border max-h-[85vh] flex flex-col"                                                
                >                                                          
                  <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-6 shrink-0 cursor-grab active:cursor-grabbing" />                                                           
                  <div className="flex justify-center items-center mb-6 shrink-0">                                                    
                    <h3 className="text-brand font-black text-lg">בחר את המזל שלך</h3>                                              
                  </div>                                                   
                  <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-3 scrollbar-hide pr-1">                                 
                    {ZODIAC_SIGNS.map((sign) => (                              
                      <button key={sign.name} onClick={() => { setFormData(p => ({ ...p, zodiac: sign.name })); triggerFeedback('pop'); setShowZodiacPicker(false); }} className={`flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all ${formData.zodiac === sign.name ? 'bg-white border-white text-black shadow-md' : 'bg-surface-card border-surface-border text-brand hover:border-brand/30'}`}>                                                                   
                        <span className="text-2xl">{sign.icon}</span>                                                                     
                        <span className="font-black text-[15px]">{sign.name}</span>                                                     
                      </button>                                              
                    ))}                                                    
                  </div>                                                 
                </motion.div>                                          
              </div>                                                 
            )}                                                     
          </AnimatePresence>
                                                                   
          <AnimatePresence>                                          
            {showRelationshipPicker && (                               
              <div className="fixed inset-0 z-[999999] flex flex-col justify-end" dir="rtl">                                      
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowRelationshipPicker(false)} />                                   
                <motion.div                                                
                  drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2}                                        
                  onDragEnd={(e, info) => { if (info.offset.y > 100 || info.velocity.y > 500) setShowRelationshipPicker(false); }}                                                           
                  initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}                                     
                  transition={{ type: 'spring', damping: 25, stiffness: 400 }}                                                      
                  className="relative z-10 bg-surface rounded-t-[40px] p-6 pb-12 border-t border-surface-border max-h-[85vh] flex flex-col"                                                
                >                                                          
                  <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-6 shrink-0 cursor-grab active:cursor-grabbing" />                                                           
                  <div className="flex justify-center items-center mb-6 shrink-0">                                                    
                    <h3 className="text-brand font-black text-lg">מצב משפחתי</h3>                                                   
                  </div>                                                   
                  <div className="flex-1 overflow-y-auto flex flex-col gap-3 scrollbar-hide pr-1">                                    
                    {RELATIONSHIP_STATUSES.map((status) => (                                                                            
                      <button key={status.name} onClick={() => { setFormData(p => ({ ...p, relationship_status: status.name })); triggerFeedback('pop'); setShowRelationshipPicker(false); }} className={`flex items-center justify-center p-4 rounded-2xl border transition-all ${formData.relationship_status === status.name ? 'bg-white border-white text-black shadow-md' : 'bg-surface-card border-surface-border text-brand hover:border-brand/30'}`}>                                   
                        <span className="font-black text-[15px]">{status.name}</span>                                                   
                      </button>                                              
                    ))}                                                    
                  </div>                                                 
                </motion.div>                                          
              </div>                                                 
            )}                                                     
          </AnimatePresence>                                     
        </>,                                                     
        portalNode                                             
      )}                                                     
    </div>                                                 
  );                                                     
};                                                                                                                

interface InputFieldProps { label: string; icon: React.ElementType; value: string | number; onChange: (value: string) => void; placeholder: string; type?: string; dir?: string;}   
const InputField: React.FC<InputFieldProps> = ({ label, icon: Icon, value, onChange, placeholder, type = 'text', dir = 'rtl' }) => (                                         
  <div className="flex flex-col gap-1.5 text-right border-b border-surface-border pb-2.5">                            
    <label className="text-brand-muted text-[11px] font-black tracking-widest uppercase flex items-center justify-start gap-2"><Icon size={14} /><span>{label}</span></label>                                                           
    <input type={type} value={value} onChange={e => onChange(e.target.value)} className="bg-transparent border-none outline-none text-brand text-[15px] font-bold placeholder:text-brand-muted/40 transition-colors px-1" placeholder={placeholder} dir={dir} style={{ colorScheme: 'dark' }} />                                                        
  </div>                                                 
);                                                                                                                

interface SelectFieldProps { label: string; icon: React.ElementType; value: string; placeholder: string; onClick: () => void; }                                            
const SelectField: React.FC<SelectFieldProps> = ({ label, icon: Icon, value, placeholder, onClick }) => (           
  <div className="flex flex-col gap-1.5 text-right border-b border-surface-border pb-2.5 cursor-pointer" onClick={onClick}>                                                    
    <label className="text-brand-muted text-[11px] font-black tracking-widest uppercase flex items-center justify-start gap-2"><Icon size={14} /><span>{label}</span></label>                                                           
    <div className="flex justify-between items-center px-1 pt-1">                                                       
      <span className={`text-[15px] font-bold ${value ? 'text-brand' : 'text-brand-muted/40'}`}>{value || placeholder}</span>
      <ChevronDown size={16} className="text-brand-muted" />
    </div>                                                 
  </div>                                                 
);
