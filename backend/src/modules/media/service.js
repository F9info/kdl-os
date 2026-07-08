import { randomUUID, createHash } from 'crypto';
import * as storageService from '../../shared/services/storage.service.js';
import { prisma } from '../../config/database.js';
import { getPaginationParams } from '../../shared/utils/pagination.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';
import { getUploadSettings } from './settings.js';
import { enqueueVariantJob } from './media.queue.js';
import { sanitizeSvg, isSvgMime } from './svg-sanitizer.js';
import { extractExif } from './exif-extractor.js';
import { setMediaTags } from './tags.service.js';
import { setMediaMeta } from './meta-fields.service.js';
import { enqueueReindex } from './media-search.service.js';

const MIME_TO_TYPE = (mime) => {
  if (mime.startsWith('image/')) return 'IMAGE';
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime.startsWith('audio/')) return 'AUDIO';
  if (mime === 'application/pdf' || mime.includes('document') || mime.includes('spreadsheet') ||
      mime.includes('word') || mime.includes('excel') || mime.includes('csv') ||
      mime === 'text/csv' || mime === 'text/plain') return 'DOCUMENT';
  return 'OTHER';
};

// Formats sharp decodes reliably — only these get magic-byte validation,
// dimension probing, and webp variant generation. SVG/HEIC/PSD etc. are
// stored as-is (sharp prebuilt binaries lack HEIF/PSD decoders).
const SHARP_SAFE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

// ─── Folders ────────────────────────────────────────────────────────────────

export const listFolders = async () => {
  const folders = await prisma.mediaFolder.findMany({
    include: { _count: { select: { media: true, children: true } } },
    orderBy: { name: 'asc' },
  });
  return folders;
};

export const createFolder = async (data, actorId) => {
  const folder = await prisma.mediaFolder.create({
    data: {
      name: data.name,
      parent_id: data.parent_id ?? null,
      created_by: actorId,
    },
  });
  writeActivityAsync({ actor: actorId, module: 'media', action: 'folder_created', description: `Folder "${data.name}" created` });
  return folder;
};

// Returns all descendant IDs of a folder (recursive)
const getDescendantIds = async (folderId) => {
  const children = await prisma.mediaFolder.findMany({ where: { parent_id: folderId }, select: { id: true } });
  const ids = children.map((c) => c.id);
  for (const child of children) {
    const sub = await getDescendantIds(child.id);
    ids.push(...sub);
  }
  return ids;
};

export const updateFolder = async (id, data, actorId) => {
  const folder = await prisma.mediaFolder.findUnique({ where: { id } });
  if (!folder) return null;

  if (data.parent_id !== undefined) {
    // Prevent moving into own descendant (cycle check)
    if (data.parent_id === id) throw Object.assign(new Error('Cannot move folder into itself'), { status: 422 });
    if (data.parent_id !== null) {
      const descendants = await getDescendantIds(id);
      if (descendants.includes(data.parent_id)) {
        throw Object.assign(new Error('Cannot move folder into its own descendant'), { status: 422 });
      }
      // Depth cap: count depth of new parent
      const depth = await getFolderDepth(data.parent_id);
      if (depth >= 5) throw Object.assign(new Error('Maximum folder depth (6 levels) exceeded'), { status: 422 });
    }
  }

  const updated = await prisma.mediaFolder.update({ where: { id }, data });
  writeActivityAsync({ actor: actorId, module: 'media', action: 'folder_updated', description: `Folder "${updated.name}" updated` });
  return updated;
};

const getFolderDepth = async (folderId) => {
  let depth = 0;
  let current = folderId;
  while (current) {
    const f = await prisma.mediaFolder.findUnique({ where: { id: current }, select: { parent_id: true } });
    if (!f || !f.parent_id) break;
    current = f.parent_id;
    depth++;
  }
  return depth;
};

