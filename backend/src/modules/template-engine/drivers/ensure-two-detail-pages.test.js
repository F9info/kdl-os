import { describe, it, expect } from 'vitest';
import { ensureTwoDetailPages } from './ensure-two-detail-pages.js';

describe('ensureTwoDetailPages', () => {
  it('doubles a lone detail page', () => {
    expect(ensureTwoDetailPages(['Home', 'Contact Detail'])).toEqual(['Home', 'Contact Detail', 'Contact Detail']);
  });
  it('leaves already-repeated and non-detail pages alone', () => {
    const t = ['Service Detail', 'Service Detail', 'Contact'];
    expect(ensureTwoDetailPages(t)).toEqual(t);
  });
});
