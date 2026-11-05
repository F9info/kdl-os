/**
 * safeUrl is the shared stored-XSS / open-redirect guard for admin-entered links.
 * Pinned here for the modules that use it beyond menus: sectors and case studies.
 */
import { describe, it, expect } from 'vitest';
import { createSectorSchema } from '../../modules/sectors/schema.js';
import { createCaseStudySchema } from '../../modules/projects-content/schema.js';

const sector = (over) => createSectorSchema.safeParse({
  body: { name: 'Hotel', slug: 'hotel', ...over },
});
const caseStudy = (over) => createCaseStudySchema.safeParse({
  body: { title: 'Demo Project', ...over },
});

describe('link fields reject script/redirect URLs', () => {
  it.each(['javascript:alert(1)', 'data:text/html,x', '/\\evil.com', '//evil.com'])(
    'sector cta_href/canonical_url reject %j',
    (v) => {
      expect(sector({ cta_href: v }).success).toBe(false);
      expect(sector({ canonical_url: v }).success).toBe(false);
    }
  );
  it.each(['javascript:alert(1)', '//evil.com'])('case study cta_href/link_href reject %j', (v) => {
    expect(caseStudy({ cta_href: v }).success).toBe(false);
    expect(caseStudy({ link_href: v }).success).toBe(false);
  });
});

describe('real stored values still validate', () => {
  it.each(['#', '#get-quote', '/sectors/hotel', 'https://example.com/x', 'tel:+911234567890'])(
    'accepts %j',
    (v) => {
      expect(sector({ cta_href: v, canonical_url: v }).success).toBe(true);
      expect(caseStudy({ cta_href: v, link_href: v }).success).toBe(true);
    }
  );
});
