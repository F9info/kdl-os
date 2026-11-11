// Social login providers as configuration (auth_providers) + the OAuth2 / OIDC authorization-code flow.
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../config/database.js';
import { redis } from '../../../config/redis.js';
import { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE } from '../../../config/jwt.js';
// Lazy: shared/utils/crypto.js throws at load when APP_ENCRYPTION_KEY is missing (same pattern as providers.service.js)
const crypt = () => import('../../../shared/utils/crypto.js');
import { assertPublicEndpoint } from '../../../shared/utils/ssrf-guard.js';
import { comparePassword } from '../../auth/service.js';
import { createAccount } from '../core.js';
import { recordEvent, httpError, notFound } from '../util.js';

export const PRESETS = {
  google: { label: 'Google', icon: 'google', color: '#4285F4', discovery_url: 'https://accounts.google.com/.well-known/openid-configuration', scopes: 'openid email profile', trust_email: true, hint: 'Google Cloud Console > Credentials' },
  facebook: { label: 'Facebook', icon: 'facebook', color: '#1877F2', authorize_url: 'https://www.facebook.com/v19.0/dialog/oauth', token_url: 'https://graph.facebook.com/v19.0/oauth/access_token', userinfo_url: 'https://graph.facebook.com/me?fields=id,name,email,picture.type(large)', scopes: 'email public_profile', claim_map: { sub: 'id', email: 'email', name: 'name', photo: 'picture.data.url' }, hint: 'Meta for Developers > Facebook Login' },
  apple: { label: 'Apple', icon: 'apple', color: '#000000', discovery_url: 'https://appleid.apple.com/.well-known/openid-configuration', scopes: 'name email', trust_email: true, options: { response_mode: 'form_post' }, hint: 'Services ID, Team ID, Key ID and the .p8 private key' },
  linkedin: { label: 'LinkedIn', icon: 'linkedin', color: '#0A66C2', discovery_url: 'https://www.linkedin.com/oauth/.well-known/openid-configuration', scopes: 'openid profile email', hint: 'LinkedIn > My apps > Auth > Authorized redirect URLs' },
};
const BUILT_IN = ['google', 'facebook', 'apple'];
const DEFAULT_MAP = { sub: 'sub', email: 'email', name: 'name', photo: 'picture' };
const SIGN = { algorithm: 'HS256', issuer: JWT_ISSUER, audience: JWT_AUDIENCE };
const STATE_TTL = 600;

export const siteBase = () => (process.env.PUBLIC_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
export const redirectUriFor = (key) => `${siteBase()}/api/membership/auth/oauth/${key}/callback`;

export async function ensureBuiltIns(db = prisma) {
  for (const [i, key] of BUILT_IN.entries()) {
    const { hint: _h, ...p } = PRESETS[key];
    await db.membershipAuthProvider.upsert({ where: { key }, create: { key, type: 'BUILT_IN', sort: i, button_text: `Continue with ${p.label}`, ...p }, update: {} });
  }
}

const hasSecret = (p) => !!p.client_secret_enc;
/** Admin payload (A4 contract): connection fields under `config`, never the secret. */
export function adminShape(p) {
  const { client_secret_enc, client_id, discovery_url, authorize_url, token_url, userinfo_url, scopes, claim_map, options, ...rest } = p;
  return {
    ...rest,
    type: p.type === 'OAUTH2_CUSTOM' ? 'OAUTH2' : 'OIDC',
    db_type: p.type,
    preset: PRESETS[p.key] ? p.key : null,
    has_secret: !!client_secret_enc,
    redirect_uri: redirectUriFor(p.key),
    status: statusOf(p),
    config: { client_id, discovery_url, authorize_url, token_url, userinfo_url, scopes, claim_map, ...(options?.team_id ? { team_id: options.team_id, key_id: options.key_id } : {}) },
  };
}
const statusOf = (p) => (!p.client_id || !hasSecret(p) ? 'KEYS_MISSING' : p.enabled ? 'CONNECTED' : 'DISABLED');

// ---------- admin CRUD ----------

export async function listProviders() {
  await ensureBuiltIns();
  const rows = await prisma.membershipAuthProvider.findMany({ orderBy: [{ sort: 'asc' }, { created_at: 'asc' }] });
  const counts = await prisma.membershipUserIdentity.groupBy({ by: ['provider'], _count: { _all: true } });
  const sms = await prisma.integrationProvider.findFirst({ where: { channel: 'SMS', is_active: true, is_default: true }, select: { name: true, driver: true } });
  const wa = await prisma.integrationProvider.findFirst({ where: { channel: 'WHATSAPP', is_active: true, is_default: true }, select: { name: true } });
  const items = rows.map((p) => ({ ...adminShape(p), members: counts.find((c) => c.provider === p.key)?._count._all ?? 0 }));
  const otp = { key: 'otp', type: 'OTP', preset: null, label: 'Mobile OTP', icon: 'phone', color: '#16a34a', button_text: 'Continue with mobile', enabled: !!(sms || wa), status: sms || wa ? 'CONNECTED' : 'KEYS_MISSING', members: 0, sort: -1, trust_email: false, has_secret: false, sms_provider: sms?.name ?? null, whatsapp_provider: wa?.name ?? null, config: { length: 6, expiry_seconds: 300 } };
  return [otp, ...items];
}

export const listPresets = () => Object.entries(PRESETS).map(([key, p]) => ({ key, ...p }));

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);

