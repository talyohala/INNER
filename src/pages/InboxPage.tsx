import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { FadeIn } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import { Search, ChevronLeft, Loader2, UserCircle, MessageSquare, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export const InboxPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      fetchConversations();
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      // משיכת השיחות שבהן המשתמש מעורב
      const { data: convos, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`user1_id.eq.${profile!.id},user2_id.eq.${profile!.id}`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (!convos || convos.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // משיכת הפרופילים של האנשים שאיתם אנחנו מדברים
      const otherUserIds = convos.map(c => c.user1_id === profile!.id ? c.user2_id : c.user1_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role_label, level')
        .in('id', otherUserIds);

      // משיכת ההודעה האחרונה לכל שיחה (לשם התצוגה המקדימה)
      const convoIds = convos.map(c => c.id);
      const { data: lastMessages } = await supabase
        .from('messages')
        .select('conversation_id, content, created_at, is_read, sender_id')
        .in('conversation_id', convoIds)
        .order('created_at', { ascending: false });

      // מיזוג המידע
      const enrichedConvos = convos.map(c => {
        const otherId = c.user1_id === profile!.id ? c.user2_id : c.user1_id;
        const otherProfile = profiles?.find(p => p.id === otherId);
        
        // נמצא את ההודעה האחרונה השייכת לשיחה
        const convoMessages = lastMessages?.filter(m => m.conversation_id === c.id) || [];
        const lastMsg = convoMessages.length > 0 ? convoMessages[0] : null;

        return {
          ...c,
          other_user: otherProfile,
          last_message: lastMsg
        };
      });

      // נמיין מחדש לפי תאריך ההודעה האחרונה (אם יש)
      enrichedConvos.sort((a, b) => {
        const dateA = a.last_message ? new Date(a.last_message.created_at).getTime() : new Date(a.updated_at).getTime();
        const dateB = b.last_message ? new Date(b.last_message.created_at).getTime() : new Date(b.updated_at).getTime();
        return dateB - dateA;
      });

      setConversations(enrichedConvos);
    } catch (err) {
      toast.error('שגיאה בטעינת ההודעות');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async () => {
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, level')
        .or(`full_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`)
        .neq('id', profile!.id)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const openChat = (userId: string) => {
    triggerFeedback('pop');
    navigate(`/chat/${userId}`);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
  };

  return (
    <FadeIn className="pt-[calc(env(safe-area-inset-top)+12px)] pb-32 bg-surface min-h-screen font-sans flex flex-col" dir="rtl">
      
      {/* 🔝 HEADER & SEARCH (ללא קו תחתון מפריד) */}
      <div className="sticky top-0 z-[60] bg-surface/90 backdrop-blur-xl pt-4 pb-4 px-5">
        <div className="flex justify-between items-center mb-5">
          <h1 className="text-3xl font-black text-brand tracking-widest uppercase drop-shadow-sm">הודעות</h1>
          <button onClick={() => { triggerFeedback('pop'); document.getElementById('search-users')?.focus(); }} className="w-10 h-10 bg-accent-primary text-white rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-[0_4px_15px_rgba(var(--color-accent-primary),0.4)]">
            <Plus size={20} />
          </button>
        </div>

        <div className="relative">
          <Search size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-muted" />
          <input
            id="search-users"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חפש משתמשים להתחיל שיחה..."
            className="w-full bg-surface-card border border-surface-border text-brand font-medium h-[52px] rounded-full pr-12 pl-4 focus:outline-none focus:border-accent-primary/50 transition-all shadow-sm placeholder:text-brand-muted/50"
          />
        </div>
      </div>

      <div className="flex-1 px-4 mt-2 flex flex-col">
        <AnimatePresence mode="wait">
          
          {/* מצב 1: תוצאות חיפוש אנשים */}
          {searchQuery.trim() ? (
            <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
              <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest px-2 mt-2">תוצאות חיפוש</span>
              
              {searching ? (
                <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-accent-primary" /></div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-10 text-brand-muted font-bold text-[13px]">לא נמצאו משתמשים</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => openChat(user.id)}
                      className="flex items-center justify-between p-4 bg-surface-card border border-surface-border rounded-[24px] cursor-pointer hover:border-accent-primary/30 active:scale-[0.98] transition-all shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-surface border border-surface-border shrink-0 flex items-center justify-center shadow-inner">
                          {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : <UserCircle size={24} className="text-brand-muted" />}
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-brand font-black text-[15px]">{user.full_name}</span>
                          <span className="text-brand-muted text-[11px] font-bold tracking-widest uppercase mt-0.5">רמה {user.level || 1}</span>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-surface border border-surface-border flex items-center justify-center">
                        <MessageSquare size={14} className="text-brand-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            
            /* מצב 2: רשימת השיחות הקיימות (ללא קווי הפרדה, בועות נפרדות) */
            <motion.div key="inbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3 pt-2">
              {loading ? (
                <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-accent-primary" size={32} /></div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center opacity-50 mt-24 gap-4">
                  <MessageSquare size={48} className="text-brand-muted" strokeWidth={1} />
                  <span className="text-brand-muted font-black uppercase tracking-widest text-[13px]">תיבת ההודעות ריקה</span>
                </div>
              ) : (
                conversations.map((convo) => {
                  const otherUser = convo.other_user;
                  if (!otherUser) return null;

                  const lastMsg = convo.last_message;
                  const isUnread = lastMsg && !lastMsg.is_read && lastMsg.sender_id !== profile!.id;

                  return (
                    <div
                      key={convo.id}
                      onClick={() => openChat(otherUser.id)}
                      className={`flex items-center justify-between p-4 bg-surface-card border rounded-[24px] cursor-pointer active:scale-[0.98] transition-all shadow-sm ${
                        isUnread 
                          ? 'border-accent-primary/40 bg-accent-primary/5 shadow-[0_4px_15px_rgba(var(--color-accent-primary),0.05)]' 
                          : 'border-surface-border hover:border-accent-primary/20'
                      }`}
                    >
                      <div className="flex items-center gap-4 overflow-hidden">
                        <div className="relative shrink-0">
                          <div className="w-14 h-14 rounded-full overflow-hidden bg-surface border border-surface-border shadow-inner flex items-center justify-center">
                            {otherUser.avatar_url ? <img src={otherUser.avatar_url} className="w-full h-full object-cover" loading="lazy" /> : <span className="text-brand-muted font-black text-xl leading-none">{(otherUser.full_name || 'א')[0]}</span>}
                          </div>
                          {isUnread && <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-accent-primary border-2 border-surface-card rounded-full shadow-[0_0_8px_rgba(var(--color-accent-primary),0.8)]" />}
                        </div>

                        <div className="flex flex-col text-right overflow-hidden flex-1 justify-center">
                          <span className={`font-black text-[16px] truncate ${isUnread ? 'text-brand' : 'text-brand/90'}`}>{otherUser.full_name}</span>
                          <span className={`text-[13px] truncate mt-0.5 ${isUnread ? 'text-accent-primary font-bold' : 'text-brand-muted font-medium'}`}>
                            {lastMsg ? (lastMsg.sender_id === profile!.id ? `את/ה: ${lastMsg.content}` : lastMsg.content) : 'אין הודעות'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end justify-center gap-2 shrink-0 ml-1">
                        <span className={`text-[10px] font-bold tracking-wider ${isUnread ? 'text-accent-primary' : 'text-brand-muted/70'}`}>
                          {lastMsg ? formatTime(lastMsg.created_at) : ''}
                        </span>
                        <ChevronLeft size={16} className={isUnread ? 'text-accent-primary' : 'text-brand-muted/40'} />
                      </div>
                    </div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FadeIn>
  );
};
