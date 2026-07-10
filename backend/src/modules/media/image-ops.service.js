import { createHash } from 'crypto';
import { prisma } from '../../config/database.js';
import { logger } from '../../shared/utils/logger.js';
import { createMediaVersion } from './processing.service.js';

const getMimeExt = (mime) => {
  const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' };
  return map[mime] ?? 'jpg';
};

const buildPipeline = async (sharpInstance, ops, media) => {
  const { default: sharp } = await import('sharp');
  let pipe = sharpInstance;

  for (const op of ops) {
    switch (op.op) {
      case 'crop':
        pipe = pipe.extract({ left: op.left, top: op.top, width: op.width, height: op.height });
        break;
      case 'resize':
        pipe = pipe.resize({ width: op.width, height: op.height, fit: op.fit ?? 'inside', withoutEnlargement: true });
        break;
      case 'rotate':
        pipe = pipe.rotate(op.angle, op.background ? { background: op.background } : {});
        break;
      case 'flip':
        pipe = pipe.flip();
        break;
      case 'flop':
        pipe = pipe.flop();
        break;
      case 'brightness':
        pipe = pipe.modulate({ brightness: op.factor });
        break;
      case 'contrast': {
        // sharp linear: y = a*x + b. contrast factor > 1 = more contrast
        const a = op.factor;
        const b = -(128 * (a - 1));
        pipe = pipe.linear(a, b);
        break;
      }
      case 'saturation':
        pipe = pipe.modulate({ saturation: op.factor });
        break;
      case 'grayscale':
        pipe = pipe.grayscale();
        break;
      case 'blur':
        pipe = pipe.blur(op.sigma ?? 2);
        break;
      case 'sharpen':
        pipe = pipe.sharpen();
        break;
      case 'negate':
        pipe = pipe.negate();
        break;
      case 'text_watermark': {
        // Render text onto a transparent SVG then composite
        const meta = await pipe.metadata();
        const w = meta.width ?? 800;
        const h = meta.height ?? 600;
        const fontSize = op.font_size ?? 24;
        const color = op.color ?? '#ffffff';
        const opacity = op.opacity ?? 0.7;
        const positions = {
          'top-left': { x: 10, y: fontSize + 10, anchor: 'start' },
          'top-center': { x: Math.floor(w / 2), y: fontSize + 10, anchor: 'middle' },
          'top-right': { x: w - 10, y: fontSize + 10, anchor: 'end' },
          'center': { x: Math.floor(w / 2), y: Math.floor(h / 2), anchor: 'middle' },
          'bottom-left': { x: 10, y: h - 10, anchor: 'start' },
          'bottom-center': { x: Math.floor(w / 2), y: h - 10, anchor: 'middle' },
          'bottom-right': { x: w - 10, y: h - 10, anchor: 'end' },
        };
        const pos = positions[op.position ?? 'bottom-right'];
        const svg = `<svg width="${w}" height="${h}"><text x="${pos.x}" y="${pos.y}" font-size="${fontSize}" fill="${color}" fill-opacity="${opacity}" text-anchor="${pos.anchor}" font-family="sans-serif">${op.text.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]))}</text></svg>`;
        pipe = pipe.composite([{ input: Buffer.from(svg), blend: 'over' }]);
        break;
      }
      case 'logo_watermark': {
        const { minio } = await import('../../config/minio.js');
        const logo = await prisma.media.findUnique({ where: { id: op.logo_media_id }, select: { path: true } });
        if (!logo) throw new Error('Logo media not found');
        const stream = await minio.getObject(process.env.MINIO_BUCKET, logo.path);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const logoBuffer = Buffer.concat(chunks);
        const meta = await pipe.metadata();
        const w = meta.width ?? 800;
        const h = meta.height ?? 600;
        const scale = op.scale ?? 0.2;
        const logoW = Math.round(w * scale);
        const resizedLogo = await sharp(logoBuffer).resize(logoW).png().toBuffer();
        const logoMeta = await sharp(resizedLogo).metadata();
        const padding = 10;
        const positions = {
          'top-left': { top: padding, left: padding },
          'top-center': { top: padding, left: Math.floor((w - (logoMeta.width ?? logoW)) / 2) },
          'top-right': { top: padding, left: w - (logoMeta.width ?? logoW) - padding },
          'center': { top: Math.floor((h - (logoMeta.height ?? logoW)) / 2), left: Math.floor((w - (logoMeta.width ?? logoW)) / 2) },
          'bottom-left': { top: h - (logoMeta.height ?? logoW) - padding, left: padding },
          'bottom-center': { top: h - (logoMeta.height ?? logoW) - padding, left: Math.floor((w - (logoMeta.width ?? logoW)) / 2) },
          'bottom-right': { top: h - (logoMeta.height ?? logoW) - padding, left: w - (logoMeta.width ?? logoW) - padding },
        };
        const pos = positions[op.position ?? 'bottom-right'];
        pipe = pipe.composite([{ input: resizedLogo, blend: 'over', ...pos }]);
        break;
      }
      case 'compress': {
        const fmt = op.format ?? getMimeExt(media.mime_type);
        const quality = op.quality ?? 80;
        if (fmt === 'jpeg' || fmt === 'jpg') pipe = pipe.jpeg({ quality });
        else if (fmt === 'webp') pipe = pipe.webp({ quality });
        else if (fmt === 'avif') pipe = pipe.avif({ quality });
        else if (fmt === 'png') pipe = pipe.png({ compressionLevel: Math.round((100 - quality) / 11) });
        break;
      }
    }
  }
  return pipe;
};

