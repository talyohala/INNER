import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, Unlock, Coins, Shield, Crown, Loader2, 
  Play, X, ChevronDown, Clock, Users 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { Vault } from '../types';
import { Button } from './ui';

// 🎬 נגן קולנוע פרימיום - תומך בגרירה לסגירה ועיצוב Native
const FullscreenMediaViewer = ({ url, type, title, onClose }: { url: string, type: string, title: string, onClose: () => void }) => {
  const isVideo = type === 'video' || url.match(/\.(mp4|webm|mov)$/i);
  
  return createPortal(
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-3xl flex flex-col"
        dir="rtl"
      >
        {/* בר עליון סינמטי */}
        <div className="flex items-center justify-between p-6 pt-[env(safe-area-inset-top,32px)] shrink-0 z-50 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex flex-col">
            <span className="text-accent-primary text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <Shield size={12} /> כספת מאובטחת
            </span>
            <h2 className="text-white font-black text-lg drop-shadow-md leading-tight max-w-[250px] truncate">{title || 'תוכן סודי'}</h2>
          </div>
          <button 
            onClick={() => { triggerFeedback('pop'); onClose(); }}
            className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white border border-white/10 backdrop-blur-md active:scale-90 transition-all"
          >
            <X size={24} />
          </button>
        </div>

        {/* אזור המדיה עם מחוות גרירה (Swipe down to close) */}
        <motion.div 
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          onDragEnd={(e, info) => { if (Math.abs(info.offset.y) > 100) { triggerFeedback('pop'); onClose(); } }}
          className="flex-1 w-full flex items-center justify-center relative px-2 overflow-hidden cursor-grab active:cursor-grabbing"
        >
          {isVideo ? (
            <video 
              src={url} 
              controls 
              autoPlay 
              playsInline
              className="w-full max-h-[75vh] rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 bg-black"
            />
          ) : (
            <img 
              src={url} 
              className="w-full max-h-[75vh] object-contain rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.5)]" 
              alt="Vault Content" 
              draggable="false"
            />
          )}
        </motion.div>

        {/* אינדיקטור גרירה תחתון */}
        <div className="p-6 shrink-0 flex justify-center pb-[env(safe-area-inset-bottom,32px)] opacity-50">
          <span className="text-white/60 text-[11px] font-bold tracking-widest flex items-center gap-2">
            <ChevronDown size={14} className="animate-bounce" /> החלק למטה לסגירה
          </span>
        </div>
      </motion.div>
    </AnimatePresence>,
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

  const renderUnlockCondition = () => {
    switch (vault.unlock_type) {
      case 'gift':
        return (
          <div className="flex items-center gap-2 bg-amber-400/10 px-5 py-2.5 rounded-full border border-amber-400/20 backdrop-blur-md">
            <Coins size={16} className="text-amber-400" />
            <span className="font-black text-amber-400 text-[13px]">{vault.unlock_gift_crd} CRD</span>
          </div>
        );
      case 'tier':
        return (
          <div className="flex items-center gap-2 bg-accent-primary/10 px-5 py-2.5 rounded-full border border-accent-primary/20 backdrop-blur-md">
            <Crown size={16} className="text-accent-primary" />
            <span className="font-black text-accent-primary text-[13px]">חברי CORE</span>
          </div>
        );
      case 'time':
        return (
          <div className="flex items-center gap-2 bg-blue-400/10 px-5 py-2.5 rounded-full border border-blue-400/20 backdrop-blur-md">
            <Clock size={16} className="text-blue-400" />
            <span className="font-black text-blue-400 text-[13px]">תלוי זמן</span>
          </div>
        );
      case 'members':
        return (
          <div className="flex items-center gap-2 bg-fuchsia-400/10 px-5 py-2.5 rounded-full border border-fuchsia-400/20 backdrop-blur-md">
            <Users size={16} className="text-fuchsia-400" />
            <span className="font-black text-fuchsia-400 text-[13px]">יעד חברים</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative w-full rounded-[40px] overflow-hidden bg-surface-card border border-surface-border shadow-2xl mb-6" dir="rtl">
      
      {/* 🖼️ תצוגת טיזר */}
      <div className="relative h-[260px] w-full flex items-center justify-center overflow-hidden">
        {vault.teaser_blur_url ? (
          <img src={vault.teaser_blur_url} className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-50 scale-125" alt="" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand/5 to-accent-primary/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-card via-transparent to-surface-card/60" />

        {/* תגית עליונה */}
        <div className="absolute top-5 right-5 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
          <Shield size={14} className="text-white/80" />
          <span className="text-[10px] font-black text-white/90 uppercase tracking-widest">
            {vault.is_unlocked ? 'כספת פתוחה' : 'תוכן נעול'}
          </span>
        </div>

        {/* תוכן מרכזי בכרטיס */}
        <div className="relative z-10 flex flex-col items-center gap-5 text-center p-6 w-full">
          <div className={`w-20 h-20 rounded-full backdrop-blur-2xl border flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all ${vault.is_unlocked ? 'bg-emerald-400/10 border-emerald-400/30' : 'bg-surface/80 border-white/10'}`}>
            {vault.is_unlocked ? (
              <Unlock size={36} className="text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.6)]" />
            ) : (
              <Lock size={36} className="text-brand-muted" />
            )}
          </div>
          
          <div className="space-y-2 w-full px-4">
            <h3 className="text-xl font-black text-white truncate">{vault.title || 'כספת נעולה'}</h3>
            {!vault.is_unlocked && renderUnlockCondition()}
            {vault.is_unlocked && vault.teaser && (
              <p className="text-sm text-white/60 font-medium px-4 line-clamp-2">{vault.teaser}</p>
            )}
          </div>
        </div>
      </div>

      {/* 📄 טקסט סודי (אם יש) - מופיע יפה בתוך הכרטיס */}
      {vault.is_unlocked && vault.content_text && (
        <div className="px-6 pb-2 pt-2 bg-surface-card">
          <div className="bg-surface/50 p-5 rounded-[28px] border border-white/5 shadow-inner">
            <p className="text-[14px] text-brand/90 leading-relaxed font-medium whitespace-pre-wrap">
              {vault.content_text}
            </p>
          </div>
        </div>
      )}

      {/* 🕹️ אזור הפעולה (הכפתור) */}
      <div className="p-6 bg-surface-card flex items-center justify-between gap-4">
        {!vault.is_unlocked ? (
          <>
            <div className="flex flex-col text-right">
              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.2em] opacity-80">פעולה נדרשת</span>
              <span className="text-[14px] font-black text-brand">שחרר תוכן</span>
            </div>
            <Button 
              onClick={handleUnlock} 
              disabled={isUnlocking}
              className="h-14 px-8 rounded-full bg-white text-black font-black text-[13px] uppercase tracking-widest active:scale-95 shadow-[0_10px_20px_rgba(255,255,255,0.15)] flex items-center gap-2"
            >
              {isUnlocking ? <Loader2 className="animate-spin" size={18} /> : <><Unlock size={18} /> פתח כספת</>}
            </Button>
          </>
        ) : (
          <button 
            onClick={() => {
              if (vault.content_media_urls?.[0]) {
                triggerFeedback('pop');
                setViewerUrl(vault.content_media_urls[0]);
              } else {
                toast.success('אין מדיה מצורפת לכספת זו');
              }
            }}
            disabled={!vault.content_media_urls?.[0]}
            className="w-full h-16 rounded-full bg-gradient-to-r from-accent-primary to-emerald-400 text-black font-black text-[14px] uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 shadow-[0_10px_30px_rgba(var(--color-accent-primary),0.4)] transition-all disabled:opacity-50 disabled:grayscale"
          >
            <Play size={20} fill="black" /> 
            {vault.content_media_urls?.[0] ? 'צפה במדיה מלאה' : 'טקסט בלבד'}
          </button>
        )}
      </div>

      {/* הרצת הנגן הסינמטי במסך מלא (אם נלחץ) */}
      {viewerUrl && (
        <FullscreenMediaViewer 
          url={viewerUrl} 
          type={vault.content_type} 
          title={vault.title}
          onClose={() => setViewerUrl(null)} 
        />
      )}

    </div>
  );
};
