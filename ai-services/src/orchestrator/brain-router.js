import { writeFile, readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { join } from 'path';
import { claudeBrain, claudeModel } from '../brains/claude.js';
import { openrouterBrain } from '../brains/openrouter.js';
import { checkBudget, recordSpend, reserveClaudeBudget, settleClaudeSpend } from './budget-tracker.js';
import { estimateCostUsd, rateFor } from '../config/model-pricing.js';
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

// Worst-case cost of a Claude call, before it runs: input at ~3 chars per token (images a flat 1600
// tokens, their base64 is not text) plus the full max_tokens as output.
function estimateClaudeMax(task, options) {
  const text = JSON.stringify(task ?? '', (k, v) => (k === 'data' && typeof v === 'string' && v.length > 1000 ? '' : v));
  const images = (text.match(/"type":"image"/g) || []).length;
  const inTok = Math.ceil((text.length + String(options.system ?? '').length) / 3) + images * 1600;
  const rate = rateFor(claudeModel());
  return (inTok * rate.in + (options.max_tokens ?? 4096) * rate.out) / 1_000_000;
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

  let reserved = 0;
  if (useClaude) {
    reserved = estimateClaudeMax(task, options);
    if (!(await reserveClaudeBudget(reserved))) {
      return { error: 'BUDGET_EXHAUSTED', message: 'Daily Claude budget exhausted.' };
    }
  }

  let response;
  try {
    response = useClaude ? await claudeBrain(task, options) : await openrouterBrain(task, options);
  } catch (err) {
    if (useClaude) await settleClaudeSpend(reserved, 0); // nothing was billed: give the reservation back
    throw err;
  }

  try {
    await auditLogger({
      model: useClaude ? (response.model ?? claudeModel()) : (process.env.OPENROUTER_DEFAULT_MODEL ?? 'moonshot-ai/moonshot-v1-32k'),
      priority,
      input_tokens: response.usage?.input_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
      cost_estimate: response.cost ?? 0,
      session_id: options.sessionId ?? null,
      actor: options.actor ?? null,
      tenant: options.tenantId ?? null,
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
  if (useClaude) {
    // Metering must never fail the call the user already paid for.
    await settleClaudeSpend(reserved, estimateCostUsd(response.model, response.usage)).catch(() => {});
  }

  return response;
}
