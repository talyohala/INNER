import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import circleRoutes from './routes/circles';
import circlePostsRoutes from './routes/circlePosts';
import feedRoutes from './routes/feed';
import postRoutes from './routes/posts';
import notifRoutes from './routes/notifications';
import profileRoutes from './routes/profile';
import walletRoutes from './routes/wallet';
import studioRoutes from './routes/studio';
import storeRoutes from './routes/store';
import paymentsRoutes from './routes/payments';

const app = express();
app.use(cors({ origin: true, credentials: true }));

// ה-Webhook חייב להיות *לפני* ה-express.json() ולהשתמש ב-express.raw()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/circles', circleRoutes);
app.use('/api/circles', circlePostsRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/studio', studioRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/payments', paymentsRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', port: 8080 }));

const PORT = 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 INNER Server is LIVE on port ${PORT}`);
});
