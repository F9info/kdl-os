// Mobile OTP: 6 digits, 5-minute expiry, 5 attempts, 30 s between sends, 5 sends per number per hour.
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../config/database.js';
import { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE } from '../../../config/jwt.js';
import { logger } from '../../../shared/utils/logger.js';
import { getCommSettings } from '../comm/settings.js';
import { toE164, maskContact } from '../comm/render.js';
import { httpError } from '../util.js';

/** Fail closed: the code leaves the server in an API response only when explicitly enabled AND NODE_ENV is exactly "development". */
export const debugCodeAllowed = (env = process.env) => env.OTP_DEBUG_RESPONSE === 'true' && env.NODE_ENV === 'development';

/** Test aid: a fixed 6-digit code, honoured only when NODE_ENV is exactly "development" (never in production). */
export const fixedOtp = (env = process.env) => (env.NODE_ENV === 'development' && /^\d{6}$/.test(env.OTP_FIXED_CODE ?? '') ? env.OTP_FIXED_CODE : null);

export const OTP_TTL_S = 300;
export const OTP_RESEND_S = 30;
export const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_PER_HOUR = 5;

const hash = (mobile, code) => crypto.createHmac('sha256', JWT_SECRET).update(`${mobile}:${code}`).digest('hex');
export const normalizeMobile = (raw, cc = '+91') => toE164(raw, cc);

/** Member rows store the number as typed (10 digits, +91..., spaces): match every spelling of the same number. */
export function mobileVariants(e164) {
  const digits = e164.slice(1);
  const v = new Set([e164, digits]);
  if (e164.startsWith('+91')) v.add(digits.slice(2));
  return [...v];
}

export async function findMemberByMobile(e164, db = prisma) {
  return db.member.findFirst({ where: { mobile: { in: mobileVariants(e164) } }, orderBy: { created_at: 'asc' } });
}

async function deliver(channel, to, body, subject) {
  const provider = await prisma.integrationProvider.findFirst({ where: { channel, is_active: true, is_default: true }, select: { id: true } });
  if (!provider) return false;
  try {
    const { dispatchMessage } = await import('../../integrations/service.js');
    await dispatchMessage({ channel, to, subject, body, source: 'membership.otp' });
    return true;
  } catch (err) {
    logger.warn(`membership otp: ${channel} delivery failed: ${err.message}`);
    return false;
  }
}

export async function sendOtp({ mobile, purpose = 'login' }, ip = null) {
  const settings = await getCommSettings();
  const to = normalizeMobile(mobile, settings.whatsapp.default_country_code);
  if (!to) throw httpError(422, 'Enter a valid mobile number');
  const now = Date.now();
  const recent = await prisma.membershipOtpCode.findMany({ where: { mobile: to, created_at: { gte: new Date(now - 3_600_000) } }, orderBy: { created_at: 'desc' } });
  if (recent[0] && now - recent[0].created_at.getTime() < OTP_RESEND_S * 1000) {
    const wait = Math.ceil((OTP_RESEND_S * 1000 - (now - recent[0].created_at.getTime())) / 1000);
    throw Object.assign(httpError(429, `Please wait ${wait}s before asking for another code`), { retry_after: wait });
  }
  if (ip && recent.filter((r) => r.ip === ip).length >= 3) throw httpError(429, 'Too many codes requested from this device. Try again later.');
  if (recent.length >= OTP_MAX_PER_HOUR) throw httpError(429, 'Too many codes requested for this number. Try again in an hour.');

  const code = fixedOtp() ?? String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await prisma.membershipOtpCode.updateMany({ where: { mobile: to, consumed_at: null }, data: { consumed_at: new Date() } }); // only the newest code works
  await prisma.membershipOtpCode.create({ data: { mobile: to, purpose, code_hash: hash(to, code), expires_at: new Date(now + OTP_TTL_S * 1000), ip } });

  const text = `${code} is your ${settings.company.name} verification code. It expires in 5 minutes. Do not share it.`;
  const sms = await deliver('SMS', to, text);
  const wa = await deliver('WHATSAPP', to, text);
  let mail = false;
  if (!sms && !wa) {
    const m = await findMemberByMobile(to);
    if (m?.email) mail = await deliver('EMAIL', m.email, `<p>${text}</p>`, `${code} is your verification code`);
  }
  const delivered = sms || wa || mail;
  if (!delivered) logger.warn(`membership otp: no SMS/WhatsApp/Email provider configured, code for ${maskContact(to)} not delivered`);
  if (debugCodeAllowed()) logger.info(`membership otp (development only): ${maskContact(to)} -> ${code}`);
  return { sent: true, expires_in: OTP_TTL_S, resend_in: OTP_RESEND_S, ...(debugCodeAllowed() ? { dev_code: code } : {}) };
}

/** Valid code -> consumed + { mobile }. Wrong code counts an attempt; the 6th try (or an expired code) is refused. */
export async function checkOtp({ mobile, code }) {
  const settings = await getCommSettings();
  const to = normalizeMobile(mobile, settings.whatsapp.default_country_code);
  if (!to) throw httpError(422, 'Enter a valid mobile number');
  const row = await prisma.membershipOtpCode.findFirst({ where: { mobile: to, consumed_at: null }, orderBy: { created_at: 'desc' } });
  if (!row || row.expires_at < new Date()) throw httpError(400, 'This code has expired. Ask for a new one.');
  if (row.attempts >= OTP_MAX_ATTEMPTS) throw httpError(429, 'Too many wrong attempts. Ask for a new code.');
  const ok = crypto.timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(hash(to, String(code))));
  if (!ok) {
    await prisma.membershipOtpCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    throw httpError(400, `That code is not right. ${Math.max(0, OTP_MAX_ATTEMPTS - row.attempts - 1)} tries left.`);
  }
  await prisma.membershipOtpCode.update({ where: { id: row.id }, data: { consumed_at: new Date() } });
  return { mobile: to };
}

const SIGN = { algorithm: 'HS256', issuer: JWT_ISSUER, audience: JWT_AUDIENCE };
export const signSignupToken = (mobile) => jwt.sign({ type: 'mobile_verified', mobile }, JWT_SECRET, { ...SIGN, expiresIn: '30m' });
export function verifySignupToken(token) {
  try {
    const p = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
    return p.type === 'mobile_verified' ? p.mobile : null;
  } catch {
    return null;
  }
}
