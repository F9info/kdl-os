import { prisma } from '../../../config/database.js';
import { encrypt, decrypt } from '../../../shared/utils/crypto.js';
import { logger } from '../../../shared/utils/logger.js';
import { uploadMedia } from '../service.js';
import { writeActivityAsync } from '../../user-management/shared/activity-logger.js';
import registry, { getImportDriver } from './drivers/index.js';

const STATE_TTL_MS = 10 * 60 * 1000;

export const getRedirectUri = (provider) => {
  const base = process.env.APP_PUBLIC_URL || `http://localhost:${process.env.APP_PORT || 4000}`;
  return `${base}/api/media/import/oauth/${provider}/callback`;
};

export const getProviderStatus = () =>
  Object.values(registry).map((d) => ({
    provider: d.provider,
    oauth: d.oauth,
    configured: d.oauth ? d.isAppConfigured() : true,
  }));

export const listConnections = (userId) =>
  prisma.mediaImportConnection.findMany({
    where: { user_id: userId },
    select: { id: true, provider: true, label: true, created_at: true, updated_at: true },
    orderBy: { created_at: 'desc' },
  });

export const createManualConnection = async (userId, { provider, label, credentials }) => {
  const driver = getImportDriver(provider);
  if (driver.oauth) {
    throw Object.assign(new Error(`"${provider}" is connected via OAuth, not manual credentials`), { status: 422 });
  }
  const result = driver.credentialsSchema.safeParse(credentials);
  if (!result.success) {
    throw Object.assign(new Error(`Invalid credentials: ${result.error.message}`), { status: 422 });
  }
  return prisma.mediaImportConnection.create({
    data: { user_id: userId, provider, label, credentials: encrypt(JSON.stringify(result.data)) },
    select: { id: true, provider: true, label: true, created_at: true, updated_at: true },
  });
};

export const deleteConnection = async (userId, id) => {
  const existing = await prisma.mediaImportConnection.findFirst({ where: { id, user_id: userId } });
  if (!existing) throw Object.assign(new Error('Import connection not found'), { status: 404 });
  await prisma.mediaImportConnection.delete({ where: { id } });
  return existing;
};

const buildState = (userId, provider) => encrypt(JSON.stringify({ userId, provider, ts: Date.now() }));

const parseState = (state, provider) => {
  let parsed;
  try {
    parsed = JSON.parse(decrypt(state));
  } catch {
    throw Object.assign(new Error('Invalid or tampered OAuth state'), { status: 422 });
  }
  if (parsed.provider !== provider) {
    throw Object.assign(new Error('OAuth state does not match provider'), { status: 422 });
  }
  if (Date.now() - parsed.ts > STATE_TTL_MS) {
    throw Object.assign(new Error('OAuth state expired — restart the connection flow'), { status: 422 });
  }
  return parsed;
};

export const startOAuth = (userId, provider) => {
  const driver = getImportDriver(provider);
  if (!driver.oauth) throw Object.assign(new Error(`"${provider}" does not use OAuth`), { status: 422 });
  if (!driver.isAppConfigured()) {
    throw Object.assign(new Error(`Cloud import provider "${provider}" is not configured on this server`), { status: 501 });
  }
  const redirectUri = getRedirectUri(provider);
  const state = buildState(userId, provider);
  return { url: driver.getAuthUrl({ redirectUri, state }) };
};

// Returns { userId, connection } on success — controller decides how to redirect.
export const completeOAuth = async (provider, { code, state }) => {
  const driver = getImportDriver(provider);
  if (!driver.oauth) throw Object.assign(new Error(`"${provider}" does not use OAuth`), { status: 422 });
  const { userId } = parseState(state, provider);
  if (!driver.isAppConfigured()) {
    throw Object.assign(new Error(`Cloud import provider "${provider}" is not configured on this server`), { status: 501 });
  }

  const credentials = await driver.exchangeCode({ code, redirectUri: getRedirectUri(provider) });
  const result = driver.credentialsSchema.safeParse(credentials);
  if (!result.success) throw new Error(`${provider} returned malformed credentials`);

  const connection = await prisma.mediaImportConnection.create({
    data: {
      user_id: userId,
      provider,
      label: `${provider} (connected)`,
      credentials: encrypt(JSON.stringify(result.data)),
    },
    select: { id: true, provider: true, label: true },
  });

  writeActivityAsync({
    actor: userId,
    module: 'media',
    action: 'import_connection_connected',
    description: `Cloud import connection "${connection.label}" connected via OAuth`,
    properties: { connection_id: connection.id, provider },
  });

  return { userId, connection };
};

const getOwnedConnection = async (userId, id) => {
  const connection = await prisma.mediaImportConnection.findFirst({ where: { id, user_id: userId } });
  if (!connection) throw Object.assign(new Error('Import connection not found'), { status: 404 });
  let credentials;
  try {
    credentials = JSON.parse(decrypt(connection.credentials));
  } catch (err) {
    logger.error(`Import connection ${connection.id} credentials cannot be decrypted: ${err.message}`);
    throw Object.assign(new Error('Import connection credentials are invalid — reconnect'), { status: 422 });
  }
  return { connection, credentials, driver: getImportDriver(connection.provider) };
};

export const listRemoteFiles = async (userId, id, { folderId, cursor } = {}) => {
  const { credentials, driver } = await getOwnedConnection(userId, id);
  return driver.list({ credentials, folderId, cursor });
};

// Cloud drivers that don't report a MIME type (Dropbox, FTP) fall back to this —
// deliberately not shared with import.service.js's zip-entry map: pulling that
// module in here would also drag in its file-ops.service.js → storage.service.js
// chain for a one-line lookup.
const EXT_TO_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac', ogg: 'audio/ogg', flac: 'audio/flac',
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  psd: 'image/vnd.adobe.photoshop', ai: 'application/postscript',
};

const guessMime = (filename) => {
  const ext = filename?.includes('.') ? filename.split('.').pop().toLowerCase() : '';
  return EXT_TO_MIME[ext] ?? 'application/octet-stream';
};

export const importRemoteFiles = async (userId, id, { fileIds, folderId }) => {
  const { credentials, driver } = await getOwnedConnection(userId, id);

  const imported = [];
  const skipped = [];
  for (const fileId of fileIds) {
    try {
      const { buffer, filename, mimeType } = await driver.download({ credentials, fileId });
      const file = {
        buffer,
        size: buffer.length,
        mimetype: mimeType || guessMime(filename),
        originalname: filename || fileId.split('/').pop(),
      };
      const media = await uploadMedia(file, userId, folderId ?? null);
      imported.push({ id: media.id, name: file.originalname });
    } catch (err) {
      skipped.push({ file_id: fileId, reason: err.message });
    }
  }

  writeActivityAsync({
    actor: userId,
    module: 'media',
    action: 'cloud_import',
    description: `Cloud import (${driver.provider}): ${imported.length} file(s) imported, ${skipped.length} skipped`,
    properties: { connection_id: id, provider: driver.provider },
  });

  return { imported, skipped };
};
