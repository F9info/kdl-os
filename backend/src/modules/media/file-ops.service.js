import { randomUUID } from 'crypto';
import * as storageService from '../../shared/services/storage.service.js';
import { prisma } from '../../config/database.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';
import { enqueueVariantJob } from './media.queue.js';
import { enqueueReindex } from './media-search.service.js';
import { uploadMedia } from './service.js';

const SHARP_SAFE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

// "photo.jpg" → "photo (copy).jpg"; "README" → "README (copy)"
const copyName = (name) => {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return `${name} (copy)`;
  return `${name.slice(0, dot)} (copy)${name.slice(dot)}`;
};

// ─── Copy / duplicate ────────────────────────────────────────────────────────

export const copyMedia = async (id, { folder_id } = {}, actorId) => {
  const src = await prisma.media.findFirst({
    where: { id, deleted_at: null },
    include: { tags: true, meta_values: true },
  });
  if (!src) return null;

  const ext = src.path.split('.').pop().toLowerCase();
  const objectName = `${actorId}/${randomUUID()}.${ext}`;
  await storageService.copyFile(src.path, objectName);

  const record = await prisma.media.create({
    data: {
      user_id: actorId,
      folder_id: folder_id !== undefined ? folder_id : src.folder_id,
      filename: objectName,
      original_name: copyName(src.original_name),
      mime_type: src.mime_type,
      size: src.size,
      bucket: src.bucket,
      path: objectName,
      type: src.type,
      title: src.title,
      alt_text: src.alt_text,
      caption: src.caption,
      width: src.width,
      height: src.height,
      duration: src.duration,
      exif: src.exif ?? undefined,
      checksum: src.checksum,
      scanned_at: src.scanned_at,
      scan_result: src.scan_result,
    },
  });

  if (src.tags.length) {
    await prisma.mediaTagPivot.createMany({
      data: src.tags.map((p) => ({ media_id: record.id, tag_id: p.tag_id })),
      skipDuplicates: true,
    });
  }
  if (src.meta_values.length) {
    await prisma.mediaMetaValue.createMany({
      data: src.meta_values.map((v) => ({ media_id: record.id, field_id: v.field_id, value: v.value })),
      skipDuplicates: true,
    });
  }

  if (src.type === 'IMAGE' && SHARP_SAFE_MIMES.has(src.mime_type)) {
    await enqueueVariantJob(record.id, objectName, src.mime_type);
  }

  // Dedupe warning: other live files with identical content (same checksum)
  const duplicates = src.checksum
    ? await prisma.media.findMany({
        where: { checksum: src.checksum, deleted_at: null, id: { notIn: [id, record.id] } },
        select: { id: true, original_name: true, folder_id: true },
      })
    : [];

  enqueueReindex(record.id);
  writeActivityAsync({ actor: actorId, module: 'media', action: 'copied', description: `File "${src.original_name}" duplicated` });
  return { media: record, duplicates };
};

// ─── Archive flag ────────────────────────────────────────────────────────────

export const setArchived = async (mediaIds, archived, actorId) => {
  const result = await prisma.media.updateMany({
    where: { id: { in: mediaIds }, deleted_at: null },
    data: { is_archived: archived },
  });
  mediaIds.forEach((mid) => enqueueReindex(mid));
  writeActivityAsync({
    actor: actorId, module: 'media', action: archived ? 'archived' : 'unarchived',
    description: `${result.count} file(s) ${archived ? 'archived' : 'unarchived'}`,
  });
  return { updated: result.count, archived };
};

// ─── Folder upload (webkitdirectory relative paths) ──────────────────────────

const MAX_FOLDER_DEPTH = 6;

const getFolderDepth = async (folderId) => {
  let depth = 1;
  let current = folderId;
  while (current) {
    const f = await prisma.mediaFolder.findUnique({ where: { id: current }, select: { parent_id: true } });
    if (!f || !f.parent_id) break;
    current = f.parent_id;
    depth++;
  }
  return depth;
};

// Splits a webkitdirectory relativePath into safe folder segments (filename dropped).
export const sanitizePathSegments = (relativePath) => {
  if (typeof relativePath !== 'string' || !relativePath) return [];
  const parts = relativePath.replace(/\\/g, '/').split('/');
  parts.pop(); // last segment is the filename
  return parts
    .map((s) => s.trim())
    .filter((s) => s && s !== '.' && s !== '..')
    .map((s) => s.slice(0, 255));
};

// Find-or-create nested folders under base; `cache` dedupes lookups within one request.
export const ensureFolderPath = async (baseFolderId, segments, actorId, cache = new Map()) => {
  if (!segments.length) return baseFolderId ?? null;

  const baseDepth = baseFolderId ? await getFolderDepth(baseFolderId) : 0;
  if (baseDepth + segments.length > MAX_FOLDER_DEPTH) {
    throw Object.assign(new Error(`Maximum folder depth (${MAX_FOLDER_DEPTH} levels) exceeded`), { status: 422 });
  }

  let parent = baseFolderId ?? null;
  let keyPrefix = parent ?? 'root';
  for (const name of segments) {
    const key = `${keyPrefix}/${name}`;
    if (cache.has(key)) {
      parent = cache.get(key);
    } else {
      let folder = await prisma.mediaFolder.findFirst({ where: { parent_id: parent, name } });
      if (!folder) {
        try {
          folder = await prisma.mediaFolder.create({ data: { name, parent_id: parent, created_by: actorId } });
        } catch (err) {
          if (err.code !== 'P2002') throw err; // concurrent create → refetch
          folder = await prisma.mediaFolder.findFirst({ where: { parent_id: parent, name } });
        }
      }
      cache.set(key, folder.id);
      parent = folder.id;
    }
    keyPrefix = parent;
  }
  return parent;
};

// Upload a batch where each file may carry a directory-relative path.
export const uploadFilesWithPaths = async (files, relativePaths, baseFolderId, userId) => {
  const cache = new Map();
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const segments = sanitizePathSegments(relativePaths[i]);
    const folderId = await ensureFolderPath(baseFolderId, segments, userId, cache);
    results.push(await uploadMedia(files[i], userId, folderId));
  }
  return results;
};
