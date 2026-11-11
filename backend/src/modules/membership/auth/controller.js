import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { h, actor, v } from '../handlers.js';
import { sendOtp, checkOtp, findMemberByMobile, signSignupToken } from './otp.service.js';
import { issueLogin } from './session.js';
import * as prov from './providers.service.js';
import { getClientIp } from '../../user-management/shared/activity-logger.js';
import { prisma } from '../../../config/database.js';

const IS_PROD = process.env.NODE_ENV === 'production';
const LINK_COOKIE = 'kdl-oauth-link';
const siteUrl = (path) => `${prov.siteBase()}${path}`;

export const otpSend = h((req) => sendOtp(v(req).body, getClientIp(req)));

export async function otpVerify(req, res, next) {
  try {
    const { mobile } = await checkOtp(v(req).body);
    const member = await findMemberByMobile(mobile);
    if (!member) return successResponse(res, { needs_signup: true, mobile, verification_token: signSignupToken(mobile) });
    return successResponse(res, await issueLogin(res, member.user_id));
  } catch (err) {
    next(err);
  }
}

export const providers = h(() => prov.publicProviders());

/** Browser navigation: 302 to the provider. */
export async function oauthStart(req, res, next) {
  try {
    return res.redirect(302, await prov.startAuthorization(v(req).params.provider, v(req).query));
  } catch (err) {
    if (err.status === 404) return res.redirect(302, siteUrl('/membership/login?error=provider_unavailable'));
    next(err);
  }
}

/** Provider redirects here (GET, or POST for Apple form_post). Ends with cookies + a redirect into the site. */
export async function oauthCallback(req, res) {
  const src = { ...req.query, ...(req.body ?? {}) };
  try {
    if (src.error) return res.redirect(302, siteUrl(`/membership/login?error=${encodeURIComponent(String(src.error).slice(0, 40))}`));
    const out = await prov.completeAuthorization({ state: src.state, code: src.code });
    if (out.error) return res.redirect(302, siteUrl(`/membership/login?error=${out.error}`));
    if (out.link) {
      res.cookie(LINK_COOKIE, out.link, { httpOnly: true, sameSite: 'lax', secure: IS_PROD, maxAge: 15 * 60 * 1000, path: '/' });
      return res.redirect(302, siteUrl(`/membership/link-account?provider=${out.provider}&email=${encodeURIComponent(out.email)}`));
    }
    await issueLogin(res, out.login);
    return res.redirect(302, siteUrl(out.redirect ?? '/membership/account'));
  } catch {
    return res.redirect(302, siteUrl('/membership/login?error=failed'));
  }
}

const cookieOf = (req, name) => (req.headers.cookie ?? '').split(';').map((s) => s.trim().split('=')).find(([k]) => k === name)?.[1];

export async function link(req, res, next) {
  try {
    const token = v(req).body.link_token ?? decodeURIComponent(cookieOf(req, LINK_COOKIE) ?? '');
    const userId = await prov.linkWithPassword({ token, password: v(req).body.password });
    res.clearCookie(LINK_COOKIE, { path: '/' });
    return successResponse(res, await issueLogin(res, userId));
  } catch (err) {
    if (err.status === 401) return errorResponse(res, err.message, 401);
    next(err);
  }
}

export const myIdentities = h((req) => prov.myIdentities(req.user.id).then((items) => ({ items })));
export const deleteIdentity = h((req) => prov.removeIdentity(req.user.id, v(req).params.id));

// ----- sessions (refresh-token families) -----
export const mySessions = h(async (req) => {
  const rows = await prisma.refreshToken.findMany({ where: { user_id: req.user.id, revoked: false, expires_at: { gt: new Date() } }, orderBy: { created_at: 'desc' } });
  const seen = new Set();
  const items = rows.filter((r) => (seen.has(r.family_id) ? false : seen.add(r.family_id))).map((r, i) => ({ id: r.family_id ?? r.id, created_at: r.created_at, expires_at: r.expires_at, current: i === 0 }));
  return { items };
});
export const deleteSession = h(async (req) => {
  const { count } = await prisma.refreshToken.updateMany({ where: { user_id: req.user.id, OR: [{ family_id: req.params.id }, { id: req.params.id }] }, data: { revoked: true } });
  return { revoked: count };
});
export const logoutAll = h(async (req) => ({ revoked: (await prisma.refreshToken.updateMany({ where: { user_id: req.user.id, revoked: false }, data: { revoked: true } })).count }));

// ----- admin -----
export const adminProviders = h(() => prov.listProviders());
export const adminPresets = h(() => prov.listPresets());
export const adminProviderCreate = h((req) => prov.createProvider(v(req).body, actor(req)), 201);
export const adminProviderUpdate = h((req) => prov.updateProvider(v(req).params.key, v(req).body, actor(req)));
export const adminProviderDelete = h((req) => prov.deleteProvider(v(req).params.key, actor(req)));
export const adminProviderTest = h((req) => prov.testProvider(v(req).params.key, actor(req)));
export const adminProviderReorder = h((req) => prov.reorderProviders(v(req).body.keys, actor(req)));
