import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../../middleware/validate.js';
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

// M1: Dedicated auth rate limiter — 10 req / 15 min per IP+email combination
// in production. Keyed on both so neither IP rotation nor email cycling
// alone bypasses the limit. Progressive per-account lockout (5/10/20
// attempts → 1/5/30 min) is enforced inside the login controller via Redis
// counters — that protection is unaffected by this limiter's threshold.
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
  keyGenerator: (req) => {
    const email = (req.body?.email || '').toLowerCase().trim();
    return `${req.ip}:${email}`;
  },
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' },
  skipSuccessfulRequests: true,
});

// authLimiter above skips successful requests, so on its own it never counts a
// successful signup or a forgot-password call (which always answers 200): an
// attacker could create unlimited accounts, or email-bomb any address. These
// count EVERY request. Dev is effectively unlimited (see authLimiter comment).
const strictLimiter = ({ max, keyGenerator, message }) =>
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? max : 2000,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    message: { success: false, message },
  });
const emailOf = (req) => (req.body?.email || '').toLowerCase().trim();
export const registerLimiter = strictLimiter({
  max: 5,
  keyGenerator: (req) => req.ip,
  message: 'Too many sign-ups from this address. Try again in an hour.',
});
export const forgotIpLimiter = strictLimiter({
  max: 10,
  keyGenerator: (req) => req.ip,
  message: 'Too many reset requests. Try again in an hour.',
});
export const forgotEmailLimiter = strictLimiter({
  max: 3,
  keyGenerator: emailOf,
  message: 'Too many reset requests for this account. Try again in an hour.',
});

router.post('/register', registerLimiter, authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', validate(refreshSchema), refresh);
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
