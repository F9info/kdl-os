import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
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

router.use(authenticate);

router.get('/', requirePermission('categories', 'view'), validate(listCategoriesSchema), listCategories);
router.get('/:id', requirePermission('categories', 'view'), validate(getCategorySchema), getCategory);
router.post('/', requirePermission('categories', 'add'), validate(createCategorySchema), createCategory);
router.patch('/:id', requirePermission('categories', 'edit'), validate(updateCategorySchema), updateCategory);
router.delete('/:id', requirePermission('categories', 'delete'), validate(deleteCategorySchema), deleteCategory);

export default router;
