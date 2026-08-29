/**
 * Stage driver registry — template-engine orchestrator (KDL-501 / KDL-509).
 *
 * Each driver is responsible for calling the downstream module's public API
 * for that stage. Drivers MUST NOT contain business logic — they are thin
 * adapter shims that translate the stage context into a service call and
 * return { outputRef } on success, or throw a named error on failure.
 *
 * Phase 2 wiring status (KDL-509 / KDL-537):
 *   wired: all 9 drivers — intake, palette, inference, approval, guidelines,
 *          collateral, website, preflight, export
 */

import {
  getOrCreateKit,
  extractPaletteForKit,
  inferBrandKit,
  getKit,
  getTokens,
  renderGuidelines,
} from '../../brand-kit/service.js';
import { getCompanyInfo } from '../../brand-kit/contact-fields.js';

import { upsertValues } from '../../theme-engine/service.js';

import {
  listAssets,
  createAsset,
  preflightAsset,
  renderAsset,
} from '../../collateral/service.js';

import { getMediaById } from '../../media/service.js';

import { createPage, getPage, getPageBySlug } from '../../page-builder/service.js';
import {
  seedWebsitePageData,
  seedMedicalPageData,
  seedConstructionPageData,
} from './website-seed-content.js';

import { prisma } from '../../../config/database.js';
import { slugify } from '../../../shared/utils/slug.js';

