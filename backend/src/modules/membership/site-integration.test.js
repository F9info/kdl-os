import { describe, it, expect } from 'vitest';
import { patchPageData } from './site-integration.js';

const page = () => ({
  content: [
    { type: 'ConstructionHeader', props: { id: 'h', links: 'Home|/p/demo-home', loginLabel: '', loginHref: '#login', ctaLabel: 'Get a Quote', ctaHref: '/p/demo-contact' } },
    { type: 'ConstructionHero', props: { id: 'x' } },
    { type: 'ConstructionFooter', props: { id: 'f', links: 'Home|/p/demo-home' } },
  ],
});

describe('patchPageData', () => {
  it('adds menu link, login + CTA buttons, footer links and home banner', () => {
    const out = patchPageData(page(), 'demo-home');
    expect(out.content[0].props).toMatchObject({ links: 'Home|/p/demo-home\nMembership|/membership', loginLabel: 'Log in', loginHref: '/membership/login', ctaLabel: 'Become a member', ctaHref: '/membership' });
    expect(out.content[2].props.id).toBe('membership-banner');
    expect(out.content[3].props.links).toContain('Member login|/membership/login');
  });
  it('is idempotent and skips the banner on non-home pages', () => {
    const once = patchPageData(page(), 'demo-home');
    expect(patchPageData(once, 'demo-home')).toEqual(once);
    expect(patchPageData(page(), 'demo-about').content).toHaveLength(3);
  });
});
