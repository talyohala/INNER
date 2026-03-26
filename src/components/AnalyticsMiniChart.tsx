import React from 'react';
import { cn } from './ui';

type Point = {
  stat_date: string;
  new_members: number;
  drops_count: number;
  messages_count: number;
  gifts_count: number;
  gifts_credits: number;
};

export const AnalyticsMiniChart: React.FC<{ data: Point[] }> = ({ data }) => {
  const max = Math.max(
    1,
    ...data.map((d) => d.new_members + d.messages_count + d.drops_count)
  );

  return (
    <div className="flex items-end gap-2.5 min-h-[160px]">
      {data.map((d) => {
        const value = d.new_members + d.messages_count + d.drops_count;
        const heightPercent = Math.max(8, Math.round((value / max) * 100));
        
        return (
          <div key={d.stat_date} className="flex flex-col items-center flex-1 gap-2">
            <div className="w-full h-[130px] flex items-end">
              <div 
                className={cn(
                  "w-full rounded-t-xl bg-gradient-to-b from-[#f0d4b4] to-[#cfa57b]/70 shadow-[0_4px_20px_rgba(207,165,123,0.15)] transition-all",
                  value === 0 && "opacity-30 from-white/20 to-white/5 shadow-none"
                )}
                style={{ height: `${heightPercent}%` }}
              />
            </div>
            <span className="text-[10px] text-muted whitespace-nowrap">
              {new Date(d.stat_date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}
            </span>
          </div>
        );
      })}
    </div>
  );
};
