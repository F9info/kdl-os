import { successResponse, errorResponse } from '../../shared/utils/response.js';
import {
  getKit,
  uploadLogo,
  extractPaletteForKit,
  inferBrandKit,
  patchKit,
  approveKit,
  reopenKit,
  getTokens,
} from './service.js';

export const getKitHandler = async (req, res, next) => {
  try {
    const kit = await getKit(req.params.projectId);
    successResponse(res, kit);
  } catch (err) {
    next(err);
  }
};

export const uploadLogoHandler = async (req, res, next) => {
  try {
    if (!req.file) return errorResponse(res, 'Logo file is required', 400);
    const kit = await uploadLogo(req.params.projectId, req.file, req.user.id);
    successResponse(res, kit, 201);
  } catch (err) {
    next(err);
  }
};

export const extractHandler = async (req, res, next) => {
  try {
    const kit = await extractPaletteForKit(req.params.projectId);
    successResponse(res, kit);
  } catch (err) {
    next(err);
  }
};

export const inferHandler = async (req, res, next) => {
  try {
    const kit = await inferBrandKit(req.params.projectId, req.body ?? {});
    successResponse(res, kit);
  } catch (err) {
    next(err);
  }
};

export const patchKitHandler = async (req, res, next) => {
  try {
    const kit = await patchKit(req.params.projectId, req.body);
    successResponse(res, kit);
  } catch (err) {
    next(err);
  }
};

export const approveHandler = async (req, res, next) => {
  try {
    const kit = await approveKit(req.params.projectId, req.body);
    successResponse(res, kit);
  } catch (err) {
    next(err);
  }
};

export const reopenHandler = async (req, res, next) => {
  try {
    const kit = await reopenKit(req.params.projectId);
    successResponse(res, kit);
  } catch (err) {
    next(err);
  }
};

export const getTokensHandler = async (req, res, next) => {
  try {
    // D-BK-6: tokens shaped for POST /api/theme-engine/values; orchestrator writes
    const payload = await getTokens(req.params.projectId, req.query.platform);
    successResponse(res, payload);
  } catch (err) {
    next(err);
  }
};
