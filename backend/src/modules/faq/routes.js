import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  listFaqsSchema,
  getFaqSchema,
  createFaqSchema,
  updateFaqSchema,
  deleteFaqSchema,
} from './schema.js';
import { listFaqs, getFaq, createFaq, updateFaq, deleteFaq } from './controller.js';

const router = Router();

// Public read of active FAQs (consumed by ConstructionLeadFormFAQ, on both
// the editor canvas and /p/[slug]).
router.get('/public', validate(listFaqsSchema), listFaqs);

// Admin CRUD — authenticated + RBAC-gated.
router.use(authenticate);
router.get('/', requirePermission('faq', 'view'), validate(listFaqsSchema), listFaqs);
router.get('/:id', requirePermission('faq', 'view'), validate(getFaqSchema), getFaq);
router.post('/', requirePermission('faq', 'add'), validate(createFaqSchema), createFaq);
router.patch('/:id', requirePermission('faq', 'edit'), validate(updateFaqSchema), updateFaq);
router.delete('/:id', requirePermission('faq', 'delete'), validate(deleteFaqSchema), deleteFaq);

export default router;