// Best-effort — a fresh project with no approved brand kit yet still gets
// pages seeded, just with the generic "Your Brand" copy/colors the seed
// content functions already default to.
async function resolveWebsiteBrand(projectId, userId) {
  let kit = null;
  try {
    kit = await getKit(projectId);
  } catch {
    // no brand kit yet
  }

  let companyName = null;
  try {
    companyName = (await getCompanyInfo(projectId)).company_name;
  } catch {
    // contact fields not filled in yet
  }

  let logoUrl = null;
  if (kit?.logo_media_id) {
    try {
      const media = await getMediaById(kit.logo_media_id, userId, { bypass: true });
      logoUrl = media?.url ?? null;
    } catch {
      // logo not servable yet (pending scan, etc.)
    }
  }

  const colors = kit?.palette?.colors ?? {};
  return {
    companyName,
    logoUrl,
    primaryHex: colors.primary?.hex ?? null,
    secondaryHex: colors.secondary?.hex ?? null,
    headingFont: kit?.typography?.heading?.family ?? null,
    bodyFont: kit?.typography?.body?.family ?? null,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function namedErr(msg, status, code) {
  return Object.assign(new Error(msg), { status, code });
}

// Resolves the theme-engine SettingType DB id from the brand-kit token payload's
// type_id string (which is a slug convention, not a raw DB id — see brand-kit/tokens.js).
// Falls back to the raw string so upsertValues returns soft errors rather than throw.
async function resolveThemeTypeId(platform, tokenTypeId) {
  const slug = `${platform}.${tokenTypeId}`;
  const row = await prisma.type.findFirst({ where: { slug }, select: { id: true } });
  return row?.id ?? tokenTypeId;
}

// ── Drivers ───────────────────────────────────────────────────────────────────

/**
 * intake — initialises (or retrieves) the brand-kit for the project.
 * The user fills in company data and uploads the logo via the brand-kit UI
 * before advancing this stage.
 */
const intakeDriver = {
  async execute({ projectId }) {
    const kit = await getOrCreateKit(projectId);
    return { outputRef: { brandKitId: kit.id, status: kit.status } };
  },
};

/**
 * palette — runs deterministic OKLCH palette extraction from the uploaded logo.
 * Prerequisite: logo uploaded via brand-kit UI before advancing this stage.
 */
const paletteDriver = {
  async execute({ projectId }) {
    const kit = await extractPaletteForKit(projectId);
    return { outputRef: { extractedAt: new Date().toISOString(), status: kit.status } };
  },
};

/**
 * inference — runs brand typography/tone inference (rule-table fallback in Phase 1).
 * Phase 2 (KDL-483): will call ai-services POST /api/ai/brand-inference first.
 */
const inferenceDriver = {
  async execute({ projectId }) {
    const kit = await inferBrandKit(projectId, {});
    return {
      outputRef: {
        inferenceSource: kit.inference_source,
        fallbackReason: kit.fallback_reason ?? null,
        status: kit.status,
      },
    };
  },
};

/**
 * approval — verifies the brand-kit is approved, then writes tokens to theme-engine.
 * Crash recovery (§4.1): if tokensWrittenAt is already set, skips the write.
 * The user approves the brand-kit via the brand-kit UI before advancing this stage.
 */
const approvalDriver = {
  async execute({ projectId, userId, stageRecord }) {
    // Crash recovery: exit action already completed; nothing to re-do.
    if (stageRecord?.outputRef?.tokensWrittenAt) {
      return { outputRef: stageRecord.outputRef };
    }

    const kit = await getKit(projectId);
    if (kit.status !== 'approved') {
      throw namedErr('Brand kit must be approved before advancing this stage', 409, 'BRAND_KIT_NOT_APPROVED');
    }

    const approvedAt = stageRecord?.outputRef?.approvedAt ?? new Date().toISOString();

    // Exit action: brand-kit tokens → theme-engine values.
    const tokenPayload = await getTokens(projectId, 'webapp');
    const resolvedTypeId = await resolveThemeTypeId(tokenPayload.platform, tokenPayload.type_id);
    const writeResult = await upsertValues(tokenPayload.platform, resolvedTypeId, tokenPayload.values, userId, { lockedByModule: 'template-engine' });

    return {
      outputRef: {
        approvedAt,
        tokensWrittenAt: new Date().toISOString(),
        tokenErrors: writeResult?.errors ?? null,
      },
    };
  },
};

/**
 * guidelines — renders the brand-guidelines PDF via brand-kit (KDL-537).
 * Crash recovery (D-BK-7): if stageRecord.outputRef.renderId is already set,
 * the prior render succeeded and is reused without re-billing.
 */
const guidelinesDriver = {
  async execute({ projectId, userId, stageRecord }) {
    // Crash recovery: prior attempt already rendered — return immediately.
    if (stageRecord?.outputRef?.renderId) {
      return { outputRef: stageRecord.outputRef };
    }

    const result = await renderGuidelines(projectId, {
      idempotencyKey: `te:${projectId}:guidelines`,
      actorId: userId,
    });

    return {
      outputRef: {
        renderId:   result.renderId,
        fileUrl:    result.fileUrl,
        bytes:      result.bytes,
        renderedAt: new Date().toISOString(),
      },
    };
  },
};

// Asset types to create when no collateral assets exist for the project.
const COLLATERAL_DEFAULT_ASSETS = [
  { type: 'VISITING_CARD', name: 'Visiting card' },
  { type: 'LETTERHEAD',    name: 'Letterhead' },
];

/**
 * collateral — preflights and renders collateral assets for the project.
 * Crash recovery (§4.1): previously recorded renderIds are reused.
 * Per-asset credit holds are managed inside collateral's renderAsset (CREDITS_ARCH §5).
 * Creates default assets if none exist for the project.
 */
const collateralDriver = {
  async execute({ projectId, userId, stageRecord, run }) {
    // Crash recovery: collect already-completed render IDs.
    const priorRenderIds = new Set(stageRecord?.outputRef?.renderIds ?? []);

    // List existing assets; seed defaults if absent.
    let assets = await listAssets(projectId);

    if (assets.length === 0) {
      const approvalOutputRef = run.stages?.find((s) => s.stage === 'APPROVAL')?.outputRef;
      const brandKitVersion = typeof approvalOutputRef?.brandKitVersion === 'number'
        ? approvalOutputRef.brandKitVersion
        : 1;

      for (const { type, name } of COLLATERAL_DEFAULT_ASSETS) {
        await createAsset({ projectId, type, name, brandKitVersion, createdBy: userId });
      }
      assets = await listAssets(projectId);
    }

    if (assets.length === 0) {
      return { outputRef: { renderIds: [], skipped: 'no_assets' } };
    }

    const renderIds = [...priorRenderIds];

    for (const asset of assets) {
      // Skip assets whose most-recent render is already recorded.
      const latestRender = asset.renders?.[0];
      if (latestRender && priorRenderIds.has(latestRender.id)) continue;

      // Preflight — surfaces COLLATERAL_SPEC §8 named errors verbatim (§5).
      const preflight = await preflightAsset(asset.id);
      if (!preflight.ok) {
        throw namedErr(preflight.issues[0].code, 422, preflight.issues[0].code);
      }

      // Render — credit hold is inside renderAsset (CREDITS_ARCH §5).
      const render = await renderAsset(asset.id, {
        format: 'PDF_DIGITAL',
        idempotencyKey: `te:${run.id}:collateral:${asset.id}:PDF_DIGITAL`,
        actorId: userId,
      });

      renderIds.push(render.id);
    }

    return { outputRef: { renderIds } };
  },
};

// Default pages seeded when the run carries no Navigation-step selection
// (older runs, or any caller that skips that step). Slugs are run-scoped to
// prevent cross-run collisions.
const WEBSITE_SEED_PAGES = [
  { key: 'home',    title: 'Home' },
  { key: 'about',   title: 'About' },
  { key: 'contact', title: 'Contact' },
];

// The Navigation step (frontend WebsiteStage.tsx) lets a user pick any of
// ~20 page names — turn that list into the same { key, title } shape
// WEBSITE_SEED_PAGES uses, deriving each page's key from its title so pages
// stay stable across a crash-recovery re-run of the same stage. Falls back
// to the default 3-page set when the caller sends no selection at all.
function resolveSeedPages(navigationPages) {
  if (!Array.isArray(navigationPages) || navigationPages.length === 0) {
    return WEBSITE_SEED_PAGES;
  }
  const keyCounts = new Map();
  return navigationPages.map((title) => {
    const base = slugify(title) || 'page';
    const count = (keyCounts.get(base) ?? 0) + 1;
    keyCounts.set(base, count);
    const key = count === 1 ? base : `${base}-${count}`;
    return { key, title };
  });
}

// KDL-558 task 4/5 — the Web app Templates step's pack choice (general/
// medical/construction), sent as advance's optional `templatePack` body
// field, picks which seeder builds each page's starter content.
const SEEDER_BY_PACK = {
  general: seedWebsitePageData,
  medical: seedMedicalPageData,
  construction: seedConstructionPageData,
};

/**
 * website — seeds pages from Puck component packs via page-builder, with
 * real default content (seedWebsitePageData/seedMedicalPageData/
 * seedConstructionPageData) so a fresh page isn't a blank canvas.
 * Crash recovery: recorded pageKeyToId is checked on re-run; existing pages are reused.
 */
const websiteDriver = {
  async execute({ run, stageRecord, userId, templatePack, navigationPages }) {
    const seed = SEEDER_BY_PACK[templatePack] ?? seedWebsitePageData;
    const brand = await resolveWebsiteBrand(run.projectId, userId);

    // Crash recovery (TEMPLATE_ENGINE_ARCH §4.1): reuse pages from a prior attempt.
    const priorMap = stageRecord?.outputRef?.pageKeyToId ?? {};
    const pageKeyToId = {};
    // The frontend's page grid displays this real title — before
    // navigationPages existed every key WAS its title lowercased ('home' ->
    // 'Home'), so no one noticed the grid was deriving a label from the key
    // instead of storing the actual title anywhere. Multi-word/acronym
    // titles ('Service detail', 'FAQ') expose that: slugified back they'd
    // render 'Service-detail'/'Faq', not the title the user actually typed.
    const pageKeyToTitle = {};
    const pageIds = [];
    const seedPages = resolveSeedPages(navigationPages);

    for (const { key, title } of seedPages) {
      const slug = `te-${run.id}-${key}`;
      const priorId = priorMap[key];
      let existing = null;
      if (priorId) {
        existing = await getPage(priorId).catch(() => null);
      }
      // Crash-recovery gap: if a PRIOR advance attempt created this exact
      // page (slugs are deterministic per run+key) but then threw on a
      // LATER key before the stage's outputRef was ever saved, this key
      // vanishes from priorMap even though its slug is permanently taken —
      // a blind createPage() would then unique-constraint-crash on every
      // future retry, forever. Look it up by its own slug before creating.
      if (!existing) {
        existing = await getPageBySlug(slug).catch(() => null);
      }

      // Every page's own nav/footer links to every OTHER page in this same
      // run (seedPages) — not just Home/About/Contact — so "View all pages"
      // can actually step through everything just assembled.
      const page = existing ?? await createPage(
        { title, slug, data: seed(key, title, brand, seedPages) },
        userId,
      );

      pageKeyToId[key] = page.id;
      pageKeyToTitle[key] = title;
      pageIds.push(page.id);
    }

    return {
      outputRef: {
        pageIds,
        pageKeyToId,
        pageKeyToTitle,
        seededAt: new Date().toISOString(),
      },
    };
  },
};

/**
 * preflight — aggregates per-branch named errors. No downstream call.
 * Surfaces COLLATERAL_SPEC §8 error codes verbatim (§5).
 */
const preflightDriver = {
  async execute({ run }) {
    const stageMap = Object.fromEntries(run.stages.map((s) => [s.stage, s]));
    const errors = [];

    for (const branch of ['GUIDELINES', 'COLLATERAL', 'WEBSITE']) {
      const s = stageMap[branch];
      if (s?.status === 'FAILED' && s.errorCode) {
        errors.push({ stage: branch, errorCode: s.errorCode });
      }
    }

    if (errors.length > 0) {
      throw Object.assign(new Error('PREFLIGHT_FAILED'), {
        status: 409,
        code: 'PREFLIGHT_FAILED',
        errors,
      });
    }

    return { outputRef: { checkedAt: new Date().toISOString(), errors: [] } };
  },
};

/**
 * export — produces the handoff manifest.
 * Reads outputRefs from GUIDELINES, COLLATERAL, WEBSITE stages.
 * No downstream call — pure read + manifest construction.
 */
const exportDriver = {
  async execute({ run }) {
    const stageMap = Object.fromEntries(run.stages.map((s) => [s.stage, s]));
    return {
      outputRef: {
        manifestAt: new Date().toISOString(),
        guidelinesRef: stageMap['GUIDELINES']?.outputRef ?? null,
        collateralRef:  stageMap['COLLATERAL']?.outputRef ?? null,
        websiteRef:     stageMap['WEBSITE']?.outputRef ?? null,
      },
    };
  },
};

const DRIVERS = {
  intake:     intakeDriver,
  palette:    paletteDriver,
  inference:  inferenceDriver,
  approval:   approvalDriver,
  guidelines: guidelinesDriver,
  collateral: collateralDriver,
  website:    websiteDriver,
  preflight:  preflightDriver,
  export:     exportDriver,
};

export function getDriver(stageSlug) {
  const driver = DRIVERS[stageSlug];
  if (!driver) {
    throw Object.assign(new Error(`No driver registered for stage: ${stageSlug}`), { status: 500 });
  }
  return driver;
}
