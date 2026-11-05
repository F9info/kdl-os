import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  prisma: {
    appSetting: { findMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(async (ops) => Promise.all(ops)),
  },
  resolveAssetUrls: vi.fn(async (o) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v ? `https://signed/${v}` : '']))
  ),
}));
vi.mock('../../config/database.js', () => ({ prisma: h.prisma }));
vi.mock('../identity/service.js', () => ({ resolveAssetUrls: h.resolveAssetUrls }));

const { seoSchema, seoDefaultsSchema, cleanSeo, getSeoDefaults, saveSeoDefaults, getPublicSeo } =
  await import('./seo.js');
const { updatePageSchema } = await import('./schema.js');

beforeEach(() => {
  vi.clearAllMocks();
  h.prisma.appSetting.findMany.mockResolvedValue([]);
});

describe('seoSchema', () => {
  it('accepts a full valid object and empty strings (clear)', () => {
    expect(
      seoSchema.safeParse({
        title: 'T',
        description: 'D',
        og_image: '/a.png',
        canonical: 'https://x.co/a',
        noindex: true,
      }).success
    ).toBe(true);
    expect(seoSchema.safeParse({ title: '', canonical: '', og_image: '' }).success).toBe(true);
  });
  it('rejects too long, bad canonical, bad image, unknown keys', () => {
    expect(seoSchema.safeParse({ title: 'x'.repeat(121) }).success).toBe(false);
    expect(seoSchema.safeParse({ description: 'x'.repeat(301) }).success).toBe(false);
    expect(seoSchema.safeParse({ canonical: 'javascript:alert(1)' }).success).toBe(false);
    expect(seoSchema.safeParse({ canonical: '/relative' }).success).toBe(false);
    expect(seoSchema.safeParse({ og_image: 'a b' }).success).toBe(false);
    expect(seoSchema.safeParse({ robots: 'x' }).success).toBe(false);
  });
  it('is part of the page update schema (nullable)', () => {
    expect(updatePageSchema.safeParse({ seo: null }).success).toBe(true);
    expect(updatePageSchema.safeParse({ seo: { noindex: 'yes' } }).success).toBe(false);
  });
});

describe('cleanSeo', () => {
  it('keeps whitelisted non-empty values, trims, noindex only when true; null when empty', () => {
    expect(cleanSeo({ title: ' T ', description: '', secret: 'x', noindex: false })).toEqual({ title: 'T' });
    expect(cleanSeo({ noindex: true })).toEqual({ noindex: true });
    expect(cleanSeo({ title: ' ' })).toBeNull();
    expect(cleanSeo(null)).toBeNull();
    expect(cleanSeo('x')).toBeNull();
  });
});

describe('defaults', () => {
  it('title template must contain %s', () => {
    expect(seoDefaultsSchema.safeParse({ title_template: '%s | Co' }).success).toBe(true);
    expect(seoDefaultsSchema.safeParse({ title_template: '' }).success).toBe(true);
    expect(seoDefaultsSchema.safeParse({ title_template: 'Co' }).success).toBe(false);
  });
  it('getSeoDefaults fills missing keys with empty strings', async () => {
    h.prisma.appSetting.findMany.mockResolvedValue([{ key: 'seo.title_template', value: '%s | Co' }]);
    expect(await getSeoDefaults()).toEqual({ title_template: '%s | Co', default_og_image: '' });
  });
  it('saveSeoDefaults upserts only the given keys', async () => {
    await saveSeoDefaults({ default_og_image: 'media/og.png' });
    expect(h.prisma.appSetting.upsert).toHaveBeenCalledTimes(1);
    expect(h.prisma.appSetting.upsert.mock.calls[0][0].where).toEqual({ key: 'seo.default_og_image' });
  });
});

describe('getPublicSeo', () => {
  it('null/null when nothing is set', async () => {
    expect(await getPublicSeo(null)).toEqual({ seo: null, seoDefaults: null });
  });
  it('resolves the page og image and the default image; drops stray keys', async () => {
    h.prisma.appSetting.findMany.mockResolvedValue([
      { key: 'seo.title_template', value: '%s | Co' },
      { key: 'seo.default_og_image', value: 'media/d.png' },
    ]);
    const r = await getPublicSeo({ title: 'T', og_image: 'media/p.png', evil: 1 });
    expect(r.seo).toEqual({ title: 'T', og_image: 'https://signed/media/p.png' });
    expect(r.seoDefaults).toEqual({ title_template: '%s | Co', og_image: 'https://signed/media/d.png' });
  });
});
