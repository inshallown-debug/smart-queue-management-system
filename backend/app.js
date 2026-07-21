require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const serviceRoutes = require('./routes/services');
const tokenRoutes = require('./routes/tokens');
const adminRoutes = require('./routes/admin');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

module.exports = app;