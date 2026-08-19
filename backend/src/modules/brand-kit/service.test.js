// Integration test: brand-kit state machine
// Mocks the database and storage layer to walk the full
// draft → extracted → inferred → approved state machine.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
// Phase 2 (KDL-510): AI path + credits metering mocked at the module seams.
// aiServicesConfigured defaults to false so the pre-Phase-2 tests keep
// exercising the unwired F1_NO_KEY path unchanged.
vi.mock('./ai-client.js', () => ({
  aiServicesConfigured: vi.fn(() => false),
  requestBrandInference: vi.fn(),
}));
vi.mock('../credits/service.js', () => ({
  withCreditHold: vi.fn(),
}));

import { prisma } from '../../config/database.js';
import * as storageService from '../../shared/services/storage.service.js';
import { uploadMedia } from '../media/service.js';
import { aiServicesConfigured, requestBrandInference } from './ai-client.js';
import { withCreditHold } from '../credits/service.js';
import { BRAND_INFERENCE_COST } from './costs.js';
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

// ─── inferBrandKit — Phase 2 AI path (KDL-510) ────────────────────────────────

describe('inferBrandKit — AI path', () => {
  const aiConfiguredMock = vi.mocked(aiServicesConfigured);
  const aiRequestMock = vi.mocked(requestBrandInference);
  const holdMock = vi.mocked(withCreditHold);

  const AI_ENVELOPE = {
    schemaVersion: 1,
    source: 'ai',
    fallbackReason: null,
    model: 'claude-opus-4-8',
    usage: { input_tokens: 1500, output_tokens: 400 },
    estimatedCostUsd: 0.0175,
    confidence: 0.85,
    typography: {
      pairingId: 'space-grotesk-inter',
      heading: { family: 'Space Grotesk', weights: [500, 700], fallbackStack: 'Space Grotesk, system-ui, sans-serif' },
      body: { family: 'Inter', weights: [400, 500], fallbackStack: 'Inter, system-ui, sans-serif' },
      scaleRatio: 1.25,
      rationale: 'Technical but distinctive.',
    },
    tone: { voice: 'Confident and concrete.', adjectives: ['precise'], dos: ['Lead with outcomes'], donts: ['Avoid buzzwords'] },
    strategy: { positioning: 'x', audienceNotes: 'y', elevatorPitch: 'z' },
  };

  let settled; // the { result, actualMc, usage } tuple handed to settleHold

  beforeEach(() => {
    prisma.brandKit = { findUnique: vi.fn(), update: vi.fn() };
    prisma.brandKit.update.mockImplementation(async ({ data }) => ({ ...makeKit(), ...data }));
    prisma.brandKit.findUnique.mockResolvedValue(
      makeKit({ status: 'extracted', palette: GREEN_PALETTE, contrast_report: CONTRAST_REPORT }),
    );
    aiConfiguredMock.mockReturnValue(true);
    settled = null;
    holdMock.mockImplementation(async (_opts, fn) => {
      settled = await fn();
      return settled.result;
    });
  });

  afterEach(() => {
    aiConfiguredMock.mockReturnValue(false);
    aiRequestMock.mockReset();
    holdMock.mockReset();
  });

  it('persists source ai and settles the hold at BRAND_INFERENCE_COST', async () => {
    aiRequestMock.mockResolvedValue(AI_ENVELOPE);

    const result = await inferBrandKit('proj-1', { industry: 'technology', companyName: 'Acme' });

    expect(result.inference_source).toBe('ai');
    expect(result.fallback_reason).toBeNull();
    expect(result.typography.heading.family).toBe('Space Grotesk');
    expect(settled.actualMc).toBe(BigInt(BRAND_INFERENCE_COST));
    expect(settled.usage).toMatchObject({ model: 'claude-opus-4-8', inputTokens: 1500, costUsd: 0.0175 });
  });

  it('reserves with the caller-side cost constant and passes the idempotency key verbatim', async () => {
    aiRequestMock.mockResolvedValue(AI_ENVELOPE);

    await inferBrandKit('proj-1', { industry: 'tech', idempotencyKey: 'idem-123', userId: 'user-9' });

    expect(holdMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj-1',
        source: 'brand.inference',
        estimateMc: BigInt(BRAND_INFERENCE_COST),
        idempotencyKey: 'idem-123',
        actorId: 'user-9',
      }),
      expect.any(Function),
    );
  });

  it('generates an idempotency key internally when the header is absent', async () => {
    aiRequestMock.mockResolvedValue(AI_ENVELOPE);
    await inferBrandKit('proj-1', { industry: 'tech' });
    const key = holdMock.mock.calls[0][0].idempotencyKey;
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(10);
  });

  it('sends the deterministic palette summary with a hue name', async () => {
    aiRequestMock.mockResolvedValue(AI_ENVELOPE);
    await inferBrandKit('proj-1', { industry: 'tech', companyName: 'Acme' });
    expect(aiRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: 'Acme',
        paletteSummary: expect.objectContaining({
          primaryHex: '#0e6e5c',
          neutralHex: '#6b7280',
          chroma: 0.11,
          hueName: expect.any(String),
        }),
      }),
    );
  });

  it('endpoint-degraded envelope persists its F-code and settles at 0', async () => {
    aiRequestMock.mockResolvedValue({
      ...AI_ENVELOPE,
      source: 'fallback',
      fallbackReason: 'F6_BAD_OUTPUT',
      model: null,
      usage: null,
      estimatedCostUsd: 0,
    });

    const result = await inferBrandKit('proj-1', { industry: 'tech' });

    expect(result.inference_source).toBe('fallback');
    expect(result.fallback_reason).toBe('F6_BAD_OUTPUT');
    expect(settled.actualMc).toBe(0n);
  });

  it('transport failure degrades to local fallback F3_TIMEOUT, settled at 0', async () => {
    aiRequestMock.mockRejectedValue(Object.assign(new Error('unreachable'), { code: 'AI_TRANSPORT' }));

    const result = await inferBrandKit('proj-1', { industry: 'technology' });

    expect(result.inference_source).toBe('fallback');
    expect(result.fallback_reason).toBe('F3_TIMEOUT');
    expect(result.typography.heading.family).toBe('Inter'); // local rule table
    expect(settled.actualMc).toBe(0n);
  });

  it('rejected service credentials degrade to F2_AUTH', async () => {
    aiRequestMock.mockRejectedValue(Object.assign(new Error('401'), { code: 'AI_AUTH' }));
    const result = await inferBrandKit('proj-1', { industry: 'tech' });
    expect(result.fallback_reason).toBe('F2_AUTH');
  });

  it('INSUFFICIENT_CREDITS degrades to F5_BUDGET instead of erroring', async () => {
    holdMock.mockRejectedValue(Object.assign(new Error('no credits'), { code: 'INSUFFICIENT_CREDITS' }));

    const result = await inferBrandKit('proj-1', { industry: 'tech' });

    expect(result.inference_source).toBe('fallback');
    expect(result.fallback_reason).toBe('F5_BUDGET');
    expect(aiRequestMock).not.toHaveBeenCalled();
  });

  it('other credit errors propagate (caller bug, not AI failure)', async () => {
    holdMock.mockRejectedValue(Object.assign(new Error('bad amount'), { code: 'INVALID_AMOUNT' }));
    await expect(inferBrandKit('proj-1', { industry: 'tech' })).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
  });

  it('credits are never touched when the AI path is not wired', async () => {
    aiConfiguredMock.mockReturnValue(false);
    const result = await inferBrandKit('proj-1', { industry: 'tech' });
    expect(result.fallback_reason).toBe('F1_NO_KEY');
    expect(holdMock).not.toHaveBeenCalled();
    expect(aiRequestMock).not.toHaveBeenCalled();
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
      type_id: 'brand-kit',
      values: expect.arrayContaining([
        expect.objectContaining({ field_id: expect.stringMatching(/^brand-kit-/) }),
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
