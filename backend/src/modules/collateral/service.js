// Collateral service — COLLATERAL_SPEC.md §5, §6, §7.
// Layer 2 Studio-surface module; consumes brand-kit output.

import { randomUUID } from 'crypto';
import { prisma } from '../../config/database.js';
import { withCreditHold } from '../credits/service.js';
import { getCompanyInfo } from '../brand-kit/contact-fields.js';
import { runPreflight } from './preflight.js';
import { renderArtifact } from './render/index.js';

// Render cost estimate: 5 credits × 1_000_000 µc per credit.
const COLLATERAL_RENDER_ESTIMATE_MC = 5_000_000n;
const COLLATERAL_RENDER_CREDITS_COST = 5;

// ── Brand-kit resolver ────────────────────────────────────────────────────────
// Reads the brand-kit for a project and maps live DB columns to the shape
// expected by preflight and the render layer. version arg is advisory —
// collateral pins the version at asset creation time.
// company is sourced from the projects module (KDL-583; Project.name is non-nullable).
export async function resolveBrandKit(projectId, _version) {
  try {
    const { prisma: db } = await import('../../config/database.js');
    const kit = await db.brandKit.findUnique({ where: { project_id: projectId } });
    if (!kit) return null;

    // Project lookup is best-effort — a missing/erroring project must not hard-fail a render.
    let project = null;
    try {
      project = await db.project.findUnique({ where: { id: projectId } });
    } catch {
      // swallow — company fields will be absent; preflight will reject if required
    }

    // Contact fields (KDL-558 row 1) are best-effort too — never block a render.
    let contact = {};
    try {
      contact = await getCompanyInfo(projectId);
    } catch {
      // swallow — falls back to project.name below, same as before this field existed
    }

    const colors = kit.palette?.colors ?? {};
    const primary = colors.primary;
    const neutral  = colors.neutral;

    return {
      logo: {
        primaryUrl: kit.logo_media_id ? `/api/media/${kit.logo_media_id}` : null,
        minWidthMm: 0,
      },
      palette: {
        primary:   primary?.ramp ? Object.values(primary.ramp) : (primary?.hex ? [primary.hex] : []),
        secondary: colors.secondary?.hex ? [colors.secondary.hex] : [],
        neutral:   neutral?.hex ? [neutral.hex] : [],
        onPrimary: '#ffffff',
        onSurface: neutral?.ramp?.[900] ?? '#202124',
      },
      typography: {
        heading:    kit.typography?.heading    ?? null,
        body:       kit.typography?.body       ?? null,
        scaleRatio: kit.typography?.scaleRatio ?? null,
      },
      company: (project || contact.company_name)
        ? {
            displayName: contact.company_name || project?.name,
            legalName:   contact.company_name || project?.name,
            email:        contact.email || undefined,
            phone:        contact.phone || undefined,
            addressLines: contact.addressLines?.length ? contact.addressLines : undefined,
          }
        : {},
    };
  } catch {
    return null;
  }
}

// Default spec seeded when creating an asset (§7 POST /assets).
function defaultSpec(type, brandKit) {
  const base = {
    bgColor:    brandKit?.palette?.primary?.[0] ?? '#ffffff',
    textColor:  brandKit?.palette?.onSurface    ?? '#000000',
    logoWidthMm: 20,
    zones: [],
  };
  if (type === 'TSHIRT') base.printPath = 'dtg';
  return base;
}

// ── Asset CRUD ────────────────────────────────────────────────────────────────

export async function createAsset({ projectId, type, name, brandKitVersion, createdBy }) {
  const brandKit = await resolveBrandKit(projectId, brandKitVersion);
  const spec = defaultSpec(type, brandKit);

  return prisma.collateralAsset.create({
    data: {
      project_id:        projectId,
      type,
      name,
      brand_kit_version: brandKitVersion,
      spec,
      created_by:        createdBy,
    },
  });
}

