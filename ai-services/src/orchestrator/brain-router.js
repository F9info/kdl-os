import { writeFile, readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { join } from 'path';
import { claudeBrain } from '../brains/claude.js';
import { openrouterBrain } from '../brains/openrouter.js';
import { checkBudget, recordSpend } from './budget-tracker.js';
import { auditLogger } from '../governance/audit-logger.js';

const __dir = fileURLToPath(new URL('.', import.meta.url));
const MANUAL_TASKS_PATH = join(__dir, '../../../MANUAL_TASKS.md');

const HIGH_PRIORITY = new Set(['CRITICAL', 'HIGH']);

const isImageBlock = (block) =>
  block && typeof block === 'object' && block.type === 'image';

/**
 * Multimodal input (Anthropic content blocks containing an image, either as a
 * bare block array or inside a message's content) must route to Claude:
 * openrouterBrain speaks OpenAI chat shapes and cannot carry these blocks
 * (KDL-488).
 */
function hasImageContent(task) {
  if (!Array.isArray(task)) return false;
  return task.some(
    (item) =>
      isImageBlock(item) ||
      (Array.isArray(item?.content) && item.content.some(isImageBlock)),
  );
}

export async function brainRouter(task, priority = 'MEDIUM', options = {}) {
  const useClaude =
    HIGH_PRIORITY.has(priority?.toUpperCase()) || hasImageContent(task);

  if (!useClaude) {
    const ok = await checkBudget();
    if (!ok) {
      return { error: 'BUDGET_EXHAUSTED', message: 'Daily OpenRouter budget exhausted. Add to MANUAL_TASKS.md.' };
    }
  }

  const response = useClaude
    ? await claudeBrain(task, options)
    : await openrouterBrain(task, options);

  try {
    await auditLogger({
      model: useClaude ? 'claude-sonnet-4-6' : (process.env.OPENROUTER_DEFAULT_MODEL ?? 'moonshot-ai/moonshot-v1-32k'),
      priority,
      input_tokens: response.usage?.input_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
      cost_estimate: response.cost ?? 0,
      session_id: options.sessionId ?? null,
    });
  } catch (auditErr) {
    try {
      let existing = '';
      try { existing = await readFile(MANUAL_TASKS_PATH, 'utf8'); } catch { /* file may not exist */ }
      const entry = `\n## ${new Date().toISOString()} — Audit log failure\nauditLogger failed in brainRouter (priority: ${priority}, session: ${options.sessionId ?? 'unknown'}). Error: ${auditErr.message}\n`;
      await writeFile(MANUAL_TASKS_PATH, existing + entry, 'utf8');
    } catch { /* non-fatal */ }
  }

  if (!useClaude && response.cost) {
    await recordSpend(response.cost);
  }

  return response;
}
