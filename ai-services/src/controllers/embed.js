import { z } from 'zod';
import { openrouterEmbed } from '../brains/openrouter.js';
import { successResponse, errorResponse } from '../utils/response.js';
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

    const embedding = await openrouterEmbed(parsed.data.text);
    return successResponse(res, { embedding, dimensions: embedding.length });
  } catch (err) {
    logger.error('embed error', { message: err.message, stack: err.stack });
    return errorResponse(res, 'Internal server error', 500);
  }
}
