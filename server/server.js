const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const circleRoutes = require('./routes/circles');
const feedRoutes = require('./routes/feed');
const profileRoutes = require('./routes/profile');

const app = express();
app.use(cors());
app.use(express.json());

// לוגר - ידפיס כל בקשה שמגיעה לשרת
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/circles', circleRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/profile', profileRoutes);

const PORT = 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 INNER Server is LIVE on port ${PORT}`);
});
