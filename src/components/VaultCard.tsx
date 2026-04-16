import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, Unlock, Coins, Shield, Crown, Loader2, 
  Play, X, Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { Vault } from '../types';
import { Button } from './ui';

// 📝 בוטום שיט (Bottom Sheet) - סגירה בהחלקה או בלחיצה על הרקע
const DescriptionSheet = ({ title, text, onClose }: { title: string, text: string, onClose: () => void }) => (
  <div className="fixed inset-0 z-[1000000] flex flex-col justify-end">
    {/* רקע שקוף שסוגר בלחיצה */}
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={() => { triggerFeedback('pop'); onClose(); }}
      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
    />
    
    {/* המגירה עצמה - גרירה למטה לסגירה */}
    <motion.div 
      drag="y"
      dragConstraints={{ top: 0 }}
      dragElastic={0.2}
      onDragEnd={(_, info) => { if (info.offset.y > 100) { triggerFeedback('pop'); onClose(); } }}
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="relative z-10 bg-[#1a1a1a] rounded-t-[40px] p-8 pb-16 border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] cursor-grab active:cursor-grabbing"
      dir="rtl"
    >
      <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-8" />
      <h3 className="text-2xl font-black text-white mb-6 px-2">{title}</h3>
      <div className="max-h-[50vh] overflow-y-auto px-2 custom-scrollbar">
        <p className="text-white/80 text-lg leading-relaxed whitespace-pre-wrap font-medium pb-4">
          {text}
        </p>
      </div>
    </motion.div>
  </div>
);

