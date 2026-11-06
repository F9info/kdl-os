import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ openrouterEmbed: vi.fn(), checkBudget: vi.fn() }));
vi.mock('../src/brains/openrouter.js', () => ({ openrouterEmbed: m.openrouterEmbed }));
vi.mock('../src/orchestrator/budget-tracker.js', () => ({ checkBudget: m.checkBudget }));
vi.mock('../src/utils/logger.js', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { embedController } from '../src/controllers/embed.js';

const res = () => {
  const r = {};
  r.status = vi.fn((c) => ((r.code = c), r));
  r.json = vi.fn((b) => ((r.body = b), r));
  return r;
};

beforeEach(() => vi.clearAllMocks());

describe('embedController budget gate', () => {
  it('503s without calling the provider when the daily budget is exhausted', async () => {
    m.checkBudget.mockResolvedValue(false);
    const r = res();
    await embedController({ body: { text: 'hi' } }, r);
    expect(r.code).toBe(503);
    expect(m.openrouterEmbed).not.toHaveBeenCalled();
  });

  it('embeds when budget remains', async () => {
    m.checkBudget.mockResolvedValue(true);
    m.openrouterEmbed.mockResolvedValue([0.1, 0.2]);
    const r = res();
    await embedController({ body: { text: 'hi' } }, r);
    expect(r.body.data).toEqual({ embedding: [0.1, 0.2], dimensions: 2 });
  });
});
