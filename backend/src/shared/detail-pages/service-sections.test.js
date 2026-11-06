import { describe, it, expect } from 'vitest';
import { withServiceSections, SERVICE_SECTION_TYPES } from './service-sections.js';

const base = () => ({
  content: [
    { type: 'ConstructionHeader', props: {} },
    { type: 'Text', props: { id: 'service-body' } },
    { type: 'ConstructionFooter', props: {} },
  ],
});

describe('withServiceSections', () => {
  it('adds the sections between the body and the footer, once', () => {
    const once = withServiceSections(base(), 'service', '/p/contact');
    expect(once.content.map((b) => b.type)).toEqual([
      'ConstructionHeader',
      'Text',
      ...SERVICE_SECTION_TYPES,
      'ConstructionFooter',
    ]);
    expect(withServiceSections(once, 'service')).toBe(once);
  });

  it('gives every block a unique id and a safe link', () => {
    const { content } = withServiceSections(base(), 'service', '/p/contact');
    const ids = content.map((b) => b.props.id).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
    const hrefs = content.flatMap((b) => [b.props.ctaHref, b.props.ctaPrimaryHref]).filter(Boolean);
    expect(hrefs.every((h) => h.startsWith('/'))).toBe(true);
  });
});
