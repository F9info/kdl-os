import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  prisma: { site: { findFirst: vi.fn(), update: vi.fn() } },
  resolveAssetUrls: vi.fn(async (o) => ({ ...o, logo_light: 'https://signed/logo.png' })),
}));
vi.mock('../../config/database.js', () => ({ prisma: h.prisma }));
vi.mock('../identity/service.js', () => ({ resolveAssetUrls: h.resolveAssetUrls }));

const { getSiteIdentity, saveSiteIdentity, getPublicSiteIdentity } = await import('./site-identity.js');
const { saveSiteIdentitySchema, SITE_IDENTITY_KEYS } = await import('./schema.js');

const site = (identity_overrides) =>
  h.prisma.site.findFirst.mockResolvedValue({ id: 's1', identity_overrides });

beforeEach(() => {
  vi.clearAllMocks();
  site(null);
});

describe('saveSiteIdentitySchema', () => {
  const parse = (body) => saveSiteIdentitySchema.safeParse({ params: { id: 'p', siteId: 's' }, body });
  it('accepts overridable keys and empty strings (clear)', () => {
    expect(parse({ app_name: 'Spring', description: 'Hi', logo_light: '' }).success).toBe(true);
  });
  it('rejects keys a site may not override, bad values and unknown keys', () => {
    expect(parse({ contact_email: 'a@b.co' }).success).toBe(false);
    expect(parse({ brand_primary: '#fff' }).success).toBe(false); // colours are not applied to sites
    expect(parse({ nope: 'x' }).success).toBe(false);
    expect(parse({ logo_light: 'a b' }).success).toBe(false);
  });
  it('every overridable key exists in the project identity', () => {
    expect(SITE_IDENTITY_KEYS.length).toBeGreaterThan(0);
  });
});

describe('saveSiteIdentity', () => {
  it('merges: sets non-empty values, empty string removes, other keys kept', async () => {
    site({ app_name: 'Old', description: 'Keep me' });
    const next = await saveSiteIdentity('p1', 's1', { app_name: '', favicon: '/f.ico' });
    expect(next).toEqual({ description: 'Keep me', favicon: '/f.ico' });
    expect(h.prisma.site.update.mock.calls[0][0].data.identity_overrides).toEqual(next);
  });
  it('stores null when nothing is left', async () => {
    site({ app_name: 'Old' });
    await saveSiteIdentity('p1', 's1', { app_name: '' });
    expect(h.prisma.site.update.mock.calls[0][0].data.identity_overrides).toBeNull();
  });
  it('404 when the site is not in that project', async () => {
    h.prisma.site.findFirst.mockResolvedValue(null);
    await expect(saveSiteIdentity('p1', 'x', {})).rejects.toMatchObject({ status: 404 });
    expect(h.prisma.site.findFirst.mock.calls[0][0].where).toMatchObject({
      id: 'x',
      project_id: 'p1',
      deleted_at: null,
    });
  });
});

describe('getSiteIdentity / getPublicSiteIdentity', () => {
  it('drops stray keys and blanks stored in the JSON', async () => {
    site({ app_name: 'Spring', secret: 'x', description: '  ', logo_light: 7 });
    expect(await getSiteIdentity('p1', 's1')).toEqual({ app_name: 'Spring' });
  });
  it('public: null without overrides or site; resolves asset URLs otherwise', async () => {
    expect(await getPublicSiteIdentity(null)).toBeNull();
    expect(await getPublicSiteIdentity('s1')).toBeNull();
    site({ app_name: 'Spring', logo_light: 'media/l.png' });
    expect(await getPublicSiteIdentity('s1')).toEqual({
      app_name: 'Spring',
      logo_light: 'https://signed/logo.png',
    });
  });
});
