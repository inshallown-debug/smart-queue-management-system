// Handles email + SMS notifications.
// Email uses nodemailer (real SMTP if configured in .env).
// SMS uses Twilio if credentials are provided, otherwise it's simulated
// (logged to the console) so the whole app still works out of the box.

const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;
if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  // Lazy require so the app doesn't need twilio installed unless it's used
  try {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (e) {
    console.warn('Twilio package not installed — SMS will be simulated.');
  }
}

async function sendEmail(to, subject, text) {
  if (!transporter) {
    console.log(`📧 [SIMULATED EMAIL] to=${to} subject="${subject}" body="${text}"`);
    return { simulated: true };
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });
    return { simulated: false, sent: true };
  } catch (err) {
    console.error('Email send failed:', err.message);
    return { simulated: false, sent: false, error: err.message };
  }
}

async function sendSMS(to, body) {
  if (!twilioClient || !process.env.TWILIO_PHONE_NUMBER) {
    console.log(`📱 [SIMULATED SMS] to=${to} body="${body}"`);
    return { simulated: true };
  }
  try {
    await twilioClient.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
      body,
    });
    return { simulated: false, sent: true };
  } catch (err) {
    console.error('SMS send failed:', err.message);
    return { simulated: false, sent: false, error: err.message };
  }
}

// Convenience: notify a user through both channels about their token
async function notifyTokenEvent(user, token, eventType) {
  const messages = {
    booked: `Hi ${user.name}, your token ${token.token_number} is booked. We'll alert you as your turn approaches.`,
    almost: `Hi ${user.name}, you're next in line! Token ${token.token_number} — please head to counter now.`,
    called: `Hi ${user.name}, it's your turn now! Token ${token.token_number} — please proceed to the counter.`,
    completed: `Hi ${user.name}, thank you for visiting. Token ${token.token_number} has been served.`,
  };
  const body = messages[eventType] || `Update on your token ${token.token_number}: ${eventType}`;

  const results = {};
  if (user.email) {
    results.email = await sendEmail(user.email, 'Smart Queue Update', body);
  }
  if (user.phone) {
    results.sms = await sendSMS(user.phone, body);
  }
  return results;
}

module.exports = { sendEmail, sendSMS, notifyTokenEvent };
