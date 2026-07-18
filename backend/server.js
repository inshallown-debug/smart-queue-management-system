require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const serviceRoutes = require('./routes/services');
const tokenRoutes = require('./routes/tokens');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173' },
});

// Make io available inside route handlers via req.app.get('io')
app.set('io', io);

io.on('connection', (socket) => {
  // Frontend joins a room per service to receive targeted live-queue pushes
  socket.on('join-service', (serviceId) => {
    socket.join(`service-${serviceId}`);
  });
});

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/tokens', tokenRoutes);   // also handles /api/tokens/live/:serviceId
app.use('/api/admin', adminRoutes);

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Smart Queue API running on http://localhost:${PORT}`);
});
