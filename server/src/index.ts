import express from 'express';
import cors from 'cors';
import { supabase } from './lib/supabase';

// ייבוא הראוטרים המודולריים
import authRoutes from './routes/auth';
import circleRoutes from './routes/circles';
import feedRoutes from './routes/feed';
import postRoutes from './routes/posts';
import notifRoutes from './routes/notifications';
import profileRoutes from './routes/profile';
import walletRoutes from './routes/wallet';
import studioRoutes from './routes/studio';
import storeRoutes from './routes/store';
import paymentsRoutes from './routes/payments';
import creatorRoutes from './routes/creator';
import accountRoutes from './routes/account';

const app = express();
app.use(cors({ origin: true, credentials: true }));

// ה-Webhook חייב להיות *לפני* ה-express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

// לוגר תעבורה בסיסי
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// חיבור כל המודולים
app.use('/api/auth', authRoutes);
app.use('/api/circles', circleRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/studio', studioRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/creator', creatorRoutes);
app.use('/api/account', accountRoutes);

// נתיבים גלובליים (חיפוש ודיווח)
app.get('/api/discover', async (req, res) => {
  const q = String(req.query.q || '').trim();
  let query = supabase.from('circles').select('*').eq('is_active', true);
  if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  const { data } = await query.order('created_at', { ascending: false });
  res.json({ ok: true, items: data || [] });
});

app.post('/api/report', async (req, res) => {
  // בגרסת ייצור שומרים בטבלת reports
  res.json({ success: true, message: 'Report submitted' });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', port: 8080 }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 INNER API Server is running on port ${PORT}`);
});
