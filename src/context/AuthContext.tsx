import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { triggerFeedback } from '../lib/sound';

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: any) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0); // סטייט גלובלי להתראות!

  const checkUnread = async (userId: string) => {
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false);
    setUnreadCount(count || 0);
  };

  const refreshProfile = async (userId: string) => {
    if (!userId) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data);
  };

  useEffect(() => {
    let channel: any;

    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user || null;
      setUser(currentUser);
      
      if (currentUser) {
        await refreshProfile(currentUser.id);
        await checkUnread(currentUser.id);

        // מאזין גלובלי - חי ונושם בכל האפליקציה!
        channel = supabase.channel('global_notifications')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` }, (payload) => {
            setUnreadCount(prev => prev + 1);
            triggerFeedback('success'); // רטט וסאונד ברגע שיש לייק/תגובה
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` }, () => {
            checkUnread(currentUser.id); // עדכון בעת סימון כנקרא
          })
          .subscribe();
      }
      setLoading(false);
    };
    
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        refreshProfile(session.user.id);
        checkUnread(session.user.id);
      } else {
        setProfile(null);
        setUnreadCount(0);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // פונקציה לאיפוס התראות מיידי מכל עמוד
  const markNotificationsRead = () => setUnreadCount(0);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, metadata: any) => {
    const { error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });
    if (error) throw error;
  };

  const signOut = async () => await supabase.auth.signOut();

  return (
    <AuthContext.Provider value={{ user, profile, loading, unreadCount, checkUnread, markNotificationsRead, signIn, signUp, signOut, refreshProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
