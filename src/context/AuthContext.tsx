import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { triggerFeedback } from '../lib/sound';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: any) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingSignalsCount, setPendingSignalsCount] = useState(0);

  const notificationsChannelRef = useRef<any>(null);

  // התיקון: החזרנו את קפיצת האישור! עכשיו זה בטוח כי יש google-services.json
  const registerForPushNotifications = async (userId: string) => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      let permStatus = await PushNotifications.checkPermissions();
      
      if (permStatus.receive === 'prompt') {
        // עכשיו זה יקפיץ את החלון של אנדרואיד בלי לקרוס!
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('User denied push permissions');
        return;
      }

      await PushNotifications.register();
      
      PushNotifications.addListener('registration', async (token) => {
        console.log('Push token:', token.value);
        await supabase.from('profiles').update({ push_token: token.value }).eq('id', userId);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        triggerFeedback('success');
        toast.success(`התראה: ${notification.title}`);
      });
    } catch (e) {
      console.error('Push error', e);
    }
  };

  const checkUnread = useCallback(async (userId: string) => {
    if (!userId) { setUnreadCount(0); return 0; }
    try {
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false);
      setUnreadCount(count || 0); return count || 0;
    } catch (err) { return 0; }
  }, []);

  const checkSignals = useCallback(async (userId: string) => {
    if (!userId) { setPendingSignalsCount(0); return 0; }
    try {
      const { count } = await supabase.from('signals').select('*', { count: 'exact', head: true }).eq('to_user_id', userId).eq('status', 'pending');
      setPendingSignalsCount(count || 0); return count || 0;
    } catch (err) { return 0; }
  }, []);

  const refreshProfile = useCallback(async (userId: string) => {
    if (!userId) { setProfile(null); return null; }
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      setProfile(data || null); return data || null;
    } catch (err) { setProfile(null); return null; }
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
      .channel(`global_alerts_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, async () => {
        await checkUnread(userId); triggerFeedback('success');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'signals', filter: `to_user_id=eq.${userId}` }, async () => {
        await checkSignals(userId); triggerFeedback('success');
      })
      .subscribe();

    notificationsChannelRef.current = channel;
  }, [checkUnread, checkSignals, detachNotificationsChannel]);

  const markNotificationsRead = useCallback(async () => {
    if (!user?.id) return;
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
      setUnreadCount(0);
    } catch (err) {}
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user || null;

        if (!mounted) return;
        setUser(currentUser);

        if (currentUser) {
          await Promise.all([refreshProfile(currentUser.id), checkUnread(currentUser.id), checkSignals(currentUser.id)]);
          await attachNotificationsChannel(currentUser.id);
          // קורא לפוש אחרי שהכל מוכן
          registerForPushNotifications(currentUser.id);
        } else {
          setProfile(null); setUnreadCount(0); setPendingSignalsCount(0);
        }
      } catch (err) {} finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user || null;
      setUser(nextUser);

      if (nextUser) {
        await Promise.all([refreshProfile(nextUser.id), checkUnread(nextUser.id), checkSignals(nextUser.id)]);
        await attachNotificationsChannel(nextUser.id);
        registerForPushNotifications(nextUser.id);
      } else {
        detachNotificationsChannel();
        setProfile(null); setUnreadCount(0); setPendingSignalsCount(0);
      }
      setLoading(false);
    });

    return () => { mounted = false; subscription.unsubscribe(); detachNotificationsChannel(); };
  }, [attachNotificationsChannel, checkUnread, checkSignals, detachNotificationsChannel, refreshProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, metadata: any) => {
    const { error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });
    if (error) throw error;
  };

  const signOut = async () => {
    detachNotificationsChannel();
    setUnreadCount(0); setPendingSignalsCount(0); setProfile(null); setUser(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, unreadCount, pendingSignalsCount, checkUnread, checkSignals, markNotificationsRead, signIn, signUp, signOut, refreshProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
