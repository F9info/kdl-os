import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../page-builder/service.js', () => ({ deletePage: vi.fn() }));
vi.mock('../sectors/service.js', () => ({ siteChrome: vi.fn() }));
vi.mock('../../shared/detail-pages/templates.js', () => ({ createDetailPageInstance: vi.fn() }));
const { resolveEntryBindings, splitEntryEdits } = await import('./entries.service.js');

const tpl = {
  root: { props: { title: 'T' } },
  content: [
    { type: 'ConstructionInnerBanner', props: { id: 'blog-banner', subtitle: 'tpl sub', backgroundImage: '', imageAlt: 'x' } },
    { type: 'Text', props: { id: 'blog-body', text: 'tpl body' } },
  ],
};
const entry = { name: 'A', description: 'a desc', body: 'a body', image: 'a.png' };

describe('splitEntryEdits', () => {
  it('moves edited bound props to the entry and leaves the template layout untouched', () => {
    const incoming = resolveEntryBindings(tpl, entry);
    incoming.content[1].props.text = 'edited body';
    incoming.content[0].props.variant = '2'; // layout change
    const { entityPatch, data } = splitEntryEdits(tpl, entry, incoming);
    expect(entityPatch).toEqual({ body: 'edited body' });
    expect(data.content[1].props.text).toBe('tpl body');
    expect(data.content[0].props.subtitle).toBe('tpl sub');
    expect(data.content[0].props.variant).toBe('2');
    expect(data.root.props.title).toBe('T');
  });
});
