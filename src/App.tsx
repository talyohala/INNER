import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { RadarPage } from './pages/RadarPage';
import { ProfilePage } from './pages/ProfilePage';
import { EditProfilePage } from './pages/EditProfilePage';
import { CirclePage } from './pages/CirclePage';
import { CreateCirclePage } from './pages/CreateCirclePage';
import { CreateVaultPage } from './pages/CreateVaultPage';
import { WalletPage } from './pages/WalletPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { BoostStorePage } from './pages/BoostStorePage';
import { SettingsPage } from './pages/SettingsPage';
import { ChatPage } from './pages/ChatPage';
import { InboxPage } from './pages/InboxPage';
import { StudioPage } from './pages/StudioPage';
import { AdminPage } from './pages/AdminPage'; // הייבוא של האדמין

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface p-6 text-red-500 font-mono" dir="ltr">
          <h1 className="text-2xl font-bold mb-4 border-b border-red-500 pb-2">CRASH DETECTED</h1>
          <pre className="whitespace-pre-wrap text-sm bg-red-900/10 p-4 rounded-xl border border-red-500/30">{this.state.error?.toString()}</pre>
          <pre className="whitespace-pre-wrap text-xs mt-4 text-red-400/50">{this.state.error?.stack}</pre>
          <button onClick={() => window.location.reload()} className="mt-6 px-6 py-3 bg-red-500 text-white font-bold rounded-full">RELOAD APP</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-surface flex items-center justify-center text-accent-primary font-black tracking-widest">LOADING...</div>;
  if (!user) return <Navigate to="/auth" />;
  return <>{children}</>;
};

export const App = () => {
  useEffect(() => {
    document.body.style.backgroundColor = '#030303';
    document.documentElement.style.backgroundColor = '#030303';
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="bg-surface min-h-screen text-brand font-sans selection:bg-accent-primary/20 relative" dir="rtl">
            <Toaster position="top-center" toastOptions={{ style: { background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '100px', fontSize: '13px', fontWeight: 'bold' } }} />
            <Layout>
              <Routes>
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/" element={<PrivateRoute><HomePage /></PrivateRoute>} />
                <Route path="/explore" element={<PrivateRoute><ExplorePage /></PrivateRoute>} />
                <Route path="/radar" element={<PrivateRoute><RadarPage /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
                <Route path="/profile/:username" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
                <Route path="/edit-profile" element={<PrivateRoute><EditProfilePage /></PrivateRoute>} />
                <Route path="/circle/:slug" element={<PrivateRoute><CirclePage /></PrivateRoute>} />
                <Route path="/create-circle" element={<PrivateRoute><CreateCirclePage /></PrivateRoute>} />
                <Route path="/circle/:slug/vaults/create" element={<PrivateRoute><CreateVaultPage /></PrivateRoute>} />
                <Route path="/wallet" element={<PrivateRoute><WalletPage /></PrivateRoute>} />
                <Route path="/notifications" element={<PrivateRoute><NotificationsPage /></PrivateRoute>} />
                <Route path="/store" element={<PrivateRoute><BoostStorePage /></PrivateRoute>} />
                <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
                <Route path="/inbox" element={<PrivateRoute><InboxPage /></PrivateRoute>} />
                <Route path="/chat/:userId" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
                <Route path="/studio" element={<PrivateRoute><StudioPage /></PrivateRoute>} />
                
                {/* הראוט של האדמין מסודר ונקי */}
                <Route path="/admin" element={<PrivateRoute><AdminPage /></PrivateRoute>} />
                
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Layout>
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
