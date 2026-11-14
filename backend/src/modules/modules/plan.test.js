import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: { module: { findMany: vi.fn() } } }));
vi.mock('../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));
vi.mock('../../middleware/module-gate.js', () => ({ invalidateModuleCache: vi.fn() }));
vi.mock('../../shared/modules/module-loader.js', () => ({ loadedManifests: new Map() }));

import { prisma } from '../../config/database.js';
import { loadedManifests } from '../../shared/modules/module-loader.js';
import { planModuleAction } from './service.js';

const man = (slug, o = {}) => ({ slug, name: slug.toUpperCase(), version: '1.0.0', core: false, group: 'cms', dependsOn: [], conflictsWith: [], permissions: [], env: [], ...o });
const rows = (o) => prisma.module.findMany.mockResolvedValue(Object.entries(o).map(([slug, status]) => ({ slug, status })));

beforeEach(() => {
  loadedManifests.clear();
  loadedManifests.set('base', man('base', { core: true, group: 'core' }));
  loadedManifests.set('lib', man('lib', { dependsOn: ['base'] }));
  loadedManifests.set('shop', man('shop', { dependsOn: ['lib'], env: ['SHOP_KEY'] }));
  loadedManifests.set('old', man('old', { conflictsWith: ['shop'] }));
  delete process.env.SHOP_KEY;
});

describe('planModuleAction (read-only preview)', () => {
  it('install lists only the modules still missing, dependencies first, and flags a missing env var', async () => {
    rows({ base: 'ENABLED' });
    const plan = await planModuleAction('shop', 'install');
    expect(plan.steps.map((s) => `${s.slug}:${s.do}:${s.dependency}`)).toEqual(['lib:install:true', 'shop:install:false']);
    expect(plan.canProceed).toBe(false);
    expect(plan.blockers).toEqual([expect.objectContaining({ type: 'env', modules: ['shop'] })]);
    expect(plan.dependsOn.map((d) => `${d.slug}:${d.status}`)).toEqual(['lib:AVAILABLE']);
  });

  it('enable cascades: installs what is missing and enables what is off, then the module', async () => {
    process.env.SHOP_KEY = 'x';
    rows({ base: 'ENABLED', lib: 'DISABLED' });
    const plan = await planModuleAction('shop', 'enable');
    expect(plan.steps.map((s) => `${s.slug}:${s.do}`)).toEqual(['lib:enable', 'shop:install and enable']);
    expect(plan.canProceed).toBe(true);
    expect(plan.group).toBe('cms');
  });

  it('enable shows the modules it would switch off (conflicts) without blocking', async () => {
    process.env.SHOP_KEY = 'x';
    rows({ base: 'ENABLED', lib: 'ENABLED', old: 'ENABLED' });
    const plan = await planModuleAction('shop', 'enable');
    expect(plan.conflicts.map((c) => c.slug)).toEqual(['old']);
    expect(plan.canProceed).toBe(true);
  });

  it('disable is blocked while an enabled module depends on it, and names the dependents', async () => {
    rows({ base: 'ENABLED', lib: 'ENABLED', shop: 'ENABLED' });
    const plan = await planModuleAction('lib', 'disable');
    expect(plan.canProceed).toBe(false);
    expect(plan.requiredBy.map((m) => m.slug)).toEqual(['shop']);
    expect(plan.blockers[0]).toMatchObject({ type: 'dependents', modules: ['shop'] });
  });

  it('disable of a leaf module can proceed; a core module and a not-enabled module cannot', async () => {
    rows({ base: 'ENABLED', lib: 'ENABLED', shop: 'ENABLED' });
    expect((await planModuleAction('shop', 'disable')).canProceed).toBe(true);
    expect((await planModuleAction('base', 'disable')).blockers[0].type).toBe('core');
    rows({ base: 'ENABLED' });
    expect((await planModuleAction('lib', 'disable')).blockers[0].type).toBe('not-enabled');
  });

  it('flags a module that is already in the requested state, and 404s on an unknown slug', async () => {
    rows({ base: 'ENABLED', lib: 'ENABLED' });
    expect((await planModuleAction('lib', 'enable')).blockers[0].type).toBe('already-enabled');
    expect((await planModuleAction('lib', 'install')).blockers[0].type).toBe('already-installed');
    await expect(planModuleAction('nope', 'enable')).rejects.toMatchObject({ status: 404 });
  });

  it('writes nothing', async () => {
    rows({ base: 'ENABLED' });
    await planModuleAction('lib', 'enable');
    expect(Object.keys(prisma.module)).toEqual(['findMany']);
  });
});
