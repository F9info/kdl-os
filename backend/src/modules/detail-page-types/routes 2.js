import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { getDetailPageTypesSchema } from './schema.js';
import { getDetailPageTypes } from './controller.js';

const router = Router();

router.get('/', authenticate, validate(getDetailPageTypesSchema), getDetailPageTypes);

export default router;
