import { mkdtemp, readFile, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { prisma } from '../../config/database.js';
import { uploadFile, getFileUrl } from '../../shared/services/storage.service.js';
import { logger } from '../../shared/utils/logger.js';
import { createMediaVersion } from './processing.service.js';

const downloadToFile = async (mediaId, tmpDir, ext) => {
  const { minio } = await import('../../config/minio.js');
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new Error(`Media ${mediaId} not found`);
  const stream = await minio.getObject(process.env.MINIO_BUCKET, media.path);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const buf = Buffer.concat(chunks);
  const filePath = join(tmpDir, `input.${ext}`);
  await writeFile(filePath, buf);
  return { media, filePath };
};

export const runAudioOp = async ({ mediaId, op, start, end, format, createdBy }) => {
  const { default: Ffmpeg } = await import('fluent-ffmpeg');
  const tmpDir = await mkdtemp(join(tmpdir(), 'kdl-audio-'));
  try {
    const mediaRecord = await prisma.media.findUnique({ where: { id: mediaId }, select: { path: true, mime_type: true } });
    const extMatch = mediaRecord?.path?.match(/\.(\w+)$/);
    const inputExt = extMatch?.[1] ?? 'mp3';
    const { media, filePath } = await downloadToFile(mediaId, tmpDir, inputExt);

    switch (op) {
      case 'waveform': {
        // Extract PCM samples → peaks array + PNG
        const rawPath = join(tmpDir, 'raw.pcm');
        const SAMPLE_RATE = 8000;
        await new Promise((resolve, reject) => {
          Ffmpeg(filePath)
            .audioChannels(1)
            .audioFrequency(SAMPLE_RATE)
            .audioCodec('pcm_s16le')
            .format('s16le')
            .output(rawPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
        const pcmBuf = await readFile(rawPath);
        const samples = new Int16Array(pcmBuf.buffer);
        const PEAKS = 200;
        const chunk = Math.floor(samples.length / PEAKS);
        const peaks = [];
        for (let i = 0; i < PEAKS; i++) {
          let max = 0;
          for (let j = 0; j < chunk; j++) {
            const val = Math.abs(samples[i * chunk + j] ?? 0);
            if (val > max) max = val;
          }
          peaks.push(Math.round((max / 32768) * 100) / 100);
        }

        // Generate PNG using ffmpeg waveform filter
        const pngPath = join(tmpDir, 'waveform.png');
        await new Promise((resolve, reject) => {
          Ffmpeg(filePath)
            .complexFilter('[0:a]aformat=channel_layouts=mono,compand,showwavespic=s=800x200:colors=#3b82f6[v]')
            .map('[v]')
            .frames(1)
            .output(pngPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
        const pngBuf = await readFile(pngPath);
        const dir = media.path.substring(0, media.path.lastIndexOf('/'));
        const pngStorePath = `${dir}/waveform_${mediaId}.png`;
        await uploadFile({ buffer: pngBuf, size: pngBuf.length, mimetype: 'image/png', originalname: `waveform_${mediaId}.png` }, pngStorePath);

        return {
          peaks,
          waveform_url: await getFileUrl(pngStorePath),
          duration_samples: samples.length,
          sample_rate: SAMPLE_RATE,
        };
      }

      case 'trim': {
        const outFmt = format ?? inputExt;
        const outPath = join(tmpDir, `trimmed.${outFmt}`);
        await new Promise((resolve, reject) => {
          Ffmpeg(filePath)
            .seekInput(start)
            .duration(end - start)
            .outputOptions(['-c copy'])
            .output(outPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
        const buf = await readFile(outPath);
        const { version } = await createMediaVersion(mediaId, { buffer: buf, ext: outFmt, note: `Trimmed ${start}s-${end}s`, createdBy });
        return { version_id: version.id, version: version.version };
      }

      case 'normalize': {
        // Two-pass loudnorm
        const outFmt = inputExt;
        const outPath = join(tmpDir, `normalized.${outFmt}`);
        await new Promise((resolve, reject) => {
          Ffmpeg(filePath)
            .audioFilters('loudnorm=I=-16:TP=-1.5:LRA=11')
            .output(outPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
        const buf = await readFile(outPath);
        const { version } = await createMediaVersion(mediaId, { buffer: buf, ext: outFmt, note: 'Normalized (loudnorm)', createdBy });
        return { version_id: version.id, version: version.version };
      }

      case 'convert': {
        const outFmt = format ?? 'mp3';
        const outPath = join(tmpDir, `converted.${outFmt}`);
        const codecMap = { mp3: 'libmp3lame', wav: 'pcm_s16le', aac: 'aac', ogg: 'libvorbis', flac: 'flac' };
        await new Promise((resolve, reject) => {
          Ffmpeg(filePath)
            .audioCodec(codecMap[outFmt] ?? 'libmp3lame')
            .output(outPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
        const buf = await readFile(outPath);
        const { version } = await createMediaVersion(mediaId, { buffer: buf, ext: outFmt, note: `Converted to ${outFmt}`, createdBy });
        return { version_id: version.id, version: version.version };
      }

      default:
        throw new Error(`Unknown audio op: ${op}`);
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
};