async function writable(body, existing) {
  const { config = {}, key: _k, preset: _p, type: _t, ...top } = body;
  const { client_secret, team_id, key_id, ...conf } = config;
  const data = { ...top, ...Object.fromEntries(Object.entries(conf).filter(([, v]) => v !== undefined)) };
  if (client_secret) data.client_secret_enc = (await crypt()).encrypt(client_secret); // blank = keep the stored one
  if (team_id || key_id) data.options = { ...(existing.options ?? {}), team_id, key_id };
  const merged = { ...existing, ...data };
  if (data.enabled && (!merged.client_id || !merged.client_secret_enc)) throw httpError(422, 'Save the client ID and secret before turning this provider on');
  if (data.enabled && !merged.discovery_url && !(merged.authorize_url && merged.token_url)) throw httpError(422, 'Give a discovery URL, or the authorize and token URLs');
  return data;
}

export async function createProvider(body, actor) {
  const preset = body.preset ? PRESETS[body.preset] : null;
  if (body.preset && !preset) throw httpError(422, 'Unknown preset');
  const { hint: _h, ...pre } = preset ?? {};
  const key = body.key ?? slug(body.preset ?? body.label);
  if (!key) throw httpError(422, 'A key or label is required');
  if (await prisma.membershipAuthProvider.findUnique({ where: { key } })) throw httpError(409, 'A provider with this key already exists');
  const type = preset ? 'PRESET' : body.type === 'OAUTH2' || (!body.config?.discovery_url && !body.type) ? 'OAUTH2_CUSTOM' : 'OIDC_CUSTOM';
  const max = await prisma.membershipAuthProvider.aggregate({ _max: { sort: true } });
  const { preset: _x, type: _t, ...rest } = body;
  const { label: _l, icon: _i, color: _c, scopes, discovery_url, authorize_url, token_url, userinfo_url, claim_map, trust_email, options, ...presetTop } = pre;
  const data = await writable({ button_text: `Continue with ${body.label ?? pre.label}`, icon: pre.icon, color: pre.color, trust_email, ...rest, config: { scopes, discovery_url, authorize_url, token_url, userinfo_url, claim_map, ...(rest.config ?? {}) }, enabled: false }, { options });
  void presetTop;
  const row = await prisma.membershipAuthProvider.create({ data: { key, type, sort: (max._max.sort ?? 0) + 1, label: body.label ?? pre.label, ...data, options: { ...(options ?? {}), ...(data.options ?? {}) } } });
  await recordEvent(prisma, { key: 'auth_provider.created', actor, data: { provider: key }, description: `Social login provider ${row.label} added` });
  return adminShape(row);
}

