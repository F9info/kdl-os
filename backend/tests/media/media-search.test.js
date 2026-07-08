import { describe, it, expect, vi, beforeEach } from 'vitest';

const searchMock = vi.fn();
const addDocumentsMock = vi.fn();
const deleteDocumentMock = vi.fn();

vi.mock('../../src/config/meilisearch.js', () => ({
  meili: {
    index: vi.fn(() => ({
      search: searchMock,
      addDocuments: addDocumentsMock,
      deleteDocument: deleteDocumentMock,
      updateSettings: vi.fn(),
    })),
    getIndex: vi.fn(),
    createIndex: vi.fn(),
  },
}));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    media: { findFirst: vi.fn(), findMany: vi.fn() },
    mediaFolder: { findUnique: vi.fn() },
  },
}));

import { prisma } from '../../src/config/database.js';
import {
  buildMediaDoc, buildSearchFilter, searchMedia, indexMediaById,
} from '../../src/modules/media/media-search.service.js';

beforeEach(() => { vi.clearAllMocks(); });

const mediaRow = {
  id: 'm1',
  original_name: 'hero-shot.jpg',
  title: 'Hero',
  alt_text: 'Hero image',
  caption: null,
  mime_type: 'image/jpeg',
  size: 12345,
  width: 800,
  height: 600,
  type: 'IMAGE',
  user_id: 'u1',
  folder_id: 'f1',
  is_archived: false,
  created_at: new Date('2026-07-01T00:00:00Z'),
  updated_at: new Date('2026-07-02T00:00:00Z'),
  exif: {
    camera: { make: 'Canon', model: 'EOS R5' },
    gps: { latitude: 12.97, longitude: 77.59, altitude: null },
    taken_at: '2026-01-15T10:30:00.000Z',
  },
  tags: [
    { tag: { id: 't2', name: 'logo' } },
    { tag: { id: 't1', name: 'brand' } },
  ],
  meta_values: [
    { field: { slug: 'client' }, value: 'Acme' },
    { field: { slug: 'campaign' }, value: 'Summer' },
  ],
  folder: { id: 'f1', name: 'Shoots', parent_id: 'f0' },
  user: { id: 'u1', name: 'Alice', email: 'a@x.com' },
};

describe('buildMediaDoc — index doc shape', () => {
  it('produces the flat searchable document', async () => {
    prisma.mediaFolder.findUnique.mockResolvedValueOnce({ id: 'f0', name: 'Media', parent_id: null });

    const doc = await buildMediaDoc(mediaRow);

    expect(doc).toEqual({
      id: 'm1',
      name: 'hero-shot.jpg',
      title: 'Hero',
      alt: 'Hero image',
      caption: null,
      tags: ['brand', 'logo'],
      meta: { client: 'Acme', campaign: 'Summer' },
      meta_text: 'Acme Summer',
      meta_kv: ['client:Acme', 'campaign:Summer'],
      folder_id: 'f1',
      folder_path: 'Media/Shoots',
      type: 'IMAGE',
      owner_id: 'u1',
      owner_name: 'Alice',
      mime_type: 'image/jpeg',
      size: 12345,
      width: 800,
      height: 600,
      camera_make: 'Canon',
      camera_model: 'EOS R5',
      has_gps: true,
      gps: { latitude: 12.97, longitude: 77.59, altitude: null },
      taken_at: '2026-01-15T10:30:00.000Z',
      is_archived: false,
      created_at: mediaRow.created_at,
      created_at_ts: new Date('2026-07-01T00:00:00Z').getTime(),
      updated_at: mediaRow.updated_at,
    });
  });

  it('handles media without tags/meta/exif/folder', async () => {
    const bare = {
      ...mediaRow, tags: [], meta_values: [], exif: null, folder: null, folder_id: null, user: null,
    };
    const doc = await buildMediaDoc(bare);
    expect(doc.tags).toEqual([]);
    expect(doc.meta).toEqual({});
    expect(doc.meta_kv).toEqual([]);
    expect(doc.camera_make).toBeNull();
    expect(doc.has_gps).toBe(false);
    expect(doc.folder_path).toBe('');
    expect(doc.owner_name).toBeNull();
  });
});

describe('buildSearchFilter', () => {
  it('combines type, tags, meta, folder, dates, size into AND filter', () => {
    const filter = buildSearchFilter({
      type: 'IMAGE',
      tags: ['brand', 'logo'],
      meta: { client: 'Acme' },
      folder_id: 'f1',
      owner_id: 'u1',
      date_from: '2026-01-01',
      date_to: '2026-12-31',
      size_min: '1000',
      size_max: '500000',
    });
    expect(filter).toBe([
      'type = "IMAGE"',
      'folder_id = "f1"',
      'owner_id = "u1"',
      'tags = "brand"',
      'tags = "logo"',
      'meta_kv = "client:Acme"',
      `created_at_ts >= ${new Date('2026-01-01').getTime()}`,
      `created_at_ts <= ${new Date('2026-12-31').getTime()}`,
      'size >= 1000',
      'size <= 500000',
      'is_archived = false',
    ].join(' AND '));
  });

  it('excludes archived by default, includes with archived=all', () => {
    expect(buildSearchFilter({})).toBe('is_archived = false');
    expect(buildSearchFilter({ archived: 'all' })).toBe('');
    expect(buildSearchFilter({ archived: 'true' })).toBe('is_archived = true');
  });

  it('escapes quotes in filter values', () => {
    expect(buildSearchFilter({ folder_id: 'x"y', archived: 'all' })).toBe('folder_id = "x\\"y"');
  });
});

describe('searchMedia', () => {
  it('passes facets and pagination to meili and shapes the response', async () => {
    searchMock.mockResolvedValue({
      hits: [{ id: 'm1' }],
      estimatedTotalHits: 41,
      facetDistribution: { type: { IMAGE: 40, VIDEO: 1 } },
    });

    const result = await searchMedia({ q: 'hero', type: 'IMAGE', page: '2', limit: '20' });

    expect(searchMock).toHaveBeenCalledWith('hero', expect.objectContaining({
      facets: ['type', 'tags', 'folder_id', 'owner_id', 'camera_make'],
      limit: 20,
      offset: 20,
      filter: 'type = "IMAGE" AND is_archived = false',
      sort: ['created_at_ts:desc'],
    }));
    expect(result.hits).toEqual([{ id: 'm1' }]);
    expect(result.facets).toEqual({ type: { IMAGE: 40, VIDEO: 1 } });
    expect(result.pagination).toEqual({ page: 2, limit: 20, total: 41, pages: 3 });
  });
});

describe('indexMediaById', () => {
  it('indexes a live row', async () => {
    prisma.media.findFirst.mockResolvedValue({ ...mediaRow, folder: null, folder_id: null });
    await indexMediaById('m1');
    expect(addDocumentsMock).toHaveBeenCalledTimes(1);
    expect(addDocumentsMock.mock.calls[0][0][0].id).toBe('m1');
  });

  it('removes trashed/missing rows from the index', async () => {
    prisma.media.findFirst.mockResolvedValue(null);
    await indexMediaById('gone');
    expect(deleteDocumentMock).toHaveBeenCalledWith('gone');
    expect(addDocumentsMock).not.toHaveBeenCalled();
  });
});
