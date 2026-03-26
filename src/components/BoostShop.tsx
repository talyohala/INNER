import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Sparkles } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { BoostItem } from '../types';
import { Button } from './ui';

export const BoostShop: React.FC<{ boosts: BoostItem[], circleSlug?: string, onDone?: () => void }> = ({ boosts, circleSlug, onDone }) => {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handlePurchase = async (boostId: string) => {
    try {
      setLoadingId(boostId);
      await apiFetch(`/api/boosts/${boostId}/purchase`, { method: 'POST', body: JSON.stringify(circleSlug ? { circle_slug: circleSlug } : {}) });
      toast.success('הבוסט נרכש והופעל בהצלחה!');
      if (onDone) onDone();
    } catch (err: any) {
      if (err.message !== 'Failed to fetch') toast.error(err.message);
    } finally {
      setLoadingId(null);
    }
  };

  if (!boosts || boosts.length === 0) return <div className="text-white/60 text-sm text-center py-4">אין בוסטים זמינים כרגע.</div>;

  return (
    <div className="grid gap-3">
      {boosts.map((boost) => (
        <div key={boost.id} className="flex justify-between items-center p-4 bg-white/5 border border-white/5 rounded-2xl shadow-inner backdrop-blur-lg transition-all hover:bg-white/10">
          <div className="min-w-0 pr-2">
            <strong className="flex items-center gap-1.5 text-base text-white mb-1">
              <Sparkles size={14} className="text-white" />
              {boost.name}
            </strong>
            <p className="text-white/70 text-xs truncate max-w-[200px]">{boost.description}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="text-sm font-bold text-white">{boost.price} CRD</span>
            <Button size="sm" onClick={() => handlePurchase(boost.id)} disabled={loadingId === boost.id} className="px-4 py-1.5 text-xs">
              {loadingId === boost.id ? 'רוכש...' : 'רכישה'}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
