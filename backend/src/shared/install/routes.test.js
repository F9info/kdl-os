import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const TOKEN = 'unit-test-setup-token-1234567';
process.env.KDL_SETUP_TOKEN = TOKEN;

const h = vi.hoisted(() => ({
  installed: false,
  svc: {
    getState: vi.fn(),
    typeCatalog: vi.fn(async () => [{ key: 'landing' }]),
    saveLogo: vi.fn(async () => ({ path: 'identity/a.png' })),
    saveCompany: vi.fn(async () => ({ ok: 'company' })),
    saveType: vi.fn(async () => ({ ok: 'type' })),
    complete: vi.fn(async () => ({ installed: true })),
    selectedType: vi.fn(async () => 'landing'),
    currentType: vi.fn(),
    changeType: vi.fn(),
  },
  core: { saveAdmin: vi.fn(async (a) => ({ name: a.name, email: a.email })), runCore: vi.fn(async () => ({ status: 'done' })) },
}));
vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('./status.js', () => ({ isInstalled: async () => h.installed, getSetting: vi.fn(), setSetting: vi.fn() }));
vi.mock('./service.js', () => h.svc);
vi.mock('./modules.js', () => ({ moduleChoices: vi.fn(async (t) => ({ type: t })), saveModules: vi.fn(async (t) => ({ type: t, saved: true })) }));
vi.mock('./core.js', () => h.core);
vi.mock('./database.js', () => ({ databaseStatus: async () => ({ connected: true, ready: true }) }));
vi.mock('./progress.js', () => ({
  readSteps: async () => ({ company: { status: 'done' } }),
  readLog: async () => [{ message: 'x' }],
  markStep: vi.fn(async () => ({})),
  logInstall: vi.fn(async () => {}),
}));
vi.mock('../../middleware/auth.js', () => ({ authenticate: (_q, _s, next) => next() }));
vi.mock('../../middleware/permission.js', () => ({ requirePermission: () => (_q, _s, next) => next() }));
vi.mock('../../middleware/upload.js', () => ({ upload: { single: () => (_q, _s, next) => next() } }));
vi.mock('../../modules/user-management/shared/activity-logger.js', () => ({ writeActivity: vi.fn(), getClientIp: () => '1.1.1.1' }));
vi.mock('../utils/logger.js', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const router = (await import('./routes.js')).default;
const app = express();
app.use(express.json());
app.use('/api/install', router);
app.use((err, _req, res, _next) => res.status(500).json({ success: false, message: err.message }));

const T = { 'x-setup-token': TOKEN };
const admin = { name: 'Asha Rao', email: 'asha@acme.test', password: 'correct horse battery', confirm_password: 'correct horse battery' };
const open = [
  ['get', '/database'],
  ['get', '/progress'],
  ['get', '/app-types'],
  ['post', '/logo'],
  ['put', '/company', { name: 'Acme', logo_path: 'identity/a-1.png' }],
  ['put', '/admin', admin],
  ['post', '/core'],
  ['put', '/app-type', { app_type: 'landing' }],
  ['get', '/modules'],
  ['put', '/modules', { modules: ['forms'], demo: false }],
  ['post', '/complete'],
];

beforeEach(() => {
  h.installed = false;
  vi.clearAllMocks();
  h.svc.getState.mockResolvedValue({ installed: false, status: 'pending', step: 1, company: { name: 'Secret Co' } });
});

describe('installer routes while the install is open', () => {
  it.each(open)('%s %s needs the setup token', async (method, path, body) => {
    const res = await request(app)[method](`/api/install${path}`).send(body);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SETUP_TOKEN_REQUIRED');
    const bad = await request(app)[method](`/api/install${path}`).set('x-setup-token', TOKEN + 'x').send(body);
    expect(bad.status).toBe(401);
    expect(Object.values(h.svc).concat(Object.values(h.core)).some((f) => f.mock.calls.length)).toBe(false);
  });

  it.each(open)('%s %s works with the token', async (method, path, body) => {
    const res = await request(app)[method](`/api/install${path}`).set(T).send(body);
    expect(res.status).toBeLessThan(300);
  });

  it('/status shows nothing about the company without the token, everything with it', async () => {
    const anon = await request(app).get('/api/install/status');
    expect(anon.body.data).toEqual({ installed: false, status: 'pending', token_required: true });
    expect(JSON.stringify(anon.body)).not.toContain('Secret Co');
    const ok = await request(app).get('/api/install/status').set(T);
    expect(ok.body.data).toMatchObject({ token_ok: true, company: { name: 'Secret Co' } });
  });

  it('POST /token confirms a right token and rejects a wrong one', async () => {
    expect((await request(app).post('/api/install/token').set(T)).body.data).toEqual({ ok: true });
    expect((await request(app).post('/api/install/token').set('x-setup-token', 'nope-nope-nope')).status).toBe(401);
  });

  it('the admin form rejects a weak or mismatched password before anything is saved', async () => {
    const weak = await request(app).put('/api/install/admin').set(T).send({ ...admin, password: 'short', confirm_password: 'short' });
    expect(weak.status).toBe(422);
    const mismatch = await request(app).put('/api/install/admin').set(T).send({ ...admin, confirm_password: 'something else entirely' });
    expect(mismatch.status).toBe(422);
    expect(h.core.saveAdmin).not.toHaveBeenCalled();
    const good = await request(app).put('/api/install/admin').set(T).send(admin);
    expect(good.status).toBe(200);
    expect(h.core.saveAdmin).toHaveBeenCalledWith({ name: 'Asha Rao', email: 'asha@acme.test', password: 'correct horse battery' });
    expect(JSON.stringify(good.body)).not.toContain('correct horse');
  });
});

describe('modules step', () => {
  it('rejects a malformed selection before anything is saved', async () => {
    const bad = await request(app).put('/api/install/modules').set(T).send({ modules: ['Not A Slug'] });
    expect(bad.status).toBe(422);
    const extra = await request(app).put('/api/install/modules').set(T).send({ modules: [], other: 1 });
    expect(extra.status).toBe(422);
  });
});

describe('after the install is complete', () => {
  it.each(open.filter(([, p]) => p !== '/complete'))('%s %s is closed (409) even with the token', async (method, path, body) => {
    h.installed = true;
    const res = await request(app)[method](`/api/install${path}`).set(T).send(body);
    expect(res.status).toBe(409);
  });

  it('/status says only that it is installed', async () => {
    h.installed = true;
    h.svc.getState.mockResolvedValue({ installed: true });
    expect((await request(app).get('/api/install/status')).body.data).toEqual({ installed: true });
  });
});
