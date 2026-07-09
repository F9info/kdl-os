import { prisma } from '../../../config/database.js';
import { logger } from '../../../shared/utils/logger.js';
import { getActiveProvider } from './ai-provider.service.js';
import { getFileUrl } from '../../../shared/services/storage.service.js';

// Mirrors replicate.js driver's `ops` — kept here too so we can 422 before
// ever resolving the provider/hitting the network.
export const IMAGE_OPS = ['bg-removal', 'upscale', 'enhance', 'object-removal'];

const getMimeExt = (mime) => {
  const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' };
  return map[mime] ?? 'jpg';
};

// Processing-job entry point ('ai-image-op' case in processing.service.js).
// Structurally identical to the C2 image-edit job: fetch source → run transform
// → upload result → write new MediaVersion. The "transform" here is a remote
// Replicate prediction instead of a local sharp pipeline.
export async function runImageOpJob({ mediaId, op, scale, mask, note, createdBy }) {
  if (!IMAGE_OPS.includes(op)) {
    throw Object.assign(new Error(`Unsupported AI image op "${op}"`), { status: 422 });
  }

  const provider = await getActiveProvider('image_ops');
  if (!provider) {
    throw Object.assign(new Error('AI feature "image_ops" is not configured'), { status: 501 });
  }

  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new Error(`Media ${mediaId} not found`);
  if (media.type !== 'IMAGE') {
    throw Object.assign(new Error('AI image ops are only supported for images in v1'), { status: 422 });
  }

  if (op === 'object-removal' && !mask) {
    throw Object.assign(new Error('object-removal requires a mask'), { status: 422 });
  }

  // Replicate reads the source image via URL — hand it a presigned URL from our
  // own storage rather than raw bytes (mirrors how the driver is contract-tested).
  const imageUrl = await getFileUrl(media.path);
  const input = { image: imageUrl };
  if (op === 'upscale') input.scale = scale ?? 2;
  if (op === 'object-removal') input.mask = mask;

  const { outputUrl, predictionId } = await provider.driver.runImageOp({
    credentials: provider.credentials,
    config: provider.config,
    op,
    input,
  });

  // Never store an external URL as the asset of record — download the
  // Replicate output and land it in our own storage via the version helper
  // (which itself uploads through storage.service.js).
  const outputRes = await fetch(outputUrl);
  if (!outputRes.ok) {
    throw new Error(`Failed to download AI image-op output (${outputRes.status})`);
  }
  const outputBuffer = Buffer.from(await outputRes.arrayBuffer());

  const { createMediaVersion } = await import('../processing.service.js');
  const { version } = await createMediaVersion(mediaId, {
    buffer: outputBuffer,
    ext: getMimeExt(media.mime_type),
    note: note ?? `AI ${op}`,
    createdBy,
  });

  logger.info(`AI image op "${op}" complete for media ${mediaId} → version ${version.version} (prediction ${predictionId ?? 'n/a'})`);
  return { version_id: version.id, version: version.version, prediction_id: predictionId ?? null };
}
