import * as authService from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';

const IS_PROD = process.env.NODE_ENV === 'production';

const AUTH_COOKIE = 'kdl-auth-token';
const REFRESH_COOKIE = 'kdl-refresh-token';

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
    path: '/api/auth',
  });
}

function clearAuthCookies(res) {
  res.clearCookie(AUTH_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

function getRefreshToken(req) {
  const cookieStr = req.headers.cookie || '';
  for (const part of cookieStr.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    if (key === REFRESH_COOKIE) return decodeURIComponent(part.slice(eqIdx + 1).trim());
  }
  return req.validated?.body?.refreshToken ?? null;
}

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.validated.body;
    const existing = await authService.findUserByEmail(email);
    if (existing) return errorResponse(res, 'Email already in use', 409);
    const user = await authService.createUser({ name, email, password });
    const accessToken = authService.signAccessToken({ userId: user.id, email: user.email, role: user.role });
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
    const user = await authService.findUserByEmail(email);
    if (!user || !user.is_active) return errorResponse(res, 'Invalid credentials', 401);
    const valid = await authService.comparePassword(password, user.password_hash);
    if (!valid) return errorResponse(res, 'Invalid credentials', 401);
    const { password_hash: _ignored, ...safeUser } = user;
    const accessToken = authService.signAccessToken({ userId: user.id, email: user.email, role: user.role });
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
    const refreshToken = getRefreshToken(req);
    if (!refreshToken) return errorResponse(res, 'Refresh token required', 401);
    try {
      authService.verifyRefreshToken(refreshToken);
    } catch {
      return errorResponse(res, 'Invalid or expired refresh token', 401);
    }
    const record = await authService.findValidRefreshToken(refreshToken);
    if (!record || !record.user.is_active) return errorResponse(res, 'Invalid or expired refresh token', 401);
    const accessToken = authService.signAccessToken({
      userId: record.user.id,
      email: record.user.email,
      role: record.user.role,
    });
    await authService.revokeRefreshToken(refreshToken);
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
    const refreshToken = getRefreshToken(req);
    if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken);
    }
    clearAuthCookies(res);
    return successResponse(res, { message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};
