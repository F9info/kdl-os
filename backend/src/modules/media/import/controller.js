import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { getImportDriver } from './drivers/index.js';
import * as cloudImportService from './cloud-import.service.js';

const IS_PROD = process.env.NODE_ENV === 'production';
// Covers both the authenticated /start route and the public /callback route —
// see routes.js (mounted under /api/media) and public-routes.js (mounted at
// /api/media/import/oauth, before the authenticated router).
const OAUTH_STATE_COOKIE_PATH = '/api/media/import/oauth';

// No cookie-parser middleware in this app (see auth/controller.js's manual
// getRefreshTokens) — parse the single cookie we need directly off the header.
function getCookie(req, name) {
  const cookieStr = req.headers.cookie || '';
  for (const part of cookieStr.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    if (part.slice(0, eqIdx).trim() === name) return decodeURIComponent(part.slice(eqIdx + 1).trim());
  }
  return undefined;
}

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
    const { url, nonce } = cloudImportService.startOAuth(req.user.id, provider);
    // Bind the state to this browser via an HttpOnly cookie so completeOAuth can
    // verify the callback lands in the same session that started it — closes the
    // OAuth login-CSRF gap (see cloud-import.service.js parseState).
    res.cookie(cloudImportService.oauthStateCookieName(provider), nonce, {
      httpOnly: true,
      sameSite: 'lax',
      secure: IS_PROD,
      maxAge: cloudImportService.STATE_TTL_MS,
      path: OAUTH_STATE_COOKIE_PATH,
    });
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
  const cookieName = cloudImportService.oauthStateCookieName(provider);
  const clearStateCookie = () => res.clearCookie(cookieName, { path: OAUTH_STATE_COOKIE_PATH });
  const redirectTo = (params) => {
    clearStateCookie();
    return res.redirect(`${frontendBase}/admin/media/import?${new URLSearchParams(params).toString()}`);
  };

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
    const nonce = getCookie(req, cookieName);
    await cloudImportService.completeOAuth(provider, { code: req.query.code, state: req.query.state, nonce });
    return redirectTo({ connected: provider });
  } catch (err) {
    return redirectTo({ error: err.message || 'oauth_failed' });
  }
};