// 🎬 נגן קולנוע - נקי ומהיר
const FullscreenVaultViewer = ({ vault, onClose }: { vault: Vault, onClose: () => void }) => {
  const [showSheet, setShowSheet] = useState(false);
  const isVideo = vault.content_type === 'video' || vault.content_media_urls?.[0]?.match(/\.(mp4|webm|mov)$/i);
  const mediaUrl = vault.content_media_urls?.[0];

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black overflow-hidden flex flex-col" dir="rtl">
      {/* כפתור איקס משופר */}
      <div 
        onClick={(e) => { e.stopPropagation(); triggerFeedback('pop'); onClose(); }}
        className="fixed top-[env(safe-area-inset-top,24px)] left-4 z-[999999] p-4 cursor-pointer group"
      >
        <X size={36} className="text-white/80 group-hover:text-white transition-colors drop-shadow-2xl" />
      </div>

      <div className="relative w-full h-full flex items-center justify-center bg-black">
        {mediaUrl ? (
          isVideo ? (
            <video src={mediaUrl} controls autoPlay playsInline className="w-full h-full object-contain" />
          ) : (
            <img src={mediaUrl} className="w-full h-full object-contain" alt="" />
          )
        ) : (
          <div className="text-center p-10">
            <Shield size={64} className="text-white/10 mx-auto mb-4" />
            <h2 className="text-white/30 font-black text-xl">תוכן טקסטואלי</h2>
          </div>
        )}

        {/* בר מידע תחתון */}
        <div className="absolute bottom-0 left-0 right-0 p-8 pt-32 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none">
          <div className="flex items-end justify-between pointer-events-auto">
            <div className="flex flex-col gap-1 cursor-pointer group" onClick={() => vault.content_text && setShowSheet(true)}>
              <span className="text-accent-primary text-[10px] font-black uppercase tracking-[0.3em] mb-2 opacity-80">INNER VAULT</span>
              <h2 className="text-white font-black text-3xl drop-shadow-2xl line-clamp-1 group-active:opacity-70 transition-opacity">{vault.title}</h2>
              {vault.content_text && (
                <div className="flex items-center gap-2 text-white/50 text-[13px] mt-2 font-bold bg-white/5 w-fit px-3 py-1 rounded-full border border-white/5">
                  <Info size={14} /> לחץ לפרטים נוספים
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showSheet && vault.content_text && (
          <DescriptionSheet title={vault.title} text={vault.content_text} onClose={() => setShowSheet(false)} />
        )}
      </AnimatePresence>
    </div>,
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
      if (!user) throw new Error('התחבר תחילה');

      if (vault.unlock_type === 'gift' && vault.unlock_gift_crd) {
        const { data: profile } = await supabase.from('profiles').select('crd_balance').eq('id', user.id).single();
        if (!profile || profile.crd_balance < vault.unlock_gift_crd) throw new Error('אין מספיק CRD');
        await supabase.from('profiles').update({ crd_balance: profile.crd_balance - vault.unlock_gift_crd }).eq('id', user.id);
      }

      await supabase.from('vault_unlocks').insert({ vault_id: vault.id, user_id: user.id, unlock_type: vault.unlock_type });

      triggerFeedback('success');
      toast.success('הכספת נפתחה!', { id: tid });
      onUnlockSuccess(); 
    } catch (err: any) {
      triggerFeedback('error');
      toast.error(err.message || 'שגיאה');
    } finally {
      setIsUnlocking(false);
    }
  };

  const isVideo = vault.content_type === 'video' || vault.content_media_urls?.[0]?.match(/\.(mp4|webm|mov)$/i);

  return (
    <div 
      className={`relative w-full h-[280px] rounded-[40px] overflow-hidden bg-surface-card border border-surface-border mb-6 shadow-2xl transition-all ${vault.is_unlocked ? 'cursor-pointer active:scale-[0.97]' : ''}`} 
      onClick={() => { if (vault.is_unlocked) { triggerFeedback('pop'); setShowFullscreen(true); } }}
    >
      <div className="absolute inset-0 bg-neutral-900 pointer-events-none">
        {vault.is_unlocked && vault.content_media_urls?.[0] ? (
          isVideo ? <video src={vault.content_media_urls[0]} autoPlay muted loop playsInline className="w-full h-full object-cover opacity-60" /> : <img src={vault.content_media_urls[0]} className="w-full h-full object-cover opacity-60" alt="" />
        ) : (
          <img src={vault.teaser_blur_url || ''} className={`w-full h-full object-cover ${!vault.is_unlocked ? 'blur-2xl scale-125 opacity-40' : 'opacity-60'}`} alt="" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      </div>

      <div className="absolute top-5 right-5 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full flex items-center gap-2 z-10 shadow-lg">
        {vault.is_unlocked ? <Unlock size={14} className="text-emerald-400" /> : <Shield size={14} className="text-white/70" />}
        <span className={`text-[11px] font-black uppercase tracking-widest ${vault.is_unlocked ? 'text-emerald-400' : 'text-white'}`}>
          {vault.is_unlocked ? 'גישה פתוחה' : 'תוכן נעול'}
        </span>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 pointer-events-none">
        {vault.is_unlocked ? (
          <div className="w-20 h-20 rounded-full bg-accent-primary flex items-center justify-center shadow-[0_0_40px_rgba(var(--color-accent-primary),0.5)] mb-4">
            <Play size={28} fill="white" className="text-white ml-1.5" />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-[32px] bg-surface/80 backdrop-blur-xl border border-white/10 flex items-center justify-center mb-4 shadow-2xl">
            <Lock size={32} className="text-brand-muted" />
          </div>
        )}
        <h3 className="text-2xl font-black text-white drop-shadow-2xl line-clamp-1 px-4">{vault.title}</h3>
      </div>

      {!vault.is_unlocked && (
        <div className="absolute bottom-0 left-0 right-0 p-5 z-20">
          <Button onClick={handleUnlock} disabled={isUnlocking} className="w-full h-16 rounded-[24px] bg-white text-black font-black text-[14px] uppercase tracking-widest shadow-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
            {isUnlocking ? <Loader2 size={20} className="animate-spin" /> : <><Unlock size={20} /> שחרר כספת</>}
          </Button>
        </div>
      )}

      {showFullscreen && <FullscreenVaultViewer vault={vault} onClose={() => setShowFullscreen(false)} />}
    </div>
  );
};
