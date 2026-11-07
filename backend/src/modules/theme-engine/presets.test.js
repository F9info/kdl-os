import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
const presets = await import('./presets.js');
const { BUILTIN_PRESETS } = await import('./preset-defaults.js');
const { createPresetSchema } = await import('./schema.js');

function fakeClient() {
  const rows = [];
  const m = (r, w) => Object.entries(w).every(([k, v]) => (v === null ? r[k] == null : r[k] === v));
  return {
    rows,
    themePreset: {
      findMany: vi.fn(async ({ where } = {}) => rows.filter((r) => m(r, where ?? {}))),
      findFirst: vi.fn(async ({ where }) => rows.find((r) => m(r, where)) ?? null),
      upsert: vi.fn(async ({ where, create }) => rows.find((r) => r.key === where.key) ?? (rows.push({ id: `i${rows.length}`, deleted_at: null, ...create }), rows.at(-1))),
      create: vi.fn(async ({ data }) => (rows.push({ id: `i${rows.length}`, deleted_at: null, ...data }), rows.at(-1))),
      update: vi.fn(async ({ where, data }) => Object.assign(rows.find((r) => r.id === where.id), data)),
    },
  };
}

describe('theme presets library (T10)', () => {
  it('seeds the built-ins once; edits and deletions stick', async () => {
    const c = fakeClient();
    expect((await presets.listPresets(c)).map((p) => p.name)).toEqual(BUILTIN_PRESETS.map((p) => p.name));
    await presets.updatePreset('ocean', { name: 'My ocean' }, c);
    await presets.deletePreset('forest', c);
    const after = await presets.listPresets(c);
    expect(after.find((p) => p.key === 'ocean').name).toBe('My ocean');
    expect(after.map((p) => p.key)).not.toContain('forest');
  });

  it('saves the current colours as a user preset, and duplicates one', async () => {
    const c = fakeClient();
    const light = BUILTIN_PRESETS[0].light, dark = BUILTIN_PRESETS[0].dark;
    const mine = await presets.createPreset({ name: 'Brand look', light, dark }, 'u1', c);
    expect(mine.builtin).toBe(false);
    const copy = await presets.duplicatePreset(mine.key, {}, 'u1', c);
    expect(copy.name).toBe('Brand look (copy)');
    expect(copy.light).toEqual(light);
  });

  it('unknown key is a 404', async () => {
    await expect(presets.updatePreset('nope', { name: 'x' }, fakeClient())).rejects.toMatchObject({ status: 404 });
  });

  it('colours must be 6-digit hex', () => {
    const p = BUILTIN_PRESETS[0];
    expect(createPresetSchema.safeParse({ body: { name: 'a', light: p.light, dark: p.dark } }).success).toBe(true);
    expect(createPresetSchema.safeParse({ body: { name: 'a', light: { ...p.light, primary: 'red' }, dark: p.dark } }).success).toBe(false);
    expect(createPresetSchema.safeParse({ body: { name: '', light: p.light, dark: p.dark } }).success).toBe(false);
  });
});
