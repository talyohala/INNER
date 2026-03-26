import React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

export const WalletHistory: React.FC<{ items: any[] }> = ({ items }) => {
  if (!items || items.length === 0) {
    return (
      <div className="text-white/30 text-sm text-center py-10 font-bold border border-dashed border-white/10 rounded-3xl bg-black/20">
        אין פעולות להצגה עדיין.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => {
        const isPositive = item.amount > 0;
        return (
          <div key={item.id || index} className="flex justify-between items-center p-4 bg-white/5 border border-white/5 rounded-3xl shadow-inner transition-all hover:bg-white/10">
            <div className="flex items-center gap-4 min-w-0">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-inner ${isPositive ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-white/5 border-white/10 text-white/50'}`}>
                {isPositive ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
              </div>
              <div className="flex flex-col min-w-0 pr-1">
                <strong className="text-white text-[15px] font-black truncate">
                  {item.description || (isPositive ? 'טעינת יתרה (Quick Buy)' : 'שליחת מתנה ליוצר')}
                </strong>
                <span className="text-white/40 text-[11px] font-bold mt-0.5 tracking-wider uppercase">
                  {new Date(item.created_at || Date.now()).toLocaleDateString('he-IL')} · {new Date(item.created_at || Date.now()).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
            <div className="shrink-0 text-left pl-2" dir="ltr">
              <span className={`font-black text-lg drop-shadow-md ${isPositive ? 'text-green-400' : 'text-white'}`}>
                {isPositive ? '+' : ''}{item.amount}
              </span>
              <span className="text-[10px] font-bold text-white/40 ml-1">CRD</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
