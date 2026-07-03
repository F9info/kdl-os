import * as settingsService from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';

const isAdmin = (req) => !!(req.user && ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role));

export const listSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.listSettings(isAdmin(req));
    return successResponse(res, { settings });
  } catch (err) {
    next(err);
  }
};

export const getSetting = async (req, res, next) => {
  try {
    const setting = await settingsService.getSettingByKey(req.validated.params.key);
    if (!setting) return errorResponse(res, 'Setting not found', 404);
    if (!setting.is_public && !isAdmin(req)) return errorResponse(res, 'Forbidden', 403);
    return successResponse(res, { setting });
  } catch (err) {
    next(err);
  }
};

export const createSetting = async (req, res, next) => {
  try {
    const existing = await settingsService.getSettingByKey(req.validated.body.key);
    if (existing) return errorResponse(res, 'Setting key already exists', 409);
    const setting = await settingsService.createSetting(req.validated.body);
    return successResponse(res, { setting }, 201);
  } catch (err) {
    next(err);
  }
};

export const updateSetting = async (req, res, next) => {
  try {
    const { key } = req.validated.params;
    const existing = await settingsService.getSettingByKey(key);
    if (!existing) return errorResponse(res, 'Setting not found', 404);
    const setting = await settingsService.updateSetting(key, req.validated.body.value);
    return successResponse(res, { setting });
  } catch (err) {
    next(err);
  }
};

export const deleteSetting = async (req, res, next) => {
  try {
    const { key } = req.validated.params;
    const existing = await settingsService.getSettingByKey(key);
    if (!existing) return errorResponse(res, 'Setting not found', 404);
    await settingsService.deleteSetting(key);
    return successResponse(res, { message: 'Setting deleted' });
  } catch (err) {
    next(err);
  }
};
