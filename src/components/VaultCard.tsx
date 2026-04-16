import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, Unlock, Coins, Shield, Crown, Loader2, 
  Play, X, Maximize2, Download, CheckCircle2 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { Vault } from '../types';
import { Button } from './ui';

// 🎬 נגן קולנוע במשרה מלאה - פותר את כל בעיות התצוגה
const FullscreenMediaViewer = ({ url, type, onClose }: { url: string, type: string, onClose: () => void }) => {
  const isVideo = type === 'video' || url.match(/\.(mp4|webm|mov)$/i);
  
  return createPortal(
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4"
    >
      {/* כפתור סגירה מהודר */}
      <button 
        onClick={onClose}
        className="absolute top-8 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white border border-white/10 z-50 active:scale-90 transition-all"
      >
        <X size={24} />
      </button>

      <div className="w-full max-w-4xl h-full flex items-center justify-center relative">
        {isVideo ? (
          <video 
            src={url} 
            controls 
            autoPlay 
            playsInline
            className="w-full max-h-[85vh] rounded-2xl shadow-2xl border border-white/5"
          />
        ) : (
          <img 
            src={url} 
            className="w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl" 
            alt="Vault Content" 
          />
        )}
      </div>

      {/* כותרת תחתונה */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center">
        <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-full flex items-center gap-3">
          <Shield size={16} className="text-accent-primary" />
          <span className="text-white/60 text-xs font-black uppercase tracking-widest">תוכן כספת מאובטח</span>
        </div>
      </div>
    </motion.div>,
    document.body
  );
};

export const VaultCard = ({ vault, onUnlockSuccess }: { vault: Vault, onUnlockSuccess: () => void }) => {
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

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
          throw new Error('אין מספיק CRD בארנק');
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
      toast.success('הכספת נפתחה!', { id: tid });
      onUnlockSuccess(); 
    } catch (err: any) {
      triggerFeedback('error');
      toast.error(err.message || 'שגיאה בפתיחת הכספת', { id: tid });
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div className="relative w-full rounded-[40px] overflow-hidden bg-surface-card border border-surface-border shadow-2xl mb-6" dir="rtl">
      
      {/* 🖼️ תצוגת טיזר (מה שרואים לפני פתיחה) */}
      <div className="relative h-[240px] w-full flex items-center justify-center overflow-hidden">
        {vault.teaser_blur_url ? (
          <img src={vault.teaser_blur_url} className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-125" alt="" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand/10 to-accent-primary/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-card via-transparent to-surface-card/60" />

        {/* סטטוס נעילה מרכזי */}
        <div className="relative z-10 flex flex-col items-center gap-4 text-center p-6">
          <div className="w-20 h-20 rounded-[28px] bg-surface/80 backdrop-blur-2xl border border-white/10 flex items-center justify-center shadow-2xl">
            {vault.is_unlocked ? (
              <Unlock size={36} className="text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
            ) : (
              <Lock size={36} className="text-brand-muted" />
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-black text-white">{vault.title || 'כספת נעולה'}</h3>
            {vault.teaser && <p className="text-sm text-white/50 font-medium px-4">{vault.teaser}</p>}
          </div>
        </div>
      </div>

      {/* 🕹️ אזור הפעולה (הכפתור למטה) */}
      <div className="p-6 bg-surface-card border-t border-surface-border flex items-center justify-between gap-4">
        <div className="flex flex-col text-right">
          <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.2em] opacity-60">סטטוס</span>
          <span className={`text-[14px] font-black ${vault.is_unlocked ? 'text-emerald-400' : 'text-brand'}`}>
            {vault.is_unlocked ? 'התוכן זמין' : 'ממתין לשחרור'}
          </span>
        </div>

        {!vault.is_unlocked ? (
          <Button 
            onClick={handleUnlock} 
            disabled={isUnlocking}
            className="h-14 px-8 rounded-full bg-white text-black font-black text-[13px] uppercase tracking-widest active:scale-95 shadow-xl flex items-center gap-2"
          >
            {isUnlocking ? <Loader2 className="animate-spin" size={18} /> : <><Unlock size={18} /> פתח כספת</>}
          </Button>
        ) : (
          <button 
            onClick={() => {
              if (vault.content_media_urls?.[0]) {
                triggerFeedback('pop');
                setViewerUrl(vault.content_media_urls[0]);
              } else {
                toast.success('התוכן הוא טקסט בלבד');
              }
            }}
            className="h-14 px-8 rounded-full bg-accent-primary text-black font-black text-[13px] uppercase tracking-widest flex items-center gap-2 active:scale-95 shadow-[0_0_20px_rgba(var(--color-accent-primary),0.3)] transition-all"
          >
            <Play size={18} fill="black" /> נגן תוכן
          </button>
        )}
      </div>

      {/* אם יש טקסט חופשי שנחשף מתחת לכפתור */}
      {vault.is_unlocked && vault.content_text && (
        <div className="px-8 pb-8 pt-2">
          <p className="text-sm text-brand/80 leading-relaxed bg-surface/50 p-4 rounded-2xl border border-surface-border">
            {vault.content_text}
          </p>
        </div>
      )}

      {/* הנגן הסינמטי - מופיע רק כשלוחצים על נגן תוכן */}
      <AnimatePresence>
        {viewerUrl && (
          <FullscreenMediaViewer 
            url={viewerUrl} 
            type={vault.content_type} 
            onClose={() => setViewerUrl(null)} 
          />
        )}
      </AnimatePresence>

    </div>
  );
};
