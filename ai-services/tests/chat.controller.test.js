/**
 * Chat controller hardening: the client may not choose a Claude-tier priority
 * unless admin, conversation history is scoped to the authenticated user, and
 * the budget-exhausted note can't inject lines into MANUAL_TASKS.md.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { ragChain, appendFile } = vi.hoisted(() => ({ ragChain: vi.fn(), appendFile: vi.fn() }));
vi.mock('../src/chains/rag-chain.js', () => ({ ragChain }));
vi.mock('fs/promises', () => ({ appendFile }));
vi.mock('../src/utils/logger.js', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { chatController, effectivePriority } from '../src/controllers/chat.js';

const mockRes = () => {
  const res = { statusCode: 200, jsonBody: null };
  res.status = vi.fn((c) => ((res.statusCode = c), res));
  res.json = vi.fn((b) => ((res.jsonBody = b), res));
  return res;
};
const req = (over = {}) => ({
  body: { message: 'hello', sessionId: 's1', priority: 'MEDIUM' },
  user: { userId: 'u1', roles: ['user'] },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  appendFile.mockResolvedValue(undefined);
  ragChain.mockResolvedValue({ content: 'hi' });
});

describe('effectivePriority', () => {
  it('clamps CRITICAL/HIGH to MEDIUM for non-admins', () => {
    expect(effectivePriority('HIGH', ['user'])).toBe('MEDIUM');
    expect(effectivePriority('CRITICAL', [])).toBe('MEDIUM');
    expect(effectivePriority('HIGH', undefined)).toBe('MEDIUM');
  });
  it('leaves MEDIUM/LOW alone and lets admins use HIGH', () => {
    expect(effectivePriority('LOW', ['user'])).toBe('LOW');
    expect(effectivePriority('HIGH', ['admin'])).toBe('HIGH');
    expect(effectivePriority('CRITICAL', ['super-admin'])).toBe('CRITICAL');
  });
});

describe('chatController', () => {
  it('a normal user asking for HIGH reaches the chain as MEDIUM', async () => {
    await chatController(req({ body: { message: 'x', sessionId: 's1', priority: 'HIGH' } }), mockRes());
    expect(ragChain.mock.calls[0][2]).toBe('MEDIUM');
  });

  it("scopes the session to the user so ids can't collide across users", async () => {
    await chatController(req({ user: { userId: 'alice', roles: [] } }), mockRes());
    await chatController(req({ user: { userId: 'bob', roles: [] } }), mockRes());
    expect(ragChain.mock.calls[0][1]).toBe('alice:s1');
    expect(ragChain.mock.calls[1][1]).toBe('bob:s1');
  });

  it('returns the client-facing sessionId unchanged', async () => {
    const res = mockRes();
    await chatController(req(), res);
    expect(res.jsonBody.data.sessionId).toBe('s1');
  });

  it('rejects a token with no user id', async () => {
    const res = mockRes();
    await chatController(req({ user: { roles: ['admin'] } }), res);
    expect(res.statusCode).toBe(401);
    expect(ragChain).not.toHaveBeenCalled();
  });

  it('writes the deferred-task note as a single line (no markdown injection)', async () => {
    ragChain.mockResolvedValue({ error: 'BUDGET_EXHAUSTED' });
    const res = mockRes();
    await chatController(
      req({ body: { message: 'a\n## Injected heading\n- fake task', sessionId: 's\n1', priority: 'LOW' } }),
      res
    );
    expect(res.statusCode).toBe(503);
    const written = appendFile.mock.calls[0][1];
    expect(written.trim().split('\n')).toHaveLength(1);
    expect(written).toContain('## Injected heading'); // text is kept, just not on its own line
  });

  it('scopes retrieval to the tenant from the verified token, never from the body', async () => {
    const res = mockRes();
    await chatController(
      req({ body: { message: 'hello', sessionId: 's1', tenantId: 'victim', tenant_id: 'victim' } }),
      res
    );
    expect(ragChain.mock.calls[0][3]).toEqual({ tenantId: 'user:u1', actor: 'u1' });
  });

  it('uses a signed tenantId claim when the token has one', async () => {
    const res = mockRes();
    await chatController(req({ user: { userId: 'u1', roles: ['user'], tenantId: 'org-7' } }), res);
    expect(ragChain.mock.calls[0][3]).toEqual({ tenantId: 'org-7', actor: 'u1' });
  });
});
