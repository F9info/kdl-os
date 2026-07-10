import { Worker } from 'bullmq';
import { redis } from '../../config/redis.js';
import { prisma } from '../../config/database.js';
import { uploadFile, getFileUrl } from '../../shared/services/storage.service.js';
import { logger } from '../../shared/utils/logger.js';

const VARIANT_SIZES = {
  thumb: 150,
  small: 400,
  medium: 800,
  large: 1600,
};

// Shared by the upload worker and the image-edit worker (image-ops.service.js) so
// crop/resize/rotate edits regenerate the same thumb/small/medium/large set.
export const generateVariants = async (buffer, objectPath) => {
  const { default: sharp } = await import('sharp');
  const variants = {};
  const dir = objectPath.substring(0, objectPath.lastIndexOf('/'));
  const base = objectPath.substring(objectPath.lastIndexOf('/') + 1, objectPath.lastIndexOf('.'));

  for (const [name, size] of Object.entries(VARIANT_SIZES)) {
    const variantPath = `${dir}/variants/${base}_${name}.webp`;
    const variantBuffer = await sharp(buffer)
      .resize(size, size, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    await uploadFile(
      { buffer: variantBuffer, size: variantBuffer.length, mimetype: 'image/webp', originalname: `${base}_${name}.webp` },
      variantPath
    );
    variants[name] = variantPath;
  }

  const meta = await sharp(buffer).metadata();
  return { variants, width: meta.width ?? null, height: meta.height ?? null };
};

export const mediaWorker = new Worker(
  'media',
  async (job) => {
    if (job.name === 'search-index') {
      const { indexMediaById, removeMediaFromIndex } = await import('./media-search.service.js');
      if (job.data.action === 'remove') await removeMediaFromIndex(job.data.mediaId);
      else await indexMediaById(job.data.mediaId);
      return;
    }

    const { mediaId, path: objectPath } = job.data;

    // Fetch original from storage (we need the buffer for sharp)
    // MinIO SDK: getObject returns a stream
    const { default: sharp } = await import('sharp');
    const { minio } = await import('../../config/minio.js');
    const BUCKET = process.env.MINIO_BUCKET;

    const stream = await minio.getObject(BUCKET, objectPath);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    // Validate it's actually an image (sharp will throw on fake images → 422 handled upstream)
    await sharp(buffer).metadata();

    const { variants, width, height } = await generateVariants(buffer, objectPath);

    await prisma.media.update({
      where: { id: mediaId },
      data: { variants, width, height },
    });

    // Refresh search doc with final dimensions (best-effort)
    const { indexMediaById } = await import('./media-search.service.js');
    await indexMediaById(mediaId).catch((e) => logger.warn(`search reindex after variants failed: ${e.message}`));

    logger.info(`Variants generated for media ${mediaId}`);
  },
  { connection: redis }
);

mediaWorker.on('failed', async (job, err) => {
  logger.error(`Media job ${job?.name} ${job?.id} failed: ${err.message}`);
  if (job?.name === 'generate-variants' && job?.data?.mediaId) {
    await prisma.media.update({ where: { id: job.data.mediaId }, data: { variants: null } }).catch(() => {});
  }
});

export const mediaScanWorker = new Worker(
  'media-scan',
  async (job) => {
    const { scanMediaById } = await import('./scan.service.js');
    return scanMediaById(job.data.mediaId);
  },
  { connection: redis }
);

mediaScanWorker.on('failed', async (job, err) => {
  logger.error(`Media scan job ${job?.id} failed: ${err.message}`);
  // clamd unreachable through all retries → record SKIPPED so the file
  // doesn't sit in "pending scan" limbo forever (require_scan still blocks it)
  if (job?.data?.mediaId && job.attemptsMade >= (job.opts?.attempts ?? 1)) {
    const { markScanSkipped } = await import('./scan.service.js');
    await markScanSkipped(job.data.mediaId, `scan failed after ${job.attemptsMade} attempts: ${err.message}`).catch(() => {});
  }
});
