import { prisma } from '../../config/database.js';

const EXECUTABLES = new Set([
  'application/x-executable', 'application/x-msdownload', 'application/x-sh',
  'application/x-bat', 'application/x-msdos-program',
]);

const DEFAULT_MIME_TYPES = [
  // images
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
  'image/svg+xml', 'image/heic', 'image/heif',
  // video
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/x-msvideo',
  // audio
  'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/flac',
  // documents
  'application/pdf', 'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // design
  'image/vnd.adobe.photoshop', 'application/postscript',
  // archives
  'application/zip',
];

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 60_000;

export const getUploadSettings = async () => {
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;

  const [maxSizeSetting, mimesSetting, maxChunkedSetting, requireScanSetting] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: 'media.max_file_size_mb' } }),
    prisma.appSetting.findUnique({ where: { key: 'media.allowed_mime_types' } }),
    prisma.appSetting.findUnique({ where: { key: 'media.max_chunked_file_size_mb' } }),
    prisma.appSetting.findUnique({ where: { key: 'media.require_scan' } }),
  ]);

  const maxFileSizeMb = maxSizeSetting ? Number(maxSizeSetting.value) : 10;
  const allowedList = mimesSetting ? JSON.parse(mimesSetting.value) : DEFAULT_MIME_TYPES;
  const allowedMimes = new Set(allowedList.filter((m) => !EXECUTABLES.has(m)));
  // Chunked/resumable uploads bypass the per-request cap; this is their (much larger) ceiling.
  const maxChunkedSizeMb = maxChunkedSetting ? Number(maxChunkedSetting.value) : 512;
  // When on, files without a CLEAN scan result get no serving URL (default: on in prod only)
  const requireScan = requireScanSetting
    ? requireScanSetting.value === 'true'
    : process.env.NODE_ENV === 'production';

  cache = {
    maxFileSizeMb,
    maxFileSizeBytes: maxFileSizeMb * 1024 * 1024,
    allowedMimes,
    maxChunkedSizeMb,
    maxChunkedSizeBytes: maxChunkedSizeMb * 1024 * 1024,
    requireScan,
  };
  cacheTime = Date.now();
  return cache;
};
