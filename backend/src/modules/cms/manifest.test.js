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
      ])
    );
  });

  it('orders the CMS sidebar group: Company Details, Color Palette, Brands, Navigation, Layouts, Pages, Section Builder', () => {
    const labels = load('menus').nav.map((n) => n.label);
    expect(labels.indexOf('Color Palette')).toBe(labels.indexOf('Company Details') + 1);
    expect(labels.indexOf('Brands')).toBe(labels.indexOf('Color Palette') + 1);
    expect(labels.indexOf('Navigation')).toBe(labels.indexOf('Brands') + 1);
    expect(labels.indexOf('Layouts')).toBe(labels.indexOf('Navigation') + 1);
    expect(labels.indexOf('Pages')).toBe(labels.indexOf('Layouts') + 1);
    expect(labels.indexOf('Section Builder')).toBe(labels.indexOf('Pages') + 1);
  });
});
