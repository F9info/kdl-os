import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { registerSchema, loginSchema, refreshSchema, logoutSchema } from './schema.js';
import { register, login, refresh, logout } from './controller.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', validate(refreshSchema), refresh);
router.post('/logout', validate(logoutSchema), logout);

export default router;
