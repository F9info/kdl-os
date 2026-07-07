import { prisma } from '../../config/database.js';

const EXECUTABLES = new Set([
  'application/x-executable', 'application/x-msdownload', 'application/x-sh',
  'application/x-bat', 'application/x-msdos-program',
]);

const DEFAULT_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/wav',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/zip',
];

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 60_000;

export const getUploadSettings = async () => {
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;

  const [maxSizeSetting, mimesSetting] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: 'media.max_file_size_mb' } }),
    prisma.appSetting.findUnique({ where: { key: 'media.allowed_mime_types' } }),
  ]);

  const maxFileSizeMb = maxSizeSetting ? Number(maxSizeSetting.value) : 10;
  const allowedList = mimesSetting ? JSON.parse(mimesSetting.value) : DEFAULT_MIME_TYPES;
  const allowedMimes = new Set(allowedList.filter((m) => !EXECUTABLES.has(m)));

  cache = { maxFileSizeMb, maxFileSizeBytes: maxFileSizeMb * 1024 * 1024, allowedMimes };
  cacheTime = Date.now();
  return cache;
};
