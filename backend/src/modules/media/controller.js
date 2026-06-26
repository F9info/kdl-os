import * as mediaService from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';

export const uploadMedia = async (req, res, next) => {
  try {
    if (!req.file) return errorResponse(res, 'No file uploaded', 400);
    const media = await mediaService.uploadMedia(req.file, req.user.userId);
    return successResponse(res, { media }, 201);
  } catch (err) {
    next(err);
  }
};

export const listMedia = async (req, res, next) => {
  try {
    const result = await mediaService.listMedia(req.user.userId, req.validated.query || {});
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const deleteMedia = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const deleted = await mediaService.deleteMedia(id, req.user.userId);
    if (!deleted) return errorResponse(res, 'Media not found', 404);
    return successResponse(res, { message: 'Media deleted' });
  } catch (err) {
    next(err);
  }
};
