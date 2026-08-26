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
  renderGuidelines,
} from './service.js';
import { getContactFields, saveContactFields } from './contact-fields.js';

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
    const kit = await inferBrandKit(req.params.projectId, {
      ...(req.body ?? {}),
      // Credits idempotency transport (KDL-506 pattern): header passed
      // verbatim into the hold; the service generates one when absent.
      idempotencyKey: req.get('X-Idempotency-Key') ?? undefined,
      userId: req.user?.id ?? null,
    });
    successResponse(res, kit);
  } catch (err) {
    next(err);
  }
};

export const patchKitHandler = async (req, res, next) => {
  try {
    const kit = await patchKit(req.params.projectId, req.validated.body);
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

export const renderGuidelinesHandler = async (req, res, next) => {
  try {
    const idempotencyKey = req.get('X-Idempotency-Key') ?? undefined;
    const result = await renderGuidelines(req.params.projectId, {
      idempotencyKey,
      actorId: req.user?.id ?? null,
    });
    successResponse(res, result, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const getContactFieldsHandler = async (req, res, next) => {
  try {
    const fields = await getContactFields(req.params.projectId);
    successResponse(res, { fields });
  } catch (err) {
    next(err);
  }
};

export const saveContactFieldsHandler = async (req, res, next) => {
  try {
    const fields = await saveContactFields(req.params.projectId, req.validated.body, req.user?.id ?? null);
    successResponse(res, { fields });
  } catch (err) {
    next(err);
  }
};
