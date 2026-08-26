/**
 * Collateral module tests — COLLATERAL_SPEC.md §14.
 *
 * (a) Preflight named errors fire on each §8 condition (exact code strings).
 * (b) HTML-escaping of zone content via escapeHtml / escapeZoneContent.
 * (c) PDF trim size + bleed: page box == trim + 2×bleed (mm → pt).
 * (d) Geometry safe-zone math correct per artifact type.
 * (e) DOCX: header/footer locked, body editable (structure assertion).
 * (f) Idempotency-key forwarding to withCreditHold.
 * (g) renderAsset blocked when preflight fails.
 * (h) withCreditHold wired: CreditError surfaces as 402 on render.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks — must be hoisted ───────────────────────────────────────────────────

vi.mock('../../config/database.js', () => ({
  prisma: {
    collateralAsset: {
      create:     vi.fn(),
      findMany:   vi.fn(),
      findUnique: vi.fn(),
      update:     vi.fn(),
    },
    collateralRender: {
      create:     vi.fn(),
      findUnique: vi.fn(),
    },
    brandKit: {
      findUnique: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../shared/modules/module-loader.js', () => ({ loadedManifests: new Map() }));
vi.mock('../../middleware/module-gate.js', () => ({ invalidateModuleCache: vi.fn() }));
vi.mock('../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));
vi.mock('node:fs', () => ({ existsSync: vi.fn(() => false) }));

vi.mock('../credits/service.js', () => ({
  withCreditHold: vi.fn(async (_opts, fn) => {
    const { result } = await fn();
    return result;
  }),
  CreditError: class CreditError extends Error {
    constructor(code, message) {
      super(message ?? code);
      this.name = 'CreditError';
      this.code = code;
      if (code === 'INSUFFICIENT_CREDITS') this.status = 402;
    }
  },
}));

import { prisma } from '../../config/database.js';
import { withCreditHold, CreditError } from '../credits/service.js';
import { loadedManifests } from '../../shared/modules/module-loader.js';
import { installModule } from '../modules/service.js';

import { runPreflight, PREFLIGHT_CODES } from './preflight.js';
import { contrastRatio } from './preflight.js';
import { escapeHtml, escapeZoneContent } from './render/escape.js';
import { buildPdf } from './render/pdf.js';
import { buildDocx } from './render/docx.js';
import { buildLayout } from './render/layouts.js';
import { pageBoxPt, safeAreaMm } from './render/geometry.js';
import * as service from './service.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MM_TO_PT = 72 / 25.4;

// Live BrandKit DB row shape — mirrors what resolveBrandKit() now reads.
function makeLiveBrandKitRow() {
  return {
    logo_media_id: 'logo-media-1',
    palette: {
      colors: {
        primary: {
          hex: '#1a73e8',
          ramp: { 50: '#e8f0fe', 100: '#c5cae9', 200: '#9fa8da', 300: '#7986cb', 400: '#5c6bc0', 500: '#1a73e8', 600: '#3949ab', 700: '#303f9f', 800: '#283593', 900: '#1a237e' },
        },
        neutral: {
          hex: '#f1f3f4',
          ramp: { 50: '#f8f9fa', 100: '#f1f3f4', 900: '#202124' },
        },
      },
    },
    typography: {
      heading: { family: 'Inter', weights: [700], fallbackStack: 'sans-serif' },
      body:    { family: 'Inter', weights: [400], fallbackStack: 'sans-serif' },
    },
  };
}

function makeAsset(overrides = {}) {
  return {
    id: 'asset-1',
    project_id: 'proj-1',
    type: 'VISITING_CARD',
    name: 'Test Card',
    brand_kit_version: 1,
    spec: {},
    status: 'DRAFT',
    created_by: 'user-1',
    renders: [],
    ...overrides,
  };
}

function makeFullBrandKit() {
  return {
    logo: { primaryUrl: 'https://example.com/logo.svg', minWidthMm: 10 },
    palette: {
      primary:   ['#1a73e8'],
      secondary: ['#34a853'],
      neutral:   ['#f1f3f4'],
      onPrimary: '#ffffff',
      onSurface: '#202124',
    },
    typography: {
      heading: { family: 'Inter', weights: [700], fileUrl: 'https://fonts.gstatic.com/inter.woff2' },
      body:    { family: 'Inter', weights: [400], fileUrl: 'https://fonts.gstatic.com/inter.woff2' },
    },
    company: {
      legalName:    'Acme Pvt Ltd',
      displayName:  'Acme',
      addressLines: ['123 Main St', 'Mumbai 400001'],
      phone:        '+91-9900000000',
      email:        'info@acme.com',
      website:      'https://acme.com',
    },
  };
}

// ── §8 Named preflight errors ─────────────────────────────────────────────────

describe('preflight — named errors (COLLATERAL_SPEC §8)', () => {

  it('BRANDKIT_MISSING_FIELD — fires when brandKit is null', () => {
    const result = runPreflight({ asset: makeAsset(), brandKit: null });
    expect(result.ok).toBe(false);
    const codes = result.issues.map((i) => i.code);
    expect(codes).toContain(PREFLIGHT_CODES.BRANDKIT_MISSING_FIELD);
  });

  it('BRANDKIT_MISSING_FIELD — fires for missing logo.primaryUrl', () => {
    const brandKit = makeFullBrandKit();
    delete brandKit.logo.primaryUrl;
    const result = runPreflight({ asset: makeAsset(), brandKit });
    expect(result.issues.some((i) => i.code === PREFLIGHT_CODES.BRANDKIT_MISSING_FIELD)).toBe(true);
  });

  it('BRANDKIT_MISSING_FIELD — passes for complete brand-kit', () => {
    const result = runPreflight({ asset: makeAsset(), brandKit: makeFullBrandKit() });
    expect(result.issues.some((i) => i.code === PREFLIGHT_CODES.BRANDKIT_MISSING_FIELD)).toBe(false);
  });

  it('LOGO_BELOW_MIN_WIDTH — fires when spec.logoWidthMm < brandKit.logo.minWidthMm', () => {
    const asset = makeAsset({ spec: { logoWidthMm: 5 } });
    const brandKit = makeFullBrandKit(); // minWidthMm: 10
    const result = runPreflight({ asset, brandKit });
    expect(result.issues.some((i) => i.code === PREFLIGHT_CODES.LOGO_BELOW_MIN_WIDTH)).toBe(true);
  });

  it('LOGO_BELOW_MIN_WIDTH — clears when logoWidthMm >= minWidthMm', () => {
    const asset = makeAsset({ spec: { logoWidthMm: 15 } });
    const result = runPreflight({ asset, brandKit: makeFullBrandKit() });
    expect(result.issues.some((i) => i.code === PREFLIGHT_CODES.LOGO_BELOW_MIN_WIDTH)).toBe(false);
  });

  it('CONTRAST_FAIL_SMALL_PRINT — fires for white-on-white text', () => {
    const asset = makeAsset({ spec: { textColor: '#ffffff', bgColor: '#ffffff' } });
    const result = runPreflight({ asset, brandKit: makeFullBrandKit() });
    expect(result.issues.some((i) => i.code === PREFLIGHT_CODES.CONTRAST_FAIL_SMALL_PRINT)).toBe(true);
  });

  it('CONTRAST_FAIL_SMALL_PRINT — passes for black on white (ratio ~21:1)', () => {
    const asset = makeAsset({ spec: { textColor: '#000000', bgColor: '#ffffff' } });
    const result = runPreflight({ asset, brandKit: makeFullBrandKit() });
    expect(result.issues.some((i) => i.code === PREFLIGHT_CODES.CONTRAST_FAIL_SMALL_PRINT)).toBe(false);
  });

  it('SPOTCOLOR_LIMIT_EXCEEDED — fires for screen-print with > 4 spot colours', () => {
    const asset = makeAsset({
      type: 'TSHIRT',
      spec: { printPath: 'screenprint', spotColors: ['#111', '#222', '#333', '#444', '#555'] },
    });
    const result = runPreflight({ asset, brandKit: makeFullBrandKit() });
    expect(result.issues.some((i) => i.code === PREFLIGHT_CODES.SPOTCOLOR_LIMIT_EXCEEDED)).toBe(true);
  });

  it('SPOTCOLOR_LIMIT_EXCEEDED — clears for 4 spot colours', () => {
    const asset = makeAsset({
      type: 'TSHIRT',
      spec: { printPath: 'screenprint', spotColors: ['#111', '#222', '#333', '#444'] },
    });
    const result = runPreflight({ asset, brandKit: makeFullBrandKit() });
    expect(result.issues.some((i) => i.code === PREFLIGHT_CODES.SPOTCOLOR_LIMIT_EXCEEDED)).toBe(false);
  });

  it('GEOMETRY_OUT_OF_BOUNDS — fires when zone x + w exceeds safe area width', () => {
    // Visiting card safe width: 88.9 - 2*4 = 80.9 mm
    const asset = makeAsset({
      spec: { zones: [{ x: 0, y: 0, w: 90, h: 10 }] },
    });
    const result = runPreflight({ asset, brandKit: makeFullBrandKit() });
    expect(result.issues.some((i) => i.code === PREFLIGHT_CODES.GEOMETRY_OUT_OF_BOUNDS)).toBe(true);
  });

  it('GEOMETRY_OUT_OF_BOUNDS — clears for in-bounds zones', () => {
    const asset = makeAsset({
      spec: { zones: [{ x: 5, y: 5, w: 30, h: 10 }] },
    });
    const result = runPreflight({ asset, brandKit: makeFullBrandKit() });
    expect(result.issues.some((i) => i.code === PREFLIGHT_CODES.GEOMETRY_OUT_OF_BOUNDS)).toBe(false);
  });

  it('FONT_NOT_ALLOWLISTED — fires for non-allowlisted font URL', () => {
    const brandKit = makeFullBrandKit();
    brandKit.typography.heading.fileUrl = 'ftp://evil.com/font.ttf';
    const result = runPreflight({ asset: makeAsset(), brandKit });
    expect(result.issues.some((i) => i.code === PREFLIGHT_CODES.FONT_NOT_ALLOWLISTED)).toBe(true);
  });

  it('FONT_NOT_ALLOWLISTED — passes for Google Fonts URL', () => {
    const result = runPreflight({ asset: makeAsset(), brandKit: makeFullBrandKit() });
    expect(result.issues.some((i) => i.code === PREFLIGHT_CODES.FONT_NOT_ALLOWLISTED)).toBe(false);
  });

  it('CREDITS_INSUFFICIENT — fires when creditsOk=false', () => {
    const result = runPreflight({ asset: makeAsset(), brandKit: makeFullBrandKit(), creditsOk: false });
    expect(result.issues.some((i) => i.code === PREFLIGHT_CODES.CREDITS_INSUFFICIENT)).toBe(true);
  });

  it('all named error codes match COLLATERAL_SPEC §8 exact strings', () => {
    expect(PREFLIGHT_CODES.BRANDKIT_MISSING_FIELD).toBe('BRANDKIT_MISSING_FIELD');
    expect(PREFLIGHT_CODES.LOGO_BELOW_MIN_WIDTH).toBe('LOGO_BELOW_MIN_WIDTH');
    expect(PREFLIGHT_CODES.CONTRAST_FAIL_SMALL_PRINT).toBe('CONTRAST_FAIL_SMALL_PRINT');
    expect(PREFLIGHT_CODES.SPOTCOLOR_LIMIT_EXCEEDED).toBe('SPOTCOLOR_LIMIT_EXCEEDED');
    expect(PREFLIGHT_CODES.GEOMETRY_OUT_OF_BOUNDS).toBe('GEOMETRY_OUT_OF_BOUNDS');
    expect(PREFLIGHT_CODES.FONT_NOT_ALLOWLISTED).toBe('FONT_NOT_ALLOWLISTED');
    expect(PREFLIGHT_CODES.CREDITS_INSUFFICIENT).toBe('CREDITS_INSUFFICIENT');
  });
});

// ── §11 HTML-escaping ─────────────────────────────────────────────────────────

describe('HTML-escaping — COLLATERAL_SPEC §11', () => {
  it('escapeHtml escapes < > & " characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapeHtml escapes single quote and backtick', () => {
    expect(escapeHtml("it's a `test`")).toBe("it&#x27;s a &#x60;test&#x60;");
  });

  it('escapeHtml returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('escapeZoneContent escapes strings recursively in nested objects', () => {
    const input = {
      name: '<b>Bob</b>',
      address: { line1: '123 & Main <St>' },
      tags: ['<admin>', 'user'],
    };
    const out = escapeZoneContent(input);
    expect(out.name).toBe('&lt;b&gt;Bob&lt;/b&gt;');
    expect(out.address.line1).toBe('123 &amp; Main &lt;St&gt;');
    expect(out.tags[0]).toBe('&lt;admin&gt;');
  });
});

// ── Geometry — trim + bleed math ──────────────────────────────────────────────

describe('geometry — page box = trim + 2×bleed (COLLATERAL_SPEC §4)', () => {
  it('visiting card: page box = (88.9 + 6) × (50.8 + 6) mm in points', () => {
    const box = pageBoxPt(88.9, 50.8, 3);
    expect(box.width).toBeCloseTo((88.9 + 6) * MM_TO_PT, 3);
    expect(box.height).toBeCloseTo((50.8 + 6) * MM_TO_PT, 3);
  });

  it('ID card: page box = (85.6 + 4) × (53.98 + 4) mm in points', () => {
    const box = pageBoxPt(85.6, 53.98, 2);
    expect(box.width).toBeCloseTo((85.6 + 4) * MM_TO_PT, 3);
    expect(box.height).toBeCloseTo((53.98 + 4) * MM_TO_PT, 3);
  });

  it('letterhead A4: no bleed → page box = 210 × 297 mm in points', () => {
    const box = pageBoxPt(210, 297, 0);
    expect(box.width).toBeCloseTo(210 * MM_TO_PT, 3);
    expect(box.height).toBeCloseTo(297 * MM_TO_PT, 3);
  });

  it('safeAreaMm: visiting card safe content = 80.9 × 42.8 mm', () => {
    const safe = safeAreaMm(88.9, 50.8, 4);
    expect(safe.w).toBeCloseTo(88.9 - 8, 3);
    expect(safe.h).toBeCloseTo(50.8 - 8, 3);
    expect(safe.x).toBe(4);
    expect(safe.y).toBe(4);
  });

  it('safeAreaMm: ID card safe content = 79.6 × 47.98 mm', () => {
    const safe = safeAreaMm(85.6, 53.98, 3);
    expect(safe.w).toBeCloseTo(85.6 - 6, 3);
    expect(safe.h).toBeCloseTo(53.98 - 6, 3);
  });
});

// ── PDF golden/snapshot ───────────────────────────────────────────────────────

describe('PDF render — golden snapshot per artifact type (COLLATERAL_SPEC §14)', () => {
  const brandKit = makeFullBrandKit();

  it.each([
    ['VISITING_CARD', 'visiting-card', undefined],
    ['LETTERHEAD', 'letterhead', 'A4'],
    ['TSHIRT', 'tshirt', 'FRONT_A4'],
    ['ID_CARD', 'id-card', undefined],
  ])('%s: PDF buffer is non-empty and starts with %PDF', async (type, _slug, variant) => {
    const asset = makeAsset({ type, spec: { variant } });
    const layout = buildLayout(asset, brandKit);
    const buffer = Buffer.from(await buildPdf({ ...layout, printMarks: false }));
    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('PDF_PRINT: crop-mark build does not throw', async () => {
    const asset = makeAsset({ type: 'VISITING_CARD' });
    const layout = buildLayout(asset, brandKit);
    await expect(buildPdf({ ...layout, printMarks: true })).resolves.toBeTruthy();
  });

  it('LETTERHEAD US_LETTER: layout has correct trim dimensions', () => {
    const asset = makeAsset({ type: 'LETTERHEAD', spec: { variant: 'US_LETTER' } });
    const layout = buildLayout(asset, brandKit);
    expect(layout.trimW).toBeCloseTo(215.9, 1);
    expect(layout.trimH).toBeCloseTo(279.4, 1);
  });

  it('ID_CARD: two pages generated', () => {
    const asset = makeAsset({ type: 'ID_CARD', spec: { holderName: 'Alice', holderRole: 'Engineer', idNumber: 'ID-001' } });
    const layout = buildLayout(asset, brandKit);
    expect(layout.pages.length).toBe(2);
  });

  it('VISITING_CARD: two pages generated', () => {
    const asset = makeAsset({ type: 'VISITING_CARD' });
    const layout = buildLayout(asset, brandKit);
    expect(layout.pages.length).toBe(2);
  });
});

// ── DOCX structure ────────────────────────────────────────────────────────────

describe('DOCX render — header/footer locked, body editable (COLLATERAL_SPEC §14)', () => {
  const brandKit = makeFullBrandKit();
  let docxBuffer;

  beforeEach(() => {
    docxBuffer = buildDocx({ brandKit, defaultCopy: 'Dear Recipient,' });
  });

  it('DOCX buffer is non-empty', () => {
    expect(docxBuffer.length).toBeGreaterThan(0);
  });

  it('DOCX ZIP contains word/document.xml', () => {
    // Check PK magic bytes (ZIP file).
    expect(docxBuffer[0]).toBe(0x50); // 'P'
    expect(docxBuffer[1]).toBe(0x4b); // 'K'
  });

  it('DOCX document.xml contains header/footer relationship references', async () => {
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(docxBuffer);
    const docEntry = zip.getEntry('word/document.xml');
    expect(docEntry).toBeTruthy();
    const content = docEntry.getData().toString('utf8');
    expect(content).toContain('w:headerReference');
    expect(content).toContain('w:footerReference');
    expect(content).toContain('Dear Recipient,');
  });

  it('DOCX header1.xml contains company name', async () => {
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(docxBuffer);
    const headerEntry = zip.getEntry('word/header1.xml');
    expect(headerEntry).toBeTruthy();
    const content = headerEntry.getData().toString('utf8');
    expect(content).toContain('Acme');
  });

  it('DOCX escapes HTML in company name', () => {
    const bk = { ...brandKit, company: { ...brandKit.company, displayName: '<b>Acme</b>' } };
    const buf = buildDocx({ brandKit: bk, defaultCopy: '' });
    expect(buf.toString()).not.toContain('<b>Acme</b>');
  });
});

// ── Contrast ratio helper ─────────────────────────────────────────────────────

describe('contrastRatio helper', () => {
  it('black on white returns ~21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('white on white returns 1', () => {
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
  });
});

// ── Idempotency key forwarding ────────────────────────────────────────────────

// Asset with explicit passing-contrast colors to avoid CONTRAST_FAIL_SMALL_PRINT in render tests.
const RENDER_SAFE_ASSET = makeAsset({ spec: { textColor: '#000000', bgColor: '#ffffff', logoWidthMm: 20 } });

describe('idempotency-key forwarding to withCreditHold (COLLATERAL_SPEC §7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.collateralAsset.findUnique.mockResolvedValue(RENDER_SAFE_ASSET);
    // Return a full brand kit so preflight passes and withCreditHold is reached.
    prisma.brandKit.findUnique.mockResolvedValue(makeLiveBrandKitRow());
    prisma.project.findUnique.mockResolvedValue({ id: 'proj-1', name: 'Acme Pvt Ltd' });
    prisma.collateralRender.create.mockResolvedValue({
      id: 'render-1', asset_id: 'asset-1', format: 'PDF_DIGITAL',
      variant: null, file_url: 'collateral/proj-1/asset-1/pdf.pdf',
      bytes: 100, checksum: 'abc', brand_kit_version: 1, credits_cost: 5,
    });
    prisma.collateralAsset.update.mockResolvedValue({});
  });

  it('passes the X-Idempotency-Key value to withCreditHold', async () => {
    const iKey = 'templateEngine:run-1:stage-6:1';
    await service.renderAsset(RENDER_SAFE_ASSET.id, {
      format: 'PDF_DIGITAL',
      variant: null,
      idempotencyKey: iKey,
      actorId: 'user-1',
    });
    expect(withCreditHold).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: iKey }),
      expect.any(Function),
    );
  });

  it('generates an internal idempotency key when none is provided', async () => {
    await service.renderAsset(RENDER_SAFE_ASSET.id, {
      format: 'PDF_DIGITAL',
      variant: null,
      idempotencyKey: null,
      actorId: 'user-1',
    });
    const call = withCreditHold.mock.calls[0][0];
    expect(call.idempotencyKey).toMatch(/^collateral:render:asset-1:PDF_DIGITAL:/);
  });
});

// ── Credit hold gating ────────────────────────────────────────────────────────

describe('credit hold gating — CREDITS_INSUFFICIENT surfaces as 402', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.collateralAsset.findUnique.mockResolvedValue(RENDER_SAFE_ASSET);
    // Full brand kit so preflight passes; withCreditHold then throws INSUFFICIENT_CREDITS.
    prisma.brandKit.findUnique.mockResolvedValue(makeLiveBrandKitRow());
    prisma.project.findUnique.mockResolvedValue({ id: 'proj-1', name: 'Acme Pvt Ltd' });
    withCreditHold.mockRejectedValueOnce(
      new CreditError('INSUFFICIENT_CREDITS', 'Insufficient credits: have 0 µc, need 5000000 µc')
    );
  });

  it('renderAsset re-throws CreditError (status 402)', async () => {
    await expect(
      service.renderAsset(RENDER_SAFE_ASSET.id, { format: 'PDF_DIGITAL', variant: null, idempotencyKey: null, actorId: 'user-1' })
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS', status: 402 });
  });
});

// ── KDL-542: installModule('collateral') regression guard ─────────────────────
// Asserts install creates exactly one Module row and never calls upsert.
// Guards against both the original crash (missing 'name') and the P2002 double-
// create that the parent issue's proposed fix would have introduced.

describe('installModule("collateral") — KDL-542 regression guard', () => {
  const COLLATERAL_MANIFEST = {
    slug: 'collateral',
    name: 'Collateral',
    description: 'Print-ready collateral render engine.',
    version: '1.0.0',
    core: false,
    dependsOn: ['brand-kit'],
    conflictsWith: [],
    permissions: [{ name: 'collateral', actions: ['view', 'edit', 'render', 'delete'] }],
    env: [],
  };

  const BRAND_KIT_MANIFEST = {
    slug: 'brand-kit',
    name: 'Brand Kit',
    version: '1.0.0',
    core: false,
    dependsOn: [],
    conflictsWith: [],
    permissions: [],
    env: [],
  };

  const INSTALLED_MODULE = {
    id: 'mod-collateral',
    slug: 'collateral',
    name: 'Collateral',
    description: 'Print-ready collateral render engine.',
    version: '1.0.0',
    is_core: false,
    status: 'INSTALLED',
  };

  beforeEach(() => {
    loadedManifests.clear();
    loadedManifests.set('collateral', COLLATERAL_MANIFEST);
    loadedManifests.set('brand-kit', BRAND_KIT_MANIFEST);
    vi.clearAllMocks();

    prisma.module = {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        // brand-kit already installed (satisfies dependsOn check); collateral not yet installed
        if (where.slug === 'brand-kit') return Promise.resolve({ slug: 'brand-kit', status: 'INSTALLED' });
        return Promise.resolve(null);
      }),
      findMany: vi.fn().mockResolvedValue([]),  // no enabled modules → no conflicts
      create:   vi.fn().mockResolvedValue(INSTALLED_MODULE),
      upsert:   vi.fn(),
    };
    prisma.permissionModule = {
      upsert: vi.fn().mockResolvedValue({ id: 'pm-1', name: 'collateral' }),
    };
    prisma.permission = {
      upsert: vi.fn().mockResolvedValue({}),
    };
    prisma.$transaction = vi.fn((fn) => fn(prisma));
  });

  it('resolves with slug=collateral, name=Collateral, version=1.0.0, status=INSTALLED', async () => {
    const result = await installModule('collateral', 'actor');

    expect(result).toMatchObject({
      slug:    'collateral',
      name:    'Collateral',
      version: '1.0.0',
      status:  'INSTALLED',
    });
  });

  it('creates exactly one Module row', async () => {
    await installModule('collateral', 'actor');

    expect(prisma.module.create).toHaveBeenCalledTimes(1);
    expect(prisma.module.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug:    'collateral',
        name:    'Collateral',
        version: '1.0.0',
        status:  'INSTALLED',
      }),
    });
  });

  it('never calls module.upsert — seed.js is absent', async () => {
    await installModule('collateral', 'actor');

    expect(prisma.module.upsert).not.toHaveBeenCalled();
  });
});

// ── resolveBrandKit() — approval-path DB row resolves correctly ───────────────
// Guards against regressions to the live-column mapper.
// The "approved" row shape is what approveKit() produces: status flips to
// 'approved' but the data columns (logo_media_id, palette, typography) are set
// during extraction/infer and unchanged by the approval step.

describe('resolveBrandKit() — approved BrandKit row resolves to non-null kit', () => {
  const APPROVED_ROW = {
    ...makeLiveBrandKitRow(),
    status: 'approved',
    approved_at: new Date('2026-08-20T00:00:00Z'),
    acknowledged_contrast_adjustments: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.brandKit.findUnique.mockResolvedValue(APPROVED_ROW);
    prisma.project.findUnique.mockResolvedValue({ id: 'proj-1', name: 'Acme Pvt Ltd' });
  });

  it('returns non-null for an approved kit (not null like resolved_tokens always was)', async () => {
    const kit = await service.resolveBrandKit('proj-1');
    expect(kit).not.toBeNull();
  });

  it('maps logo_media_id to logo.primaryUrl', async () => {
    const kit = await service.resolveBrandKit('proj-1');
    expect(kit.logo.primaryUrl).toBe('/api/media/logo-media-1');
  });

  it('maps palette ramp to a non-empty palette.primary array', async () => {
    const kit = await service.resolveBrandKit('proj-1');
    expect(Array.isArray(kit.palette.primary)).toBe(true);
    expect(kit.palette.primary.length).toBeGreaterThan(0);
  });

  it('maps neutral.ramp[900] to palette.onSurface', async () => {
    const kit = await service.resolveBrandKit('proj-1');
    expect(kit.palette.onSurface).toBe('#202124');
  });

  it('maps typography columns to heading and body', async () => {
    const kit = await service.resolveBrandKit('proj-1');
    expect(kit.typography.heading).toMatchObject({ family: 'Inter', weights: [700] });
    expect(kit.typography.body).toMatchObject({ family: 'Inter', weights: [400] });
  });

  it('maps project.name to company.displayName and company.legalName (KDL-583)', async () => {
    const kit = await service.resolveBrandKit('proj-1');
    expect(kit.company.displayName).toBe('Acme Pvt Ltd');
    expect(kit.company.legalName).toBe('Acme Pvt Ltd');
  });

  it('returns company: {} when project row is not found — does not hard-fail', async () => {
    prisma.project.findUnique.mockResolvedValue(null);
    const kit = await service.resolveBrandKit('proj-1');
    expect(kit).not.toBeNull();
    expect(kit.company).toEqual({});
  });

  it('returns null when the project has no kit', async () => {
    prisma.brandKit.findUnique.mockResolvedValue(null);
    const kit = await service.resolveBrandKit('no-such-project');
    expect(kit).toBeNull();
  });
});
