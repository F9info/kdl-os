import crypto from 'node:crypto';
import { prisma } from '../../config/database.js';
import { logger } from '../utils/logger.js';
import { getSetting, setSetting, isInstalled } from './status.js';

// The installer has no login, so before the install is finished every wizard route needs a setup token: a long
// random secret that only someone with access to the server can read. Without it, anyone who can reach a fresh
// instance could upload files, rename the company and finish the install.
//
//  - `KDL_SETUP_TOKEN` (16+ characters) in the environment is used as is (scripted installs, CI).
//  - Otherwise one is generated at start while the install is open, printed once in the server log, and only its
//    SHA-256 is stored (`install.setup_token_hash`). Lost it? `npm run install:token` prints a new one.
//  - No token configured at all means every request is refused (never open by default).

export const HASH_KEY = 'install.setup_token_hash';
export const MIN_ENV_TOKEN = 16;

const sha = (v) => crypto.createHash('sha256').update(v).digest('hex');
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export function envToken(env = process.env) {
  const t = env.KDL_SETUP_TOKEN?.trim();
  return t && t.length >= MIN_ENV_TOKEN ? t : null;
}

const newToken = () => crypto.randomBytes(24).toString('base64url');

/** Called at server start. Returns the new token only when one was generated now (so it can be shown once). */
export async function ensureSetupToken(db = prisma, env = process.env) {
  if (await isInstalled(db)) return { source: 'none' };
  if (env.KDL_SETUP_TOKEN?.trim() && !envToken(env)) {
    logger.warn(`install: KDL_SETUP_TOKEN is shorter than ${MIN_ENV_TOKEN} characters and is ignored`);
  }
  if (envToken(env)) return { source: 'env' };
  if (await getSetting(HASH_KEY, db)) return { source: 'stored' };
  const token = newToken();
  await setSetting(HASH_KEY, sha(token), db, 'Installer setup token (SHA-256)');
  logger.warn(
    `install: SETUP TOKEN (needed to open the installer, shown once): ${token}  |  lost it? run: npm run install:token`
  );
  return { source: 'generated', token };
}

/** Replaces the stored token (used by `npm run install:token`). The environment token, if set, still wins. */
export async function regenerateSetupToken(db = prisma) {
  const token = newToken();
  await setSetting(HASH_KEY, sha(token), db, 'Installer setup token (SHA-256)');
  return token;
}

export async function verifySetupToken(candidate, db = prisma, env = process.env) {
  if (typeof candidate !== 'string' || candidate.length < 8 || candidate.length > 200) return false;
  const fromEnv = envToken(env);
  if (fromEnv) return safeEqual(candidate, fromEnv);
  const stored = await getSetting(HASH_KEY, db);
  return stored ? safeEqual(sha(candidate), stored) : false;
}

export const SETUP_TOKEN_HEADER = 'x-setup-token';

/** Express middleware: 401 unless the request carries a valid setup token. */
export const requireSetupToken = async (req, res, next) => {
  try {
    if (await verifySetupToken(req.get(SETUP_TOKEN_HEADER))) return next();
    return res
      .status(401)
      .json({ success: false, message: 'Enter the setup token shown in the server log.', code: 'SETUP_TOKEN_REQUIRED' });
  } catch (err) {
    next(err);
  }
};
