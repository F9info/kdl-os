import { z } from 'zod';
import { openrouterEmbed } from '../brains/openrouter.js';
import { successResponse, errorResponse } from '../utils/response.js';

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
    return errorResponse(res, err.message ?? 'Embed failed', 500);
  }
}
