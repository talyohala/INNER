import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { GlassCard, PageTitle, FadeIn } from '../components/ui';
import { apiFetch } from '../lib/api';
import { CreatorFinanceSummary } from '../types';
import { CreatorPayoutCard } from '../components/CreatorPayoutCard';

export const CreatorFinancePage: React.FC = () => {
  const [data, setData] = useState<CreatorFinanceSummary | null>(null);

  const load = async () => {
    try {
      const result = await apiFetch<CreatorFinanceSummary>('/api/creator/finance/summary');
      setData(result);
    } catch (err: any) {
      if (err.message !== 'Failed to fetch') toast.error(err.message || 'טעינת הנתונים נכשלה');
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (!data) return <div className="min-h-[60vh] flex items-center justify-center text-muted">טוען...</div>;

  return (
    <FadeIn className="flex flex-col gap-6 pt-2">
      <PageTitle>הכנסות ומשיכות</PageTitle>

      <GlassCard>
        <CreatorPayoutCard payoutAccount={data.payoutAccount} />
      </GlassCard>

      <GlassCard>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-right">
          <div><div className="text-xs text-muted mb-1">סך מתנות (CRD)</div><div className="text-2xl font-bold text-[#8C6D53]">{data.totals.giftsCredits}</div></div>
          <div><div className="text-xs text-muted mb-1">מספר מתנות</div><div className="text-2xl font-bold">{data.totals.giftsCount}</div></div>
          <div><div className="text-xs text-muted mb-1">הערכת שווי (₪)</div><div className="text-2xl font-bold">₪{data.totals.topupsEquivalentILS}</div></div>
          <div><div className="text-xs text-muted mb-1 text-green-400">הערכת משיכה (₪)</div><div className="text-2xl font-bold text-green-400">₪{data.totals.estimatedPayoutILS}</div></div>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-bold mb-3">מתנות אחרונות מקהל</h3>
        <div className="grid gap-5">
          {data.recentGifts.length === 0 ? <p className="text-muted text-sm">אין מתנות עדיין.</p> : data.recentGifts.map((gift) => (
            <div className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0" key={gift.id}>
              <div className="min-w-0 pr-3">
                <strong className="block text-sm">{gift.sender?.username || 'משתמש אנונימי'}</strong>
                <p className="text-muted text-xs mt-1 truncate">{gift.note || 'ללא הודעה'}</p>
              </div>
              <div className="font-bold text-sm text-[#8C6D53] shrink-0">+{gift.amount} CRD</div>
            </div>
          ))}
        </div>
      </GlassCard>
    </FadeIn>
  );
};
