import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { writeActivityAsync, getClientIp } from '../user-management/shared/activity-logger.js';
import { resolvePermissions } from '../user-management/shared/permission-resolver.js';
import * as service from './service.js';

export const getSchema = async (req, res, next) => {
  try {
    const { platform } = req.validated.query;
    const tree = await service.getSchemaTree(platform);
    if (!tree) return errorResponse(res, 'Platform not found', 404);
    const activeTheme = await service.getActiveTheme(platform);
    return successResponse(res, { platform, schema: tree, activeTheme });
  } catch (err) {
    next(err);
  }
};

export const postActiveTheme = async (req, res, next) => {
  try {
    const { platform, theme } = req.validated.body;
    const result = await service.setActiveTheme(platform, theme);
    if (result.errors) return errorResponse(res, 'Validation failed', 422, { fieldErrors: {}, formErrors: result.errors });
    writeActivityAsync({
      actor: req.user?.id,
      module: 'theme-engine',
      action: 'active_theme_saved',
      description: `Set active theme=${theme} for platform=${platform}`,
      properties: { platform, theme },
      ip_address: getClientIp(req),
    });
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const getValues = async (req, res, next) => {
  try {
    const { platform, type } = req.validated.query;
    const values = await service.getValues(platform, type);
    if (values.errors) return errorResponse(res, 'Validation failed', 422, { fieldErrors: {}, formErrors: values.errors });
    return successResponse(res, { platform, type_id: type, values });
  } catch (err) {
    next(err);
  }
};

export const postValues = async (req, res, next) => {
  try {
    const { platform, type_id, values } = req.validated.body;
    const result = await service.upsertValues(platform, type_id, values, req.user?.id);
    if (result.errors) return errorResponse(res, 'Validation failed', 422, { fieldErrors: {}, formErrors: result.errors });
    writeActivityAsync({
      actor: req.user?.id,
      module: 'theme-engine',
      action: 'values_saved',
      description: `Saved ${result.saved} theme engine values for platform=${platform} type=${type_id}`,
      properties: { platform, type_id, count: result.saved },
      ip_address: getClientIp(req),
    });
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const postReset = async (req, res, next) => {
  try {
    const { platform, type_id } = req.validated.body;
    const result = await service.resetValues(platform, type_id);
    if (result.errors) return errorResponse(res, 'Validation failed', 422, { fieldErrors: {}, formErrors: result.errors });
    writeActivityAsync({
      actor: req.user?.id,
      module: 'theme-engine',
      action: 'values_reset',
      description: `Reset theme engine values for platform=${platform} type=${type_id}`,
      properties: { platform, type_id },
      ip_address: getClientIp(req),
    });
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const releaseLocks = async (req, res, next) => {
  try {
    const result = await service.releaseLocks(req.validated.body, req.user?.id);
    writeActivityAsync({
      actor: req.user?.id,
      module: 'theme-engine',
      action: 'locks_released',
      description: `Force-released ${result.released} theme-engine field lock(s)`,
      properties: { released: result.released, ...req.validated.body },
      ip_address: getClientIp(req),
    });
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const getTokens = async (req, res, next) => {
  try {
    const { platform, theme, device } = req.validated.query;

    // Public access check: when tokens_public is off, the flag gates EVERYONE —
    // anonymous callers get 401 and authenticated callers need theme-engine:view.
    const isPublic = await service.isTokensPublic();
    if (!isPublic) {
      if (!req.user) return errorResponse(res, 'Unauthorized', 401);
      const perms = await resolvePermissions(req.user.id);
      if (!perms.bypass && !perms.permissions.includes('theme-engine:view')) {
        return errorResponse(res, 'Forbidden', 403);
      }
    }

    const tokens = await service.compileTokens(platform, theme, device);
    // If caller wants CSS (via Accept: text/css or ?format=css), serve raw CSS
    const format = req.query.format;
    if (format === 'css' || req.headers.accept?.includes('text/css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      return res.status(200).send(tokens.css);
    }
    return successResponse(res, tokens);
  } catch (err) {
    next(err);
  }
};
