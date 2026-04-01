import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { ProfilePage } from './pages/ProfilePage';
import { EditProfilePage } from './pages/EditProfilePage';
import { CirclePage } from './pages/CirclePage';
import { CreateCirclePage } from './pages/CreateCirclePage';
import { WalletPage } from './pages/WalletPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { BoostStorePage } from './pages/BoostStorePage';
import { SettingsPage } from './pages/SettingsPage';
import { ChatPage } from './pages/ChatPage'; // נוסף!

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black p-6 text-red-500 font-mono" dir="ltr">
          <h1 className="text-2xl font-bold mb-4 border-b border-red-500 pb-2">CRASH DETECTED</h1>
          <pre className="whitespace-pre-wrap text-sm bg-red-900/20 p-4 rounded-xl border border-red-500/30">{this.state.error?.toString()}</pre>
          <pre className="whitespace-pre-wrap text-xs mt-4 text-red-400/50">{this.state.error?.stack}</pre>
          <button onClick={() => window.location.reload()} className="mt-6 px-6 py-3 bg-red-500 text-black font-bold rounded-full">RELOAD APP</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#030303] flex items-center justify-center text-white/20 font-black tracking-widest">LOADING...</div>;
  if (!user) return <Navigate to="/auth" />;
  return <>{children}</>;
};

export const App = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="bg-[#030303] min-h-screen text-white font-sans selection:bg-white/20 relative" dir="rtl">
            <Toaster position="top-center" toastOptions={{ style: { background: '#0A0A0A', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontSize: '12px', fontWeight: 'bold' } }} />
            <Layout>
              <Routes>
                <Route path="/auth" element={<AuthPage />} />
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
                <Route path="/chat/:userId" element={<PrivateRoute><ChatPage /></PrivateRoute>} /> {/* הנתיב החדש */}
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
