import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  listCategoriesSchema,
  getCategorySchema,
  createCategorySchema,
  updateCategorySchema,
  deleteCategorySchema,
} from './schema.js';
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from './controller.js';

const router = Router();

router.use(authenticate, requireRole('ADMIN', 'SUPER_ADMIN'));

router.get('/', validate(listCategoriesSchema), listCategories);
router.get('/:id', validate(getCategorySchema), getCategory);
router.post('/', validate(createCategorySchema), createCategory);
router.patch('/:id', validate(updateCategorySchema), updateCategory);
router.delete('/:id', validate(deleteCategorySchema), deleteCategory);

export default router;
