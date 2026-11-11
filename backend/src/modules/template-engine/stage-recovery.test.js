/**
 * Stage recovery tests — KDL-580.
 * Covers: retryStage, skipStage, and all guard conditions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('./drivers/index.js', () => ({ getDriver: vi.fn() }));
vi.mock('../identity/read.js', () => ({ readIdentity: vi.fn() }));
vi.mock('./ai-client.js', () => ({
  aiServicesConfigured: vi.fn(),
  requestWebsiteCopy: vi.fn(),
}));
vi.mock('../credits/service.js', () => ({
  withCreditHold: vi.fn(),
  CreditError: class CreditError extends Error {
    constructor(code, message) {
      super(message ?? code);
      this.name = 'CreditError';
      this.code = code;
    }
  },
}));

import { prisma } from '../../config/database.js';
import { retryStage, skipStage, generateWebsiteCopy } from './service.js';
import { readIdentity } from '../identity/read.js';
import { aiServicesConfigured, requestWebsiteCopy } from './ai-client.js';
import { withCreditHold, CreditError } from '../credits/service.js';
import { CONSTRUCTION_HERO_HOME, CONSTRUCTION_ABOUT_SPLIT } from './drivers/website-seed-content.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRun(stages) {
  return {
    id: 'run-1',
    projectId: 'proj-A',
    stages,
  };
}

function stage(stageEnum, status, id = `stage-${stageEnum}`) {
  return { id, stage: stageEnum, status };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── retryStage ────────────────────────────────────────────────────────────────

describe('retryStage', () => {
  it('resets a FAILED stage to PENDING', async () => {
    const failedStage = stage('GUIDELINES', 'FAILED');
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([
        stage('INTAKE', 'DONE'),
        stage('APPROVAL', 'DONE'),
        failedStage,
      ])),
    };
    prisma.templateEngineStage = {
      update: vi.fn().mockResolvedValue({ ...failedStage, status: 'PENDING', errorCode: null }),
    };

    const result = await retryStage('run-1', 'guidelines', 'user-1', 'proj-A');

    expect(result.status).toBe('PENDING');
    expect(prisma.templateEngineStage.update).toHaveBeenCalledWith({
      where: { id: failedStage.id },
      data: { status: 'PENDING', errorCode: null, startedAt: null, completedAt: null },
    });
  });

  it('throws STAGE_NOT_FAILED when stage is DONE', async () => {
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([
        stage('GUIDELINES', 'DONE'),
      ])),
    };

    await expect(retryStage('run-1', 'guidelines', 'user-1', 'proj-A')).rejects.toMatchObject({
      status: 409,
      code: 'STAGE_NOT_FAILED',
    });
  });

  it('throws STAGE_NOT_FAILED when stage has not started (no record)', async () => {
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([])),
    };

    await expect(retryStage('run-1', 'guidelines', 'user-1', 'proj-A')).rejects.toMatchObject({
      status: 409,
      code: 'STAGE_NOT_FAILED',
    });
  });

  it('throws EXPORT_ALREADY_DONE when the run has already exported', async () => {
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([
        stage('EXPORT', 'DONE'),
        stage('GUIDELINES', 'FAILED'),
      ])),
    };

    await expect(retryStage('run-1', 'guidelines', 'user-1', 'proj-A')).rejects.toMatchObject({
      status: 409,
      code: 'EXPORT_ALREADY_DONE',
    });
  });

  it('works for required stages (intake, preflight, etc.) — required ≠ non-retryable', async () => {
    const failedIntake = stage('INTAKE', 'FAILED');
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([failedIntake])),
    };
    prisma.templateEngineStage = {
      update: vi.fn().mockResolvedValue({ ...failedIntake, status: 'PENDING', errorCode: null }),
    };

    const result = await retryStage('run-1', 'intake', 'user-1', 'proj-A');
    expect(result.status).toBe('PENDING');
  });
});

// ── skipStage ─────────────────────────────────────────────────────────────────

describe('skipStage', () => {
  for (const slug of ['guidelines', 'collateral', 'website']) {
    const stageEnum = slug.toUpperCase();

    it(`skips a FAILED ${slug} stage to SKIPPED`, async () => {
      const failedStage = stage(stageEnum, 'FAILED');
      prisma.templateEngineRun = {
        findUnique: vi.fn().mockResolvedValue(makeRun([
          stage('APPROVAL', 'DONE'),
          failedStage,
        ])),
      };
      prisma.templateEngineStage = {
        update: vi.fn().mockResolvedValue({ ...failedStage, status: 'SKIPPED', errorCode: null }),
      };

      const result = await skipStage('run-1', slug, 'user-1', 'proj-A');

      expect(result.status).toBe('SKIPPED');
      expect(prisma.templateEngineStage.update).toHaveBeenCalledWith({
        where: { id: failedStage.id },
        data: expect.objectContaining({ status: 'SKIPPED', errorCode: null }),
      });
    });
  }

  for (const slug of ['intake', 'palette', 'inference', 'approval', 'preflight', 'export']) {
    it(`rejects skip on required stage: ${slug}`, async () => {
      prisma.templateEngineRun = {
        findUnique: vi.fn().mockResolvedValue(makeRun([
          stage(slug.toUpperCase(), 'FAILED'),
        ])),
      };

      await expect(skipStage('run-1', slug, 'user-1', 'proj-A')).rejects.toMatchObject({
        status: 409,
        code: 'STAGE_NOT_SKIPPABLE',
      });
    });
  }

  it('throws STAGE_NOT_FAILED when optional stage is not FAILED', async () => {
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([
        stage('COLLATERAL', 'PENDING'),
      ])),
    };

    await expect(skipStage('run-1', 'collateral', 'user-1', 'proj-A')).rejects.toMatchObject({
      status: 409,
      code: 'STAGE_NOT_FAILED',
    });
  });

  it('throws EXPORT_ALREADY_DONE when the run has already exported', async () => {
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([
        stage('EXPORT', 'DONE'),
        stage('COLLATERAL', 'FAILED'),
      ])),
    };

    await expect(skipStage('run-1', 'collateral', 'user-1', 'proj-A')).rejects.toMatchObject({
      status: 409,
      code: 'EXPORT_ALREADY_DONE',
    });
  });

  it('a skipped optional stage allows preflight gate to pass (integration with checkGate)', async () => {
    // After skipping collateral, the gate for preflight should accept SKIPPED.
    // This tests the data contract, not a DB call — checkGate is a pure function.
    const { checkGate } = await import('./service.js');
    const stagesAfterSkip = [
      stage('INTAKE', 'DONE'),
      stage('PALETTE', 'DONE'),
      stage('INFERENCE', 'DONE'),
      stage('APPROVAL', 'DONE'),
      stage('GUIDELINES', 'DONE'),
      stage('COLLATERAL', 'SKIPPED'),
      stage('WEBSITE', 'DONE'),
    ];
    expect(checkGate('preflight', stagesAfterSkip)).toMatchObject({ ok: true });
  });
});

// ── generateWebsiteCopy ─────────────────────────────────────────────────────

describe('generateWebsiteCopy', () => {
  function makeHomePageData() {
    return {
      content: [
        { type: 'ConstructionHero', props: { id: 'home-ConstructionHero', ...CONSTRUCTION_HERO_HOME } },
        { type: 'ConstructionAboutSplit', props: { id: 'home-ConstructionAboutSplit', ...CONSTRUCTION_ABOUT_SPLIT } },
      ],
    };
  }

  const doneWebsiteStage = () =>
    stage('WEBSITE', 'DONE', 'stage-WEBSITE-1');

  const makeIdentity = (over = {}) => ({
    company_name: 'Acme Co',
    app_name: '',
    description: 'We build things.',
    ...over,
  });

  // Captured by the withCreditHold mock below so tests can assert on the
  // actual µc amount settled (actualMc), not just that a hold happened.
  let capturedFnResult;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedFnResult = undefined;
    aiServicesConfigured.mockReturnValue(true);
    withCreditHold.mockImplementation(async (_opts, fn) => {
      const r = await fn();
      capturedFnResult = r;
      return r.result;
    });
  });

  it('patches the home page and returns which blocks were updated', async () => {
    const websiteStage = { ...doneWebsiteStage(), outputRef: { pageKeyToId: { home: 'page-home' } } };
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([websiteStage])),
    };
    prisma.builderPage = {
      findFirst: vi.fn().mockResolvedValue({ id: 'page-home', data: makeHomePageData() }),
      update: vi.fn().mockResolvedValue({}),
    };
    readIdentity.mockResolvedValue(makeIdentity());
    requestWebsiteCopy.mockResolvedValue({
      success: true,
      model: 'claude-sonnet-4-6',
      usage: { input_tokens: 100, output_tokens: 50 },
      copy: {
        hero: [
          { badge: 'B0', headline: 'H0', subheadline: 'S0', ctaLabel: 'C0' },
          { badge: 'B1', headline: 'H1', subheadline: 'S1', ctaLabel: 'C1' },
          { badge: 'B2', headline: 'H2', subheadline: 'S2', ctaLabel: 'C2' },
        ],
        about: { eyebrow: 'New', heading: 'New heading', paragraph: 'New paragraph' },
      },
    });

    const result = await generateWebsiteCopy('run-1', 'proj-A', 'user-1');

    expect(result.patchedBlocks.slice().sort()).toEqual(['ConstructionAboutSplit', 'ConstructionHero']);
    expect(prisma.builderPage.update).toHaveBeenCalledTimes(1);
    const [updateArgs] = prisma.builderPage.update.mock.calls[0];
    expect(updateArgs.where).toEqual({ id: 'page-home' });
    const heroBlock = updateArgs.data.data.content.find((b) => b.type === 'ConstructionHero');
    const aboutBlock = updateArgs.data.data.content.find((b) => b.type === 'ConstructionAboutSplit');
    expect(heroBlock.props.d1Slides[0].headline).toBe('H0');
    expect(heroBlock.props.d1Slides[1].headline).toBe('H1');
    expect(heroBlock.props.d1Slides[2].headline).toBe('H2');
    expect(aboutBlock.props.heading).toBe('New heading');

    // Credit-unit regression: 15 CREDITS must be reserved/settled as
    // 15,000,000 µc (1 credit = 1,000,000 µc), not 15 µc.
    expect(withCreditHold).toHaveBeenCalledTimes(1);
    const [holdOpts] = withCreditHold.mock.calls[0];
    expect(holdOpts.estimateMc).toBe(15_000_000n);
    expect(capturedFnResult.actualMc).toBe(15_000_000n);
  });

  it('leaves the page untouched when the credit hold is refused', async () => {
    const websiteStage = { ...doneWebsiteStage(), outputRef: { pageKeyToId: { home: 'page-home' } } };
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([websiteStage])),
    };
    prisma.builderPage = {
      findFirst: vi.fn().mockResolvedValue({ id: 'page-home', data: makeHomePageData() }),
      update: vi.fn(),
    };
    readIdentity.mockResolvedValue(makeIdentity());
    withCreditHold.mockRejectedValue(new CreditError('INSUFFICIENT_CREDITS', 'nope'));

    const result = await generateWebsiteCopy('run-1', 'proj-A', 'user-1');

    expect(result).toEqual({ patchedBlocks: [] });
    expect(prisma.builderPage.update).not.toHaveBeenCalled();
  });

  it('leaves the page untouched (no throw, no charge) when ai-services is unreachable', async () => {
    const websiteStage = { ...doneWebsiteStage(), outputRef: { pageKeyToId: { home: 'page-home' } } };
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([websiteStage])),
    };
    prisma.builderPage = {
      findFirst: vi.fn().mockResolvedValue({ id: 'page-home', data: makeHomePageData() }),
      update: vi.fn(),
    };
    readIdentity.mockResolvedValue(makeIdentity());
    requestWebsiteCopy.mockRejectedValue(Object.assign(new Error('ai-services unreachable'), { code: 'AI_TRANSPORT' }));

    const result = await generateWebsiteCopy('run-1', 'proj-A', 'user-1');

    expect(result).toEqual({ patchedBlocks: [] });
    expect(prisma.builderPage.update).not.toHaveBeenCalled();
  });

  it('throws WEBSITE_NOT_ASSEMBLED when the website stage has not completed', async () => {
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([stage('WEBSITE', 'PENDING')])),
    };

    await expect(generateWebsiteCopy('run-1', 'proj-A', 'user-1')).rejects.toMatchObject({
      status: 409,
      code: 'WEBSITE_NOT_ASSEMBLED',
    });
  });

  it('throws NO_HOME_PAGE when the WEBSITE stage is DONE but outputRef has no home page key', async () => {
    const websiteStage = { ...doneWebsiteStage(), outputRef: { pageKeyToId: { about: 'page-about' } } };
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([websiteStage])),
    };

    await expect(generateWebsiteCopy('run-1', 'proj-A', 'user-1')).rejects.toMatchObject({
      status: 409,
      code: 'NO_HOME_PAGE',
    });
  });

  it('returns patchedBlocks: [] with no AI call and no credit hold when aiServicesConfigured() is false', async () => {
    const websiteStage = { ...doneWebsiteStage(), outputRef: { pageKeyToId: { home: 'page-home' } } };
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([websiteStage])),
    };
    prisma.builderPage = {
      findFirst: vi.fn().mockResolvedValue({ id: 'page-home', data: makeHomePageData() }),
      update: vi.fn(),
    };
    readIdentity.mockResolvedValue(makeIdentity());
    aiServicesConfigured.mockReturnValue(false);

    const result = await generateWebsiteCopy('run-1', 'proj-A', 'user-1');

    expect(result).toEqual({ patchedBlocks: [] });
    expect(requestWebsiteCopy).not.toHaveBeenCalled();
    expect(withCreditHold).not.toHaveBeenCalled();
    expect(prisma.builderPage.update).not.toHaveBeenCalled();
  });

  it('returns patchedBlocks: [] with no AI call when businessDescription is empty (field present, no value)', async () => {
    const websiteStage = { ...doneWebsiteStage(), outputRef: { pageKeyToId: { home: 'page-home' } } };
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([websiteStage])),
    };
    prisma.builderPage = {
      findFirst: vi.fn().mockResolvedValue({ id: 'page-home', data: makeHomePageData() }),
      update: vi.fn(),
    };
    readIdentity.mockResolvedValue(makeIdentity({ description: '' }));

    const result = await generateWebsiteCopy('run-1', 'proj-A', 'user-1');

    expect(result).toEqual({ patchedBlocks: [] });
    expect(requestWebsiteCopy).not.toHaveBeenCalled();
    expect(withCreditHold).not.toHaveBeenCalled();
    expect(prisma.builderPage.update).not.toHaveBeenCalled();
  });

  it('returns patchedBlocks: [] with no AI call when the business description is blank (whitespace only)', async () => {
    const websiteStage = { ...doneWebsiteStage(), outputRef: { pageKeyToId: { home: 'page-home' } } };
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([websiteStage])),
    };
    prisma.builderPage = {
      findFirst: vi.fn().mockResolvedValue({ id: 'page-home', data: makeHomePageData() }),
      update: vi.fn(),
    };
    readIdentity.mockResolvedValue(makeIdentity({ description: '   ' }));

    const result = await generateWebsiteCopy('run-1', 'proj-A', 'user-1');

    expect(result).toEqual({ patchedBlocks: [] });
    expect(requestWebsiteCopy).not.toHaveBeenCalled();
    expect(withCreditHold).not.toHaveBeenCalled();
    expect(prisma.builderPage.update).not.toHaveBeenCalled();
  });

  it('returns patchedBlocks: [] with no AI call and no credit hold when the page is already fully hand-edited', async () => {
    const websiteStage = { ...doneWebsiteStage(), outputRef: { pageKeyToId: { home: 'page-home' } } };
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([websiteStage])),
    };
    const fullyEditedData = {
      content: [
        {
          type: 'ConstructionHero',
          props: {
            id: 'home-ConstructionHero',
            ...CONSTRUCTION_HERO_HOME,
            d1Slides: CONSTRUCTION_HERO_HOME.d1Slides.map((s) => ({ ...s, headline: 'Edited' })),
          },
        },
        {
          type: 'ConstructionAboutSplit',
          props: { id: 'home-ConstructionAboutSplit', ...CONSTRUCTION_ABOUT_SPLIT, heading: 'Edited heading' },
        },
      ],
    };
    prisma.builderPage = {
      findFirst: vi.fn().mockResolvedValue({ id: 'page-home', data: fullyEditedData }),
      update: vi.fn(),
    };
    

    const result = await generateWebsiteCopy('run-1', 'proj-A', 'user-1');

    expect(result).toEqual({ patchedBlocks: [] });
    // Bails out before even reading intake fields — no wasted DB round trip.
    expect(readIdentity).not.toHaveBeenCalled();
    expect(requestWebsiteCopy).not.toHaveBeenCalled();
    expect(withCreditHold).not.toHaveBeenCalled();
    expect(prisma.builderPage.update).not.toHaveBeenCalled();
  });
});
