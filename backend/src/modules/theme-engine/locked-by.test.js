import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../../config/redis.js', () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));
vi.mock('../../middleware/module-gate.js', () => ({
  getModuleStatus: vi.fn(),
}));

import { prisma } from '../../config/database.js';
import { getModuleStatus } from '../../middleware/module-gate.js';
import { upsertValues } from './service.js';

function makeField(overrides = {}) {
  return {
    id: 'f1',
    slug: 'webapp.branding.dark.brand.primary_color',
    field_name: 'Primary Color',
    input_type: 'color',
    options: null,
    locked_by: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('upsertValues locked_by guard', () => {
  it('throws 409 when a field is locked_by an ENABLED module', async () => {
    prisma.type = {
      findUnique: vi.fn().mockResolvedValue({ slug: 'webapp.branding' }),
    };
    prisma.settingField = {
      findMany: vi.fn().mockResolvedValue([makeField({ locked_by: 'template-engine' })]),
    };
    getModuleStatus.mockResolvedValue('ENABLED');

    await expect(
      upsertValues('webapp', 'type-id', [{ slug: 'webapp.branding.dark.brand.primary_color', value: '#fff' }], 'actor')
    ).rejects.toMatchObject({
      status: 409,
      message: 'Settings are read-only: locked by module "template-engine"',
    });
  });

  it('succeeds when locked_by module is DISABLED', async () => {
    prisma.type = {
      findUnique: vi.fn().mockResolvedValue({ slug: 'webapp.branding' }),
    };
    const field = makeField({ locked_by: 'template-engine' });
    prisma.settingField = {
      findMany: vi.fn().mockResolvedValue([field]),
    };
    prisma.settingValue = {
      upsert: vi.fn().mockResolvedValue({}),
    };
    getModuleStatus.mockResolvedValue('DISABLED');
    prisma.$transaction = vi.fn().mockImplementation((ops) => Promise.all(Array.isArray(ops) ? ops : [ops]));
    const { redis } = await import('../../config/redis.js');
    redis.del.mockResolvedValue(1);

    const result = await upsertValues(
      'webapp',
      'type-id',
      [{ slug: 'webapp.branding.dark.brand.primary_color', value: '#ff0000' }],
      'actor'
    );
    expect(result).toMatchObject({ saved: 1 });
  });

  it('succeeds when locked_by is null (no lock)', async () => {
    prisma.type = {
      findUnique: vi.fn().mockResolvedValue({ slug: 'webapp.branding' }),
    };
    const field = makeField({ locked_by: null });
    prisma.settingField = {
      findMany: vi.fn().mockResolvedValue([field]),
    };
    prisma.settingValue = {
      upsert: vi.fn().mockResolvedValue({}),
    };
    prisma.$transaction = vi.fn().mockImplementation((ops) => Promise.all(Array.isArray(ops) ? ops : [ops]));
    const { redis } = await import('../../config/redis.js');
    redis.del.mockResolvedValue(1);

    const result = await upsertValues(
      'webapp',
      'type-id',
      [{ slug: 'webapp.branding.dark.brand.primary_color', value: '#ff0000' }],
      'actor'
    );
    expect(result).toMatchObject({ saved: 1 });
    expect(getModuleStatus).not.toHaveBeenCalled();
  });
});
