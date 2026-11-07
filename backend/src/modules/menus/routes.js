import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { contentProject, recordProject } from '../../middleware/content-project.js';
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
  updateMenuOptionsSchema,
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
  getOptions,
  putOptions,
} from './controller.js';

const router = Router();

// Public read of one menu's active items, tree-shaped (consumed by
// ConstructionHeader, on both the editor canvas and /p/[slug]).
router.get('/public', validate(publicMenuSchema), getPublicMenu);

// Admin CRUD — authenticated + RBAC-gated.
router.use(authenticate);
// Project isolation: the project a request names, and the project of the menu or menu item addressed by id.
router.use(contentProject());
router.param('id', recordProject('menu', { itemModel: 'menuItem' }));
router.param('menuId', recordProject('menu'));
router.get('/', requirePermission('menus', 'view'), validate(listMenusSchema), listMenus);
// Site-wide menu options (footer = same links as header). Registered before /:id.
router.get('/options', requirePermission('menus', 'view'), getOptions);
router.put('/options', requirePermission('menus', 'edit'), validate(updateMenuOptionsSchema), putOptions);
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
