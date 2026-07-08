import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { prisma } from '../../config/database.js';
import { logger } from '../../shared/utils/logger.js';

const execFileAsync = promisify(execFile);

// Cap rasterized-OCR to the first N pages of a scanned PDF — keeps worst-case
// job time bounded (tesseract is ~1-3s/page).
const MAX_OCR_PAGES = 20;
// Below this many characters, a pdftotext result is treated as "no real text
// layer" (scanned PDF) and we fall back to rasterize + tesseract.
const MIN_TEXT_LAYER_CHARS = 32;

const OCR_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
  'application/pdf',
]);

export const isOcrSupported = (mimeType) => OCR_MIMES.has(mimeType);

const downloadToTemp = async (media, tmpDir, ext) => {
  const { minio } = await import('../../config/minio.js');
  const stream = await minio.getObject(process.env.MINIO_BUCKET, media.path);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const filePath = join(tmpDir, `input.${ext}`);
  await writeFile(filePath, Buffer.concat(chunks));
  return filePath;
};

const tesseractFile = async (filePath, tmpDir, base) => {
  const outPrefix = join(tmpDir, base);
  // tesseract writes <outPrefix>.txt
  await execFileAsync('tesseract', [filePath, outPrefix, '-l', 'eng', '--psm', '3']);
  return (await readFile(`${outPrefix}.txt`, 'utf8')).trim();
};

const ocrImage = async (media, tmpDir) => {
  const filePath = await downloadToTemp(media, tmpDir, 'img');
  return tesseractFile(filePath, tmpDir, 'out');
};

const ocrPdf = async (media, tmpDir) => {
  const filePath = await downloadToTemp(media, tmpDir, 'pdf');

  // Born-digital PDFs: extract the text layer directly (fast, exact).
  try {
    const txtPath = join(tmpDir, 'layer.txt');
    await execFileAsync('pdftotext', ['-layout', filePath, txtPath]);
    const text = (await readFile(txtPath, 'utf8')).trim();
    if (text.length >= MIN_TEXT_LAYER_CHARS) return text;
  } catch (err) {
    logger.warn(`pdftotext failed for media ${media.id}: ${err.message} — falling back to rasterized OCR`);
  }

  // Scanned PDFs: rasterize pages then tesseract each one.
  const pagePrefix = join(tmpDir, 'page');
  await execFileAsync('pdftoppm', ['-r', '150', '-png', '-f', '1', '-l', String(MAX_OCR_PAGES), filePath, pagePrefix]);
  const pages = (await readdir(tmpDir)).filter((f) => f.startsWith('page') && f.endsWith('.png')).sort();
  const parts = [];
  for (const page of pages) {
    parts.push(await tesseractFile(join(tmpDir, page), tmpDir, `${page}.ocr`));
  }
  return parts.join('\n\n').trim();
};

// Processing-job entry point ('ocr' case in processing.service.js). Local-only
// (tesseract/poppler) — NOT an ai-provider feature, so no 501 gating applies.
export const runOcrJob = async ({ mediaId }) => {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new Error(`Media ${mediaId} not found`);
  if (!isOcrSupported(media.mime_type)) {
    throw Object.assign(new Error(`OCR not supported for ${media.mime_type}`), { status: 422 });
  }

  const tmpDir = await mkdtemp(join(tmpdir(), 'kdl-ocr-'));
  try {
    const text = media.mime_type === 'application/pdf'
      ? await ocrPdf(media, tmpDir)
      : await ocrImage(media, tmpDir);

    await prisma.media.update({ where: { id: mediaId }, data: { ocr_text: text || null } });

    const { enqueueReindex } = await import('./media-search.service.js');
    enqueueReindex(mediaId);

    logger.info(`OCR complete for media ${mediaId} (${text.length} chars)`);
    return { chars: text.length };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
};
