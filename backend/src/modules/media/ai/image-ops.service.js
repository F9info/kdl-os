import { randomUUID } from 'crypto';
import { prisma } from '../../../config/database.js';
import { getFileUrl, uploadFile } from '../../../shared/services/storage.service.js';
import { createMediaVersion } from '../processing.service.js';
import { logger } from '../../../shared/utils/logger.js';
import { getActiveProvider } from './ai-provider.service.js';

const CONTENT_TYPE_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

// Per-op input shape for the replicate models wired in drivers/replicate.js —
// each model has its own input keys, so the mapping lives here rather than in the driver.
const buildInput = (op, imageUrl, { scale, maskUrl }) => {
  switch (op) {
    case 'bg-removal':
      return { image: imageUrl };
    case 'upscale':
      return { image: imageUrl, scale };
    case 'enhance':
      return { img: imageUrl };
    case 'object-removal':
      return { image: imageUrl, mask: maskUrl };
    default:
      throw Object.assign(new Error(`Unsupported AI image op: ${op}`), { status: 422 });
  }
};

const uploadMask = async (mediaId, maskBase64) => {
  const buffer = Buffer.from(maskBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  const maskPath = `ai-masks/${mediaId}/${randomUUID()}.png`;
  return uploadFile({ buffer, size: buffer.length, mimetype: 'image/png', originalname: 'mask.png' }, maskPath);
};

const downloadOutput = async (outputUrl) => {
  const res = await fetch(outputUrl);
  if (!res.ok) throw new Error(`Failed to download AI image op output (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = CONTENT_TYPE_EXT[res.headers.get('content-type')] ?? 'png';
  return { buffer, ext };
};

// Processing-job entry point ('ai-image-op' case in processing.service.js).
export async function runAiImageOpJob({ mediaId, op, scale, mask, createdBy }) {
  const provider = await getActiveProvider('image_ops');
  if (!provider) {
    throw Object.assign(new Error('AI feature "image_ops" is not configured'), { status: 501 });
  }

  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw Object.assign(new Error('Media not found'), { status: 404 });
  if (media.type !== 'IMAGE') {
    throw Object.assign(new Error('AI image ops are only supported for images'), { status: 422 });
  }

  const imageUrl = await getFileUrl(media.path);
  const maskUrl = op === 'object-removal' ? await uploadMask(mediaId, mask) : undefined;
  const input = buildInput(op, imageUrl, { scale, maskUrl });

  const { outputUrl } = await provider.driver.runImageOp({
    credentials: provider.credentials,
    config: provider.config,
    op,
    input,
  });

  const { buffer, ext } = await downloadOutput(outputUrl);
  const { version } = await createMediaVersion(mediaId, {
    buffer,
    ext,
    note: `AI image op: ${op}`,
    createdBy,
  });

  const { enqueueReindex } = await import('../media-search.service.js');
  enqueueReindex(mediaId);
  const { enqueueEmbed } = await import('./media-semantic.service.js');
  enqueueEmbed(mediaId);

  logger.info(`AI image op "${op}" complete for media ${mediaId} → version ${version.version}`);
  return { version_id: version.id, version: version.version, op };
}
