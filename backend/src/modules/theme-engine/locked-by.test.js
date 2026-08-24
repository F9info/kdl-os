import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../../config/redis.js', () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));

import { prisma } from '../../config/database.js';
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

describe('upsertValues locked_by guard (run-scoped)', () => {
  it('throws 409 when field is locked_by template-engine and an active run exists', async () => {
    prisma.type = {
      findUnique: vi.fn().mockResolvedValue({ slug: 'webapp.branding' }),
    };
    prisma.settingField = {
      findMany: vi.fn().mockResolvedValue([makeField({ locked_by: 'template-engine' })]),
    };
    prisma.templateEngineRun = {
      findFirst: vi.fn().mockResolvedValue({ id: 'run-1' }),
    };

    await expect(
      upsertValues('webapp', 'type-id', [{ slug: 'webapp.branding.dark.brand.primary_color', value: '#fff' }], 'actor')
    ).rejects.toMatchObject({
      status: 409,
      message: 'Settings are read-only: locked by module "template-engine"',
    });
  });

  it('succeeds when locked_by template-engine but no active run exists', async () => {
    prisma.type = {
      findUnique: vi.fn().mockResolvedValue({ slug: 'webapp.branding' }),
    };
    const field = makeField({ locked_by: 'template-engine' });
    prisma.settingField = {
      findMany: vi.fn().mockResolvedValue([field]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    };
    prisma.settingValue = {
      upsert: vi.fn().mockResolvedValue({}),
    };
    prisma.templateEngineRun = {
      findFirst: vi.fn().mockResolvedValue(null),
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
    expect(prisma.templateEngineRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { in: ['IN_PROGRESS', 'AWAITING_APPROVAL'] } } })
    );
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
    // No active-run check needed when no fields are locked — findFirst must not be called
    if (prisma.templateEngineRun?.findFirst) {
      expect(prisma.templateEngineRun.findFirst).not.toHaveBeenCalled();
    }
  });

  it('bypasses lock guard and re-acquires lock when lockedByModule is set', async () => {
    prisma.type = {
      findUnique: vi.fn().mockResolvedValue({ slug: 'webapp.branding' }),
    };
    const field = makeField({ locked_by: 'template-engine' });
    prisma.settingField = {
      findMany: vi.fn().mockResolvedValue([field]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
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
      'actor',
      { lockedByModule: 'template-engine' }
    );
    expect(result).toMatchObject({ saved: 1 });
    // lock re-acquired on written fields
    expect(prisma.settingField.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { locked_by: 'template-engine' } })
    );
  });
});
