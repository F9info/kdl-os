import { describe, it, expect, vi } from 'vitest';

// resolveCatalogBindings is a pure transform; stub the DB singleton so import doesn't need DATABASE_URL.
vi.mock('../../config/database.js', () => ({ prisma: {} }));

import { resolveCatalogBindings } from './service.js';

const content = {
  ConstructionDisciplineRows: { items: [{ heading: 'Lorem ipsum sized right' }] },
  ConstructionProcessSteps: { items: [{ title: 'One' }, { title: 'Two' }, { title: 'Three' }, { title: 'Four' }] },
};

describe('resolveCatalogBindings content overlay', () => {
  const template = {
    root: { props: {} },
    content: [
      { type: 'ConstructionDisciplineRows', props: { id: 'a', padding: 'lg', items: [] } },
      { type: 'ConstructionProcessSteps', props: { id: 'b', items: [] } },
    ],
  };

  it('overlays per-item section copy but keeps template design props', () => {
    const item = { name: 'Demo Item', content };
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
});
