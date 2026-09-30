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

vi.mock('../../brand-kit/contact-fields.js', () => ({
  getCompanyInfo: vi.fn(),
}));

vi.mock('../../media/service.js', () => ({
  getMediaById: vi.fn(),
}));

vi.mock('../../page-builder/service.js', () => ({
  createPage:    vi.fn(),
  updatePage:    vi.fn(),
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

import { getCompanyInfo } from '../../brand-kit/contact-fields.js';
import { getMediaById } from '../../media/service.js';

import { createPage, updatePage, getPage, getPageBySlug } from '../../page-builder/service.js';

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

    const expectedLinks = 'Home|/p/te-run-1-home\nAbout|/p/te-run-1-about\nFAQ|/p/te-run-1-faq';

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

  it('a page key outside home/about/contact gets its OWN hero/content, not Home\'s verbatim (KDL bug repro)', async () => {
    // Reported live: every non-home/about/contact page ("Blog detail",
    // "Team", "Team member", ...) rendered identical "Build faster with
    // KDL" content, making it look like clicking between pages did
    // nothing even though navigation itself worked.
    createPage.mockResolvedValueOnce({ id: 'page-blog-detail' });

    await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord(),
      userId: 'user-1',
      projectId: 'proj-A',
      navigationPages: ['Blog detail'],
    });

    const call = createPage.mock.calls[0][0];
    const hero = call.data.content.find((b) => b.type === 'Hero');
    const text = call.data.content.find((b) => b.type === 'Text');
    expect(hero.props.title).toBe('Blog detail');
    expect(hero.props.title).not.toBe('Build faster with KDL');
    expect(text.props.text).toContain('Blog detail');
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
    expect(updatePage).not.toHaveBeenCalled();
    expect(result.outputRef.pageKeyToId).toMatchObject({
      home: 'orphaned-home-page',
      about: 'page-about',
    });
  });

  it('resurrects a soft-deleted page instead of crashing on its still-reserved slug (KDL bug repro)', async () => {
    // slug is globally @unique with no soft-delete awareness — a user who
    // deletes a page via page-builder then later re-selects that same page
    // name in Navigation would otherwise hit the exact same unique-
    // constraint crash the orphan-recovery fix addressed, just via
    // deliberate deletion instead of a partial-failure orphan.
    getPageBySlug.mockResolvedValueOnce({
      id: 'deleted-blog-page',
      deleted_at: '2026-08-01T00:00:00Z',
      data: { content: [{ type: 'NavBar', props: { links: 'Home|#' } }] },
    });
    updatePage.mockResolvedValueOnce({ id: 'deleted-blog-page' });

    const result = await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord(),
      userId: 'user-1',
      projectId: 'proj-A',
      navigationPages: ['Blog'],
    });

    expect(createPage).not.toHaveBeenCalled();
    expect(updatePage).toHaveBeenCalledTimes(1);
    const [updatedId, patch] = updatePage.mock.calls[0];
    expect(updatedId).toBe('deleted-blog-page');
    expect(patch.deleted_at).toBeNull();
    // Nav also needed patching (stale 'Home|#' vs. this run's actual single page).
    expect(patch.data.content[0].props.links).toBe('Blog|/p/te-run-1-blog');
    expect(result.outputRef.pageKeyToId).toMatchObject({ blog: 'deleted-blog-page' });
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

  it('patches a reused page\'s nav links to the current selection without touching unrelated content (KDL bug repro)', async () => {
    // 'home' already exists from a much earlier run whose page set was just
    // Home/About/Contact — its stored NavBar still says so. This run picks
    // a different, larger set; 'home' must be reused (not re-seeded, or a
    // user's manual edits to it would be destroyed) but its nav must catch up.
    const staleContent = [
      { type: 'MedicalTopNav', props: { navLinks: 'Home|#\nAbout|#\nContact|#', brand: 'Your Brand' } },
      { type: 'FeatureCards', props: { sectionTitle: 'A user hand-edited this section' } },
    ];
    const priorMap = { home: 'page-home' };
    getPage.mockResolvedValueOnce({ id: 'page-home', data: { content: staleContent } });
    updatePage.mockResolvedValueOnce({ id: 'page-home' });
    createPage.mockResolvedValueOnce({ id: 'page-blog' });

    const result = await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord({ pageKeyToId: priorMap }),
      userId: 'user-1',
      projectId: 'proj-A',
      navigationPages: ['Home', 'Blog'],
    });

    expect(updatePage).toHaveBeenCalledTimes(1);
    const [updatedId, patch] = updatePage.mock.calls[0];
    expect(updatedId).toBe('page-home');
    const patchedNav = patch.data.content.find((b) => b.type === 'MedicalTopNav');
    expect(patchedNav.props.navLinks).toBe('Home|/p/te-run-1-home\nBlog|/p/te-run-1-blog');
    // The unrelated content block survives untouched — only nav/brand props patch.
    expect(patch.data.content.find((b) => b.type === 'FeatureCards').props.sectionTitle).toBe(
      'A user hand-edited this section',
    );
    expect(result.outputRef.pageKeyToId).toMatchObject({ home: 'page-home', blog: 'page-blog' });
  });

  it('re-uploading a logo or editing brand contact details syncs an already-seeded page\'s nav/footer (KDL bug repro: "I upload a new logo but the site still shows the old one")', async () => {
    // 'home' was seeded long ago with an older brand kit's name/logo — the
    // brand kit has since changed (new logo uploaded, company name edited in
    // Studio's Intake stage). Brand identity is centrally sourced, unlike
    // page content: it must always track the current brand kit, even on a
    // page that's otherwise reused as-is.
    const staleContent = [
      { type: 'NavBar', props: { links: 'Home|#', brand: 'Old Company Name', logoUrl: 'https://old-logo.example/old.png' } },
      { type: 'Footer', props: { links: 'Home|#', brand: 'Old Company Name', logoUrl: 'https://old-logo.example/old.png', copyright: 'stale copyright text' } },
      { type: 'FeatureCards', props: { sectionTitle: 'A user hand-edited this section' } },
    ];
    getKit.mockResolvedValueOnce({ logo_media_id: 'media-new-logo', palette: { colors: {} } });
    getMediaById.mockResolvedValueOnce({ url: 'https://cdn.example/new-logo.png' });
    getCompanyInfo.mockResolvedValueOnce({
      company_name: 'Kalam Dream Labs',
      email: null,
      phone: null,
      addressLines: [],
    });
    const priorMap = { home: 'page-home' };
    getPage.mockResolvedValueOnce({ id: 'page-home', data: { content: staleContent } });
    updatePage.mockResolvedValueOnce({ id: 'page-home' });

    const result = await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord({ pageKeyToId: priorMap }),
      userId: 'user-1',
      projectId: 'proj-A',
      navigationPages: ['Home'],
    });

    expect(updatePage).toHaveBeenCalledTimes(1);
    const [, patch] = updatePage.mock.calls[0];
    const nav = patch.data.content.find((b) => b.type === 'NavBar');
    const footer = patch.data.content.find((b) => b.type === 'Footer');
    expect(nav.props.brand).toBe('Kalam Dream Labs');
    expect(nav.props.logoUrl).toBe('https://cdn.example/new-logo.png');
    expect(footer.props.brand).toBe('Kalam Dream Labs');
    expect(footer.props.logoUrl).toBe('https://cdn.example/new-logo.png');
    // Non-brand content (footer copyright, unrelated block) is untouched.
    expect(footer.props.copyright).toBe('stale copyright text');
    expect(patch.data.content.find((b) => b.type === 'FeatureCards').props.sectionTitle).toBe(
      'A user hand-edited this section',
    );
    expect(result.outputRef.pageKeyToId).toMatchObject({ home: 'page-home' });
  });

  it('does not call updatePage when a reused page\'s nav links already match (no pointless write)', async () => {
    const upToDateContent = [
      { type: 'NavBar', props: { links: 'Home|/p/te-run-1-home', brand: 'Your Brand', logoUrl: '' } },
    ];
    getPage.mockResolvedValueOnce({ id: 'page-home', data: { content: upToDateContent } });

    await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord({ pageKeyToId: { home: 'page-home' } }),
      userId: 'user-1',
      projectId: 'proj-A',
      navigationPages: ['Home'],
    });

    expect(updatePage).not.toHaveBeenCalled();
    expect(createPage).not.toHaveBeenCalled();
  });

  it('re-uploading a logo also syncs a "logo" atom nested inside a Section Builder custom block, leaving sibling atoms untouched', async () => {
    // A custom block built in Section Builder is copied into the page's own
    // Puck data at insert time (type: 'CustomComposedBlock') — its 'logo'
    // atom was prefilled from the brand kit at drop time but, like
    // NavBar/Footer, goes stale the moment the brand kit changes again.
    const staleContent = [
      {
        type: 'CustomComposedBlock',
        props: {
          id: 'blk-1',
          config: {
            category: 'header',
            settings: { container: 'full', padding: 'md', align: 'left', bg: '' },
            atoms: [
              {
                id: 'layout-1',
                type: 'layout',
                mode: 'grid',
                columns: 2,
                children: [
                  { id: 'logo-1', type: 'logo', src: 'https://old-logo.example/old.png', text: 'Old Company Name', size: 'md' },
                  { id: 'heading-1', type: 'heading', text: 'A user hand-edited this heading', level: 'h2' },
                ],
              },
            ],
          },
        },
      },
    ];
    getKit.mockResolvedValueOnce({ logo_media_id: 'media-new-logo', palette: { colors: {} } });
    getMediaById.mockResolvedValueOnce({ url: 'https://cdn.example/new-logo.png' });
    getCompanyInfo.mockResolvedValueOnce({
      company_name: 'Kalam Dream Labs',
      email: null,
      phone: null,
      addressLines: [],
    });
    getPage.mockResolvedValueOnce({ id: 'page-home', data: { content: staleContent } });
    updatePage.mockResolvedValueOnce({ id: 'page-home' });

    await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord({ pageKeyToId: { home: 'page-home' } }),
      userId: 'user-1',
      projectId: 'proj-A',
      navigationPages: ['Home'],
    });

    expect(updatePage).toHaveBeenCalledTimes(1);
    const [, patch] = updatePage.mock.calls[0];
    const block = patch.data.content.find((b) => b.type === 'CustomComposedBlock');
    const [layout] = block.props.config.atoms;
    const logoAtom = layout.children.find((a) => a.type === 'logo');
    const headingAtom = layout.children.find((a) => a.type === 'heading');
    expect(logoAtom.src).toBe('https://cdn.example/new-logo.png');
    expect(logoAtom.text).toBe('Kalam Dream Labs');
    expect(headingAtom.text).toBe('A user hand-edited this heading');
  });

  it('does not call updatePage when a custom block\'s nested logo atom already matches the current brand', async () => {
    const upToDateContent = [
      { type: 'NavBar', props: { links: 'Home|/p/te-run-1-home', brand: 'Your Brand', logoUrl: '' } },
      {
        type: 'CustomComposedBlock',
        props: {
          id: 'blk-1',
          config: {
            category: 'header',
            settings: { container: 'full', padding: 'md', align: 'left', bg: '' },
            atoms: [{ id: 'logo-1', type: 'logo', src: '', text: 'Your Brand', size: 'md' }],
          },
        },
      },
    ];
    getPage.mockResolvedValueOnce({ id: 'page-home', data: { content: upToDateContent } });

    await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord({ pageKeyToId: { home: 'page-home' } }),
      userId: 'user-1',
      projectId: 'proj-A',
      navigationPages: ['Home'],
    });

    expect(updatePage).not.toHaveBeenCalled();
    expect(createPage).not.toHaveBeenCalled();
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

