import { Router } from 'express';
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

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', validate(refreshSchema), refresh);
router.post('/logout', validate(logoutSchema), logout);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.post(
  '/change-password',
  authenticateAllowPendingPasswordChange,
  validate(changePasswordSchema),
  changePassword,
);
router.get('/me/permissions', authenticate, getMyPermissions);

export default router;
