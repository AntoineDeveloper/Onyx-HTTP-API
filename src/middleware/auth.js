// ─── src/middleware/auth.js ───────────────────────────────────
// Optional Bearer-token authentication middleware.
// Enabled via AUTH_ENABLED=true in .env.
// ──────────────────────────────────────────────────────────────

const log = require('../utils/logger');
const TAG = 'Auth';

function authMiddleware(req, res, next) {
  const enabled = process.env.AUTH_ENABLED === 'true';

  if (!enabled) return next();

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    log.warn(TAG, `Rejected request to ${req.method} ${req.path} – missing Bearer token`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'A Bearer token is required. Set the Authorization header to: Bearer <token>',
    });
  }

  const token = header.slice(7);
  if (token !== process.env.AUTH_TOKEN) {
    log.warn(TAG, `Rejected request to ${req.method} ${req.path} – invalid token`);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid token.',
    });
  }

  next();
}

module.exports = authMiddleware;
