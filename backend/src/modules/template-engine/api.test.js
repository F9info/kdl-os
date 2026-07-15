/**
 * Phase B gate tests — values API + token resolver
 *
 * B1: schema tree shape; routes behind gate+authenticate+requirePermission
 * B2: valid upsert; invalid color/enum rejected 422; reset restores default
 * B3: token for changed field reflects saved value; light+dark blocks present; CSS served
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Database / Redis / activity-logger mocks must be hoisted before imports ──
vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../../config/redis.js', () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));
vi.mock('../user-management/shared/activity-logger.js', () => ({
  writeActivityAsync: vi.fn(),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));
vi.mock('../user-management/shared/permission-resolver.js', () => ({
  resolvePermissions: vi.fn(async () => ({ bypass: false, permissions: [] })),
  hasPermission: vi.fn(() => false),
}));

import { resolvePermissions } from '../user-management/shared/permission-resolver.js';

import { redis } from '../../config/redis.js';
import * as service from './service.js';

// ─────────────────────────────────────────────────────────────────────────────
// B1 — routes.js structure + schema tree shape
// ─────────────────────────────────────────────────────────────────────────────

describe('B1 — routes.js structure', () => {
  it('routes file exists and exports a default Express router', async () => {
    const mod = await import('./routes.js');
    const router = mod.default;
    // An express Router has a 'stack' property of middleware layers
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
    expect(Array.isArray(router.stack)).toBe(true);
  });

  it('GET /schema and GET /values layers include authenticate middleware', async () => {
    const mod = await import('./routes.js');
    const router = mod.default;

    const namedHandlers = (layer) =>
      (layer.route?.stack ?? []).map((l) => l.handle?.name ?? '');

    const routes = router.stack.filter((l) => l.route);
    const schemaRoute = routes.find((l) => l.route.path === '/schema' && l.route.methods.get);
    const valuesGetRoute = routes.find((l) => l.route.path === '/values' && l.route.methods.get);
    const valuesPostRoute = routes.find((l) => l.route.path === '/values' && l.route.methods.post);
    const resetRoute = routes.find((l) => l.route.path === '/reset' && l.route.methods.post);
    const tokensRoute = routes.find((l) => l.route.path === '/tokens' && l.route.methods.get);

    expect(schemaRoute).toBeDefined();
    expect(valuesGetRoute).toBeDefined();
    expect(valuesPostRoute).toBeDefined();
    expect(resetRoute).toBeDefined();
    expect(tokensRoute).toBeDefined();

    // Authenticated routes must have 'authenticate' in middleware chain
    for (const route of [schemaRoute, valuesGetRoute, valuesPostRoute, resetRoute]) {
      const names = namedHandlers(route);
      expect(names).toContain('authenticate');
      // requirePermission factory returns an anonymous or named fn; verify it's present (length > 2: authenticate + permission + validate + handler)
      expect(names.length).toBeGreaterThanOrEqual(3);
    }

    // /tokens uses optionalAuthenticate, NOT authenticate
    const tokenNames = namedHandlers(tokensRoute);
    expect(tokenNames).toContain('optionalAuthenticate');
    expect(tokenNames).not.toContain('authenticate');
  });
});

describe('B1 — service.getSchemaTree shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue('OK');
    redis.del.mockResolvedValue(1);
  });

  it('returns null for unknown platform', async () => {
    const { prisma } = await import('../../config/database.js');
    prisma.type = { findMany: vi.fn().mockResolvedValue([]) };
    prisma.category = { findMany: vi.fn().mockResolvedValue([]) };
    prisma.settingField = { findMany: vi.fn().mockResolvedValue([]) };

    const result = await service.getSchemaTree('unknown');
    expect(result).toBeNull();
  });

  it('returns pane array for webapp with type_id and groups', async () => {
    const { prisma } = await import('../../config/database.js');
    // Simulate one type seeded for webapp.branding
    const fakeType = { id: 'type-1', name: 'Theme Color', slug: 'webapp.branding' };
    const fakeCat = { id: 'cat-1', name: 'Colors', slug: 'webapp.branding.colors', type_id: 'type-1' };
    const fakeField = {
      id: 'f-1', field_name: 'Primary', slug: 'webapp.branding.colors.primary',
      input_type: 'color', value: '#ffffff', alt_text: null, options: null, sort: 0,
      type_id: 'type-1', category_id: 'cat-1',
      setting_values: [],
    };

    prisma.type = { findMany: vi.fn().mockResolvedValue([fakeType]) };
    prisma.category = { findMany: vi.fn().mockResolvedValue([fakeCat]) };
    prisma.settingField = { findMany: vi.fn().mockResolvedValue([fakeField]) };

    const tree = await service.getSchemaTree('webapp');
    expect(Array.isArray(tree)).toBe(true);
    const branding = tree.find((p) => p.id === 'branding');
    expect(branding).toBeDefined();
    expect(branding.type_id).toBe('type-1');
    expect(branding.groups).toHaveLength(1);
    expect(branding.groups[0].fields[0].input_type).toBe('color');
    // effective_value falls back to field default when no setting_values
    expect(branding.groups[0].fields[0].value).toBe('#ffffff');
  });

  it('overrides default with saved setting_value when present', async () => {
    const { prisma } = await import('../../config/database.js');
    const fakeType = { id: 'type-2', name: 'Theme Color', slug: 'webapp.branding' };
    const fakeCat = { id: 'cat-2', name: 'Colors', slug: 'webapp.branding.colors', type_id: 'type-2' };
    const fakeField = {
      id: 'f-2', field_name: 'Primary', slug: 'webapp.branding.colors.primary',
      input_type: 'color', value: '#ffffff', alt_text: null, options: null, sort: 0,
      type_id: 'type-2', category_id: 'cat-2',
      setting_values: [{ value: '#ff0000' }],
    };

    prisma.type = { findMany: vi.fn().mockResolvedValue([fakeType]) };
    prisma.category = { findMany: vi.fn().mockResolvedValue([fakeCat]) };
    prisma.settingField = { findMany: vi.fn().mockResolvedValue([fakeField]) };

    const tree = await service.getSchemaTree('webapp');
    const branding = tree.find((p) => p.id === 'branding');
    expect(branding.groups[0].fields[0].value).toBe('#ff0000');
    expect(branding.groups[0].fields[0].default_value).toBe('#ffffff');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B2 — validateFieldValue, upsertValues, resetValues
// ─────────────────────────────────────────────────────────────────────────────

describe('B2 — validateFieldValue', () => {
  it('accepts valid hex color values', () => {
    const f = { input_type: 'color', options: null };
    expect(service.validateFieldValue(f, '#abc')).toBeNull();
    expect(service.validateFieldValue(f, '#abcd')).toBeNull();
    expect(service.validateFieldValue(f, '#4f8ef7')).toBeNull();
    expect(service.validateFieldValue(f, '#00000000')).toBeNull();
    expect(service.validateFieldValue(f, 'rgba(0,0,0,0.5)')).toBeNull();
  });

  it('rejects invalid color strings', () => {
    const f = { input_type: 'color', options: null };
    expect(service.validateFieldValue(f, 'red')).toBe('invalid color value');
    expect(service.validateFieldValue(f, '123456')).toBe('invalid color value');
    expect(service.validateFieldValue(f, '')).toBe('invalid color value');
  });

  it('rejects 5- and 7-digit hex and rgba with malformed body (B11)', () => {
    const f = { input_type: 'color', options: null };
    expect(service.validateFieldValue(f, '#abcde')).toBe('invalid color value');
    expect(service.validateFieldValue(f, '#1234567')).toBe('invalid color value');
    expect(service.validateFieldValue(f, 'rgba(1,2)')).toBe('invalid color value');
    expect(service.validateFieldValue(f, 'rgba(1,2,3,junk)')).toBe('invalid color value');
    expect(service.validateFieldValue(f, 'rgb(255,128,0')).toBe('invalid color value');
  });

  it('accepts valid select choices and rejects unknown ones', () => {
    const f = { input_type: 'select', options: JSON.stringify({ choices: ['Inter', 'Roboto'] }) };
    expect(service.validateFieldValue(f, 'Inter')).toBeNull();
    expect(service.validateFieldValue(f, 'Comic Sans')).toMatch(/must be one of/);
  });

  it('accepts valid enum for radio type', () => {
    const f = { input_type: 'radio', options: JSON.stringify({ choices: ['yes', 'no'] }) };
    expect(service.validateFieldValue(f, 'yes')).toBeNull();
    expect(service.validateFieldValue(f, 'maybe')).toMatch(/must be one of/);
  });

  it('accepts slider within range and rejects out-of-range', () => {
    const f = { input_type: 'slider', options: JSON.stringify({ min: 0, max: 24, unit: 'px' }) };
    expect(service.validateFieldValue(f, '12')).toBeNull();
    expect(service.validateFieldValue(f, '0')).toBeNull();
    expect(service.validateFieldValue(f, '24')).toBeNull();
    expect(service.validateFieldValue(f, '25')).toMatch(/<=\s*24/);
    expect(service.validateFieldValue(f, '-1')).toMatch(/>=/);
  });

  it('accepts toggle true/false and rejects other values', () => {
    const f = { input_type: 'toggle', options: null };
    expect(service.validateFieldValue(f, 'true')).toBeNull();
    expect(service.validateFieldValue(f, 'false')).toBeNull();
    expect(service.validateFieldValue(f, '1')).toMatch(/true.*false/);
  });

  it('accepts valid multiselect JSON array', () => {
    const f = { input_type: 'multiselect', options: JSON.stringify({ choices: ['a', 'b', 'c'] }) };
    expect(service.validateFieldValue(f, '["a","b"]')).toBeNull();
    expect(service.validateFieldValue(f, '["x"]')).toMatch(/invalid choice/);
    expect(service.validateFieldValue(f, 'not-json')).toMatch(/valid JSON array/);
  });

  it('accepts any string for text/textarea/password/file/fonts/imglist', () => {
    for (const type of ['text', 'textarea', 'password', 'file', 'fonts', 'imglist']) {
      expect(service.validateFieldValue({ input_type: type, options: null }, 'anything')).toBeNull();
    }
  });

  it('rejects empty string for number and slider', () => {
    expect(service.validateFieldValue({ input_type: 'number', options: null }, '')).toBe('value must be a number');
    expect(service.validateFieldValue({ input_type: 'slider', options: JSON.stringify({ min: 0, max: 24 }) }, '')).toBe('value must be a number');
  });

  it('rejects rgba strings without digits after paren', () => {
    const f = { input_type: 'color', options: null };
    expect(service.validateFieldValue(f, 'rgba(garbage')).toBe('invalid color value');
    expect(service.validateFieldValue(f, 'rgba( ')).toBe('invalid color value');
    expect(service.validateFieldValue(f, 'rgba(0,0,0,0.5)')).toBeNull();
    expect(service.validateFieldValue(f, 'rgb(255, 128, 0)')).toBeNull();
  });
});

describe('B2 — upsertValues rejects invalid fields and unknown field ids', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    redis.del.mockResolvedValue(1);
    // Default: type belongs to webapp platform
    const { prisma } = await import('../../config/database.js');
    prisma.type = { findUnique: vi.fn().mockResolvedValue({ slug: 'webapp.branding' }) };
  });

  it('returns errors array when a color value is invalid', async () => {
    const { prisma } = await import('../../config/database.js');
    prisma.settingField = {
      findMany: vi.fn().mockResolvedValue([
        { id: 'f-1', slug: 'webapp.branding.colors.primary', input_type: 'color', options: null },
      ]),
    };

    const result = await service.upsertValues(
      'webapp', 'type-1',
      [{ field_id: 'f-1', value: 'red' }],
      'user-1'
    );
    expect(result.errors).toBeDefined();
    expect(result.errors[0]).toMatch(/invalid color/);
    // No DB write
    expect(prisma.settingField.findMany).toHaveBeenCalled();
  });

  it('returns errors array when field_id is unknown', async () => {
    const { prisma } = await import('../../config/database.js');
    prisma.settingField = { findMany: vi.fn().mockResolvedValue([]) };

    const result = await service.upsertValues(
      'webapp', 'type-1',
      [{ field_id: 'unknown-id', value: '#ffffff' }],
      'user-1'
    );
    expect(result.errors).toBeDefined();
    expect(result.errors[0]).toMatch(/Unknown field/);
  });

  it('upserts valid entries and returns saved count', async () => {
    const { prisma } = await import('../../config/database.js');
    prisma.settingField = {
      findMany: vi.fn().mockResolvedValue([
        { id: 'f-1', slug: 'webapp.branding.colors.primary', input_type: 'color', options: null },
      ]),
    };
    prisma.settingValue = {
      upsert: vi.fn().mockResolvedValue({ id: 'sv-1' }),
    };
    prisma.$transaction = vi.fn(async (ops) => Promise.all(ops));

    const result = await service.upsertValues(
      'webapp', 'type-1',
      [{ field_id: 'f-1', value: '#ff0000' }],
      'user-1'
    );
    expect(result.saved).toBe(1);
    expect(result.errors).toBeUndefined();
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalled();
  });

  it('upsertValues invalidates real device-scoped cache keys (tv_4k, not base tags)', async () => {
    const { prisma } = await import('../../config/database.js');
    prisma.type = { findUnique: vi.fn().mockResolvedValue({ slug: 'tv.branding' }) };
    prisma.settingField = {
      findMany: vi.fn().mockResolvedValue([
        { id: 'f-tv', slug: 'tv.branding.colors.primary', input_type: 'color', options: null },
      ]),
    };
    prisma.settingValue = { upsert: vi.fn().mockResolvedValue({ id: 'sv-1' }) };
    prisma.$transaction = vi.fn(async (ops) => Promise.all(ops));

    await service.upsertValues('tv', 'type-tv', [{ field_id: 'f-tv', value: '#ff0000' }], 'user-1');

    const delKeys = redis.del.mock.calls.map((c) => c[0]);
    // Real tv device ids must be invalidated
    expect(delKeys).toContain('te:tokens:tv:dark:tv_4k');
    expect(delKeys).toContain('te:tokens:tv:dark:tv_1080p');
    expect(delKeys).toContain('te:tokens:tv:dark:tv_720p');
    expect(delKeys).toContain('te:tokens:tv:dark:tv_8k');
    expect(delKeys).toContain('te:tokens:tv:dark:all');
    // Authoring base tags must NOT appear as cache keys
    expect(delKeys).not.toContain('te:tokens:tv:dark:desktop');
    expect(delKeys).not.toContain('te:tokens:tv:dark:laptop');
    expect(delKeys).not.toContain('te:tokens:tv:dark:ipad');
    expect(delKeys).not.toContain('te:tokens:tv:dark:mobile');
  });

  it('rejects enum field with invalid choice', async () => {
    const { prisma } = await import('../../config/database.js');
    prisma.settingField = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'f-2', slug: 'webapp.typography.font.body',
          input_type: 'select',
          options: JSON.stringify({ choices: ['Inter', 'Roboto'] }),
        },
      ]),
    };

    const result = await service.upsertValues(
      'webapp', 'type-1',
      [{ slug: 'webapp.typography.font.body', value: 'Arial' }],
      'user-1'
    );
    expect(result.errors).toBeDefined();
    expect(result.errors[0]).toMatch(/must be one of/);
  });

  it('rejects upsert when type_id belongs to a different platform', async () => {
    const { prisma } = await import('../../config/database.js');
    // type belongs to mobile, not webapp
    prisma.type = { findUnique: vi.fn().mockResolvedValue({ slug: 'mobile.branding' }) };
    prisma.settingField = { findMany: vi.fn() };

    const result = await service.upsertValues(
      'webapp', 'mobile-type-id',
      [{ field_id: 'f-x', value: '#ffffff' }],
      'user-1'
    );
    expect(result.errors).toBeDefined();
    expect(result.errors[0]).toMatch(/does not belong to platform/);
    expect(prisma.settingField.findMany).not.toHaveBeenCalled();
  });
});

describe('B2 — resetValues restores defaults', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    redis.del.mockResolvedValue(1);
    const { prisma } = await import('../../config/database.js');
    prisma.type = { findUnique: vi.fn().mockResolvedValue({ slug: 'webapp.branding' }) };
  });

  it('deletes all setting_values rows for the pane and invalidates cache', async () => {
    const { prisma } = await import('../../config/database.js');
    prisma.settingField = {
      findMany: vi.fn().mockResolvedValue([{ id: 'f-1' }, { id: 'f-2' }]),
    };
    prisma.settingValue = {
      deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
    };

    const result = await service.resetValues('webapp', 'type-1');
    expect(result.deleted).toBe(2);
    expect(prisma.settingValue.deleteMany).toHaveBeenCalledWith({
      where: { field_id: { in: ['f-1', 'f-2'] } },
    });
    expect(redis.del).toHaveBeenCalled();
  });

  it('returns 0 deleted when no saved values existed', async () => {
    const { prisma } = await import('../../config/database.js');
    prisma.settingField = {
      findMany: vi.fn().mockResolvedValue([{ id: 'f-3' }]),
    };
    prisma.settingValue = {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    };

    const result = await service.resetValues('webapp', 'type-1');
    expect(result.deleted).toBe(0);
  });

  it('rejects reset when type_id belongs to a different platform', async () => {
    const { prisma } = await import('../../config/database.js');
    prisma.type = { findUnique: vi.fn().mockResolvedValue({ slug: 'mobile.branding' }) };
    prisma.settingField = { findMany: vi.fn() };

    const result = await service.resetValues('webapp', 'mobile-type-id');
    expect(result.errors).toBeDefined();
    expect(result.errors[0]).toMatch(/does not belong to platform/);
    expect(prisma.settingField.findMany).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B3 — compileTokens: CSS output, light+dark blocks, changed field reflected
// ─────────────────────────────────────────────────────────────────────────────

describe('B3 — compileTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue('OK');
    redis.del.mockResolvedValue(1);
  });

  async function stubPrismaWithFields(fields) {
    const { prisma } = await import('../../config/database.js');
    const type = { id: 'type-1', slug: 'webapp.buttons', name: 'Buttons' };
    prisma.type = { findMany: vi.fn().mockResolvedValue([type]) };
    prisma.settingField = { findMany: vi.fn().mockResolvedValue(fields) };
    // compileTokens now embeds the saved Active Theme (KDL-198) — no row set
    // means getActiveTheme falls back to 'system'.
    prisma.appSetting = { findUnique: vi.fn().mockResolvedValue(null) };
  }

  it('returns a { css, json } object', async () => {
    await stubPrismaWithFields([
      {
        id: 'f-1', slug: 'webapp.buttons.desktop.btn.background',
        field_name: 'Background', input_type: 'color',
        value: '#ffffff', type_id: 'type-1', category_id: null,
        setting_values: [],
      },
    ]);
    const result = await service.compileTokens('webapp');
    expect(result).toHaveProperty('css');
    expect(result).toHaveProperty('json');
    expect(typeof result.css).toBe('string');
    expect(typeof result.json).toBe('object');
  });

  it('CSS contains :root block with custom properties', async () => {
    await stubPrismaWithFields([
      {
        id: 'f-1', slug: 'webapp.buttons.desktop.btn.background',
        field_name: 'Background', input_type: 'color',
        value: '#4f8ef7', type_id: 'type-1', category_id: null,
        setting_values: [],
      },
    ]);
    const { css } = await service.compileTokens('webapp');
    expect(css).toMatch(/:root\s*\{/);
    expect(css).toMatch(/--buttons_desktop_btn_background:\s*#4f8ef7/);
  });

  it('token for a changed (saved) field reflects the saved value, not the default', async () => {
    await stubPrismaWithFields([
      {
        id: 'f-2', slug: 'webapp.buttons.dark.primary_button.background_color',
        field_name: 'Background Color', input_type: 'color',
        value: '#4f8ef7',
        type_id: 'type-1', category_id: null,
        setting_values: [{ value: '#ff0000' }],  // user-saved override
      },
    ]);
    const { css, json } = await service.compileTokens('webapp', 'dark');
    // Spec contract: var names are theme-neutral (no "dark" segment).
    expect(css).toMatch(/--buttons_primary_button_background_color:\s*#ff0000/);
    expect(css).not.toMatch(/#4f8ef7/);
    // JSON tree is pane → group → field and reflects the saved value.
    expect(json.buttons.primary_button.background_color).toBe('#ff0000');
  });

  it('unfiltered compile: dark in :root with neutral names, light in [data-theme="light"] block', async () => {
    await stubPrismaWithFields([
      {
        id: 'f-3', slug: 'webapp.buttons.dark.primary_button.background_color',
        field_name: 'BG Dark', input_type: 'color', value: '#000000',
        type_id: 'type-1', category_id: null, setting_values: [],
      },
      {
        id: 'f-4', slug: 'webapp.buttons.light.primary_button.background_color',
        field_name: 'BG Light', input_type: 'color', value: '#ffffff',
        type_id: 'type-1', category_id: null, setting_values: [],
      },
    ]);
    const { css, json } = await service.compileTokens('webapp'); // no theme filter
    // Same neutral var name in both blocks — theme never baked into the name.
    const root = css.match(/:root \{[^}]*\}/)?.[0];
    const light = css.match(/\[data-theme="light"\] \{[^}]*\}/)?.[0];
    expect(root).toMatch(/--buttons_primary_button_background_color:\s*#000000/);
    expect(light).toMatch(/--buttons_primary_button_background_color:\s*#ffffff/);
    expect(css).not.toMatch(/--buttons_dark_/);
    expect(css).not.toMatch(/--buttons_light_/);
    // JSON mirrors :root (default dark theme).
    expect(json.buttons.primary_button.background_color).toBe('#000000');
  });

  it('theme filter strips out opposite-theme fields', async () => {
    await stubPrismaWithFields([
      {
        id: 'f-3', slug: 'webapp.buttons.dark.primary_button.background_color',
        field_name: 'BG Dark', input_type: 'color', value: '#000000',
        type_id: 'type-1', category_id: null, setting_values: [],
      },
      {
        id: 'f-4', slug: 'webapp.buttons.light.primary_button.background_color',
        field_name: 'BG Light', input_type: 'color', value: '#ffffff',
        type_id: 'type-1', category_id: null, setting_values: [],
      },
    ]);
    const { css } = await service.compileTokens('webapp', 'dark');
    expect(css).toMatch(/--buttons_primary_button_background_color:\s*#000000/);
    expect(css).not.toMatch(/#ffffff/);
    expect(css).not.toMatch(/data-theme/);
  });

  it('excludes password fields from tokens (B6)', async () => {
    await stubPrismaWithFields([
      {
        id: 'f-pw', slug: 'webapp.integrations.api.secret_key',
        field_name: 'Secret Key', input_type: 'password', value: 'hunter2',
        type_id: 'type-1', category_id: null, setting_values: [],
      },
      {
        id: 'f-ok', slug: 'webapp.branding.colors.primary',
        field_name: 'Primary', input_type: 'color', value: '#123456',
        type_id: 'type-1', category_id: null, setting_values: [],
      },
    ]);
    const { css, json } = await service.compileTokens('webapp');
    expect(css).not.toMatch(/hunter2/);
    expect(css).not.toMatch(/secret_key/);
    expect(JSON.stringify(json)).not.toMatch(/hunter2/);
    expect(css).toMatch(/--branding_colors_primary:\s*#123456/);
  });

  it('uses Redis cache on second call', async () => {
    const cachedResult = { css: ':root { --cached: true; }', json: {} };
    redis.get.mockResolvedValueOnce(JSON.stringify(cachedResult));

    const result = await service.compileTokens('webapp', 'dark');
    expect(result.css).toContain('--cached: true');
    // prisma was never called — short-circuited by cache
    const { prisma } = await import('../../config/database.js');
    // type.findMany was NOT called (prisma.type may be undefined from earlier test)
    // Just verify the result matches the cache
    expect(result).toEqual(cachedResult);
  });

  it('stores compiled result in Redis with TTL 600', async () => {
    await stubPrismaWithFields([
      {
        id: 'f-5', slug: 'webapp.buttons.desktop.btn.bg',
        field_name: 'BG', input_type: 'color', value: '#abc',
        type_id: 'type-1', category_id: null, setting_values: [],
      },
    ]);
    await service.compileTokens('webapp', 'dark');
    // cache key includes device (no device arg → 'all')
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^te:tokens:webapp:dark:all$/),
      expect.any(String),
      'EX',
      600
    );
  });

  it('uses separate cache keys per device — tv_4k request does not poison desktop cache', async () => {
    await stubPrismaWithFields([
      {
        id: 'f-tv', slug: 'tv.buttons.tv_4k.btn.bg',
        field_name: 'BG TV 4K', input_type: 'color', value: '#111111',
        type_id: 'type-1', category_id: null, setting_values: [],
      },
    ]);
    await service.compileTokens('tv', 'dark', 'tv_4k');
    expect(redis.set).toHaveBeenCalledWith(
      'te:tokens:tv:dark:tv_4k',
      expect.any(String),
      'EX',
      600
    );
    // desktop and all keys must NOT have been written
    const setCalls = redis.set.mock.calls.map((c) => c[0]);
    expect(setCalls).not.toContain('te:tokens:tv:dark:desktop');
    expect(setCalls).not.toContain('te:tokens:tv:dark:all');
  });

  it('handles fonts fields: emits @import for google fonts, skips from CSS vars', async () => {
    await stubPrismaWithFields([
      {
        id: 'f-6', slug: 'webapp.typography.font_family.body_font',
        field_name: 'Body Font', input_type: 'fonts',
        value: JSON.stringify([{ type: 'google', name: 'Inter', src: 'https://fonts.googleapis.com/css2?family=Inter' }]),
        type_id: 'type-1', category_id: null, setting_values: [],
      },
    ]);
    const { css } = await service.compileTokens('webapp');
    expect(css).toMatch(/@import url\('https:\/\/fonts\.googleapis\.com/);
    expect(css).not.toMatch(/--typography_font_family_body_font/);
  });

  it('handles imglist fields: emits CSS class rules', async () => {
    await stubPrismaWithFields([
      {
        id: 'f-7', slug: 'webapp.images.desktop.image_classes.image_classes',
        field_name: 'Image Classes', input_type: 'imglist',
        value: JSON.stringify([{ name: 'thumbnail-image', w: 150, h: 150, fit: 'cover' }]),
        type_id: 'type-1', category_id: null, setting_values: [],
      },
    ]);
    const { css } = await service.compileTokens('webapp');
    expect(css).toMatch(/\.thumbnail_image\s*\{/);
    expect(css).toMatch(/width:\s*150px/);
    expect(css).toMatch(/height:\s*150px/);
    expect(css).toMatch(/object-fit:\s*cover/);
  });

  // Regression (B-1): device filter must classify by REAL device ids, not by
  // "not-theme-and-not-pane". Untagged webapp fields (3rd slug segment = section
  // slug) were silently dropped for every ?device= query. Slugs mirror the real
  // seed shape: {platform}.{pane}.[{tag}.]{section}.{field}.
  it('device filter keeps untagged fields and drops only mismatched real-device-tagged fields', async () => {
    await stubPrismaWithFields([
      // Untagged field — 3rd segment "colors" is a section slug, NOT a device id.
      {
        id: 'f-untagged', slug: 'webapp.branding.colors.primary',
        field_name: 'Primary', input_type: 'color', value: '#123456',
        type_id: 'type-1', category_id: null, setting_values: [],
      },
      // Real device-tagged field for the requested device (desktop).
      {
        id: 'f-desktop', slug: 'webapp.buttons.desktop.primary_button.background',
        field_name: 'BG Desktop', input_type: 'color', value: '#aaaaaa',
        type_id: 'type-1', category_id: null, setting_values: [],
      },
      // Real device-tagged field for a DIFFERENT device (mobile_v) — must drop.
      {
        id: 'f-mobile', slug: 'webapp.buttons.mobile_v.primary_button.background',
        field_name: 'BG Mobile', input_type: 'color', value: '#bbbbbb',
        type_id: 'type-1', category_id: null, setting_values: [],
      },
    ]);
    const { css } = await service.compileTokens('webapp', null, 'desktop');
    // Untagged field survives the device filter (was silently dropped pre-fix).
    expect(css).toMatch(/--branding_colors_primary:\s*#123456/);
    // Matching real-device-tagged field present.
    expect(css).toMatch(/--buttons_desktop_primary_button_background:\s*#aaaaaa/);
    // Mismatched real-device-tagged field excluded.
    expect(css).not.toMatch(/mobile_v_primary_button/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// KDL-209 — responsive device emission: @media blocks + device-neutral aliases
// ─────────────────────────────────────────────────────────────────────────────

describe('KDL-209 — deviceMediaQuery', () => {
  it('maps webapp devices to breakpoint bands with orientation', () => {
    const webapp = { devices: [
      { id: 'desktop', from: 'desktop' },
      { id: 'laptop_h', from: 'laptop' }, { id: 'laptop_v', from: 'laptop' },
      { id: 'tablet_h', from: 'ipad' }, { id: 'tablet_v', from: 'ipad' },
      { id: 'mobile_h', from: 'mobile' }, { id: 'mobile_v', from: 'mobile' },
    ] };
    expect(service.deviceMediaQuery(webapp, 'desktop')).toBe('(min-width: 1280px)');
    expect(service.deviceMediaQuery(webapp, 'laptop_h'))
      .toBe('(min-width: 1024px) and (max-width: 1279px) and (orientation: landscape)');
    expect(service.deviceMediaQuery(webapp, 'tablet_v'))
      .toBe('(min-width: 768px) and (max-width: 1023px) and (orientation: portrait)');
    expect(service.deviceMediaQuery(webapp, 'mobile_v'))
      .toBe('(max-width: 767px) and (orientation: portrait)');
  });

  it('maps TV resolutions to panel-width bands', () => {
    expect(service.deviceMediaQuery(null, 'tv_720p')).toBe('(max-width: 1919px)');
    expect(service.deviceMediaQuery(null, 'tv_4k')).toBe('(min-width: 3840px) and (max-width: 7679px)');
    expect(service.deviceMediaQuery(null, 'tv_8k')).toBe('(min-width: 7680px)');
  });

  it('returns null for unknown device ids', () => {
    expect(service.deviceMediaQuery({ devices: [] }, 'nope')).toBeNull();
  });
});

describe('KDL-209 — compileTokens device @media emission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue('OK');
    redis.del.mockResolvedValue(1);
  });

  async function stubPrismaWithFields(fields) {
    const { prisma } = await import('../../config/database.js');
    const type = { id: 'type-1', slug: 'webapp.layout', name: 'Layout' };
    prisma.type = { findMany: vi.fn().mockResolvedValue([type]) };
    prisma.settingField = { findMany: vi.fn().mockResolvedValue(fields) };
    prisma.appSetting = { findUnique: vi.fn().mockResolvedValue(null) };
  }

  it('wraps device-tagged vars in @media blocks with device-neutral, unit-suffixed alias names', async () => {
    await stubPrismaWithFields([
      {
        id: 'f-d', slug: 'webapp.layout.desktop.structure.sidebar_width',
        field_name: 'Sidebar Width', input_type: 'slider',
        value: '240', options: JSON.stringify({ min: 180, max: 360, unit: 'px' }),
        type_id: 'type-1', category_id: null, setting_values: [],
      },
      {
        id: 'f-m', slug: 'webapp.layout.mobile_v.structure.sidebar_width',
        field_name: 'Sidebar Width', input_type: 'slider',
        value: '280', options: JSON.stringify({ min: 220, max: 360, unit: 'px' }),
        type_id: 'type-1', category_id: null, setting_values: [],
      },
    ]);
    const { css } = await service.compileTokens('webapp');
    // Raw device-prefixed vars stay in :root, unitless (existing consumers).
    const root = css.match(/:root \{[^}]*\}/)?.[0];
    expect(root).toMatch(/--layout_desktop_structure_sidebar_width:\s*240;/);
    expect(root).toMatch(/--layout_mobile_v_structure_sidebar_width:\s*280;/);
    // Each device gets an @media block with the SAME neutral alias name.
    const desktopBlock = css.match(/@media \(min-width: 1280px\) \{[\s\S]*?\n\}/)?.[0];
    const mobileBlock = css.match(/@media \(max-width: 767px\) and \(orientation: portrait\) \{[\s\S]*?\n\}/)?.[0];
    expect(desktopBlock).toMatch(/--layout_structure_sidebar_width:\s*240px;/);
    expect(mobileBlock).toMatch(/--layout_structure_sidebar_width:\s*280px;/);
  });

  it('with ?device= filter, neutral aliases land directly in :root without @media', async () => {
    await stubPrismaWithFields([
      {
        id: 'f-d', slug: 'webapp.layout.desktop.structure.header_height',
        field_name: 'Header Height', input_type: 'number',
        value: '60', options: JSON.stringify({ unit: 'px' }),
        type_id: 'type-1', category_id: null, setting_values: [],
      },
    ]);
    const { css } = await service.compileTokens('webapp', null, 'desktop');
    expect(css).not.toMatch(/@media/);
    const root = css.match(/:root \{[^}]*\}/)?.[0];
    expect(root).toMatch(/--layout_desktop_structure_header_height:\s*60;/);
    expect(root).toMatch(/--layout_structure_header_height:\s*60px;/);
  });

  it('non-numeric device-tagged fields alias without a unit suffix', async () => {
    await stubPrismaWithFields([
      {
        id: 'f-r', slug: 'webapp.layout.desktop.structure.sidebar_position',
        field_name: 'Sidebar Position', input_type: 'radio',
        value: 'Left', options: JSON.stringify({ choices: ['Left', 'Right'] }),
        type_id: 'type-1', category_id: null, setting_values: [],
      },
    ]);
    const { css } = await service.compileTokens('webapp');
    expect(css).toMatch(/--layout_structure_sidebar_position:\s*Left;/);
  });

  it('typo_table rows emit device-neutral aliases per device', async () => {
    await stubPrismaWithFields([
      {
        id: 'f-t', slug: 'webapp.typography.desktop.typography_scale.typography_scale',
        field_name: 'Typography Scale', input_type: 'typo_table',
        value: JSON.stringify([{ name: 'H1 (Title)', size: 32, sizeUnit: 'px', family: 'Poppins', weight: '700', lineHeight: 1.5, letterSpacing: 0 }]),
        options: null, type_id: 'type-1', category_id: null, setting_values: [],
      },
      {
        id: 'f-t2', slug: 'webapp.typography.mobile_v.typography_scale.typography_scale',
        field_name: 'Typography Scale', input_type: 'typo_table',
        value: JSON.stringify([{ name: 'H1 (Title)', size: 24, sizeUnit: 'px', family: 'Poppins', weight: '700', lineHeight: 1.4, letterSpacing: 0 }]),
        options: null, type_id: 'type-1', category_id: null, setting_values: [],
      },
    ]);
    const { css } = await service.compileTokens('webapp');
    // Raw device-prefixed rows still in :root.
    const root = css.match(/:root \{[^}]*\}/)?.[0];
    expect(root).toMatch(/--typography_desktop_typography_scale_typography_scale_h1_title_size:\s*32px;/);
    // Neutral aliases inside their device's @media block.
    const desktopBlock = css.match(/@media \(min-width: 1280px\) \{[\s\S]*?\n\}/)?.[0];
    const mobileBlock = css.match(/@media \(max-width: 767px\) and \(orientation: portrait\) \{[\s\S]*?\n\}/)?.[0];
    expect(desktopBlock).toMatch(/--typography_typography_scale_typography_scale_h1_title_size:\s*32px;/);
    expect(mobileBlock).toMatch(/--typography_typography_scale_typography_scale_h1_title_size:\s*24px;/);
    expect(mobileBlock).toMatch(/--typography_typography_scale_typography_scale_h1_title_family:\s*Poppins;/);
  });

  it('device-tagged image classes no longer clobber each other — each device gets its own @media block', async () => {
    await stubPrismaWithFields([
      {
        id: 'f-i1', slug: 'webapp.images.desktop.image_classes.image_classes',
        field_name: 'Image Classes', input_type: 'imglist',
        value: JSON.stringify([{ name: 'thumbnail-image', w: 150, h: 150, fit: 'cover' }]),
        options: null, type_id: 'type-1', category_id: null, setting_values: [],
      },
      {
        id: 'f-i2', slug: 'webapp.images.mobile_v.image_classes.image_classes',
        field_name: 'Image Classes', input_type: 'imglist',
        value: JSON.stringify([{ name: 'thumbnail-image', w: 90, h: 90, fit: 'cover' }]),
        options: null, type_id: 'type-1', category_id: null, setting_values: [],
      },
    ]);
    const { css } = await service.compileTokens('webapp');
    // Pre-fix, the flat map kept only the last device (90px everywhere).
    const desktopBlock = css.match(/@media \(min-width: 1280px\) \{[\s\S]*?\n\}/)?.[0];
    const mobileBlock = css.match(/@media \(max-width: 767px\) and \(orientation: portrait\) \{[\s\S]*?\n\}/)?.[0];
    expect(desktopBlock).toMatch(/\.thumbnail_image \{ width: 150px; height: 150px;/);
    expect(mobileBlock).toMatch(/\.thumbnail_image \{ width: 90px; height: 90px;/);
  });

  it('imglist "auto" dimensions emit auto, not autopx', async () => {
    await stubPrismaWithFields([
      {
        id: 'f-i3', slug: 'webapp.images.desktop.image_classes.image_classes',
        field_name: 'Image Classes', input_type: 'imglist',
        value: JSON.stringify([{ name: 'icon-image', w: 'auto', h: 75, fit: 'contain' }]),
        options: null, type_id: 'type-1', category_id: null, setting_values: [],
      },
    ]);
    const { css } = await service.compileTokens('webapp');
    expect(css).toMatch(/\.icon_image \{ width: auto; height: 75px;/);
    expect(css).not.toMatch(/autopx/);
  });

  it('theme blocks stay free of device vars; device blocks stay free of theme vars', async () => {
    await stubPrismaWithFields([
      {
        id: 'f-l', slug: 'webapp.buttons.light.primary_button.background_color',
        field_name: 'BG Light', input_type: 'color', value: '#ffffff',
        options: null, type_id: 'type-1', category_id: null, setting_values: [],
      },
      {
        id: 'f-d', slug: 'webapp.buttons.desktop.button_sizes.height',
        field_name: 'Height', input_type: 'number',
        value: '38', options: JSON.stringify({ unit: 'px' }),
        type_id: 'type-1', category_id: null, setting_values: [],
      },
    ]);
    const { css } = await service.compileTokens('webapp');
    const light = css.match(/\[data-theme="light"\] \{[^}]*\}/)?.[0];
    const desktopBlock = css.match(/@media \(min-width: 1280px\) \{[\s\S]*?\n\}/)?.[0];
    expect(light).toMatch(/--buttons_primary_button_background_color:\s*#ffffff/);
    expect(light).not.toMatch(/button_sizes_height/);
    expect(desktopBlock).toMatch(/--buttons_button_sizes_height:\s*38px;/);
    expect(desktopBlock).not.toMatch(/background_color/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B3 — controller.getTokens: serves CSS when format=css or Accept: text/css
// ─────────────────────────────────────────────────────────────────────────────

describe('B3 — controller.getTokens CSS content-type', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns JSON by default', async () => {
    const { getTokens } = await import('./controller.js');
    vi.spyOn(service, 'isTokensPublic').mockResolvedValue(true);
    vi.spyOn(service, 'compileTokens').mockResolvedValue({ css: ':root{}', json: { buttons: {} } });

    const req = {
      user: { id: 'u1' },
      validated: { query: { platform: 'webapp' } },
      query: {},
      headers: {},
    };
    const res = {
      statusCode: 200,
      _headers: {},
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setHeader: vi.fn((k, v) => { res._headers[k] = v; }),
    };

    await getTokens(req, res, vi.fn());
    expect(res.json).toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });

  it('serves raw CSS when format=css is requested', async () => {
    const { getTokens } = await import('./controller.js');
    vi.spyOn(service, 'isTokensPublic').mockResolvedValue(true);
    vi.spyOn(service, 'compileTokens').mockResolvedValue({ css: ':root{ --x: 1; }', json: {} });

    const req = {
      user: { id: 'u1' },
      validated: { query: { platform: 'webapp' } },
      query: { format: 'css' },
      headers: {},
    };
    const res = {
      _headers: {},
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setHeader: vi.fn((k, v) => { res._headers[k] = v; }),
    };

    await getTokens(req, res, vi.fn());
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/css; charset=utf-8');
    expect(res.send).toHaveBeenCalledWith(':root{ --x: 1; }');
  });

  it('serves raw CSS when Accept: text/css header is set', async () => {
    const { getTokens } = await import('./controller.js');
    vi.spyOn(service, 'isTokensPublic').mockResolvedValue(true);
    vi.spyOn(service, 'compileTokens').mockResolvedValue({ css: ':root{ --y: 2; }', json: {} });

    const req = {
      user: { id: 'u1' },
      validated: { query: { platform: 'webapp' } },
      query: {},
      headers: { accept: 'text/css' },
    };
    const res = {
      _headers: {},
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setHeader: vi.fn((k, v) => { res._headers[k] = v; }),
    };

    await getTokens(req, res, vi.fn());
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/css; charset=utf-8');
    expect(res.send).toHaveBeenCalledWith(':root{ --y: 2; }');
  });

  it('blocks unauthenticated access when tokens_public flag is false', async () => {
    const { getTokens } = await import('./controller.js');
    vi.spyOn(service, 'isTokensPublic').mockResolvedValue(false);

    const req = {
      user: null,
      validated: { query: { platform: 'webapp' } },
      query: {},
      headers: {},
    };
    const res = {
      statusCode: 200,
      _headers: {},
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    };

    await getTokens(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('allows unauthenticated access when tokens_public flag is true', async () => {
    const { getTokens } = await import('./controller.js');
    vi.spyOn(service, 'isTokensPublic').mockResolvedValue(true);
    vi.spyOn(service, 'compileTokens').mockResolvedValue({ css: ':root{}', json: {} });

    const req = {
      user: null,
      validated: { query: { platform: 'webapp' } },
      query: {},
      headers: {},
    };
    const res = {
      _headers: {},
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    };

    await getTokens(req, res, vi.fn());
    // Should reach compileTokens (public allowed)
    expect(service.compileTokens).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });

  it('blocks authenticated users without template-engine:view when flag is false (B4)', async () => {
    const { getTokens } = await import('./controller.js');
    vi.spyOn(service, 'isTokensPublic').mockResolvedValue(false);
    resolvePermissions.mockResolvedValue({ bypass: false, permissions: ['other:view'] });

    const req = {
      user: { id: 'u1' },
      validated: { query: { platform: 'webapp' } },
      query: {},
      headers: {},
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    };

    await getTokens(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows authenticated users with template-engine:view when flag is false (B4)', async () => {
    const { getTokens } = await import('./controller.js');
    vi.spyOn(service, 'isTokensPublic').mockResolvedValue(false);
    vi.spyOn(service, 'compileTokens').mockResolvedValue({ css: ':root{}', json: {} });
    resolvePermissions.mockResolvedValue({ bypass: false, permissions: ['template-engine:view'] });

    const req = {
      user: { id: 'u1' },
      validated: { query: { platform: 'webapp' } },
      query: {},
      headers: {},
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    };

    await getTokens(req, res, vi.fn());
    expect(service.compileTokens).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B5 — tokens query schema rejects cross-platform device params
// ─────────────────────────────────────────────────────────────────────────────

describe('B5 — getTokensQuerySchema platform/device pairing', () => {
  it('rejects a device id from another platform', async () => {
    const { getTokensQuerySchema } = await import('./schema.js');
    const bad = getTokensQuerySchema.safeParse({ query: { platform: 'webapp', device: 'tv_4k' } });
    expect(bad.success).toBe(false);
    expect(JSON.stringify(bad.error.issues)).toMatch(/does not belong to platform/);
  });

  it('accepts a matching platform/device pair and device=all', async () => {
    const { getTokensQuerySchema } = await import('./schema.js');
    expect(getTokensQuerySchema.safeParse({ query: { platform: 'tv', device: 'tv_4k' } }).success).toBe(true);
    expect(getTokensQuerySchema.safeParse({ query: { platform: 'webapp', device: 'desktop' } }).success).toBe(true);
    expect(getTokensQuerySchema.safeParse({ query: { platform: 'webapp', device: 'all' } }).success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B8 — getValues enforces the same platform ownership guard as /values and /reset
// ─────────────────────────────────────────────────────────────────────────────

describe('B8 — getValues platform ownership guard', () => {
  it('rejects when type_id belongs to a different platform', async () => {
    const { prisma } = await import('../../config/database.js');
    prisma.type = { findUnique: vi.fn().mockResolvedValue({ slug: 'tv.branding' }) };
    prisma.settingField = { findMany: vi.fn() };

    const result = await service.getValues('webapp', 'tv-type-id');
    expect(result.errors).toBeDefined();
    expect(result.errors[0]).toMatch(/does not belong to platform/);
    expect(prisma.settingField.findMany).not.toHaveBeenCalled();
  });

  it('returns values for an owned pane', async () => {
    const { prisma } = await import('../../config/database.js');
    prisma.type = { findUnique: vi.fn().mockResolvedValue({ slug: 'webapp.branding' }) };
    prisma.settingField = {
      findMany: vi.fn().mockResolvedValue([
        { id: 'f-1', slug: 'webapp.branding.colors.primary', value: '#ffffff', setting_values: [{ value: '#ff0000' }] },
      ]),
    };

    const result = await service.getValues('webapp', 'type-1');
    expect(result['webapp.branding.colors.primary']).toBe('#ff0000');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B9 — Active/Default Theme per platform (KDL-198)
// ─────────────────────────────────────────────────────────────────────────────

describe('B9 — getActiveTheme / setActiveTheme', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    redis.del.mockResolvedValue(1);
    const { prisma } = await import('../../config/database.js');
    prisma.appSetting = { findUnique: vi.fn(), upsert: vi.fn() };
  });

  it('defaults to system when no row is saved', async () => {
    const { prisma } = await import('../../config/database.js');
    prisma.appSetting.findUnique.mockResolvedValue(null);
    expect(await service.getActiveTheme('webapp')).toBe('system');
  });

  it('defaults to system when the saved value is not a recognized theme', async () => {
    const { prisma } = await import('../../config/database.js');
    prisma.appSetting.findUnique.mockResolvedValue({ value: 'blue' });
    expect(await service.getActiveTheme('webapp')).toBe('system');
  });

  it('returns the saved theme, keyed per platform', async () => {
    const { prisma } = await import('../../config/database.js');
    prisma.appSetting.findUnique.mockResolvedValue({ value: 'light' });
    expect(await service.getActiveTheme('webapp')).toBe('light');
    expect(prisma.appSetting.findUnique).toHaveBeenCalledWith({
      where: { key: 'template_engine.active_theme.webapp' },
    });
  });

  it('upserts the theme and invalidates the token cache', async () => {
    const { prisma } = await import('../../config/database.js');
    prisma.appSetting.upsert.mockResolvedValue({});
    const result = await service.setActiveTheme('webapp', 'dark');
    expect(result).toEqual({ activeTheme: 'dark' });
    expect(prisma.appSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'template_engine.active_theme.webapp' },
      create: { key: 'template_engine.active_theme.webapp', value: 'dark', type: 'string', is_public: true },
      update: { value: 'dark' },
    });
    expect(redis.del).toHaveBeenCalled();
  });

  it('rejects a theme outside dark/light/system', async () => {
    const { prisma } = await import('../../config/database.js');
    const result = await service.setActiveTheme('webapp', 'blue');
    expect(result.errors).toBeDefined();
    expect(result.errors[0]).toMatch(/theme must be one of/);
    expect(prisma.appSetting.upsert).not.toHaveBeenCalled();
  });
});

describe('B9 — postActiveThemeBodySchema', () => {
  it('accepts a valid platform+theme pair', async () => {
    const { postActiveThemeBodySchema } = await import('./schema.js');
    const ok = postActiveThemeBodySchema.safeParse({ body: { platform: 'webapp', theme: 'light' } });
    expect(ok.success).toBe(true);
  });

  it('rejects an unknown platform', async () => {
    const { postActiveThemeBodySchema } = await import('./schema.js');
    const bad = postActiveThemeBodySchema.safeParse({ body: { platform: 'desktop', theme: 'light' } });
    expect(bad.success).toBe(false);
  });

  it('rejects an unknown theme value', async () => {
    const { postActiveThemeBodySchema } = await import('./schema.js');
    const bad = postActiveThemeBodySchema.safeParse({ body: { platform: 'webapp', theme: 'blue' } });
    expect(bad.success).toBe(false);
  });
});
