import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { settingsPatchSchema } from './schema.js';
import {
  listModules,
  listEnabledModules,
  installModule,
  enableModule,
  disableModule,
  uninstallModule,
  patchModuleSettings,
} from './service.js';

export const getModules = async (req, res, next) => {
  try {
    const modules = await listModules();
    successResponse(res, { modules });
  } catch (err) {
    next(err);
  }
};

export const getEnabledModules = async (req, res, next) => {
  try {
    const modules = await listEnabledModules();
    successResponse(res, { modules });
  } catch (err) {
    next(err);
  }
};

export const postInstall = async (req, res, next) => {
  try {
    const mod = await installModule(req.params.slug, req.user?.id);
    successResponse(res, { module: mod }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const postEnable = async (req, res, next) => {
  try {
    const mod = await enableModule(req.params.slug, req.user?.id);
    successResponse(res, { module: mod });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const postDisable = async (req, res, next) => {
  try {
    const mod = await disableModule(req.params.slug, req.user?.id);
    successResponse(res, { module: mod });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const deleteModule = async (req, res, next) => {
  try {
    await uninstallModule(req.params.slug, req.user?.id);
    successResponse(res, { message: `Module "${req.params.slug}" uninstalled` });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const patchSettings = async (req, res, next) => {
  try {
    const { settings } = settingsPatchSchema.parse(req.body);
    const mod = await patchModuleSettings(req.params.slug, settings, req.user?.id);
    successResponse(res, { module: mod });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
