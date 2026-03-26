import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Flag } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { Button, cn } from './ui';

type Props = {
  entityType: 'circle' | 'drop';
  entityId: string;
  compact?: boolean;
};

export const ReportButton: React.FC<Props> = ({ entityType, entityId, compact = false }) => {
  const [loading, setLoading] = useState(false);

  const handleReport = async () => {
    const reason = window.prompt('מה הסיבה לדיווח?');
    if (!reason?.trim()) return;

    try {
      setLoading(true);
      await apiFetch('/api/report', {
        method: 'POST',
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId, reason: reason.trim() })
      });
      toast.success('הדיווח נשלח למנהלים');
    } catch (err: any) {
      toast.error(err.message || 'הדיווח נכשל');
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <button 
        onClick={handleReport} 
        disabled={loading}
        className={cn(
          "w-9 h-9 shrink-0 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 text-muted transition-colors hover:bg-white/10 hover:text-white", 
          loading && "opacity-50 pointer-events-none"
        )}
      >
        <Flag size={14} />
      </button>
    );
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleReport} disabled={loading}>
      <Flag size={14} />
      <span>{loading ? 'שולח...' : 'דווח'}</span>
    </Button>
  );
};
