import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../page-builder/service.js', () => ({ getPageBySlug: vi.fn() }));

import { prisma } from '../../config/database.js';
import { getPageBySlug } from '../page-builder/service.js';
import {
  getOnboarding,
  answerOnboarding,
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
  prisma.builderPage = {
    create: vi.fn().mockImplementation(async ({ data }) => ({ id: `id-${data.slug}` })),
  };
  getPageBySlug.mockResolvedValue(null);
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
    expect(first).toMatchObject({
      slug: 'home',
      status: 'PUBLISHED',
      project_id: 'p1',
      created_by: 'u1',
    });
    expect(prisma.appSetting.upsert.mock.calls[0][0].update.value).toBe('yes');
  });

  it('is idempotent: pages whose slug exists are skipped', async () => {
    getPageBySlug.mockImplementation(async (s) => (s === 'about' ? { id: 'x' } : null));
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
