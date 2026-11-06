import { z } from 'zod';
import { openrouterEmbed } from '../brains/openrouter.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { checkBudget } from '../orchestrator/budget-tracker.js';
import { logger } from '../utils/logger.js';

const embedSchema = z.object({
  text: z.string().min(1).max(8192),
});

export async function embedController(req, res) {
  try {
    const parsed = embedSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 'Validation error', 400, parsed.error.flatten().fieldErrors);
    }

    if (!(await checkBudget())) {
      return errorResponse(res, 'AI budget exhausted for today. Try again tomorrow.', 503);
    }

    const embedding = await openrouterEmbed(parsed.data.text);
    return successResponse(res, { embedding, dimensions: embedding.length });
  } catch (err) {
    // Upstream provider errors can leak internals — log server-side only.
    logger.error('embed failed', { message: err.message, stack: err.stack });
    return errorResponse(res, 'Embed failed', 500);
  }
}
