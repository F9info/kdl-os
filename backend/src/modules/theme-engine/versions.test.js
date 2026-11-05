import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../../config/redis.js', () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));

import { prisma } from '../../config/database.js';
import { upsertValues, restoreVersion, listVersions } from './service.js';

const field = (id, extra = {}) => ({
  id,
  slug: `webapp.branding.light.brand_colors.${id}`,
  field_name: id,
  input_type: 'color',
  options: null,
  locked_by: null,
  value: '#111111', // field default
  ...extra,
});

function mockPrisma({ fields, stored = [] }) {
  prisma.type = { findUnique: vi.fn().mockResolvedValue({ slug: 'webapp.branding' }) };
  prisma.settingField = {
    findMany: vi.fn().mockResolvedValue(fields),
    updateMany: vi.fn(),
  };
  prisma.settingValue = {
    findMany: vi.fn().mockResolvedValue(stored),
    upsert: vi.fn((a) => a),
    deleteMany: vi.fn((a) => a),
  };
  prisma.themeValueVersion = {
    create: vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
  };
  prisma.templateEngineRun = { findFirst: vi.fn().mockResolvedValue(null) };
  prisma.$transaction = vi.fn().mockResolvedValue([]);
}

beforeEach(() => vi.clearAllMocks());

describe('theme versions — capture on save', () => {
  it('snapshots the previous value (null when it was on its default) when a save changes something', async () => {
    mockPrisma({ fields: [field('a'), field('b')], stored: [{ field_id: 'b', value: '#222222' }] });

    await upsertValues(
      'webapp',
      'type1',
      [
        { field_id: 'a', value: '#ff0000' },
        { field_id: 'b', value: '#222222' },
      ],
      'user1'
    );

    const data = prisma.themeValueVersion.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ platform: 'webapp', type_id: 'type1', created_by: 'user1' });
    expect(JSON.parse(data.snapshot)).toEqual([
      { field_id: 'a', value: null },
      { field_id: 'b', value: '#222222' },
    ]);
  });

  it('does not add a version when nothing actually changes', async () => {
    mockPrisma({ fields: [field('a')], stored: [{ field_id: 'a', value: '#333333' }] });
    await upsertValues('webapp', 'type1', [{ field_id: 'a', value: '#333333' }], 'user1');
    expect(prisma.themeValueVersion.create).not.toHaveBeenCalled();
  });

  it('does not snapshot writes made by the owning module (template-engine)', async () => {
    mockPrisma({ fields: [field('a')] });
    await upsertValues('webapp', 'type1', [{ field_id: 'a', value: '#ff0000' }], null, {
      lockedByModule: 'template-engine',
    });
    expect(prisma.themeValueVersion.create).not.toHaveBeenCalled();
  });
});

describe('theme versions — restore', () => {
  const version = {
    id: 'v1',
    platform: 'webapp',
    type_id: 'type1',
    snapshot: JSON.stringify([
      { field_id: 'a', value: null },
      { field_id: 'b', value: '#222222' },
    ]),
  };

  it('deletes rows that were on default and re-writes the rest, snapshotting the current state first', async () => {
    mockPrisma({ fields: [field('a'), field('b')], stored: [{ field_id: 'a', value: '#ff0000' }] });
    prisma.themeValueVersion.findUnique.mockResolvedValue(version);

    const res = await restoreVersion('v1', 'user1');

    expect(res).toMatchObject({ restored: 2, platform: 'webapp', type_id: 'type1' });
    expect(prisma.themeValueVersion.create).toHaveBeenCalledTimes(1); // so the restore can be undone
    expect(prisma.settingValue.deleteMany).toHaveBeenCalledWith({ where: { field_id: 'a' } });
    expect(prisma.settingValue.upsert.mock.calls[0][0]).toMatchObject({
      where: { field_id: 'b' },
      update: { value: '#222222' },
    });
  });

  it('returns notFound for an unknown version and writes nothing', async () => {
    mockPrisma({ fields: [] });
    prisma.themeValueVersion.findUnique.mockResolvedValue(null);
    expect(await restoreVersion('nope', 'user1')).toEqual({ notFound: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses with 409 while a Template Engine run holds the fields', async () => {
    mockPrisma({ fields: [field('a', { locked_by: 'template-engine' })] });
    prisma.themeValueVersion.findUnique.mockResolvedValue(version);
    prisma.templateEngineRun.findFirst.mockResolvedValue({ id: 'run1' });
    await expect(restoreVersion('v1', 'user1')).rejects.toMatchObject({ status: 409 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('listVersions returns newest first with a field count', async () => {
    mockPrisma({ fields: [] });
    prisma.themeValueVersion.findMany.mockResolvedValue([
      { id: 'v1', created_at: new Date('2026-10-24T09:00:00Z'), created_by: 'u', snapshot: version.snapshot },
    ]);
    const out = await listVersions('webapp', 'type1');
    expect(out).toEqual([{ id: 'v1', created_at: new Date('2026-10-24T09:00:00Z'), created_by: 'u', field_count: 2 }]);
    expect(prisma.themeValueVersion.findMany.mock.calls[0][0].orderBy).toEqual({ created_at: 'desc' });
  });
});
