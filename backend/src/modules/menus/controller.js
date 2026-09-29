import * as menuService from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';

export const listMenus = async (req, res, next) => {
  try {
    const items = await menuService.listMenus(req.validated.query || {});
    return successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

export const getMenu = async (req, res, next) => {
  try {
    const menu = await menuService.getMenuById(req.validated.params.id);
    if (!menu) return errorResponse(res, 'Menu not found', 404);
    return successResponse(res, { menu });
  } catch (err) {
    next(err);
  }
};

// Public — no auth. Returns null (not 404) for "no menu configured yet" so
// the frontend can distinguish that from a real error and fall back to its
// own static nav quietly.
export const getPublicMenu = async (req, res, next) => {
  try {
    const { key, project_id } = req.validated.query;
    const menu = await menuService.getPublicMenu(project_id, key);
    return successResponse(res, { menu });
  } catch (err) {
    next(err);
  }
};

export const ensureMenu = async (req, res, next) => {
  try {
    const menu = await menuService.ensureMenu(req.validated.body);
    return successResponse(res, { menu }, 201);
  } catch (err) {
    next(err);
  }
};

export const updateMenu = async (req, res, next) => {
  try {
    const menu = await menuService.updateMenu(req.validated.params.id, req.validated.body);
    if (!menu) return errorResponse(res, 'Menu not found', 404);
    return successResponse(res, { menu });
  } catch (err) {
    next(err);
  }
};

export const deleteMenu = async (req, res, next) => {
  try {
    const deleted = await menuService.deleteMenu(req.validated.params.id);
    if (!deleted) return errorResponse(res, 'Menu not found', 404);
    return successResponse(res, { message: 'Menu deleted' });
  } catch (err) {
    next(err);
  }
};

export const createMenuItem = async (req, res, next) => {
  try {
    const { menuId } = req.validated.params;
    if (!(await menuService.menuExists(menuId))) {
      return errorResponse(res, 'Menu not found', 404);
    }
    const item = await menuService.createMenuItem(menuId, req.validated.body);
    return successResponse(res, { item }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const updateMenuItem = async (req, res, next) => {
  try {
    const item = await menuService.updateMenuItem(req.validated.params.id, req.validated.body);
    if (!item) return errorResponse(res, 'Menu item not found', 404);
    return successResponse(res, { item });
  } catch (err) {
    next(err);
  }
};

export const deleteMenuItem = async (req, res, next) => {
  try {
    const deleted = await menuService.deleteMenuItem(req.validated.params.id);
    if (!deleted) return errorResponse(res, 'Menu item not found', 404);
    return successResponse(res, { message: 'Menu item deleted' });
  } catch (err) {
    next(err);
  }
};

export const reorderMenuItems = async (req, res, next) => {
  try {
    const { menuId } = req.validated.params;
    const menu = await menuService.reorderMenuItems(menuId, req.validated.body.items);
    return successResponse(res, { menu });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
