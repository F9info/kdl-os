import { mkdtemp, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { prisma } from '../../config/database.js';
import { uploadFile, getFileUrl } from '../../shared/services/storage.service.js';
import { logger } from '../../shared/utils/logger.js';
import { createMediaVersion } from './processing.service.js';

const PRESET_MAP = {
  '1080p': { width: 1920, height: 1080, vbr: '4000k', abr: '192k' },
  '720p':  { width: 1280, height: 720,  vbr: '2500k', abr: '128k' },
  '480p':  { width: 854,  height: 480,  vbr: '1000k', abr: '96k'  },
  '360p':  { width: 640,  height: 360,  vbr: '500k',  abr: '64k'  },
};

const downloadToFile = async (mediaId, tmpDir, ext) => {
  const { minio } = await import('../../config/minio.js');
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new Error(`Media ${mediaId} not found`);
  const stream = await minio.getObject(process.env.MINIO_BUCKET, media.path);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const buf = Buffer.concat(chunks);
  const { writeFile } = await import('fs/promises');
  const filePath = join(tmpDir, `input.${ext}`);
  await writeFile(filePath, buf);
  return { media, filePath, buf };
};

const ffmpegPromise = (ffmpeg) =>
  new Promise((resolve, reject) => {
    ffmpeg.on('end', resolve).on('error', (err) => reject(err));
    ffmpeg.run();
  });

export const runVideoOp = async ({ mediaId, op, time, duration, start, end, preset, presets, format, text, position, opacity, createdBy }) => {
  const { default: Ffmpeg } = await import('fluent-ffmpeg');
  const tmpDir = await mkdtemp(join(tmpdir(), 'kdl-video-'));
  try {
    const extMatch = (await prisma.media.findUnique({ where: { id: mediaId }, select: { path: true } }))?.path?.match(/\.(\w+)$/);
    const inputExt = extMatch?.[1] ?? 'mp4';
    const { media, filePath } = await downloadToFile(mediaId, tmpDir, inputExt);

    switch (op) {
      case 'thumbnail':
      case 'poster': {
        const outPath = join(tmpDir, 'thumb.png');
        await new Promise((resolve, reject) => {
          Ffmpeg(filePath)
            .seekInput(time ?? 1)
            .outputOptions(['-vframes 1', '-q:v 2'])
            .output(outPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
        const buf = await readFile(outPath);
        const dir = media.path.substring(0, media.path.lastIndexOf('/'));
        const name = `${op}_${mediaId}.png`;
        const outMediaPath = `${dir}/${name}`;
        await uploadFile({ buffer: buf, size: buf.length, mimetype: 'image/png', originalname: name }, outMediaPath);
        return { path: outMediaPath, url: await getFileUrl(outMediaPath) };
      }

      case 'preview_clip': {
        const outPath = join(tmpDir, 'preview.webm');
        await new Promise((resolve, reject) => {
          Ffmpeg(filePath)
            .duration(duration ?? 5)
            .videoCodec('libvpx-vp9')
            .audioCodec('libopus')
            .outputOptions(['-crf 35', '-b:v 0'])
            .output(outPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
        const buf = await readFile(outPath);
        const { version } = await createMediaVersion(mediaId, { buffer: buf, ext: 'webm', note: `Preview clip ${duration ?? 5}s`, createdBy });
        return { version_id: version.id, version: version.version };
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

      case 'transcode': {
        const p = PRESET_MAP[preset ?? '720p'];
        const outFmt = format ?? 'mp4';
        const outPath = join(tmpDir, `transcode.${outFmt}`);
        await new Promise((resolve, reject) => {
          Ffmpeg(filePath)
            .size(`${p.width}x${p.height}`)
            .videoBitrate(p.vbr)
            .audioBitrate(p.abr)
            .videoCodec(outFmt === 'webm' ? 'libvpx-vp9' : 'libx264')
            .audioCodec(outFmt === 'webm' ? 'libopus' : 'aac')
            .outputOptions(outFmt === 'mp4' ? ['-movflags faststart'] : [])
            .output(outPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
        const buf = await readFile(outPath);
        const { version } = await createMediaVersion(mediaId, { buffer: buf, ext: outFmt, note: `Transcoded ${preset}`, createdBy });
        return { version_id: version.id, version: version.version };
      }

      case 'watermark': {
        const pos = position ?? 'bottom-right';
        const posMap = {
          'top-left': 'overlay=10:10',
          'top-right': 'overlay=W-w-10:10',
          'bottom-left': 'overlay=10:H-h-10',
          'bottom-right': 'overlay=W-w-10:H-h-10',
        };
        const overlayFilter = `drawtext=text='${(text ?? 'Watermark').replace(/'/g, "\\'")}':fontcolor=white@${opacity ?? 0.7}:fontsize=24:${pos === 'bottom-right' ? 'x=w-tw-10:y=h-th-10' : pos === 'bottom-left' ? 'x=10:y=h-th-10' : pos === 'top-right' ? 'x=w-tw-10:y=10' : 'x=10:y=10'}`;
        const outPath = join(tmpDir, 'watermarked.mp4');
        await new Promise((resolve, reject) => {
          Ffmpeg(filePath)
            .videoFilters(overlayFilter)
            .videoCodec('libx264')
            .audioCodec('copy')
            .outputOptions(['-movflags faststart'])
            .output(outPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
        const buf = await readFile(outPath);
        const { version } = await createMediaVersion(mediaId, { buffer: buf, ext: 'mp4', note: 'Watermarked', createdBy });
        return { version_id: version.id, version: version.version };
      }

      case 'multi_resolution': {
        const selectedPresets = presets ?? ['720p', '480p'];
        const results = [];
        for (const pName of selectedPresets) {
          const p = PRESET_MAP[pName];
          const outPath = join(tmpDir, `${pName}.mp4`);
          await new Promise((resolve, reject) => {
            Ffmpeg(filePath)
              .size(`${p.width}x${p.height}`)
              .videoBitrate(p.vbr)
              .audioBitrate(p.abr)
              .videoCodec('libx264')
              .audioCodec('aac')
              .outputOptions(['-movflags faststart'])
              .output(outPath)
              .on('end', resolve)
              .on('error', reject)
              .run();
          });
          const buf = await readFile(outPath);
          const { version } = await createMediaVersion(mediaId, { buffer: buf, ext: 'mp4', note: `Multi-res ${pName}`, createdBy });
          results.push({ preset: pName, version_id: version.id, version: version.version });
        }
        return { renditions: results };
      }

      case 'hls': {
        // HLS behind media.hls_enabled setting
        const { prisma: db } = await import('../../config/database.js');
        const hlsSetting = await db.appSetting.findUnique({ where: { key: 'media.hls_enabled' } });
        if (!hlsSetting || hlsSetting.value !== 'true') {
          return { skipped: true, reason: 'HLS not enabled (media.hls_enabled=false)' };
        }
        const selectedPresets = presets ?? ['720p', '480p'];
        const dir = media.path.substring(0, media.path.lastIndexOf('/'));
        const hlsDir = join(tmpDir, 'hls');
        const { mkdir } = await import('fs/promises');
        await mkdir(hlsDir, { recursive: true });
        const manifest = ['#EXTM3U', '#EXT-X-VERSION:3'];
        for (const pName of selectedPresets) {
          const p = PRESET_MAP[pName];
          const segPrefix = join(hlsDir, pName);
          const segOut = `${segPrefix}_%03d.ts`;
          const m3u8Out = join(hlsDir, `${pName}.m3u8`);
          await new Promise((resolve, reject) => {
            Ffmpeg(filePath)
              .size(`${p.width}x${p.height}`)
              .videoBitrate(p.vbr)
              .audioBitrate(p.abr)
              .videoCodec('libx264')
              .audioCodec('aac')
              .outputOptions(['-hls_time 6', '-hls_list_size 0', `-hls_segment_filename ${segOut}`])
              .output(m3u8Out)
              .on('end', resolve)
              .on('error', reject)
              .run();
          });
          manifest.push(`#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(p.vbr) * 1000},RESOLUTION=${p.width}x${p.height}`, `${pName}.m3u8`);
        }
        // Upload HLS segments to storage
        const { readdirSync } = await import('fs');
        const files = readdirSync(hlsDir);
        for (const f of files) {
          const fBuf = await readFile(join(hlsDir, f));
          const mime = f.endsWith('.m3u8') ? 'application/x-mpegURL' : 'video/MP2T';
          await uploadFile({ buffer: fBuf, size: fBuf.length, mimetype: mime, originalname: f }, `${dir}/hls/${f}`);
        }
        const masterM3u8 = manifest.join('\n');
        const masterBuf = Buffer.from(masterM3u8);
        await uploadFile({ buffer: masterBuf, size: masterBuf.length, mimetype: 'application/x-mpegURL', originalname: 'master.m3u8' }, `${dir}/hls/master.m3u8`);
        return { hls_path: `${dir}/hls/master.m3u8`, url: await getFileUrl(`${dir}/hls/master.m3u8`) };
      }

      default:
        throw new Error(`Unknown video op: ${op}`);
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
};
