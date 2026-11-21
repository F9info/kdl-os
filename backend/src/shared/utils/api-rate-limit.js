import { z } from 'zod';

// Requests per 15 minutes per client address on /api (express-rate-limit `max`).
// Production was 100: one admin session (several API calls per page) used it up in minutes, and every
// person behind one office address shares a single allowance. Sign-in, password reset and the installer
// keep their own stricter limiters. Development stays effectively off (see the note in index.js).
const PRODUCTION_DEFAULT = 1000;
const DEVELOPMENT_DEFAULT = 50000;

const override = z.coerce.number().int().positive();

export function apiRateLimitMax(env = process.env) {
  const parsed = override.safeParse(String(env.API_RATE_LIMIT ?? '').trim() || undefined);
  if (parsed.success) return parsed.data;
  return env.NODE_ENV === 'production' ? PRODUCTION_DEFAULT : DEVELOPMENT_DEFAULT;
}
