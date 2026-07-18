-- Smart Queue Management System - Database Schema
-- Run this once to create the database and tables:
--   mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS smart_queue_db;
USE smart_queue_db;

-- Users: both customers and admins live here, differentiated by `role`
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Services / Counters: e.g. "General Consultation", "Loan Desk", "Passport Renewal"
-- Each service has an average handling time used to estimate wait times.
CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  counter_number VARCHAR(20) NOT NULL DEFAULT '1',
  avg_service_minutes INT NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tokens: one row per booked token
CREATE TABLE IF NOT EXISTS tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token_number VARCHAR(20) NOT NULL,       -- e.g. "A-014"
  user_id INT NOT NULL,
  service_id INT NOT NULL,
  status ENUM('waiting', 'called', 'serving', 'completed', 'skipped', 'cancelled') NOT NULL DEFAULT 'waiting',
  queue_date DATE NOT NULL,                -- the day this token belongs to (queues reset daily)
  position_hint INT NOT NULL,              -- sequential number within service+date, used for display/order
  qr_code TEXT,                            -- base64 data URL of the QR code
  notified BOOLEAN NOT NULL DEFAULT FALSE, -- whether "you're next" alert was sent
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  called_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

CREATE INDEX idx_tokens_queue ON tokens (service_id, queue_date, status);

-- NOTE: The default admin user is created by running `npm run seed` (see utils/seed.js)
-- so the password hash is generated correctly by bcrypt at seed-time.

-- Seed some default services
INSERT INTO services (name, counter_number, avg_service_minutes) VALUES
('General Consultation', '1', 10),
('Account Services', '2', 15),
('Document Verification', '3', 8)
ON DUPLICATE KEY UPDATE name = name;