describe('website driver — construction pack seeding (KDL-558 homepage)', () => {
  it('seeds Home with the full construction homepage block sequence when templatePack is construction', async () => {
    createPage.mockResolvedValueOnce({ id: 'page-home' });

    await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord(),
      userId: 'user-1',
      projectId: 'proj-A',
      templatePack: 'construction',
      navigationPages: ['Home'],
    });

    const call = createPage.mock.calls[0][0];
    const types = call.data.content.map((b) => b.type);
    expect(types).toEqual([
      'ConstructionHeader',
      'ConstructionHero',
      'ConstructionStatsStrip',
      'ConstructionOfferingsRows',
      'ConstructionAboutSplit',
      'ConstructionProcessTimeline',
      'ConstructionProjectGallery',
      'ConstructionFeaturedProject',
      'ConstructionProductsShowcase',
      'ConstructionWhyChooseUs',
      'ConstructionClientsGrid',
      'ConstructionTestimonials',
      'ConstructionLeadFormFAQ',
      'ConstructionTaglineStrip',
      'ConstructionFooter',
      'ConstructionFloatingActions',
    ]);
  });

  it('Sectors grid ships 8 items with number tags and hrefs', async () => {
    createPage.mockResolvedValueOnce({ id: 'page-home' });

    await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord(),
      userId: 'user-1',
      projectId: 'proj-A',
      templatePack: 'construction',
      navigationPages: ['Home'],
    });

    const call = createPage.mock.calls[0][0];
    const sectors = call.data.content.find((b) => b.type === 'ConstructionProjectGallery');
    expect(sectors.props.project8Title).toBe('Sector Eight');
    expect(sectors.props.project1NumberTag).toBe('01');
    expect(sectors.props.project1Href).toBe('#sector-1');
  });

  it('Footer contact fields and the WhatsApp button use the real brand-kit phone/email/address instead of dummy placeholders (KDL bug repro: "why does it show dummy contact info")', async () => {
    createPage.mockResolvedValueOnce({ id: 'page-home' });
    getCompanyInfo.mockResolvedValueOnce({
      company_name: 'Subhadra Group',
      email: 'sales@subhadragroup.in',
      phone: '+91 88972 24466',
      addressLines: ['Showroom, Visakhapatnam - 530 016', 'Registered Office, Visakhapatnam - 530 016'],
    });

    await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord(),
      userId: 'user-1',
      projectId: 'proj-A',
      templatePack: 'construction',
      navigationPages: ['Home'],
    });

    const call = createPage.mock.calls[0][0];
    const footer = call.data.content.find((b) => b.type === 'ConstructionFooter');
    const floatingActions = call.data.content.find((b) => b.type === 'ConstructionFloatingActions');
    expect(footer.props.contactPhone).toBe('+91 88972 24466');
    expect(footer.props.contactEmail).toBe('sales@subhadragroup.in');
    expect(footer.props.contactAddress).toBe('Showroom, Visakhapatnam - 530 016');
    expect(footer.props.showroomAddress).toBe('Registered Office, Visakhapatnam - 530 016');
    expect(floatingActions.props.whatsappHref).toBe('https://wa.me/918897224466');
    expect(floatingActions.props).toMatchObject({ badgeSide: 'right', actionsSide: 'left' });
  });

  it('re-syncs an already-seeded page\'s footer contact info and WhatsApp button when brand contact details change, without touching unrelated content', async () => {
    const staleContent = [
      {
        type: 'ConstructionFooter',
        props: {
          links: 'Home|#',
          contactPhone: '+91-98765-43210',
          contactEmail: 'info@yourbrand.com',
          contactAddress: '123 Business Avenue\nCity, State 000000',
          showroomAddress: '456 Showroom Road\nCity, State 000000',
          copyright: 'stale copyright text',
        },
      },
      {
        type: 'ConstructionFloatingActions',
        props: { whatsappHref: 'https://wa.me/919876543210' },
      },
      { type: 'FeatureCards', props: { sectionTitle: 'A user hand-edited this section' } },
    ];
    getKit.mockResolvedValueOnce({ palette: { colors: {} } });
    getCompanyInfo.mockResolvedValueOnce({
      company_name: 'Subhadra Group',
      email: 'sales@subhadragroup.in',
      phone: '+91 88972 24466',
      addressLines: ['Showroom address', 'Registered office address'],
    });
    getPage.mockResolvedValueOnce({ id: 'page-home', data: { content: staleContent } });
    updatePage.mockResolvedValueOnce({ id: 'page-home' });

    const result = await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord({ pageKeyToId: { home: 'page-home' } }),
      userId: 'user-1',
      projectId: 'proj-A',
      navigationPages: ['Home'],
    });

    expect(updatePage).toHaveBeenCalledTimes(1);
    const [, patch] = updatePage.mock.calls[0];
    const footer = patch.data.content.find((b) => b.type === 'ConstructionFooter');
    const floatingActions = patch.data.content.find((b) => b.type === 'ConstructionFloatingActions');
    expect(footer.props.contactPhone).toBe('+91 88972 24466');
    expect(footer.props.contactEmail).toBe('sales@subhadragroup.in');
    expect(footer.props.contactAddress).toBe('Showroom address');
    expect(footer.props.showroomAddress).toBe('Registered office address');
    expect(floatingActions.props.whatsappHref).toBe('https://wa.me/918897224466');
    // Pre-existing pages get the side options back-filled (badge right, buttons left).
    expect(floatingActions.props).toMatchObject({ badgeSide: 'right', actionsSide: 'left' });
    // Non-contact content is untouched.
    expect(footer.props.copyright).toBe('stale copyright text');
    expect(patch.data.content.find((b) => b.type === 'FeatureCards').props.sectionTitle).toBe(
      'A user hand-edited this section',
    );
    expect(result.outputRef.pageKeyToId).toMatchObject({ home: 'page-home' });
  });

  it('Header and Footer nav links reflect the real selected page set, not a hardcoded default', async () => {
    createPage
      .mockResolvedValueOnce({ id: 'page-home' })
      .mockResolvedValueOnce({ id: 'page-services' });

    await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord(),
      userId: 'user-1',
      projectId: 'proj-A',
      templatePack: 'construction',
      navigationPages: ['Home', 'Services'],
    });

    const expectedLinks = 'Home|/p/te-run-1-home\nServices|/p/te-run-1-services';
    const homeCall = createPage.mock.calls[0][0];
    const header = homeCall.data.content.find((b) => b.type === 'ConstructionHeader');
    const footer = homeCall.data.content.find((b) => b.type === 'ConstructionFooter');
    expect(header.props.links).toBe(expectedLinks);
    expect(footer.props.links).toBe(expectedLinks);
  });

  it('non-home construction pages still use the plain NavBar/ConstructionHero/Footer path with the new hero shape', async () => {
    createPage
      .mockResolvedValueOnce({ id: 'page-home' })
      .mockResolvedValueOnce({ id: 'page-about' });

    await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord(),
      userId: 'user-1',
      projectId: 'proj-A',
      templatePack: 'construction',
      navigationPages: ['Home', 'About'],
    });

    const aboutCall = createPage.mock.calls[1][0];
    const navBar = aboutCall.data.content.find((b) => b.type === 'NavBar');
    const hero = aboutCall.data.content.find((b) => b.type === 'ConstructionHero');
    expect(navBar).toBeTruthy();
    expect(hero.props.variant).toBe('2');
    expect(hero.props.d2Headline).toBe('About Our Company');
    // New shape's d2Slide1Image must be populated so ConstructionHero's
    // slider never renders empty on non-home pages after the shape change.
    expect(hero.props.d2Slide1Image).toBeTruthy();
  });
});
