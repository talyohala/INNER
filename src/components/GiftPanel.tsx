import React, { useState } from 'react';
import { Button, Input } from './ui';

export const GiftPanel: React.FC<{ onSend: (amount: number, note: string) => void, loading?: boolean }> = ({ onSend, loading }) => {
  const [amount, setAmount] = useState(50);
  const [note, setNote] = useState('');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {[50, 100, 500].map((preset) => (
          <button key={preset} onClick={() => setAmount(preset)} className={`flex-1 py-2 rounded-xl border text-sm font-bold transition-all shadow-inner ${amount === preset ? 'bg-white/20 border-white/40 text-white' : 'bg-white/5 border-white/5 text-white/70 hover:text-white hover:bg-white/10'}`}>
            {preset}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-white/70 shrink-0">סכום אישי:</span>
        <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="py-2.5 bg-white/5 shadow-inner" />
      </div>
      <textarea className="w-full border border-white/5 bg-white/5 text-white rounded-2xl px-4 py-3.5 outline-none placeholder:text-white/40 focus:border-white/30 transition-colors min-h-[80px] resize-none text-sm shadow-inner backdrop-blur-md" placeholder="הודעה ליוצר (אופציונלי)..." value={note} onChange={(e) => setNote(e.target.value)} disabled={loading} />
      <Button onClick={() => { if(amount>0) { onSend(amount, note); setNote(''); } }} disabled={loading || amount <= 0} className="w-full">
        {loading ? 'שולח...' : `שליחת ${amount} CRD`}
      </Button>
    </div>
  );
};