const EXT_TO_MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
};

export const runImageEdit = async ({ mediaId, ops, note, createdBy }) => {
  const { default: sharp } = await import('sharp');
  const { minio } = await import('../../config/minio.js');
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new Error(`Media ${mediaId} not found`);

  const stream = await minio.getObject(process.env.MINIO_BUCKET, media.path);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const inputBuffer = Buffer.concat(chunks);

  const pipeline = await buildPipeline(sharp(inputBuffer), ops, media);

  // Determine output format from last compress op or default to original
  const compressOp = [...ops].reverse().find((o) => o.op === 'compress');
  const ext = compressOp?.format ?? getMimeExt(media.mime_type);
  let finalPipe = pipeline;
  if (!compressOp) {
    if (ext === 'jpg') finalPipe = pipeline.jpeg({ quality: 90 });
    else if (ext === 'webp') finalPipe = pipeline.webp({ quality: 90 });
    else if (ext === 'png') finalPipe = pipeline.png();
  }

  const outputBuffer = await finalPipe.toBuffer();

  // Snapshot the pre-edit bytes as a version (separate versioned path, same
  // convention as createMediaVersion elsewhere) so edits are undoable.
  const { version } = await createMediaVersion(mediaId, {
    buffer: inputBuffer,
    ext: getMimeExt(media.mime_type),
    note: note ?? 'pre-edit snapshot',
    createdBy,
  });

  // Apply the edit to the actual served file, then regenerate variants +
  // dimensions from the new bytes — this is the part that was previously missing.
  await minio.putObject(process.env.MINIO_BUCKET, media.path, outputBuffer);

  const checksum = createHash('sha256').update(outputBuffer).digest('hex');
  const { generateVariants } = await import('./media.worker.js');
  const { variants, width, height } = await generateVariants(outputBuffer, media.path);

  await prisma.media.update({
    where: { id: mediaId },
    data: {
      size: outputBuffer.length,
      checksum,
      mime_type: EXT_TO_MIME[ext] ?? media.mime_type,
      width,
      height,
      variants,
    },
  });

  const { indexMediaById } = await import('./media-search.service.js');
  await indexMediaById(mediaId).catch((e) => logger.warn(`search reindex after image edit failed: ${e.message}`));

  logger.info(`Image edit applied for media ${mediaId} → version ${version.version}`);
  return { version_id: version.id, version: version.version };
};
