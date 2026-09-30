import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  listMenusSchema,
  getMenuSchema,
  publicMenuSchema,
  ensureMenuSchema,
  updateMenuSchema,
  deleteMenuSchema,
  createMenuItemSchema,
  updateMenuItemSchema,
  deleteMenuItemSchema,
  reorderMenuItemsSchema,
} from './schema.js';
import {
  listMenus,
  getMenu,
  getPublicMenu,
  ensureMenu,
  updateMenu,
  deleteMenu,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  reorderMenuItems,
} from './controller.js';

const router = Router();

// Public read of one menu's active items, tree-shaped (consumed by
// ConstructionHeader, on both the editor canvas and /p/[slug]).
router.get('/public', validate(publicMenuSchema), getPublicMenu);

// Admin CRUD — authenticated + RBAC-gated.
router.use(authenticate);
router.get('/', requirePermission('menus', 'view'), validate(listMenusSchema), listMenus);
router.post('/ensure', requirePermission('menus', 'add'), validate(ensureMenuSchema), ensureMenu);
router.get('/:id', requirePermission('menus', 'view'), validate(getMenuSchema), getMenu);
router.patch('/:id', requirePermission('menus', 'edit'), validate(updateMenuSchema), updateMenu);
router.delete('/:id', requirePermission('menus', 'delete'), validate(deleteMenuSchema), deleteMenu);

router.post(
  '/:menuId/items',
  requirePermission('menus', 'add'),
  validate(createMenuItemSchema),
  createMenuItem
);
router.patch(
  '/items/:id',
  requirePermission('menus', 'edit'),
  validate(updateMenuItemSchema),
  updateMenuItem
);
router.delete(
  '/items/:id',
  requirePermission('menus', 'delete'),
  validate(deleteMenuItemSchema),
  deleteMenuItem
);
router.patch(
  '/:menuId/items/reorder',
  requirePermission('menus', 'edit'),
  validate(reorderMenuItemsSchema),
  reorderMenuItems
);

export default router;
