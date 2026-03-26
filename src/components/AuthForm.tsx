import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { GlassCard, Input, Button } from './ui';

export const AuthForm: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password || (mode === 'signup' && !username)) {
      toast.error('נא למלא את כל השדות');
      return;
    }

    try {
      setLoading(true);
      if (mode === 'signin') {
        await signIn(email, password);
        toast.success('התחברת בהצלחה');
      } else {
        await signUp(email, password, username);
        toast.success('החשבון נוצר. אם הפעלת אימות אימייל, אשר אותו ואז התחבר');
      }
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בהתחברות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard className="w-full max-w-[420px] relative z-10">
      <div className="text-[12px] tracking-[0.35em] text-[#ffdfbf] mb-2 uppercase">INNER</div>
      <h1 className="text-3xl font-bold mb-2">מעגלים פנימיים</h1>
      <p className="text-muted leading-relaxed mb-5">קהילות סגורות, דרופים, צ׳אט חי, סטטוס והשפעה אמיתית.</p>

      <div className="grid grid-cols-2 gap-2 mb-4 p-1 bg-black/20 rounded-2xl border border-white/5">
        <button 
          className={`py-2 rounded-xl text-sm font-medium transition-colors ${mode === 'signin' ? 'bg-white/10 text-white shadow-sm' : 'text-muted hover:text-white'}`} 
          onClick={() => setMode('signin')}
        >
          התחברות
        </button>
        <button 
          className={`py-2 rounded-xl text-sm font-medium transition-colors ${mode === 'signup' ? 'bg-white/10 text-white shadow-sm' : 'text-muted hover:text-white'}`} 
          onClick={() => setMode('signup')}
        >
          הרשמה
        </button>
      </div>

      <div className="flex flex-col gap-6 mb-5">
        {mode === 'signup' && (
          <Input placeholder="שם משתמש" value={username} onChange={(e) => setUsername(e.target.value)} disabled={loading} />
        )}
        <Input placeholder="אימייל" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} autoCapitalize="none" dir="ltr" />
        <Input placeholder="סיסמה" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} dir="ltr" />
      </div>

      <Button onClick={submit} disabled={loading} className="w-full">
        {loading ? 'טוען...' : mode === 'signin' ? 'התחבר' : 'צור חשבון'}
      </Button>
    </GlassCard>
  );
};
