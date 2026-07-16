import * as authService from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { resolvePermissions } from '../user-management/shared/permission-resolver.js';
import { prisma } from '../../config/database.js';

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

    // M1: Check per-account progressive lockout before any DB query
    const lockedUntil = await authService.checkAccountLockout(email);
    if (lockedUntil) {
      const retryAfter = Math.ceil((lockedUntil - Date.now()) / 1000);
      return errorResponse(res, `Account temporarily locked. Retry after ${retryAfter}s.`, 429);
    }

    const user = await authService.findUserWithRolesByEmail(email);

    // L3: Always run bcrypt even when user not found to prevent timing attacks.
    if (!user || !user.is_active || user.status === 'SUSPENDED' || user.deleted_at) {
      await authService.comparePassword(password, authService.DUMMY_HASH);
      await authService.recordFailedLoginAttempt(email);
      return errorResponse(res, 'Invalid credentials', 401);
    }

    const valid = await authService.comparePassword(password, user.password_hash);
    if (!valid) {
      await authService.recordFailedLoginAttempt(email);
      return errorResponse(res, 'Invalid credentials', 401);
    }

    // Successful login — clear lockout counter
    await authService.clearLoginLockout(email);

    const roleSlugs = user.roles?.map((ur) => ur.role?.slug).filter(Boolean) || [];
    const roleObjects = user.roles?.map((ur) => ur.role).filter(Boolean) || [];
    const { password_hash: _ignored, roles: _rolesIgnored, ...safeUser } = user;
    safeUser.roles = roleObjects;

    const accessToken = authService.signAccessToken(buildAccessTokenPayload(user, roleSlugs));
    const refreshToken = authService.signRefreshToken({ userId: user.id });
    await authService.storeRefreshToken(user.id, refreshToken);
    setAuthCookies(res, accessToken, refreshToken);
    prisma.user.update({ where: { id: user.id }, data: { last_login_at: new Date() } }).catch(() => {});
    return successResponse(res, { user: safeUser, accessToken });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const candidates = getRefreshTokens(req);
    if (!candidates.length) return errorResponse(res, 'Refresh token required', 401);

    // A browser may send several refresh cookies (e.g. a stale legacy one and the current one).
    for (const token of candidates) {
      // Step 1: verify JWT signature + claims (iss/aud/exp/type pinned in verifyRefreshToken)
      try {
        const payload = authService.verifyRefreshToken(token);
        // H1: reject access tokens presented as refresh tokens
        if (payload.type !== 'refresh') continue;
      } catch {
        continue;
      }

      // Step 2: M3 — look up the DB record including revoked tokens
      const dbRecord = await authService.findAnyRefreshTokenByHash(token);

      if (!dbRecord) {
        // Genuinely unknown token (expired + cleaned up, or never issued) — skip
        continue;
      }

      if (dbRecord.revoked) {
        // M3: Token reuse detected — revoke the whole family to contain the breach
        if (dbRecord.family_id) {
          await authService.revokeFamilyById(dbRecord.family_id);
        } else {
          // Fallback for pre-migration tokens without a family_id
          await authService.revokeAllRefreshTokensForUser(dbRecord.user_id);
        }
        return errorResponse(res, 'Refresh token reuse detected — all sessions revoked', 401);
      }

      if (dbRecord.expires_at < new Date()) continue;

      const { user } = dbRecord;
      if (!user.is_active || user.status === 'SUSPENDED' || user.deleted_at) continue;

      // Valid token — rotate it, threading the same family_id through
      const roleSlugs = await authService.getUserRoleSlugs(user.id);
      const accessToken = authService.signAccessToken(buildAccessTokenPayload(user, roleSlugs));
      await authService.revokeRefreshToken(token);
      const newRefreshToken = authService.signRefreshToken({ userId: user.id });
      await authService.storeRefreshToken(user.id, newRefreshToken, dbRecord.family_id);
      setAuthCookies(res, accessToken, newRefreshToken);
      return successResponse(res, { accessToken });
    }

    return errorResponse(res, 'Invalid or expired refresh token', 401);
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
