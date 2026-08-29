/**
 * Template-engine Phase 2 driver tests — KDL-509.
 * Covers: intake, palette, inference, approval, collateral, website.
 * Smallest runtime gate per driver: proves the stage returns the right outputRef
 * shape when the upstream service call succeeds.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks (must be hoisted before imports) ─────────────────────────────

vi.mock('../../brand-kit/service.js', () => ({
  getOrCreateKit:      vi.fn(),
  extractPaletteForKit: vi.fn(),
  inferBrandKit:       vi.fn(),
  getKit:              vi.fn(),
  getTokens:           vi.fn(),
  renderGuidelines:    vi.fn(),
}));

vi.mock('../../theme-engine/service.js', () => ({
  upsertValues: vi.fn(),
}));

vi.mock('../../collateral/service.js', () => ({
  listAssets:    vi.fn(),
  createAsset:   vi.fn(),
  preflightAsset: vi.fn(),
  renderAsset:   vi.fn(),
}));

vi.mock('../../page-builder/service.js', () => ({
  createPage:    vi.fn(),
  getPage:       vi.fn(),
  // Defaults to "no orphaned page with this slug" so every existing test
  // (which doesn't care about the orphan-recovery path) keeps working
  // unchanged; tests below override this per-case.
  getPageBySlug: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../config/database.js', () => ({
  prisma: {
    type: { findFirst: vi.fn() },
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import {
  getOrCreateKit,
  extractPaletteForKit,
  inferBrandKit,
  getKit,
  getTokens,
  renderGuidelines,
} from '../../brand-kit/service.js';

import { upsertValues } from '../../theme-engine/service.js';

import {
  listAssets,
  createAsset,
  preflightAsset,
  renderAsset,
} from '../../collateral/service.js';

import { createPage, getPage, getPageBySlug } from '../../page-builder/service.js';

import { prisma } from '../../../config/database.js';

import { getDriver } from './index.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRun(id = 'run-1', extraStages = []) {
  return {
    id,
    projectId: 'proj-A',
    status: 'IN_PROGRESS',
    stages: [
      { stage: 'APPROVAL', status: 'DONE', outputRef: { approvedAt: '2026-08-19T10:00:00Z', tokensWrittenAt: '2026-08-19T10:01:00Z', brandKitVersion: 1 } },
      ...extraStages,
    ],
  };
}

function makeStageRecord(outputRef = null) {
  return { id: 'stage-1', runId: 'run-1', stage: 'WEBSITE', status: 'RUNNING', outputRef };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── intake ────────────────────────────────────────────────────────────────────

describe('intake driver', () => {
  it('returns brandKitId and status from getOrCreateKit', async () => {
    getOrCreateKit.mockResolvedValue({ id: 'kit-1', status: 'draft' });

    const result = await getDriver('intake').execute({ projectId: 'proj-A' });

    expect(getOrCreateKit).toHaveBeenCalledWith('proj-A');
    expect(result.outputRef).toMatchObject({ brandKitId: 'kit-1', status: 'draft' });
  });
});

// ── palette ───────────────────────────────────────────────────────────────────

describe('palette driver', () => {
  it('calls extractPaletteForKit and returns status', async () => {
    extractPaletteForKit.mockResolvedValue({ status: 'extracted' });

    const result = await getDriver('palette').execute({ projectId: 'proj-A' });

    expect(extractPaletteForKit).toHaveBeenCalledWith('proj-A');
    expect(result.outputRef.status).toBe('extracted');
    expect(result.outputRef.extractedAt).toBeTruthy();
  });
});

// ── inference ─────────────────────────────────────────────────────────────────

describe('inference driver', () => {
  it('calls inferBrandKit and returns inference metadata', async () => {
    inferBrandKit.mockResolvedValue({
      inference_source: 'fallback',
      fallback_reason: 'F1_NO_KEY',
      status: 'inferred',
    });

    const result = await getDriver('inference').execute({ projectId: 'proj-A' });

    expect(inferBrandKit).toHaveBeenCalledWith('proj-A', {});
    expect(result.outputRef).toMatchObject({
      inferenceSource: 'fallback',
      fallbackReason: 'F1_NO_KEY',
      status: 'inferred',
    });
  });
});

// ── approval ──────────────────────────────────────────────────────────────────

describe('approval driver', () => {
  const tokenPayload = {
    platform: 'webapp',
    type_id: 'brand-kit',
    values: [{ field_id: 'brand-kit-primary-100', value: '#aabbcc' }],
  };

  it('writes tokens to theme-engine when brand-kit is approved', async () => {
    getKit.mockResolvedValue({ status: 'approved' });
    getTokens.mockResolvedValue(tokenPayload);
    prisma.type.findFirst.mockResolvedValue({ id: 'type-db-id' });
    upsertValues.mockResolvedValue({ errors: null });

    const result = await getDriver('approval').execute({
      projectId: 'proj-A',
      userId: 'user-1',
      stageRecord: makeStageRecord(),
    });

    expect(getTokens).toHaveBeenCalledWith('proj-A', 'webapp');
    expect(upsertValues).toHaveBeenCalledWith('webapp', 'type-db-id', tokenPayload.values, 'user-1', { lockedByModule: 'template-engine' });
    expect(result.outputRef.tokensWrittenAt).toBeTruthy();
    expect(result.outputRef.approvedAt).toBeTruthy();
  });

  it('throws BRAND_KIT_NOT_APPROVED when kit status is not approved', async () => {
    getKit.mockResolvedValue({ status: 'inferred' });

    await expect(
      getDriver('approval').execute({ projectId: 'proj-A', userId: 'user-1', stageRecord: makeStageRecord() }),
    ).rejects.toMatchObject({ code: 'BRAND_KIT_NOT_APPROVED', status: 409 });

    expect(upsertValues).not.toHaveBeenCalled();
  });

  it('skips re-writing tokens when tokensWrittenAt is already set (crash recovery)', async () => {
    const priorOutputRef = {
      approvedAt: '2026-08-19T10:00:00Z',
      tokensWrittenAt: '2026-08-19T10:01:00Z',
    };

    const result = await getDriver('approval').execute({
      projectId: 'proj-A',
      userId: 'user-1',
      stageRecord: makeStageRecord(priorOutputRef),
    });

    expect(getKit).not.toHaveBeenCalled();
    expect(upsertValues).not.toHaveBeenCalled();
    expect(result.outputRef).toEqual(priorOutputRef);
  });

  it('falls back to raw type_id when theme-engine type is not seeded yet', async () => {
    getKit.mockResolvedValue({ status: 'approved' });
    getTokens.mockResolvedValue(tokenPayload);
    prisma.type.findFirst.mockResolvedValue(null); // type not seeded
    upsertValues.mockResolvedValue({ errors: ['type_id does not belong to platform "webapp"'] });

    const result = await getDriver('approval').execute({
      projectId: 'proj-A',
      userId: 'user-1',
      stageRecord: makeStageRecord(),
    });

    // upsertValues called with raw fallback type_id
    expect(upsertValues).toHaveBeenCalledWith('webapp', 'brand-kit', tokenPayload.values, 'user-1', { lockedByModule: 'template-engine' });
    // Stage still advances; errors recorded in outputRef
    expect(result.outputRef.tokenErrors).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(result.outputRef.tokensWrittenAt).toBeTruthy();
  });
});

// ── collateral ────────────────────────────────────────────────────────────────

describe('collateral driver', () => {
  it('preflights and renders existing assets', async () => {
    const asset = { id: 'asset-1', type: 'VISITING_CARD', status: 'DRAFT', renders: [] };
    listAssets.mockResolvedValue([asset]);
    preflightAsset.mockResolvedValue({ ok: true, issues: [] });
    renderAsset.mockResolvedValue({ id: 'render-1' });

    const result = await getDriver('collateral').execute({
      projectId: 'proj-A',
      userId: 'user-1',
      stageRecord: makeStageRecord(),
      run: makeRun(),
    });

    expect(preflightAsset).toHaveBeenCalledWith('asset-1');
    expect(renderAsset).toHaveBeenCalledWith('asset-1', expect.objectContaining({ format: 'PDF_DIGITAL' }));
    expect(result.outputRef.renderIds).toContain('render-1');
  });

  it('creates default assets when none exist, then renders them', async () => {
    listAssets
      .mockResolvedValueOnce([])  // first call: empty → triggers default asset creation
      .mockResolvedValueOnce([   // second call: after createAsset loop
        { id: 'asset-1', type: 'VISITING_CARD', status: 'DRAFT', renders: [] },
        { id: 'asset-2', type: 'LETTERHEAD',    status: 'DRAFT', renders: [] },
      ]);
    createAsset.mockResolvedValue({});
    preflightAsset.mockResolvedValue({ ok: true, issues: [] });
    renderAsset.mockResolvedValue({ id: 'render-x' });

    const result = await getDriver('collateral').execute({
      projectId: 'proj-A',
      userId: 'user-1',
      stageRecord: makeStageRecord(),
      run: makeRun(),
    });

    expect(createAsset).toHaveBeenCalledTimes(2);
    expect(result.outputRef.renderIds.length).toBeGreaterThan(0);
  });

  it('throws named preflight error when an asset fails preflight', async () => {
    const asset = { id: 'asset-1', type: 'VISITING_CARD', status: 'DRAFT', renders: [] };
    listAssets.mockResolvedValue([asset]);
    preflightAsset.mockResolvedValue({
      ok: false,
      issues: [{ code: 'LOGO_BELOW_MIN_WIDTH', message: 'Logo too small' }],
    });

    await expect(
      getDriver('collateral').execute({
        projectId: 'proj-A', userId: 'user-1', stageRecord: makeStageRecord(), run: makeRun(),
      }),
    ).rejects.toMatchObject({ code: 'LOGO_BELOW_MIN_WIDTH' });

    expect(renderAsset).not.toHaveBeenCalled();
  });

  it('skips assets whose render is already recorded (crash recovery)', async () => {
    const asset = { id: 'asset-1', type: 'VISITING_CARD', status: 'READY', renders: [{ id: 'render-1' }] };
    listAssets.mockResolvedValue([asset]);

    const result = await getDriver('collateral').execute({
      projectId: 'proj-A',
      userId: 'user-1',
      stageRecord: makeStageRecord({ renderIds: ['render-1'] }),
      run: makeRun(),
    });

    expect(preflightAsset).not.toHaveBeenCalled();
    expect(renderAsset).not.toHaveBeenCalled();
    expect(result.outputRef.renderIds).toContain('render-1');
  });
});

// ── website ───────────────────────────────────────────────────────────────────

describe('website driver — happy path', () => {
  it('creates home, about, and contact pages and returns outputRef', async () => {
    createPage
      .mockResolvedValueOnce({ id: 'page-home',    title: 'Home',    slug: 'te-run-1-home' })
      .mockResolvedValueOnce({ id: 'page-about',   title: 'About',   slug: 'te-run-1-about' })
      .mockResolvedValueOnce({ id: 'page-contact', title: 'Contact', slug: 'te-run-1-contact' });

    const result = await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord(),
      userId: 'user-1',
      projectId: 'proj-A',
    });

    expect(createPage).toHaveBeenCalledTimes(3);
    expect(result.outputRef.pageIds).toEqual(['page-home', 'page-about', 'page-contact']);
    expect(result.outputRef.pageKeyToId).toMatchObject({ home: 'page-home', about: 'page-about', contact: 'page-contact' });
    expect(result.outputRef.seededAt).toBeTruthy();
  });
});

describe('website driver — navigationPages (KDL bug: Navigation-step selection was ignored)', () => {
  it('creates one page per selected navigation page, not just the default 3', async () => {
    createPage
      .mockResolvedValueOnce({ id: 'page-home' })
      .mockResolvedValueOnce({ id: 'page-about' })
      .mockResolvedValueOnce({ id: 'page-services' })
      .mockResolvedValueOnce({ id: 'page-service-detail' })
      .mockResolvedValueOnce({ id: 'page-contact' })
      .mockResolvedValueOnce({ id: 'page-faq' });

    const navigationPages = ['Home', 'About', 'Services', 'Service detail', 'Contact', 'FAQ'];

    const result = await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord(),
      userId: 'user-1',
      projectId: 'proj-A',
      navigationPages,
    });

    expect(createPage).toHaveBeenCalledTimes(6);
    expect(result.outputRef.pageIds).toHaveLength(6);
    expect(result.outputRef.pageKeyToId).toMatchObject({
      home: 'page-home',
      about: 'page-about',
      services: 'page-services',
      'service-detail': 'page-service-detail',
      contact: 'page-contact',
      faq: 'page-faq',
    });
    // The frontend's page grid displays pageKeyToTitle's value verbatim —
    // it must keep the user's real title ('Service detail', 'FAQ'), not
    // something re-derived from the slugified key ('Service-detail', 'Faq').
    expect(result.outputRef.pageKeyToTitle).toMatchObject({
      home: 'Home',
      about: 'About',
      services: 'Services',
      'service-detail': 'Service detail',
      contact: 'Contact',
      faq: 'FAQ',
    });
  });

  it('derives each page key by slugifying its title', async () => {
    createPage.mockResolvedValueOnce({ id: 'page-1' });

    await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord(),
      userId: 'user-1',
      projectId: 'proj-A',
      navigationPages: ['Portfolio detail'],
    });

    expect(createPage).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'te-run-1-portfolio-detail' }),
      'user-1',
    );
  });

  it('every seeded page\'s nav links every OTHER selected page, not a hardcoded Home/About/Contact', async () => {
    createPage
      .mockResolvedValueOnce({ id: 'page-home' })
      .mockResolvedValueOnce({ id: 'page-about' })
      .mockResolvedValueOnce({ id: 'page-faq' });

    await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord(),
      userId: 'user-1',
      projectId: 'proj-A',
      navigationPages: ['Home', 'About', 'FAQ'],
    });

    const expectedLinks = 'Home|#\nAbout|#\nFAQ|#';

    // Home uses MedicalTopNav (navLinks prop) — see headerBlocks().
    const homeCall = createPage.mock.calls[0][0];
    const topNav = homeCall.data.content.find((b) => b.type === 'MedicalTopNav');
    expect(topNav.props.navLinks).toBe(expectedLinks);

    // Every other page uses NavBar (links prop) + Footer (links prop).
    const aboutCall = createPage.mock.calls[1][0];
    const navBar = aboutCall.data.content.find((b) => b.type === 'NavBar');
    const footer = aboutCall.data.content.find((b) => b.type === 'Footer');
    expect(navBar.props.links).toBe(expectedLinks);
    expect(footer.props.links).toBe(expectedLinks);
  });

  it('reuses an orphaned page found by slug instead of crashing on a unique-constraint error (KDL bug repro)', async () => {
    // Simulates a prior advance attempt that created 'home' then threw on a
    // later key before the stage's outputRef was ever saved — 'home' is
    // missing from priorMap (stageRecord below has none), but a page with
    // its deterministic slug already exists. A blind createPage() would
    // hit "Unique constraint failed on the fields: (slug)".
    // mockResolvedValueOnce (not mockImplementation) so this override
    // consumes itself after the 'home' lookup and doesn't leak into later
    // tests — the module-level default (resolves null) covers 'about'.
    getPageBySlug.mockResolvedValueOnce({ id: 'orphaned-home-page' });
    createPage.mockResolvedValueOnce({ id: 'page-about' });

    const result = await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord(), // no priorMap — 'home' isn't recorded anywhere
      userId: 'user-1',
      projectId: 'proj-A',
      navigationPages: ['Home', 'About'],
    });

    // 'home' reused the orphan (no createPage call for it); 'about' is genuinely new.
    expect(createPage).toHaveBeenCalledTimes(1);
    expect(createPage).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'te-run-1-about' }),
      'user-1',
    );
    expect(result.outputRef.pageKeyToId).toMatchObject({
      home: 'orphaned-home-page',
      about: 'page-about',
    });
  });

  it('falls back to the default Home/About/Contact set when navigationPages is empty', async () => {
    createPage
      .mockResolvedValueOnce({ id: 'page-home' })
      .mockResolvedValueOnce({ id: 'page-about' })
      .mockResolvedValueOnce({ id: 'page-contact' });

    const result = await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord(),
      userId: 'user-1',
      projectId: 'proj-A',
      navigationPages: [],
    });

    expect(createPage).toHaveBeenCalledTimes(3);
    expect(result.outputRef.pageKeyToId).toMatchObject({ home: 'page-home', about: 'page-about', contact: 'page-contact' });
  });
});

describe('website driver — crash recovery (§4.1)', () => {
  it('reuses existing pages when priorMap pageIds still exist', async () => {
    const priorMap = { home: 'page-home', about: 'page-about', contact: 'page-contact' };
    getPage
      .mockResolvedValueOnce({ id: 'page-home' })
      .mockResolvedValueOnce({ id: 'page-about' })
      .mockResolvedValueOnce({ id: 'page-contact' });

    const result = await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord({ pageKeyToId: priorMap }),
      userId: 'user-1',
      projectId: 'proj-A',
    });

    expect(createPage).not.toHaveBeenCalled();
    expect(result.outputRef.pageIds).toEqual(['page-home', 'page-about', 'page-contact']);
  });
});

// ── guidelines driver (KDL-537 — wired) ──────────────────────────────────────

describe('guidelines driver', () => {
  it('calls renderGuidelines and returns outputRef with renderId', async () => {
    renderGuidelines.mockResolvedValue({
      renderId: 'brand-kit/guidelines/proj-A/abc.pdf',
      fileUrl:  'brand-kit/guidelines/proj-A/abc.pdf',
      bytes:    4096,
    });

    const result = await getDriver('guidelines').execute({
      projectId: 'proj-A',
      userId: 'user-1',
      stageRecord: { outputRef: null },
    });

    expect(renderGuidelines).toHaveBeenCalledWith('proj-A', {
      idempotencyKey: 'te:proj-A:guidelines',
      actorId: 'user-1',
    });
    expect(result.outputRef.renderId).toBe('brand-kit/guidelines/proj-A/abc.pdf');
    expect(result.outputRef.renderedAt).toBeTruthy();
  });

  it('returns prior outputRef without re-calling renderGuidelines (crash recovery)', async () => {
    const priorRef = {
      renderId:   'brand-kit/guidelines/proj-A/prior.pdf',
      fileUrl:    'brand-kit/guidelines/proj-A/prior.pdf',
      bytes:      2048,
      renderedAt: '2026-08-20T10:00:00Z',
    };

    const result = await getDriver('guidelines').execute({
      projectId: 'proj-A',
      userId: 'user-1',
      stageRecord: { outputRef: priorRef },
    });

    expect(renderGuidelines).not.toHaveBeenCalled();
    expect(result.outputRef).toEqual(priorRef);
  });
});
