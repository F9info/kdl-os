/**
 * Chroma tenant isolation (owner-decision item 4): one collection per tenant, no shared fallback,
 * tenant taken from the verified JWT only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  chroma: { getOrCreateCollection: vi.fn() },
  openrouterEmbed: vi.fn(),
}));
vi.mock('../src/config/chroma.js', () => ({ chroma: m.chroma }));
vi.mock('../src/brains/openrouter.js', () => ({ openrouterEmbed: m.openrouterEmbed }));
vi.mock('p-limit', () => ({ default: () => (fn) => fn() }));

import { tenantCollectionName, tenantOf } from '../src/knowledge/tenant.js';
import { ingestDocument } from '../src/knowledge/ingest.js';
import { retrieveChunks } from '../src/knowledge/retrieve.js';
import { storeMemory, searchMemory, deleteMemory } from '../src/memory/long-term.js';
import { BaseAgent } from '../src/agents/base.js';

// One fake collection per name, so cross-tenant leakage would show up as shared state.
const stores = new Map();
beforeEach(() => {
  vi.clearAllMocks();
  stores.clear();
  m.openrouterEmbed.mockResolvedValue([0.1, 0.2]);
  m.chroma.getOrCreateCollection.mockImplementation(async ({ name }) => {
    if (!stores.has(name)) {
      const docs = [];
      stores.set(name, {
        docs,
        upsert: vi.fn(async ({ documents }) => docs.push(...documents)),
        delete: vi.fn(),
        query: vi.fn(async () => ({ documents: [docs.slice()], metadatas: [[]], distances: [[]] })),
      });
    }
    return stores.get(name);
  });
});

describe('tenantCollectionName', () => {
  it('is stable, distinct per tenant and per base, and always a valid Chroma name', () => {
    const a = tenantCollectionName('kdl_knowledge', 'user:1');
    expect(a).toBe(tenantCollectionName('kdl_knowledge', 'user:1'));
    expect(a).not.toBe(tenantCollectionName('kdl_knowledge', 'user:2'));
    expect(a).not.toBe(tenantCollectionName('kdl_long_term_memory', 'user:1'));
    expect(a).toMatch(/^[a-z0-9_]{3,63}$/);
  });

  it('a hostile tenant id cannot name another collection', () => {
    expect(tenantCollectionName('kdl_knowledge', '../kdl_knowledge')).toMatch(/^kdl_knowledge_[0-9a-f]{24}$/);
  });

  it.each([undefined, null, '', '   ', 42])('fails closed for tenant %j', (t) => {
    expect(() => tenantCollectionName('kdl_knowledge', t)).toThrow(/tenantId is required/);
  });
});

describe('tenantOf', () => {
  it('prefers a signed tenantId claim, else scopes to the caller, else undefined', () => {
    expect(tenantOf({ tenantId: 'org-1', userId: 'u1' })).toBe('org-1');
    expect(tenantOf({ userId: 'u1' })).toBe('user:u1');
    expect(tenantOf({ sub: 's1' })).toBe('user:s1');
    expect(tenantOf({ id: 'svc:brand-kit', service: true })).toBe('user:svc:brand-kit');
    expect(tenantOf({})).toBeUndefined();
    expect(tenantOf(undefined)).toBeUndefined();
  });
});

describe('knowledge base isolation', () => {
  it("tenant B never retrieves what tenant A ingested", async () => {
    await ingestDocument('secret plan of tenant A', {}, 'A');
    expect((await retrieveChunks('plan', 5, 'A')).map((c) => c.content)).toEqual(['secret plan of tenant A']);
    expect(await retrieveChunks('plan', 5, 'B')).toEqual([]);
    expect(stores.size).toBe(2);
  });

  it.each([
    ['ingest', () => ingestDocument('x', {})],
    ['retrieve', () => retrieveChunks('x', 5)],
    ['storeMemory', () => storeMemory('id', 'x', {})],
    ['searchMemory', () => searchMemory('x', 3)],
    ['deleteMemory', () => deleteMemory('id')],
  ])('%s without a tenant throws and touches no collection', async (_n, fn) => {
    await expect(fn()).rejects.toThrow(/tenantId is required/);
    expect(m.chroma.getOrCreateCollection).not.toHaveBeenCalled();
  });
});

describe('long-term memory isolation', () => {
  it('memories are per tenant, and the legacy shared collection names are never used', async () => {
    await storeMemory('m1', 'A remembers this', {}, 'A');
    expect((await searchMemory('x', 3, 'A')).map((r) => r.document)).toEqual(['A remembers this']);
    expect(await searchMemory('x', 3, 'B')).toEqual([]);
    const names = m.chroma.getOrCreateCollection.mock.calls.map((c) => c[0].name);
    expect(names).not.toContain('kdl_knowledge');
    expect(names).not.toContain('kdl_long_term_memory');
  });
});

describe('agents', () => {
  it('cannot be built without a tenant', () => {
    expect(() => new BaseAgent({ sessionId: 's' })).toThrow(/tenantId is required/);
  });
});
