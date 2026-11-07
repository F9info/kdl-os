import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../../middleware/validate.js';
import { RedisRateLimitStore } from '../../shared/utils/redis-rate-limit-store.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from './schema.js';
import {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  getMyPermissions,
} from './controller.js';
import {
  authenticate,
  authenticateAllowPendingPasswordChange,
} from '../../middleware/auth.js';

const router = Router();

// M1: Dedicated auth rate limiter — 10 failed req / 15 min per IP in production.
// Keyed on the IP only: keying on IP+email let one address try unlimited different
// emails (credential stuffing). Per-account protection is the progressive lockout
// (5/10/20 attempts → 1/5/30 min) in the login controller, via Redis counters.
// Counters live in Redis (see RedisRateLimitStore), not in process memory.
// Dev raised to 2000: shares one bucket (keyed by IP+email) across every
// request proxied through Next.js — a real browser session and any
// Playwright-driven re-logins together, not per tab/run. A single local
// session routinely exceeded 10, then 200, within 15 minutes, 429ing
// genuine login attempts. No real attacker to protect against locally.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  store: new RedisRateLimitStore('auth'),
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' },
  skipSuccessfulRequests: true,
});

// authLimiter above skips successful requests, so on its own it never counts a
// successful signup or a forgot-password call (which always answers 200): an
// attacker could create unlimited accounts, or email-bomb any address. These
// count EVERY request. Dev is effectively unlimited (see authLimiter comment).
const strictLimiter = ({ name, max, keyGenerator, message }) =>
  rateLimit({
    store: new RedisRateLimitStore(name),
    windowMs: 60 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? max : 2000,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    message: { success: false, message },
  });
const emailOf = (req) => (req.body?.email || '').toLowerCase().trim();
export const registerLimiter = strictLimiter({
  name: 'register',
  max: 5,
  keyGenerator: (req) => req.ip,
  message: 'Too many sign-ups from this address. Try again in an hour.',
});
export const forgotIpLimiter = strictLimiter({
  name: 'forgot-ip',
  max: 10,
  keyGenerator: (req) => req.ip,
  message: 'Too many reset requests. Try again in an hour.',
});
export const forgotEmailLimiter = strictLimiter({
  name: 'forgot-email',
  max: 3,
  keyGenerator: emailOf,
  message: 'Too many reset requests for this account. Try again in an hour.',
});

router.post('/register', registerLimiter, authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
// Refresh is called by every logged-in tab, so the limit is generous: it only stops token-guessing floods.
export const refreshLimiter = strictLimiter({
  name: 'refresh',
  max: 300,
  keyGenerator: (req) => req.ip,
  message: 'Too many refresh attempts. Try again later.',
});

router.post('/refresh', refreshLimiter, validate(refreshSchema), refresh);
router.post('/logout', validate(logoutSchema), logout);
router.post(
  '/forgot-password',
  forgotIpLimiter,
  forgotEmailLimiter,
  authLimiter,
  validate(forgotPasswordSchema),
  forgotPassword
);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword);
router.post(
  '/change-password',
  authLimiter,
  authenticateAllowPendingPasswordChange,
  validate(changePasswordSchema),
  changePassword,
);
router.get('/me/permissions', authenticate, getMyPermissions);

export default router;
