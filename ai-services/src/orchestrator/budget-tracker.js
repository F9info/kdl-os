import { redis } from '../config/redis.js';

const DAILY_BUDGET = parseFloat(process.env.OPENROUTER_DAILY_BUDGET ?? '2.00');

function todayKey() {
  return `budget:openrouter:${new Date().toISOString().slice(0, 10)}`;
}

function claudeKey() {
  return `budget:claude:${new Date().toISOString().slice(0, 10)}`;
}

// Claude is capped per day. Unset means this default, not "no cap".
const CLAUDE_DAILY_BUDGET = parseFloat(process.env.CLAUDE_DAILY_BUDGET ?? '20.00');

// Atomic check-and-add in one Redis step. Two calls arriving together cannot both see "room left":
// each adds its worst-case estimate first, and the one that would pass the limit is refused.
const RESERVE_LUA = `
local cur = tonumber(redis.call('GET', KEYS[1]) or '0')
if cur + tonumber(ARGV[1]) > tonumber(ARGV[2]) then return 0 end
redis.call('INCRBYFLOAT', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], 172800)
return 1`;

/** Reserve `estimate` USD of today's Claude budget. false = would exceed it (caller answers 503). */
export async function reserveClaudeBudget(estimate) {
  try {
    return (await redis.eval(RESERVE_LUA, 1, claudeKey(), String(estimate), String(CLAUDE_DAILY_BUDGET))) === 1;
  } catch {
    return true; // Redis down: do not take the product down; the call is still metered and audited.
  }
}

/** After the call: replace the reservation by the real cost (refund everything if the call failed: actual = 0). */
export async function settleClaudeSpend(reserved, actual) {
  await recordClaudeSpend(actual - reserved).catch(() => {});
}

/**
 * Claude (HIGH-tier) spend is metered in its own ledger and is NOT gated: HIGH work never waits on
 * the OpenRouter budget (policy), but its estimated cost must be visible in getBudgetStatus.
 */
export async function recordClaudeSpend(amount) {
  if (!amount) return;
  const key = claudeKey();
  const pipeline = redis.multi();
  pipeline.incrbyfloat(key, amount);
  pipeline.expire(key, 2 * 86400);
  await pipeline.exec();
}

export async function checkBudget() {
  const spent = parseFloat((await redis.get(todayKey())) ?? '0');
  return spent < DAILY_BUDGET;
}

export async function recordSpend(amount) {
  const key = todayKey();
  const pipeline = redis.multi();
  pipeline.incrbyfloat(key, amount);
  pipeline.expire(key, 86400);
  await pipeline.exec();
}

export async function getBudgetStatus() {
  const spent = parseFloat((await redis.get(todayKey())) ?? '0');
  return {
    spent: Math.round(spent * 10000) / 10000,
    limit: DAILY_BUDGET,
    remaining: Math.max(0, Math.round((DAILY_BUDGET - spent) * 10000) / 10000),
    exhausted: spent >= DAILY_BUDGET,
    claude_limit: CLAUDE_DAILY_BUDGET,
    claude_spent: Math.round(parseFloat((await redis.get(claudeKey())) ?? '0') * 10000) / 10000,
    date: new Date().toISOString().slice(0, 10),
  };
}