export async function listAssets(projectId) {
  return prisma.collateralAsset.findMany({
    where:   { project_id: projectId, status: { not: 'ARCHIVED' } },
    orderBy: { created_at: 'desc' },
    include: { renders: { orderBy: { created_at: 'desc' }, take: 1 } },
  });
}

export async function getAsset(id) {
  const asset = await prisma.collateralAsset.findUnique({
    where:   { id },
    include: { renders: { orderBy: { created_at: 'desc' } } },
  });
  if (!asset || asset.status === 'ARCHIVED') {
    throw Object.assign(new Error('Collateral asset not found'), { status: 404 });
  }
  return asset;
}

export async function updateAsset(id, { spec, name }) {
  const asset = await getAsset(id);
  const updates = {};
  if (spec !== undefined) updates.spec = { ...(asset.spec ?? {}), ...spec };
  if (name !== undefined) updates.name = name;
  return prisma.collateralAsset.update({ where: { id }, data: updates });
}

export async function archiveAsset(id) {
  await getAsset(id);
  return prisma.collateralAsset.update({ where: { id }, data: { status: 'ARCHIVED' } });
}

// ── Preflight ─────────────────────────────────────────────────────────────────

export async function preflightAsset(id) {
  const asset = await getAsset(id);
  const brandKit = await resolveBrandKit(asset.project_id, asset.brand_kit_version);
  return runPreflight({ asset, brandKit });
}

// ── Render ────────────────────────────────────────────────────────────────────

export async function renderAsset(id, { format, variant, idempotencyKey, actorId }) {
  const asset = await getAsset(id);
  const brandKit = await resolveBrandKit(asset.project_id, asset.brand_kit_version);

  // Preflight gate (non-credits checks first).
  const pre = runPreflight({ asset, brandKit, creditsOk: true });
  if (!pre.ok) {
    const err = new Error(pre.issues[0].code);
    err.code = pre.issues[0].code;
    err.issues = pre.issues;
    err.status = 422;
    throw err;
  }

  const iKey = idempotencyKey ?? `collateral:render:${id}:${format}:${variant ?? ''}:${randomUUID()}`;

  const renderResult = await withCreditHold(
    {
      projectId:      asset.project_id,
      actorId:        actorId ?? null,
      source:         'collateral:render',
      estimateMc:     COLLATERAL_RENDER_ESTIMATE_MC,
      idempotencyKey: iKey,
    },
    async () => {
      const rendered = await renderArtifact(asset, brandKit, format, variant ?? null);

      // Store the file. In v1, we store as base64 in a data URL since we have no
      // per-call storage path. Production: write via storageService.
      // File URL encodes format + checksum for addressability.
      const fileUrl = `collateral/${asset.project_id}/${id}/${format}_${rendered.checksum.slice(0, 8)}.${rendered.extension}`;

      const render = await prisma.collateralRender.create({
        data: {
          asset_id:          id,
          format,
          variant:           variant ?? null,
          file_url:          fileUrl,
          bytes:             rendered.bytes,
          checksum:          rendered.checksum,
          brand_kit_version: asset.brand_kit_version,
          credits_cost:      COLLATERAL_RENDER_CREDITS_COST,
        },
      });

      // Attach the buffer so the caller can stream it without re-rendering.
      render._buffer = rendered.buffer;
      render._mimeType = rendered.mimeType;

      // Mark asset READY on first successful render.
      if (asset.status === 'DRAFT') {
        await prisma.collateralAsset.update({ where: { id }, data: { status: 'READY' } });
      }

      return { result: render, actualMc: COLLATERAL_RENDER_ESTIMATE_MC, usage: null };
    },
  );

  return renderResult;
}

// ── Download ──────────────────────────────────────────────────────────────────

export async function getRender(renderId) {
  const render = await prisma.collateralRender.findUnique({
    where:   { id: renderId },
    include: { asset: true },
  });
  if (!render) {
    throw Object.assign(new Error('Render not found'), { status: 404 });
  }
  return render;
}
