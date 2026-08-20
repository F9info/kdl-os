// KDL-538 — unit tests for the decodeHtmlEntities helper.

import { describe, it, expect } from 'vitest';
import { decodeHtmlEntities } from '../src/utils/decode-html-entities.js';

describe('decodeHtmlEntities', () => {
  it('decodes &amp; to &', () => {
    expect(decodeHtmlEntities('Smith &amp; Sons')).toBe('Smith & Sons');
  });

  it('resolves double-escaping: &amp;amp; → &', () => {
    expect(decodeHtmlEntities('Smith &amp;amp; Sons')).toBe('Smith & Sons');
  });

  it("decodes mixed named entities: O&#39;Brien &amp; Co.", () => {
    expect(decodeHtmlEntities("O&#39;Brien &amp; Co.")).toBe("O'Brien & Co.");
  });

  it('decodes &lt; and &gt;', () => {
    expect(decodeHtmlEntities('&lt;tag&gt;')).toBe('<tag>');
  });

  it('leaves a bare & that is not part of a valid entity untouched', () => {
    expect(decodeHtmlEntities('R&D')).toBe('R&D');
    expect(decodeHtmlEntities('1 & 2 together')).toBe('1 & 2 together');
  });

  it('returns a string with no entities unchanged (identity)', () => {
    const plain = 'No special characters here.';
    expect(decodeHtmlEntities(plain)).toBe(plain);
  });

  it('decodes &quot; and &apos;', () => {
    expect(decodeHtmlEntities('&quot;hello&quot;')).toBe('"hello"');
    expect(decodeHtmlEntities("it&apos;s")).toBe("it's");
  });

  it('decodes decimal numeric form &#38; (ampersand)', () => {
    expect(decodeHtmlEntities('Smith &#38; Sons')).toBe('Smith & Sons');
  });

  it('decodes hex numeric form &#x26; (ampersand)', () => {
    expect(decodeHtmlEntities('Smith &#x26; Sons')).toBe('Smith & Sons');
  });

  it('handles triple-escaping within the 3-pass cap', () => {
    // &amp;amp;amp; → &amp;amp; → &amp; → &
    expect(decodeHtmlEntities('&amp;amp;amp;')).toBe('&');
  });

  it('does not corrupt text that is already clean', () => {
    const clean = "O'Brien & Co. builds <great> things.";
    expect(decodeHtmlEntities(clean)).toBe(clean);
  });
});
