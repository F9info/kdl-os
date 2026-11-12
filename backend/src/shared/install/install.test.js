import { describe, it, expect, vi, beforeEach } from 'vitest';

const settings = new Map();
const modules = new Map();
const installed = [];
const prisma = {
  appSetting: {
    findUnique: vi.fn(async ({ where }) => (settings.has(where.key) ? { key: where.key, value: settings.get(where.key) } : null)),
    upsert: vi.fn(async ({ where, update, create }) => {
      if (settings.has(where.key)) {
        if (update.value !== undefined) settings.set(where.key, update.value);
      } else settings.set(where.key, create.value);
    }),
    updateMany: vi.fn(async ({ where, data }) => {
      const cur = settings.get(where.key);
      if (where.OR.some((c) => c.value === cur && !c.updated_at)) {
        settings.set(where.key, data.value);
        return { count: 1 };
      }
      return { count: 0 };
    }),
    count: vi.fn(async () => 0),
  },
  user: { count: vi.fn(async () => 0) },
  userRole: { count: vi.fn(async () => 1) },
  module: {
    findMany: vi.fn(async ({ where }) => [...modules].filter(([s]) => where.slug.in.includes(s)).map(([slug, status]) => ({ slug, status }))),
    findUnique: vi.fn(async ({ where }) => (modules.has(where.slug) ? { slug: where.slug, status: modules.get(where.slug) } : null)),
  },
};
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../../config/redis.js', () => ({ redis: { del: vi.fn(async () => 1), get: vi.fn(), set: vi.fn() } }));
vi.mock('../services/storage.service.js', () => ({ uploadFile: vi.fn(async () => {}), getFileUrl: vi.fn(async (p) => `/u/${p}`) }));
const manifests = new Map([
  ['cms', { slug: 'cms', name: 'Frontend', dependsOn: ['faq', 'menus'] }],
  ['faq', { slug: 'faq', name: 'FAQ', dependsOn: [] }],
  ['menus', { slug: 'menus', name: 'Menus', dependsOn: [] }],
  ['forms', { slug: 'forms', name: 'Forms', dependsOn: [] }],
  ['page-builder-ui', { slug: 'page-builder-ui', name: 'PB', dependsOn: ['page-builder'] }],
  ['page-builder', { slug: 'page-builder', name: 'Page Builder', core: true, dependsOn: [] }],
  ['theme-engine-ui', { slug: 'theme-engine-ui', name: 'TE', dependsOn: [] }],
]);
vi.mock('../modules/module-loader.js', () => ({ loadedManifests: manifests }));
const lifecycle = { fail: null };
vi.mock('../../modules/modules/service.js', () => ({
  installModule: vi.fn(async (slug) => {
    if (lifecycle.fail === slug) throw new Error('seed exploded');
    modules.set(slug, 'DISABLED');
    installed.push(slug);
  }),
  enableModule: vi.fn(async (slug) => modules.set(slug, 'ENABLED')),
}));
const identity = {};
vi.mock('../../modules/identity/service.js', () => ({
  getIdentity: vi.fn(async () => ({ ...identity })),
  getAppConfig: vi.fn(async () => ({ ...identity })),
  updateIdentity: vi.fn(async (p) => Object.assign(identity, p)),
}));

const status = await import('./status.js');
const { requireInstalled } = await import('./gate.js');
const svc = await import('./service.js');
const { modulesFor, APP_TYPES, hasFrontend } = await import('./app-types.js');

beforeEach(() => {
  settings.clear();
  modules.clear();
  installed.length = 0;
  for (const k of Object.keys(identity)) delete identity[k];
  lifecycle.fail = null;
  status.resetInstallCache();
  prisma.userRole.count.mockResolvedValue(1);
});

const png = Buffer.concat([Buffer.from([0x89]), Buffer.from('PNG\r\n\x1a\n'), Buffer.alloc(20)]);
const company = { name: 'ABC Technologies', phone: '', email: '', logo_path: 'identity/abc-123.png' };

