import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import { emailQueue } from '../../shared/queues/email.queue.js';

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

const refreshSecret = () => process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

export const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);
export const comparePassword = (password, hash) => bcrypt.compare(password, hash);

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const signAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

export const signRefreshToken = (payload) =>
  // Include a unique jti so two refresh tokens for the same user are never
  // byte-identical (JWT iat has only second precision). Without it, login +
  // an immediate refresh in the same second produce the same token_hash and
  // the unique-constrained insert in storeRefreshToken fails.
  jwt.sign({ ...payload, jti: crypto.randomUUID() }, refreshSecret(), {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });

export const verifyRefreshToken = (token) =>
  jwt.verify(token, refreshSecret());

export const findUserByEmail = (email) =>
  prisma.user.findUnique({ where: { email } });

export const createUser = async ({ name, email, password }) => {
  const password_hash = await hashPassword(password);
  return prisma.user.create({
    data: { name, email, password_hash },
    select: { id: true, name: true, email: true, role: true, is_active: true, created_at: true },
  });
};

export const storeRefreshToken = (userId, token) => {
  const token_hash = hashToken(token);
  const expires_at = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
  return prisma.refreshToken.create({ data: { user_id: userId, token_hash, expires_at } });
};

export const findValidRefreshToken = (token) => {
  const token_hash = hashToken(token);
  return prisma.refreshToken.findFirst({
    where: { token_hash, revoked: false, expires_at: { gt: new Date() } },
    include: {
      user: { select: { id: true, email: true, role: true, is_active: true } },
    },
  });
};

export const revokeRefreshToken = (token) => {
  const token_hash = hashToken(token);
  return prisma.refreshToken.updateMany({ where: { token_hash }, data: { revoked: true } });
};

export const createPasswordResetToken = async (email) => {
  const user = await findUserByEmail(email);
  // Always return the same shape so the endpoint doesn't leak whether the email exists.
  if (!user || !user.is_active) {
    return { user: null, token: null };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const token_hash = hashToken(rawToken);
  const expires_at = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_MS);

  await prisma.passwordResetToken.create({
    data: { user_id: user.id, token_hash, expires_at },
  });

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
    include: { user: { select: { id: true, email: true, is_active: true } } },
  });
};

export const resetPassword = async (token, password) => {
  const record = await findValidPasswordResetToken(token);
  if (!record || !record.user.is_active) return null;

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
  ]);

  return record.user;
};
