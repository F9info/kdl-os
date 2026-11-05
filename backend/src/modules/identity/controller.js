import * as service from './service.js';
import { ASSET_KEYS } from './schema.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { writeActivity, getClientIp } from '../user-management/shared/activity-logger.js';

export const getAppConfig = async (req, res, next) => {
  try {
    // Revalidate on every request (cheap: served from Redis, and a 304 when unchanged). A cached
    // copy would show an old name/logo/phone for up to a minute after someone edits Identity.
    res.set('Cache-Control', 'no-cache');
    return successResponse(res, { identity: await service.getAppConfig() });
  } catch (err) {
    next(err);
  }
};

// Admin payload: raw stored values (storage paths) plus fresh preview URLs for the assets,
// so the UI can show a saved logo after a reload.
const adminPayload = async (identity) => {
  const config = await service.getAppConfig();
  return { identity, resolved: Object.fromEntries(ASSET_KEYS.map((k) => [k, config[k]])) };
};

export const getIdentity = async (req, res, next) => {
  try {
    return successResponse(res, await adminPayload(await service.getIdentity()));
  } catch (err) {
    next(err);
  }
};

export const updateIdentity = async (req, res, next) => {
  try {
    const patch = req.validated.body;
    const identity = await service.updateIdentity(patch);
    try {
      writeActivity({
        actor: req.user.id,
        module: 'identity',
        action: 'updated',
        subject_type: 'ApplicationIdentity',
        subject_id: 'identity',
        description: 'Application identity updated',
        properties: { fields: Object.keys(patch) },
        ip_address: getClientIp(req),
      });
    } catch {
      // a logging failure must never break the response
    }
    return successResponse(res, await adminPayload(identity));
  } catch (err) {
    next(err);
  }
};

export const uploadAsset = async (req, res, next) => {
  try {
    if (!req.file) return errorResponse(res, 'No file uploaded', 400);
    const asset = ASSET_KEYS.includes(req.query.asset) ? req.query.asset : undefined;
    return successResponse(res, await service.uploadAsset(req.file, { asset, userId: req.user?.id }), 201);
  } catch (err) {
    // 4xx from the image checks (here or in the brand kit) is the user's to fix; the rest is a real error.
    if (err.status >= 400 && err.status < 500) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
