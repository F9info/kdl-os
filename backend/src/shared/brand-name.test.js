import { describe, it, expect, vi } from 'vitest';
import { brandName, withBrand, BRAND_PLACEHOLDER } from './brand-name.js';

const client = (settings) => ({
  appSetting: { findUnique: vi.fn(async ({ where }) => (settings[where.key] ? { value: settings[where.key] } : null)) },
});

describe('brandName', () => {
  it('is the company name from Identity, then the app name, then the placeholder', async () => {
    expect(await brandName(client({ 'identity.company_name': ' Acme ', 'identity.app_name': 'App' }))).toBe('Acme');
    expect(await brandName(client({ 'identity.app_name': 'App' }))).toBe('App');
    expect(await brandName(client({}))).toBe(BRAND_PLACEHOLDER);
  });
});

describe('withBrand', () => {
  it('swaps the sample company word for the real name, everywhere in the text', () => {
    expect(withBrand('Founder, DemoLogo. DemoLogo rocks', 'Acme')).toBe('Founder, Acme. Acme rocks');
    expect(withBrand('no placeholder here', 'Acme')).toBe('no placeholder here');
  });
});
