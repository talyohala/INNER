import React from 'react';
import { CircleMessage } from '../types';
import { ReportButton } from './ReportButton';
import { Star } from 'lucide-react';

export const MessageList: React.FC<{ messages: CircleMessage[] }> = ({ messages }) => {
  if (!messages || messages.length === 0) {
    return <div className="text-muted text-sm text-center py-6">אין הודעות עדיין. תהיה הראשון לכתוב!</div>;
  }

  return (
    <div className="flex flex-col gap-6 mt-4">
      {messages.map((msg) => (
        <div 
          key={msg.id} 
          className={`flex flex-col gap-6 p-3.5 rounded-2xl border ${
            msg.is_highlighted 
              ? 'bg-[#8C6D53]/10 border-[#8C6D53]/30 shadow-[inset_0_1px_4px_rgba(140,109,83,0.1)]' 
              : 'bg-white/5 border-white/5 shadow-inner'
          }`}
        >
          <div className="flex justify-between items-start gap-2">
            <div className="flex items-center gap-2">
              <strong className="text-sm font-bold text-white">{msg.profile?.username || 'אנונימי'}</strong>
              {msg.is_highlighted && (
                <span className="flex items-center gap-1 text-[10px] text-[#C2A382] bg-[#8C6D53]/20 px-1.5 py-0.5 rounded border border-[#8C6D53]/20">
                  <Star size={10} /> הודגשה
                </span>
              )}
            </div>
            <ReportButton entityType="message" entityId={msg.id} compact />
          </div>
          <p className="text-sm text-[#e2e6eb] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          <div className="text-[10px] text-muted text-left" dir="ltr">
            {new Date(msg.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      ))}
    </div>
  );
};
