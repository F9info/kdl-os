import { z } from 'zod';
import { ragChain } from '../chains/rag-chain.js';
import { scrubMessages } from '../governance/compliance.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { appendFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { join } from 'path';

const __dir = fileURLToPath(new URL('.', import.meta.url));
const MANUAL_TASKS_PATH = join(__dir, '../../../MANUAL_TASKS.md');

const chatSchema = z.object({
  message: z.string().min(1).max(32768),
  sessionId: z.string().min(1).max(128),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
});

export async function chatController(req, res) {
  try {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 'Validation error', 400, parsed.error.flatten().fieldErrors);
    }

    const { message, sessionId, priority } = parsed.data;
    const scrubbed = scrubMessages(message);

    const response = await ragChain(scrubbed, sessionId, priority);

    if (response.error === 'BUDGET_EXHAUSTED') {
      const line = `\n- [${new Date().toISOString()}] Chat task deferred (budget exhausted). Session: ${sessionId}. Message: ${scrubbed.slice(0, 100)}\n`;
      await appendFile(MANUAL_TASKS_PATH, line).catch(() => {});
      return errorResponse(res, 'AI budget exhausted for today. Task logged to MANUAL_TASKS.md.', 503);
    }

    return successResponse(res, { response: response.content, sessionId });
  } catch (err) {
    return errorResponse(res, err.message ?? 'Chat failed', 500);
  }
}
