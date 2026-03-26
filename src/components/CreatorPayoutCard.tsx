import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';
import { Button, Input } from './ui';
import { PayoutAccount } from '../types';

export const CreatorPayoutCard: React.FC<{ payoutAccount?: PayoutAccount | null }> = ({ payoutAccount }) => {
  const [editing, setEditing] = useState(!payoutAccount);
  const [details, setDetails] = useState(payoutAccount?.details || '');
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const saveDetails = async () => {
    try {
      setSaving(true);
      await apiFetch('/api/creator/finance/payout-account', {
        method: 'PUT',
        body: JSON.stringify({ details })
      });
      toast.success('פרטי המשיכה נשמרו בהצלחה');
      setEditing(false);
      window.location.reload();
    } catch (err: any) {
      if (err.message !== 'Failed to fetch') toast.error(err.message || 'שמירת הפרטים נכשלה');
    } finally {
      setSaving(false);
    }
  };

  const requestPayout = async () => {
    try {
      setRequesting(true);
      await apiFetch('/api/creator/finance/payout-request', { method: 'POST' });
      toast.success('בקשת המשיכה נשלחה בהצלחה לצוות');
    } catch (err: any) {
      if (err.message !== 'Failed to fetch') toast.error(err.message || 'שליחת הבקשה נכשלה');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">פרטי חשבון למשיכה</h3>
        {!editing && payoutAccount && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="text-[#8C6D53]">
            עריכה
          </Button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-6 bg-black/20 p-4 rounded-2xl shadow-inner border border-white/5">
          <label className="text-sm text-muted">פרטי העברה בנקאית (שם מלא, בנק, סניף, מספר חשבון)</label>
          <textarea
            className="w-full border border-white/5 bg-black/20 text-white rounded-2xl px-4 py-3.5 outline-none placeholder:text-[#8f97a2] focus:border-[#8C6D53]/50 transition-colors min-h-[100px] shadow-inner resize-y text-sm"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="לדוגמה: ישראל ישראלי, בנק פועלים (12), סניף 345, חשבון 678910"
            disabled={saving}
          />
          <Button onClick={saveDetails} disabled={saving || !details.trim()}>
            {saving ? 'שומר...' : 'שמירת פרטים'}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="bg-black/20 p-4 rounded-2xl shadow-inner border border-white/5">
            <p className="text-sm text-[#e2e6eb] whitespace-pre-wrap">{payoutAccount?.details}</p>
          </div>
          <Button onClick={requestPayout} disabled={requesting} className="w-full">
            {requesting ? 'שולח בקשה...' : 'בקשת משיכת כספים'}
          </Button>
          <p className="text-xs text-muted text-center mt-1">
            * המשיכה תתבצע תוך 3 ימי עסקים לאחר אישור הצוות.
          </p>
        </div>
      )}
    </div>
  );
};
