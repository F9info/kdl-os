import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { contentProject, recordProject } from '../../middleware/content-project.js';
import { publicOnlyActive } from '../../middleware/public-only-active.js';
import { listTestimonialSchema, idParamSchema, createTestimonialSchema, updateTestimonialSchema } from './schema.js';
import { list, get, create, update, remove } from './controller.js';

const router = Router();

// Public read of active items (consumed by the TestimonialGrid block on /p/[slug]).
router.get('/public', validate(listTestimonialSchema), publicOnlyActive, list);

router.use(authenticate);
// Project isolation: the project a request names, and the project of the row addressed by :id.
router.use(contentProject());
router.param('id', recordProject('testimonial'));
router.get('/', requirePermission('testimonials', 'view'), validate(listTestimonialSchema), list);
router.get('/:id', requirePermission('testimonials', 'view'), validate(idParamSchema), get);
router.post('/', requirePermission('testimonials', 'add'), validate(createTestimonialSchema), create);
router.patch('/:id', requirePermission('testimonials', 'edit'), validate(updateTestimonialSchema), update);
router.delete('/:id', requirePermission('testimonials', 'delete'), validate(idParamSchema), remove);

export default router;