export const deleteFolder = async (id, cascade, actorId) => {
  const folder = await prisma.mediaFolder.findUnique({ where: { id }, include: { _count: { select: { media: true, children: true } } } });
  if (!folder) return null;

  const isEmpty = folder._count.media === 0 && folder._count.children === 0;
  if (!isEmpty && !cascade) {
    throw Object.assign(new Error('Folder is not empty. Use ?cascade=true to force.'), { status: 409 });
  }

  if (cascade && !isEmpty) {
    // Soft-delete all media within this folder tree
    const allDescendants = [id, ...(await getDescendantIds(id))];
    await prisma.media.updateMany({
      where: { folder_id: { in: allDescendants }, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    writeActivityAsync({ actor: actorId, module: 'media', action: 'folder_cascade_deleted', description: `Folder "${folder.name}" deleted with cascade` });
  }

  // Cascade delete propagates via DB to children folders
  await prisma.mediaFolder.delete({ where: { id } });
  writeActivityAsync({ actor: actorId, module: 'media', action: 'folder_deleted', description: `Folder "${folder.name}" deleted` });
  return folder;
};

export const moveMedia = async (mediaIds, folderId, actorId) => {
  if (folderId) {
    const folder = await prisma.mediaFolder.findUnique({ where: { id: folderId } });
    if (!folder) throw Object.assign(new Error('Folder not found'), { status: 404 });
  }
  await prisma.media.updateMany({
    where: { id: { in: mediaIds } },
    data: { folder_id: folderId ?? null },
  });
  mediaIds.forEach((mid) => enqueueReindex(mid));
  writeActivityAsync({ actor: actorId, module: 'media', action: 'media_moved', description: `${mediaIds.length} file(s) moved` });
  return { moved: mediaIds.length };
};

// ─── Media CRUD ─────────────────────────────────────────────────────────────

export const uploadMedia = async (file, userId, folderId) => {
  const settings = await getUploadSettings();
  if (file.size > settings.maxFileSizeBytes) {
    throw Object.assign(new Error(`File exceeds max size of ${settings.maxFileSizeMb}MB`), { status: 422 });
  }
  if (!settings.allowedMimes.has(file.mimetype)) {
    throw Object.assign(new Error(`File type not allowed: ${file.mimetype}`), { status: 422 });
  }

  // SVG: strip active content (scripts, event handlers, entity bombs) before storage
  if (isSvgMime(file.mimetype)) {
    file.buffer = sanitizeSvg(file.buffer);
    file.size = file.buffer.length;
  }

  const mediaType = MIME_TO_TYPE(file.mimetype);
  const sharpSafe = SHARP_SAFE_MIMES.has(file.mimetype);
  let width = null;
  let height = null;
  let exif = null;

  // For sharp-decodable images: validate magic bytes (sharp throws on fake images → 422) + derive dimensions
  if (mediaType === 'IMAGE' && sharpSafe) {
    const { default: sharp } = await import('sharp');
    try {
      const meta = await sharp(file.buffer).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
    } catch {
      throw Object.assign(new Error('Invalid image file: content does not match declared MIME type'), { status: 422 });
    }
  }

  // EXIF (camera/gps/taken_at) — best-effort, never blocks upload
  if (mediaType === 'IMAGE' && !isSvgMime(file.mimetype)) {
    exif = await extractExif(file.buffer);
  }

  const checksum = createHash('sha256').update(file.buffer).digest('hex');

  const ext = file.originalname.split('.').pop().toLowerCase();
  const objectName = `${userId}/${randomUUID()}.${ext}`;
  await storageService.uploadFile(file, objectName);

  const record = await prisma.media.create({
    data: {
      user_id: userId,
      folder_id: folderId ?? null,
      filename: objectName,
      original_name: file.originalname,
      mime_type: file.mimetype,
      size: file.size,
      bucket: process.env.MINIO_BUCKET,
      path: objectName,
      type: mediaType,
      width,
      height,
      exif,
      checksum,
    },
  });

  if (mediaType === 'IMAGE' && sharpSafe) {
    await enqueueVariantJob(record.id, objectName, file.mimetype);
  }

  enqueueReindex(record.id);
  writeActivityAsync({ actor: userId, module: 'media', action: 'uploaded', description: `File "${file.originalname}" uploaded` });
  return record;
};

export const listMedia = async (userId, query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const { folder_id, type, search, date_from, date_to, sort } = query;

  const where = { deleted_at: null };
  if (folder_id !== undefined) where.folder_id = folder_id === 'null' ? null : folder_id;
  if (type) where.type = type;
  if (search) {
    where.OR = [
      { original_name: { contains: search, mode: 'insensitive' } },
      { title: { contains: search, mode: 'insensitive' } },
      { alt_text: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (date_from || date_to) {
    where.created_at = {};
    if (date_from) where.created_at.gte = new Date(date_from);
    if (date_to) where.created_at.lte = new Date(date_to);
  }

  const sortMap = {
    created_at_desc: { created_at: 'desc' },
    created_at_asc: { created_at: 'asc' },
    name_asc: { original_name: 'asc' },
    name_desc: { original_name: 'desc' },
    size_desc: { size: 'desc' },
  };
  const orderBy = sortMap[sort] ?? { created_at: 'desc' };

  const [mediaItems, total] = await Promise.all([
    prisma.media.findMany({ where, skip, take: limit, orderBy }),
    prisma.media.count({ where }),
  ]);

  const media = await Promise.all(mediaItems.map(async (m) => resolveUrls(m)));
  return { media, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

const DAM_INCLUDE = {
  tags: { include: { tag: true } },
  meta_values: { include: { field: true } },
};

// Flatten pivot rows into API-friendly `tags: string[]` + `meta: {slug: value}`
const shapeDamFields = (m) => {
  const { tags, meta_values, ...rest } = m;
  return {
    ...rest,
    tags: (tags ?? []).map((p) => p.tag.name).sort(),
    meta: Object.fromEntries((meta_values ?? []).map((v) => [v.field.slug, v.value])),
  };
};

export const getMediaById = async (id) => {
  const record = await prisma.media.findFirst({ where: { id, deleted_at: null }, include: DAM_INCLUDE });
  if (!record) return null;
  return resolveUrls(shapeDamFields(record));
};

export const updateMediaMeta = async (id, data, actorId) => {
  const { tags, meta, ...fields } = data;
  const record = await prisma.media.findFirst({ where: { id, deleted_at: null } });
  if (!record) return null;
  if (Object.keys(fields).length) {
    await prisma.media.update({ where: { id }, data: fields });
  }
  if (tags) await setMediaTags(id, tags);
  if (meta) await setMediaMeta(id, meta);
  const updated = await prisma.media.findFirst({ where: { id }, include: DAM_INCLUDE });
  enqueueReindex(id);
  writeActivityAsync({ actor: actorId, module: 'media', action: 'updated', description: `File "${updated.original_name}" metadata updated` });
  return resolveUrls(shapeDamFields(updated));
};

export const resolveUrls = async (m) => {
  const url = await storageService.getFileUrl(m.path).catch(() => null);
  const variantUrls = m.variants ? await resolveVariantUrls(m.variants) : null;
  return { ...m, url, variants: variantUrls };
};

const resolveVariantUrls = async (variants) => {
  const entries = Object.entries(variants).filter(([, path]) => path);
  const results = await Promise.allSettled(
    entries.map(([, path]) => storageService.getFileUrl(path))
  );
  const result = {};
  entries.forEach(([key], i) => {
    if (results[i].status === 'fulfilled') result[key] = results[i].value;
  });
  return result;
};

// ─── Soft delete / trash ─────────────────────────────────────────────────────

export const bulkDelete = async (mediaIds, actorId) => {
  const records = await prisma.media.findMany({
    where: { id: { in: mediaIds }, deleted_at: null },
    include: { usages: { take: 1 } },
  });

  const inUse = records.filter((r) => r.usages.length > 0);
  if (inUse.length > 0) {
    const detail = await Promise.all(
      inUse.map(async (r) => {
        const usages = await prisma.mediaUsage.findMany({ where: { media_id: r.id } });
        return { id: r.id, name: r.original_name, usages };
      })
    );
    throw Object.assign(new Error('Some files are in use and cannot be deleted'), { status: 409, detail });
  }

  const foundIds = records.map((r) => r.id);
  await prisma.media.updateMany({ where: { id: { in: foundIds } }, data: { deleted_at: new Date() } });
  foundIds.forEach((mid) => enqueueReindex(mid, 'remove'));
  writeActivityAsync({ actor: actorId, module: 'media', action: 'bulk_deleted', description: `${foundIds.length} file(s) moved to trash` });
  return { deleted: foundIds.length };
};

export const deleteMedia = async (id, actorId) => {
  const record = await prisma.media.findFirst({ where: { id, deleted_at: null } });
  if (!record) return null;
  const usages = await prisma.mediaUsage.count({ where: { media_id: id } });
  if (usages > 0) {
    const detail = await prisma.mediaUsage.findMany({ where: { media_id: id } });
    throw Object.assign(new Error('File is in use and cannot be deleted'), { status: 409, detail });
  }
  await prisma.media.update({ where: { id }, data: { deleted_at: new Date() } });
  enqueueReindex(id, 'remove');
  writeActivityAsync({ actor: actorId, module: 'media', action: 'deleted', description: `File "${record.original_name}" moved to trash` });
  return record;
};

export const listTrash = async (userId) => {
  const mediaItems = await prisma.media.findMany({
    where: { deleted_at: { not: null } },
    orderBy: { deleted_at: 'desc' },
  });
  return Promise.all(mediaItems.map(async (m) => resolveUrls(m)));
};

export const restoreTrash = async (mediaIds, actorId) => {
  await prisma.media.updateMany({
    where: { id: { in: mediaIds }, deleted_at: { not: null } },
    data: { deleted_at: null },
  });
  mediaIds.forEach((mid) => enqueueReindex(mid));
  writeActivityAsync({ actor: actorId, module: 'media', action: 'restored', description: `${mediaIds.length} file(s) restored from trash` });
  return { restored: mediaIds.length };
};

export const purgeTrash = async (actorId) => {
  const trashed = await prisma.media.findMany({ where: { deleted_at: { not: null } } });
  if (trashed.length === 0) return { purged: 0 };

  // Delete objects from storage
  const paths = trashed.flatMap((m) => {
    const all = [m.path];
    if (m.variants) {
      for (const p of Object.values(m.variants)) {
        if (p) all.push(p);
      }
    }
    return all;
  });
  await storageService.deleteFiles(paths);
  await prisma.media.deleteMany({ where: { id: { in: trashed.map((m) => m.id) } } });

  const fileList = trashed.map((m) => m.original_name);
  const fileListStr = fileList.slice(0, 50).join(', ') + (fileList.length > 50 ? ` … +${fileList.length - 50} more` : '');
  writeActivityAsync({ actor: actorId, module: 'media', action: 'purged', description: `Permanently deleted ${trashed.length} file(s): ${fileListStr}` });
  return { purged: trashed.length };
};

// ─── Usage tracking ──────────────────────────────────────────────────────────

export const registerMediaUsage = async (mediaId, entity, entityId) => {
  return prisma.mediaUsage.upsert({
    where: { media_id_entity_entity_id: { media_id: mediaId, entity, entity_id: entityId } },
    update: {},
    create: { media_id: mediaId, entity, entity_id: entityId },
  });
};

export const releaseMediaUsage = async (mediaId, entity, entityId) => {
  return prisma.mediaUsage.deleteMany({
    where: { media_id: mediaId, entity, entity_id: entityId },
  });
};

export const getMediaUsage = async (id) => {
  return prisma.mediaUsage.findMany({ where: { media_id: id } });
};
