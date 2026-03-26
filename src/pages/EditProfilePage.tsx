import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, Camera, UserCircle, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { FadeIn, GlassCard, Button, Input } from '../components/ui';
import { triggerFeedback } from '../lib/sound';

export const EditProfilePage: React.FC = () => {
  const navigate = useNavigate();
  // הורדנו את refreshProfile שעשה את הקריסה
  const { profile } = useAuth(); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setAvatarUrl(profile.avatar_url || '');
    }
  }, [profile]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      
      triggerFeedback('pop');
      setUploading(true);
      const tid = toast.loading('מעדכן את הלוק שלך...');
      
      const fileName = `avatar_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      const { error } = await supabase.storage.from('avatars').upload(fileName, file); 
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setAvatarUrl(publicUrl);
      toast.success('תמונה הועלתה!', { id: tid });
      triggerFeedback('success');
    } catch (err) {
      triggerFeedback('error');
      toast.error('שגיאה בהעלאת התמונה');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim() || !username.trim()) {
      triggerFeedback('error');
      return toast.error('שם ושם משתמש הם חובה');
    }

    setSaving(true);
    triggerFeedback('pop');
    try {
      await apiFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ 
          full_name: fullName.trim(), 
          username: username.trim().toLowerCase(), 
          bio: bio.trim(), 
          avatar_url: avatarUrl 
        })
      });
      
      triggerFeedback('coin');
      toast.success('הפרופיל עודכן בהצלחה! 👑', { style: { background: '#22c55e', color: '#000' } });
      
      // כדי להבטיח שהכל (כולל תפריטים) יתעדכן עם התמונה החדשה, נעשה רענון קל לעמוד הפרופיל
      setTimeout(() => {
        window.location.href = '/profile';
      }, 500);
      
    } catch (err: any) {
      triggerFeedback('error');
      toast.error(err.message || 'שגיאה בשמירת הפרופיל');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FadeIn className="px-5 pt-8 pb-32 bg-[#030303] min-h-screen font-sans relative" dir="rtl">
      
      <div className="flex justify-between items-center mb-8 relative z-10">
        <div className="w-8"></div>
        <div className="flex flex-col items-center">
          <h1 className="text-2xl font-black text-white">עריכת זהות</h1>
          <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">הפנים שלך במועדון</span>
        </div>
        <button onClick={() => { triggerFeedback('pop'); navigate(-1); }} className="w-8 h-8 flex justify-center items-center bg-white/5 rounded-full shadow-inner active:scale-90 transition-all">
          <ArrowRight size={16} />
        </button>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept="image/*" 
        className="hidden" 
      />

      <div className="flex justify-center mb-8 relative z-10">
        <motion.div 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => fileInputRef.current?.click()}
          className="relative cursor-pointer group"
        >
          <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full scale-110"></div>
          
          <div className="w-28 h-28 rounded-[28px] bg-[#0A0A0A] border-2 border-white/10 overflow-hidden shadow-2xl relative z-10 flex items-center justify-center">
            {uploading ? (
              <Loader2 size={30} className="animate-spin text-purple-400" />
            ) : avatarUrl ? (
              <img src={avatarUrl} className="w-full h-full object-cover" alt="Avatar" />
            ) : (
              <UserCircle size={50} className="text-white/20" />
            )}
            
            {!uploading && (
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm">
                <Camera size={24} className="text-white" />
              </div>
            )}
          </div>
          
          <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center border-2 border-[#030303] shadow-lg z-20">
            <Camera size={14} className="text-white" />
          </div>
        </motion.div>
      </div>

      <GlassCard className="p-6 flex flex-col gap-5 relative z-10 rounded-[32px]">
        
        <div className="flex flex-col gap-1.5">
          <label className="text-white/40 text-[10px] font-black uppercase tracking-widest px-1 text-right">שם תצוגה</label>
          <Input 
            value={fullName} 
            onChange={(e: any) => setFullName(e.target.value)} 
            placeholder="איך יראו אותך בצ'אט?" 
            className="h-14 bg-[#050505] text-right"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-white/40 text-[10px] font-black uppercase tracking-widest px-1 text-right">שם משתמש (User)</label>
          <Input 
            value={username} 
            onChange={(e: any) => setUsername(e.target.value.toLowerCase())} 
            placeholder="username" 
            dir="ltr"
            className="h-14 bg-[#050505] text-left"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-white/40 text-[10px] font-black uppercase tracking-widest px-1 text-right">ביו (Bio)</label>
          <textarea 
            value={bio} 
            onChange={(e) => setBio(e.target.value)} 
            placeholder="ספר קצת על עצמך... (יופיע בפרופיל שלך)" 
            className="w-full bg-[#050505] border border-white/10 rounded-2xl p-4 text-white text-right font-medium focus:border-white/30 transition-all h-28 resize-none shadow-inner text-sm placeholder:text-white/20 outline-none" 
          />
        </div>

      </GlassCard>

      <div className="mt-6 relative z-10">
        <Button 
          onClick={handleSave} 
          disabled={saving || uploading}
          className="w-full h-14 rounded-2xl bg-white text-black text-sm shadow-[0_0_20px_rgba(255,255,255,0.15)]"
        >
          {saving ? <Loader2 size={20} className="animate-spin" /> : <><Save size={18} /> עדכן פרופיל</>}
        </Button>
      </div>

    </FadeIn>
  );
};
