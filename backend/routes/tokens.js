const express = require('express');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { generateTokenQR } = require('../utils/qrcode');
const { notifyTokenEvent } = require('../utils/notify');

const router = express.Router();

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// Active = still ahead in the line (counts toward wait time / position)
const ACTIVE_STATUSES = ['waiting', 'called', 'serving'];

// Computes: how many active tokens are ahead of this one, and the estimated wait
async function getQueueContext(serviceId, queueDate, positionHint) {
  const [[{ avg_service_minutes }]] = await pool.query(
    'SELECT avg_service_minutes FROM services WHERE id = ?',
    [serviceId]
  );
  const [ahead] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM tokens
     WHERE service_id = ? AND queue_date = ? AND position_hint < ?
       AND status IN ('waiting','called','serving')`,
    [serviceId, queueDate, positionHint]
  );
  const peopleAhead = ahead[0].cnt;
  return {
    peopleAhead,
    estimatedWaitMinutes: peopleAhead * avg_service_minutes,
  };
}

// POST /api/tokens — book a new token (customer)
router.post('/', authenticate, async (req, res) => {
  try {
    const { serviceId } = req.body;
    if (!serviceId) return res.status(400).json({ message: 'serviceId is required.' });

    const [services] = await pool.query('SELECT * FROM services WHERE id = ? AND is_active = TRUE', [
      serviceId,
    ]);
    if (services.length === 0) return res.status(404).json({ message: 'Service not found.' });
    const service = services[0];

    const queueDate = todayStr();

    // Prevent someone from double-booking the same service on the same day while still waiting
    const [dupe] = await pool.query(
      `SELECT id FROM tokens WHERE user_id = ? AND service_id = ? AND queue_date = ?
       AND status IN ('waiting','called','serving')`,
      [req.user.id, serviceId, queueDate]
    );
    if (dupe.length > 0) {
      return res.status(409).json({ message: 'You already have an active token for this service today.' });
    }

    const [[{ cnt }]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM tokens WHERE service_id = ? AND queue_date = ?',
      [serviceId, queueDate]
    );
    const positionHint = cnt + 1;
    const prefix = service.name.trim().charAt(0).toUpperCase();
    const tokenNumber = `${prefix}-${String(positionHint).padStart(3, '0')}`;

    const [result] = await pool.query(
      `INSERT INTO tokens (token_number, user_id, service_id, status, queue_date, position_hint)
       VALUES (?, ?, ?, 'waiting', ?, ?)`,
      [tokenNumber, req.user.id, serviceId, queueDate, positionHint]
    );

    const tokenRow = {
      id: result.insertId,
      token_number: tokenNumber,
      service_id: serviceId,
      queue_date: queueDate,
    };
    const qrCode = await generateTokenQR(tokenRow);
    await pool.query('UPDATE tokens SET qr_code = ? WHERE id = ?', [qrCode, result.insertId]);

    const context = await getQueueContext(serviceId, queueDate, positionHint);

    // Fire-and-forget notification + live queue push
    notifyTokenEvent(req.user, tokenRow, 'booked').catch(() => {});
    req.app.get('io')?.to(`service-${serviceId}`).emit('queue-updated', { serviceId });

    res.status(201).json({
      id: result.insertId,
      tokenNumber,
      serviceId,
      serviceName: service.name,
      counterNumber: service.counter_number,
      status: 'waiting',
      queueDate,
      qrCode,
      ...context,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Booking failed. Please try again.' });
  }
});

// GET /api/tokens/my — the logged-in user's tokens (today first, then history)
router.get('/my', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, s.name AS service_name, s.counter_number, s.avg_service_minutes
       FROM tokens t JOIN services s ON t.service_id = s.id
       WHERE t.user_id = ?
       ORDER BY t.created_at DESC LIMIT 20`,
      [req.user.id]
    );

    const withContext = await Promise.all(
      rows.map(async (r) => {
        const context = ACTIVE_STATUSES.includes(r.status)
          ? await getQueueContext(r.service_id, r.queue_date, r.position_hint)
          : { peopleAhead: 0, estimatedWaitMinutes: 0 };
        return { ...r, ...context };
      })
    );

    res.json(withContext);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load your tokens.' });
  }
});

// GET /api/tokens/:id — single token detail (for the "my token" / QR view)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, s.name AS service_name, s.counter_number, s.avg_service_minutes
       FROM tokens t JOIN services s ON t.service_id = s.id
       WHERE t.id = ? AND (t.user_id = ? OR ? = 'admin')`,
      [req.params.id, req.user.id, req.user.role]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Token not found.' });
    const t = rows[0];
    const context = ACTIVE_STATUSES.includes(t.status)
      ? await getQueueContext(t.service_id, t.queue_date, t.position_hint)
      : { peopleAhead: 0, estimatedWaitMinutes: 0 };
    res.json({ ...t, ...context });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load token.' });
  }
});

// GET /api/queue/live/:serviceId — public live queue board (now serving + waiting count)
router.get('/live/:serviceId', async (req, res) => {
  try {
    const serviceId = req.params.serviceId;
    const queueDate = todayStr();

    const [serving] = await pool.query(
      `SELECT token_number FROM tokens WHERE service_id = ? AND queue_date = ? AND status = 'serving'
       ORDER BY called_at DESC LIMIT 1`,
      [serviceId, queueDate]
    );
    const [called] = await pool.query(
      `SELECT token_number FROM tokens WHERE service_id = ? AND queue_date = ? AND status = 'called'
       ORDER BY called_at DESC LIMIT 1`,
      [serviceId, queueDate]
    );
    const [[{ waitingCount }]] = await pool.query(
      `SELECT COUNT(*) AS waitingCount FROM tokens WHERE service_id = ? AND queue_date = ? AND status = 'waiting'`,
      [serviceId, queueDate]
    );

    res.json({
      serviceId: Number(serviceId),
      nowServing: serving[0]?.token_number || called[0]?.token_number || null,
      waitingCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load live queue.' });
  }
});

module.exports = router;
