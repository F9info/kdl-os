import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));
vi.mock('../../middleware/module-gate.js', () => ({ invalidateModuleCache: vi.fn() }));
vi.mock('../../shared/modules/module-loader.js', () => ({ loadedManifests: new Map() }));

import { prisma } from '../../config/database.js';
import { loadedManifests } from '../../shared/modules/module-loader.js';
import { applyProducts, getModuleGraph, listEnabledModules } from './service.js';

const mf = (slug, extra = {}) => ({ slug, name: slug, version: '1.0.0', dependsOn: [], conflictsWith: [], ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  loadedManifests.clear();
  for (const s of ['users', 'user-management', 'settings', 'identity', 'media']) loadedManifests.set(s, mf(s, { core: true }));
  prisma.module = { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() };
  prisma.appSetting = { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() };
});

const enabled = (...slugs) => prisma.module.findMany.mockResolvedValue(slugs.map((slug) => ({ slug })));

describe('applyProducts', () => {
  it('saves the selection and changes no modules when everything is already enabled', async () => {
    enabled('users', 'user-management', 'settings', 'identity', 'media');
    const graph = await applyProducts(['admin'], 'u1');
    expect(prisma.appSetting.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.appSetting.upsert.mock.calls[0][0].create).toMatchObject({ key: 'products.enabled', value: '["admin"]' });
    expect(prisma.module.create).not.toHaveBeenCalled();
    expect(prisma.module.update).not.toHaveBeenCalled();
    expect(graph.selected).toEqual(['admin']);
  });

  it('rejects an unknown product with 409 and writes nothing', async () => {
    enabled();
    await expect(applyProducts(['blog'], 'u1')).rejects.toMatchObject({
      status: 409,
      details: { code: 'PRODUCT_SELECTION_INVALID', unknownProducts: ['blog'] },
    });
    expect(prisma.appSetting.upsert).not.toHaveBeenCalled();
  });

  it('rejects a conflicting selection and writes nothing', async () => {
    loadedManifests.set('media', mf('media', { core: true, conflictsWith: ['other-media'] }));
    loadedManifests.set('other-media', mf('other-media'));
    enabled('other-media');
    await expect(applyProducts(['admin'], 'u1')).rejects.toMatchObject({ status: 409, details: { conflicts: [expect.any(Object)] } });
    expect(prisma.appSetting.upsert).not.toHaveBeenCalled();
  });

  it('removing a product never disables modules (no module writes)', async () => {
    enabled('users', 'user-management', 'settings', 'identity', 'media');
    prisma.appSetting.findUnique.mockResolvedValue({ value: '["admin"]' });
    await applyProducts([], 'u1');
    expect(prisma.module.update).not.toHaveBeenCalled();
    expect(prisma.appSetting.upsert.mock.calls[0][0].create.value).toBe('[]');
  });
});

describe('getModuleGraph stored selection', () => {
  it('reads products.enabled; tolerates bad JSON', async () => {
    enabled('media');
    prisma.appSetting.findUnique.mockResolvedValue({ value: '["admin"]' });
    expect((await getModuleGraph()).selected).toEqual(['admin']);
    prisma.appSetting.findUnique.mockResolvedValue({ value: '{oops' });
    expect((await getModuleGraph()).selected).toEqual([]);
  });
});

describe('listEnabledModules hidden_by_products (T2.4, sidebar only)', () => {
  const site = ['cms', 'menus', 'page-builder-ui', 'theme-engine-ui'];
  beforeEach(() => {
    for (const s of site) loadedManifests.set(s, mf(s));
    prisma.module.findMany.mockResolvedValue(['media', 'cms', 'menus', 'theme-engine-ui', 'settings'].map((slug) => ({ slug, name: slug })));
  });
  const flags = async () => Object.fromEntries((await listEnabledModules()).map((m) => [m.slug, m.hidden_by_products]));
  const saved = (arr) => prisma.appSetting.findUnique.mockResolvedValue({ value: JSON.stringify(arr) });

  it('hides nothing when products were never chosen (existing installs)', async () => {
    expect(Object.values(await flags()).every((v) => v === false)).toBe(true);
  });

  it('Admin only: hides site-only modules, keeps shared ones (media)', async () => {
    saved(['admin']);
    expect(await flags()).toMatchObject({ cms: true, menus: true, 'theme-engine-ui': true, media: false, settings: false });
  });

  it('Website or Landing selected: hides nothing', async () => {
    saved(['admin', 'website']);
    expect(Object.values(await flags()).every((v) => v === false)).toBe(true);
    saved(['landing']);
    expect(Object.values(await flags()).every((v) => v === false)).toBe(true);
  });

  it('never disables anything: hidden modules are still returned', async () => {
    saved(['admin']);
    expect((await listEnabledModules()).map((m) => m.slug)).toContain('cms');
  });
});
