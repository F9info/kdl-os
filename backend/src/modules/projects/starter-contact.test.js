import { describe, it, expect, vi } from 'vitest';

vi.mock('../../shared/numbered-families.js', () => ({ normalizeData: (d) => d }));
vi.mock('./sites.js', () => ({ ensureDefaultSite: vi.fn() }));
const { buildStarterPage, contactDetails, STARTER_PAGES } = await import('./starter-site.js');

const body = (contact) =>
  buildStarterPage('contact', 'Contact', STARTER_PAGES, 'Acme', contact).content.filter((b) =>
    ['Text', 'Button'].includes(b.type)
  );

describe('starter Contact page', () => {
  it('shows the company details from Identity and an email button for the real address', () => {
    const [text, button] = body({ email: 'hi@acme.test', phone: '+91 98765 43210', address: '12 Park Avenue' });
    expect(text.props.text).toBe('Email: hi@acme.test\nPhone: +91 98765 43210\nAddress: 12 Park Avenue');
    expect(button.props.href).toBe('mailto:hi@acme.test');
  });

  it('leaves out a detail nobody entered', () => {
    const [text] = body({ phone: '+91 98765 43210' });
    expect(text.props.text).toBe('Phone: +91 98765 43210');
  });

  it('with no details at all there are no invented ones and no dead mail button', () => {
    const out = body({});
    expect(out).toHaveLength(1);
    expect(out[0].props.text).toBe('Send us a message and we will get back to you.');
    expect(JSON.stringify(buildStarterPage('contact', 'Contact', STARTER_PAGES, 'Acme'))).not.toMatch(
      /example\.com|000 000/
    );
  });
});

describe('contactDetails', () => {
  it('reads email, phone and address from the identity settings', async () => {
    const rows = { 'identity.contact_email': ' hi@acme.test ', 'identity.contact_phone': '123' };
    const client = { appSetting: { findUnique: vi.fn(async ({ where }) => (rows[where.key] ? { value: rows[where.key] } : null)) } };
    expect(await contactDetails(client)).toEqual({ email: 'hi@acme.test', phone: '123', address: '' });
  });
});
