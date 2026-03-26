import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';
import { ModerationQueueItem } from '../types';
import { GlassCard, Button, PageTitle, FadeIn } from '../components/ui';

export const AdminPage: React.FC = () => {
  const [queue, setQueue] = useState<ModerationQueueItem[]>([]);

  const load = async () => {
    try {
      const data = await apiFetch<ModerationQueueItem[]>('/api/admin/moderation/queue');
      setQueue(data);
    } catch (err: any) {
      if (err.message !== 'Failed to fetch') toast.error(err.message || 'טעינת הנתונים נכשלה');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (id: string, action: 'dismissed' | 'reviewed' | 'actioned') => {
    try {
      await apiFetch(`/api/admin/moderation/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: action })
      });
      toast.success('הדיווח עודכן בהצלחה');
      await load();
    } catch (err: any) {
      if (err.message !== 'Failed to fetch') toast.error(err.message || 'עדכון הדיווח נכשל');
    }
  };

  return (
    <FadeIn className="flex flex-col gap-6 pt-2">
      <PageTitle>ניהול ומודרציה</PageTitle>

      <div className="grid gap-5">
        {queue.length === 0 ? (
          <div className="text-muted text-sm text-center mt-10">תור הדיווחים ריק. הכל נקי.</div>
        ) : queue.map((item) => (
          <GlassCard key={item.id} className="border-red-500/20 bg-red-500/5 shadow-inner">
            <div className="flex justify-between items-start mb-2">
              <strong className="block text-sm uppercase text-red-300">
                {item.entity_type === 'circle' ? 'קהילה' : 'דרופ'}
              </strong>
              <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded border border-white/5">
                {item.status === 'open' ? 'פתוח' : item.status === 'reviewed' ? 'נבדק' : item.status === 'actioned' ? 'טופל' : 'נדחה'}
              </span>
            </div>
            <p className="text-sm text-white mb-1"><strong>מזהה:</strong> {item.entity_id}</p>
            <p className="text-sm text-muted mb-4"><strong>סיבה לדיווח:</strong> {item.reason}</p>
            
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => act(item.id, 'reviewed')}>סימון כנבדק</Button>
              <Button variant="secondary" size="sm" onClick={() => act(item.id, 'dismissed')}>דחיית דיווח (שקרי)</Button>
              <Button size="sm" className="bg-red-500/80 text-white hover:bg-red-600 border border-red-500/50 backdrop-blur-md" onClick={() => act(item.id, 'actioned')}>מחיקה / חסימה</Button>
            </div>
          </GlassCard>
        ))}
      </div>
    </FadeIn>
  );
};
