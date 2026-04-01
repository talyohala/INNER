import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Loader2, ChevronLeft, Send, UserCircle } from 'lucide-react';
import { triggerFeedback } from '../lib/sound';

export const ChatPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [targetProfile, setTargetProfile] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !userId) return;

    const loadChat = async () => {
      setLoading(true);
      // נטען את פרטי המשתמש שאנחנו מדברים איתו
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (profile) setTargetProfile(profile);

      // נטען הודעות היסטוריות (צריך לוודא שיש לך טבלת direct_messages, או שזה זמני יקרוס וידרוש הוספה)
      try {
        const { data: msgs } = await supabase
          .from('direct_messages')
          .select('*')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
          .order('created_at', { ascending: true });
        
        setMessages(msgs || []);
      } catch (err) {
        console.error("No direct_messages table yet", err);
      }
      setLoading(false);
    };

    loadChat();

    // מאזין בזמן אמת להודעות חדשות
    const channel = supabase.channel('direct_messages_updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
        const msg = payload.new;
        if ((msg.sender_id === user.id && msg.receiver_id === userId) || (msg.sender_id === userId && msg.receiver_id === user.id)) {
          setMessages(prev => [...prev, msg]);
          scrollToBottom();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, userId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !userId) return;
    try {
      const msg = { sender_id: user.id, receiver_id: userId, content: newComment.trim() };
      setNewMessage('');
      await supabase.from('direct_messages').insert(msg);
      triggerFeedback('coin');
    } catch (e) {}
  };

  return (
    <div className="flex flex-col h-screen bg-[#0A0A0A]" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-[#111] border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full active:scale-95"><ChevronLeft size={20} className="text-white" /></button>
          <div className="w-10 h-10 rounded-full bg-black overflow-hidden border border-white/20">
            {targetProfile?.avatar_url ? <img src={targetProfile.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={24} className="text-white/20 m-2" />}
          </div>
          <span className="text-white font-bold">{targetProfile?.full_name || 'טוען...'}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4" ref={scrollRef}>
        {loading ? <Loader2 className="animate-spin m-auto text-white/20" /> : messages.map((msg, idx) => {
          const isMine = msg.sender_id === user?.id;
          return (
            <div key={idx} className={`max-w-[75%] p-3 rounded-2xl ${isMine ? 'bg-[#2196f3] text-white self-end rounded-tl-sm' : 'bg-white/10 text-white/90 self-start rounded-tr-sm'}`}>
              <p className="text-[14px] leading-relaxed">{msg.content}</p>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="p-4 bg-[#111] border-t border-white/10 shrink-0 pb-10">
        <div className="flex gap-2 items-center bg-black/40 rounded-full p-1 pl-2 border border-white/10">
          <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="הקלד הודעה..." className="flex-1 bg-transparent px-4 text-white outline-none" />
          <button onClick={sendMessage} disabled={!newMessage.trim()} className="w-10 h-10 bg-[#2196f3] rounded-full flex items-center justify-center text-white active:scale-95 disabled:opacity-50"><Send size={18} className="rtl:-scale-x-100 -ml-1" /></button>
        </div>
      </div>
    </div>
  );
};
