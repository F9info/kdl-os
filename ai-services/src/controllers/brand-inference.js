import { brandInferenceRequestSchema } from '../services/brand-inference-schemas.js';
import { inferBrandIdentity } from '../services/brand-inference.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logger } from '../utils/logger.js';

// POST /api/ai/brand-inference (KDL-471 §4.3 / KDL-510).
// Provider failure is not an HTTP error: the service degrades to
// source:'fallback' internally, so anything reaching the catch is a real bug.
export async function brandInferenceController(req, res) {
  try {
    const parsed = brandInferenceRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 'Validation error', 400, parsed.error.flatten().fieldErrors);
    }

    const input = parsed.data;
    const envelope = await inferBrandIdentity(input, {
      sessionId: `brand-kit:${input.projectId}`,
    });

    return successResponse(res, envelope);
  } catch (err) {
    // Upstream provider errors can carry API keys or internal URLs — log
    // server-side, return a generic message.
    logger.error('brand-inference failed', { message: err.message, stack: err.stack });
    return errorResponse(res, 'Brand inference failed', 500);
  }
}
