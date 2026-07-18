const QRCode = require('qrcode');

// Encodes a small JSON payload identifying the token so a scanner (or the
// admin's own scan-in-dashboard feature) can look it up instantly.
async function generateTokenQR(token) {
  const payload = JSON.stringify({
    tokenId: token.id,
    tokenNumber: token.token_number,
    serviceId: token.service_id,
    date: token.queue_date,
  });

  try {
    // Returns a base64 data URL — easy to store in DB and render directly in <img src=...>
    const dataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 300,
      color: { dark: '#0B3B36', light: '#FFFFFF' },
    });
    return dataUrl;
  } catch (err) {
    console.error('QR generation failed:', err.message);
    return null;
  }
}

module.exports = { generateTokenQR };
