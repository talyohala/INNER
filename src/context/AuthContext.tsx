import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { triggerFeedback } from '../lib/sound';

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: any) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const notificationsChannelRef = useRef<any>(null);

  const checkUnread = useCallback(async (userId: string) => {
    if (!userId) {
      setUnreadCount(0);
      return 0;
    }

    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      const nextCount = count || 0;
      setUnreadCount(nextCount);
      return nextCount;
    } catch (err) {
      console.error('checkUnread error:', err);
      return 0;
    }
  }, []);

  const refreshProfile = useCallback(async (userId: string) => {
    if (!userId) {
      setProfile(null);
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      setProfile(data || null);
      return data || null;
    } catch (err) {
      console.error('refreshProfile error:', err);
      setProfile(null);
      return null;
    }
  }, []);

  const detachNotificationsChannel = useCallback(() => {
    if (notificationsChannelRef.current) {
      supabase.removeChannel(notificationsChannelRef.current);
      notificationsChannelRef.current = null;
    }
  }, []);

  const attachNotificationsChannel = useCallback(async (userId: string) => {
    if (!userId) return;

    detachNotificationsChannel();

    const channel = supabase
      .channel(`global_notifications_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          setUnreadCount((prev: number) => prev + 1);
          triggerFeedback('success');
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          await checkUnread(userId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          await checkUnread(userId);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Notifications realtime connected:', userId);
        }
      });

    notificationsChannelRef.current = channel;
  }, [checkUnread, detachNotificationsChannel]);

  const markNotificationsRead = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      setUnreadCount(0);
    } catch (err) {
      console.error('markNotificationsRead error:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const currentUser = session?.user || null;

        if (!mounted) return;

        setUser(currentUser);

        if (currentUser) {
          await Promise.all([
            refreshProfile(currentUser.id),
            checkUnread(currentUser.id),
          ]);

          await attachNotificationsChannel(currentUser.id);
        } else {
          setProfile(null);
          setUnreadCount(0);
        }
      } catch (err) {
        console.error('initAuth error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user || null;

      setUser(nextUser);

      if (nextUser) {
        await Promise.all([
          refreshProfile(nextUser.id),
          checkUnread(nextUser.id),
        ]);

        await attachNotificationsChannel(nextUser.id);
      } else {
        detachNotificationsChannel();
        setProfile(null);
        setUnreadCount(0);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      detachNotificationsChannel();
    };
  }, [attachNotificationsChannel, checkUnread, detachNotificationsChannel, refreshProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, metadata: any) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    detachNotificationsChannel();
    setUnreadCount(0);
    setProfile(null);
    setUser(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        unreadCount,
        checkUnread,
        markNotificationsRead,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
