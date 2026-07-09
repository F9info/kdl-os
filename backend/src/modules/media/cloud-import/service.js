// Phase D8 — cloud import connections + browse + import-into-Media.
// Credentials (OAuth tokens or S3/FTP creds) are encrypted at rest with the shared
// aes-256-gcm helper (same pattern as ai-provider/integrations) and never leave
// the server: list/browse responses carry ids and labels only.

import { prisma } from '../../../config/database.js';
import { encrypt, decrypt } from '../../../shared/utils/crypto.js';
import { getImportDriver, IMPORT_PROVIDERS } from './drivers/index.js';
import registry from './drivers/index.js';
import { isOAuthConfigured, buildAuthUrl, verifyState, exchangeCode, refreshTokens } from './oauth.js';
import { getUploadSettings } from '../settings.js';
import { uploadMedia } from '../service.js';
import { EXT_TO_MIME } from '../import.service.js';
import { writeActivityAsync } from '../../user-management/shared/activity-logger.js';

const CONNECTION_SELECT = { id: true, provider: true, label: true, created_at: true, updated_at: true };

// ─── Providers / connections ─────────────────────────────────────────────────

export const listImportProviders = () =>
  IMPORT_PROVIDERS.map((provider) => ({
    provider,
    auth: registry[provider].auth,
    // credential providers are always available; OAuth ones need app creds in env
    configured: registry[provider].auth === 'credentials' || isOAuthConfigured(provider),
  }));

export const listConnections = (userId) =>
  prisma.mediaImportConnection.findMany({
    where: { user_id: userId },
    select: CONNECTION_SELECT,
    orderBy: { created_at: 'desc' },
  });

export const createConnection = async (userId, { provider, label, credentials }) => {
  const driver = getImportDriver(provider);
  if (driver.auth !== 'credentials') {
    throw Object.assign(new Error(`${provider} connections are created via the OAuth flow`), { status: 422 });
  }
  return prisma.mediaImportConnection.create({
    data: {
      user_id: userId,
      provider,
      label: label || provider,
      credentials: encrypt(JSON.stringify(credentials)),
    },
    select: CONNECTION_SELECT,
  });
};

export const deleteConnection = async (userId, id) => {
  const row = await prisma.mediaImportConnection.findUnique({ where: { id } });
  if (!row || row.user_id !== userId) {
    throw Object.assign(new Error('Connection not found'), { status: 404 });
  }
  await prisma.mediaImportConnection.delete({ where: { id } });
};

// ─── OAuth flow ──────────────────────────────────────────────────────────────

export const getAuthUrl = (provider, userId, redirectUri) => {
  getImportDriver(provider); // 422 on unknown provider
  return buildAuthUrl(provider, userId, redirectUri);
};

export const completeOAuth = async (userId, provider, { code, state, redirect_uri, label }, deps = {}) => {
  verifyState(state, userId, provider);
  const tokens = await exchangeCode(provider, code, redirect_uri, deps);
  return prisma.mediaImportConnection.create({
    data: {
      user_id: userId,
      provider,
      label: label || provider,
      credentials: encrypt(JSON.stringify(tokens)),
    },
    select: CONNECTION_SELECT,
  });
};

// ─── Browse + import ─────────────────────────────────────────────────────────

const getConnection = async (userId, id) => {
  const row = await prisma.mediaImportConnection.findUnique({ where: { id } });
  if (!row || row.user_id !== userId) {
    throw Object.assign(new Error('Connection not found'), { status: 404 });
  }
  return { row, creds: JSON.parse(decrypt(row.credentials)) };
};

// Runs `fn(creds)`; on a 401 from an OAuth provider, refreshes tokens, persists
// them, and retries once. Credential providers (s3/ftp) surface 401s as-is.
const withConnection = async (userId, id, fn, deps = {}) => {
  const { row, creds } = await getConnection(userId, id);
  const driver = getImportDriver(row.provider);
  try {
    return await fn(driver, creds, row);
  } catch (err) {
    if (err?.status !== 401 || driver.auth !== 'oauth') throw err;
    const refreshed = await refreshTokens(row.provider, creds, deps);
    await prisma.mediaImportConnection.update({
      where: { id: row.id },
      data: { credentials: encrypt(JSON.stringify(refreshed)) },
    });
    return fn(driver, refreshed, row);
  }
};

export const browseConnection = (userId, id, { path, cursor } = {}, deps = {}) =>
  withConnection(userId, id, (driver, creds) => driver.list(creds, { path, cursor }, deps), deps);

const resolveMime = (driverMime, name) => {
  if (driverMime) return driverMime.toLowerCase();
  const base = String(name ?? '');
  const ext = base.includes('.') ? base.split('.').pop().toLowerCase() : '';
  return EXT_TO_MIME[ext] ?? null;
};

export const importFiles = async (userId, id, { files, folder_id } = {}, deps = {}) => {
  const settings = await getUploadSettings();
  const connection = await getConnection(userId, id);
  const { row } = connection;
  const driver = getImportDriver(row.provider);
  const imported = [];
  const skipped = [];

  // Refresh-and-retry happens PER DOWNLOAD (not per batch): a mid-batch token
  // expiry must not restart the loop, or already-uploaded files would duplicate.
  let { creds } = connection;
  const downloadWithRefresh = async (fileId) => {
    try {
      return await driver.download(creds, fileId, deps);
    } catch (err) {
      if (err?.status !== 401 || driver.auth !== 'oauth') throw err;
      creds = await refreshTokens(row.provider, creds, deps);
      await prisma.mediaImportConnection.update({
        where: { id: row.id },
        data: { credentials: encrypt(JSON.stringify(creds)) },
      });
      return driver.download(creds, fileId, deps);
    }
  };

  for (const fileId of files) {
    let downloaded;
    try {
      downloaded = await downloadWithRefresh(fileId);
    } catch (err) {
      skipped.push({ file: fileId, reason: err.message });
      continue;
    }

    const mime = resolveMime(downloaded.mime, downloaded.name);
    if (!mime || !settings.allowedMimes.has(mime)) {
      skipped.push({ file: fileId, reason: `file type not allowed: ${mime ?? 'unknown'}` });
      continue;
    }
    if (downloaded.buffer.length > settings.maxFileSizeBytes) {
      skipped.push({ file: fileId, reason: `exceeds max size of ${settings.maxFileSizeMb}MB` });
      continue;
    }

    const file = {
      buffer: downloaded.buffer,
      size: downloaded.buffer.length,
      mimetype: mime,
      originalname: downloaded.name || String(fileId).split('/').pop(),
    };
    try {
      const media = await uploadMedia(file, userId, folder_id ?? null);
      imported.push({ id: media.id, name: file.originalname });
    } catch (err) {
      skipped.push({ file: fileId, reason: err.message });
    }
  }

  writeActivityAsync({
    actor: userId, module: 'media', action: 'cloud_imported',
    description: `Cloud import (${row.provider}): ${imported.length} file(s) imported, ${skipped.length} skipped`,
  });
  return { imported, skipped };
};
