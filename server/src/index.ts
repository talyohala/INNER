import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import circleRoutes from './routes/circles';
import circlePostsRoutes from './routes/circlePosts';
import feedRoutes from './routes/feed';
import postRoutes from './routes/posts';
import notifRoutes from './routes/notifications';
import profileRoutes from './routes/profile';
import walletRoutes from './routes/wallet';
import studioRoutes from './routes/studio';
import searchRoutes from './routes/search';

dotenv.config();

const app = express();

app.use(cors());

// התיקון הקריטי לבעיית הטקסט בפיד - נמצא כאן למעלה לפני כל הראוטים
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// החזרתי לך את כל הראוטים המקוריים שלא יילכו לאיבוד!
app.use('/api/auth', authRoutes);
app.use('/api/circles', circleRoutes);
app.use('/api/circles', circlePostsRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/studio', studioRoutes);
app.use('/api/search', searchRoutes);

// החזרתי את נתיבי הבדיקה שלך
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', port: Number(process.env.PORT) || 8080 });
});

app.get('/api/debug', (_req, res) => {
  res.json({ status: 'Server is reaching here!' });
});

const PORT = Number(process.env.PORT) || 8080;

// החזרתי את הגדרת ה-0.0.0.0 שקריטית ל-Render
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
