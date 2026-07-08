import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, readFile, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { prisma } from '../../config/database.js';
import { uploadFile, getFileUrl } from '../../shared/services/storage.service.js';
import { logger } from '../../shared/utils/logger.js';
import { createMediaVersion } from './processing.service.js';

const execFileAsync = promisify(execFile);

const downloadToTemp = async (mediaId, tmpDir) => {
  const { minio } = await import('../../config/minio.js');
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new Error(`Media ${mediaId} not found`);
  const stream = await minio.getObject(process.env.MINIO_BUCKET, media.path);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const buf = Buffer.concat(chunks);
  const filePath = join(tmpDir, `${mediaId}.pdf`);
  await writeFile(filePath, buf);
  return { media, filePath, buf };
};

export const runPdfOp = async ({ op, mediaId, ids, ranges, password, text, opacity, name, folder_id, createdBy }) => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'kdl-pdf-'));
  try {
    switch (op) {
      case 'merge': {
        const merged = await PDFDocument.create();
        for (const id of ids) {
          const { buf } = await downloadToTemp(id, tmpDir);
          const doc = await PDFDocument.load(buf);
          const pages = await merged.copyPages(doc, doc.getPageIndices());
          pages.forEach((p) => merged.addPage(p));
        }
        const outBuf = Buffer.from(await merged.save());
        const { minio } = await import('../../config/minio.js');
        const firstMedia = await prisma.media.findUnique({ where: { id: ids[0] } });
        const dir = firstMedia.path.substring(0, firstMedia.path.lastIndexOf('/'));
        const outName = name ?? `merged_${ids.join('_').substring(0, 20)}.pdf`;
        const outPath = `${dir}/${outName}`;
        await uploadFile({ buffer: outBuf, size: outBuf.length, mimetype: 'application/pdf', originalname: outName }, outPath);
        const newMedia = await prisma.media.create({
          data: {
            user_id: firstMedia.user_id,
            folder_id: folder_id ?? firstMedia.folder_id,
            filename: outName,
            original_name: outName,
            mime_type: 'application/pdf',
            size: outBuf.length,
            bucket: firstMedia.bucket,
            path: outPath,
            type: 'DOCUMENT',
            checksum: createHash('sha256').update(outBuf).digest('hex'),
          },
        });
        return { media_id: newMedia.id };
      }

      case 'split': {
        const { media, buf } = await downloadToTemp(mediaId, tmpDir);
        const doc = await PDFDocument.load(buf);
        const results = [];
        for (let i = 0; i < ranges.length; i++) {
          const { start, end } = ranges[i];
          const part = await PDFDocument.create();
          const pageCount = doc.getPageCount();
          const startIdx = Math.max(0, start - 1);
          const endIdx = Math.min(pageCount - 1, end - 1);
          if (startIdx > endIdx) continue;
          const indices = Array.from({ length: endIdx - startIdx + 1 }, (_, k) => startIdx + k);
          const pages = await part.copyPages(doc, indices);
          pages.forEach((p) => part.addPage(p));
          const partBuf = Buffer.from(await part.save());
          const { version } = await createMediaVersion(mediaId, { buffer: partBuf, ext: 'pdf', note: `Split part ${i + 1} pages ${start}-${end}`, createdBy });
          results.push({ part: i + 1, version_id: version.id, version: version.version });
        }
        return { parts: results };
      }

      case 'compress': {
        const { media, filePath } = await downloadToTemp(mediaId, tmpDir);
        const outPath = join(tmpDir, `${mediaId}_compressed.pdf`);
        await execFileAsync('qpdf', ['--linearize', '--compress-streams=y', '--object-streams=generate', filePath, outPath]);
        const outBuf = await readFile(outPath);
        const { version } = await createMediaVersion(mediaId, { buffer: outBuf, ext: 'pdf', note: 'Compressed', createdBy });
        return { version_id: version.id, version: version.version, size_before: media.size, size_after: outBuf.length };
      }

      case 'password_protect': {
        const { filePath } = await downloadToTemp(mediaId, tmpDir);
        const outPath = join(tmpDir, `${mediaId}_protected.pdf`);
        await execFileAsync('qpdf', ['--encrypt', password, password, '256', '--', filePath, outPath]);
        const outBuf = await readFile(outPath);
        const { version } = await createMediaVersion(mediaId, { buffer: outBuf, ext: 'pdf', note: 'Password protected', createdBy });
        return { version_id: version.id, version: version.version };
      }

      case 'password_remove': {
        const { filePath } = await downloadToTemp(mediaId, tmpDir);
        const outPath = join(tmpDir, `${mediaId}_unlocked.pdf`);
        await execFileAsync('qpdf', [`--password=${password}`, '--decrypt', filePath, outPath]);
        const outBuf = await readFile(outPath);
        const { version } = await createMediaVersion(mediaId, { buffer: outBuf, ext: 'pdf', note: 'Password removed', createdBy });
        return { version_id: version.id, version: version.version };
      }

      case 'watermark': {
        const { buf } = await downloadToTemp(mediaId, tmpDir);
        const doc = await PDFDocument.load(buf);
        const pages = doc.getPages();
        const watermarkText = text ?? 'CONFIDENTIAL';
        const alpha = opacity ?? 0.3;
        const helvetica = await doc.embedFont('Helvetica');
        for (const page of pages) {
          const { width, height } = page.getSize();
          page.drawText(watermarkText, {
            x: width / 4,
            y: height / 2,
            size: Math.min(width, height) * 0.08,
            font: helvetica,
            opacity: alpha,
            rotate: { type: 'degrees', angle: 45 },
          });
        }
        const outBuf = Buffer.from(await doc.save());
        const { version } = await createMediaVersion(mediaId, { buffer: outBuf, ext: 'pdf', note: `Watermarked: ${watermarkText}`, createdBy });
        return { version_id: version.id, version: version.version };
      }

      case 'thumbnail': {
        // Use pdftoppm to render first page as PNG
        const { media, filePath } = await downloadToTemp(mediaId, tmpDir);
        const outPrefix = join(tmpDir, 'thumb');
        await execFileAsync('pdftoppm', ['-r', '72', '-singlefile', '-png', filePath, outPrefix]);
        const thumbBuf = await readFile(`${outPrefix}.png`);
        const { minio } = await import('../../config/minio.js');
        const dir = media.path.substring(0, media.path.lastIndexOf('/'));
        const thumbPath = `${dir}/thumb_${mediaId}.png`;
        await uploadFile({ buffer: thumbBuf, size: thumbBuf.length, mimetype: 'image/png', originalname: `thumb_${mediaId}.png` }, thumbPath);
        return { thumbnail_path: thumbPath, url: await getFileUrl(thumbPath) };
      }

      case 'info': {
        const { buf } = await downloadToTemp(mediaId, tmpDir);
        const doc = await PDFDocument.load(buf);
        return {
          page_count: doc.getPageCount(),
          title: doc.getTitle() ?? null,
          author: doc.getAuthor() ?? null,
          subject: doc.getSubject() ?? null,
        };
      }

      default:
        throw new Error(`Unknown PDF op: ${op}`);
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
};
