import * as authService from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { resolvePermissions } from '../user-management/shared/permission-resolver.js';

const IS_PROD = process.env.NODE_ENV === 'production';

const AUTH_COOKIE = 'kdl-auth-token';
const REFRESH_COOKIE = 'kdl-refresh-token';

function buildAccessTokenPayload(user, roleSlugs = []) {
  return {
    userId: user.id,
    email: user.email,
    roles: roleSlugs.length ? roleSlugs : (user.roles || []),
  };
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie(AUTH_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: 15 * 60 * 1000,
    path: '/',
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: IS_PROD,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    // Path '/' so the browser also sends the refresh cookie on /admin/* requests,
    // letting the Next middleware treat a valid refresh token as "session alive"
    // (it cannot see the short-lived 15m access cookie after it expires). SameSite=
    // Strict + httpOnly keep it safe; /auth/refresh still verifies the token.
    path: '/',
  });
  // Remove any legacy refresh cookie scoped to /api/auth (set before the path was
  // widened to '/'). Otherwise the browser sends BOTH on /api/auth/* and the stale
  // one can win, breaking refresh. Clearing it converges returning users.
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

function clearAuthCookies(res) {
  res.clearCookie(AUTH_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

// Returns every refresh-token candidate present on the request. There may be more
// than one cookie of the same name (e.g. a legacy /api/auth-scoped cookie alongside
// the new /-scoped one); callers must try each to find a valid token.
function getRefreshTokens(req) {
  const tokens = [];
  const cookieStr = req.headers.cookie || '';
  for (const part of cookieStr.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    if (key === REFRESH_COOKIE) tokens.push(decodeURIComponent(part.slice(eqIdx + 1).trim()));
  }
  const bodyToken = req.validated?.body?.refreshToken;
  if (bodyToken) tokens.push(bodyToken);
  return tokens;
}

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.validated.body;
    const existing = await authService.findUserByEmail(email);
    if (existing) return errorResponse(res, 'Email already in use', 409);
    const user = await authService.createUser({ name, email, password });
    const accessToken = authService.signAccessToken(buildAccessTokenPayload(user));
    const refreshToken = authService.signRefreshToken({ userId: user.id });
    await authService.storeRefreshToken(user.id, refreshToken);
    setAuthCookies(res, accessToken, refreshToken);
    return successResponse(res, { user, accessToken }, 201);
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.validated.body;
    const user = await authService.findUserWithRolesByEmail(email);
    if (!user || !user.is_active || user.status === 'SUSPENDED' || user.deleted_at) {
      return errorResponse(res, 'Invalid credentials', 401);
    }
    const valid = await authService.comparePassword(password, user.password_hash);
    if (!valid) return errorResponse(res, 'Invalid credentials', 401);

    const roleSlugs = user.roles?.map((ur) => ur.role?.slug).filter(Boolean) || [];
    const roleObjects = user.roles?.map((ur) => ur.role).filter(Boolean) || [];
    const { password_hash: _ignored, roles: _rolesIgnored, ...safeUser } = user;
    safeUser.roles = roleObjects;

    const accessToken = authService.signAccessToken(buildAccessTokenPayload(user, roleSlugs));
    const refreshToken = authService.signRefreshToken({ userId: user.id });
    await authService.storeRefreshToken(user.id, refreshToken);
    setAuthCookies(res, accessToken, refreshToken);
    return successResponse(res, { user: safeUser, accessToken });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const candidates = getRefreshTokens(req);
    if (!candidates.length) return errorResponse(res, 'Refresh token required', 401);

    // A browser may send several refresh cookies (e.g. a stale legacy one and the
    // current one). Use the first that both verifies and has a live DB record.
    let record = null;
    let usedToken = null;
    for (const token of candidates) {
      try {
        authService.verifyRefreshToken(token);
      } catch {
        continue;
      }
      const found = await authService.findValidRefreshToken(token);
      if (found && found.user.is_active && found.user.status !== 'SUSPENDED' && !found.user.deleted_at) {
        record = found;
        usedToken = token;
        break;
      }
    }
    if (!record) return errorResponse(res, 'Invalid or expired refresh token', 401);

    const roleSlugs = await authService.getUserRoleSlugs(record.user.id);
    const accessToken = authService.signAccessToken(
      buildAccessTokenPayload(record.user, roleSlugs),
    );
    await authService.revokeRefreshToken(usedToken);
    const newRefreshToken = authService.signRefreshToken({ userId: record.user.id });
    await authService.storeRefreshToken(record.user.id, newRefreshToken);
    setAuthCookies(res, accessToken, newRefreshToken);
    return successResponse(res, { accessToken });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    // Revoke every refresh token the request carries (legacy + current).
    const candidates = getRefreshTokens(req);
    await Promise.all(candidates.map((t) => authService.revokeRefreshToken(t).catch(() => {})));
    clearAuthCookies(res);
    return successResponse(res, { message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.validated.body;
    await authService.createPasswordResetToken(email);
    // Return a generic message regardless of whether the email exists to prevent enumeration.
    return successResponse(res, { message: 'If an account exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.validated.body;
    const user = await authService.resetPassword(token, password);
    if (!user) return errorResponse(res, 'Invalid or expired reset token', 400);
    return successResponse(res, { message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
};

export const getMyPermissions = async (req, res, next) => {
  try {
    const result = await resolvePermissions(req.user.id);
    const roles = await authService.getUserRoleSlugs(req.user.id);
    return successResponse(res, {
      permissions: result.permissions,
      roles,
      bypass: result.bypass,
    });
  } catch (err) {
    next(err);
  }
};
