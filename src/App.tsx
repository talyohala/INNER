import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';

// Components
import { Layout } from './components/Layout';

// Pages
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage'; // <-- הנה השינוי הקריטי!
import { ExplorePage } from './pages/ExplorePage';
import { ProfilePage } from './pages/ProfilePage';
import { EditProfilePage } from './pages/EditProfilePage';
import { CirclePage } from './pages/CirclePage';
import { CreateCirclePage } from './pages/CreateCirclePage';
import { WalletPage } from './pages/WalletPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { BoostStorePage } from './pages/BoostStorePage';
import { SettingsPage } from './pages/SettingsPage';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const isStandaloneMode = () => {
  if (typeof window === 'undefined') return false;
  const byMedia = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  const byNavigator = typeof navigator !== 'undefined' && 'standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return byMedia || byNavigator;
};

const InstallAppPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(isStandaloneMode());
  const [isInstalling, setIsInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setDismissed(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const canShow = useMemo(() => {
    return !isInstalled && !dismissed && !!deferredPrompt;
  }, [isInstalled, dismissed, deferredPrompt]);

  const handleInstall = async () => {
    if (!deferredPrompt || isInstalling) return;
    try {
      setIsInstalling(true);
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Install prompt failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  if (!canShow) return null;

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[999] w-[calc(100%-24px)] max-w-md">
      <div className="rounded-[24px] border border-white/10 bg-[#0A0A0A]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-[16px] bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <span className="text-white text-lg">⬇️</span>
          </div>
          <div className="flex-1 text-right">
            <div className="text-white font-black text-sm">התקן את INNER</div>
            <div className="text-white/50 text-[11px] font-bold mt-1 leading-5">התקנה מלאה למסך הבית עם פתיחה כמו אפליקציה</div>
            <div className="flex items-center justify-end gap-2 mt-3">
              <button type="button" onClick={() => setDismissed(true)} className="h-10 px-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 text-xs font-black active:scale-95 transition-all">אחר כך</button>
              <button type="button" onClick={handleInstall} disabled={isInstalling} className="h-10 px-5 rounded-2xl bg-white text-black text-xs font-black active:scale-95 transition-all disabled:opacity-60">{isInstalling ? 'טוען...' : 'התקן אפליקציה'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center text-white/20 font-black tracking-widest">
        LOADING...
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" />;
  return <>{children}</>;
};

export const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="bg-[#030303] min-h-screen text-white font-sans selection:bg-white/20 relative" dir="rtl">
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: '#0A0A0A',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: 'bold'
              }
            }}
          />
          <InstallAppPrompt />
          <Layout>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              {/* החלפנו את HomePage ב-FeedPage! */}
              <Route path="/" element={<PrivateRoute><HomePage /></PrivateRoute>} />
              <Route path="/explore" element={<PrivateRoute><ExplorePage /></PrivateRoute>} />
              <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
              <Route path="/profile/:username" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
              <Route path="/edit-profile" element={<PrivateRoute><EditProfilePage /></PrivateRoute>} />
              <Route path="/circle/:slug" element={<PrivateRoute><CirclePage /></PrivateRoute>} />
              <Route path="/create-circle" element={<PrivateRoute><CreateCirclePage /></PrivateRoute>} />
              <Route path="/wallet" element={<PrivateRoute><WalletPage /></PrivateRoute>} />
              <Route path="/notifications" element={<PrivateRoute><NotificationsPage /></PrivateRoute>} />
              <Route path="/store" element={<PrivateRoute><BoostStorePage /></PrivateRoute>} />
              <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Layout>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
