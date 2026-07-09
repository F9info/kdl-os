import { prisma } from '../../config/database.js';
import { logger } from '../../shared/utils/logger.js';

// Formats zxing-wasm can decode from encoded file bytes (stb_image: no webp/avif/svg).
const BARCODE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/bmp']);

export const isBarcodeSupported = (mimeType) => BARCODE_MIMES.has(mimeType);

const readMediaBuffer = async (media) => {
  const { minio } = await import('../../config/minio.js');
  const stream = await minio.getObject(process.env.MINIO_BUCKET, media.path);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
};

// Processing-job entry point ('barcode-decode' case in processing.service.js).
// Local-only (zxing-wasm) — NOT an ai-provider feature, so no 501 gating applies;
// same job pattern as OCR (ocr.service.js).
export const runBarcodeDecodeJob = async ({ mediaId }) => {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new Error(`Media ${mediaId} not found`);
  if (!isBarcodeSupported(media.mime_type)) {
    throw Object.assign(new Error(`Barcode decode not supported for ${media.mime_type}`), { status: 422 });
  }

  const buffer = await readMediaBuffer(media);
  const { readBarcodes } = await import('zxing-wasm/reader');
  const hits = await readBarcodes(new Uint8Array(buffer), { formats: [] });

  const barcodes = hits
    .filter((h) => h.isValid && h.text)
    .map((h) => ({ format: h.format, text: h.text }));

  await prisma.media.update({
    where: { id: mediaId },
    data: { barcodes: barcodes.length ? barcodes : null },
  });

  logger.info(`Barcode decode found ${barcodes.length} code(s) for media ${mediaId}`);
  return { barcodes };
};
