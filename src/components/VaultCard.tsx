import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Unlock, Clock, Users, Coins, Shield, Crown, Loader2, Play } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';
import { Vault } from '../types';
import { Button } from './ui';

export const VaultCard = ({ vault, onUnlockSuccess }: { vault: Vault, onUnlockSuccess: () => void }) => {
  const [isUnlocking, setIsUnlocking] = useState(false);

  const handleUnlock = async () => {
    triggerFeedback('pop');
    setIsUnlocking(true);
    const tid = toast.loading('פותח את הכספת...');

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) throw new Error('משתמש לא מחובר');

      // אם זו כספת בתשלום - נוריד CRD מהארנק
      if (vault.unlock_type === 'gift' && vault.unlock_gift_crd) {
        const { data: profile } = await supabase.from('profiles').select('crd_balance').eq('id', user.id).single();
        if (!profile || profile.crd_balance < vault.unlock_gift_crd) {
          throw new Error('אין מספיק CRD בארנק');
        }
        await supabase.from('profiles').update({ crd_balance: profile.crd_balance - vault.unlock_gift_crd }).eq('id', user.id);
      }

      // הוספת רישום פתיחה
      const { error } = await supabase.from('vault_unlocks').insert({
        vault_id: vault.id,
        user_id: user.id,
        unlock_type: vault.unlock_type,
        crd_paid: vault.unlock_type === 'gift' ? vault.unlock_gift_crd : 0
      });

      if (error && error.code !== '23505') throw error; // מתעלם משגיאת "כבר קיים"

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
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">מחיר פתיחה</span>
            <div className="flex items-center gap-1.5 bg-amber-400/10 px-4 py-1.5 rounded-full border border-amber-400/20">
              <Coins size={14} className="text-amber-400" />
              <span className="font-black text-amber-400">{vault.unlock_gift_crd} CRD</span>
            </div>
          </div>
        );
      case 'tier':
        return (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold text-accent-primary uppercase tracking-widest">דרושה גישת CORE</span>
            <div className="flex items-center gap-1.5 bg-accent-primary/10 px-4 py-1.5 rounded-full border border-accent-primary/20">
              <Crown size={14} className="text-accent-primary" />
              <span className="font-black text-accent-primary">בלעדי לחברי ליבה</span>
            </div>
          </div>
        );
      case 'time':
        if(!vault.unlock_at) return null;
        const unlockDate = new Date(vault.unlock_at);
        const isTimePassed = unlockDate <= new Date();
        return (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">זמן פתיחה</span>
            <div className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full border ${isTimePassed ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400' : 'bg-blue-400/10 border-blue-400/20 text-blue-400'}`}>
              <Clock size={14} />
              <span className="font-black text-[12px]" dir="ltr">
                {isTimePassed ? 'פתוח כעת' : unlockDate.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        );
      case 'members':
        return (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-widest">יעד קהילה</span>
            <div className="flex items-center gap-1.5 bg-fuchsia-400/10 px-4 py-1.5 rounded-full border border-fuchsia-400/20">
              <Users size={14} className="text-fuchsia-400" />
              <span className="font-black text-fuchsia-400">ייפתח ב-{vault.unlock_members} חברים</span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative w-full rounded-[32px] overflow-hidden bg-surface-card border border-surface-border shadow-lg" dir="rtl">
      
      {/* Teaser Background / Blur */}
      <div className="relative h-[250px] w-full flex items-center justify-center overflow-hidden bg-neutral-900">
        {vault.teaser_blur_url ? (
          <>
            <img src={vault.teaser_blur_url} className="absolute inset-0 w-full h-full object-cover blur-xl opacity-50 scale-110" alt="Teaser" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-card via-transparent to-surface-card/80" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand/5 to-accent-primary/10" />
        )}

        {/* Status Badge */}
        <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2">
          <Shield size={14} className="text-white/70" />
          <span className="text-[10px] font-black text-white uppercase tracking-widest">תוכן נעול</span>
        </div>

        {/* Central Lock Icon & Condition */}
        <div className="relative z-10 flex flex-col items-center gap-4 p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface/80 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl">
            {vault.is_unlocked ? <Unlock size={28} className="text-emerald-400" /> : <Lock size={28} className="text-brand-muted" />}
          </div>
          
          <div className="space-y-1">
            <h3 className="text-lg font-black text-white drop-shadow-md">{vault.title}</h3>
            {vault.teaser && <p className="text-xs text-white/70 font-medium max-w-[240px] leading-relaxed mx-auto">{vault.teaser}</p>}
          </div>

          {!vault.is_unlocked && renderUnlockCondition()}
        </div>
      </div>

      {/* Action Area */}
      <div className="p-5 bg-surface-card flex items-center justify-between border-t border-surface-border">
        <div className="flex flex-col text-right">
          <span className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">סטטוס כספת</span>
          <span className={`text-[13px] font-black ${vault.is_unlocked ? 'text-emerald-400' : 'text-brand'}`}>
            {vault.is_unlocked ? 'זמין עבורך' : 'ממתין לפתיחה'}
          </span>
        </div>

        {!vault.is_unlocked ? (
          <Button 
            onClick={handleUnlock} 
            disabled={isUnlocking || (vault.unlock_type === 'time' && vault.unlock_at && new Date(vault.unlock_at) > new Date())}
            className="h-12 px-6 rounded-full bg-white text-black font-black text-[11px] uppercase tracking-widest active:scale-95 shadow-md flex items-center gap-2"
          >
            {isUnlocking ? <Loader2 size={16} className="animate-spin text-black" /> : <><Unlock size={16} /> פתח עכשיו</>}
          </Button>
        ) : (
          <Button className="h-12 px-6 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 font-black text-[11px] uppercase tracking-widest flex items-center gap-2 pointer-events-none">
            <Play size={16} className="fill-emerald-400" /> צפה בתוכן
          </Button>
        )}
      </div>

      {/* Actual Content (Shown only if unlocked) */}
      <AnimatePresence>
        {vault.is_unlocked && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            className="p-6 border-t border-surface-border bg-surface text-brand font-medium leading-relaxed text-sm"
          >
            {vault.content_text && <p className="mb-4 whitespace-pre-wrap">{vault.content_text}</p>}
            
            {vault.content_media_urls?.length > 0 && (
              <div className={`grid gap-2 ${vault.content_media_urls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {vault.content_media_urls.map((url: string, i: number) => (
                  <img key={i} src={url} className="rounded-xl w-full h-40 object-cover border border-surface-border" alt="Vault Content" />
                ))}
              </div>
            )}

            {vault.content_link && (
               <a href={vault.content_link} target="_blank" rel="noreferrer" className="mt-4 block text-center bg-accent-primary/10 text-accent-primary py-3 rounded-xl border border-accent-primary/20 font-black text-xs uppercase tracking-widest active:scale-95 transition-transform">
                 מעבר לקישור מצורף
               </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
