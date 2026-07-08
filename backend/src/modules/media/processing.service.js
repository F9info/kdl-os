import { createHash } from 'crypto';
import { prisma } from '../../config/database.js';
import { uploadFile, getFileUrl } from '../../shared/services/storage.service.js';
import { logger } from '../../shared/utils/logger.js';

// ─── Version helper ──────────────────────────────────────────────────────────

export const createMediaVersion = async (mediaId, { buffer, ext, note, createdBy }) => {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new Error(`Media ${mediaId} not found`);

  const lastVersion = await prisma.mediaVersion.findFirst({
    where: { media_id: mediaId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (lastVersion?.version ?? 0) + 1;
  const checksum = createHash('sha256').update(buffer).digest('hex');

  const dir = media.path.substring(0, media.path.lastIndexOf('/'));
  const base = media.path.substring(media.path.lastIndexOf('/') + 1, media.path.lastIndexOf('.'));
  const versionPath = `${dir}/versions/${base}_v${nextVersion}.${ext}`;

  await uploadFile(
    { buffer, size: buffer.length, mimetype: media.mime_type, originalname: `${base}_v${nextVersion}.${ext}` },
    versionPath
  );

  const version = await prisma.mediaVersion.create({
    data: {
      media_id: mediaId,
      version: nextVersion,
      path: versionPath,
      size: buffer.length,
      checksum,
      created_by: createdBy ?? null,
      note: note ?? null,
    },
  });

  return { version, path: versionPath, url: await getFileUrl(versionPath) };
};

// ─── Job dispatcher ──────────────────────────────────────────────────────────

export const executeProcessingJob = async (job) => {
  const { type } = job.data;

  switch (job.name) {
    case 'image-edit': {
      const { runImageEdit } = await import('./image-ops.service.js');
      return runImageEdit(job.data);
    }
    case 'pdf-op': {
      const { runPdfOp } = await import('./pdf-ops.service.js');
      return runPdfOp(job.data);
    }
    case 'video-op': {
      const { runVideoOp } = await import('./video-ops.service.js');
      return runVideoOp(job.data);
    }
    case 'audio-op': {
      const { runAudioOp } = await import('./audio-ops.service.js');
      return runAudioOp(job.data);
    }
    case 'convert': {
      const { runConversion } = await import('./conversions.service.js');
      return runConversion(job.data);
    }
    case 'ai-analyze': {
      const { runAnalyzeJob } = await import('./ai/analyze.service.js');
      return runAnalyzeJob(job.data);
    }
    default:
      throw new Error(`Unknown processing job type: ${job.name}`);
  }
};