export async function getProvider(key) {
  const p = await prisma.membershipAuthProvider.findUnique({ where: { key } });
  if (!p) throw notFound('Provider');
  return p;
}

export async function updateProvider(key, body, actor) {
  const cur = await getProvider(key);
  const data = await writable(body, cur);
  if (body.config && Object.keys(body.config).some((k) => k !== 'scopes')) data.last_test_ok = null; // config changed: test again
  const row = await prisma.membershipAuthProvider.update({ where: { key }, data });
  await recordEvent(prisma, { key: 'auth_provider.updated', actor, data: { provider: key, fields: Object.keys(body) }, description: `Social login provider ${row.label} updated` });
  return adminShape(row);
}

export async function deleteProvider(key, actor) {
  const p = await getProvider(key);
  if (p.type === 'BUILT_IN') throw httpError(409, 'Built-in providers cannot be deleted: turn them off instead');
  if ((await prisma.membershipUserIdentity.count({ where: { provider: key } })) > 0) throw httpError(409, 'Members log in with this provider. Turn it off instead.');
  await prisma.membershipAuthProvider.delete({ where: { key } });
  await recordEvent(prisma, { key: 'auth_provider.deleted', actor, data: { provider: key }, description: `Social login provider ${p.label} deleted` });
  return { deleted: true };
}

export async function reorderProviders(keys, actor) {
  await prisma.$transaction(keys.filter((k) => k !== 'otp').map((key, sort) => prisma.membershipAuthProvider.updateMany({ where: { key }, data: { sort } })));
  await recordEvent(prisma, { key: 'auth_provider.reordered', actor, data: { keys }, description: 'Social login buttons reordered' });
  return listProviders();
}

export async function publicProviders() {
  await ensureBuiltIns();
  const rows = await prisma.membershipAuthProvider.findMany({ where: { enabled: true }, orderBy: [{ sort: 'asc' }] });
  return rows.map((p) => ({ key: p.key, label: p.label, button_text: p.button_text ?? `Continue with ${p.label}`, icon: p.icon, color: p.color, enabled: true }));
}

// ---------- discovery + configuration test ----------

async function getJson(url, init) {
  await assertPublicEndpoint(url);
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000), redirect: 'error' });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = Object.fromEntries(new URLSearchParams(text)); // Facebook/GitHub style form-encoded tokens
  }
  if (!res.ok) throw httpError(502, `Provider answered ${res.status}: ${String(body.error_description ?? body.error ?? text).slice(0, 160)}`);
  return body;
}

/** authorize / token / userinfo endpoints: explicit URLs win over discovery. */
export async function endpointsOf(p) {
  let d = {};
  if (p.discovery_url && !(p.authorize_url && p.token_url)) d = await getJson(p.discovery_url);
  return {
    authorize: p.authorize_url || d.authorization_endpoint,
    token: p.token_url || d.token_endpoint,
    userinfo: p.userinfo_url || d.userinfo_endpoint || null,
    issuer: d.issuer ?? null,
  };
}

export async function testProvider(key, actor) {
  const p = await getProvider(key);
  const checks = [];
  const add = (name, ok, detail = '') => checks.push({ name, ok, detail });
  add('Client ID saved', !!p.client_id);
  add('Client secret saved', hasSecret(p));
  let ep = null;
  try {
    ep = await endpointsOf(p);
    add('Provider endpoints reachable', !!(ep.authorize && ep.token), ep.authorize ? '' : 'No authorize/token endpoint');
  } catch (e) {
    add('Provider endpoints reachable', false, e.message);
  }
  add('Redirect URI to register at the provider', true, redirectUriFor(key));
  const ok = checks.filter((c) => c.name !== 'Redirect URI to register at the provider').every((c) => c.ok);
  const row = await prisma.membershipAuthProvider.update({ where: { key }, data: { last_test_at: new Date(), last_test_ok: ok, last_test_error: ok ? null : checks.find((c) => !c.ok)?.detail || 'Check failed' } });
  await recordEvent(prisma, { key: 'auth_provider.tested', actor, data: { provider: key, ok }, description: `Social login provider ${p.label} tested` });
  return { ok, checks, provider: adminShape(row) };
}

