// ─── src/index.js ────────────────────────────────────────────
// Onyx HTTP API  –  REST bridge for Obsidian Onyx via Onyx Manager telnet.
// ──────────────────────────────────────────────────────────────

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const TelnetClient = require('./services/telnet');
const authMiddleware = require('./middleware/auth');
const createRouter = require('./routes/api');
const log = require('./utils/logger');

const TAG = 'Main';

// ── Configuration summary ───────────────────────────────────

const HTTP_PORT = Number(process.env.HTTP_PORT || 8000);
const HTTP_HOST = process.env.HTTP_HOST || '0.0.0.0';
const TELNET_HOST = process.env.TELNET_HOST || '127.0.0.1';
const TELNET_PORT = Number(process.env.TELNET_PORT || 2323);

// ── Bootstrap ───────────────────────────────────────────────

async function main() {
  log.banner('Onyx HTTP API  •  REST bridge for Obsidian Onyx');

  log.info(TAG, 'Configuration:');
  log.info(TAG, `  HTTP            ${HTTP_HOST}:${HTTP_PORT}`);
  log.info(TAG, `  Telnet target   ${TELNET_HOST}:${TELNET_PORT}`);
  log.info(TAG, `  Auth enabled    ${process.env.AUTH_ENABLED === 'true'}`);
  log.info(TAG, `  Auto-reconnect  ${process.env.TELNET_AUTO_RECONNECT !== 'false'}`);
  log.info(TAG, `  Log level       ${process.env.LOG_LEVEL || 'debug'}`);

  // ── Telnet client ───────────────────────────────────────

  const telnet = new TelnetClient();

  telnet.on('connected', () => log.info(TAG, '✔  Telnet connection established'));
  telnet.on('disconnected', () => log.warn(TAG, '✘  Telnet connection lost'));

  try {
    await telnet.connect();
  } catch (err) {
    log.error(TAG, `Could not connect to Onyx Manager at ${TELNET_HOST}:${TELNET_PORT}`);
    log.error(TAG, err.message);
    log.warn(TAG, 'The HTTP server will start anyway – telnet will auto-reconnect in the background.');
    // Kick off background reconnection
    if (telnet.autoReconnect) {
      setTimeout(() => telnet._reconnect(), telnet.reconnectInterval);
    }
  }

  // ── Express app ─────────────────────────────────────────

  const app = express();

  app.use(cors());
  app.use(express.json());

  // Request logging
  app.use((req, _res, next) => {
    log.debug('HTTP', `${req.method} ${req.originalUrl}`);
    next();
  });

  // Swagger docs at /docs
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Onyx HTTP API – Docs',
  }));

  // Serve the raw OpenAPI spec
  app.get('/openapi.json', (_req, res) => res.json(swaggerSpec));

  // Auth middleware for all /api routes
  app.use('/api', authMiddleware);

  // API routes
  app.use('/api', createRouter(telnet));

  // Root redirect to docs
  app.get('/', (_req, res) => res.redirect('/docs'));

  // ── Start listening ─────────────────────────────────────

  app.listen(HTTP_PORT, HTTP_HOST, () => {
    log.banner('Server is ready!');
    log.info(TAG, `API docs    → http://localhost:${HTTP_PORT}/docs`);
    log.info(TAG, `API base    → http://localhost:${HTTP_PORT}/api`);
    log.info(TAG, `OpenAPI spec→ http://localhost:${HTTP_PORT}/openapi.json`);
    log.info(TAG, `Health      → http://localhost:${HTTP_PORT}/api/health`);
  });

  // ── Graceful shutdown ───────────────────────────────────

  const shutdown = (signal) => {
    log.info(TAG, `${signal} received – shutting down …`);
    telnet.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  log.error(TAG, `Fatal: ${err.message}`);
  console.error(err);
  process.exit(1);
});
