import { prisma } from '../../../config/database.js';
import { signAccessToken, signRefreshToken, storeRefreshToken } from '../../auth/service.js';
import { buildAccessTokenPayload, setAuthCookies } from '../../auth/controller.js';
import { httpError } from '../util.js';

/** Same result as POST /api/auth/login: cookies + { user, accessToken }. */
export async function issueLogin(res, userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { roles: { select: { role: { select: { id: true, name: true, slug: true } } } } } });
  if (!user || user.deleted_at || !user.is_active || user.status === 'SUSPENDED') throw httpError(403, 'Account is inactive');
  const roles = user.roles.map((r) => r.role).filter(Boolean);
  const { password_hash: _p, roles: _r, ...safe } = user;
  safe.roles = roles;
  const accessToken = signAccessToken(buildAccessTokenPayload(user, roles.map((r) => r.slug)));
  const refreshToken = signRefreshToken({ userId: user.id });
  await storeRefreshToken(user.id, refreshToken);
  if (res) setAuthCookies(res, accessToken, refreshToken);
  prisma.user.update({ where: { id: user.id }, data: { last_login_at: new Date() } }).catch(() => {});
  return { user: safe, accessToken };
}
