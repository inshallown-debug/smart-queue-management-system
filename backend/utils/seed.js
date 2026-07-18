// Creates (or resets) the default admin account.
// Run with: npm run seed
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const ADMIN_EMAIL = 'admin@smartqueue.com';
const ADMIN_PASSWORD = 'Admin@123'; // change this after first login!

(async () => {
  try {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [ADMIN_EMAIL]);

    if (existing.length > 0) {
      await pool.query('UPDATE users SET password_hash = ?, role = ? WHERE email = ?', [
        hash,
        'admin',
        ADMIN_EMAIL,
      ]);
      console.log('🔄 Admin user already existed — password reset.');
    } else {
      await pool.query(
        'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
        ['System Admin', ADMIN_EMAIL, '0000000000', hash, 'admin']
      );
      console.log('✅ Admin user created.');
    }

    console.log('   Email:   ', ADMIN_EMAIL);
    console.log('   Password:', ADMIN_PASSWORD);
    console.log('   ⚠️  Change this password after logging in.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
})();
