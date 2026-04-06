import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Loader2,
  Image as ImageIcon,
  ShieldCheck,
  Lock,
  Unlock,
  Shield,
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { FadeIn, Input, Button } from '../components/ui';
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

      const compressedFile = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });

      const fileName = `circle_${Date.now()}`;
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, compressedFile);

      if (error) throw error;

      const { data: { publicUrl } } =
        supabase.storage.from('avatars').getPublicUrl(data.path);

      setCoverUrl(publicUrl);
      toast.success('התמונה מוכנה', { id: tid });
      triggerFeedback('success');
    } catch {
      toast.error('שגיאה בהעלאה');
      triggerFeedback('error');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error('תן שם למועדון');

    try {
      setSaving(true);

      const { data: auth } = await supabase.auth.getUser();

      const res = await apiFetch('/api/circles', {
        method: 'POST',
        headers: { 'x-user-id': auth.user?.id || '' },
        body: JSON.stringify({
          name,
          description,
          cover_url: coverUrl,
          is_private: isPaid,
          join_price: isPaid ? Number(price) : 0,
          min_level: Number(minLevel) || 1,
        }),
      });

      toast.success('נוצר בהצלחה');
      navigate(`/circle/${res.slug}`);
    } catch {
      toast.error('שגיאה ביצירה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FadeIn className="px-4 pt-5 pb-32 bg-surface min-h-screen" dir="rtl">

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* COVER */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="h-52 rounded-[32px] bg-surface-card border border-surface-border flex items-center justify-center mb-5 overflow-hidden"
      >
        {uploading ? (
          <Loader2 className="animate-spin text-brand-muted" />
        ) : coverUrl ? (
          <img src={coverUrl} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="text-brand-muted" />
        )}
      </div>

      {/* FORM */}
      <div className="bg-surface-card border border-surface-border rounded-[32px] p-5 flex flex-col gap-5">

        <Input
          value={name}
          onChange={(e: any) => setName(e.target.value)}
          placeholder="שם המועדון"
          className="bg-surface border border-surface-border text-white"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="תיאור"
          className="bg-surface border border-surface-border rounded-[24px] p-4 text-white"
        />

        {/* ACCESS */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setIsPaid(false)}
            className={`h-12 rounded-full ${
              !isPaid
                ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20'
                : 'bg-surface border border-surface-border text-brand-muted'
            }`}
          >
            חופשי
          </button>

          <button
            onClick={() => setIsPaid(true)}
            className={`h-12 rounded-full ${
              isPaid
                ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20'
                : 'bg-surface border border-surface-border text-brand-muted'
            }`}
          >
            בתשלום
          </button>
        </div>

        <AnimatePresence>
          {isPaid && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }}>

              {/* PRICE */}
              <div className="relative mb-3">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-primary text-xs tracking-widest">
                  CRD
                </span>
                <input
                  type="number"
                  value={price}
                  onChange={(e: any) => setPrice(e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded-full px-12 h-12 text-white"
                />
              </div>

              {/* LEVEL */}
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-primary text-xs tracking-widest">
                  LEVEL
                </span>
                <input
                  type="number"
                  value={minLevel}
                  onChange={(e: any) => setMinLevel(e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded-full px-12 h-12 text-white tracking-widest"
                />
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* INFO */}
      <div className="mt-4 bg-surface-card border border-surface-border p-4 rounded-[24px] text-brand-muted text-sm flex gap-3 items-center">
        <ShieldCheck size={16} className="text-accent-primary" />
        אתה תהיה מנהל המועדון
      </div>

      {/* BUTTON */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full h-14 mt-4 bg-white text-black rounded-full font-black"
      >
        {saving ? <Loader2 className="animate-spin" /> : 'הקם מועדון'}
      </Button>

    </FadeIn>
  );
};
