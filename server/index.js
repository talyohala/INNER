const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/debug', (req, res) => {
  res.json({ status: 'Server is reaching here!' });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 REAL SERVER STARTED ON PORT ${PORT}`);
});
