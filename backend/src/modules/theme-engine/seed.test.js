import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));

import { seedThemeEngine } from './seed.js';

// In-memory prisma stand-in with unique-slug semantics, so idempotency is
// exercised against the same contract the real tables enforce.
const makeFakePrisma = () => {
  let seq = 0;
  const nid = () => `id_${++seq}`;
  const table = () => {
    const rows = new Map(); // slug -> row
    return {
      rows,
      upsert: async ({ where, update, create }) => {
        const cur = rows.get(where.slug);
        if (cur) {
          Object.assign(cur, update);
          return cur;
        }
        const row = { id: nid(), ...create };
        rows.set(create.slug, row);
        return row;
      },
      findMany: async ({ where } = {}) => {
        const all = [...rows.values()];
        return where?.slug?.in ? all.filter((r) => where.slug.in.includes(r.slug)) : all;
      },
      createMany: async ({ data, skipDuplicates }) => {
        let count = 0;
        for (const d of data) {
          if (rows.has(d.slug)) {
            if (!skipDuplicates) throw new Error(`unique violation: ${d.slug}`);
            continue;
          }
          rows.set(d.slug, { id: nid(), ...d });
          count += 1;
        }
        return { count };
      },
      update: async ({ where, data }) => {
        const cur = rows.get(where.slug);
        if (!cur) throw new Error(`not found: ${where.slug}`);
        Object.assign(cur, data);
        return cur;
      },
      deleteMany: async ({ where }) => {
        const keep = new Set(where?.slug?.notIn ?? []);
        let count = 0;
        for (const [slug] of rows) {
          if (!keep.has(slug)) {
            rows.delete(slug);
            count += 1;
          }
        }
        return { count };
      },
    };
  };
  return { type: table(), category: table(), settingField: table() };
};

describe('theme-engine seed (A3 gate)', () => {
  it('seeds full catalogue and a re-run yields 0 duplicates', async () => {
    const db = makeFakePrisma();

    const first = await seedThemeEngine(db);
    expect(first).toMatchObject({ types: 97, categories: 968, fields: 4084, created: 4084 });
    expect(db.type.rows.size).toBe(97);
    expect(db.category.rows.size).toBe(968);
    expect(db.settingField.rows.size).toBe(4084);

    const second = await seedThemeEngine(db);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(0);
    // No row counts changed and every slug is still unique (Map keyed on slug).
    expect(db.type.rows.size).toBe(97);
    expect(db.category.rows.size).toBe(968);
    expect(db.settingField.rows.size).toBe(4094);
  });

  it('spot-check: webapp primary button background color row with correct default', async () => {
    const db = makeFakePrisma();
    await seedThemeEngine(db);

    // Arch example slug uses a device tag, but Primary Button is theme-tagged
    // in the prototype (ported verbatim) — dark/light rows are the real ones.
    const row = db.settingField.rows.get('webapp.buttons.dark.primary_button.background_color');
    expect(row).toBeDefined();
    expect(row.field_name).toBe('Background Color');
    expect(row.input_type).toBe('color');
    expect(row.value).toBe('#4f8ef7');
    expect(row.sort).toBe(0);
    expect(row.type_id).toBe(db.type.rows.get('webapp.buttons').id);
    expect(row.category_id).toBe(db.category.rows.get('webapp.buttons.primary_button.dark').id);
  });

  it('re-run after a manual edit restores schema defaults', async () => {
    const db = makeFakePrisma();
    await seedThemeEngine(db);
    const slug = 'webapp.buttons.dark.primary_button.background_color';
    db.settingField.rows.get(slug).value = '#000000';

    const res = await seedThemeEngine(db);
    expect(res.created).toBe(0);
    expect(res.updated).toBe(1);
    expect(db.settingField.rows.get(slug).value).toBe('#4f8ef7');
  });
});
