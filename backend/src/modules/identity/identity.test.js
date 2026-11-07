import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const prismaMock = vi.hoisted(() => ({
  appSetting: { findMany: vi.fn(), upsert: vi.fn((a) => a) },
  $transaction: vi.fn(async (ops) => ops),
}));
const redisMock = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }));
vi.mock('../../config/database.js', () => ({ prisma: prismaMock }));
const storageMock = vi.hoisted(() => ({ getFileUrl: vi.fn(async (p) => `https://cdn.test/${p}?sig=1`) }));
vi.mock('../../shared/services/storage.service.js', () => storageMock);
vi.mock('../../config/redis.js', () => ({ redis: redisMock }));
vi.mock('../user-management/shared/activity-logger.js', () => ({
  writeActivity: vi.fn(),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));
// Auth wiring stubs: x-user header = logged in, x-perm header = has the permission.
vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) =>
    req.headers['x-user'] ? ((req.user = { id: 'u1' }), next()) : res.status(401).json({ success: false }),
}));
vi.mock('../../middleware/permission.js', () => ({
  requirePermission: () => (req, res, next) => (req.headers['x-perm'] ? next() : res.status(403).json({ success: false })),
}));

import router, { publicRouter } from './routes.js';
import { IDENTITY_KEYS, updateIdentitySchema } from './schema.js';
import { getIdentity, getAppConfig, updateIdentity, CACHE_KEY, RAW_CACHE_KEY } from './service.js';
import { writeActivity } from '../user-management/shared/activity-logger.js';

const app = express();
app.use(express.json());
app.use('/api/identity', router);
app.use('/api/app-config', publicRouter);
app.use((err, req, res, _next) => res.status(500).json({ success: false, message: err.message }));

beforeEach(() => {
  vi.clearAllMocks();
  redisMock.get.mockResolvedValue(null);
  prismaMock.appSetting.findMany.mockResolvedValue([]);
});

describe('public GET /api/app-config', () => {
  it('needs no auth and returns every identity field (empty defaults)', async () => {
    const res = await request(app).get('/api/app-config');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data.identity).sort()).toEqual([...IDENTITY_KEYS].sort());
    expect(res.body.data.identity.app_name).toBe('');
  });

  it('is revalidated on every request, so an Identity edit never shows stale for a minute', async () => {
    const res = await request(app).get('/api/app-config');
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('never leaks stray identity.* rows or non-identity settings (whitelist)', async () => {
    prismaMock.appSetting.findMany.mockResolvedValue([
      { key: 'identity.app_name', value: 'Acme' },
      { key: 'identity.smtp_password', value: 'hunter2' },
      { key: 'identity.', value: 'x' },
    ]);
    const res = await request(app).get('/api/app-config');
    expect(res.body.data.identity.app_name).toBe('Acme');
    expect(JSON.stringify(res.body)).not.toMatch(/hunter2|smtp_password/);
    expect(Object.keys(res.body.data.identity)).toHaveLength(IDENTITY_KEYS.length);
  });
});

describe('admin routes', () => {
  it('PUT: 401 without auth, 403 without permission, 200 with both', async () => {
    expect((await request(app).put('/api/identity').send({ app_name: 'A' })).status).toBe(401);
    expect((await request(app).put('/api/identity').set('x-user', '1').send({ app_name: 'A' })).status).toBe(403);
    const ok = await request(app).put('/api/identity').set('x-user', '1').set('x-perm', '1').send({ app_name: 'A' });
    expect(ok.status).toBe(200);
    expect(writeActivity).toHaveBeenCalledWith(expect.objectContaining({ module: 'identity', properties: { fields: ['app_name'] } }));
  });

  it('GET returns raw paths plus resolved preview URLs for the assets only', async () => {
    prismaMock.appSetting.findMany.mockResolvedValue([{ key: 'identity.logo_light', value: 'settings/abc.png' }]);
    const res = await request(app).get('/api/identity').set('x-user', '1').set('x-perm', '1');
    expect(res.body.data.identity.logo_light).toBe('settings/abc.png');
    expect(res.body.data.resolved).toEqual({
      logo_light: 'https://cdn.test/settings/abc.png?sig=1',
      logo_dark: '',
      favicon: '',
      company_logo_light: '',
      company_logo_dark: '',
    });
  });

  it('GET: requires auth and permission', async () => {
    expect((await request(app).get('/api/identity')).status).toBe(401);
    expect((await request(app).get('/api/identity').set('x-user', '1')).status).toBe(403);
    expect((await request(app).get('/api/identity').set('x-user', '1').set('x-perm', '1')).status).toBe(200);
  });

  it('PUT rejects unknown fields with 422', async () => {
    const res = await request(app).put('/api/identity').set('x-user', '1').set('x-perm', '1').send({ evil: 'x' });
    expect(res.status).toBe(422);
  });
});

