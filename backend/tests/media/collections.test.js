import { describe, it, expect, vi, beforeEach } from 'vitest';

const { searchMediaMock } = vi.hoisted(() => ({ searchMediaMock: vi.fn() }));
vi.mock('../../src/modules/media/media-search.service.js', () => ({
  searchMedia: searchMediaMock,
  enqueueReindex: vi.fn(),
}));

vi.mock('../../src/modules/media/service.js', () => ({
  resolveUrls: vi.fn(async (m) => ({ ...m, url: `https://cdn/${m.id}` })),
}));

vi.mock('../../src/modules/user-management/shared/activity-logger.js', () => ({
  writeActivityAsync: vi.fn(),
}));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    media: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    mediaCollection: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    mediaCollectionItem: { findMany: vi.fn(), count: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
    mediaFavorite: { findMany: vi.fn(), count: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

import { prisma } from '../../src/config/database.js';
import {
  sanitizeRules, evaluateSmartCollection, createCollection,
  addCollectionItems, getCollectionContents,
  favoriteMedia, unfavoriteMedia, touchMedia, listRecents,
} from '../../src/modules/media/collections.service.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('smart collection rules eval', () => {
  it('sanitizeRules keeps only known search keys', () => {
    expect(sanitizeRules({
      q: 'hero', type: 'IMAGE', tags: ['brand'],
      limit: 9999, attributesToRetrieve: ['*'], filter: 'id EXISTS', __proto__x: 1,
    })).toEqual({ q: 'hero', type: 'IMAGE', tags: ['brand'] });
  });

  it('sanitizeRules tolerates junk input', () => {
    expect(sanitizeRules(null)).toEqual({});
    expect(sanitizeRules('drop table')).toEqual({});
    expect(sanitizeRules([1, 2])).toEqual({});
  });

  it('evaluateSmartCollection runs sanitized rules through search with paging', async () => {
    searchMediaMock.mockResolvedValue({ hits: [{ id: 'm1' }], facets: {}, pagination: {} });
    const result = await evaluateSmartCollection(
      { type: 'IMAGE', tags: ['brand'], filter: 'evil' },
      { page: 2, limit: 10 },
    );
    expect(searchMediaMock).toHaveBeenCalledWith({ type: 'IMAGE', tags: ['brand'], page: 2, limit: 10 });
    expect(result.hits).toEqual([{ id: 'm1' }]);
  });

  it('createCollection stores sanitized rules for smart, null rules for static', async () => {
    prisma.mediaCollection.create.mockResolvedValue({ id: 'c1', name: 'X' });
    await createCollection({ name: 'X', is_smart: true, rules: { type: 'IMAGE', filter: 'evil' } }, 'u1');
    expect(prisma.mediaCollection.create).toHaveBeenCalledWith({
      data: { name: 'X', is_smart: true, rules: { type: 'IMAGE' }, created_by: 'u1' },
    });

    await createCollection({ name: 'Y', rules: { type: 'IMAGE' } }, 'u1');
    expect(prisma.mediaCollection.create).toHaveBeenLastCalledWith({
      data: { name: 'Y', is_smart: false, rules: null, created_by: 'u1' },
    });
  });

  it('getCollectionContents evaluates rules for smart collections', async () => {
    prisma.mediaCollection.findUnique.mockResolvedValue({ id: 'c1', is_smart: true, rules: { type: 'VIDEO' } });
    searchMediaMock.mockResolvedValue({ hits: [], facets: {}, pagination: { total: 0 } });
    const result = await getCollectionContents('c1', { page: 1, limit: 24 });
    expect(searchMediaMock).toHaveBeenCalledWith({ type: 'VIDEO', page: 1, limit: 24 });
    expect(result.collection.id).toBe('c1');
  });

  it('getCollectionContents reads items from DB for static collections', async () => {
    prisma.mediaCollection.findUnique.mockResolvedValue({ id: 'c2', is_smart: false });
    prisma.mediaCollectionItem.findMany.mockResolvedValue([{ media: { id: 'm1' } }]);
    prisma.mediaCollectionItem.count.mockResolvedValue(1);
    const result = await getCollectionContents('c2', {});
    expect(searchMediaMock).not.toHaveBeenCalled();
    expect(result.hits).toEqual([{ id: 'm1', url: 'https://cdn/m1' }]);
    expect(result.pagination.total).toBe(1);
  });

  it('addCollectionItems rejects manual adds on smart collections', async () => {
    prisma.mediaCollection.findUnique.mockResolvedValue({ id: 'c1', is_smart: true });
    await expect(addCollectionItems('c1', ['m1'], 'u1')).rejects.toMatchObject({ status: 422 });
  });

  it('addCollectionItems links only live media, skipping duplicates', async () => {
    prisma.mediaCollection.findUnique.mockResolvedValue({ id: 'c2', is_smart: false, name: 'C' });
    prisma.media.findMany.mockResolvedValue([{ id: 'm1' }]);
    prisma.mediaCollectionItem.createMany.mockResolvedValue({ count: 1 });
    const result = await addCollectionItems('c2', ['m1', 'm-trashed'], 'u1');
    expect(prisma.mediaCollectionItem.createMany).toHaveBeenCalledWith({
      data: [{ collection_id: 'c2', media_id: 'm1' }],
      skipDuplicates: true,
    });
    expect(result).toEqual({ added: 1 });
  });
});

describe('favorites + recents', () => {
  it('favoriteMedia upserts (idempotent), returns null for missing media', async () => {
    prisma.media.findFirst.mockResolvedValueOnce({ id: 'm1' });
    prisma.mediaFavorite.upsert.mockResolvedValue({});
    expect(await favoriteMedia('u1', 'm1')).toEqual({ favorited: true });
    expect(prisma.mediaFavorite.upsert).toHaveBeenCalledWith({
      where: { user_id_media_id: { user_id: 'u1', media_id: 'm1' } },
      create: { user_id: 'u1', media_id: 'm1' },
      update: {},
    });

    prisma.media.findFirst.mockResolvedValueOnce(null);
    expect(await favoriteMedia('u1', 'gone')).toBeNull();
  });

  it('unfavoriteMedia deletes the pivot', async () => {
    prisma.mediaFavorite.deleteMany.mockResolvedValue({ count: 1 });
    expect(await unfavoriteMedia('u1', 'm1')).toEqual({ favorited: false });
  });

  it('touchMedia stamps last_used_at on live media only', async () => {
    prisma.media.findFirst.mockResolvedValueOnce({ id: 'm1' });
    prisma.media.update.mockResolvedValue({ id: 'm1' });
    await touchMedia('m1');
    expect(prisma.media.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { last_used_at: expect.any(Date) },
    });

    prisma.media.findFirst.mockResolvedValueOnce(null);
    expect(await touchMedia('gone')).toBeNull();
  });

  it('listRecents orders by last_used_at desc and excludes never-used', async () => {
    prisma.media.findMany.mockResolvedValue([{ id: 'm2' }, { id: 'm1' }]);
    prisma.media.count.mockResolvedValue(2);
    const result = await listRecents({});
    expect(prisma.media.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { deleted_at: null, last_used_at: { not: null } },
      orderBy: { last_used_at: 'desc' },
    }));
    expect(result.media.map((m) => m.id)).toEqual(['m2', 'm1']);
  });
});
