import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, Unlock, Coins, Shield, Crown, Loader2, 
  Play, X, Clock, Users, FileText
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { Vault } from '../types';
import { Button } from './ui';

// 🎬 מסך מלא - כאן רואים את כל התוכן (טקסט + מדיה) בנוחות
const FullscreenVaultViewer = ({ vault, onClose }: { vault: Vault, onClose: () => void }) => {
  const isVideo = vault.content_type === 'video' || vault.content_media_urls?.[0]?.match(/\.(mp4|webm|mov)$/i);
  const mediaUrl = vault.content_media_urls?.[0];

  return createPortal(
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
        className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-3xl overflow-y-auto"
        dir="rtl"
      >
        {/* כפתור איקס שקוף ומרחף בצד שמאל למעלה */}
        <button 
          onClick={() => { triggerFeedback('pop'); onClose(); }}
          className="fixed top-6 left-4 z-[999999] p-3 text-white/70 hover:text-white active:scale-90 bg-black/20 rounded-full"
        >
          <X size={28} />
        </button>

        <div className="min-h-screen flex flex-col items-center py-20 px-4 max-w-2xl mx-auto gap-6">
          <div className="text-center space-y-2">
            <span className="text-accent-primary text-[10px] font-black uppercase tracking-widest bg-accent-primary/10 px-3 py-1 rounded-full"><Shield size={12} className="inline ml-1" /> כספת מאובטחת</span>
            <h2 className="text-white font-black text-2xl drop-shadow-md">{vault.title}</h2>
          </div>

          {mediaUrl && (
            <div className="w-full bg-surface-card border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              {isVideo ? (
                <video src={mediaUrl} controls autoPlay playsInline className="w-full max-h-[60vh] object-contain bg-black" />
              ) : (
                <img src={mediaUrl} className="w-full max-h-[60vh] object-contain" alt="Vault Content" />
              )}
            </div>
          )}

          {vault.content_text && (
            <div className="w-full bg-surface-card/50 border border-white/5 rounded-3xl p-6 text-right">
              <p className="text-white/90 text-[15px] leading-relaxed whitespace-pre-wrap">{vault.content_text}</p>
            </div>
          )}

          {vault.content_link && (
            <a href={vault.content_link} target="_blank" rel="noreferrer" className="w-full bg-accent-primary text-black py-4 rounded-2xl font-black text-[14px] uppercase tracking-widest text-center shadow-[0_0_20px_rgba(var(--color-accent-primary),0.4)] active:scale-95 transition-transform">
              מעבר לקישור
            </a>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export const VaultCard = ({ vault, onUnlockSuccess }: { vault: Vault, onUnlockSuccess: () => void }) => {
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);

  const handleUnlock = async (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerFeedback('pop');
    setIsUnlocking(true);
    const tid = toast.loading('משחרר כספת...');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('יש להתחבר תחילה');

      if (vault.unlock_type === 'gift' && vault.unlock_gift_crd) {
        const { data: profile } = await supabase.from('profiles').select('crd_balance').eq('id', user.id).single();
        if (!profile || profile.crd_balance < vault.unlock_gift_crd) throw new Error('אין מספיק CRD');
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

  // קובייה קבועה בגודל 280px. בלי גלילה פנימית.
  return (
    <div 
      className={`relative w-full h-[280px] rounded-[32px] overflow-hidden bg-surface-card border border-surface-border mb-4 shadow-xl ${vault.is_unlocked ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`} 
      dir="rtl"
      onClick={() => { if (vault.is_unlocked) { triggerFeedback('pop'); setShowFullscreen(true); } }}
    >
      {/* תמונת רקע (מטושטשת אם נעול, ברורה אם פתוח) */}
      <div className="absolute inset-0 w-full h-full bg-neutral-900">
        {vault.is_unlocked && vault.content_media_urls?.[0] ? (
          <img src={vault.content_media_urls[0]} className="w-full h-full object-cover opacity-60" alt="" />
        ) : vault.teaser_blur_url ? (
          <img src={vault.teaser_blur_url} className={`w-full h-full object-cover ${!vault.is_unlocked ? 'blur-2xl scale-125 opacity-40' : 'opacity-60'}`} alt="" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand/10 to-accent-primary/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
      </div>

      {/* תגית סטטוס עליונה */}
      <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2">
        {vault.is_unlocked ? <Unlock size={12} className="text-emerald-400" /> : <Shield size={12} className="text-white/70" />}
        <span className={`text-[10px] font-black uppercase tracking-widest ${vault.is_unlocked ? 'text-emerald-400' : 'text-white'}`}>
          {vault.is_unlocked ? 'פתוח עבורך' : 'תוכן נעול'}
        </span>
      </div>

      {/* תוכן מרכזי */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 pointer-events-none">
        {vault.is_unlocked ? (
          <div className="w-16 h-16 rounded-full bg-accent-primary/90 flex items-center justify-center shadow-[0_0_30px_rgba(var(--color-accent-primary),0.6)] mb-4">
            <Play size={24} fill="black" className="text-black ml-1" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-surface/80 backdrop-blur-xl border border-white/10 flex items-center justify-center mb-4 shadow-2xl">
            <Lock size={28} className="text-brand-muted" />
          </div>
        )}
        
        <h3 className="text-xl font-black text-white drop-shadow-lg line-clamp-1">{vault.title || 'כספת'}</h3>
        {!vault.is_unlocked && vault.teaser && <p className="text-xs text-white/60 font-medium mt-2 line-clamp-2">{vault.teaser}</p>}
      </div>

      {/* בר פעולה תחתון (מופיע רק כשנעול) */}
      {!vault.is_unlocked && (
        <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
          <Button 
            onClick={handleUnlock} disabled={isUnlocking}
            className="w-full h-14 rounded-[20px] bg-white text-black font-black text-[13px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"
          >
            {isUnlocking ? <Loader2 size={18} className="animate-spin" /> : (
              <>
                {vault.unlock_type === 'gift' ? <><Coins size={16}/> שחרר ב-{vault.unlock_gift_crd} CRD</> : 
                 vault.unlock_type === 'tier' ? <><Crown size={16}/> שחרר עם גישת CORE</> : 
                 <><Unlock size={16}/> שחרר כספת</>}
              </>
            )}
          </Button>
        </div>
      )}

      {/* טריגר למסך המלא (יופעל רק כשפתוח ונלחץ) */}
      {showFullscreen && <FullscreenVaultViewer vault={vault} onClose={() => setShowFullscreen(false)} />}
    </div>
  );
};
