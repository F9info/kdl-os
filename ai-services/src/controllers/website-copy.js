import { websiteCopyRequestSchema } from '../services/website-copy-schemas.js';
import { generateWebsiteCopy } from '../services/website-copy.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logger } from '../utils/logger.js';

// POST /api/ai/website-copy — never a 500 for a provider/schema failure;
// { success: false } is a normal response, not an error (mirrors
// brand-inference's "degrades internally" posture, minus the F-code detail).
export async function websiteCopyController(req, res) {
  try {
    const parsed = websiteCopyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 'Validation error', 400, parsed.error.flatten().fieldErrors);
    }

    const envelope = await generateWebsiteCopy(parsed.data, {
      sessionId: `website-copy:${parsed.data.projectId}`,
    });

    return successResponse(res, envelope);
  } catch (err) {
    logger.error('website-copy failed', { message: err.message, stack: err.stack });
    return errorResponse(res, 'Website copy generation failed', 500);
  }
}
