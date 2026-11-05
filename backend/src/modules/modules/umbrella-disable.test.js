import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));
vi.mock('../../middleware/module-gate.js', () => ({ invalidateModuleCache: vi.fn() }));
vi.mock('../../shared/modules/module-loader.js', () => ({ loadedManifests: new Map() }));

import { prisma } from '../../config/database.js';
import { loadedManifests } from '../../shared/modules/module-loader.js';
import { disableModule } from './service.js';

// The real manifests, so this fails if the CMS bundle's wiring changes.
const dir = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = (slug) => JSON.parse(readFileSync(join(dir, slug, 'module.json'), 'utf8'));
const ALL = [
  'cms',
  'faq',
  'gallery',
  'testimonials',
  'team',
  'catalog',
  'work',
  'sectors',
  'projects-content',
  'menus',
  'landing',
  'forms',
  'page-builder',
  'notifications',
];

let status;
beforeEach(() => {
  vi.clearAllMocks();
  loadedManifests.clear();
  for (const slug of ALL) loadedManifests.set(slug, manifest(slug));
  status = Object.fromEntries(ALL.map((s) => [s, 'ENABLED']));
  prisma.module = {
    findUnique: vi.fn(async ({ where }) =>
      where.slug in status
        ? { id: where.slug, slug: where.slug, is_core: false, status: status[where.slug] }
        : null
    ),
    findMany: vi.fn(async () => ALL.filter((s) => status[s] === 'ENABLED').map((slug) => ({ slug }))),
    update: vi.fn(async ({ where, data }) => {
      status[where.slug] = data.status;
      return { slug: where.slug, ...data };
    }),
  };
});

describe('CMS bundle', () => {
  it('Landing Pages and Forms are parts of the CMS bundle', () => {
    expect(loadedManifests.get('cms').dependsOn).toEqual(expect.arrayContaining(['landing', 'forms']));
    expect(loadedManifests.get('landing').dependsOn).toContain('forms'); // landing needs forms
  });

  it('disabling CMS switches off every part, including forms that landing depends on', async () => {
    await disableModule('cms', 'u1');
    for (const part of loadedManifests.get('cms').dependsOn) expect(status[part], part).toBe('DISABLED');
    expect(status.cms).toBe('DISABLED');
  });

  it('modules outside the bundle are untouched', async () => {
    await disableModule('cms', 'u1');
    expect(status['page-builder']).toBe('ENABLED');
    expect(status.notifications).toBe('ENABLED');
  });

  it('a part something outside the bundle still needs stays on', async () => {
    loadedManifests.set('crm', { slug: 'crm', dependsOn: ['forms'] });
    status.crm = 'ENABLED';
    prisma.module.findMany = vi.fn(async () =>
      Object.keys(status)
        .filter((s) => status[s] === 'ENABLED')
        .map((slug) => ({ slug }))
    );
    await disableModule('cms', 'u1');
    expect(status.forms).toBe('ENABLED'); // crm needs it
    expect(status.landing).toBe('DISABLED');
  });

  it('no module data is deleted, only status changes', async () => {
    prisma.module.delete = vi.fn();
    await disableModule('cms', 'u1');
    expect(prisma.module.delete).not.toHaveBeenCalled();
  });
});
