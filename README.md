# QueueFlow — Smart Queue Management System

A full-stack app that lets clinics, banks, and government offices replace
physical waiting lines with online tokens: customers book a slot, see their
live position and estimated wait, and get an email/SMS alert as their turn
approaches. Admins run the line from a live dashboard.

**Tech stack:** React (Vite) · Node.js/Express · MySQL · JWT auth · Socket.IO (live queue) · QR codes · Nodemailer/Twilio (notifications)

This project has been built and tested end-to-end (registration, login,
booking, QR generation, live queue, admin call/serve/complete flow, and
role-based access control all verified working against a real MySQL
database during development).

---

## 1. Features

- **Online token generation** — pick a service, get a token instantly (e.g. `G-001`)
- **Estimated waiting time** — calculated from people ahead × average service time per counter
- **Live queue** — real-time "Now Serving" board pushed over Socket.IO (with a polling fallback)
- **Admin dashboard** — per-service queue, one-click Call / Start Serving / Mark Done / Skip, daily stats
- **SMS/Email notifications** — booking confirmation + "it's your turn" alerts (simulated out of the box, real providers optional)
- **QR code per token** — generated at booking time, shown in "My tokens"
- **JWT authentication** — customer and admin roles, protected routes on both ends

---

## 2. Project structure

```
smart-queue-system/
├── backend/          Express API + MySQL
│   ├── config/db.js       MySQL connection pool
│   ├── routes/            auth, services, tokens, admin
│   ├── middleware/auth.js JWT verification + role guard
│   ├── utils/             QR generation, notifications, admin seed script
│   ├── schema.sql         database schema
│   └── server.js
└── frontend/          React (Vite)
    └── src/
        ├── pages/         Home, Login, Register, BookToken, MyTokens, AdminDashboard
        ├── components/    Navbar, LiveBoard, TokenCard, ProtectedRoute
        └── context/       AuthContext (JWT stored in localStorage)
```

---

## 3. Prerequisites

- Node.js 18+
- MySQL 8 (or MariaDB) running locally or reachable remotely

---

## 4. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
- Set `DB_USER` / `DB_PASSWORD` / `DB_NAME` to match your MySQL setup.
- `JWT_SECRET` — set this to any long random string.
- SMTP and Twilio settings are **optional**. Leave them blank and the app
  will just log notifications to the console instead of sending them —
  everything else keeps working.

Create the database and tables:

```bash
mysql -u root -p < schema.sql
```

Seed the default admin account (email/password printed to console):

```bash
npm run seed
```

Start the API:

```bash
npm run dev      # with auto-reload, or:
npm start
```

The API runs on `http://localhost:5000` by default. Check `GET /api/health`.

---

## 5. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. Vite proxies nothing special — the frontend
talks directly to `VITE_API_URL` (defaults to `http://localhost:5000/api`).

---

## 6. Using the app

**As a customer:**
1. Sign up at `/register`.
2. Go to **Book a token**, choose a service, and book — you'll get a token
   number, QR code, and live wait estimate.
3. **My tokens** shows your active token's position and updates live as the
   admin moves the queue forward.

**As an admin:**
1. Log in with the seeded admin account (`admin@smartqueue.com` /
   `Admin@123` — change this password in production).
2. Go to **Admin dashboard**. Pick a service tab, then walk each token
   through **Call next → Start serving → Mark done** (or **Skip** if the
   customer doesn't show up). Stats update in real time.

---

## 7. Notes on notifications

- **Email**: uses SMTP via Nodemailer. For Gmail, create an
  [App Password](https://support.google.com/accounts/answer/185833) and use
  that instead of your normal password.
- **SMS**: uses Twilio if `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and
  `TWILIO_PHONE_NUMBER` are set. Twilio isn't installed by default (it's not
  in `package.json`) — run `npm install twilio` in `backend/` if you want to
  enable real SMS. Without it, SMS is simulated (logged to the console),
  which is convenient for local development and demos.

---

## 8. Security notes before going to production

- Change the seeded admin password immediately (`npm run seed` again with a
  new password, or add an "edit profile" flow).
- Set a strong, random `JWT_SECRET`.
- Serve both apps over HTTPS and set `CLIENT_URL`/CORS accordingly.
- Consider rate-limiting `/api/auth/login` and `/api/auth/register`.
- The `queue_date` field resets queues daily — for offices open multiple
  shifts per day you may want to add a shift/session concept.
