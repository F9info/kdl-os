import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
// Keep the real CMS page builders; only observe the sample-content seeding.
vi.mock('../cms/pages.js', async (orig) => ({ ...(await orig()), seedCmsSamples: vi.fn() }));

import { prisma } from '../../config/database.js';
import { seedCmsSamples } from '../cms/pages.js';
import {
  getOnboarding,
  answerOnboarding,
  createStarterSite,
  buildPageData,
  STARTER_PAGES,
  ONBOARDING_KEY,
} from './onboarding.js';

beforeEach(() => {
  vi.clearAllMocks();
  prisma.appSetting = { findUnique: vi.fn(), upsert: vi.fn().mockResolvedValue({}) };
  prisma.project = { findFirst: vi.fn().mockResolvedValue({ id: 'p1' }) };
  prisma.module = { findUnique: vi.fn().mockResolvedValue(null) }; // CMS not installed
  prisma.menu = { upsert: vi.fn().mockResolvedValue({ id: 'm1' }) };
  prisma.menuItem = {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
  };
  prisma.site = { findFirst: vi.fn().mockResolvedValue({ id: 'site-1' }) };
  prisma.builderPage = {
    create: vi.fn().mockImplementation(async ({ data }) => ({ id: `id-${data.slug}` })),
    findFirst: vi.fn().mockResolvedValue(null), // no page with that slug yet
    findMany: vi.fn().mockResolvedValue([]),
  };
});

describe('onboarding — state', () => {
  it('is unanswered until a choice is stored', async () => {
    prisma.appSetting.findUnique.mockResolvedValue(null);
    expect(await getOnboarding()).toEqual({ answered: false, choice: null });
    prisma.appSetting.findUnique.mockResolvedValue({ value: 'no' });
    expect(await getOnboarding()).toEqual({ answered: true, choice: 'no' });
  });
});

describe('onboarding — answer', () => {
  it('"no" stores the choice and creates nothing', async () => {
    const r = await answerOnboarding('no', 'u1');
    expect(r).toEqual({ choice: 'no', created: [], skipped: [] });
    expect(prisma.builderPage.create).not.toHaveBeenCalled();
    expect(prisma.appSetting.upsert.mock.calls[0][0].where.key).toBe(ONBOARDING_KEY);
  });

  it('"yes" creates and publishes the five pages in the default project', async () => {
    const r = await answerOnboarding('yes', 'u1');
    expect(r.created).toEqual(['home', 'about', 'services', 'contact', 'faq']);
    expect(prisma.builderPage.create).toHaveBeenCalledTimes(5);
    const first = prisma.builderPage.create.mock.calls[0][0].data;
    expect(first.site_id).toBe('site-1'); // pages join the project's default site
    expect(first).toMatchObject({
      slug: 'home',
      status: 'PUBLISHED',
      project_id: 'p1',
      created_by: 'u1',
    });
    expect(prisma.appSetting.upsert.mock.calls[0][0].update.value).toBe('yes');
  });

  it('is idempotent: pages whose slug exists are skipped', async () => {
    prisma.builderPage.findFirst.mockImplementation(async ({ where }) => (where.slug === 'about' ? { id: 'x' } : null));
    const r = await answerOnboarding('yes', 'u1');
    expect(r.skipped).toEqual(['about']);
    expect(r.created).toHaveLength(4);
  });

  it('does not save "yes" when page creation fails, so the pop-up returns', async () => {
    prisma.builderPage.create.mockRejectedValueOnce(new Error('db down'));
    await expect(answerOnboarding('yes', 'u1')).rejects.toThrow('db down');
    expect(prisma.appSetting.upsert).not.toHaveBeenCalled();
  });

  it('409 when no default project exists', async () => {
    prisma.project.findFirst.mockResolvedValue(null);
    await expect(answerOnboarding('yes', 'u1')).rejects.toMatchObject({ status: 409 });
  });
});

describe('onboarding — sample content for the CMS', () => {
  it('"yes" with CMS installed also seeds the sample rows, before recording the answer', async () => {
    prisma.module.findUnique.mockResolvedValue({ status: 'ENABLED' });
    const order = [];
    seedCmsSamples.mockImplementation(async () => order.push('samples'));
    prisma.appSetting.upsert.mockImplementation(async () => order.push('saved'));
    await answerOnboarding('yes', 'u1');
    expect(seedCmsSamples).toHaveBeenCalledWith(prisma);
    expect(order).toEqual(['samples', 'saved']);
  });

  it('"yes" without CMS seeds nothing extra, and "no" never seeds', async () => {
    await answerOnboarding('yes', 'u1'); // CMS not installed in this setup
    await answerOnboarding('no', 'u1');
    expect(seedCmsSamples).not.toHaveBeenCalled();
  });
});

describe('onboarding — page content', () => {
  it.each(STARTER_PAGES)(
    '$slug has NavBar first, Footer last, unique block ids',
    ({ slug, title }) => {
      const { content } = buildPageData(slug, title);
      expect(content[0].type).toBe('NavBar');
      expect(content.at(-1).type).toBe('Footer');
      const ids = content.map((b) => b.props.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(content[0].props.links.split('\n')).toHaveLength(5);
    }
  );
});

describe('createStarterSite — company name from Application Identity', () => {
  const identity = (name) =>
    prisma.appSetting.findUnique.mockImplementation(async ({ where }) =>
      where.key === 'identity.app_name' && name !== undefined ? { value: name } : null
    );
  const homeTitle = () => {
    const home = prisma.builderPage.create.mock.calls.find((c) => c[0].data.slug === 'home')[0].data;
    return home.data;
  };

  it('uses the Identity company name in the generated pages (hero text, header and footer brand)', async () => {
    identity('Acme Pvt Ltd');
    await createStarterSite(prisma, 'u1');
    const data = homeTitle();
    const text = JSON.stringify(data);
    expect(text).toContain('Welcome to Acme Pvt Ltd');
    expect(text).not.toContain('Your Brand');
    expect(data.content[0].props.brand).toBe('Acme Pvt Ltd'); // NavBar
    expect(data.content.at(-1).props.copyright).toContain('Acme Pvt Ltd'); // Footer
  });

  it('falls back to the placeholder only when Identity has no name', async () => {
    identity(undefined);
    await createStarterSite(prisma, 'u1');
    expect(JSON.stringify(homeTitle())).toContain('Welcome to Your Brand');
  });

  it('withCms: true adds the CMS pages even before the CMS module row is enabled (install seed)', async () => {
    identity('Acme');
    const r = await createStarterSite(prisma, null, { withCms: true });
    expect(r.created).toEqual(expect.arrayContaining(['home', 'gallery', 'team', 'case-studies']));
  });

  it('a normal run without CMS creates only the five starter pages', async () => {
    identity('Acme');
    const r = await createStarterSite(prisma, null);
    expect(r.created).toEqual(['home', 'about', 'services', 'contact', 'faq']);
  });
});
