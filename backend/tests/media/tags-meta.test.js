import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/modules/user-management/shared/activity-logger.js', () => ({
  writeActivityAsync: vi.fn(),
}));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    media: { findMany: vi.fn() },
    mediaTag: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
    mediaTagPivot: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    mediaMetaField: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    mediaMetaValue: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/config/database.js';
import {
  normalizeTagName, createTag, renameTag, deleteTag,
  tagMedia, untagMedia, setMediaTags,
} from '../../src/modules/media/tags.service.js';
import {
  createMetaField, updateMetaField, deleteMetaField, setMediaMeta,
} from '../../src/modules/media/meta-fields.service.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('tags service', () => {
  it('normalizes tag names (trim, collapse spaces, lowercase)', () => {
    expect(normalizeTagName('  Logo   Design ')).toBe('logo design');
  });

  it('createTag stores normalized name', async () => {
    prisma.mediaTag.create.mockResolvedValue({ id: 't1', name: 'brand' });
    await createTag('  Brand ', 'u1');
    expect(prisma.mediaTag.create).toHaveBeenCalledWith({ data: { name: 'brand' } });
  });

  it('renameTag returns null for missing tag', async () => {
    prisma.mediaTag.findUnique.mockResolvedValue(null);
    expect(await renameTag('nope', 'x', 'u1')).toBeNull();
    expect(prisma.mediaTag.update).not.toHaveBeenCalled();
  });

  it('deleteTag deletes existing tag', async () => {
    prisma.mediaTag.findUnique.mockResolvedValue({ id: 't1', name: 'old' });
    prisma.mediaTag.delete.mockResolvedValue({});
    const deleted = await deleteTag('t1', 'u1');
    expect(deleted.name).toBe('old');
    expect(prisma.mediaTag.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
  });

  it('tagMedia bulk: upserts tags by name and links every found media', async () => {
    prisma.mediaTag.upsert
      .mockResolvedValueOnce({ id: 't1', name: 'brand' })
      .mockResolvedValueOnce({ id: 't2', name: 'logo' });
    prisma.media.findMany.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);
    prisma.mediaTagPivot.createMany.mockResolvedValue({ count: 4 });

    const result = await tagMedia(['m1', 'm2', 'm-deleted'], ['Brand', 'LOGO', 'brand'], 'u1');

    expect(prisma.mediaTag.upsert).toHaveBeenCalledTimes(2); // deduped
    expect(prisma.mediaTagPivot.createMany).toHaveBeenCalledWith({
      data: [
        { media_id: 'm1', tag_id: 't1' },
        { media_id: 'm1', tag_id: 't2' },
        { media_id: 'm2', tag_id: 't1' },
        { media_id: 'm2', tag_id: 't2' },
      ],
      skipDuplicates: true,
    });
    expect(result).toEqual({ tagged: 2, tags: ['brand', 'logo'] });
  });

  it('untagMedia removes pivot rows for matching tags only', async () => {
    prisma.mediaTag.findMany.mockResolvedValue([{ id: 't1', name: 'brand' }]);
    prisma.mediaTagPivot.deleteMany.mockResolvedValue({ count: 3 });

    const result = await untagMedia(['m1', 'm2'], ['Brand'], 'u1');

    expect(prisma.mediaTagPivot.deleteMany).toHaveBeenCalledWith({
      where: { media_id: { in: ['m1', 'm2'] }, tag_id: { in: ['t1'] } },
    });
    expect(result).toEqual({ removed: 3 });
  });

  it('untagMedia is a no-op when no tags match', async () => {
    prisma.mediaTag.findMany.mockResolvedValue([]);
    expect(await untagMedia(['m1'], ['ghost'], 'u1')).toEqual({ removed: 0 });
    expect(prisma.mediaTagPivot.deleteMany).not.toHaveBeenCalled();
  });

  it('setMediaTags replaces: deletes tags not in list, adds the rest', async () => {
    prisma.mediaTag.upsert.mockResolvedValueOnce({ id: 't9', name: 'new' });
    prisma.mediaTagPivot.deleteMany.mockResolvedValue({ count: 1 });
    prisma.mediaTagPivot.createMany.mockResolvedValue({ count: 1 });

    await setMediaTags('m1', ['New']);

    expect(prisma.mediaTagPivot.deleteMany).toHaveBeenCalledWith({
      where: { media_id: 'm1', tag_id: { notIn: ['t9'] } },
    });
    expect(prisma.mediaTagPivot.createMany).toHaveBeenCalledWith({
      data: [{ media_id: 'm1', tag_id: 't9' }],
      skipDuplicates: true,
    });
  });

  it('setMediaTags with empty list clears all tags', async () => {
    prisma.mediaTagPivot.deleteMany.mockResolvedValue({ count: 2 });
    await setMediaTags('m1', []);
    expect(prisma.mediaTagPivot.deleteMany).toHaveBeenCalledWith({
      where: { media_id: 'm1', tag_id: { notIn: [] } },
    });
    expect(prisma.mediaTagPivot.createMany).not.toHaveBeenCalled();
  });
});

