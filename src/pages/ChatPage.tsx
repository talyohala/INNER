import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Loader2, ChevronLeft, Send, UserCircle, Edit2, Trash2, X } from 'lucide-react';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

export const ChatPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user, profile: myProfile } = useAuth();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [targetProfile, setTargetProfile] = useState<any>(null);
  
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [messageActionModal, setMessageActionModal] = useState<any | null>(null);
  const pressTimer = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !userId) return;

    const loadChat = async () => {
      setLoading(true);
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (profile) setTargetProfile(profile);

      try {
        const { data: msgs } = await supabase
          .from('direct_messages')
          .select('*')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
          .order('created_at', { ascending: true });
        
        setMessages(msgs || []);
      } catch (err) {}
      setLoading(false);
    };

    loadChat();

    const channel = supabase.channel('direct_messages_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const msg = payload.new;
          if ((msg.sender_id === user.id && msg.receiver_id === userId) || (msg.sender_id === userId && msg.receiver_id === user.id)) {
            setMessages(prev => {
              if(prev.find(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            scrollToBottom();
          }
        }
        if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        }
        if (payload.eventType === 'UPDATE') {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
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
  }, [messages, loading]);

  const handlePressStart = (msg: any) => {
    pressTimer.current = setTimeout(() => {
      triggerFeedback('pop');
      setMessageActionModal(msg);
    }, 500);
  };

  const handlePressEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !userId) return;
    const content = newMessage.trim();
    setNewMessage('');
    
    if (editingMessageId) {
      const msgId = editingMessageId;
      setEditingMessageId(null);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content } : m));
      await supabase.from('direct_messages').update({ content }).eq('id', msgId);
      return;
    }

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = { id: tempId, sender_id: user.id, receiver_id: userId, content, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();
    triggerFeedback('coin');

    try {
      const { data } = await supabase.from('direct_messages').insert({ sender_id: user.id, receiver_id: userId, content }).select().single();
      if (data) { setMessages(prev => prev.map(m => m.id === tempId ? data : m)); }
    } catch (e) {
      toast.error('שגיאה בשליחת ההודעה');
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const deleteMessage = async (msgId: string) => {
    triggerFeedback('error');
    setMessages(prev => prev.filter(m => m.id !== msgId));
    try { await supabase.from('direct_messages').delete().eq('id', msgId); } catch(e){}
  };

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col bg-[#0C0C0C]" dir="rtl">
      {/* פאנל עליון */}
      <div className="flex items-center justify-between p-4 bg-[#111] border-b border-white/10 shrink-0 pt-10 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full active:scale-95"><ChevronLeft size={20} className="text-white" /></button>
          <div className="w-10 h-10 rounded-full bg-black overflow-hidden border border-white/20 flex items-center justify-center cursor-pointer" onClick={() => navigate(`/profile/${userId}`)}>
            {targetProfile?.avatar_url ? <img src={targetProfile.avatar_url} className="w-full h-full object-cover object-center" /> : <UserCircle size={24} className="text-white/20" />}
          </div>
          <span className="text-white font-bold cursor-pointer" onClick={() => navigate(`/profile/${userId}`)}>{targetProfile?.full_name || 'טוען...'}</span>
        </div>
      </div>

      {/* אזור ההודעות (היחיד שנגלל) */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6" ref={scrollRef}>
        {loading ? <Loader2 className="animate-spin m-auto text-white/20" /> : messages.map((msg) => {
          const isMine = msg.sender_id === user?.id;
          const profileInfo = isMine ? myProfile : targetProfile;
          
          return (
            <div key={msg.id} className="flex gap-3 w-full items-start">
              <div className="w-10 h-10 min-w-[40px] rounded-full shrink-0 overflow-hidden border border-white/10 flex items-center justify-center bg-black/5">
                {profileInfo?.avatar_url ? <img src={profileInfo.avatar_url} className="w-full h-full object-cover object-center" /> : <UserCircle className="w-full h-full p-2 text-white/20" />}
              </div>
              <div className="flex flex-col flex-1">
                <div 
                  onTouchStart={() => handlePressStart(msg)}
                  onTouchEnd={handlePressEnd}
                  onMouseDown={() => handlePressStart(msg)}
                  onMouseUp={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  className={`p-3 rounded-2xl cursor-pointer w-fit max-w-[85%] ${isMine ? 'bg-[#2196f3]/20 border border-[#2196f3]/30 rounded-tr-sm self-start' : 'bg-white/5 border border-white/10 rounded-tr-sm self-end'}`}
                >
                  <span className="text-white font-bold text-[11px] mb-1 block">{profileInfo?.full_name || 'אנונימי'}</span>
                  <p className="text-white/90 text-[14px] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* אזור ההקלדה - נעוץ למטה */}
      <div className="p-4 bg-[#111] border-t border-white/10 shrink-0 pb-8 z-20">
        {editingMessageId && (
          <div className="text-[11px] text-[#2196f3] flex items-center justify-between px-3 py-1 bg-[#2196f3]/10 rounded-full w-fit mb-2">
            <span className="font-bold mr-1">עורך הודעה...</span>
            <X size={12} className="cursor-pointer" onClick={() => { setEditingMessageId(null); setNewMessage(''); }} />
          </div>
        )}
        <div className="flex gap-2 items-center bg-white/5 rounded-full p-1 pl-2 border border-white/10">
          <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="הקלד הודעה..." className="flex-1 bg-transparent px-4 text-white outline-none" />
          <button onClick={sendMessage} disabled={!newMessage.trim()} className="w-10 h-10 bg-[#2196f3] rounded-full flex items-center justify-center text-white active:scale-95 disabled:opacity-50 transition-all shadow-md"><Send size={18} className="rtl:-scale-x-100 -ml-1" /></button>
        </div>
      </div>

      {/* הבוטום שיט של ההודעות מכסה את הכל (z-9999999) */}
      <AnimatePresence>
        {messageActionModal && (
          <div className="fixed inset-0 z-[9999999] flex flex-col justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMessageActionModal(null)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative z-10 bg-white rounded-t-[36px] p-6 flex flex-col gap-3 pb-12 shadow-[0_-10px_50px_rgba(0,0,0,0.1)]">
              <div className="w-full py-4 flex justify-center"><div className="w-16 h-1.5 bg-black/15 rounded-full"/></div>
              {messageActionModal.sender_id === user?.id ? (
                <>
                  <button onClick={() => { setEditingMessageId(messageActionModal.id); setNewMessage(messageActionModal.content); setMessageActionModal(null); }} className="w-full p-4 bg-black/5 rounded-2xl text-black font-bold flex justify-between items-center text-lg hover:bg-black/10 transition-colors">ערוך הודעה <Edit2 size={20} className="text-black/40" /></button>
                  <button onClick={() => { if(window.confirm('למחוק הודעה?')){ deleteMessage(messageActionModal.id); setMessageActionModal(null); } }} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 font-bold flex justify-between items-center text-lg mt-2 hover:bg-red-500/20 transition-colors">מחק הודעה <Trash2 size={20} /></button>
                </>
              ) : (
                <div className="text-center p-4 text-black/50 font-bold">לא ניתן לערוך הודעה של אדם אחר</div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