// ---------- authorization-code flow ----------

const b64 = (buf) => buf.toString('base64url');
const safeRedirect = (r) => (typeof r === 'string' && /^\/(?!\/)[^\s\\]*$/.test(r) ? r : null);

export async function startAuthorization(key, { redirect } = {}) {
  const p = await getProvider(key);
  if (!p.enabled) throw notFound('Provider');
  const ep = await endpointsOf(p);
  const state = b64(crypto.randomBytes(24));
  const verifier = b64(crypto.randomBytes(32));
  const nonce = b64(crypto.randomBytes(16));
  await redis.set(`mem:oauth:${state}`, JSON.stringify({ key, verifier, nonce, redirect: safeRedirect(redirect) }), 'EX', STATE_TTL);
  const q = new URLSearchParams({
    response_type: 'code', client_id: p.client_id, redirect_uri: redirectUriFor(key), scope: p.scopes, state, nonce,
    code_challenge: b64(crypto.createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256',
    ...(p.options?.response_mode ? { response_mode: p.options.response_mode } : {}),
  });
  return `${ep.authorize}${ep.authorize.includes('?') ? '&' : '?'}${q}`;
}

async function appleSecret(p) {
  const { decrypt } = await crypt();
  // Apple wants a short-lived ES256 JWT as the client secret: team id, key id and the .p8 key live in options/secret
  const { team_id, key_id } = p.options ?? {};
  if (!team_id || !key_id) return decrypt(p.client_secret_enc);
  return jwt.sign({}, decrypt(p.client_secret_enc), { algorithm: 'ES256', issuer: team_id, audience: 'https://appleid.apple.com', subject: p.client_id, expiresIn: '5m', keyid: key_id });
}

const dig = (obj, path) => String(path ?? '').split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

/** code -> normalized { sub, email, name, photo, email_verified } */
export async function exchangeCode(p, code, verifier) {
  const ep = await endpointsOf(p);
  const secret = p.key === 'apple' || p.discovery_url?.includes('apple.com') ? await appleSecret(p) : (await crypt()).decrypt(p.client_secret_enc);
  const form = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUriFor(p.key), client_id: p.client_id, client_secret: secret, code_verifier: verifier });
  const tok = await getJson(ep.token, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: form });
  let claims = {};
  if (tok.id_token) claims = jwt.decode(tok.id_token) ?? {}; // came straight from the token endpoint over TLS (OIDC Core 3.1.3.7)
  if (ep.userinfo && tok.access_token) claims = { ...claims, ...(await getJson(ep.userinfo, { headers: { authorization: `Bearer ${tok.access_token}`, accept: 'application/json' } })) };
  const map = { ...DEFAULT_MAP, ...(p.claim_map ?? {}) };
  const out = { sub: dig(claims, map.sub), email: dig(claims, map.email)?.toLowerCase?.() ?? null, name: dig(claims, map.name), photo: dig(claims, map.photo), email_verified: claims.email_verified === true || claims.email_verified === 'true' || p.trust_email };
  if (!out.sub) throw httpError(502, 'The provider did not return a user id');
  return { ...out, sub: String(out.sub) };
}

const linkToken = (p, c) => jwt.sign({ type: 'oauth_link', provider: p.key, sub: c.sub, email: c.email, name: c.name }, JWT_SECRET, { ...SIGN, expiresIn: '15m' });
export function readLinkToken(token) {
  try {
    const t = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
    return t.type === 'oauth_link' ? t : null;
  } catch {
    return null;
  }
}

/**
 * Callback outcome: { login: userId } | { link: token } (an account with this email exists; prove it with the password) | { error }.
 * Never links by email unless the provider says so AND vouches for the email.
 */
