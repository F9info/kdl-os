import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { writeActivityAsync, getClientIp } from '../user-management/shared/activity-logger.js';
import * as service from './service.js';

export const getSchema = async (req, res, next) => {
  try {
    const { platform } = req.validated.query;
    const tree = await service.getSchemaTree(platform);
    if (!tree) return errorResponse(res, 'Platform not found', 404);
    return successResponse(res, { platform, schema: tree });
  } catch (err) {
    next(err);
  }
};

export const getValues = async (req, res, next) => {
  try {
    const { platform, type } = req.validated.query;
    const values = await service.getValues(platform, type);
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
      module: 'template-engine',
      action: 'values_saved',
      description: `Saved ${result.saved} template engine values for platform=${platform} type=${type_id}`,
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
      module: 'template-engine',
      action: 'values_reset',
      description: `Reset template engine values for platform=${platform} type=${type_id}`,
      properties: { platform, type_id },
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

    // Public access check: unauthenticated users allowed only if flag is true
    if (!req.user) {
      const isPublic = await service.isTokensPublic();
      if (!isPublic) return errorResponse(res, 'Unauthorized', 401);
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
