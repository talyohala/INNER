import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import { 
  ChevronRight, Loader2, Send, ShieldAlert, 
  Crown, Lock, Coins, UserCircle 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export const ChatRoomPage: React.FC = () => {
  const { userId: otherUserId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  // הכלכלה של הצ'אט
  const [feeRequired, setFeeRequired] = useState(false);
  const DM_FEE = 50; // דמי רצינות קבועים ל-Cold DM למישהו ברמה גבוהה יותר

  useEffect(() => {
    if (profile?.id && otherUserId) {
      initChat();
    }
  }, [profile?.id, otherUserId]);

  // גלילה אוטומטית למטה כשיש הודעה חדשה
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const initChat = async () => {
    setLoading(true);
    try {
      // 1. שליפת הפרופיל של המשתמש השני
      const { data: otherProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', otherUserId)
        .single();

      if (profileErr || !otherProfile) throw new Error('משתמש לא נמצא');
      setOtherUser(otherProfile);

      // 2. חיפוש שיחה קיימת בין שני המשתמשים
      const { data: convos, error: convErr } = await supabase
        .from('conversations')
        .select('*')
        .or(`and(user1_id.eq.${profile!.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${profile!.id})`)
        .maybeSingle();

      let currentConvoId = convos?.id;

      // 3. אם אין שיחה - נייצר אחת ריקה
      if (!currentConvoId) {
        const { data: newConvo, error: createErr } = await supabase
          .from('conversations')
          .insert({ user1_id: profile!.id, user2_id: otherUserId })
          .select()
          .single();
        
        if (createErr) throw createErr;
        currentConvoId = newConvo.id;
      }

      setConversationId(currentConvoId);

      // 4. משיכת הודעות
      const { data: msgs, error: msgErr } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', currentConvoId)
        .order('created_at', { ascending: true });

      if (msgErr) throw msgErr;
      setMessages(msgs || []);

      // 5. בדיקת חסימת DMs (דמי רצינות)
      // אם אין הודעות בכלל, והרמה שלו גבוהה משלי - נדרוש תשלום
      const myLevel = profile?.level || 1;
      const theirLevel = otherProfile.level || 1;
      
      if ((msgs || []).length === 0 && myLevel < theirLevel) {
        setFeeRequired(true);
      }

      // 6. הרשמה להודעות חדשות בזמן אמת (Real-time)
      const channel = supabase.channel(`chat_${currentConvoId}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages', 
          filter: `conversation_id=eq.${currentConvoId}` 
        }, (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          // אם קיבלנו הודעה, ברור שכבר לא צריך לשלם עמלה
          setFeeRequired(false);
          
          // סימון כנקרא אם אני פתוח על הצ'אט וההודעה לא שלי
          if (payload.new.sender_id !== profile!.id) {
            supabase.from('messages').update({ is_read: true }).eq('id', payload.new.id).then();
          }
        })
        .subscribe();

      // סימון הודעות קיימות כנקראו
      const unreadIds = (msgs || []).filter(m => !m.is_read && m.sender_id !== profile!.id).map(m => m.id);
      if (unreadIds.length > 0) {
        await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
      }

    } catch (err: any) {
      toast.error(err.message || 'שגיאה בטעינת הצ\'אט');
      navigate('/inbox');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !conversationId) return;

    // בדיקת ארנק אם דרוש תשלום
    if (feeRequired) {
      if ((profile?.crd_balance || 0) < DM_FEE) {
        triggerFeedback('error');
        return toast.error('אין לך מספיק CRD בארנק לדמי רצינות');
      }
    }

    setSending(true);
    triggerFeedback('pop');

    try {
      if (feeRequired) {
        // גביית דמי הרצינות (אופטימי לחזית, במציאות ייעשה דרך RPC מאובטח)
        const { error: feeErr } = await supabase
          .from('profiles')
          .update({ crd_balance: (profile!.crd_balance || 0) - DM_FEE })
          .eq('id', profile!.id);
        
        if (feeErr) throw new Error('שגיאה בגביית התשלום');
        
        setFeeRequired(false);
        triggerFeedback('coin');
        toast.success(`שולמו ${DM_FEE} CRD דמי רצינות!`);
      }

      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: profile!.id,
          content: newMessage.trim(),
          is_read: false
        });

      if (error) throw error;
      setNewMessage('');

    } catch (err: any) {
      toast.error('שגיאה בשליחת ההודעה');
    } finally {
      setSending(false);
    }
  };

  if (loading || !otherUser) {
    return <div className="min-h-[100dvh] bg-surface flex items-center justify-center"><Loader2 className="animate-spin text-accent-primary" size={32} /></div>;
  }

  const isVip = (otherUser.level || 1) > (profile?.level || 1);

  return (
    <FadeIn className="bg-surface h-[100dvh] font-sans flex flex-col relative overflow-hidden" dir="rtl">
      
      {/* 🔝 HEADER */}
      <div className="sticky top-0 z-[60] bg-surface/90 backdrop-blur-xl border-b border-surface-border pt-[env(safe-area-inset-top)] pb-3 px-2 shadow-sm flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-3 active:scale-90 transition-transform">
          <ChevronRight size={24} className="text-brand" />
        </button>
        
        <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => navigate(`/profile/${otherUser.id}`)}>
          <div className="w-10 h-10 rounded-full border border-surface-border overflow-hidden shrink-0 shadow-sm bg-surface-card flex items-center justify-center">
            {otherUser.avatar_url ? <img src={otherUser.avatar_url} className="w-full h-full object-cover" /> : <span className="text-brand-muted font-black text-sm">{(otherUser.full_name || 'א')[0]}</span>}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-brand font-black text-[16px]">{otherUser.full_name}</span>
              {otherUser.role_label === 'CORE' && <Crown size={12} className="text-accent-primary" />}
            </div>
            <span className="text-brand-muted text-[11px] font-bold tracking-widest uppercase">רמה {otherUser.level || 1}</span>
          </div>
        </div>
      </div>

      {/* 💬 MESSAGES AREA */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scrollbar-hide pb-24">
        
        {/* הודעת פתיחה מערכתית */}
        <div className="text-center my-6 flex flex-col items-center gap-2 opacity-60">
          <ShieldAlert size={24} className="text-brand-muted" />
          <span className="text-[11px] text-brand-muted font-black tracking-widest uppercase">השיחה מוצפנת ומאובטחת</span>
        </div>

        {messages.map((msg, idx) => {
          const isMe = msg.sender_id === profile!.id;
          const showAvatar = !isMe && (idx === 0 || messages[idx - 1].sender_id !== msg.sender_id);

          return (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex w-full ${isMe ? 'justify-start flex-row-reverse' : 'justify-start'}`}
            >
              {!isMe && (
                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 ml-2 mt-auto bg-surface-card border border-surface-border flex items-center justify-center">
                  {showAvatar ? (
                    otherUser.avatar_url ? <img src={otherUser.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={18} className="text-brand-muted" />
                  ) : <div className="w-full h-full" />}
                </div>
              )}
              
              <div className={`max-w-[75%] p-3.5 shadow-sm relative ${
                isMe 
                  ? 'bg-accent-primary text-white rounded-[24px] rounded-tl-sm' 
                  : 'bg-surface-card border border-surface-border text-brand rounded-[24px] rounded-tr-sm'
              }`}>
                <p className="text-[15px] font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <span className={`text-[9px] font-bold absolute bottom-1 ${isMe ? 'left-3 text-white/70' : 'right-3 text-brand-muted'} opacity-0`}>
                  {new Date(msg.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute:'2-digit' })}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 💡 INPUT AREA (With Fee Blocker) */}
      <div className="absolute bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-xl border-t border-surface-border p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
        
        <AnimatePresence>
          {feeRequired && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-full left-3 right-3 mb-3 bg-surface-card border border-accent-primary/40 p-4 rounded-[24px] shadow-lg flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-accent-primary/10 flex items-center justify-center shrink-0 border border-accent-primary/20">
                  <Lock size={18} className="text-accent-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="text-brand font-black text-[14px]">דמי רצינות נדרשים</span>
                  <span className="text-brand-muted text-[11px] leading-relaxed">
                    הרמה של {otherUser.full_name} גבוהה משלך. כדי לסנן ספאם ולהראות רצינות, ההודעה הראשונה דורשת תשלום.
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between bg-surface border border-surface-border rounded-xl px-4 py-2 mt-1">
                <span className="text-[11px] font-black uppercase tracking-widest text-brand-muted">עלות פתיחת ערוץ</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-brand font-black">{DM_FEE}</span>
                  <Coins size={14} className="text-accent-primary" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 items-center bg-surface-card rounded-full p-1.5 pl-2 border border-surface-border shadow-inner">
          <input 
            type="text" 
            value={newMessage} 
            onChange={(e) => setNewMessage(e.target.value)} 
            placeholder={feeRequired ? "שלם כדי לשלוח הודעה..." : "הודעה..."} 
            className="flex-1 bg-transparent px-4 text-brand text-[15px] font-medium outline-none placeholder:text-brand-muted" 
          />
          <button
            onClick={handleSendMessage}
            disabled={sending || !newMessage.trim()}
            className={`h-11 rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 px-5 gap-2 ${
              newMessage.trim() 
                ? feeRequired ? 'bg-accent-primary text-white' : 'bg-white text-black' 
                : 'bg-surface-border text-brand-muted opacity-30 w-11 px-0'
            }`}
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : (
              <>
                {feeRequired && newMessage.trim() && <span className="text-[12px] font-black tracking-widest pl-1 border-l border-white/20">שלם {DM_FEE}</span>}
                <Send size={18} className="rtl:-scale-x-100" />
              </>
            )}
          </button>
        </div>
      </div>

    </FadeIn>
  );
};
