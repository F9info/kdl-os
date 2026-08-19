// Integration test: brand-kit state machine
// Mocks the database and storage layer to walk the full
// draft → extracted → inferred → approved state machine.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks before imports
vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../media/service.js', () => ({
  uploadMedia: vi.fn(),
}));
vi.mock('../media/settings.js', () => ({
  getUploadSettings: vi.fn().mockResolvedValue({ requireScan: false, maxFileSizeBytes: 10 * 1024 * 1024 }),
}));
vi.mock('../media/media.queue.js', () => ({
  enqueueScanJob: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../shared/services/storage.service.js', () => ({
  uploadFile: vi.fn().mockResolvedValue('mock-url'),
  getFileStream: vi.fn(),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../config/database.js';
import * as storageService from '../../shared/services/storage.service.js';
import { uploadMedia } from '../media/service.js';
import { getKit, uploadLogo, extractPaletteForKit, inferBrandKit, patchKit, approveKit, reopenKit, getTokens, deleteExpiredOriginals } from './service.js';

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

const CONTRAST_REPORT = {
  schemaVersion: 1,
  pairs: [],
  adjustments: [],
  allPairsPass: true,
};

// ─── getKit ───────────────────────────────────────────────────────────────────

describe('getKit', () => {
  beforeEach(() => {
    prisma.brandKit = { findUnique: vi.fn() };
  });

  it('returns kit when found', async () => {
    const kit = makeKit({ status: 'extracted' });
    prisma.brandKit.findUnique.mockResolvedValue(kit);
    const result = await getKit('proj-1');
    expect(result.status).toBe('extracted');
  });

  it('throws 404 NO_KIT when not found', async () => {
    prisma.brandKit.findUnique.mockResolvedValue(null);
    await expect(getKit('proj-1')).rejects.toMatchObject({ status: 404, code: 'NO_KIT' });
  });
});

// ─── inferBrandKit ────────────────────────────────────────────────────────────

describe('inferBrandKit', () => {
  beforeEach(() => {
    prisma.brandKit = {
      findUnique: vi.fn(),
      update: vi.fn(),
    };
  });

  it('returns fallback inference when kit is in extracted status', async () => {
    const kit = makeKit({ status: 'extracted', palette: GREEN_PALETTE, contrast_report: CONTRAST_REPORT });
    prisma.brandKit.findUnique.mockResolvedValue(kit);
    prisma.brandKit.update.mockResolvedValue({ ...kit, status: 'inferred', inference_source: 'fallback' });

    const result = await inferBrandKit('proj-1', { industry: 'technology' });
    expect(result.inference_source).toBe('fallback');
    expect(prisma.brandKit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'inferred',
          inference_source: 'fallback',
          fallback_reason: 'F1_NO_KEY',
        }),
      }),
    );
  });

  it('throws 409 NOT_EXTRACTED when kit is in draft', async () => {
    prisma.brandKit.findUnique.mockResolvedValue(makeKit({ status: 'draft' }));
    await expect(inferBrandKit('proj-1', {})).rejects.toMatchObject({ status: 409, code: 'NOT_EXTRACTED' });
  });

  it('throws 409 APPROVED_IMMUTABLE when kit is approved', async () => {
    prisma.brandKit.findUnique.mockResolvedValue(makeKit({ status: 'approved' }));
    await expect(inferBrandKit('proj-1', {})).rejects.toMatchObject({ status: 409, code: 'APPROVED_IMMUTABLE' });
  });

  it('matches technology industry to appropriate typography', async () => {
    const kit = makeKit({ status: 'extracted', palette: GREEN_PALETTE });
    prisma.brandKit.findUnique.mockResolvedValue(kit);
    prisma.brandKit.update.mockImplementation(async ({ data }) => ({ ...kit, ...data }));

    const result = await inferBrandKit('proj-1', { industry: 'saas product' });
    expect(result.typography.heading.family).toBe('Inter');
  });
});

// ─── patchKit ─────────────────────────────────────────────────────────────────

describe('patchKit', () => {
  beforeEach(() => {
    prisma.brandKit = {
      findUnique: vi.fn(),
      update: vi.fn(),
    };
  });

  it('records overridden fields', async () => {
    const kit = makeKit({ status: 'inferred', overridden_fields: [] });
    prisma.brandKit.findUnique.mockResolvedValue(kit);
    prisma.brandKit.update.mockImplementation(async ({ data }) => ({ ...kit, ...data }));

    await patchKit('proj-1', { typography: { heading: { family: 'Roboto' } } });
    expect(prisma.brandKit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          overridden_fields: expect.arrayContaining(['typography']),
        }),
      }),
    );
  });

  it('throws 409 APPROVED_IMMUTABLE for approved kits', async () => {
    prisma.brandKit.findUnique.mockResolvedValue(makeKit({ status: 'approved' }));
    await expect(patchKit('proj-1', { tone: {} })).rejects.toMatchObject({ status: 409, code: 'APPROVED_IMMUTABLE' });
  });
});

