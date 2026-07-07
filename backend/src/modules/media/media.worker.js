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

export const mediaWorker = new Worker(
  'media',
  async (job) => {
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

    // Get final dimensions from large variant or original
    const meta = await sharp(buffer).metadata();

    await prisma.media.update({
      where: { id: mediaId },
      data: { variants, width: meta.width ?? null, height: meta.height ?? null },
    });

    logger.info(`Variants generated for media ${mediaId}`);
  },
  { connection: redis }
);

mediaWorker.on('failed', async (job, err) => {
  logger.error(`Media variant job ${job?.id} failed: ${err.message}`);
  if (job?.data?.mediaId) {
    await prisma.media.update({ where: { id: job.data.mediaId }, data: { variants: null } }).catch(() => {});
  }
});
