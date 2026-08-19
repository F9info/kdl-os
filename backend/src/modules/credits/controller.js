import { successResponse, errorResponse } from '../../shared/utils/response.js';
import {
  getBalance,
  getLedger,
  getReconciliation,
  grantCredits,
  adjustCredits,
  forceReleaseHold,
  CreditError,
} from './service.js';

function serializeBigInts(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInts);
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = serializeBigInts(v);
    return out;
  }
  return obj;
}

export const getProjectBalance = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const data = await getBalance(projectId);
    successResponse(res, serializeBigInts(data));
  } catch (err) {
    if (err instanceof CreditError) return errorResponse(res, err.message, err.status ?? 400, { code: err.code });
    next(err);
  }
};

export const getProjectLedger = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { cursor, limit, entry_type, from, to } = req.validated?.query ?? req.query;
    const data = await getLedger(projectId, { cursor, limit, entry_type, from, to });
    successResponse(res, serializeBigInts(data));
  } catch (err) {
    if (err instanceof CreditError) return errorResponse(res, err.message, err.status ?? 400, { code: err.code });
    next(err);
  }
};

export const getProjectReconciliation = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const data = await getReconciliation(projectId);
    successResponse(res, serializeBigInts(data));
  } catch (err) {
    next(err);
  }
};

export const postGrant = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { amount_mc, source, reason, idempotency_key, metadata } = req.validated?.body ?? req.body;
    const data = await grantCredits({
      projectId,
      amountMc: amount_mc,
      source,
      reason,
      idempotencyKey: idempotency_key,
      actorId: req.user?.id ?? null,
      metadata,
    });
    successResponse(res, serializeBigInts(data), 201);
  } catch (err) {
    if (err instanceof CreditError) return errorResponse(res, err.message, err.status ?? 400, { code: err.code });
    next(err);
  }
};

export const postAdjustment = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { amount_mc, source, reason, idempotency_key, metadata } = req.validated?.body ?? req.body;
    const data = await adjustCredits({
      projectId,
      amountMc: amount_mc,
      source,
      reason,
      idempotencyKey: idempotency_key,
      actorId: req.user?.id ?? null,
      metadata,
    });
    successResponse(res, serializeBigInts(data), 201);
  } catch (err) {
    if (err instanceof CreditError) return errorResponse(res, err.message, err.status ?? 400, { code: err.code });
    next(err);
  }
};

export const postForceRelease = async (req, res, next) => {
  try {
    const { holdId } = req.params;
    const data = await forceReleaseHold({ holdId, actorId: req.user?.id ?? null });
    successResponse(res, serializeBigInts(data));
  } catch (err) {
    if (err instanceof CreditError) return errorResponse(res, err.message, err.status ?? 400, { code: err.code });
    next(err);
  }
};
