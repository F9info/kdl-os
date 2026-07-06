import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── manifest-schema ─────────────────────────────────────────────────────────

import { manifestSchema } from '../src/shared/modules/manifest-schema.js';

describe('manifestSchema', () => {
  const valid = {
    slug: 'blog',
    name: 'Blog',
    version: '1.0.0',
    apiPrefix: '/api/blog',
    permissions: ['blog_posts'],
    nav: [{ label: 'Blog Posts', path: '/blog/posts', icon: 'FileText', permission: 'blog_posts:view' }],
    dependsOn: [],
    queues: [],
    env: [],
  };

  it('accepts a valid manifest', () => {
    const result = manifestSchema.safeParse(valid);
    expect(result.success).toBe(true);
    expect(result.data.core).toBe(false);
  });

  it('rejects slug with uppercase', () => {
    const result = manifestSchema.safeParse({ ...valid, slug: 'Blog' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid semver version', () => {
    const result = manifestSchema.safeParse({ ...valid, version: '1.0' });
    expect(result.success).toBe(false);
  });

  it('rejects apiPrefix without /api/ prefix', () => {
    const result = manifestSchema.safeParse({ ...valid, apiPrefix: '/blog' });
    expect(result.success).toBe(false);
  });

  it('rejects nav item with relative path', () => {
    const result = manifestSchema.safeParse({ ...valid, nav: [{ label: 'X', path: 'blog/posts' }] });
    expect(result.success).toBe(false);
  });

  it('defaults permissions/nav/dependsOn/queues/env to empty arrays', () => {
    const minimal = { slug: 'test', name: 'Test', version: '0.1.0', apiPrefix: '/api/test' };
    const result = manifestSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    expect(result.data.permissions).toEqual([]);
    expect(result.data.nav).toEqual([]);
  });
});

// ── moduleGate ───────────────────────────────────────────────────────────────

const cache = new Map();
vi.mock('../src/config/redis.js', () => ({
  redis: {
    get: vi.fn((key) => Promise.resolve(cache.get(key) ?? null)),
    set: vi.fn((key, value) => { cache.set(key, value); return Promise.resolve('OK'); }),
    del: vi.fn((key) => { cache.delete(key); return Promise.resolve(1); }),
  },
}));

vi.mock('../src/config/database.js', () => ({
  prisma: {
    module: { findUnique: vi.fn() },
  },
}));

import { redis } from '../src/config/redis.js';
import { prisma } from '../src/config/database.js';
import { moduleGate, getModuleStatus, invalidateModuleCache } from '../src/middleware/module-gate.js';

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('moduleGate', () => {
  beforeEach(() => {
    cache.clear();
    vi.clearAllMocks();
  });

  it('calls next() when module status is ENABLED', async () => {
    prisma.module.findUnique.mockResolvedValue({ status: 'ENABLED' });
    const next = vi.fn();
    const middleware = moduleGate('blog');
    await middleware({}, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 404 when module status is DISABLED', async () => {
    prisma.module.findUnique.mockResolvedValue({ status: 'DISABLED' });
    const next = vi.fn();
    const res = mockRes();
    await moduleGate('blog')({}, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 404 when module not in DB', async () => {
    prisma.module.findUnique.mockResolvedValue(null);
    const next = vi.fn();
    const res = mockRes();
    await moduleGate('unknown')({}, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('serves from Redis cache on second call', async () => {
    cache.set('module:status:blog', 'ENABLED');
    const next = vi.fn();
    await moduleGate('blog')({}, mockRes(), next);
    expect(prisma.module.findUnique).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('invalidateModuleCache removes key', async () => {
    cache.set('module:status:blog', 'ENABLED');
    await invalidateModuleCache('blog');
    expect(cache.has('module:status:blog')).toBe(false);
  });
});
