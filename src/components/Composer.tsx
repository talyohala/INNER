import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from './ui';

export const Composer: React.FC<{ onSend: (text: string) => void }> = ({ onSend }) => {
  const [text, setText] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        className="flex-1 border border-white/5 bg-black/20 text-white rounded-2xl px-4 py-3.5 outline-none placeholder:text-[#8f97a2] focus:border-[#8C6D53]/50 transition-colors shadow-inner"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="שתף משהו עם הקהילה..."
      />
      <Button type="submit" disabled={!text.trim()} className="px-5 shrink-0">
        <Send size={18} className="rtl:-scale-x-100" />
      </Button>
    </form>
  );
};
