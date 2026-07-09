import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { getImportDriver } from './drivers/index.js';
import * as cloudImportService from './cloud-import.service.js';

export const getImportProviders = async (req, res, next) => {
  try {
    successResponse(res, { items: cloudImportService.getProviderStatus() });
  } catch (err) {
    next(err);
  }
};

export const listImportConnections = async (req, res, next) => {
  try {
    successResponse(res, { items: await cloudImportService.listConnections(req.user.id) });
  } catch (err) {
    next(err);
  }
};

export const createImportConnection = async (req, res, next) => {
  try {
    const { provider, label, credentials } = req.validated.body;
    let driver;
    try {
      driver = getImportDriver(provider);
    } catch {
      return errorResponse(res, `Unknown import provider: ${provider}`, 422);
    }
    if (driver.oauth) return errorResponse(res, `"${provider}" is connected via OAuth — use /import/oauth/${provider}/start`, 422);

    const connection = await cloudImportService.createManualConnection(req.user.id, { provider, label, credentials });
    successResponse(res, { item: connection }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const deleteImportConnection = async (req, res, next) => {
  try {
    await cloudImportService.deleteConnection(req.user.id, req.validated.params.id);
    successResponse(res, { deleted: true });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const startImportOAuth = async (req, res, next) => {
  try {
    const { provider } = req.validated.params;
    const { url } = cloudImportService.startOAuth(req.user.id, provider);
    successResponse(res, { url });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const listImportFiles = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const { folder_id: folderId, cursor } = req.validated.query;
    successResponse(res, await cloudImportService.listRemoteFiles(req.user.id, id, { folderId, cursor }));
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const importRemoteFiles = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const { file_ids: fileIds, folder_id: folderId } = req.validated.body;
    successResponse(res, await cloudImportService.importRemoteFiles(req.user.id, id, { fileIds, folderId }));
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// Public route (no auth middleware — the browser lands here via a top-level
// OAuth-provider redirect, so no Bearer token is present; the user identity
// travels in the signed `state` param instead). See import/public-routes.js.
export const oauthCallback = async (req, res) => {
  const { provider } = req.params;
  const frontendBase = process.env.CORS_ORIGIN || '';
  const redirectTo = (params) => res.redirect(`${frontendBase}/admin/media/import?${new URLSearchParams(params).toString()}`);

  if (req.query.error) {
    return redirectTo({ error: String(req.query.error) });
  }
  try {
    getImportDriver(provider);
  } catch {
    return redirectTo({ error: 'unknown_provider' });
  }
  if (!req.query.code || !req.query.state) {
    return redirectTo({ error: 'missing_code_or_state' });
  }

  try {
    await cloudImportService.completeOAuth(provider, { code: req.query.code, state: req.query.state });
    return redirectTo({ connected: provider });
  } catch (err) {
    return redirectTo({ error: err.message || 'oauth_failed' });
  }
};
