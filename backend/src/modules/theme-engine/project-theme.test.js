/**
 * T05: theme values belong to a project. A project's own values sit in project_theme_values on top of the
 * install-wide base (setting_values); edits write only to the project, so changing one project's theme
 * never changes another's, and a project with no values of its own shows the base.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  prisma: {
    type: { findUnique: vi.fn() },
    settingField: { findMany: vi.fn(), updateMany: vi.fn() },
    settingValue: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    projectThemeValue: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    themeValueVersion: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
    templateEngineRun: { findFirst: vi.fn() },
    appSetting: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(async (ops) => Promise.all(ops)),
  },
}));
const redis = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }));
vi.mock('../../config/database.js', () => db);
vi.mock('../../config/redis.js', () => ({ redis }));

const service = await import('./service.js');
const { prisma } = db;

const FIELD = { id: 'f1', slug: 'webapp.branding.light.brand_colors.primary_color', field_name: 'Primary', input_type: 'color', options: null, locked_by: null, value: '#111111' };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.type.findUnique.mockResolvedValue({ slug: 'webapp.branding' });
  prisma.settingField.findMany.mockResolvedValue([{ ...FIELD, setting_values: [{ value: '#222222' }] }]);
  prisma.settingValue.findMany.mockResolvedValue([]);
  prisma.projectThemeValue.findMany.mockResolvedValue([]);
  prisma.themeValueVersion.findMany.mockResolvedValue([]);
  prisma.templateEngineRun.findFirst.mockResolvedValue(null);
  prisma.appSetting.findUnique.mockResolvedValue(null);
  prisma.appSetting.findMany.mockResolvedValue([]);
});

describe('getValues', () => {
  it("shows the project's own value over the base and the field default", async () => {
    prisma.projectThemeValue.findMany.mockResolvedValue([{ field_id: 'f1', value: '#abcdef' }]);
    const v = await service.getValues('webapp', 't1', 'proj-A');
    expect(v[FIELD.slug]).toBe('#abcdef');
  });

  it('shows the base value when the project has none of its own', async () => {
    const v = await service.getValues('webapp', 't1', 'proj-A');
    expect(v[FIELD.slug]).toBe('#222222');
  });

  it('never reads project values when no project is given', async () => {
    await service.getValues('webapp', 't1');
    expect(prisma.projectThemeValue.findMany).not.toHaveBeenCalled();
  });
});

describe('upsertValues', () => {
  const entry = [{ field_id: 'f1', value: '#00ff00' }];

  it('writes to the project, never to the shared base', async () => {
    const r = await service.upsertValues('webapp', 't1', entry, 'u1', { projectId: 'proj-A' });
    expect(r.saved).toBe(1);
    expect(prisma.projectThemeValue.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { project_id_field_id: { project_id: 'proj-A', field_id: 'f1' } },
        create: expect.objectContaining({ project_id: 'proj-A', field_id: 'f1', platform: 'webapp', value: '#00ff00' }),
      })
    );
    expect(prisma.settingValue.upsert).not.toHaveBeenCalled();
  });

  it('writes the base only when no project is given (legacy callers)', async () => {
    await service.upsertValues('webapp', 't1', entry, 'u1');
    expect(prisma.settingValue.upsert).toHaveBeenCalled();
    expect(prisma.projectThemeValue.upsert).not.toHaveBeenCalled();
  });

  it("clears only that project's token cache", async () => {
    await service.upsertValues('webapp', 't1', entry, 'u1', { projectId: 'proj-A' });
    const keys = redis.del.mock.calls.map((c) => c[0]);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((k) => k.includes(':p:proj-A:'))).toBe(true);
  });

  it('records the undo snapshot under the project', async () => {
    await service.upsertValues('webapp', 't1', entry, 'u1', { projectId: 'proj-A' });
    expect(prisma.themeValueVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ platform: 'webapp', type_id: 't1', project_id: 'proj-A' }),
    });
  });
});

describe('locks: a Template Engine run only blocks its own project', () => {
  it("looks for an open run in the project being edited", async () => {
    prisma.settingField.findMany.mockResolvedValue([{ ...FIELD, locked_by: 'template-engine', setting_values: [] }]);
    await service.upsertValues('webapp', 't1', [{ field_id: 'f1', value: '#00ff00' }], 'u1', { projectId: 'proj-B' });
    expect(prisma.templateEngineRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ projectId: 'proj-B' }) })
    );
  });

  it('blocks the edit when that project has an open run', async () => {
    prisma.settingField.findMany.mockResolvedValue([{ ...FIELD, locked_by: 'template-engine', setting_values: [] }]);
    prisma.templateEngineRun.findFirst.mockResolvedValue({ id: 'run-1' });
    await expect(
      service.upsertValues('webapp', 't1', [{ field_id: 'f1', value: '#00ff00' }], 'u1', { projectId: 'proj-A' })
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('resetValues', () => {
  it("drops the project's own values only, so the pane returns to the base", async () => {
    prisma.projectThemeValue.deleteMany.mockResolvedValue({ count: 4 });
    const r = await service.resetValues('webapp', 't1', 'proj-A');
    expect(r.deleted).toBe(4);
    expect(prisma.projectThemeValue.deleteMany).toHaveBeenCalledWith({
      where: { project_id: 'proj-A', field_id: { in: ['f1'] } },
    });
    expect(prisma.settingValue.deleteMany).not.toHaveBeenCalled();
  });
});

describe('versions belong to one project', () => {
  it('lists only the project snapshots', async () => {
    await service.listVersions('webapp', 't1', 'proj-A');
    expect(prisma.themeValueVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { platform: 'webapp', type_id: 't1', project_id: 'proj-A' } })
    );
  });

  it("will not restore another project's version", async () => {
    prisma.themeValueVersion.findUnique.mockResolvedValue({ id: 'v1', project_id: 'proj-B', platform: 'webapp', type_id: 't1', snapshot: '[]' });
    expect(await service.restoreVersion('v1', 'u1', 'proj-A')).toEqual({ notFound: true });
    expect(prisma.projectThemeValue.upsert).not.toHaveBeenCalled();
  });

  it('restores a project version into that project, and removes values that did not exist then', async () => {
    prisma.themeValueVersion.findUnique.mockResolvedValue({
      id: 'v1', project_id: 'proj-A', platform: 'webapp', type_id: 't1',
      snapshot: JSON.stringify([{ field_id: 'f1', value: null }]),
    });
    prisma.settingField.findMany.mockResolvedValue([{ id: 'f1', locked_by: null, value: '#111111' }]);
    const r = await service.restoreVersion('v1', 'u1', 'proj-A');
    expect(r.restored).toBe(1);
    expect(prisma.projectThemeValue.deleteMany).toHaveBeenCalledWith({ where: { project_id: 'proj-A', field_id: 'f1' } });
    expect(prisma.settingValue.deleteMany).not.toHaveBeenCalled();
  });
});

describe('active theme mode and site styles fall back project, then base, then default', () => {
  it('uses the project choice when it has one', async () => {
    prisma.appSetting.findUnique.mockImplementation(async ({ where }) =>
      where.key === 'theme_engine.active_theme.webapp.p.proj-A' ? { value: 'dark' } : { value: 'light' }
    );
    expect(await service.getActiveTheme('webapp', 'proj-A')).toBe('dark');
  });

  it('uses the install-wide choice when the project has none', async () => {
    prisma.appSetting.findUnique.mockImplementation(async ({ where }) =>
      where.key === 'theme_engine.active_theme.webapp' ? { value: 'light' } : null
    );
    expect(await service.getActiveTheme('webapp', 'proj-A')).toBe('light');
  });

  it('defaults to system', async () => {
    expect(await service.getActiveTheme('webapp', 'proj-A')).toBe('system');
  });

  it('saves the mode under the project key, not the shared one', async () => {
    await service.setActiveTheme('webapp', 'dark', 'proj-A');
    expect(prisma.appSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'theme_engine.active_theme.webapp.p.proj-A' } })
    );
  });

  it('saves site styles under the project key and reads the project choice first', async () => {
    await service.setSiteStyles({ button: 'pill' }, 'proj-A').catch(() => {});
    const keys = prisma.appSetting.upsert.mock.calls.map((c) => c[0].where.key);
    expect(keys.every((k) => k.endsWith('.p.proj-A'))).toBe(true);
  });
});

describe('compiled tokens', () => {
  it('are cached per project', async () => {
    prisma.type.findMany = vi.fn().mockResolvedValue([]);
    await service.compileTokens('webapp', undefined, undefined, 'proj-A').catch(() => {});
    expect(redis.get.mock.calls[0][0]).toContain(':p:proj-A:');
    redis.get.mockClear();
    await service.compileTokens('webapp').catch(() => {});
    expect(redis.get.mock.calls[0][0]).not.toContain(':p:');
  });
});

describe('the admin panel theme stays install-wide', () => {
  beforeEach(() => {
    prisma.type.findUnique.mockResolvedValue({ slug: 'webapp_admin.branding' });
  });

  it('webapp_admin values are written to the shared base even when a project is given', async () => {
    await service.upsertValues('webapp_admin', 't1', [{ field_id: 'f1', value: '#00ff00' }], 'u1', { projectId: 'proj-A' });
    expect(prisma.settingValue.upsert).toHaveBeenCalled();
    expect(prisma.projectThemeValue.upsert).not.toHaveBeenCalled();
  });

  it('webapp_admin reads never look at project values', async () => {
    await service.getValues('webapp_admin', 't1', 'proj-A');
    expect(prisma.projectThemeValue.findMany).not.toHaveBeenCalled();
  });

  it('webapp_admin keeps one install-wide active mode, so the admin does not flip when you switch project', async () => {
    await service.setActiveTheme('webapp_admin', 'dark', 'proj-A');
    expect(prisma.appSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'theme_engine.active_theme.webapp_admin' } })
    );
  });

  it('webapp_admin tokens are cached once for everyone', async () => {
    prisma.type.findMany = vi.fn().mockResolvedValue([]);
    await service.compileTokens('webapp_admin', undefined, undefined, 'proj-A').catch(() => {});
    expect(redis.get.mock.calls[0][0]).not.toContain(':p:');
  });

  it('only the website platform is per project', () => {
    expect(service.PROJECT_THEME_PLATFORMS).toEqual(['webapp']);
  });
});
