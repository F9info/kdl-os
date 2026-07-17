import { z } from 'zod';
import { openrouterTranscribe } from '../brains/openrouter.js';
import { scrubInput } from '../governance/compliance.js';
import { auditLogger } from '../governance/audit-logger.js';
import { checkBudget, recordSpend } from '../orchestrator/budget-tracker.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logger } from '../utils/logger.js';

// Whisper-supported container formats
const FILENAME_RE = /^[\w][\w.\-]*\.(flac|m4a|mp3|mp4|mpeg|mpga|oga|ogg|wav|webm)$/i;

// Base64 of 7MB is ~9.4MB — stays under the 10mb express.json body limit
const MAX_AUDIO_BYTES = 7 * 1024 * 1024;

const transcribeSchema = z.object({
  audio: z.string().min(1).regex(/^[A-Za-z0-9+/]+={0,2}$/, 'must be base64'),
  filename: z.string().regex(FILENAME_RE, 'unsupported audio format').default('audio.webm'),
  language: z.string().min(2).max(8).optional(),
  sessionId: z.string().min(1).max(128).optional(),
});

export async function transcribeController(req, res) {
  try {
    const parsed = transcribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 'Validation error', 400, parsed.error.flatten().fieldErrors);
    }

    const { audio, filename, language, sessionId } = parsed.data;

    const audioBuffer = Buffer.from(audio, 'base64');
    if (audioBuffer.length === 0) {
      return errorResponse(res, 'Audio payload is empty', 400);
    }
    if (audioBuffer.length > MAX_AUDIO_BYTES) {
      return errorResponse(res, `Audio exceeds ${MAX_AUDIO_BYTES / (1024 * 1024)}MB limit`, 413);
    }

    if (!(await checkBudget())) {
      return errorResponse(res, 'AI budget exhausted for today. Try again tomorrow.', 503);
    }

    const result = await openrouterTranscribe(audioBuffer, filename, { language });
    const transcript = scrubInput(result.text);

    await recordSpend(result.cost);
    await auditLogger({
      model: result.model,
      priority: 'MEDIUM',
      input_tokens: 0,
      output_tokens: 0,
      cost_estimate: result.cost,
      session_id: sessionId ?? null,
    });

    return successResponse(res, {
      transcript,
      language: result.language,
      duration: result.duration,
    });
  } catch (err) {
    // Upstream provider errors can leak internals — log server-side only.
    logger.error('transcription failed', { message: err.message, stack: err.stack });
    return errorResponse(res, 'Transcription failed', 500);
  }
}
