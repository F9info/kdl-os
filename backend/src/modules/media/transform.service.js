// Phase B2 — on-the-fly image transform with MinIO cache
import { createHash } from 'crypto';
import sharp from 'sharp';
import { prisma } from '../../config/database.js';

const BUCKET = process.env.MINIO_BUCKET;

const FORMAT_MAP = { webp: 'webp', avif: 'avif', jpg: 'jpeg', jpeg: 'jpeg', png: 'png' };

async function streamToBuffer(stream) {
  if (Buffer.isBuffer(stream)) return stream;
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export const transformMedia = async (id, params, actorId = null) => {
  const media = await prisma.media.findUnique({ where: { id, deleted_at: null } });
  if (!media) throw Object.assign(new Error('Not found'), { status: 404 });

  // Private file: require authenticated actor when workflow gating is meaningful
  if (!actorId && media.workflow_status && !['PUBLISHED', 'APPROVED', 'DRAFT'].includes(media.workflow_status)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }

  const { w, h, fit = 'cover', q = '80', format = 'webp', blur, gray } = params;
  const sharpFormat = FORMAT_MAP[format];
  if (!sharpFormat) throw Object.assign(new Error('Invalid format'), { status: 400 });

  const width = w ? Math.min(parseInt(w, 10), 4096) : undefined;
  const height = h ? Math.min(parseInt(h, 10), 4096) : undefined;
  const quality = Math.min(Math.max(parseInt(q, 10) || 80, 1), 100);

  // Build deterministic cache key (stored in same bucket under transforms/ prefix)
  const paramStr = JSON.stringify({ width, height, fit, quality, format, blur: blur ?? null, gray: gray ?? null });
  const hash = createHash('sha256').update(id + paramStr).digest('hex').slice(0, 16);
  const cacheKey = `transforms/${id}_${hash}.${format}`;

  const { minio } = await import('../../config/minio.js');

  // Cache hit
  try {
    const cachedStream = await minio.getObject(BUCKET, cacheKey);
    const buf = await streamToBuffer(cachedStream);
    if (buf.length > 0) return { buffer: buf, format: sharpFormat, fromCache: true };
  } catch {}

  // Fetch original from storage
  const originalStream = await minio.getObject(BUCKET, media.path);
  const original = await streamToBuffer(originalStream);

  // Apply sharp operations
  let pipeline = sharp(original);
  if (width || height) pipeline = pipeline.resize(width ?? null, height ?? null, { fit });
  if (gray) pipeline = pipeline.grayscale();
  if (blur) {
    const sigma = Math.min(Math.max(parseFloat(blur), 0.3), 1000);
    pipeline = pipeline.blur(sigma);
  }
  pipeline = pipeline[sharpFormat]({ quality });

  const buf = await pipeline.toBuffer();

  // Persist to cache (best-effort)
  try {
    await minio.putObject(BUCKET, cacheKey, buf, buf.length, { 'Content-Type': `image/${sharpFormat}` });
  } catch {}

  return { buffer: buf, format: sharpFormat, fromCache: false };
};

// Build a srcset attribute string at standard breakpoints for a given media id
export const buildSrcset = (id, baseUrl = '') => {
  const widths = [400, 800, 1200, 1600];
  return widths
    .map((w) => `${baseUrl}/api/media/${id}/t?w=${w}&format=webp ${w}w`)
    .join(', ');
};