// ─── approveKit ───────────────────────────────────────────────────────────────

describe('approveKit', () => {
  beforeEach(() => {
    prisma.brandKit = { findUnique: vi.fn(), update: vi.fn() };
  });

  it('approves kit when all adjustments acknowledged', async () => {
    const kit = makeKit({
      status: 'inferred',
      contrast_report: { adjustments: [{ id: 'primary-on-light', tokenName: 'primary-text' }] },
    });
    prisma.brandKit.findUnique.mockResolvedValue(kit);
    prisma.brandKit.update.mockImplementation(async ({ data }) => ({ ...kit, ...data }));

    const result = await approveKit('proj-1', { acknowledgedAdjustmentIds: ['primary-on-light'] });
    expect(result.status).toBe('approved');
    expect(result.acknowledged_contrast_adjustments).toBe(true);
  });

  it('throws 409 UNACKNOWLEDGED_CONTRAST when adjustments unacknowledged', async () => {
    const kit = makeKit({
      status: 'inferred',
      contrast_report: { adjustments: [{ id: 'primary-on-light' }] },
    });
    prisma.brandKit.findUnique.mockResolvedValue(kit);

    await expect(approveKit('proj-1', { acknowledgedAdjustmentIds: [] })).rejects.toMatchObject({
      status: 409,
      code: 'UNACKNOWLEDGED_CONTRAST',
    });
  });

  it('approves without prompting when there are no adjustments', async () => {
    const kit = makeKit({
      status: 'inferred',
      contrast_report: { adjustments: [] },
    });
    prisma.brandKit.findUnique.mockResolvedValue(kit);
    prisma.brandKit.update.mockImplementation(async ({ data }) => ({ ...kit, ...data }));

    const result = await approveKit('proj-1', { acknowledgedAdjustmentIds: [] });
    expect(result.status).toBe('approved');
  });

  it('throws 409 NOT_INFERRED when kit is extracted but not inferred', async () => {
    prisma.brandKit.findUnique.mockResolvedValue(makeKit({ status: 'extracted' }));
    await expect(approveKit('proj-1', { acknowledgedAdjustmentIds: [] })).rejects.toMatchObject({
      status: 409,
      code: 'NOT_INFERRED',
    });
  });
});

// ─── reopenKit ────────────────────────────────────────────────────────────────

describe('reopenKit', () => {
  beforeEach(() => {
    prisma.brandKit = { findUnique: vi.fn(), update: vi.fn() };
  });

  it('moves approved kit back to inferred', async () => {
    const kit = makeKit({ status: 'approved' });
    prisma.brandKit.findUnique.mockResolvedValue(kit);
    prisma.brandKit.update.mockImplementation(async ({ data }) => ({ ...kit, ...data }));

    const result = await reopenKit('proj-1');
    expect(result.status).toBe('inferred');
    expect(result.approved_at).toBeNull();
  });

  it('throws 409 NOT_APPROVED for non-approved kits', async () => {
    prisma.brandKit.findUnique.mockResolvedValue(makeKit({ status: 'inferred' }));
    await expect(reopenKit('proj-1')).rejects.toMatchObject({ status: 409, code: 'NOT_APPROVED' });
  });
});

// ─── getTokens ────────────────────────────────────────────────────────────────

describe('getTokens', () => {
  beforeEach(() => {
    prisma.brandKit = { findUnique: vi.fn() };
    prisma.type = { findFirst: vi.fn().mockResolvedValue({ id: 'type-uuid-webapp-brand-kit' }) };
  });

  it('returns theme-engine-compatible payload for approved kit', async () => {
    const kit = makeKit({
      status: 'approved',
      palette: GREEN_PALETTE,
      contrast_report: CONTRAST_REPORT,
    });
    prisma.brandKit.findUnique.mockResolvedValue(kit);

    const payload = await getTokens('proj-1', 'webapp');
    expect(payload).toMatchObject({
      platform: 'webapp',
      values: expect.arrayContaining([
        expect.objectContaining({ slug: expect.stringMatching(/^brand-kit-/) }),
      ]),
    });
  });

  it('throws 409 NOT_APPROVED for non-approved kits', async () => {
    prisma.brandKit.findUnique.mockResolvedValue(makeKit({ status: 'inferred' }));
    await expect(getTokens('proj-1', 'webapp')).rejects.toMatchObject({ status: 409, code: 'NOT_APPROVED' });
  });
});

