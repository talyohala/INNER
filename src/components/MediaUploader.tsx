import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { UploadCloud, Image as ImageIcon, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { uploadToBucket } from '../lib/storage';
import { GlassCard, Button } from './ui';

type Props = {
  bucket: 'avatars' | 'covers' | 'drops';
  label: string;
  value: string;
  onChange: (url: string) => void;
};

export const MediaUploader: React.FC<Props> = ({ bucket, label, value, onChange }) => {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);

  const pick = () => inputRef.current?.click();

  const handleFile = async (file?: File) => {
    if (!file || !user) return;

    try {
      setLoading(true);
      const url = await uploadToBucket(bucket, file, user.id);
      onChange(url);
      toast.success('המדיה עלתה בהצלחה');
    } catch (err: any) {
      toast.error(err.message || 'העלאה נכשלה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard className="overflow-hidden">
      <div className="flex justify-between items-center gap-3 mb-3">
        <div>
          <strong className="block text-sm">{label}</strong>
          <p className="text-muted text-xs mt-0.5">JPG / PNG / WEBP</p>
        </div>
        <Button variant="secondary" size="sm" onClick={pick} disabled={loading} className="shrink-0">
          <UploadCloud size={14} />
          {loading ? 'מעלה...' : 'העלה'}
        </Button>
      </div>

      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept="image/*"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {value ? (
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20">
          <img src={value} className="w-full max-h-[320px] object-cover" alt="" />
          <button
            type="button"
            className="absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition-colors"
            onClick={() => onChange('')}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div 
          onClick={pick}
          className="min-h-[120px] rounded-2xl border border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center gap-2 text-muted cursor-pointer hover:bg-white/10 transition-colors"
        >
          <ImageIcon size={20} className="opacity-50" />
          <span className="text-sm">לחץ להוספת תמונה</span>
        </div>
      )}
    </GlassCard>
  );
};
