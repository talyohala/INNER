import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, Unlock, Coins, Shield, Crown, Loader2, 
  Play, X, ChevronDown, Clock, Users, Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { Vault } from '../types';
import { Button } from './ui';

// 🎬 הנגן המלא (נפתח רק בלחיצה)
const FullscreenMediaViewer = ({ url, type, title, onClose }: { url: string, type: string, title: string, onClose: () => void }) => {
  const isVideo = type === 'video' || url.match(/\.(mp4|webm|mov)$/i);
  
  return createPortal(
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[99999] bg-black/98 backdrop-blur-2xl flex flex-col"
      dir="rtl"
    >
      <button 
        onClick={onClose}
        className="fixed top-8 left-6 z-[999999] p-2 text-white/70 hover:text-white active:scale-90 transition-transform"
      >
        <X size={32} />
      </button>

      <div className="flex-1 w-full flex items-center justify-center p-4">
        {isVideo ? (
          <video src={url} controls autoPlay playsInline className="w-full max-h-[85vh] object-contain rounded-xl shadow-2xl bg-black" />
        ) : (
          <img src={url} className="w-full h-auto max-h-[85vh] object-contain rounded-xl shadow-2xl" alt="" />
        )}
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
    const tid = toast.loading('משחרר כספת...');

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) throw new Error('יש להתחבר תחילה');

      if (vault.unlock_type === 'gift' && vault.unlock_gift_crd) {
        const { data: profile } = await supabase.from('profiles').select('crd_balance').eq('id', user.id).single();
        if (!profile || profile.crd_balance < vault.unlock_gift_crd) throw new Error('אין מספיק CRD בארנק');
        await supabase.from('profiles').update({ crd_balance: profile.crd_balance - vault.unlock_gift_crd }).eq('id', user.id);
      }

      const { error } = await supabase.from('vault_unlocks').insert({
        vault_id: vault.id, user_id: user.id, unlock_type: vault.unlock_type,
        crd_paid: vault.unlock_type === 'gift' ? vault.unlock_gift_crd : 0
      });

      if (error && error.code !== '23505') throw error; 

      triggerFeedback('success');
      toast.success('נפתח!', { id: tid });
      onUnlockSuccess(); 
    } catch (err: any) {
      triggerFeedback('error');
      toast.error(err.message || 'שגיאה בפתיחה', { id: tid });
    } finally {
      setIsUnlocking(false);
    }
  };

  const isVideo = vault.content_type === 'video' || (vault.content_media_urls?.[0]?.match(/\.(mp4|webm|mov)$/i));

  return (
    <div className="relative w-full rounded-[32px] overflow-hidden bg-surface-card border border-surface-border mb-4 shadow-lg" dir="rtl">
      
      {/* 🔝 HEADER - מוקטן משמעותית */}
      <div className="relative h-[160px] w-full flex items-center justify-between px-6 overflow-hidden">
        {vault.teaser_blur_url ? (
          <img src={vault.teaser_blur_url} className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30 scale-125" alt="" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand/5 to-accent-primary/10" />
        )}
        
        <div className="relative z-10 flex items-center gap-4 flex-1">
          <div className={`w-14 h-14 rounded-2xl backdrop-blur-xl border flex items-center justify-center shrink-0 ${vault.is_unlocked ? 'bg-emerald-400/10 border-emerald-400/20' : 'bg-white/5 border-white/10'}`}>
            {vault.is_unlocked ? <Unlock size={24} className="text-emerald-400" /> : <Lock size={24} className="text-brand-muted" />}
          </div>
          <div className="flex flex-col truncate">
            <h3 className="text-base font-black text-white truncate">{vault.title || 'כספת'}</h3>
            <p className="text-[11px] text-white/50 font-bold uppercase tracking-wider">
              {vault.is_unlocked ? 'זמין לצפייה' : `נעול • ${vault.unlock_type === 'gift' ? vault.unlock_gift_crd + ' CRD' : 'CORE'}`}
            </p>
          </div>
        </div>

        {!vault.is_unlocked && (
          <button 
            onClick={handleUnlock} disabled={isUnlocking}
            className="relative z-10 h-10 px-5 rounded-full bg-white text-black font-black text-[11px] uppercase tracking-widest active:scale-95 transition-transform shrink-0"
          >
            {isUnlocking ? <Loader2 size={14} className="animate-spin" /> : 'פתח'}
          </button>
        )}
      </div>

      {/* 📄 CONTENT AREA (When Unlocked) */}
      <AnimatePresence>
        {vault.is_unlocked && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="px-6 pb-6 space-y-4">
            
            {vault.content_text && (
              <p className="text-sm text-brand/80 leading-relaxed bg-surface/40 p-4 rounded-2xl border border-white/5">
                {vault.content_text}
              </p>
            )}

            {/* תצוגה מקדימה בלחיצה - Preview שאינו תוקע גלילה */}
            {vault.content_media_urls?.[0] && (
              <div 
                onClick={() => { triggerFeedback('pop'); setViewerUrl(vault.content_media_urls[0]); }}
                className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 cursor-pointer group active:scale-[0.98] transition-transform"
              >
                {isVideo ? (
                  <video src={vault.content_media_urls[0]} muted playsInline className="w-full h-full object-cover opacity-60" />
                ) : (
                  <img src={vault.content_media_urls[0]} className="w-full h-full object-cover opacity-60" alt="" />
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                   <div className="w-12 h-12 rounded-full bg-accent-primary flex items-center justify-center shadow-lg shadow-accent-primary/20">
                     <Play size={20} fill="black" className="ml-1" />
                   </div>
                   <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">לחץ למסך מלא</span>
                </div>
              </div>
            )}
            
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cinematic Overlays */}
      {viewerUrl && (
        <FullscreenMediaViewer 
          url={viewerUrl} type={vault.content_type} title={vault.title}
          onClose={() => setViewerUrl(null)} 
        />
      )}
    </div>
  );
};
