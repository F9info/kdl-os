import { redis } from '../config/redis.js';

const DAILY_BUDGET = parseFloat(process.env.OPENROUTER_DAILY_BUDGET ?? '2.00');

function todayKey() {
  return `budget:openrouter:${new Date().toISOString().slice(0, 10)}`;
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
    date: new Date().toISOString().slice(0, 10),
  };
}
