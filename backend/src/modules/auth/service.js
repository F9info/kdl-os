import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { emailQueue } from '../../shared/queues/email.queue.js';
import {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ISSUER,
  JWT_AUDIENCE,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_MS,
} from '../../config/jwt.js';

const SALT_ROUNDS = 12;
const PASSWORD_RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

const JWT_SIGN_OPTS_COMMON = { algorithm: 'HS256', issuer: JWT_ISSUER, audience: JWT_AUDIENCE };
const JWT_VERIFY_REFRESH_OPTS = {
  algorithms: ['HS256'],
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
};

// L3: Pre-computed for constant-time compare when user is not found (timing-attack protection).
// Computed once at startup so the cost factor matches real logins.
export const DUMMY_HASH = bcrypt.hashSync('__kdl_timing_dummy__', SALT_ROUNDS);

export const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);
export const comparePassword = (password, hash) => bcrypt.compare(password, hash);

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// H1 + L2 + L1 + I1: type claim distinguishes access vs refresh; iss/aud added; algorithm pinned
export const signAccessToken = (payload) =>
  jwt.sign({ ...payload, type: 'access' }, JWT_SECRET, {
    ...JWT_SIGN_OPTS_COMMON,
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

export const signRefreshToken = (payload) =>
  // jti prevents identical tokens when login + refresh happen in the same second (iat precision)
  jwt.sign({ ...payload, type: 'refresh', jti: crypto.randomUUID() }, JWT_REFRESH_SECRET, {
    ...JWT_SIGN_OPTS_COMMON,
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });

// L1 + L2: algorithm pinned; iss/aud verified; H1: type:refresh enforced in controller
export const verifyRefreshToken = (token) =>
  jwt.verify(token, JWT_REFRESH_SECRET, JWT_VERIFY_REFRESH_OPTS);

export const findUserByEmail = (email) =>
  prisma.user.findUnique({ where: { email } });

export const findUserWithRolesByEmail = (email) =>
  prisma.user.findUnique({
    where: { email, deleted_at: null },
    include: {
      roles: {
        select: {
          role: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

export const getUserRoleSlugs = async (userId) => {
  const rows = await prisma.userRole.findMany({
    where: { user_id: userId },
    select: { role: { select: { slug: true } } },
  });
  return rows.map((ur) => ur.role.slug);
};

export const createUser = async ({ name, email, password }) => {
  const password_hash = await hashPassword(password);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, password_hash },
      select: { id: true, name: true, email: true, is_active: true, created_at: true },
    });

    const defaultRole = await tx.rbacRole.findUnique({
      where: { slug: 'user' },
      select: { id: true },
    });

    if (defaultRole) {
      await tx.userRole.create({
        data: { user_id: user.id, role_id: defaultRole.id },
      });
    }

    return { ...user, roles: defaultRole ? ['user'] : [] };
  });
};

// M3: familyId threads the same family through token rotation; new login/register gets a fresh UUID.
export const storeRefreshToken = (userId, token, familyId) => {
  const token_hash = hashToken(token);
  const expires_at = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
  const family_id = familyId ?? crypto.randomUUID();
  return prisma.refreshToken.create({ data: { user_id: userId, token_hash, expires_at, family_id } });
};

// Used for the initial valid-token lookup path (only non-revoked, non-expired)
export const findValidRefreshToken = (token) => {
  const token_hash = hashToken(token);
  return prisma.refreshToken.findFirst({
    where: { token_hash, revoked: false, expires_at: { gt: new Date() } },
    include: {
      user: { select: { id: true, email: true, is_active: true, status: true, deleted_at: true } },
    },
  });
};

// M3: Fetch any token by hash including revoked ones, so reuse can be detected.
export const findAnyRefreshTokenByHash = (token) => {
  const token_hash = hashToken(token);
  return prisma.refreshToken.findFirst({
    where: { token_hash },
    include: {
      user: { select: { id: true, email: true, is_active: true, status: true, deleted_at: true } },
    },
  });
};

export const revokeRefreshToken = (token) => {
  const token_hash = hashToken(token);
  return prisma.refreshToken.updateMany({ where: { token_hash }, data: { revoked: true } });
};

export const revokeAllRefreshTokensForUser = (userId) =>
  prisma.refreshToken.updateMany({ where: { user_id: userId }, data: { revoked: true } });

// M3: Revoke all tokens in the same family (stolen-token containment).
export const revokeFamilyById = (familyId) =>
  prisma.refreshToken.updateMany({ where: { family_id: familyId }, data: { revoked: true } });

// M1: Progressive per-account lockout keys (stored in Redis)
const LOCKOUT_KEY = (email) => `auth:lockout:${email.toLowerCase()}`;
const LOCKOUT_WINDOW_SECS = 30 * 60; // max TTL 30 min

const LOCKOUT_THRESHOLDS = [
  { attempts: 20, durationMs: 30 * 60 * 1000 },
  { attempts: 10, durationMs: 5 * 60 * 1000 },
  { attempts: 5, durationMs: 60 * 1000 },
];

export const checkAccountLockout = async (email) => {
  try {
    const raw = await redis.get(LOCKOUT_KEY(email));
    if (!raw) return null;
    const { lockedUntil } = JSON.parse(raw);
    return lockedUntil && Date.now() < lockedUntil ? lockedUntil : null;
  } catch {
    return null; // Redis unavailable — fail open (rate limiter still protects)
  }
};

export const recordFailedLoginAttempt = async (email) => {
  try {
    const key = LOCKOUT_KEY(email);
    const raw = await redis.get(key);
    const { attempts = 0 } = raw ? JSON.parse(raw) : {};
    const newAttempts = attempts + 1;

    let lockedUntil = null;
    let ttlSecs = LOCKOUT_WINDOW_SECS;
    for (const threshold of LOCKOUT_THRESHOLDS) {
      if (newAttempts >= threshold.attempts) {
        lockedUntil = Date.now() + threshold.durationMs;
        ttlSecs = Math.ceil(threshold.durationMs / 1000);
        break;
      }
    }

    await redis.set(key, JSON.stringify({ attempts: newAttempts, lockedUntil }), 'EX', ttlSecs);
    return lockedUntil;
  } catch {
    return null;
  }
};

export const clearLoginLockout = async (email) => {
  try {
    await redis.del(LOCKOUT_KEY(email));
  } catch {
    // ignore
  }
};

// L5: Invalidate all prior unused reset tokens before issuing a new one.
// M4/security: Always return the same shape regardless of whether the email exists.
export const createPasswordResetToken = async (email) => {
  const user = await findUserByEmail(email);
  if (!user || !user.is_active || user.status === 'SUSPENDED' || user.deleted_at) {
    return { user: null, token: null };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const token_hash = hashToken(rawToken);
  const expires_at = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_MS);

  await prisma.$transaction([
    // L5: invalidate any prior unused reset tokens
    prisma.passwordResetToken.updateMany({
      where: { user_id: user.id, used: false },
      data: { used: true },
    }),
    prisma.passwordResetToken.create({
      data: { user_id: user.id, token_hash, expires_at },
    }),
  ]);

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;
  await emailQueue.add('password-reset', {
    to: user.email,
    subject: 'Reset your KDL account password',
    html: `
      <p>Hi ${user.name},</p>
      <p>You requested a password reset. Click the link below to set a new password. It expires in 1 hour.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `.trim(),
  });

  return { user, token: rawToken };
};

export const findValidPasswordResetToken = (token) => {
  const token_hash = hashToken(token);
  return prisma.passwordResetToken.findFirst({
    where: {
      token_hash,
      used: false,
      expires_at: { gt: new Date() },
    },
    include: { user: { select: { id: true, email: true, is_active: true, status: true, deleted_at: true } } },
  });
};

// M2: Revoke all refresh tokens inside the password-reset transaction so all
// existing sessions are invalidated immediately after a password change.
export const resetPassword = async (token, password) => {
  const record = await findValidPasswordResetToken(token);
  if (!record || !record.user.is_active || record.user.status === 'SUSPENDED' || record.user.deleted_at) return null;

  const password_hash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.user.id },
      data: { password_hash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { used: true },
    }),
    // M2: revoke all refresh tokens so all sessions are invalidated atomically
    prisma.refreshToken.updateMany({
      where: { user_id: record.user.id },
      data: { revoked: true },
    }),
  ]);

  return record.user;
};
