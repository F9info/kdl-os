import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
const { orderSeeders, planSeeders, runSeeders, recordRun, readRuns, readLog, MAX_LOG } = await import('./manager.js');

// A fake client with app_settings and a $transaction that rolls the settings back on failure.
let store;
const mkClient = (data) => ({
  appSetting: {
    findUnique: vi.fn(async ({ where }) => (data.has(where.key) ? { value: data.get(where.key) } : null)),
    upsert: vi.fn(async ({ where, update, create }) => data.set(where.key, data.has(where.key) ? update.value : create.value)),
  },
});
let prisma;
beforeEach(() => {
  store = new Map();
  const base = mkClient(store);
  prisma = {
    ...base,
    $transaction: vi.fn(async (fn) => {
      const snapshot = new Map(store);
      try {
        return await fn(mkClient(store));
      } catch (e) {
        store.clear();
        snapshot.forEach((v, k) => store.set(k, v));
        throw e;
      }
    }),
  };
});

const s = (name, extra = {}) => ({ name, version: '1', run: vi.fn(async () => {}), ...extra });

describe('orderSeeders', () => {
  it('puts dependencies first and otherwise keeps the given order', () => {
    const out = orderSeeders([s('c', { dependsOn: ['a'] }), s('a'), s('b')]);
    expect(out.map((x) => x.name)).toEqual(['a', 'c', 'b']);
  });
  it('rejects unknown dependencies, duplicates and cycles', () => {
    expect(() => orderSeeders([s('a', { dependsOn: ['zz'] })])).toThrow(/unknown seeder "zz"/);
    expect(() => orderSeeders([s('a'), s('a')])).toThrow(/Duplicate/);
    expect(() => orderSeeders([s('a', { dependsOn: ['b'] }), s('b', { dependsOn: ['a'] })])).toThrow(/Circular/);
  });
});

describe('runSeeders', () => {
  it('runs in dependency order, one transaction each, and records version and status', async () => {
    const order = [];
    const list = [s('b', { dependsOn: ['a'], run: async () => order.push('b') }), s('a', { run: async () => order.push('a') })];
    const ran = await runSeeders(prisma, list);
    expect(ran).toEqual(['a', 'b']);
    expect(order).toEqual(['a', 'b']);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    const runs = await readRuns(prisma);
    expect(runs.a).toMatchObject({ version: '1', status: 'done' });
    expect((await readLog(prisma)).map((l) => l.seeder)).toEqual(['a', 'b']);
  });

  it('a failure rolls that seeder back, is recorded as failed, stops the run and rethrows', async () => {
    const later = s('c', { dependsOn: ['b'] });
    const list = [s('a'), s('b', { dependsOn: ['a'], run: async (tx) => { await recordRun(tx, 'half-written', { status: 'done' }); throw new Error('boom'); } }), later];
    await expect(runSeeders(prisma, list)).rejects.toMatchObject({ message: 'boom', seeder: 'b' });
    const runs = await readRuns(prisma);
    expect(runs.a.status).toBe('done');
    expect(runs.b).toMatchObject({ status: 'failed', error: 'boom' });
    expect(runs['half-written']).toBeUndefined(); // rolled back with the failed seeder
    expect(later.run).not.toHaveBeenCalled();
  });

  it('--pending skips seeders whose current version is done, re-runs failed and bumped ones', async () => {
    const a = s('a');
    const b = s('b');
    await runSeeders(prisma, [a, b]);
    a.run.mockClear();
    b.run.mockClear();
    const steps = [];
    await runSeeders(prisma, [a, { ...b, version: '2' }], { pending: true, onStep: (x) => steps.push(`${x.name}:${x.status}`) });
    expect(a.run).not.toHaveBeenCalled();
    expect(b.run).toHaveBeenCalledTimes(1);
    expect(steps).toContain('a:skipped');
    expect((await readRuns(prisma)).b.version).toBe('2');
  });

  it('without --pending everything runs again (every seeder is idempotent)', async () => {
    const a = s('a');
    await runSeeders(prisma, [a]);
    await runSeeders(prisma, [a]);
    expect(a.run).toHaveBeenCalledTimes(2);
  });

  it('only runs the named seeders and what they need', async () => {
    const list = [s('a'), s('b', { dependsOn: ['a'] }), s('c')];
    expect(await runSeeders(prisma, list, { only: 'b' })).toEqual(['a', 'b']);
    await expect(runSeeders(prisma, list, { only: 'nope' })).rejects.toThrow(/Unknown seeder/);
  });

  it('passes ctx and the transaction client to each seeder, and can opt out of a transaction', async () => {
    const run = vi.fn(async () => {});
    await runSeeders(prisma, [s('a', { run }), s('b', { transactional: false, run: vi.fn() })], { ctx: { x: 1 } });
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ appSetting: expect.anything() }), { x: 1 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('planSeeders / log', () => {
  it('says why each seeder would run', async () => {
    await runSeeders(prisma, [s('a')]);
    const plan = await planSeeders(prisma, [s('a'), s('b', { version: '2' })], { pending: true });
    expect(plan.map((p) => [p.name, p.run, p.current])).toEqual([['a', false, true], ['b', true, false]]);
  });
  it('keeps the log capped', async () => {
    for (let i = 0; i < MAX_LOG + 25; i++) await recordRun(prisma, 'x', { status: 'done' });
    expect((await readLog(prisma, 1000)).length).toBe(MAX_LOG);
  });
});
