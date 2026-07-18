const express = require('express');
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { notifyTokenEvent } = require('../utils/notify');

const router = express.Router();

// Every route here requires a logged-in admin
router.use(authenticate, requireRole('admin'));

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function emitQueueUpdate(req, serviceId) {
  req.app.get('io')?.to(`service-${serviceId}`).emit('queue-updated', { serviceId });
}

// GET /api/admin/queue/:serviceId — full ordered list of today's tokens for a service
router.get('/queue/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const [rows] = await pool.query(
      `SELECT t.*, u.name AS customer_name, u.email, u.phone
       FROM tokens t JOIN users u ON t.user_id = u.id
       WHERE t.service_id = ? AND t.queue_date = ?
       ORDER BY FIELD(t.status,'serving','called','waiting','completed','skipped','cancelled'), t.position_hint ASC`,
      [serviceId, todayStr()]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load queue.' });
  }
});

// GET /api/admin/stats — dashboard summary across all services, today
router.get('/stats', async (req, res) => {
  try {
    const queueDate = todayStr();
    const [byService] = await pool.query(
      `SELECT s.id, s.name, s.counter_number,
              SUM(t.status='waiting') AS waiting,
              SUM(t.status='called') AS called,
              SUM(t.status='serving') AS serving,
              SUM(t.status='completed') AS completed,
              SUM(t.status='skipped') AS skipped,
              COUNT(t.id) AS total
       FROM services s
       LEFT JOIN tokens t ON t.service_id = s.id AND t.queue_date = ?
       WHERE s.is_active = TRUE
       GROUP BY s.id, s.name, s.counter_number
       ORDER BY s.name`,
      [queueDate]
    );
    res.json({ date: queueDate, services: byService });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load stats.' });
  }
});

// Helper to load + validate a token belongs to today
async function loadToken(id) {
  const [rows] = await pool.query('SELECT * FROM tokens WHERE id = ?', [id]);
  return rows[0] || null;
}

// POST /api/admin/tokens/:id/call — call this token up (waiting -> called), notifies customer
router.post('/tokens/:id/call', async (req, res) => {
  try {
    const token = await loadToken(req.params.id);
    if (!token) return res.status(404).json({ message: 'Token not found.' });

    await pool.query("UPDATE tokens SET status = 'called', called_at = NOW() WHERE id = ?", [token.id]);

    const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [token.user_id]);
    notifyTokenEvent(user, token, 'called').catch(() => {});
    emitQueueUpdate(req, token.service_id);

    res.json({ message: `Token ${token.token_number} called.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not call token.' });
  }
});

// POST /api/admin/tokens/:id/serve — mark as currently being served (called -> serving)
router.post('/tokens/:id/serve', async (req, res) => {
  try {
    const token = await loadToken(req.params.id);
    if (!token) return res.status(404).json({ message: 'Token not found.' });

    await pool.query("UPDATE tokens SET status = 'serving' WHERE id = ?", [token.id]);
    emitQueueUpdate(req, token.service_id);

    res.json({ message: `Token ${token.token_number} is now being served.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update token.' });
  }
});

// POST /api/admin/tokens/:id/complete — mark as done, notifies customer
router.post('/tokens/:id/complete', async (req, res) => {
  try {
    const token = await loadToken(req.params.id);
    if (!token) return res.status(404).json({ message: 'Token not found.' });

    await pool.query("UPDATE tokens SET status = 'completed', completed_at = NOW() WHERE id = ?", [
      token.id,
    ]);

    const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [token.user_id]);
    notifyTokenEvent(user, token, 'completed').catch(() => {});
    emitQueueUpdate(req, token.service_id);

    res.json({ message: `Token ${token.token_number} completed.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update token.' });
  }
});

// POST /api/admin/tokens/:id/skip — customer was absent when called
router.post('/tokens/:id/skip', async (req, res) => {
  try {
    const token = await loadToken(req.params.id);
    if (!token) return res.status(404).json({ message: 'Token not found.' });

    await pool.query("UPDATE tokens SET status = 'skipped' WHERE id = ?", [token.id]);
    emitQueueUpdate(req, token.service_id);

    res.json({ message: `Token ${token.token_number} marked as skipped.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update token.' });
  }
});

// --- Service management ---

// POST /api/admin/services — add a new service/counter
router.post('/services', async (req, res) => {
  try {
    const { name, counterNumber, avgServiceMinutes } = req.body;
    if (!name) return res.status(400).json({ message: 'Service name is required.' });

    const [result] = await pool.query(
      'INSERT INTO services (name, counter_number, avg_service_minutes) VALUES (?, ?, ?)',
      [name, counterNumber || '1', avgServiceMinutes || 10]
    );
    res.status(201).json({ id: result.insertId, name, counterNumber, avgServiceMinutes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not create service.' });
  }
});

// PUT /api/admin/services/:id — edit a service
router.put('/services/:id', async (req, res) => {
  try {
    const { name, counterNumber, avgServiceMinutes, isActive } = req.body;
    await pool.query(
      `UPDATE services SET name = COALESCE(?, name), counter_number = COALESCE(?, counter_number),
       avg_service_minutes = COALESCE(?, avg_service_minutes), is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name, counterNumber, avgServiceMinutes, isActive, req.params.id]
    );
    res.json({ message: 'Service updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update service.' });
  }
});

// GET /api/admin/services — list all (including inactive) for management screen
router.get('/services', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM services ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load services.' });
  }
});

module.exports = router;
