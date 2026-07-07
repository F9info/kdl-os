import * as mediaService from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';

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
    const results = await Promise.all(files.map((f) => mediaService.uploadMedia(f, req.user.id, folderId)));
    return successResponse(res, { media: results }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const listMedia = async (req, res, next) => {
  try {
    const result = await mediaService.listMedia(req.user.userId ?? req.user.id, req.validated.query || {});
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const getMedia = async (req, res, next) => {
  try {
    const media = await mediaService.getMediaById(req.validated.params.id);
    if (!media) return errorResponse(res, 'Media not found', 404);
    return successResponse(res, { media });
  } catch (err) {
    next(err);
  }
};

export const updateMedia = async (req, res, next) => {
  try {
    const media = await mediaService.updateMediaMeta(req.validated.params.id, req.validated.body, req.user.id);
    if (!media) return errorResponse(res, 'Media not found', 404);
    return successResponse(res, { media });
  } catch (err) {
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
    const media = await mediaService.listTrash(req.user.id);
    return successResponse(res, { media });
  } catch (err) {
    next(err);
  }
};

export const restoreTrash = async (req, res, next) => {
  try {
    const result = await mediaService.restoreTrash(req.validated.body.media_ids, req.user.id);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const purgeTrash = async (req, res, next) => {
  try {
    const result = await mediaService.purgeTrash(req.user.id);
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
