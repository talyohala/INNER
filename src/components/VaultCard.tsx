import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Unlock, Clock, Users, Coins, Shield, Crown, Loader2, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { Vault } from '../types';
import { Button } from './ui';

// נגן וידאו פרימיום בטכנולוגיית "גובה נעול" למניעת תקיעות ופס שחור
const VaultVideoPlayer = ({ src }: { src: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation(); // מונע מהלחיצה לעבור לאלמנטים שמתחת
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        triggerFeedback('pop');
        videoRef.current.play().catch(() => {
          toast.error('לא ניתן לנגן וידאו זה במכשירך');
        });
      }
    }
  };

  return (
    // יחס גובה-רוחב סינמטי נעול. זה מונע מהוידאו להתכווץ לפס שחור!
    <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden border border-surface-border group shadow-[inset_0_4px_30px_rgba(0,0,0,0.5)] mt-4">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/50 backdrop-blur-sm z-20">
          <Loader2 className="animate-spin text-accent-primary" size={24} />
        </div>
      )}
      <video 
        ref={videoRef}
        src={src} 
        playsInline 
        preload="metadata" // טוען את הפריים הראשון מראש
        controls={isPlaying} // מציג פקדים מקוריים של המכשיר רק אחרי שהתחיל לנגן
        className="w-full h-full object-cover z-0"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onLoadedMetadata={() => setLoading(false)} // מסיר את הטעינה כשהוידאו מוכן
      />
      
      {/* שכבת זכוכית (Glassmorphism) שמגנה על הגלילה */}
      {!isPlaying && !loading && (
        <div 
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[2px] cursor-pointer active:scale-95 transition-transform"
          onClick={togglePlay}
        >
          <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-2xl transition-all duration-300 group-hover:bg-white/15">
            <Play size={40} className="text-white fill-white ml-2" />
          </div>
        </div>
      )}
    </div>
  );
};

