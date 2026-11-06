/**
 * Per-caller limits, role gates and spend metering (owner-decision item 3).
 *  - callerLimit keys on the caller, not the IP: one user hitting the cap does not block another
 *  - allow(): service JWT / admin roles only
 *  - Claude (HIGH) calls are metered in their own un-gated ledger
 *  - /embed honours the daily budget and OpenRouter embeds record their cost
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const redisMock = vi.hoisted(() => ({ get: vi.fn(), multi: vi.fn() }));
vi.mock('../src/config/redis.js', () => ({ redis: redisMock }));

import { callerLimit, allow } from '../src/middleware/caller-limit.js';
import { recordClaudeSpend, getBudgetStatus } from '../src/orchestrator/budget-tracker.js';

const asUser = (user) => (req, _res, next) => ((req.user = user), next());

describe('callerLimit', () => {
  it('limits per caller and returns 429 JSON, other callers are unaffected', async () => {
    process.env.AI_LIMIT_T1 = '2';
    const app = express();
    app.use((req, _res, next) => ((req.user = { userId: req.get('x-user') }), next()));
    app.post('/x', callerLimit('t1', 99), (_req, res) => res.json({ ok: true }));

    const hit = (u) => request(app).post('/x').set('x-user', u);
    expect((await hit('a')).status).toBe(200);
    expect((await hit('a')).status).toBe(200);
    const blocked = await hit('a');
    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
    expect((await hit('b')).status).toBe(200);
    delete process.env.AI_LIMIT_T1;
  });
});

describe('allow', () => {
  const run = (user, opts) => {
    const app = express();
    app.get('/x', asUser(user), allow(opts), (_req, res) => res.json({ ok: true }));
    return request(app).get('/x');
  };

  it('service token passes only when service is allowed', async () => {
    expect((await run({ id: 'svc:brand-kit', service: true }, { service: true })).status).toBe(200);
    expect((await run({ id: 'svc:brand-kit', service: true }, { roles: ['admin'] })).status).toBe(403);
  });

  it('plain users are refused; admin roles pass when listed', async () => {
    expect((await run({ userId: 'u', roles: ['editor'] }, { service: true, roles: ['admin'] })).status).toBe(403);
    expect((await run({ userId: 'u', roles: ['admin'] }, { service: true, roles: ['admin'] })).status).toBe(200);
    expect((await run({ userId: 'u' }, { service: true, roles: ['admin'] })).status).toBe(403);
  });

  it('a user token cannot claim service by any other field', async () => {
    expect((await run({ userId: 'u', service: 'true' }, { service: true })).status).toBe(403);
  });
});

describe('Claude spend ledger', () => {
  const pipeline = { incrbyfloat: vi.fn().mockReturnThis(), expire: vi.fn().mockReturnThis(), exec: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.multi.mockReturnValue(pipeline);
  });

  it('writes to budget:claude:<day>, separate from the OpenRouter key, and skips zero', async () => {
    await recordClaudeSpend(0.25);
    expect(pipeline.incrbyfloat).toHaveBeenCalledWith(expect.stringMatching(/^budget:claude:\d{4}-\d{2}-\d{2}$/), 0.25);
    vi.clearAllMocks();
    await recordClaudeSpend(0);
    expect(redisMock.multi).not.toHaveBeenCalled();
  });

  it('getBudgetStatus reports claude_spent and does not mark the OpenRouter budget exhausted by it', async () => {
    redisMock.get.mockImplementation(async (k) => (k.startsWith('budget:claude:') ? '9.5' : '0.5'));
    const s = await getBudgetStatus();
    expect(s.claude_spent).toBe(9.5);
    expect(s.exhausted).toBe(false);
  });
});
