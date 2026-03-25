// ─── src/utils/logger.js ─────────────────────────────────────
// Colourful, level-gated console logger.
// ──────────────────────────────────────────────────────────────

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const COLORS = {
  debug: '\x1b[90m',   // grey
  info:  '\x1b[36m',   // cyan
  warn:  '\x1b[33m',   // yellow
  error: '\x1b[31m',   // red
  reset: '\x1b[0m',
  bold:  '\x1b[1m',
  dim:   '\x1b[2m',
  green: '\x1b[32m',
  magenta: '\x1b[35m',
};

const currentLevel = () => LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.debug;

function timestamp() {
  return new Date().toISOString();
}

function fmt(level, tag, ...args) {
  if (LEVELS[level] < currentLevel()) return;
  const color = COLORS[level];
  const prefix = `${COLORS.dim}${timestamp()}${COLORS.reset} ${color}${COLORS.bold}[${level.toUpperCase()}]${COLORS.reset}${color} [${tag}]${COLORS.reset}`;
  console[level === 'debug' ? 'log' : level](prefix, ...args);
}

const logger = {
  debug: (tag, ...a) => fmt('debug', tag, ...a),
  info:  (tag, ...a) => fmt('info',  tag, ...a),
  warn:  (tag, ...a) => fmt('warn',  tag, ...a),
  error: (tag, ...a) => fmt('error', tag, ...a),

  // Special logger for telnet traffic
  tx: (data) => fmt('debug', 'TELNET TX', `${COLORS.green}>>>${COLORS.reset}`, data.trim()),
  rx: (data) => fmt('debug', 'TELNET RX', `${COLORS.magenta}<<<${COLORS.reset}`, data.trim()),

  banner: (text) => {
    console.log(`\n${COLORS.bold}${COLORS.green}${'═'.repeat(60)}${COLORS.reset}`);
    console.log(`${COLORS.bold}${COLORS.green}  ${text}${COLORS.reset}`);
    console.log(`${COLORS.bold}${COLORS.green}${'═'.repeat(60)}${COLORS.reset}\n`);
  },
};

module.exports = logger;
