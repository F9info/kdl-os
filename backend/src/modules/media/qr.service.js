import sharp from 'sharp';
import { RGBLuminanceSource, HybridBinarizer, BinaryBitmap, MultiFormatReader, NotFoundException } from '@zxing/library';
import { prisma } from '../../config/database.js';
import { logger } from '../../shared/utils/logger.js';

const QR_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

export const isQrDecodeSupported = (mimeType) => QR_MIMES.has(mimeType);

const downloadToBuffer = async (media) => {
  const { minio } = await import('../../config/minio.js');
  const stream = await minio.getObject(process.env.MINIO_BUCKET, media.path);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
};

// Pure-JS local decode (@zxing/library) — no AI call, no canvas: sharp gives
// us a raw greyscale buffer, which is already exactly what RGBLuminanceSource
// wants when handed a single-byte-per-pixel (non-Int32Array) input.
const decodeBarcodes = async (imageBuffer) => {
  const { data, info } = await sharp(imageBuffer).greyscale().raw().toBuffer({ resolveWithObject: true });
  const luminances = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
  const source = new RGBLuminanceSource(luminances, info.width, info.height);
  const bitmap = new BinaryBitmap(new HybridBinarizer(source));
  const reader = new MultiFormatReader();
  try {
    const result = reader.decodeWithState(bitmap);
    return [{ value: result.getText(), format: String(result.getBarcodeFormat()) }];
  } catch (err) {
    if (err instanceof NotFoundException) return [];
    throw err;
  }
};

// Processing-job entry point ('qr-decode' case in processing.service.js). Local-only
// (zxing, pure JS) — NOT an ai-provider feature, so no 501 gating applies.
export const runQrDecodeJob = async ({ mediaId }) => {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new Error(`Media ${mediaId} not found`);
  if (!isQrDecodeSupported(media.mime_type)) {
    throw Object.assign(new Error(`QR/barcode decode not supported for ${media.mime_type}`), { status: 422 });
  }

  const buffer = await downloadToBuffer(media);
  const barcodes = await decodeBarcodes(buffer);

  await prisma.media.update({ where: { id: mediaId }, data: { barcodes: barcodes.length ? barcodes : null } });

  const { enqueueReindex } = await import('./media-search.service.js');
  enqueueReindex(mediaId);
  const { enqueueEmbed } = await import('./ai/media-semantic.service.js');
  enqueueEmbed(mediaId);

  logger.info(`QR/barcode decode complete for media ${mediaId} (${barcodes.length} hit(s))`);
  return { barcodes };
};