describe('meta fields service', () => {
  it('createMetaField defaults type to TEXT and options to null', async () => {
    prisma.mediaMetaField.create.mockResolvedValue({ id: 'f1', slug: 'client', label: 'Client' });
    await createMetaField({ slug: 'client', label: 'Client' }, 'u1');
    expect(prisma.mediaMetaField.create).toHaveBeenCalledWith({
      data: { slug: 'client', label: 'Client', field_type: 'TEXT', options: null },
    });
  });

  it('updateMetaField rejects slug/type change on system fields', async () => {
    prisma.mediaMetaField.findUnique.mockResolvedValue({ id: 'f1', is_system: true });
    await expect(updateMetaField('f1', { slug: 'other' }, 'u1')).rejects.toMatchObject({ status: 422 });
  });

  it('deleteMetaField rejects system fields, deletes custom ones', async () => {
    prisma.mediaMetaField.findUnique.mockResolvedValueOnce({ id: 'f1', is_system: true, label: 'Sys' });
    await expect(deleteMetaField('f1', 'u1')).rejects.toMatchObject({ status: 422 });

    prisma.mediaMetaField.findUnique.mockResolvedValueOnce({ id: 'f2', is_system: false, label: 'Custom' });
    prisma.mediaMetaField.delete.mockResolvedValue({});
    await deleteMetaField('f2', 'u1');
    expect(prisma.mediaMetaField.delete).toHaveBeenCalledWith({ where: { id: 'f2' } });
  });

  it('setMediaMeta rejects unknown slugs with 422', async () => {
    prisma.mediaMetaField.findMany.mockResolvedValue([{ id: 'f1', slug: 'client', field_type: 'TEXT' }]);
    await expect(setMediaMeta('m1', { client: 'Acme', ghost: 'x' }))
      .rejects.toMatchObject({ status: 422 });
  });

  it('setMediaMeta upserts valid values and clears null/empty ones', async () => {
    prisma.mediaMetaField.findMany.mockResolvedValue([
      { id: 'f1', slug: 'client', field_type: 'TEXT' },
      { id: 'f2', slug: 'campaign', field_type: 'TEXT' },
    ]);
    prisma.mediaMetaValue.upsert.mockResolvedValue({});
    prisma.mediaMetaValue.deleteMany.mockResolvedValue({ count: 1 });

    await setMediaMeta('m1', { client: 'Acme', campaign: null });

    expect(prisma.mediaMetaValue.upsert).toHaveBeenCalledWith({
      where: { media_id_field_id: { media_id: 'm1', field_id: 'f1' } },
      create: { media_id: 'm1', field_id: 'f1', value: 'Acme' },
      update: { value: 'Acme' },
    });
    expect(prisma.mediaMetaValue.deleteMany).toHaveBeenCalledWith({
      where: { media_id: 'm1', field_id: 'f2' },
    });
  });

  it('setMediaMeta validates NUMBER, DATE and SELECT types', async () => {
    prisma.mediaMetaField.findMany.mockResolvedValue([
      { id: 'f1', slug: 'budget', field_type: 'NUMBER' },
      { id: 'f2', slug: 'due', field_type: 'DATE' },
      { id: 'f3', slug: 'license', field_type: 'SELECT', options: ['cc', 'paid'] },
    ]);
    prisma.mediaMetaValue.upsert.mockResolvedValue({});

    await expect(setMediaMeta('m1', { budget: 'abc' })).rejects.toMatchObject({ status: 422 });
    await expect(setMediaMeta('m1', { due: 'not-a-date' })).rejects.toMatchObject({ status: 422 });
    await expect(setMediaMeta('m1', { license: 'free' })).rejects.toMatchObject({ status: 422 });

    await setMediaMeta('m1', { budget: '42.5', due: '2026-07-08', license: 'cc' });
    expect(prisma.mediaMetaValue.upsert).toHaveBeenCalledTimes(3);
  });
});
