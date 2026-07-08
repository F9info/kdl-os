import { mkdtemp, readFile, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { prisma } from '../../config/database.js';
import { logger } from '../../shared/utils/logger.js';
import { createMediaVersion } from './processing.service.js';

// doc→pdf EXCLUDED v1 — LibreOffice too heavy. Logged in DECISIONS.md.

const downloadBuffer = async (mediaId) => {
  const { minio } = await import('../../config/minio.js');
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new Error(`Media ${mediaId} not found`);
  const stream = await minio.getObject(process.env.MINIO_BUCKET, media.path);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return { media, buf: Buffer.concat(chunks) };
};

export const runConversion = async ({ mediaId, to, quality, createdBy }) => {
  const { media, buf } = await downloadBuffer(mediaId);
  const mimeType = media.mime_type;

  // Image → image
  if (mimeType.startsWith('image/') && ['webp','avif','png','jpeg','jpg'].includes(to)) {
    const { default: sharp } = await import('sharp');
    let pipe = sharp(buf);
    const q = quality ?? 85;
    if (to === 'webp') pipe = pipe.webp({ quality: q });
    else if (to === 'avif') pipe = pipe.avif({ quality: q });
    else if (to === 'png') pipe = pipe.png({ compressionLevel: Math.round((100 - q) / 11) });
    else if (to === 'jpeg' || to === 'jpg') pipe = pipe.jpeg({ quality: q });
    const outBuf = await pipe.toBuffer();
    const ext = to === 'jpg' ? 'jpg' : to;
    const { version } = await createMediaVersion(mediaId, { buffer: outBuf, ext, note: `Converted to ${ext}`, createdBy });
    return { version_id: version.id, version: version.version };
  }

  // Video → mp4/webm
  if (mimeType.startsWith('video/') && ['mp4','webm'].includes(to)) {
    const { default: Ffmpeg } = await import('fluent-ffmpeg');
    const tmpDir = await mkdtemp(join(tmpdir(), 'kdl-conv-'));
    try {
      const extMatch = media.path.match(/\.(\w+)$/);
      const inputExt = extMatch?.[1] ?? 'mp4';
      const inPath = join(tmpDir, `input.${inputExt}`);
      await writeFile(inPath, buf);
      const outPath = join(tmpDir, `output.${to}`);
      await new Promise((resolve, reject) => {
        let cmd = Ffmpeg(inPath)
          .videoCodec(to === 'webm' ? 'libvpx-vp9' : 'libx264')
          .audioCodec(to === 'webm' ? 'libopus' : 'aac');
        if (to === 'mp4') cmd = cmd.outputOptions(['-movflags faststart']);
        cmd.output(outPath).on('end', resolve).on('error', reject).run();
      });
      const outBuf = await readFile(outPath);
      const { version } = await createMediaVersion(mediaId, { buffer: outBuf, ext: to, note: `Converted to ${to}`, createdBy });
      return { version_id: version.id, version: version.version };
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }

  // Audio → mp3/wav
  if (mimeType.startsWith('audio/') && ['mp3','wav'].includes(to)) {
    const { default: Ffmpeg } = await import('fluent-ffmpeg');
    const tmpDir = await mkdtemp(join(tmpdir(), 'kdl-conv-'));
    try {
      const extMatch = media.path.match(/\.(\w+)$/);
      const inputExt = extMatch?.[1] ?? 'mp3';
      const inPath = join(tmpDir, `input.${inputExt}`);
      await writeFile(inPath, buf);
      const outPath = join(tmpDir, `output.${to}`);
      const codecMap = { mp3: 'libmp3lame', wav: 'pcm_s16le' };
      await new Promise((resolve, reject) => {
        Ffmpeg(inPath)
          .audioCodec(codecMap[to])
          .output(outPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      const outBuf = await readFile(outPath);
      const { version } = await createMediaVersion(mediaId, { buffer: outBuf, ext: to, note: `Converted to ${to}`, createdBy });
      return { version_id: version.id, version: version.version };
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }

  throw new Error(`Unsupported conversion: ${mimeType} → ${to}`);
};
