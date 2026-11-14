import { describe, it, expect, vi, beforeEach } from 'vitest';

const settings = new Map();
const rows = new Map();
const prisma = {
  appSetting: {
    findUnique: vi.fn(async ({ where }) => (settings.has(where.key) ? { key: where.key, value: settings.get(where.key) } : null)),
    upsert: vi.fn(async ({ where, update, create }) => settings.set(where.key, settings.has(where.key) ? update.value : create.value)),
  },
  module: { findMany: vi.fn(async () => [...rows].map(([slug, status]) => ({ slug, status }))) },
};
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../utils/logger.js', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
const manifests = new Map(
  Object.entries({
    auth: { name: 'Auth', core: true, description: 'Sign-in', dependsOn: [] },
    cms: { name: 'Frontend', group: 'cms', description: 'Website', dependsOn: ['faq', 'auth'] },
    faq: { name: 'FAQ', group: 'cms', dependsOn: [] },
    forms: { name: 'Forms', group: 'cms', dependsOn: [] },
    blog: { name: 'Blog', group: 'cms', dependsOn: ['faq'] },
    pay: { name: 'Payments', dependsOn: [], env: ['PAY_KEY_FOR_TEST'] },
    old: { name: 'Old', dependsOn: [], conflictsWith: ['forms'] },
    hidden: { name: 'Hidden', visibleInCatalog: false, dependsOn: [] },
  }).map(([slug, m]) => [slug, { slug, ...m }])
);
vi.mock('../modules/module-loader.js', () => ({ loadedManifests: manifests }));

const { moduleChoices, saveModules, readSelection, hasWebsite } = await import('./modules.js');

beforeEach(() => {
  settings.clear();
  rows.clear();
  delete process.env.PAY_KEY_FOR_TEST;
  settings.set('install.app_type', 'landing');
});

describe('moduleChoices', () => {
  it('lists core first and the type modules with their dependencies and status', async () => {
    rows.set('faq', 'ENABLED');
    const c = await moduleChoices('landing');
    expect(c.core.map((m) => m.slug)).toEqual(['auth']);
    expect(c.included.map((m) => m.slug)).toEqual(['faq', 'cms']);
    const cms = c.included.find((m) => m.slug === 'cms');
    expect(cms).toMatchObject({ description: 'Website', status: 'AVAILABLE' });
    expect(cms.dependsOn).toEqual([{ slug: 'faq', name: 'FAQ' }]); // core dependency (auth) is not listed
    expect(c.included.find((m) => m.slug === 'faq').status).toBe('ENABLED');
  });

  it('offers only installable extras: not core, not hidden, not already in the type', async () => {
    const c = await moduleChoices('landing');
    expect(c.optional.map((m) => m.slug).sort()).toEqual(['blog', 'forms', 'old', 'pay']);
    expect(c.optional.find((m) => m.slug === 'blog').includes).toEqual([]); // faq is already part of the type
  });

  it('blocks an extra that needs a missing env var or clashes with another module', async () => {
    const c = await moduleChoices('landing');
    expect(c.optional.find((m) => m.slug === 'pay').blocked).toMatch(/PAY_KEY_FOR_TEST/);
    process.env.PAY_KEY_FOR_TEST = 'x';
    expect((await moduleChoices('landing')).optional.find((m) => m.slug === 'pay').blocked).toBeNull();
  });

  it('the sample-content question only exists when a website is created, and defaults to yes', async () => {
    expect((await moduleChoices('landing')).demo).toEqual({ available: true, value: true });
    expect((await moduleChoices('admin-only')).demo.available).toBe(false);
  });

  it('rejects an unknown type', async () => {
    await expect(moduleChoices('nope')).rejects.toMatchObject({ status: 422 });
  });
});

describe('saveModules', () => {
  it('stores the extras and an explicit no for sample content', async () => {
    await saveModules('landing', { modules: ['forms', 'forms'], demo: false });
    expect(await readSelection()).toEqual({ extra: ['forms'], demo: false });
    expect(settings.get('onboarding.frontend')).toBe('no');
  });

  it('stores yes, and a later answer replaces it', async () => {
    await saveModules('landing', { modules: [], demo: true });
    expect(settings.get('onboarding.frontend')).toBe('yes');
    await saveModules('landing', { modules: [], demo: false });
    expect(settings.get('onboarding.frontend')).toBe('no');
  });

  it('refuses a module that is not offered, hidden, core or blocked', async () => {
    for (const slug of ['auth', 'hidden', 'ghost', 'pay', 'cms']) {
      await expect(saveModules('landing', { modules: [slug] })).rejects.toMatchObject({ status: 422 });
    }
    expect(settings.has('install.extra_modules')).toBe(false);
  });

  it('records no sample-content answer when there is no website', async () => {
    await saveModules('admin-only', { modules: ['forms'], demo: true });
    expect(settings.has('onboarding.frontend')).toBe(false);
  });
});

describe('hasWebsite', () => {
  it('is true when the type or an extra pulls in the Frontend module', () => {
    expect(hasWebsite('landing')).toBe(true);
    expect(hasWebsite('admin-only')).toBe(false);
    expect(hasWebsite('admin-only', ['cms'])).toBe(true);
  });
});
