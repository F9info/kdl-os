import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database.js';
import { getFileUrl } from '../../shared/services/storage.service.js';

// Generate a URL-safe token
const genToken = () => randomBytes(24).toString('base64url');

export const createShare = async ({ media_id, folder_id, password, expires_at, max_downloads }, createdBy) => {
  if (!media_id && !folder_id) throw Object.assign(new Error('media_id or folder_id required'), { status: 400 });
  const token = genToken();
  const password_hash = password ? await bcrypt.hash(password, 10) : null;
  return prisma.mediaShare.create({
    data: {
      media_id: media_id ?? null,
      folder_id: folder_id ?? null,
      token,
      password_hash,
      expires_at: expires_at ? new Date(expires_at) : null,
      max_downloads: max_downloads ?? null,
      created_by: createdBy ?? null,
    },
  });
};

export const revokeShare = async (id, actorId) => {
  const share = await prisma.mediaShare.findUnique({ where: { id } });
  if (!share) throw Object.assign(new Error('Not found'), { status: 404 });
  if (share.created_by && share.created_by !== actorId) throw Object.assign(new Error('Forbidden'), { status: 403 });
  return prisma.mediaShare.update({ where: { id }, data: { revoked: true } });
};

export const listShares = async (mediaId) => {
  return prisma.mediaShare.findMany({ where: { media_id: mediaId }, orderBy: { created_at: 'desc' } });
};

// Resolve share token (used by public route — no auth)
export const resolveShare = async (token, password) => {
  const share = await prisma.mediaShare.findUnique({ where: { token } });
  if (!share || share.revoked) throw Object.assign(new Error('Gone'), { status: 410 });
  if (share.expires_at && share.expires_at < new Date()) {
    await prisma.mediaShare.update({ where: { id: share.id }, data: { revoked: true } });
    throw Object.assign(new Error('Gone'), { status: 410 });
  }
  if (share.max_downloads !== null && share.download_count >= share.max_downloads) {
    throw Object.assign(new Error('Gone'), { status: 410 });
  }
  if (share.password_hash) {
    if (!password) throw Object.assign(new Error('Password required'), { status: 401 });
    const ok = await bcrypt.compare(password, share.password_hash);
    if (!ok) throw Object.assign(new Error('Invalid password'), { status: 403 });
  }

  // Increment download counter
  await prisma.mediaShare.update({ where: { id: share.id }, data: { download_count: { increment: 1 } } });

  // Return media or folder
  if (share.media_id) {
    const media = await prisma.media.findUnique({ where: { id: share.media_id, deleted_at: null } });
    if (!media) throw Object.assign(new Error('Gone'), { status: 410 });
    const url = await getFileUrl(media.path);
    return { type: 'media', media: { ...media, url }, share };
  }
  if (share.folder_id) {
    const folder = await prisma.mediaFolder.findUnique({ where: { id: share.folder_id } });
    const items = await prisma.media.findMany({ where: { folder_id: share.folder_id, deleted_at: null }, take: 100 });
    return { type: 'folder', folder, items, share };
  }
  throw Object.assign(new Error('Gone'), { status: 410 });
};

// Generate QR code PNG buffer for a share URL
export const getShareQr = async (token, baseUrl) => {
  const { default: QRCode } = await import('qrcode');
  const url = baseUrl + '/share/' + token;
  return QRCode.toBuffer(url, { type: 'png', width: 300 });
};

// Embed snippet HTML
export const getEmbedSnippet = (token, baseUrl) => {
  return '<iframe src="' + baseUrl + '/share/' + token + '" width="800" height="600" frameborder="0" allowfullscreen></iframe>';
};

// KDL-172 — batch-resolve which of the given media ids currently have at
// least one active (not revoked, not expired, not download-exhausted) share
// link, so listing/detail endpoints can surface a "Shared" badge without an
// N+1 query per row.
export const getActiveShareMediaIds = async (mediaIds) => {
  if (!mediaIds.length) return new Set();
  const rows = await prisma.mediaShare.findMany({
    where: {
      media_id: { in: mediaIds },
      revoked: false,
      OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
    },
    select: { media_id: true, max_downloads: true, download_count: true },
  });
  return new Set(
    rows
      .filter((s) => s.max_downloads === null || s.download_count < s.max_downloads)
      .map((s) => s.media_id)
  );
};
