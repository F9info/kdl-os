import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../config/database.js';

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const refreshSecret = () => process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

export const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);
export const comparePassword = (password, hash) => bcrypt.compare(password, hash);

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const signAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

export const signRefreshToken = (payload) =>
  jwt.sign(payload, refreshSecret(), { expiresIn: REFRESH_TOKEN_EXPIRY });

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
