import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { manifestSchema } from '../../shared/modules/manifest-schema.js';

const dir = dirname(fileURLToPath(import.meta.url));
const load = (slug) =>
  manifestSchema.parse(JSON.parse(readFileSync(join(dir, '..', slug, 'module.json'), 'utf8')));

describe('CMS bundle manifest', () => {
  const cms = load('cms');
  it('is the only visible card; its parts are hidden', () => {
    expect(cms.umbrella).toBe(true);
    expect(cms.visibleInCatalog).toBe(true);
    for (const part of cms.dependsOn) expect(load(part).visibleInCatalog, part).toBe(false);
  });
  it('bundles every content module', () => {
    expect(cms.dependsOn).toEqual(
      expect.arrayContaining([
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
      ])
    );
  });

  it('orders the Frontend sidebar group: Brands first, then Website Details, Color Palette, Navigation, Layouts, Pages, Sections', () => {
    const labels = load('menus').nav.map((n) => n.label);
    expect(labels[0]).toBe('Brands'); // the doorway to Landing Pages, Web app and Collateral
    expect(labels.slice(1)).toEqual(['Website Details', 'Color Palette', 'Navigation', 'Layouts', 'Pages', 'Sections']);
  });
});