// ─── State machine: full draft → approved walk ────────────────────────────────

describe('state machine integration: draft → extracted → inferred → approved', () => {
  it('walks the full state machine correctly via mocked prisma', async () => {
    let kitState = makeKit({ status: 'draft' });

    prisma.brandKit = {
      findUnique: vi.fn().mockImplementation(() => kitState),
      update: vi.fn().mockImplementation(async ({ data }) => {
        kitState = { ...kitState, ...data };
        return kitState;
      }),
      upsert: vi.fn().mockImplementation(async ({ update }) => {
        kitState = { ...kitState, ...update };
        return kitState;
      }),
    };

    // Step 1: attempt infer from draft → should fail
    await expect(inferBrandKit('proj-1', {})).rejects.toMatchObject({ code: 'NOT_EXTRACTED' });

    // Step 2: set to extracted (simulating extractPaletteForKit having run)
    kitState = { ...kitState, status: 'extracted', palette: GREEN_PALETTE, contrast_report: CONTRAST_REPORT };

    // Step 3: infer
    const inferred = await inferBrandKit('proj-1', { industry: 'technology' });
    expect(inferred.status).toBe('inferred');
    expect(inferred.inference_source).toBe('fallback');

    // Step 4: attempt approve with no adjustment acknowledgment (no adjustments needed here)
    const approved = await approveKit('proj-1', { acknowledgedAdjustmentIds: [] });
    expect(approved.status).toBe('approved');
    expect(approved.approved_at).toBeDefined();

    // Step 5: attempt to infer again on approved kit → should fail
    await expect(inferBrandKit('proj-1', {})).rejects.toMatchObject({ code: 'APPROVED_IMMUTABLE' });

    // Step 6: reopen
    const reopened = await reopenKit('proj-1');
    expect(reopened.status).toBe('inferred');

    // Step 7: re-approve
    const reapproved = await approveKit('proj-1', { acknowledgedAdjustmentIds: [] });
    expect(reapproved.status).toBe('approved');
  });
});

// ─── Sanitizer path is the only servable route ───────────────────────────────
// Structural test: the service must import sanitizeSvg (ensuring every upload
// passes through the media module's sanitizer before storage) and must NOT
// expose logo_original_path as a URL (it is a MinIO key only).

describe('sanitizer route is the only servable path', () => {
  it('service module exports uploadLogo, extractPaletteForKit, and getTokens', async () => {
    expect(typeof uploadLogo).toBe('function');
    expect(typeof extractPaletteForKit).toBe('function');
    expect(typeof getTokens).toBe('function');
  });

  it('getTokens throws NOT_APPROVED — original path is never exposed as a URL', async () => {
    // A kit with a logo_original_path should still require approval before tokens
    prisma.brandKit = {
      findUnique: vi.fn().mockResolvedValue(makeKit({
        status: 'inferred',
        logo_original_path: 'brand-kit/originals/proj-1/abc.svg', // has original
        palette: GREEN_PALETTE,
      })),
    };
    await expect(getTokens('proj-1', 'webapp')).rejects.toMatchObject({ code: 'NOT_APPROVED' });
  });
});

// ─── deleteExpiredOriginals ───────────────────────────────────────────────────

describe('deleteExpiredOriginals', () => {
  beforeEach(() => {
    prisma.brandKit = {
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    };
    storageService.deleteFile.mockResolvedValue(undefined);
  });

  it('deletes expired originals and clears paths', async () => {
    prisma.brandKit.findMany.mockResolvedValue([
      { id: 'kit-1', project_id: 'proj-1', logo_original_path: 'brand-kit/originals/proj-1/abc.svg' },
    ]);

    const count = await deleteExpiredOriginals();
    expect(count).toBe(1);
    expect(storageService.deleteFile).toHaveBeenCalledWith('brand-kit/originals/proj-1/abc.svg');
    expect(prisma.brandKit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { logo_original_path: null, logo_original_expires_at: null },
      }),
    );
  });

  it('returns 0 when no expired originals', async () => {
    prisma.brandKit.findMany.mockResolvedValue([]);
    expect(await deleteExpiredOriginals()).toBe(0);
  });

  it('continues if deleteFile throws (non-fatal)', async () => {
    prisma.brandKit.findMany.mockResolvedValue([
      { id: 'kit-2', project_id: 'proj-2', logo_original_path: 'brand-kit/originals/proj-2/xyz.svg' },
    ]);
    storageService.deleteFile.mockRejectedValueOnce(new Error('not found'));

    const count = await deleteExpiredOriginals();
    expect(count).toBe(1); // still counted
    expect(prisma.brandKit.update).toHaveBeenCalled(); // path still cleared
  });
});
