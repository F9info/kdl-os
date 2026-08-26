// Collateral controller — COLLATERAL_SPEC.md §7.
import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { writeActivityAsync, getClientIp } from '../user-management/shared/activity-logger.js';
import * as service from './service.js';

export const listAssets = async (req, res, next) => {
  try {
    const assets = await service.listAssets(req.validated.query.projectId);
    return successResponse(res, { assets });
  } catch (err) {
    next(err);
  }
};

export const createAsset = async (req, res, next) => {
  try {
    const { projectId, type, name, brandKitVersion } = req.validated.body;
    const asset = await service.createAsset({ projectId, type, name, brandKitVersion, createdBy: req.user.id });
    writeActivityAsync({
      actor: req.user.id,
      module: 'collateral',
      action: 'asset_created',
      subject_type: 'CollateralAsset',
      subject_id: asset.id,
      description: `Created ${type} collateral asset "${name}" for project ${projectId}`,
      properties: { projectId, type },
      ip_address: getClientIp(req),
    });
    return successResponse(res, asset, 201);
  } catch (err) {
    next(err);
  }
};

export const getAsset = async (req, res, next) => {
  try {
    const asset = await service.getAsset(req.validated.params.id);
    return successResponse(res, asset);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const updateAsset = async (req, res, next) => {
  try {
    const asset = await service.updateAsset(req.validated.params.id, req.validated.body);
    return successResponse(res, asset);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const preflightAsset = async (req, res, next) => {
  try {
    const result = await service.preflightAsset(req.validated.params.id);
    return successResponse(res, result);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const renderAsset = async (req, res, next) => {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'] ?? null;
    const render = await service.renderAsset(req.validated.params.id, {
      format:         req.validated.body.format,
      variant:        req.validated.body.variant,
      idempotencyKey,
      actorId:        req.user.id,
    });

    writeActivityAsync({
      actor: req.user.id,
      module: 'collateral',
      action: 'asset_rendered',
      subject_type: 'CollateralRender',
      subject_id: render.id,
      description: `Rendered collateral asset ${req.validated.params.id} as ${req.validated.body.format}`,
      properties: { format: req.validated.body.format, variant: req.validated.body.variant },
      ip_address: getClientIp(req),
    });

    return successResponse(res, { renderId: render.id, fileUrl: render.file_url, bytes: render.bytes }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status, err.issues ?? null);
    next(err);
  }
};

export const downloadRender = async (req, res, next) => {
  try {
    const render = await service.getRender(req.validated.params.renderId);
    // In production: stream from storage. Phase 1: return metadata.
    return successResponse(res, {
      renderId: render.id,
      fileUrl:  render.file_url,
      format:   render.format,
      bytes:    render.bytes,
    });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const deleteAsset = async (req, res, next) => {
  try {
    await service.archiveAsset(req.validated.params.id);
    writeActivityAsync({
      actor: req.user.id,
      module: 'collateral',
      action: 'asset_archived',
      subject_type: 'CollateralAsset',
      subject_id: req.validated.params.id,
      description: `Archived collateral asset ${req.validated.params.id}`,
      properties: {},
      ip_address: getClientIp(req),
    });
    return successResponse(res, { ok: true });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
