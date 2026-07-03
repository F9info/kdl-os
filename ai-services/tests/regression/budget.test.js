import { describe, it, expect, vi, beforeEach } from 'vitest';
import { redis } from '../../src/config/redis.js';
import { checkBudget, recordSpend, getBudgetStatus } from '../../src/orchestrator/budget-tracker.js';

vi.mock('../../src/config/redis.js', () => ({
  redis: {
    get: vi.fn(),
    multi: vi.fn(),
  },
}));

const redisMock = vi.mocked(redis, { deep: true });

const mockExec = vi.fn();
const mockIncrbyfloat = vi.fn();
const mockExpire = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  redis.multi.mockReturnValue({
    incrbyfloat: mockIncrbyfloat.mockReturnThis(),
    expire: mockExpire.mockReturnThis(),
    exec: mockExec,
  });
});

describe('budget tracker', () => {
  it('returns false when daily budget is exhausted', async () => {
    redisMock.get.mockResolvedValue('2.00');
    const ok = await checkBudget();
    expect(ok).toBe(false);
  });

  it('records spend with an expiring key', async () => {
    mockExec.mockResolvedValue(['1.50', 1]);
    await recordSpend(0.50);
    expect(redis.multi).toHaveBeenCalled();
    expect(mockExpire).toHaveBeenCalledWith(expect.stringContaining('budget:openrouter:'), 86400);
  });

  it('reports remaining budget correctly', async () => {
    redisMock.get.mockResolvedValue('0.75');
    const status = await getBudgetStatus();
    expect(status.exhausted).toBe(false);
    expect(status.remaining).toBe(1.25);
  });
});
