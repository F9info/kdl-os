/**
 * Stage driver registry — template-engine orchestrator (KDL-501).
 *
 * Each driver is responsible for calling the downstream module's public API
 * for that stage. Drivers MUST NOT contain business logic — they are thin
 * HTTP adapter shims that translate the stage context into an API call and
 * return { outputRef } on success, or throw a named error on failure.
 *
 * Phase 1 note: brand-kit, collateral, and credits are not yet built. All
 * drivers that call those modules throw UPSTREAM_NOT_BUILT (503) so the DAG
 * state machine and gating logic can be tested independently of the upstream
 * build status. Replace each stub with a real HTTP call once the module ships.
 *
 * theme-engine and page-builder ARE built; their drivers make real calls.
 */

function notBuilt(stageName) {
  const err = new Error(`UPSTREAM_NOT_BUILT — ${stageName} driver's upstream module is not yet built (KDL-501 Phase 1 stub)`);
  err.status = 503;
  err.code = 'UPSTREAM_NOT_BUILT';
  return err;
}

/**
 * intake — calls brand-kit intake API.
 * Accepts: company name, industry, tagline, logo upload ref.
 * Prerequisite: brand-kit module (KDL-451) built.
 */
const intakeDriver = {
  async execute() { throw notBuilt('intake'); },
};

/**
 * palette — calls brand-kit deterministic palette extraction.
 * Prerequisite: brand-kit module (KDL-451) built.
 */
const paletteDriver = {
  async execute() { throw notBuilt('palette'); },
};

/**
 * inference — calls brand-kit → ai-services brand inference.
 * Prerequisite: brand-kit module (KDL-451) + BRAND_KIT_AI_ARCH.md implementation built.
 */
const inferenceDriver = {
  async execute() { throw notBuilt('inference'); },
};

/**
 * approval — human sign-off stage.
 * Exit action: GET /api/brand-kit/:projectId/tokens → POST /api/theme-engine/values.
 * theme-engine IS built; brand-kit is not yet.
 * Prerequisite: brand-kit module (KDL-451) built.
 */
const approvalDriver = {
  async execute() { throw notBuilt('approval'); },
};

/**
 * guidelines — calls brand-kit brand-guidelines PDF render.
 * Prerequisite: brand-kit module (KDL-451) built.
 */
const guidelinesDriver = {
  async execute() { throw notBuilt('guidelines'); },
};

/**
 * collateral — calls collateral module render endpoints.
 * Prerequisite: collateral module (KDL-452) built.
 */
const collateralDriver = {
  async execute() { throw notBuilt('collateral'); },
};

/**
 * website — calls page-builder to seed pages from approved Puck component packs.
 * page-builder IS built; this driver is partially implementable but needs
 * industry-tagged packs (TEMPLATE_ENGINE_ARCH §11 item 2).
 */
const websiteDriver = {
  async execute() { throw notBuilt('website'); },
};

/**
 * preflight — aggregates per-branch named errors. No downstream call.
 * This driver is a pure read-and-aggregate over stage outputRefs.
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
      const err = new Error('PREFLIGHT_FAILED');
      err.status = 409;
      err.code = 'PREFLIGHT_FAILED';
      err.errors = errors;
      throw err;
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
    const err = new Error(`No driver registered for stage: ${stageSlug}`);
    err.status = 500;
    throw err;
  }
  return driver;
}
