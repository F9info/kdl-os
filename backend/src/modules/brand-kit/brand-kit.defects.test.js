// Regression tests for KDL-512 blocking defects.
//
// Coverage contract from the issue:
//   T1 — uploadLogo calls prisma.media.update with owner_module (catches B1 if field missing)
//   T2 — JPEG extraction produces a sane palette (catches B3 channel misalignment)
//   T3 — PATCH {"status":"approved"} is ignored / kit stays inferred (catches B2)
//   T4 — GET tokens payload validates against theme-engine postValuesBodySchema (catches S7)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PassThrough } from 'node:stream';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../media/service.js', () => ({ uploadMedia: vi.fn() }));
vi.mock('../media/settings.js', () => ({
  getUploadSettings: vi.fn().mockResolvedValue({ requireScan: false }),
}));
vi.mock('../media/media.queue.js', () => ({ enqueueScanJob: vi.fn() }));
vi.mock('../../shared/services/storage.service.js', () => ({
  uploadFile: vi.fn().mockResolvedValue('mock-url'),
  getFileStream: vi.fn(),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../config/database.js';
import * as storageService from '../../shared/services/storage.service.js';
import { uploadMedia } from '../media/service.js';
import { uploadLogo, extractPaletteForKit, patchKit, getTokens } from './service.js';
import { postValuesBodySchema } from '../theme-engine/schema.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeKit = (overrides = {}) => ({
  id: 'kit-1',
  project_id: 'proj-1',
  status: 'draft',
  logo_media_id: null,
  logo_raster_media_id: null,
  logo_original_path: null,
  logo_original_expires_at: null,
  palette: null,
  contrast_report: null,
  typography: null,
  tone: null,
  inference_source: null,
  fallback_reason: null,
  overridden_fields: [],
  acknowledged_contrast_adjustments: false,
  guidelines_pdf_media_id: null,
  schema_version: 1,
  approved_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const GREEN_PALETTE = {
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

// ─── T1: uploadLogo calls prisma.media.update({ data: { owner_module } }) ────
// If the Media model lacked owner_module, Prisma would throw before the update.
// This test asserts the call is made with the correct field so a schema gap
// surfaces as a test failure rather than a silent 500 in production.

describe('T1 — uploadLogo tags media with owner_module (B1 guard)', () => {
  beforeEach(() => {
    prisma.brandKit = {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockImplementation(async ({ create }) => makeKit(create)),
    };
    prisma.media = {
      update: vi.fn().mockResolvedValue({}),
    };
    uploadMedia.mockResolvedValue({ id: 'media-1' });
  });

  it('calls prisma.media.update with owner_module: "brand-kit" after upload', async () => {
    const { default: sharp } = await import('sharp');
    // Build a 200×200 JPEG buffer so dimension checks pass
    const jpegBuf = await sharp({
      create: { width: 200, height: 200, channels: 3, background: { r: 14, g: 110, b: 92 } },
    }).jpeg().toBuffer();

    const file = {
      buffer: jpegBuf,
      size: jpegBuf.length,
      mimetype: 'image/jpeg',
      originalname: 'logo.jpg',
    };

    await uploadLogo('proj-1', file, 'user-1');

    expect(prisma.media.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ owner_module: 'brand-kit' }),
      }),
    );
  });
});

// ─── T2: JPEG/WebP extraction produces a sane palette (B3 guard) ─────────────
// sharp without ensureAlpha() returns a 3-byte RGB buffer for JPEG/WebP;
// the pixel loop in palette.js uses a 4-byte RGBA stride and reads garbage.
// After the fix (.ensureAlpha() before .raw()), all ramp entries must be
// valid hex strings — not NaN-derived garbage.

describe('T2 — JPEG extraction produces sane RGBA palette (B3 guard)', () => {
  it('extractPaletteForKit returns valid hex ramp values for a JPEG source', async () => {
    const { default: sharp } = await import('sharp');

    // Create a 200×200 JPEG with a white border and a green interior.
    // The extractor detects the dominant border colour as background and includes
    // the green interior pixels as foreground — so we get a real primary entry.
    const W = 200, H = 200, BORDER = 10;
    const rawBuf = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const base = (y * W + x) * 4;
        const isBorder = x < BORDER || x >= W - BORDER || y < BORDER || y >= H - BORDER;
        if (isBorder) {
          rawBuf[base] = 255; rawBuf[base + 1] = 255; rawBuf[base + 2] = 255; rawBuf[base + 3] = 255;
        } else {
          rawBuf[base] = 14; rawBuf[base + 1] = 110; rawBuf[base + 2] = 92; rawBuf[base + 3] = 255;
        }
      }
    }
    const jpegBuf = await sharp(rawBuf, { raw: { width: W, height: H, channels: 4 } })
      .jpeg()
      .toBuffer();

    const readable = new PassThrough();
    readable.end(jpegBuf);

    storageService.getFileStream.mockResolvedValueOnce(readable);

    prisma.brandKit = {
      findUnique: vi.fn().mockResolvedValue(makeKit({
        status: 'draft',
        logo_media_id: 'media-1',
        logo_raster_media_id: 'media-1',
      })),
      update: vi.fn().mockImplementation(async ({ data }) =>
        makeKit({ status: 'extracted', ...data })),
    };
    prisma.media = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'media-1',
        path: 'brand-kit/logos/proj-1/logo.jpg',
        scan_result: 'CLEAN',
      }),
    };

    const result = await extractPaletteForKit('proj-1');
    expect(result.palette).toBeDefined();
    expect(result.palette.colors).toBeDefined();

    // All ramp values for discovered roles must be valid CSS hex — #rrggbb
    const hexPattern = /^#[0-9a-f]{6}$/i;
    const allRamps = Object.values(result.palette.colors)
      .filter(Boolean)
      .flatMap((role) => Object.values(role.ramp ?? {}));
    // At least the primary role must have ramp entries (white border → green interior)
    expect(allRamps.length).toBeGreaterThan(0);
    for (const hex of allRamps) {
      expect(hex).toMatch(hexPattern);
    }
  });
});

