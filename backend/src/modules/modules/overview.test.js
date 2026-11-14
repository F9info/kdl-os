import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  settings: new Map(),
  landing: 0,
  mods: [],
}));
vi.mock('../../config/database.js', () => ({
  prisma: {
    appSetting: {
      findUnique: vi.fn(async ({ where }) => (h.settings.has(where.key) ? { value: h.settings.get(where.key) } : null)),
    },
    site: { count: vi.fn(async () => h.landing) },
  },
}));
vi.mock('./service.js', () => ({ listModules: vi.fn(async () => h.mods) }));

const { platformOverview } = await import('./overview.js');
const m = (slug, group, status, extra = {}) => ({ slug, group, status, ...extra });

beforeEach(() => {
  h.settings.clear();
  h.landing = 0;
  h.mods = [m('auth', 'core', 'ENABLED'), m('cms', 'cms', 'ENABLED'), m('faq', 'cms', 'DISABLED'), m('blog', 'cms', 'AVAILABLE'), m('gone', 'x', 'ENABLED', { _orphaned: true })];
});

describe('platformOverview', () => {
  it('counts modules by status and group, ignoring orphaned rows', async () => {
    const o = await platformOverview();
    expect(o.modules).toMatchObject({ total: 4, enabled: 2, installed: 1, available: 1 });
    expect(o.modules.by_group).toEqual([
      { group: 'cms', enabled: 1, total: 3 },
      { group: 'core', enabled: 1, total: 1 },
    ]);
  });

  it('reports the application type, the website and landing pages', async () => {
    h.settings.set('install.app_type', 'landing');
    h.landing = 4;
    const o = await platformOverview();
    expect(o.app_type).toBe('landing');
    expect(o.website).toEqual({ enabled: true, landing_pages: 4 });
  });

  it('no website when the Frontend module is not enabled; no type before the installer ran', async () => {
    h.mods = [m('auth', 'core', 'ENABLED')];
    const o = await platformOverview();
    expect(o.website.enabled).toBe(false);
    expect(o.app_type).toBeNull();
  });

  it('summarises the seeder run record, with failures and their reason', async () => {
    h.settings.set(
      'seeders.runs',
      JSON.stringify({
        roles: { status: 'done', at: '2026-11-14T10:00:00.000Z' },
        credits: { status: 'failed', error: 'boom', at: '2026-11-14T11:00:00.000Z' },
        'module:faq': { status: 'done', at: '2026-11-14T09:00:00.000Z' },
      })
    );
    const o = await platformOverview();
    expect(o.seeders).toEqual({
      total: 3,
      done: 2,
      failed: [{ name: 'credits', error: 'boom', at: '2026-11-14T11:00:00.000Z' }],
      last_run_at: '2026-11-14T11:00:00.000Z',
    });
  });

  it('an install that has no run record yet is zero, not an error', async () => {
    expect((await platformOverview()).seeders).toEqual({ total: 0, done: 0, failed: [], last_run_at: null });
  });
});
