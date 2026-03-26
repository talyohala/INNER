import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Sparkles, Zap } from 'lucide-react';
import { apiFetch } from '../lib/api';

const PACKAGES = [
  { credits: 100, price: 10, highlight: false },
  { credits: 500, price: 45, highlight: true }, // החבילה המשתלמת משווקת כ-VIP
  { credits: 1000, price: 80, highlight: false },
  { credits: 5000, price: 350, highlight: false },
];

export const WalletTopupCard: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleTopup = async (credits: number, price: number) => {
    try {
      setLoading(true);
      // קריאה לשרת (אם אין נתיב, ה-apiFetch יחזיר שגיאה ונטפל בה)
      await apiFetch('/api/wallet/topup', { method: 'POST', body: JSON.stringify({ amount: credits, price }) });
      toast.success(`נטענו ${credits} CRD לחשבון! 🎉`);
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      toast.error(err.message || 'הטעינה נכשלה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {PACKAGES.map((pkg) => (
        <button
          key={pkg.credits}
          disabled={loading}
          onClick={() => handleTopup(pkg.credits, pkg.price)}
          className={`relative flex flex-col items-center justify-center p-6 rounded-3xl transition-all shadow-2xl disabled:opacity-50 active:scale-95 hover:scale-[1.02] overflow-hidden ${
            pkg.highlight 
              ? 'bg-white/15 border-2 border-white/30 text-white backdrop-blur-3xl' 
              : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
          }`}
        >
          {pkg.highlight && (
            <div className="absolute top-0 inset-x-0 bg-white/20 text-[9px] font-black text-white py-1 text-center flex items-center justify-center gap-1 backdrop-blur-md">
              <Zap size={10} /> BEST VALUE
            </div>
          )}
          
          <div className="flex items-center gap-1.5 mt-2">
            <Sparkles size={16} className={pkg.highlight ? 'text-white' : 'text-white/50'} />
            <span className="text-3xl font-black drop-shadow-xl">{pkg.credits}</span>
          </div>
          <span className="text-[10px] font-bold text-white/50 mb-3 tracking-widest">CREDITS</span>
          
          <div className={`px-4 py-1.5 rounded-xl text-xs font-black shadow-inner backdrop-blur-md border ${
            pkg.highlight ? 'bg-white/20 border-white/20 text-white' : 'bg-black/40 border-white/5 text-white/80'
          }`}>
            ₪{pkg.price}
          </div>
        </button>
      ))}
    </div>
  );
};
