import { successResponse, errorResponse } from '../../shared/utils/response.js';
import {
  listModules,
  listEnabledModules,
  installModule,
  enableModule,
  disableModule,
  uninstallModule,
  patchModuleSettings,
} from './service.js';

function hasEditPermission(req) {
  return req.userPermissions?.bypass || (req.userPermissions?.permissions ?? []).includes('modules:edit');
}

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
    const resolveConflicts = req.validated?.body?.resolveConflicts ?? false;
    // Mode switch disables modules, so modules:edit is required in addition to modules:add
    if (resolveConflicts && !hasEditPermission(req)) {
      return errorResponse(res, 'Module mode switch requires modules:edit permission', 403);
    }
    const { installedDependencies, ...module } = await installModule(req.params.slug, req.user?.id, { resolveConflicts });
    successResponse(res, { module, installedDependencies }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status, err.details ?? null);
    next(err);
  }
};

export const postEnable = async (req, res, next) => {
  try {
    const resolveConflicts = req.validated?.body?.resolveConflicts ?? false;
    const mod = await enableModule(req.params.slug, req.user?.id, { resolveConflicts });
    successResponse(res, { module: mod });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status, err.details ?? null);
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
    const mod = await patchModuleSettings(req.params.slug, req.validated.body.settings, req.user?.id);
    successResponse(res, { module: mod });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
