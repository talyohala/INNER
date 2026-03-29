import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import circlesRoutes from './routes/circles';
import feedRoutes from './routes/feed';
import postsRoutes from './routes/posts';
import profileRoutes from './routes/profile';
import searchRoutes from './routes/search';

dotenv.config();

const app = express();

app.use(cors());

// --- הפתרון הקריטי! ---
// חובה לשים את הפקודות האלו *כאן*, לפני כל הראוטים, 
// כדי שכל בקשה שנכנסת לשרת תפוענח אוטומטית כ-JSON.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// -----------------------

app.use('/api/auth', authRoutes);
app.use('/api/circles', circlesRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/search', searchRoutes);

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.  log(`Server running on port ${PORT}`);
});