describe('validation', () => {
  const ok = (body) => updateIdentitySchema.safeParse({ body }).success;
  it.each([
    [{ brand_primary: '#fff' }, true],
    [{ brand_primary: '#12ab9F' }, true],
    [{ brand_primary: 'red' }, false],
    [{ brand_primary: '' }, true],
    [{ logo_light: '/media/a.png' }, true],
    [{ logo_light: 'https://x.com/a.png' }, true],
    [{ logo_light: 'javascript:alert(1)' }, false],
    [{ logo_light: '//evil.com/a.png' }, false],
    [{ logo_light: 'settings/3f2a-uuid.png' }, true],
    [{ logo_dark: 'a/../../etc/passwd' }, false],
    [{ favicon: 'C:\\x.ico' }, false],
    [{ favicon: 'data:image/png;base64,AAA' }, false],
    [{ contact_email: 'a@b.com' }, true],
    [{ contact_email: 'nope' }, false],
    [{ app_name: 'x'.repeat(101) }, false],
    [{ social_x: 'ftp://x' }, false],
  ])('%j -> %s', (body, expected) => expect(ok(body)).toBe(expected));
});

describe('service cache', () => {
  it('serves from cache without hitting the DB', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify({ app_name: 'Cached' }));
    expect(await getIdentity()).toEqual({ app_name: 'Cached' });
    expect(prismaMock.appSetting.findMany).not.toHaveBeenCalled();
  });

  it('falls back to DB when Redis throws', async () => {
    redisMock.get.mockRejectedValue(new Error('down'));
    redisMock.set.mockRejectedValue(new Error('down'));
    prismaMock.appSetting.findMany.mockResolvedValue([{ key: 'identity.app_name', value: 'Acme' }]);
    expect((await getIdentity()).app_name).toBe('Acme');
  });

  it('update upserts under identity.* keys and invalidates the cache', async () => {
    await updateIdentity({ app_name: 'New', logo_light: '' });
    const keys = prismaMock.appSetting.upsert.mock.calls.map(([a]) => a.where.key).sort();
    expect(keys).toEqual(['identity.app_name', 'identity.logo_light']);
    expect(redisMock.del).toHaveBeenCalledWith(RAW_CACHE_KEY, CACHE_KEY);
  });

  it('update ignores keys outside the whitelist', async () => {
    await updateIdentity({ app_name: 'N', bogus: 'x' });
    expect(prismaMock.appSetting.upsert).toHaveBeenCalledTimes(1);
  });
});

describe('asset resolution (presigned URLs expire, so paths are resolved at read time)', () => {
  beforeEach(() => {
    prismaMock.appSetting.findMany.mockResolvedValue([
      { key: 'identity.logo_light', value: 'settings/abc.png' },
      { key: 'identity.logo_dark', value: 'https://x.com/d.png' },
      { key: 'identity.favicon', value: '/fav.ico' },
    ]);
  });

  it('public app-config resolves storage paths to fresh URLs and leaves URLs/paths alone', async () => {
    const c = await getAppConfig();
    expect(c.logo_light).toBe('https://cdn.test/settings/abc.png?sig=1');
    expect(c.logo_dark).toBe('https://x.com/d.png');
    expect(c.favicon).toBe('/fav.ico');
    expect(storageMock.getFileUrl).toHaveBeenCalledTimes(1);
  });

  it('admin identity keeps the raw storage path so edits round-trip', async () => {
    expect((await getIdentity()).logo_light).toBe('settings/abc.png');
  });

  it('a failed resolve yields an empty string, not an error', async () => {
    storageMock.getFileUrl.mockRejectedValueOnce(new Error('storage down'));
    expect((await getAppConfig()).logo_light).toBe('');
  });
});

describe('POST /api/identity/upload (own route: needs settings:edit, not setting-fields:edit)', () => {
  beforeEach(() => {
    storageMock.uploadFile = vi.fn(async () => {});
  });
  const png = Buffer.from('89504e470d0a1a0a', 'hex');

  it('requires login and settings:edit', async () => {
    expect((await request(app).post('/api/identity/upload')).status).toBe(401);
    expect((await request(app).post('/api/identity/upload').set('x-user', '1')).status).toBe(403);
  });

  it('stores an image under identity/ and returns path + preview url', async () => {
    const res = await request(app)
      .post('/api/identity/upload')
      .set({ 'x-user': '1', 'x-perm': '1' })
      .attach('file', png, { filename: 'logo.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.data.path).toMatch(/^identity\/[0-9a-f-]+\.png$/);
    expect(res.body.data.url).toContain(res.body.data.path);
    expect(storageMock.uploadFile).toHaveBeenCalledTimes(1);
  });

  it('rejects non-images (incl. SVG) and a missing file with 400, storing nothing', async () => {
    const h = { 'x-user': '1', 'x-perm': '1' };
    for (const [name, type] of [['a.svg', 'image/svg+xml'], ['a.html', 'text/html']]) {
      const res = await request(app).post('/api/identity/upload').set(h).attach('file', Buffer.from('x'), { filename: name, contentType: type });
      expect(res.status).toBe(400);
    }
    expect((await request(app).post('/api/identity/upload').set(h)).status).toBe(400);
    expect(storageMock.uploadFile).not.toHaveBeenCalled();
  });

  it('rejects images over 2 MB', async () => {
    const res = await request(app)
      .post('/api/identity/upload')
      .set({ 'x-user': '1', 'x-perm': '1' })
      .attach('file', Buffer.alloc(2 * 1024 * 1024 + 1), { filename: 'big.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
  });
});
