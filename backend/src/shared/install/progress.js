import { logger } from '../utils/logger.js';
import { getSetting, setSetting } from './status.js';

// Per-step record of the installer (database, company, admin, core, type, launch) and a capped log, kept in
// app_settings as JSON so no table is needed. Read-modify-write is not atomic, which is fine: one installer
// at a time, and the steps that must not run twice take their own lock (see core.js).

export const STEPS_KEY = 'install.steps';
export const LOG_KEY = 'install.log';
export const MAX_LOG = 200;

const parse = (raw, fallback) => {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const readSteps = async (db) => parse(await getSetting(STEPS_KEY, db), {});

/** Merge `patch` into one step's record ({ status, error, ... }) and stamp the time. */
export async function markStep(name, patch, db) {
  const steps = await readSteps(db);
  steps[name] = { ...steps[name], ...patch, at: new Date().toISOString() };
  await setSetting(STEPS_KEY, JSON.stringify(steps), db, 'Installer step status');
  return steps;
}

/** Append a line to the install log (also written to the server log). */
export async function logInstall(step, level, message, db) {
  (level === 'error' ? logger.error : logger.info)(`install[${step}]: ${message}`);
  const lines = parse(await getSetting(LOG_KEY, db), []);
  lines.push({ at: new Date().toISOString(), step, level, message: String(message).slice(0, 500) });
  await setSetting(LOG_KEY, JSON.stringify(lines.slice(-MAX_LOG)), db, 'Installer log');
}

export async function readLog(limit = 60, db) {
  return parse(await getSetting(LOG_KEY, db), []).slice(-limit);
}
