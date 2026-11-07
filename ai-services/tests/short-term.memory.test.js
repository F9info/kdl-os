import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/redis.js', () => ({
  redis: {
    scan: vi.fn(),
    del: vi.fn(),
  },
}));

import { redis } from '../src/config/redis.js';
import { clearSessionMemory } from '../src/memory/short-term.js';

const redisMock = vi.mocked(redis, { deep: true });

describe('short-term memory regression — SCAN cursor loop (KDL-26 M2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('iterates SCAN until cursor returns 0 and deletes batched keys', async () => {
    redisMock.scan
      .mockResolvedValueOnce(['3', ['mem:short:t1:s1:a']])
      .mockResolvedValueOnce(['0', ['mem:short:t1:s1:b', 'mem:short:t1:s1:c']]);

    await clearSessionMemory('t1', 's1');

    expect(redisMock.scan).toHaveBeenCalledTimes(2);
    expect(redisMock.scan).toHaveBeenNthCalledWith(
      1,
      '0',
      'MATCH',
      'mem:short:t1:s1:*',
      'COUNT',
      100
    );
    expect(redisMock.del).toHaveBeenCalledTimes(2);
    expect(redisMock.del).toHaveBeenNthCalledWith(1, ['mem:short:t1:s1:a']);
    expect(redisMock.del).toHaveBeenNthCalledWith(2, ['mem:short:t1:s1:b', 'mem:short:t1:s1:c']);
  });
});