describe('app types', () => {
  it('Admin Only needs no optional module; frontend types need cms', () => {
    expect(modulesFor('admin-only', manifests)).toEqual([]);
    expect(hasFrontend('admin-only')).toBe(false);
    for (const t of ['landing', 'static', 'admin-frontend', 'multi']) expect(hasFrontend(t)).toBe(true);
    expect(hasFrontend('web-app')).toBe(false);
  });
  it('resolves optional dependencies, skips core ones, deps first', () => {
    expect(modulesFor('landing', manifests)).toEqual(['faq', 'menus', 'cms']);
    expect(modulesFor('multi', manifests)).toEqual(['faq', 'menus', 'cms', 'page-builder-ui', 'theme-engine-ui']);
  });
  it('every type points at a real module manifest', async () => {
    const { readdirSync, readFileSync, existsSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const dir = fileURLToPath(new URL('../../modules/', import.meta.url));
    const slugs = new Set(readdirSync(dir).filter((d) => existsSync(`${dir}${d}/module.json`)).map((d) => JSON.parse(readFileSync(`${dir}${d}/module.json`, 'utf8')).slug));
    for (const t of Object.values(APP_TYPES)) for (const m of t.modules) expect(slugs.has(m)).toBe(true);
  });
});

describe('logo', () => {
  it('accepts a PNG by its bytes, rejects other content and big files', async () => {
    expect((await svc.saveLogo({ buffer: png, size: png.length, mimetype: 'text/plain' })).path).toMatch(/^identity\/.+\.png$/);
    await expect(svc.saveLogo({ buffer: Buffer.from('<svg xmlns="x"></svg>'), size: 20 })).rejects.toThrow(/PNG, JPEG or WebP/);
    await expect(svc.saveLogo({ buffer: png, size: 3 * 1024 * 1024 })).rejects.toThrow(/2 MB/);
    await expect(svc.saveLogo(undefined)).rejects.toThrow(/logo/);
  });
});

describe('wizard', () => {
  it('state is pending with nothing saved, and survives a refresh', async () => {
    expect(await svc.getState()).toMatchObject({ installed: false, step: 0, app_type: null });
    await svc.saveCompany(company);
    await svc.saveType('landing');
    const again = await svc.getState();
    expect(again).toMatchObject({ installed: false, step: 2, app_type: 'landing', company: { name: 'ABC Technologies' } });
  });
  it('company needs a logo', async () => {
    await expect(svc.saveCompany({ ...company, logo_path: '' })).rejects.toThrow(/logo/i);
  });
  it('complete refuses until both steps are saved', async () => {
    await expect(svc.complete()).rejects.toThrow(/step 1/);
    await svc.saveCompany(company);
    await expect(svc.complete()).rejects.toThrow(/step 2/);
  });
  it('Landing launch installs and enables Frontend, then marks installed', async () => {
    await svc.saveCompany(company);
    await svc.saveType('landing');
    const r = await svc.complete();
    expect(r).toMatchObject({ installed: true, frontend: true });
    expect(modules.get('cms')).toBe('ENABLED');
    expect(await status.isInstalled()).toBe(true);
    await expect(svc.saveCompany(company)).rejects.toThrow(/already complete/);
    await expect(svc.complete()).rejects.toThrow(/already complete/);
  });
  it('Admin Only launch installs nothing', async () => {
    await svc.saveCompany(company);
    await svc.saveType('admin-only');
    await svc.complete();
    expect(installed).toEqual([]);
    expect(await status.isInstalled()).toBe(true);
  });
  it('a failed module install leaves the install open and retryable', async () => {
    await svc.saveCompany(company);
    await svc.saveType('landing');
    lifecycle.fail = 'cms';
    await expect(svc.complete()).rejects.toThrow(/Installation stopped: seed exploded/);
    expect(await status.isInstalled()).toBe(false);
    expect(settings.get('install.status')).toBe('pending');
    lifecycle.fail = null;
    await svc.complete();
    expect(await status.isInstalled()).toBe(true);
  });
  it('refuses a second launch while one is running', async () => {
    await svc.saveCompany(company);
    await svc.saveType('landing');
    settings.set('install.status', 'running');
    await expect(svc.complete()).rejects.toThrow(/already running/);
  });
  it('needs a Super Admin to exist', async () => {
    await svc.saveCompany(company);
    await svc.saveType('landing');
    prisma.userRole.count.mockResolvedValue(0);
    await expect(svc.complete()).rejects.toThrow(/Super Admin/);
  });
});

describe('change type after install', () => {
  it('adds only missing modules and is repeatable without duplicates', async () => {
    await svc.saveCompany(company);
    await svc.saveType('landing');
    await svc.complete();
    const n = installed.length;
    await svc.changeType('static', 1);
    expect(installed.length).toBe(n);
    const r = await svc.changeType('admin-frontend', 1);
    expect(installed).toContain('forms');
    expect(r.previous).toBe('static');
    expect(installed.filter((s) => s === 'cms')).toHaveLength(1);
  });
  it('is refused before installation finishes', async () => {
    await expect(svc.changeType('landing', 1)).rejects.toThrow(/Finish the installation/);
  });
});

describe('existing databases', () => {
  it('backfill marks a used install complete once, leaves a fresh one open', async () => {
    expect(await status.backfillInstalled(prisma, {})).toBe(false);
    expect(settings.has('install.status')).toBe(false);
    prisma.user.count.mockResolvedValueOnce(1);
    expect(await status.backfillInstalled(prisma, {})).toBe(true);
    expect(settings.get('install.status')).toBe('completed');
    expect(await status.backfillInstalled(prisma, {})).toBeNull();
  });
  it('KDL_SKIP_INSTALL_WIZARD=1 marks complete', async () => {
    expect(await status.backfillInstalled(prisma, { KDL_SKIP_INSTALL_WIZARD: '1' })).toBe(true);
  });
  it('login gate answers 403 INSTALL_REQUIRED until installed', async () => {
    const res = { status: vi.fn(() => res), json: vi.fn() };
    const next = vi.fn();
    await requireInstalled({}, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].code).toBe('INSTALL_REQUIRED');
    settings.set('install.status', 'completed');
    await requireInstalled({}, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
