import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Loader2, Send, Edit2, Trash2, X, Crown, Copy } from 'lucide-react';
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
        scrollToBottom();
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
    }, 400); // קוצר ל-400ms לתגובה מהירה יותר
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
    toast.success('ההודעה נמחקה');
  };

  const copyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('הטקסט הועתק');
    setMessageActionModal(null);
  };

  const stopPropagation = (e: React.MouseEvent | React.TouchEvent) => e.stopPropagation();

  if (loading) {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col h-[100dvh] bg-surface items-center justify-center">
        <Loader2 className="animate-spin text-accent-primary" />
      </div>
    );
  }

  const isCore = targetProfile?.role_label === 'CORE';

  return (
    <div className="fixed inset-0 z-[80] flex flex-col h-[100dvh] bg-surface" dir="rtl">
      
      {/* HEADER - ללא קו מפריד (Border-b הוסר) */}
      <motion.div
        initial={{ y: 0 }}
        animate={{ y: showHeader ? 0 : -100 }}
        transition={{ duration: 0.2 }}
        className="fixed top-0 left-0 right-0 z-[90] flex flex-col items-center justify-center pt-6 pb-4 bg-surface/90 backdrop-blur-2xl shadow-sm"
      >
        <div className="flex flex-col items-center cursor-pointer active:scale-95 transition-transform" onClick={() => navigate(`/profile/${userId}`)}>
          <div className="relative mb-1">
            <div className="w-10 h-10 rounded-full bg-surface-card overflow-hidden border border-surface-border flex items-center justify-center shadow-sm">
              {targetProfile?.avatar_url ? (
                <img src={targetProfile.avatar_url} className="w-full h-full object-cover" />
              ) : (
                <span className="text-brand-muted font-black text-[16px]">{(targetProfile?.full_name || 'א')[0]}</span>
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-surface rounded-full shadow-[0_0_8px_#22c55e]" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-brand font-black text-[13px] tracking-wide">{targetProfile?.full_name || '...'}</span>
            {isCore && <Crown size={12} className="text-accent-primary" />}
          </div>
        </div>
      </motion.div>

      {/* MESSAGES AREA */}
      <div className="flex-1 overflow-y-auto px-4 pt-32 pb-4 flex flex-col gap-5 scrollbar-hide" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center m-auto opacity-50">
            <MessageSquare size={40} className="text-brand-muted mb-3" strokeWidth={1} />
            <p className="text-brand-muted font-black text-[12px] tracking-widest uppercase">אין הודעות עדיין</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === user?.id;
            const profileInfo = isMine ? myProfile : targetProfile;

            return (
              <div key={msg.id} className={`flex gap-3 w-full items-end ${isMine ? 'flex-row' : 'flex-row-reverse'}`}>
                <div className="w-8 h-8 min-w-[32px] rounded-full shrink-0 overflow-hidden border border-surface-border flex items-center justify-center bg-surface-card shadow-sm cursor-pointer" onClick={() => navigate(`/profile/${profileInfo?.id}`)}>
                  {profileInfo?.avatar_url ? (
                    <img src={profileInfo.avatar_url} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-brand-muted font-black text-[12px]">{(profileInfo?.full_name || 'א')[0]}</span>
                  )}
                </div>

                <div
                  onTouchStart={() => handlePressStart(msg)}
                  onTouchEnd={handlePressEnd}
                  onContextMenu={(e) => { e.preventDefault(); handlePressStart(msg); }}
                  className={`px-4 py-3 cursor-pointer w-fit max-w-[80%] shadow-sm transition-transform active:scale-[0.98] ${
                    isMine
                      ? 'bg-accent-primary text-surface rounded-[20px] rounded-tr-sm'
                      : 'bg-surface-card text-brand rounded-[20px] rounded-tl-sm border border-surface-border'
                  }`}
                >
                  <p className={`text-[14px] whitespace-pre-wrap leading-relaxed ${isMine ? 'font-bold' : 'font-medium'}`}>
                    {msg.content}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* TYPING AREA - ללא קו מפריד (Border-t הוסר) */}
      <div className="px-4 pt-2 bg-surface/95 backdrop-blur-xl shrink-0 pb-[calc(env(safe-area-inset-bottom)+90px)] z-[90]">
        
        {editingMessageId && (
          <div className="text-[11px] text-accent-primary flex items-center justify-between px-3 py-1.5 bg-surface-card border border-accent-primary/30 rounded-full w-fit mb-2 shadow-sm">
            <span className="font-bold mr-1 tracking-widest uppercase">עורך הודעה...</span>
            <X size={14} className="cursor-pointer text-brand-muted hover:text-brand" onClick={() => { setEditingMessageId(null); setNewMessage(''); }} />
          </div>
        )}

        <div className="flex gap-2 items-center bg-surface-card rounded-[28px] px-2 py-1 h-14 border border-surface-border shadow-sm">
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="הודעה..."
            className="flex-1 bg-transparent px-3 text-brand outline-none text-[15px] placeholder:text-brand-muted/50"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 ${
              newMessage.trim()
                ? 'bg-accent-primary text-white'
                : 'bg-surface-border text-brand-muted opacity-50'
            }`}
          >
            <Send size={16} className="rtl:-scale-x-100 -ml-0.5" />
          </button>
        </div>
      </div>

      {/* PORTAL - MESSAGE ACTIONS MODAL */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {messageActionModal && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" onTouchStart={stopPropagation} dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMessageActionModal(null)} />
              
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 400 }} className="relative z-[10000000] bg-surface rounded-t-[32px] p-6 flex flex-col gap-3 pb-[env(safe-area-inset-bottom,32px)] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                
                <div className="w-full pb-4 flex justify-center cursor-grab active:cursor-grabbing" onClick={() => setMessageActionModal(null)}>
                  <div className="w-12 h-1.5 bg-white/20 rounded-full" />
                </div>
                
                <button onClick={() => copyMessage(messageActionModal.content)} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-95 transition-transform border border-surface-border shadow-sm">
                  <span>העתק טקסט</span> <Copy size={20} className="text-brand-muted" />
                </button>

                {messageActionModal.sender_id === user?.id && (
                  <>
                    <button onClick={() => { setEditingMessageId(messageActionModal.id); setNewMessage(messageActionModal.content); setMessageActionModal(null); }} className="w-full p-4 bg-surface-card rounded-2xl text-brand font-black flex justify-between items-center text-[15px] active:scale-95 transition-transform border border-surface-border shadow-sm">
                      <span>ערוך הודעה</span> <Edit2 size={20} className="text-brand-muted" />
                    </button>
                    
                    <button onClick={() => { if(window.confirm('האם אתה בטוח שברצונך למחוק הודעה זו?')){ deleteMessage(messageActionModal.id); setMessageActionModal(null); } }} className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 font-black flex justify-between items-center text-[15px] active:scale-95 transition-transform mt-1 shadow-sm">
                      <span>מחק הודעה</span> <Trash2 size={20} className="text-red-500" />
                    </button>
                  </>
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
