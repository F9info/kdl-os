import { describe, it, expect } from 'vitest';
import { normalizeBlockProps, normalizeData } from './numbered-families.js';

describe('numbered families → arrays', () => {
  it('folds numbered slots into the array prop and drops the legacy keys', () => {
    const props = normalizeBlockProps('ConstructionFAQ', {
      id: 'x',
      sectionTitle: 'FAQ',
      faq1Question: 'Q1',
      faq1Answer: 'A1',
      faq2Question: 'Q2',
      faq2Answer: 'A2',
      faq3Question: '',
      faq3Answer: '',
    });
    expect(props.faqs).toEqual([
      { question: 'Q1', answer: 'A1' },
      { question: 'Q2', answer: 'A2' },
    ]);
    expect(Object.keys(props).some((k) => /^faq\d/.test(k))).toBe(false);
    expect(props.sectionTitle).toBe('FAQ');
  });

  it('applies slot overrides on top of an existing array (sector content over a shared template)', () => {
    const props = normalizeBlockProps('ConstructionStatsStrip', {
      stats: [
        { value: '1', label: 'a' },
        { value: '2', label: 'b' },
      ],
      stat2Value: '99',
      stat3Value: '3',
      stat3Label: 'c',
    });
    expect(props.stats).toEqual([
      { value: '1', label: 'a' },
      { value: '99', label: 'b' },
      { value: '3', label: 'c' },
    ]);
  });

  it('is a no-op (same reference) for blocks without legacy keys or outside the table', () => {
    const data = { content: [{ type: 'ConstructionFAQ', props: { faqs: [] } }, { type: 'Nope', props: { faq1Question: 'x' } }] };
    expect(normalizeData(data)).toBe(data);
  });

  it('uses "value" for suffix-less families (logo1, logo2…)', () => {
    const props = normalizeBlockProps('ConstructionClientsMarquee', { logo1: '/a.png', logo2: '/b.png', logo3: '' });
    expect(props.logos).toEqual([{ value: '/a.png' }, { value: '/b.png' }]);
  });
});