// ─── T3: PATCH {"status":"approved"} is ignored (B2 guard) ───────────────────
// The schema only allows typography/tone/palette — status and other fields must
// not reach the Prisma update even if the Zod schema were ever loosened.
// The controller now reads req.validated.body, and patchKit whitelists fields.

describe('T3 — patchKit never writes status or other non-patchable fields (B2 guard)', () => {
  beforeEach(() => {
    prisma.brandKit = {
      findUnique: vi.fn().mockResolvedValue(makeKit({ status: 'inferred', overridden_fields: [] })),
      update: vi.fn().mockImplementation(async ({ data }) => makeKit(data)),
    };
  });

  it('does not write status to Prisma even when status is in the overrides payload', async () => {
    // Simulate the raw payload that would arrive if a hostile client bypassed Zod
    await patchKit('proj-1', { status: 'approved', typography: { heading: { family: 'Roboto' } } });

    const callArg = prisma.brandKit.update.mock.calls[0][0];
    expect(callArg.data).not.toHaveProperty('status');
    // typography should be written; status must not be
    expect(callArg.data).toHaveProperty('typography');
  });

  it('does not write contrast_report, approved_at, or project_id', async () => {
    await patchKit('proj-1', {
      contrast_report: { forged: true },
      approved_at: new Date().toISOString(),
      project_id: 'other-project',
      palette: { colors: {} },
    });

    const callArg = prisma.brandKit.update.mock.calls[0][0];
    expect(callArg.data).not.toHaveProperty('contrast_report');
    expect(callArg.data).not.toHaveProperty('approved_at');
    expect(callArg.data).not.toHaveProperty('project_id');
    expect(callArg.data).toHaveProperty('palette');
  });
});

// ─── T4: tokens payload validates against theme-engine postValuesBodySchema ──
// If field_id (UUID) were used instead of slug, or type_id were a plain string,
// the schema would still pass (it accepts any string) — but the value entries
// must carry either field_id or slug per the schema's refine. This test asserts
// our payload satisfies that requirement.

describe('T4 — GET tokens payload validates against theme-engine postValuesBodySchema (S7 guard)', () => {
  const FAKE_TYPE_ID = 'type-uuid-abcdef';

  beforeEach(() => {
    prisma.brandKit = {
      findUnique: vi.fn().mockResolvedValue(makeKit({
        status: 'approved',
        palette: GREEN_PALETTE,
        contrast_report: { adjustments: [] },
      })),
    };
    prisma.type = {
      findFirst: vi.fn().mockResolvedValue({ id: FAKE_TYPE_ID }),
    };
  });

  it('returns a payload that satisfies postValuesBodySchema', async () => {
    const payload = await getTokens('proj-1', 'webapp');

    // Wrap as the schema expects { body: { platform, type_id, values } }
    const parseResult = postValuesBodySchema.safeParse({ body: payload });
    if (!parseResult.success) {
      // Surface the actual validation errors for diagnosis
      throw new Error(
        'tokens payload failed theme-engine schema: ' +
        JSON.stringify(parseResult.error.flatten(), null, 2),
      );
    }
    expect(parseResult.success).toBe(true);
  });

  it('uses slug (not field_id) in value entries', async () => {
    const payload = await getTokens('proj-1', 'webapp');
    for (const entry of payload.values) {
      expect(entry).toHaveProperty('slug');
      expect(entry).not.toHaveProperty('field_id');
    }
  });

  it('uses the resolved type UUID, not the literal string "brand-kit"', async () => {
    const payload = await getTokens('proj-1', 'webapp');
    expect(payload.type_id).toBe(FAKE_TYPE_ID);
    expect(payload.type_id).not.toBe('brand-kit');
  });

  it('throws TYPE_NOT_SEEDED when the brand-kit Type does not exist in DB', async () => {
    prisma.type.findFirst.mockResolvedValueOnce(null);
    await expect(getTokens('proj-1', 'webapp')).rejects.toMatchObject({
      code: 'TYPE_NOT_SEEDED',
    });
  });

  it('deduplicates text entries when a colour fails AA on both surfaces', async () => {
    // Two adjustments for the same role-text token (light + dark both fail)
    prisma.brandKit.findUnique.mockResolvedValue(makeKit({
      status: 'approved',
      palette: GREEN_PALETTE,
      contrast_report: {
        adjustments: [
          { id: 'primary-on-light', tokenName: 'primary-text', derived: '#000000' },
          { id: 'primary-on-dark', tokenName: 'primary-text', derived: '#ffffff' },
        ],
      },
    }));

    const payload = await getTokens('proj-1', 'webapp');
    const textEntries = payload.values.filter((v) => v.slug === 'brand-kit-primary-text');
    // Must be exactly one entry — the last adj wins (deduped via Map)
    expect(textEntries).toHaveLength(1);
    expect(textEntries[0].value).toBe('#ffffff');
  });
});