export async function completeAuthorization({ state, code }) {
  const raw = state ? await redis.get(`mem:oauth:${state}`) : null;
  if (!raw) return { error: 'expired' };
  await redis.del(`mem:oauth:${state}`);
  const st = JSON.parse(raw);
  const p = await getProvider(st.key);
  const c = await exchangeCode(p, code, st.verifier);

  const ident = await prisma.membershipUserIdentity.findUnique({ where: { provider_provider_user_id: { provider: p.key, provider_user_id: c.sub } } });
  if (ident) {
    await prisma.membershipUserIdentity.update({ where: { id: ident.id }, data: { last_login_at: new Date(), email: c.email ?? ident.email } });
    return { login: ident.user_id, redirect: st.redirect, provider: p.key };
  }
  if (!c.email) return { error: 'no_email' };
  const user = await prisma.user.findUnique({ where: { email: c.email }, select: { id: true, deleted_at: true } });
  if (user && !user.deleted_at) {
    if (p.auto_link && c.email_verified) {
      await addIdentity(user.id, p.key, c);
      return { login: user.id, redirect: st.redirect, provider: p.key };
    }
    return { link: linkToken(p, c), provider: p.key, email: c.email };
  }
  const userId = await prisma.$transaction(async (tx) => {
    const { user: u, member } = await createAccount(tx, { full_name: c.name || c.email.split('@')[0], email: c.email, mobile: null, member_type: 'INDIVIDUAL', password: crypto.randomBytes(24).toString('base64url'), photo_url: c.photo ?? null });
    await tx.membershipUserIdentity.create({ data: { user_id: u.id, provider: p.key, provider_user_id: c.sub, email: c.email, name: c.name, last_login_at: new Date() } });
    await recordEvent(tx, { key: 'member.joined', member_id: member.id, actor: u.id, data: { via: p.key, free: true }, description: `${member.full_name} signed up with ${p.label}` });
    return u.id;
  });
  return { login: userId, redirect: st.redirect ?? '/membership', provider: p.key, created: true };
}

async function addIdentity(userId, provider, c) {
  try {
    return await prisma.membershipUserIdentity.create({ data: { user_id: userId, provider, provider_user_id: c.sub, email: c.email, name: c.name, last_login_at: new Date() } });
  } catch (e) {
    if (e.code === 'P2002') throw httpError(409, 'This account is already linked to another member');
    throw e;
  }
}

/** POST /auth/link: prove the existing account with its password, then attach the provider identity. */
export async function linkWithPassword({ token, password }) {
  const t = readLinkToken(token);
  if (!t) throw httpError(400, 'This link request expired. Start the sign-in again.');
  const user = await prisma.user.findUnique({ where: { email: t.email } });
  if (!user || !user.is_active || user.deleted_at) throw httpError(401, 'Invalid credentials');
  if (!(await comparePassword(password, user.password_hash))) throw httpError(401, 'Invalid credentials');
  await addIdentity(user.id, t.provider, t);
  return user.id;
}

// ---------- member: identities ----------

export async function myIdentities(userId) {
  const rows = await prisma.membershipUserIdentity.findMany({ where: { user_id: userId }, orderBy: { created_at: 'asc' } });
  const provs = await prisma.membershipAuthProvider.findMany({ where: { key: { in: rows.map((r) => r.provider) } }, select: { key: true, label: true, icon: true } });
  return rows.map((r) => ({ id: r.id, provider: r.provider, label: provs.find((p) => p.key === r.provider)?.label ?? r.provider, email: r.email, name: r.name, linked_at: r.created_at, last_login_at: r.last_login_at }));
}

/** A member must keep one way to log in: a password they know, a verified mobile, or another identity. */
export async function removeIdentity(userId, id) {
  const ident = await prisma.membershipUserIdentity.findFirst({ where: { id, user_id: userId } });
  if (!ident) throw notFound('Identity');
  const others = await prisma.membershipUserIdentity.count({ where: { user_id: userId, id: { not: id } } });
  const member = await prisma.member.findUnique({ where: { user_id: userId }, select: { mobile: true } });
  if (!others && !member?.mobile) throw httpError(409, 'This is your only way to log in. Add a mobile number or another login first.');
  await prisma.membershipUserIdentity.delete({ where: { id } });
  return { deleted: true };
}
