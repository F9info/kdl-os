// KDL-515 — D-BK-6 integration regression guard.
//
// This test closes the end-to-end loop that all existing brand-kit unit tests
// miss:  they mock Prisma, so TYPE_NOT_SEEDED and Unknown-field errors are
// invisible.  This test hits the real DB and proves the brand-kit seeder
// produces rows that satisfy both service calls.
//
// Flow:
//   1. Run seedBrandKit(prisma) — creates webapp.brand-kit Type + 51 SettingField rows
//   2. Insert a test BrandKit in approved status with a real OKLCH palette
//   3. Call getTokens() — must resolve the type UUID without throwing TYPE_NOT_SEEDED
//   4. Feed the returned payload verbatim into upsertValues() — must return
//      { saved: N } with NO errors (zero Unknown-field rejections)
//
// Guard: opt-in only — skipped unless both DATABASE_URL and RUN_DB_TESTS=1 are set.
// This test writes and deletes real SettingValue rows; the guard prevents it from
// running accidentally against a shared or staging database.
// Run against a full stack with:
//   DATABASE_URL=<url> REDIS_URL=<url> \
//   MINIO_ENDPOINT=<host> MINIO_PORT=9000 MINIO_BUCKET=<bucket> \
//   MINIO_ACCESS_KEY=<key> MINIO_SECRET_KEY=<secret> MINIO_USE_SSL=false \
//   RUN_DB_TESTS=1 npx vitest run brand-kit.d-bk-6
//
// All DB-touching imports are lazy (inside beforeAll) so this file does not
// throw at module-load time in environments without DATABASE_URL.

import { describe, it, beforeAll, afterAll, expect } from 'vitest';

const HAS_DB = !!process.env.DATABASE_URL && !!process.env.RUN_DB_TESTS;

// Minimal approved-kit palette that exercises primary + neutral ramps + hex slots.
const TEST_PALETTE = {
  schemaVersion: 1,
  colors: {
    primary: {
      hex: '#0e6e5c',
      oklch: [0.52, 0.11, 172],
      confidence: 0.46,
      ramp: {
        50: '#f2fbf8', 100: '#d4f0e8', 200: '#a8e0d0', 300: '#74ccb5',
        400: '#3baa93', 500: '#0e6e5c', 600: '#0a5547', 700: '#07403a',
        800: '#042f2b', 900: '#021e1b',
      },
      anchorStep: '500',
    },
    secondary: null,
    accent: null,
    neutral: {
      hex: '#6b7280',
      oklch: [0.52, 0.01, 264],
      confidence: 0.08,
      ramp: {
        50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db',
        400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151',
        800: '#1f2937', 900: '#111827',
      },
      anchorStep: '500',
    },
  },
  paletteConfidence: 'medium',
};

const TEST_PROJECT_ID = 'integration-test-kdl515-d-bk-6';

describe.skipIf(!HAS_DB)('D-BK-6 integration: brand-kit → theme-engine round-trip', () => {
  // Lazy-loaded so database.js is never imported when DATABASE_URL is absent.
  let prisma, getTokens, upsertValues, compileTokens;

  beforeAll(async () => {
    const db = await import('../../config/database.js');
    const brandKitSvc = await import('./service.js');
    const themeSvc = await import('../theme-engine/service.js');
    const seeder = await import('../../../prisma/seeders/brand-kit.seed.js');

    prisma = db.prisma;
    getTokens = brandKitSvc.getTokens;
    upsertValues = themeSvc.upsertValues;
    compileTokens = themeSvc.compileTokens;

    // Seed the webapp.brand-kit Type and all 51 SettingField rows.
    await seeder.seedBrandKit(prisma);

    // Create (or update) a test BrandKit in approved status with a known palette.
    // project_id has no FK constraint (see brand-kit.prisma comment), so no
    // project row is needed.
    await prisma.brandKit.upsert({
      where: { project_id: TEST_PROJECT_ID },
      create: {
        project_id: TEST_PROJECT_ID,
        status: 'approved',
        palette: TEST_PALETTE,
        contrast_report: { adjustments: [] },
        typography: { heading: { family: 'Sora' }, body: { family: 'Inter' }, scaleRatio: 1.25 },
        acknowledged_contrast_adjustments: true,
        approved_at: new Date(),
      },
      update: {
        status: 'approved',
        palette: TEST_PALETTE,
        contrast_report: { adjustments: [] },
        typography: { heading: { family: 'Sora' }, body: { family: 'Inter' }, scaleRatio: 1.25 },
        acknowledged_contrast_adjustments: true,
        approved_at: new Date(),
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;

    // Remove SettingValue rows written by upsertValues().
    const brandKitType = await prisma.type.findFirst({
      where: { slug: 'webapp.brand-kit' },
      select: { id: true },
    });
    if (brandKitType) {
      const fields = await prisma.settingField.findMany({
        where: { type_id: brandKitType.id },
        select: { id: true },
      });
      await prisma.settingValue.deleteMany({
        where: { field_id: { in: fields.map((f) => f.id) } },
      });
    }

    await prisma.brandKit.deleteMany({ where: { project_id: TEST_PROJECT_ID } });
  });

  it('getTokens resolves the webapp.brand-kit type UUID without TYPE_NOT_SEEDED', async () => {
    const payload = await getTokens(TEST_PROJECT_ID, 'webapp');
    expect(payload).toMatchObject({ platform: 'webapp', values: expect.any(Array) });
    expect(payload.type_id).toBeTruthy();
    expect(payload.values.length).toBeGreaterThan(0);
  });

  it('upsertValues accepts every value entry with zero Unknown-field errors', async () => {
    const payload = await getTokens(TEST_PROJECT_ID, 'webapp');

    const result = await upsertValues('webapp', payload.type_id, payload.values, null);

    // Prove D-BK-6: no Unknown-field rejections, all entries saved.
    expect(result.errors).toBeUndefined();
    expect(result.saved).toBe(payload.values.length);
  });

  // KDL-532 regression: compileTokens namespace guard for single-segment slugs.
  // Runs after the upsertValues test has written real SettingValue rows.
  it('compileTokens emits distinct --brand-kit-* CSS vars with no junk keys or undefined pane', async () => {
    const payload = await getTokens(TEST_PROJECT_ID, 'webapp');
    const writtenSlugs = payload.values.map((v) => v.slug);

    // upsertValues (previous test) invalidates the Redis cache, so this call
    // recomputes from DB and picks up the freshly written SettingValue rows.
    const result = await compileTokens('webapp', null, null);

    // Every written brand-kit slug must appear as --<slug>: in :root CSS.
    for (const slug of writtenSlugs) {
      expect(result.css, `expected CSS var --${slug} to be present`).toContain(`--${slug}:`);
    }

    // No junk '--' key (produced when tokenName collapses to '').
    expect(result.css).not.toMatch(/^\s*--:\s/m);

    // No undefined pane in the JSON tree.
    expect(Object.keys(result.json)).not.toContain('undefined');

    // brand-kit pane exists in the JSON tree.
    expect(result.json['brand-kit']).toBeDefined();
  });
});
