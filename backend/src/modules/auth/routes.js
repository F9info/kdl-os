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

// M1: Dedicated auth rate limiter — 10 req / 15 min per IP+email combination.
// Keyed on both so neither IP rotation nor email cycling alone bypasses the limit.
// Progressive per-account lockout (5/10/20 attempts → 1/5/30 min) is enforced
// inside the login controller via Redis counters.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = (req.body?.email || '').toLowerCase().trim();
    return `${req.ip}:${email}`;
  },
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' },
  skipSuccessfulRequests: true,
});

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', validate(refreshSchema), refresh);
router.post('/logout', validate(logoutSchema), logout);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);
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
