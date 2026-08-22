import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));

import { seedCredits } from './seed.js';

// ---------------------------------------------------------------------------
// In-memory AppSetting store with the same unique-key contract as the real
// table, so upsert/idempotency is exercised against a realistic surface.
// ---------------------------------------------------------------------------

const makeFakePrisma = () => {
  const rows = new Map(); // key -> row
  let seq = 0;
  const nid = () => `id_${++seq}`;

  return {
    appSetting: {
      upsert: async ({ where, create, update }) => {
        const cur = rows.get(where.key);
        if (cur) {
          // Mirrors Prisma's update:{} — nothing is overwritten on existing rows.
          Object.assign(cur, update);
          return cur;
        }
        const row = { id: nid(), ...create };
        rows.set(create.key, row);
        return row;
      },
      findUnique: async ({ where }) => rows.get(where.key) ?? null,
      // Simulate the migration: idempotent UPDATE guarded by the stale value.
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const row of rows.values()) {
          if (row.key === where.key && row.value === where.value) {
            Object.assign(row, data);
            count += 1;
          }
        }
        return { count };
      },
    },
    _rows: rows, // expose for assertions
  };
};

// ---------------------------------------------------------------------------
// KDL-618: migration helper (mirrors migration.sql logic in JS for unit tests)
// ---------------------------------------------------------------------------

/**
 * Idempotent upgrade function that corresponds to the SQL migration
 * 20260822000000_backfill_credits_new_project_seed_mc.
 * Only updates the row when it still holds the stale default 10000000.
 */
async function applyBackfill(prismaClient) {
  return prismaClient.appSetting.updateMany({
    where: { key: 'credits.new_project_seed_mc', value: '10000000' },
    data: { value: '100000000' },
  });
}

// ---------------------------------------------------------------------------

describe('seedCredits (KDL-618)', () => {
  it('creates all four settings on a fresh DB', async () => {
    const db = makeFakePrisma();
    await seedCredits(db);

    expect(db._rows.size).toBe(4);
    expect(db._rows.get('credits.new_project_seed_mc').value).toBe('100000000');
    expect(db._rows.get('credits.usd_per_credit').value).toBe('0.01');
    expect(db._rows.get('credits.hold_ttl_seconds').value).toBe('900');
    expect(db._rows.get('credits.max_overage_pct').value).toBe('25');
  });

  it('is idempotent: re-running does not change existing rows', async () => {
    const db = makeFakePrisma();
    await seedCredits(db);
    // Confirm first run wrote correct value.
    expect(db._rows.get('credits.new_project_seed_mc').value).toBe('100000000');

    // Second run must not mutate the row (update:{} contract).
    await seedCredits(db);
    expect(db._rows.get('credits.new_project_seed_mc').value).toBe('100000000');
    expect(db._rows.size).toBe(4); // no extra rows created
  });

  it('does NOT overwrite a custom operator value on re-seed', async () => {
    const db = makeFakePrisma();
    await seedCredits(db); // initial seed
    // Operator deliberately raises the limit.
    db._rows.get('credits.new_project_seed_mc').value = '500000000';

    await seedCredits(db); // re-seed must not clobber the custom value
    expect(db._rows.get('credits.new_project_seed_mc').value).toBe('500000000');
  });
});

describe('applyBackfill migration (KDL-618)', () => {
  it('upgrades a stale 10000000 row to 100000000', async () => {
    const db = makeFakePrisma();
    // Pre-seed a row at the old stale default, exactly as legacy DBs look.
    db._rows.set('credits.new_project_seed_mc', {
      id: 'id_stale',
      key: 'credits.new_project_seed_mc',
      value: '10000000',
      type: 'number',
      description: 'µc auto-granted to every new project on creation (0 = disabled)',
    });

    const { count } = await applyBackfill(db);

    expect(count).toBe(1);
    expect(db._rows.get('credits.new_project_seed_mc').value).toBe('100000000');
  });

  it('is idempotent: second run touches zero rows', async () => {
    const db = makeFakePrisma();
    db._rows.set('credits.new_project_seed_mc', {
      id: 'id_stale',
      key: 'credits.new_project_seed_mc',
      value: '10000000',
      type: 'number',
    });

    await applyBackfill(db);
    const { count } = await applyBackfill(db); // second run

    expect(count).toBe(0); // WHERE no longer matches
    expect(db._rows.get('credits.new_project_seed_mc').value).toBe('100000000');
  });

  it('does NOT touch a custom operator value (neither stale nor new default)', async () => {
    const db = makeFakePrisma();
    db._rows.set('credits.new_project_seed_mc', {
      id: 'id_custom',
      key: 'credits.new_project_seed_mc',
      value: '500000000', // intentional custom override
      type: 'number',
    });

    const { count } = await applyBackfill(db);

    expect(count).toBe(0); // guard prevents stomping the custom value
    expect(db._rows.get('credits.new_project_seed_mc').value).toBe('500000000');
  });

  it('does NOT touch a row already at the new default 100000000', async () => {
    const db = makeFakePrisma();
    db._rows.set('credits.new_project_seed_mc', {
      id: 'id_correct',
      key: 'credits.new_project_seed_mc',
      value: '100000000',
      type: 'number',
    });

    const { count } = await applyBackfill(db);

    expect(count).toBe(0);
    expect(db._rows.get('credits.new_project_seed_mc').value).toBe('100000000');
  });
});
