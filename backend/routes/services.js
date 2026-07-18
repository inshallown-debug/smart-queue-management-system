const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// GET /api/services — public list of active services, used to populate the booking form
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, counter_number, avg_service_minutes FROM services WHERE is_active = TRUE ORDER BY name'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load services.' });
  }
});

module.exports = router;
