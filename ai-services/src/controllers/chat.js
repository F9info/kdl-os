import { z } from 'zod';
import { ragChain } from '../chains/rag-chain.js';
import { scrubMessages } from '../governance/compliance.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logger } from '../utils/logger.js';
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

// Only these roles may pick Claude-tier priorities. Anyone else asking for
// CRITICAL/HIGH is clamped to MEDIUM — otherwise any logged-in user could force
// unlimited (unbudgeted) Claude calls just by sending `priority: "HIGH"`.
const PRIORITY_ROLES = new Set(['super-admin', 'admin']);
const HIGH_TIER = new Set(['CRITICAL', 'HIGH']);

export const effectivePriority = (requested, roles) =>
  HIGH_TIER.has(requested) && !(roles ?? []).some((r) => PRIORITY_ROLES.has(r))
    ? 'MEDIUM'
    : requested;

// One line, no markdown/newlines: this text is appended to a markdown task file.
const oneLine = (text) => String(text).replace(/\s+/g, ' ').trim();

export async function chatController(req, res) {
  try {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 'Validation error', 400, parsed.error.flatten().fieldErrors);
    }

    const { message, sessionId, priority: requestedPriority } = parsed.data;
    const userId = req.user?.userId ?? req.user?.sub;
    if (!userId) return errorResponse(res, 'Unauthorized', 401);
    const priority = effectivePriority(requestedPriority, req.user?.roles);
    const scrubbed = scrubMessages(message);

    // History is keyed per user: a client-chosen sessionId alone must never let one
    // user read or poison another user's conversation.
    const response = await ragChain(scrubbed, `${userId}:${sessionId}`, priority);

    if (response.error === 'BUDGET_EXHAUSTED') {
      const line = `\n- [${new Date().toISOString()}] Chat task deferred (budget exhausted). Session: ${oneLine(sessionId)}. Message: ${oneLine(scrubbed).slice(0, 100)}\n`;
      await appendFile(MANUAL_TASKS_PATH, line).catch(() => {});
      return errorResponse(res, 'AI budget exhausted for today. Task logged to MANUAL_TASKS.md.', 503);
    }

    return successResponse(res, { response: response.content, sessionId });
  } catch (err) {
    // Upstream provider errors can carry API keys, quota details, or internal
    // URLs — log server-side, return a generic message.
    logger.error('chat failed', { message: err.message, stack: err.stack });
    return errorResponse(res, 'Chat failed', 500);
  }
}
