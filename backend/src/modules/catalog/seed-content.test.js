import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { resolveCatalogBindings } from './service.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const content = JSON.parse(readFileSync(path.join(dir, '../../../scripts/seed-data/catalog-page-content.json'), 'utf8'));

describe('resolveCatalogBindings content overlay', () => {
  const template = {
    root: { props: {} },
    content: [
      { type: 'ConstructionDisciplineRows', props: { id: 'a', padding: 'lg', items: [] } },
      { type: 'ConstructionProcessSteps', props: { id: 'b', items: [] } },
    ],
  };

  it('overlays per-item section copy but keeps template design props', () => {
    const item = { name: 'Fans', content: content['fans-ventilation'] };
    const out = resolveCatalogBindings(template, item);
    expect(out.content[0].props.items[0].heading).toMatch(/sized right/);
    expect(out.content[0].props.padding).toBe('lg');
    expect(out.content[1].props.items).toHaveLength(4);
    expect(template.content[0].props.items).toEqual([]); // template untouched
  });

  it('is a no-op for items without content', () => {
    const out = resolveCatalogBindings(template, { name: 'X', content: null });
    expect(out.content[1].props.items).toEqual([]);
  });

  it('has complete content for all 17 mockup pages', () => {
    expect(Object.keys(content)).toHaveLength(17);
  });
});
