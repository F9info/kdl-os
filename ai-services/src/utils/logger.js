const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const threshold = LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.info;

function write(level, scope, args) {
  if (LEVELS[level] < threshold) return;
  const ts = new Date().toISOString();
  const prefix = scope ? `${ts} [${level.toUpperCase()}] [${scope}]` : `${ts} [${level.toUpperCase()}]`;
  const out = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  const line = args
    .map((a) => (a instanceof Error ? (a.stack ?? a.message) : typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ');
  out.write(`${prefix} ${line}\n`);
}

export function createLogger(scope = '') {
  return {
    debug: (...args) => write('debug', scope, args),
    info: (...args) => write('info', scope, args),
    warn: (...args) => write('warn', scope, args),
    error: (...args) => write('error', scope, args),
  };
}

export const logger = createLogger('ai-services');
