import { prisma } from '../../config/database.js';
import { logger } from '../../shared/utils/logger.js';
import { isClamdConfigured, scanBuffer } from './clamd-client.js';
import { enqueueReindex } from './media-search.service.js';

// Virus scanning for uploaded media (KDL-119 A6).
// Every upload enqueues a 'media-scan' job; INFECTED files are quarantined
// (soft-delete + flag) and admins are notified. Without CLAMAV_HOST the scan
// is recorded as SKIPPED so dev environments work with no clamd running.

const fetchObjectBuffer = async (path) => {
  const { minio } = await import('../../config/minio.js');
  const stream = await minio.getObject(process.env.MINIO_BUCKET, path);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
};

export const markScanSkipped = async (mediaId, reason) => {
  logger.warn(`media scan skipped for ${mediaId}: ${reason}`);
  await prisma.media
    .update({ where: { id: mediaId }, data: { scanned_at: new Date(), scan_result: 'SKIPPED' } })
    .catch(() => {}); // media may have been deleted while the job was queued
};

export const quarantineMedia = async (media, signature) => {
  await prisma.media.update({
    where: { id: media.id },
    data: { deleted_at: new Date(), scanned_at: new Date(), scan_result: 'INFECTED' },
  });
  enqueueReindex(media.id, 'remove');
  logger.error(`media ${media.id} ("${media.original_name}") INFECTED (${signature}) — quarantined`);

  // Notifications module is optional — degrade to logging if absent/broken
  try {
    const { notify } = await import('../notifications/service.js');
    await notify({
      to: { role_slug: 'admin' },
      inline: {
        title: 'Infected file quarantined',
        body: `Upload "${media.original_name}" was flagged by virus scan (${signature}) and quarantined.`,
      },
      channels: ['IN_APP'],
    });
  } catch (err) {
    logger.warn(`quarantine notify failed: ${err.message}`);
  }
};

// Returns the scan result string, or null when the media row no longer exists.
export const scanMediaById = async (mediaId) => {
  const media = await prisma.media.findFirst({ where: { id: mediaId, deleted_at: null } });
  if (!media) return null;

  if (!isClamdConfigured()) {
    await markScanSkipped(mediaId, 'CLAMAV_HOST unset');
    return 'SKIPPED';
  }

  const buffer = await fetchObjectBuffer(media.path);
  // Connection/timeout errors propagate → BullMQ retries; final failure is
  // marked SKIPPED by the worker's failed handler.
  const { status, signature } = await scanBuffer(buffer);

  if (status === 'INFECTED') {
    await quarantineMedia(media, signature);
    return 'INFECTED';
  }

  await prisma.media.update({
    where: { id: mediaId },
    data: { scanned_at: new Date(), scan_result: 'CLEAN' },
  });
  return 'CLEAN';
};
