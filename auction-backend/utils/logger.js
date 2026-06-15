// Minimal leveled logger (OPS-04).
//
// pino is not a dependency of this service, so this is a small console wrapper
// exposing info/warn/error (plus debug). It is intentionally tiny and side-effect
// free so it can be imported anywhere. Per the OPS-04 scope we only wire this into
// server startup — we are NOT mass-replacing console.* across the codebase.

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const configuredLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const threshold = LEVELS[configuredLevel] ?? LEVELS.info;

const ts = () => new Date().toISOString();

const emit = (level, consoleFn, args) => {
  if (LEVELS[level] > threshold) return;
  consoleFn(`[${ts()}] ${level.toUpperCase()}:`, ...args);
};

const logger = {
  error: (...args) => emit('error', console.error, args),
  warn: (...args) => emit('warn', console.warn, args),
  info: (...args) => emit('info', console.log, args),
  debug: (...args) => emit('debug', console.log, args),
};

export default logger;