export const VaultCard = ({ vault, onUnlockSuccess }: { vault: Vault, onUnlockSuccess: () => void }) => {
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // לניהול תצוגת התוכן הפתוח

  const handleUnlock = async () => {
    triggerFeedback('pop');
    setIsUnlocking(true);
    const tid = toast.loading('פותח את הכספת...');

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) throw new Error('יש להתחבר תחילה');

      if (vault.unlock_type === 'gift' && vault.unlock_gift_crd) {
        const { data: profile } = await supabase.from('profiles').select('crd_balance').eq('id', user.id).single();
        if (!profile || profile.crd_balance < vault.unlock_gift_crd) {
          throw new Error('אין לך מספיק CRD בארנק');
        }
        await supabase.from('profiles').update({ crd_balance: profile.crd_balance - vault.unlock_gift_crd }).eq('id', user.id);
      }

      const { error } = await supabase.from('vault_unlocks').insert({
        vault_id: vault.id,
        user_id: user.id,
        unlock_type: vault.unlock_type,
        crd_paid: vault.unlock_type === 'gift' ? vault.unlock_gift_crd : 0
      });

      if (error && error.code !== '23505') throw error; 

      triggerFeedback('success');
      toast.success('הכספת נפתחה בהצלחה!', { id: tid });
      onUnlockSuccess(); 
    } catch (err: any) {
      triggerFeedback('error');
      toast.error(err.message || 'שגיאה בפתיחת הכספת', { id: tid });
    } finally {
      setIsUnlocking(false);
    }
  };

  const renderUnlockCondition = () => {
    switch (vault.unlock_type) {
      case 'gift':
        return (
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest opacity-80">מחיר פתיחה</span>
            <div className="flex items-center gap-1.5 bg-amber-400/10 px-5 py-2 rounded-full border border-amber-400/20 shadow-inner">
              <Coins size={14} className="text-amber-400" />
              <span className="font-black text-amber-400">{vault.unlock_gift_crd} CRD</span>
            </div>
          </div>
        );
      case 'tier':
        return (
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-bold text-accent-primary uppercase tracking-widest opacity-80">דרושה גישת CORE</span>
            <div className="flex items-center gap-1.5 bg-accent-primary/10 px-5 py-2 rounded-full border border-accent-primary/20 shadow-inner">
              <Crown size={14} className="text-accent-primary" />
              <span className="font-black text-accent-primary">בלעדי לחברי ליבה</span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative w-full rounded-[36px] overflow-hidden bg-surface-card border border-surface-border shadow-xl mb-4" dir="rtl">
      
      {/* 🔝 TEASER GRADIENT & IMAGE */}
      <div className="relative h-[220px] w-full flex items-center justify-center overflow-hidden bg-neutral-900">
        {vault.teaser_blur_url ? (
          <>
            <img src={vault.teaser_blur_url} className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-60 scale-125" alt="Teaser" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-card via-transparent to-surface-card/90" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand/5 to-accent-primary/15" />
        )}

        {/* Status Badge */}
        <div className="absolute top-5 left-5 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
          <Shield size={14} className="text-white/70" />
          <span className="text-[11px] font-black text-white uppercase tracking-widest">תוכן נעול</span>
        </div>

        {/* Central Lock Icon & Condition */}
        <div className="relative z-10 flex flex-col items-center gap-5 p-6 text-center">
          <div className="w-18 h-18 rounded-[24px] bg-surface/80 backdrop-blur-2xl border border-white/10 flex items-center justify-center shadow-2xl">
            {vault.is_unlocked ? <Unlock size={32} className="text-emerald-400" /> : <Lock size={32} className="text-brand-muted" />}
          </div>
          
          <div className="space-y-1.5">
            <h3 className="text-xl font-black text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">{vault.title || 'כספת נעולה'}</h3>
            {vault.teaser && <p className="text-[13px] text-white/70 font-medium max-w-[260px] leading-relaxed mx-auto">{vault.teaser}</p>}
          </div>

          {!vault.is_unlocked && renderUnlockCondition()}
        </div>
      </div>

      {/* 🕹️ ACTION BAR */}
      <div className="p-6 bg-surface-card flex items-center justify-between border-t border-surface-border gap-4">
        <div className="flex flex-col text-right">
          <span className="text-[10px] font-bold text-brand-muted uppercase tracking-widest opacity-80">סטטוס כספת</span>
          <span className={`text-[15px] font-black ${vault.is_unlocked ? 'text-emerald-400' : 'text-brand'}`}>
            {vault.is_unlocked ? 'זמין עבורך' : 'ממתין לפתיחה'}
          </span>
        </div>

        {!vault.is_unlocked ? (
          <Button 
            onClick={handleUnlock} 
            disabled={isUnlocking}
            className="h-14 px-8 rounded-full bg-white text-black font-black text-[13px] uppercase tracking-widest active:scale-95 shadow-lg flex items-center gap-2 transition-transform"
          >
            {isUnlocking ? <Loader2 size={18} className="animate-spin text-black" /> : <><Unlock size={18} /> פתח עכשיו</>}
          </Button>
        ) : (
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-14 px-6 rounded-full bg-surface text-brand border border-surface-border font-black text-[13px] uppercase tracking-widest flex items-center gap-2 active:scale-95 shadow-md"
          >
            {isExpanded ? <ChevronUp size={18} className="text-accent-primary"/> : <ChevronDown size={18}/>}
            צפה בתוכן
          </button>
        )}
      </div>

      {/* 📄 UNLOCKED CONTENT */}
      <AnimatePresence>
        {vault.is_unlocked && isExpanded && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="p-6 border-t border-surface-border bg-surface text-brand font-medium leading-relaxed text-sm overflow-hidden"
          >
            {vault.content_text && <p className="mb-4 whitespace-pre-wrap leading-relaxed">{vault.content_text}</p>}
            
            {vault.content_media_urls?.length > 0 && (
              <div className="flex flex-col gap-3">
                {vault.content_media_urls.map((url: string, i: number) => {
                  const isVideo = vault.content_type === 'video' || url.match(/\.(mp4|webm|mov)$/i);
                  return isVideo ? (
                    <VaultVideoPlayer key={i} src={url} />
                  ) : (
                    <img 
                      key={i} 
                      src={url} 
                      className="rounded-3xl w-full max-h-[350px] object-cover border border-surface-border mt-3 shadow-inner" 
                      alt="Vault Content" 
                    />
                  );
                })}
              </div>
            )}

            {vault.content_link && (
               <a href={vault.content_link} target="_blank" rel="noreferrer" className="mt-5 block text-center bg-accent-primary/10 text-accent-primary py-4 rounded-full border border-accent-primary/20 font-black text-[13px] uppercase tracking-widest active:scale-95 transition-all shadow-md">
                 מעבר לקישור מצורף
               </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
