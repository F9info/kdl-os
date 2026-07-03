import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.OPENROUTER_DAILY_BUDGET = '2.00';

vi.mock('../src/config/redis.js', () => ({
  redis: {
    get: vi.fn(),
    multi: vi.fn(),
  },
}));

import { redis } from '../src/config/redis.js';
import {
  checkBudget,
  recordSpend,
  getBudgetStatus,
} from '../src/orchestrator/budget-tracker.js';

const redisMock = vi.mocked(redis, { deep: true });

describe('budget-tracker regression', () => {
  const pipelineMock = {
    incrbyfloat: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    redis.multi.mockReturnValue(pipelineMock);
  });

  it('returns true when spent is below daily budget', async () => {
    redisMock.get.mockResolvedValue('1.50');
    await expect(checkBudget()).resolves.toBe(true);
  });

  it('returns false when budget is exhausted', async () => {
    redisMock.get.mockResolvedValue('2.00');
    await expect(checkBudget()).resolves.toBe(false);
  });

  it('records spend with INCRBYFLOAT + EXPIRE and returns remaining budget', async () => {
    redisMock.get.mockResolvedValue('0.50');
    pipelineMock.exec.mockResolvedValue([['OK'], ['OK']]);

    await recordSpend(0.25);
    await expect(getBudgetStatus()).resolves.toMatchObject({
      spent: 0.5,
      limit: 2,
      remaining: 1.5,
      exhausted: false,
    });

    expect(redis.multi).toHaveBeenCalledOnce();
    expect(pipelineMock.incrbyfloat).toHaveBeenCalledOnce();
    expect(pipelineMock.expire).toHaveBeenCalledOnce();
  });
});
