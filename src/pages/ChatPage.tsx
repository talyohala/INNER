import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Loader2, Send, UserCircle, Edit2, Trash2, X } from 'lucide-react';
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

  const { scrollY } = useScroll({ container: scrollRef });
  const [showHeader, setShowHeader] = useState(true);
  const lastY = useRef(0);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const diff = latest - lastY.current;
    if (Math.abs(diff) > 5) {
      if (diff > 0 && latest > 30) setShowHeader(false);
      else setShowHeader(true);
    }
    lastY.current = latest;
  });

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

    const channel = supabase.channel('chat_updates_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const msg = payload.new;
          if ((msg.sender_id === user.id && msg.receiver_id === userId) || (msg.sender_id === userId && msg.receiver_id === user.id)) {
            setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
            scrollToBottom();
          }
        }
        if (payload.eventType === 'DELETE') setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        if (payload.eventType === 'UPDATE') setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, userId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 100);
  };

  const handlePressStart = (msg: any) => {
    pressTimer.current = setTimeout(() => {
      triggerFeedback('pop');
      setMessageActionModal(msg);
    }, 500);
  };

  const handlePressEnd = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

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
    setMessages(prev => [...prev, { id: tempId, sender_id: user.id, receiver_id: userId, content, created_at: new Date().toISOString() }]);
    scrollToBottom();
    triggerFeedback('coin');

    try {
      const { data } = await supabase.from('direct_messages').insert({ sender_id: user.id, receiver_id: userId, content }).select().single();
      if (data) setMessages(prev => prev.map(m => m.id === tempId ? data : m));
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const deleteMessage = async (msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    await supabase.from('direct_messages').delete().eq('id', msgId);
  };

  const stopPropagation = (e: React.MouseEvent | React.TouchEvent) => e.stopPropagation();

  return (
    <div className="fixed inset-0 z-[80] flex flex-col h-[100dvh] bg-[#0C0C0C]" dir="rtl">
      
      {/* הדר */}
      <motion.div 
        initial={{ y: 0 }}
        animate={{ y: showHeader ? 0 : -100 }}
        transition={{ duration: 0.2 }}
        className="fixed top-0 left-0 right-0 z-[90] flex flex-col items-center justify-center pt-4 pb-2 bg-[#111]/95 backdrop-blur-xl border-b border-white/5 rounded-b-[24px] shadow-xl"
        onClick={() => navigate(`/profile/${userId}`)}
      >
        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-black overflow-hidden border border-white/10 flex items-center justify-center">
            {targetProfile?.avatar_url ? <img src={targetProfile.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={20} className="text-white/20" />}
          </div>
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#10b981] border-2 border-[#111] rounded-full"></div>
        </div>
        <span className="text-white font-bold text-[13px] mt-0.5 tracking-tight">{targetProfile?.full_name || '...'}</span>
      </motion.div>

      {/* הודעות */}
      <div className="flex-1 overflow-y-auto px-4 pt-24 pb-4 flex flex-col gap-5 scrollbar-hide" ref={scrollRef}>
        {loading ? <Loader2 className="animate-spin m-auto text-white/20" /> : messages.map((msg) => {
          const isMine = msg.sender_id === user?.id;
          const profileInfo = isMine ? myProfile : targetProfile;
          
          return (
            <div key={msg.id} className="flex gap-3 w-full items-start">
              <div className="w-8 h-8 min-w-[32px] rounded-full shrink-0 overflow-hidden border border-white/10 flex items-center justify-center bg-black/20">
                {profileInfo?.avatar_url ? <img src={profileInfo.avatar_url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full p-1.5 text-white/20" />}
              </div>
              <div 
                onTouchStart={() => handlePressStart(msg)}
                onTouchEnd={handlePressEnd}
                className={`p-3 rounded-2xl cursor-pointer w-fit max-w-[85%] ${isMine ? 'bg-[#2196f3]/20 border border-[#2196f3]/30 rounded-tr-sm self-start' : 'bg-white/5 border border-white/10 rounded-tr-sm self-end'}`}
              >
                <p className="text-white/90 text-[14px] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* הקלדה */}
      <div className="p-4 bg-[#0C0C0C]/90 backdrop-blur-md border-t border-white/5 shrink-0 pb-[100px] z-[90]">
        {editingMessageId && (
          <div className="text-[11px] text-[#2196f3] flex items-center justify-between px-3 py-1 bg-[#2196f3]/10 rounded-full w-fit mb-2">
            <span className="font-bold mr-1">עורך...</span>
            <X size={12} className="cursor-pointer" onClick={() => { setEditingMessageId(null); setNewMessage(''); }} />
          </div>
        )}
        <div className="flex gap-2 items-center bg-white/5 rounded-full p-1 pl-2 border border-white/10">
          <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="הודעה..." className="flex-1 bg-transparent px-4 text-white outline-none text-[15px]" />
          <button onClick={sendMessage} disabled={!newMessage.trim()} className={`w-9 h-9 rounded-full flex items-center justify-center text-white transition-all ${newMessage.trim() ? 'bg-[#2196f3] opacity-100' : 'bg-white/10 opacity-30'}`}><Send size={16} className="rtl:-scale-x-100" /></button>
        </div>
      </div>

      {/* PORTAL - מודאל עריכה/מחיקה שבורח מהתפריט התחתון */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {messageActionModal && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMessageActionModal(null)} />
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="relative z-[10000000] bg-white rounded-t-[36px] p-6 flex flex-col gap-3 pb-12 shadow-[0_-10px_50px_rgba(0,0,0,0.3)]">
                <div className="w-full flex justify-center mb-2"><div className="w-16 h-1.5 bg-black/10 rounded-full"/></div>
                
                {messageActionModal.sender_id === user?.id ? (
                  <>
                    <button onClick={() => { setEditingMessageId(messageActionModal.id); setNewMessage(messageActionModal.content); setMessageActionModal(null); }} className="w-full p-4 bg-black/5 rounded-2xl text-black font-black flex justify-between items-center text-lg active:bg-black/10 transition-colors">
                      ערוך הודעה <Edit2 size={20} className="text-black/40" />
                    </button>
                    <button onClick={() => { if(window.confirm('למחוק הודעה?')){ deleteMessage(messageActionModal.id); setMessageActionModal(null); } }} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 font-black flex justify-between items-center text-lg active:bg-red-500/20 transition-colors">
                      מחק הודעה <Trash2 size={20} />
                    </button>
                  </>
                ) : (
                  <div className="text-center p-6 text-black/40 font-bold italic border border-dashed border-black/10 rounded-2xl">
                    הודעה מאת {targetProfile?.full_name}
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
