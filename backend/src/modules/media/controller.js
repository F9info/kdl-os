import * as mediaService from './service.js';
import * as tagsService from './tags.service.js';
import * as metaFieldsService from './meta-fields.service.js';
import * as mediaSearchService from './media-search.service.js';
import * as collectionsService from './collections.service.js';
import * as fileOpsService from './file-ops.service.js';
import * as chunkedUploadService from './chunked-upload.service.js';
import * as importService from './import.service.js';
import { createShare, revokeShare, listShares, resolveShare, getShareQr, getEmbedSnippet } from './sharing.service.js';
import { transformMedia, buildSrcset } from './transform.service.js';
import * as commentsService from './comments.service.js';
import { transitionWorkflow as workflowTransition } from './workflow.service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { hasPermission } from '../user-management/shared/permission-resolver.js';

// ─── Search ──────────────────────────────────────────────────────────────────

export const searchMedia = async (req, res, next) => {
  try {
    const query = { ...req.validated.query };
    if (query.tags) query.tags = query.tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (query.meta) {
      query.meta = Object.fromEntries(
        query.meta.split(',')
          .map((pair) => pair.split(':').map((s) => s.trim()))
          .filter(([k, v]) => k && v)
      );
    }

    const access = { userId: req.user.userId ?? req.user.id, bypass: req.userPermissions?.bypass };

    // Phase D5: mode=semantic routes through ChromaDB embeddings ∩ Meili filters
    // instead of the plain keyword search below. 501 when no embeddings provider
    // is active (same shape as requireFeature()'s gate on the other AI routes).
    if (query.mode === 'semantic') {
      const { getActiveProvider } = await import('./ai/ai-provider.service.js');
      const provider = await getActiveProvider('embeddings');
      if (!provider) return errorResponse(res, 'AI feature "embeddings" is not configured', 501);
      const { searchMediaSemantic } = await import('./ai/media-semantic.service.js');
      const result = await searchMediaSemantic(provider, query, access);
      return successResponse(res, result);
    }

    const result = await mediaSearchService.searchMedia(query, access);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const reindexMedia = async (req, res, next) => {
  try {
    const result = await mediaSearchService.reindexAllMedia();
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

// ─── Folders ────────────────────────────────────────────────────────────────

export const listFolders = async (req, res, next) => {
  try {
    const folders = await mediaService.listFolders();
    return successResponse(res, { folders });
  } catch (err) {
    next(err);
  }
};

export const createFolder = async (req, res, next) => {
  try {
    const folder = await mediaService.createFolder(req.validated.body, req.user.id);
    return successResponse(res, { folder }, 201);
  } catch (err) {
    if (err.code === 'P2002') return errorResponse(res, 'A folder with that name already exists here', 409);
    next(err);
  }
};

export const updateFolder = async (req, res, next) => {
  try {
    const folder = await mediaService.updateFolder(req.validated.params.id, req.validated.body, req.user.id);
    if (!folder) return errorResponse(res, 'Folder not found', 404);
    return successResponse(res, { folder });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    if (err.code === 'P2002') return errorResponse(res, 'A folder with that name already exists here', 409);
    next(err);
  }
};

export const deleteFolder = async (req, res, next) => {
  try {
    const cascade = req.validated?.query?.cascade === 'true';
    const folder = await mediaService.deleteFolder(req.validated.params.id, cascade, req.user.id);
    if (!folder) return errorResponse(res, 'Folder not found', 404);
    return successResponse(res, { message: 'Folder deleted' });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const moveMedia = async (req, res, next) => {
  try {
    const { media_ids, folder_id } = req.validated.body;
    const result = await mediaService.moveMedia(media_ids, folder_id ?? null, req.user.id);
    return successResponse(res, result);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// ─── Media ──────────────────────────────────────────────────────────────────

export const uploadMedia = async (req, res, next) => {
  try {
    const files = req.files ?? (req.file ? [req.file] : []);
    if (!files.length) return errorResponse(res, 'No file uploaded', 400);
    const folderId = req.body?.folder_id ?? null;

    // Upload-as-shared: same per-feature permission as the PATCH visibility toggle.
    let visibility;
    if (req.body?.visibility === 'SHARED') {
      if (!(await hasPermission(req.user.id, 'media', 'visibility-toggle'))) {
        return errorResponse(res, 'Forbidden', 403);
      }
      visibility = 'SHARED';
    }

    // Folder upload (webkitdirectory): relative_paths is a JSON array aligned
    // with the files array; each entry shapes nested folders under folder_id.
    let relPaths = req.body?.relative_paths ?? null;
    if (typeof relPaths === 'string') {
      try { relPaths = JSON.parse(relPaths); } catch { relPaths = null; }
    }
    if (Array.isArray(relPaths) && relPaths.some((p) => typeof p === 'string' && p.includes('/'))) {
      const results = await fileOpsService.uploadFilesWithPaths(files, relPaths, folderId, req.user.id);
      return successResponse(res, { media: results }, 201);
    }

    const results = await Promise.all(
      files.map((f) => mediaService.uploadMedia(f, req.user.id, folderId, { visibility }).then((m) => mediaService.resolveUrls(m))),
    );
    return successResponse(res, { media: results }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// ─── File ops (A5) ───────────────────────────────────────────────────────────

export const copyMedia = async (req, res, next) => {
  try {
    const result = await fileOpsService.copyMedia(req.validated.params.id, req.validated.body ?? {}, req.user.id);
    if (!result) return errorResponse(res, 'Media not found', 404);
    return successResponse(res, result, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const archiveMedia = async (req, res, next) => {
  try {
    const { media_ids, archived } = req.validated.body;
    const result = await fileOpsService.setArchived(media_ids, archived, req.user.id);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const chunkInit = async (req, res, next) => {
  try {
    const result = await chunkedUploadService.initChunkedUpload(req.validated.body, req.user.id);
    return successResponse(res, result, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const chunkPart = async (req, res, next) => {
  try {
    if (!req.file?.buffer?.length) return errorResponse(res, 'No chunk data uploaded', 400);
    const index = Number(req.validated.query.index);
    const result = await chunkedUploadService.saveChunkPart(req.validated.params.uploadId, index, req.file.buffer, req.user.id);
    return successResponse(res, result);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const chunkStatus = async (req, res, next) => {
  try {
    const result = await chunkedUploadService.getChunkedStatus(req.validated.params.uploadId, req.user.id);
    return successResponse(res, result);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const chunkComplete = async (req, res, next) => {
  try {
    const media = await chunkedUploadService.completeChunkedUpload(req.validated.params.uploadId, req.user.id);
    return successResponse(res, { media }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status, err.detail);
    next(err);
  }
};

export const importZip = async (req, res, next) => {
  try {
    if (!req.file?.buffer?.length) return errorResponse(res, 'No zip file uploaded', 400);
    if (req.file.mimetype !== 'application/zip' && req.file.mimetype !== 'application/x-zip-compressed') {
      return errorResponse(res, 'File must be a zip archive', 422);
    }
    const result = await importService.importZip(req.file.buffer, req.validated.body ?? {}, req.user.id);
    return successResponse(res, result, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const importUrl = async (req, res, next) => {
  try {
    const { url, folder_id } = req.validated.body;
    const media = await importService.importFromUrl(url, { folder_id }, req.user.id);
    return successResponse(res, { media }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const listMedia = async (req, res, next) => {
  try {
    const userId = req.user.userId ?? req.user.id;
    const result = await mediaService.listMedia(userId, req.validated.query || {}, { bypass: req.userPermissions?.bypass });
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const getMedia = async (req, res, next) => {
  try {
    const userId = req.user.userId ?? req.user.id;
    const media = await mediaService.getMediaById(req.validated.params.id, userId, { bypass: req.userPermissions?.bypass });
    if (!media) return errorResponse(res, 'Media not found', 404);
    const baseUrl = req.protocol + '://' + req.get('host');
    const srcset = media.type === 'IMAGE' ? buildSrcset(media.id, baseUrl) : null;
    return successResponse(res, { media: { ...media, srcset } });
  } catch (err) {
    next(err);
  }
};

export const updateMedia = async (req, res, next) => {
  try {
    // The route guard covers 'metadata-edit'; 'visibility' is a distinct
    // per-feature permission (KDL-MEDIA-12), checked here since both fields
    // share this one PATCH endpoint.
    if (req.validated.body.visibility !== undefined && !(await hasPermission(req.user.id, 'media', 'visibility-toggle'))) {
      return errorResponse(res, 'Forbidden', 403);
    }
    const media = await mediaService.updateMediaMeta(req.validated.params.id, req.validated.body, req.user.id);
    if (!media) return errorResponse(res, 'Media not found', 404);
    return successResponse(res, { media });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// ─── Tags ────────────────────────────────────────────────────────────────────

export const listTags = async (req, res, next) => {
  try {
    const tags = await tagsService.listTags();
    return successResponse(res, { tags });
  } catch (err) {
    next(err);
  }
};

export const createTag = async (req, res, next) => {
  try {
    const tag = await tagsService.createTag(req.validated.body.name, req.user.id);
    return successResponse(res, { tag }, 201);
  } catch (err) {
    if (err.code === 'P2002') return errorResponse(res, 'A tag with that name already exists', 409);
    next(err);
  }
};

export const renameTag = async (req, res, next) => {
  try {
    const tag = await tagsService.renameTag(req.validated.params.id, req.validated.body.name, req.user.id);
    if (!tag) return errorResponse(res, 'Tag not found', 404);
    return successResponse(res, { tag });
  } catch (err) {
    if (err.code === 'P2002') return errorResponse(res, 'A tag with that name already exists', 409);
    next(err);
  }
};

export const deleteTag = async (req, res, next) => {
  try {
    const tag = await tagsService.deleteTag(req.validated.params.id, req.user.id);
    if (!tag) return errorResponse(res, 'Tag not found', 404);
    return successResponse(res, { message: 'Tag deleted' });
  } catch (err) {
    next(err);
  }
};

export const tagMedia = async (req, res, next) => {
  try {
    const { media_ids, tags } = req.validated.body;
    const result = await tagsService.tagMedia(media_ids, tags, req.user.id);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const untagMedia = async (req, res, next) => {
  try {
    const { media_ids, tags } = req.validated.body;
    const result = await tagsService.untagMedia(media_ids, tags, req.user.id);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

// ─── Collections ─────────────────────────────────────────────────────────────

export const listCollections = async (req, res, next) => {
  try {
    const collections = await collectionsService.listCollections();
    return successResponse(res, { collections });
  } catch (err) {
    next(err);
  }
};

export const createCollection = async (req, res, next) => {
  try {
    const collection = await collectionsService.createCollection(req.validated.body, req.user.id);
    return successResponse(res, { collection }, 201);
  } catch (err) {
    next(err);
  }
};

export const updateCollection = async (req, res, next) => {
  try {
    const collection = await collectionsService.updateCollection(req.validated.params.id, req.validated.body, req.user.id);
    if (!collection) return errorResponse(res, 'Collection not found', 404);
    return successResponse(res, { collection });
  } catch (err) {
    next(err);
  }
};

export const deleteCollection = async (req, res, next) => {
  try {
    const collection = await collectionsService.deleteCollection(req.validated.params.id, req.user.id);
    if (!collection) return errorResponse(res, 'Collection not found', 404);
    return successResponse(res, { message: 'Collection deleted' });
  } catch (err) {
    next(err);
  }
};

export const getCollectionContents = async (req, res, next) => {
  try {
    const result = await collectionsService.getCollectionContents(req.validated.params.id, req.validated.query ?? {});
    if (!result) return errorResponse(res, 'Collection not found', 404);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const addCollectionItems = async (req, res, next) => {
  try {
    const result = await collectionsService.addCollectionItems(req.validated.params.id, req.validated.body.media_ids, req.user.id);
    if (!result) return errorResponse(res, 'Collection not found', 404);
    return successResponse(res, result);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const removeCollectionItems = async (req, res, next) => {
  try {
    const result = await collectionsService.removeCollectionItems(req.validated.params.id, req.validated.body.media_ids, req.user.id);
    if (!result) return errorResponse(res, 'Collection not found', 404);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

// ─── Favorites / recents ─────────────────────────────────────────────────────

export const favoriteMedia = async (req, res, next) => {
  try {
    const result = await collectionsService.favoriteMedia(req.user.id, req.validated.params.id);
    if (!result) return errorResponse(res, 'Media not found', 404);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const unfavoriteMedia = async (req, res, next) => {
  try {
    const result = await collectionsService.unfavoriteMedia(req.user.id, req.validated.params.id);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const listFavorites = async (req, res, next) => {
  try {
    const result = await collectionsService.listFavorites(req.user.id, req.validated?.query ?? {});
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const touchMedia = async (req, res, next) => {
  try {
    const result = await collectionsService.touchMedia(req.validated.params.id);
    if (!result) return errorResponse(res, 'Media not found', 404);
    return successResponse(res, { message: 'Touched' });
  } catch (err) {
    next(err);
  }
};

export const listRecents = async (req, res, next) => {
  try {
    const userId = req.user.userId ?? req.user.id;
    const result = await collectionsService.listRecents(userId, req.validated?.query ?? {}, { bypass: req.userPermissions?.bypass });
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

// ─── Custom meta fields ──────────────────────────────────────────────────────

export const listMetaFields = async (req, res, next) => {
  try {
    const fields = await metaFieldsService.listMetaFields();
    return successResponse(res, { fields });
  } catch (err) {
    next(err);
  }
};

export const createMetaField = async (req, res, next) => {
  try {
    const field = await metaFieldsService.createMetaField(req.validated.body, req.user.id);
    return successResponse(res, { field }, 201);
  } catch (err) {
    if (err.code === 'P2002') return errorResponse(res, 'A field with that slug already exists', 409);
    next(err);
  }
};

export const updateMetaField = async (req, res, next) => {
  try {
    const field = await metaFieldsService.updateMetaField(req.validated.params.id, req.validated.body, req.user.id);
    if (!field) return errorResponse(res, 'Meta field not found', 404);
    return successResponse(res, { field });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    if (err.code === 'P2002') return errorResponse(res, 'A field with that slug already exists', 409);
    next(err);
  }
};

export const deleteMetaField = async (req, res, next) => {
  try {
    const field = await metaFieldsService.deleteMetaField(req.validated.params.id, req.user.id);
    if (!field) return errorResponse(res, 'Meta field not found', 404);
    return successResponse(res, { message: 'Meta field deleted' });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const deleteMedia = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const deleted = await mediaService.deleteMedia(id, req.user.id);
    if (!deleted) return errorResponse(res, 'Media not found', 404);
    return successResponse(res, { message: 'Media deleted' });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status, err.detail);
    next(err);
  }
};

export const bulkDelete = async (req, res, next) => {
  try {
    const result = await mediaService.bulkDelete(req.validated.body.media_ids, req.user.id);
    return successResponse(res, result);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status, err.detail);
    next(err);
  }
};

// ─── Trash ───────────────────────────────────────────────────────────────────

export const listTrash = async (req, res, next) => {
  try {
    const media = await mediaService.listTrash(req.user.userId ?? req.user.id, { bypass: req.userPermissions?.bypass });
    return successResponse(res, { media });
  } catch (err) {
    next(err);
  }
};

export const restoreTrash = async (req, res, next) => {
  try {
    const result = await mediaService.restoreTrash(req.validated.body.media_ids, req.user.userId ?? req.user.id, { bypass: req.userPermissions?.bypass });
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const purgeTrash = async (req, res, next) => {
  try {
    const result = await mediaService.purgeTrash(req.user.userId ?? req.user.id, { bypass: req.userPermissions?.bypass });
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const purgeSingle = async (req, res, next) => {
  try {
    const result = await mediaService.purgeSingle(req.validated.params.id, req.user.userId ?? req.user.id, { bypass: req.userPermissions?.bypass });
    if (!result) return errorResponse(res, 'File not found in trash', 404);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

// ─── Usage ───────────────────────────────────────────────────────────────────

export const getMediaUsage = async (req, res, next) => {
  try {
    const usages = await mediaService.getMediaUsage(req.validated.params.id);
    return successResponse(res, { usages });
  } catch (err) {
    next(err);
  }
};

export const registerUsage = async (req, res, next) => {
  try {
    const { media_id, entity, entity_id } = req.validated.body;
    const usage = await mediaService.registerMediaUsage(media_id, entity, entity_id);
    return successResponse(res, { usage }, 201);
  } catch (err) {
    next(err);
  }
};

export const releaseUsage = async (req, res, next) => {
  try {
    const { media_id, entity, entity_id } = req.validated.body;
    await mediaService.releaseMediaUsage(media_id, entity, entity_id);
    return successResponse(res, { message: 'Usage released' });
  } catch (err) {
    next(err);
  }
};

// ─── Processing jobs (Phase C) ───────────────────────────────────────────────

export const getJob = async (req, res, next) => {
  try {
    const { processingQueue } = await import('./processing.queue.js');
    const job = await processingQueue.getJob(req.validated.params.jobId);
    if (!job) return errorResponse(res, 'Job not found', 404);
    const state = await job.getState();
    const progress = job.progress;
    return successResponse(res, {
      id: job.id,
      name: job.name,
      state,
      progress,
      result: state === 'completed' ? job.returnvalue : null,
      failedReason: state === 'failed' ? job.failedReason : null,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    });
  } catch (err) {
    next(err);
  }
};

export const listVersions = async (req, res, next) => {
  try {
    const { prisma } = await import('../../config/database.js');
    const { getFileUrl } = await import('../../shared/services/storage.service.js');
    const versions = await prisma.mediaVersion.findMany({
      where: { media_id: req.validated.params.id },
      orderBy: { version: 'desc' },
    });
    const result = await Promise.all(
      versions.map(async (v) => ({ ...v, url: await getFileUrl(v.path) }))
    );
    return successResponse(res, { versions: result });
  } catch (err) {
    next(err);
  }
};

export const restoreVersion = async (req, res, next) => {
  try {
    const { prisma } = await import('../../config/database.js');
    const { minio } = await import('../../config/minio.js');
    const { getFileUrl } = await import('../../shared/services/storage.service.js');
    const { id: mediaId, versionId } = req.validated.params;
    const version = await prisma.mediaVersion.findUnique({ where: { id: versionId } });
    if (!version || version.media_id !== mediaId) return errorResponse(res, 'Version not found', 404);
    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) return errorResponse(res, 'Media not found', 404);

    // Copy version file to main media path (new object overwrite)
    const stream = await minio.getObject(process.env.MINIO_BUCKET, version.path);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    await minio.putObject(process.env.MINIO_BUCKET, media.path, buf);

    await prisma.media.update({ where: { id: mediaId }, data: { size: version.size, checksum: version.checksum } });
    return successResponse(res, { restored: true, version: version.version });
  } catch (err) {
    next(err);
  }
};

export const editMedia = async (req, res, next) => {
  try {
    const { enqueueProcessingJob } = await import('./processing.queue.js');
    const job = await enqueueProcessingJob('image-edit', {
      mediaId: req.validated.params.id,
      ops: req.validated.body.ops,
      note: req.validated.body.note,
      createdBy: req.user?.id,
    });
    return successResponse(res, { job_id: job.id, status: 'queued' }, 202);
  } catch (err) {
    next(err);
  }
};

// ─── OCR (Phase D3) — local tesseract/poppler job, no AI provider required ───
export const ocrMedia = async (req, res, next) => {
  try {
    const { isOcrSupported } = await import('./ocr.service.js');
    const { prisma } = await import('../../config/database.js');
    const media = await prisma.media.findFirst({
      where: { id: req.validated.params.id, deleted_at: null },
      select: { id: true, mime_type: true },
    });
    if (!media) return errorResponse(res, 'Media not found', 404);
    if (!isOcrSupported(media.mime_type)) {
      return errorResponse(res, `OCR not supported for ${media.mime_type}`, 422);
    }
    const { enqueueProcessingJob } = await import('./processing.queue.js');
    const job = await enqueueProcessingJob('ocr', { mediaId: media.id });
    return successResponse(res, { job_id: job.id, status: 'queued' }, 202);
  } catch (err) {
    next(err);
  }
};

// ─── Speech-to-text (Phase D4) ───────────────────────────────────────────────
// requireFeature('speech_to_text') on the route gives the 501 when unconfigured.
export const transcribeMedia = async (req, res, next) => {
  try {
    const { enqueueProcessingJob } = await import('./processing.queue.js');
    const job = await enqueueProcessingJob('ai-transcribe', {
      mediaId: req.validated.params.id,
      language: req.validated.body?.language,
    });
    return successResponse(res, { job_id: job.id, status: 'queued' }, 202);
  } catch (err) {
    next(err);
  }
};

export const getTranscript = async (req, res, next) => {
  try {
    const { prisma } = await import('../../config/database.js');
    const media = await prisma.media.findFirst({
      where: { id: req.validated.params.id, deleted_at: null },
      select: { id: true, transcript: true, transcript_text: true, transcript_lang: true, original_name: true },
    });
    if (!media) return errorResponse(res, 'Media not found', 404);
    if (!media.transcript_text && !(media.transcript ?? []).length) {
      return errorResponse(res, 'No transcript available for this media', 404);
    }

    const format = req.validated.query?.format ?? 'json';
    const segments = media.transcript ?? [];
    if (format === 'srt' || format === 'vtt') {
      const { segmentsToSrt, segmentsToVtt } = await import('./ai/transcribe.service.js');
      const body = format === 'srt' ? segmentsToSrt(segments) : segmentsToVtt(segments);
      const base = media.original_name.replace(/\.[^.]+$/, '');
      res.setHeader('Content-Type', format === 'srt' ? 'application/x-subrip' : 'text/vtt');
      res.setHeader('Content-Disposition', `attachment; filename="${base}.${format}"`);
      return res.send(body);
    }

    return successResponse(res, {
      text: media.transcript_text,
      segments,
      language: media.transcript_lang,
    });
  } catch (err) {
    next(err);
  }
};

// ─── AI suggestions (Phase D2) ───────────────────────────────────────────────
// requireFeature('vision') middleware (ai/ai-provider.service.js) gates this route 501
// when unconfigured, per the "every AI feature is optional" rule.
export const analyzeMedia = async (req, res, next) => {
  try {
    const { enqueueProcessingJob } = await import('./processing.queue.js');
    const job = await enqueueProcessingJob('ai-analyze', { mediaId: req.validated.params.id });
    return successResponse(res, { job_id: job.id, status: 'queued' }, 202);
  } catch (err) {
    next(err);
  }
};

// ─── AI image ops (Phase D6) ─────────────────────────────────────────────────
// requireFeature('image_ops') on the route gives the 501 when unconfigured.
export const aiImageOp = async (req, res, next) => {
  try {
    const { enqueueProcessingJob } = await import('./processing.queue.js');
    const { op, scale, mask, note } = req.validated.body;
    const job = await enqueueProcessingJob('ai-image-op', {
      mediaId: req.validated.params.id,
      op,
      scale,
      mask,
      note,
      createdBy: req.user.id,
    });
    return successResponse(res, { job_id: job.id, status: 'queued' }, 202);
  } catch (err) {
    next(err);
  }
};

// ─── AI recognition (Phase D7) — labels/logos/landmarks/products → tags ─────
// OPTIONAL, default OFF: only runs when this endpoint is explicitly called AND
// requireFeature('vision') on the route resolves an active provider (501 otherwise).
// Face recognition is explicitly EXCLUDED v1 — see .agents/DECISIONS.md MEDIA-002.
export const recognizeMedia = async (req, res, next) => {
  try {
    const { enqueueProcessingJob } = await import('./processing.queue.js');
    const job = await enqueueProcessingJob('ai-recognize', { mediaId: req.validated.params.id });
    return successResponse(res, { job_id: job.id, status: 'queued' }, 202);
  } catch (err) {
    next(err);
  }
};

// ─── QR/barcode decode (Phase D7) — local zxing job, no AI provider required ─
export const qrDecodeMedia = async (req, res, next) => {
  try {
    const { isQrDecodeSupported } = await import('./qr.service.js');
    const { prisma } = await import('../../config/database.js');
    const media = await prisma.media.findFirst({
      where: { id: req.validated.params.id, deleted_at: null },
      select: { id: true, mime_type: true },
    });
    if (!media) return errorResponse(res, 'Media not found', 404);
    if (!isQrDecodeSupported(media.mime_type)) {
      return errorResponse(res, `QR/barcode decode not supported for ${media.mime_type}`, 422);
    }
    const { enqueueProcessingJob } = await import('./processing.queue.js');
    const job = await enqueueProcessingJob('qr-decode', { mediaId: media.id });
    return successResponse(res, { job_id: job.id, status: 'queued' }, 202);
  } catch (err) {
    next(err);
  }
};

export const listMediaSuggestions = async (req, res, next) => {
  try {
    const { listSuggestions } = await import('./ai/suggestions.service.js');
    const items = await listSuggestions(req.validated.params.id);
    return successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

export const acceptMediaSuggestion = async (req, res, next) => {
  try {
    const { acceptSuggestion } = await import('./ai/suggestions.service.js');
    const suggestion = await acceptSuggestion(req.validated.params.id, req.user.id);
    if (!suggestion) return errorResponse(res, 'Suggestion not found', 404);
    return successResponse(res, { item: suggestion });
  } catch (err) {
    next(err);
  }
};

export const rejectMediaSuggestion = async (req, res, next) => {
  try {
    const { rejectSuggestion } = await import('./ai/suggestions.service.js');
    const suggestion = await rejectSuggestion(req.validated.params.id, req.user.id);
    if (!suggestion) return errorResponse(res, 'Suggestion not found', 404);
    return successResponse(res, { item: suggestion });
  } catch (err) {
    next(err);
  }
};

export const pdfOp = async (req, res, next) => {
  try {
    const { enqueueProcessingJob } = await import('./processing.queue.js');
    const job = await enqueueProcessingJob('pdf-op', {
      ...req.validated.body,
      mediaId: req.validated.params?.id ?? req.validated.body.id,
      createdBy: req.user?.id,
    });
    return successResponse(res, { job_id: job.id, status: 'queued' }, 202);
  } catch (err) {
    next(err);
  }
};

export const videoOp = async (req, res, next) => {
  try {
    const { enqueueProcessingJob } = await import('./processing.queue.js');
    const job = await enqueueProcessingJob('video-op', {
      ...req.validated.body,
      mediaId: req.validated.params.id,
      createdBy: req.user?.id,
    });
    return successResponse(res, { job_id: job.id, status: 'queued' }, 202);
  } catch (err) {
    next(err);
  }
};

export const audioOp = async (req, res, next) => {
  try {
    const { enqueueProcessingJob } = await import('./processing.queue.js');
    const job = await enqueueProcessingJob('audio-op', {
      ...req.validated.body,
      mediaId: req.validated.params.id,
      createdBy: req.user?.id,
    });
    return successResponse(res, { job_id: job.id, status: 'queued' }, 202);
  } catch (err) {
    next(err);
  }
};

export const convertMedia = async (req, res, next) => {
  try {
    const { enqueueProcessingJob } = await import('./processing.queue.js');
    const job = await enqueueProcessingJob('convert', {
      mediaId: req.validated.params.id,
      to: req.validated.body.to,
      quality: req.validated.body.quality,
      createdBy: req.user?.id,
    });
    return successResponse(res, { job_id: job.id, status: 'queued' }, 202);
  } catch (err) {
    next(err);
  }
};

// ─── Sharing (B4) ────────────────────────────────────────────────────────────
export const createShareLink = async (req, res, next) => {
  try {
    const share = await createShare(req.validated.body, req.user.id);
    return successResponse(res, share, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const revokeShareLink = async (req, res, next) => {
  try {
    await revokeShare(req.validated.params.id, req.user.id);
    return successResponse(res, { message: 'Revoked' });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const listShareLinks = async (req, res, next) => {
  try {
    const shares = await listShares(req.validated.params.id);
    return successResponse(res, { shares });
  } catch (err) {
    next(err);
  }
};

export const resolveShareLink = async (req, res, next) => {
  try {
    const password = req.body?.password;
    const result = await resolveShare(req.params.token, password);
    return successResponse(res, result);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const shareQr = async (req, res, next) => {
  try {
    const baseUrl = req.protocol + '://' + req.get('host');
    const buf = await getShareQr(req.params.token, baseUrl);
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' });
    res.send(buf);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const shareEmbed = async (req, res, next) => {
  try {
    const baseUrl = req.protocol + '://' + req.get('host');
    const snippet = getEmbedSnippet(req.params.token, baseUrl);
    return successResponse(res, { snippet });
  } catch (err) {
    next(err);
  }
};

// ─── Transform (B2) ──────────────────────────────────────────────────────────
export const getTransform = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const { buffer, format } = await transformMedia(id, req.validated.query ?? {}, req.user?.id);
    res.set({
      'Content-Type': `image/${format}`,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    return res.send(buffer);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// ─── Comments (B5) ───────────────────────────────────────────────────────────
export const listComments = async (req, res, next) => {
  try {
    const comments = await commentsService.listComments(req.validated.params.id);
    return successResponse(res, { comments });
  } catch (err) {
    next(err);
  }
};

export const createComment = async (req, res, next) => {
  try {
    const comment = await commentsService.createComment(
      req.validated.params.id,
      req.user.id,
      req.validated.body.body,
    );
    return successResponse(res, { comment }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const deleteComment = async (req, res, next) => {
  try {
    await commentsService.deleteComment(req.validated.params.commentId, req.user.id);
    return successResponse(res, { message: 'Comment deleted' });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// ─── Workflow transition (B6) ─────────────────────────────────────────────────
export const transitionWorkflow = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const { status } = req.validated.body;
    // Build a Set of permission strings; bypass (superadmin) grants all media actions
    const permsSet = req.userPermissions?.bypass
      ? new Set(['media:edit', 'media:approve', 'media:publish'])
      : new Set(req.userPermissions?.permissions ?? []);
    const media = await workflowTransition(id, status, req.user.id, permsSet);
    return successResponse(res, { media });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// ─── Re-upload as new version (B5) ───────────────────────────────────────────
export const reuploadAsVersion = async (req, res, next) => {
  try {
    if (!req.file?.buffer?.length) return errorResponse(res, 'No file uploaded', 400);
    const { id } = req.validated.params;
    const note = req.validated.body?.note ?? null;

    const { prisma } = await import('../../config/database.js');
    const { minio } = await import('../../config/minio.js');
    const { createHash } = await import('crypto');

    const media = await prisma.media.findUnique({ where: { id, deleted_at: null } });
    if (!media) return errorResponse(res, 'Media not found', 404);

    // 1. Snapshot the CURRENT (old) state as a version record (path only — no file copy)
    const lastVersion = await prisma.mediaVersion.findFirst({
      where: { media_id: id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (lastVersion?.version ?? 0) + 1;
    await prisma.mediaVersion.create({
      data: {
        media_id: id,
        version: nextVersion,
        path: media.path,
        size: media.size,
        checksum: media.checksum,
        created_by: req.user.id,
        note: note ?? null,
      },
    });

    // 2. Overwrite the main file in storage with the new buffer
    const buf = req.file.buffer;
    const bucket = media.bucket ?? process.env.MINIO_BUCKET;
    await minio.putObject(bucket, media.path, buf, buf.length, { 'Content-Type': req.file.mimetype });

    // 3. Update Media record with new size and checksum
    const checksum = createHash('sha256').update(buf).digest('hex');
    const updated = await prisma.media.update({
      where: { id },
      data: { size: buf.length, checksum },
    });

    return successResponse(res, { media: await mediaService.resolveUrls(updated), version: nextVersion });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
