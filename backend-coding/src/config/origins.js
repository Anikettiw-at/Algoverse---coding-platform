// CORS allow-list — Express aur Socket.IO dono yahi list use karte hain.
// FRONTEND_URL me comma-separated extra origins de sakte ho.
const defaultOrigins = [
  'http://localhost:5173',
  'https://frontend-coding-roan.vercel.app'
];

const envOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

module.exports = { allowedOrigins };
