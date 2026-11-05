import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureDefaultSite, normalizeHost, resolvePublicSite } from './sites.js';

const client = () => ({
  site: { findFirst: vi.fn(), create: vi.fn() },
  project: { findFirst: vi.fn() },
});
let c;
beforeEach(() => (c = client()));

describe('ensureDefaultSite', () => {
  it('returns null without a project (no site for pages outside any project)', async () => {
    expect(await ensureDefaultSite(c, null)).toBeNull();
    expect(c.site.findFirst).not.toHaveBeenCalled();
  });

  it('reuses the existing default site', async () => {
    c.site.findFirst.mockResolvedValue({ id: 's1' });
    expect(await ensureDefaultSite(c, 'p1')).toBe('s1');
    expect(c.site.create).not.toHaveBeenCalled();
  });

  it('creates the main website site, named after the project, when missing', async () => {
    c.site.findFirst.mockResolvedValue(null);
    c.project.findFirst.mockResolvedValue({ name: 'Acme' });
    c.site.create.mockResolvedValue({ id: 's2' });
    expect(await ensureDefaultSite(c, 'p1')).toBe('s2');
    expect(c.site.create.mock.calls[0][0].data).toEqual({
      project_id: 'p1', type: 'WEBSITE', slug: 'main', name: 'Acme', is_default: true,
    });
  });

  it('returns null for an unknown project and creates nothing', async () => {
    c.site.findFirst.mockResolvedValue(null);
    c.project.findFirst.mockResolvedValue(null);
    expect(await ensureDefaultSite(c, 'nope')).toBeNull();
    expect(c.site.create).not.toHaveBeenCalled();
  });

  it('uses the other request\'s site when two race to create it (P2002)', async () => {
    c.site.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 's3' });
    c.project.findFirst.mockResolvedValue({ name: 'Acme' });
    c.site.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
    expect(await ensureDefaultSite(c, 'p1')).toBe('s3');
  });

  it('rethrows other database errors', async () => {
    c.site.findFirst.mockResolvedValue(null);
    c.project.findFirst.mockResolvedValue({ name: 'Acme' });
    c.site.create.mockRejectedValue(new Error('db down'));
    await expect(ensureDefaultSite(c, 'p1')).rejects.toThrow('db down');
  });
});

describe('normalizeHost', () => {
  it('lowercases, drops the port and a trailing dot, tolerates junk', () => {
    expect(normalizeHost('Blog.Example.COM:3001')).toBe('blog.example.com');
    expect(normalizeHost(' shop.example.com. ')).toBe('shop.example.com');
    expect(normalizeHost(undefined)).toBe('');
    expect(normalizeHost(null)).toBe('');
  });
});

describe('resolvePublicSite', () => {
  const site = (over = {}) => ({ id: 's1', project_id: 'p1', is_default: false, ...over });

  it('matches a custom domain (any case, with port) before anything else', async () => {
    c.site.findFirst.mockResolvedValue(site());
    const r = await resolvePublicSite(c, { host: 'Shop.Example.com:8080', siteSlug: 'x', projectId: 'pDefault' });
    expect(r).toEqual({ projectId: 'p1', siteId: 's1', isDefault: false });
    expect(c.site.findFirst.mock.calls[0][0].where).toEqual({ domain: 'shop.example.com', deleted_at: null });
  });

  it('an unknown host falls back to the default project\'s default site (localhost, IPs, new domains)', async () => {
    c.site.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'sMain' });
    expect(await resolvePublicSite(c, { host: 'unknown.test', projectId: 'p1' })).toEqual({
      projectId: 'p1', siteId: 'sMain', isDefault: true,
    });
  });

  it('uses ?site=<slug> inside the project, and returns null for an unknown slug', async () => {
    c.site.findFirst.mockResolvedValueOnce({ id: 'sLp', is_default: false });
    expect(await resolvePublicSite(c, { siteSlug: 'launch', projectId: 'p1' })).toEqual({
      projectId: 'p1', siteId: 'sLp', isDefault: false,
    });
    expect(c.site.findFirst.mock.calls[0][0].where).toEqual({ project_id: 'p1', slug: 'launch', deleted_at: null });
    c.site.findFirst.mockResolvedValueOnce(null);
    expect(await resolvePublicSite(c, { siteSlug: 'nope', projectId: 'p1' })).toBeNull();
  });

  it('a project with no site row yet still resolves (siteId null = no site filtering)', async () => {
    c.site.findFirst.mockResolvedValue(null);
    expect(await resolvePublicSite(c, { projectId: 'p1' })).toEqual({ projectId: 'p1', siteId: null, isDefault: true });
  });

  it('returns null when there is no project to fall back to', async () => {
    c.site.findFirst.mockResolvedValue(null);
    expect(await resolvePublicSite(c, { host: 'x.test' })).toBeNull();
  });
});
