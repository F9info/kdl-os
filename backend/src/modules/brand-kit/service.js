// Brand-Kit service — state machine, logo intake, palette extraction, contrast
// report, fallback inference, approval gate, and token payload hand-off.
//
// State machine: draft → extracted → inferred → approved
//   logo upload resets to draft (§1.3)
//   reopen steps approved → inferred
//
// Decisions enforced here:
//   D-BK-1  derived -text variant; never mutate stored brand colour
//   D-BK-3  AA guaranteed
//   D-BK-4  OKLCH ramps
//   D-BK-5  retain original bytes in object storage (non-servable), 90-day expiry
//   D-BK-6  tokens endpoint only; never write to theme-engine

import { createHash, randomUUID } from 'crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { prisma } from '../../config/database.js';
import * as storageService from '../../shared/services/storage.service.js';
import { uploadMedia } from '../media/service.js';
import { sanitizeSvg, isSvgMime } from '../media/svg-sanitizer.js';
import { getUploadSettings } from '../media/settings.js';
import { enqueueScanJob } from '../media/media.queue.js';
import { extractPalette, hueNameFor } from './palette.js';
import { buildContrastReport } from './contrast.js';
import { buildTokenPayload } from './tokens.js';
import { BRAND_INFERENCE_COST, COLLATERAL_EXPORT_COST } from './costs.js';
import { withCreditHold } from '../credits/service.js';
import { aiServicesConfigured, requestBrandInference } from './ai-client.js';
import { buildGuidelinesPdf } from './guidelines.js';
import { setGlobalLogo } from '../setting-fields/service.js';
import { enqueueSiteBuild } from '../template-engine/site/queue.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Constants ───────────────────────────────────────────────────────────────

const OWNER_MODULE = 'brand-kit';
const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5 MB (stricter than media default)
const MIN_LOGO_SHORT_EDGE = 64;
const MAX_LOGO_LONG_EDGE = 8192;
const MAX_LOGO_MEGAPIXELS = 40;
const RASTER_SIZE = 1024;
const EXTRACT_THUMB_SIZE = 128;
const SVG_MAX_BYTES_AFTER_SANITIZE = 1024 * 1024; // 1 MB
const SVG_MAX_NODES = 20000;
const ORIGINAL_RETENTION_DAYS = 90;

const ALLOWED_LOGO_MIMES = new Set([
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const err = (msg, status, code) => Object.assign(new Error(msg), { status, code });

const countSvgNodes = (buf) => {
  const text = buf.toString('utf8');
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf('<', pos)) !== -1) {
    if (text[pos + 1] !== '?' && text[pos + 1] !== '!') count++;
    pos++;
    if (count > SVG_MAX_NODES) break;
  }
  return count;
};

const loadInferenceRules = async () => {
  const raw = await readFile(join(__dirname, 'data/inference-rules.json'), 'utf8');
  return JSON.parse(raw);
};

const applyFallbackInference = async (industry) => {
  const { rules } = await loadInferenceRules();
  const term = (industry ?? '').toLowerCase();
  const matched = rules.find(
    (r) => r.industry[0] !== '__default__' &&
      r.industry.some((kw) => term.includes(kw))
  );
  const rule = matched ?? rules.find((r) => r.industry[0] === '__default__');
  return { typography: rule.typography, tone: rule.tone };
};

// ─── getOrCreate ─────────────────────────────────────────────────────────────

export const getOrCreateKit = async (projectId) => {
  let kit = await prisma.brandKit.findUnique({ where: { project_id: projectId } });
  if (!kit) {
    kit = await prisma.brandKit.create({ data: { project_id: projectId } });
  }
  return kit;
};

export const getKit = async (projectId) => {
  const kit = await prisma.brandKit.findUnique({ where: { project_id: projectId } });
  if (!kit) throw err('Brand kit not found', 404, 'NO_KIT');
  return kit;
};

// ─── Logo upload ──────────────────────────────────────────────────────────────
// §1 — reuses existing media module for validation, sanitization, and scan.
// D-BK-5 — retains original bytes in MinIO under a private path.

export const uploadLogo = async (projectId, file, userId) => {
  // 1. MIME allowlist (brand-kit stricter than media default)
  if (!ALLOWED_LOGO_MIMES.has(file.mimetype)) {
    throw err(`File type not allowed for logos: ${file.mimetype}`, 422, 'LOGO_TYPE_NOT_ALLOWED');
  }

  // 2. Size cap
  if (file.size > MAX_LOGO_BYTES) {
    throw err('Logo exceeds 5 MB limit', 413, 'FILE_TOO_LARGE');
  }

  const { default: sharp } = await import('sharp');

  // 3. Dimension and pixel-bomb guard (raster formats only)
  if (file.mimetype !== 'image/svg+xml') {
    let meta;
    try {
      meta = await sharp(file.buffer, { limitInputPixels: MAX_LOGO_MEGAPIXELS * 1_000_000 }).metadata();
    } catch {
      throw err('Invalid image file', 422, 'LOGO_INVALID');
    }
    const shortEdge = Math.min(meta.width, meta.height);
    const longEdge = Math.max(meta.width, meta.height);
    if (shortEdge < MIN_LOGO_SHORT_EDGE) {
      throw err(`Logo short edge must be ≥ ${MIN_LOGO_SHORT_EDGE}px`, 422, 'LOGO_TOO_SMALL');
    }
    if (longEdge > MAX_LOGO_LONG_EDGE) {
      throw err(`Logo long edge must be ≤ ${MAX_LOGO_LONG_EDGE}px`, 422, 'LOGO_TOO_LARGE');
    }
  }

  // 4. SVG sanitization + structural limits
  let logoBuffer = file.buffer;
  let newOriginalKey = null;
  if (isSvgMime(file.mimetype)) {
    // Run validation BEFORE writing to storage so a rejected upload leaves no orphaned object.
    logoBuffer = sanitizeSvg(file.buffer);

    if (logoBuffer.length > SVG_MAX_BYTES_AFTER_SANITIZE) {
      throw err('SVG exceeds 1 MB after sanitization', 422, 'SVG_TOO_COMPLEX');
    }
    if (countSvgNodes(logoBuffer) > SVG_MAX_NODES) {
      throw err('SVG has too many nodes (max 20,000)', 422, 'SVG_TOO_COMPLEX');
    }

    // D-BK-5: original bytes stored only after passing all validation.
    // Delete any superseded original first (re-upload path) to avoid orphaned objects.
    const existingKit = await prisma.brandKit.findUnique({
      where: { project_id: projectId },
      select: { logo_original_path: true },
    });
    if (existingKit?.logo_original_path) {
      try {
        await storageService.deleteFile(existingKit.logo_original_path);
      } catch {
        // Non-fatal — already deleted or never existed
      }
    }

    newOriginalKey = `brand-kit/originals/${projectId}/${randomUUID()}.svg`;
    await storageService.uploadFile(
      { buffer: file.buffer, mimetype: file.mimetype, originalname: 'original.svg', size: file.buffer.length },
      newOriginalKey,
    );

    file = { ...file, buffer: logoBuffer, size: logoBuffer.length };
  }

  // 5. Upload sanitized logo via the media module (inherits scan + variants)
  const sanitizedFile = { ...file, buffer: logoBuffer, size: logoBuffer.length };
  const mediaRecord = await uploadMedia(
    sanitizedFile,
    userId,
    null,
    { maxBytesOverride: MAX_LOGO_BYTES, visibility: 'SHARED' },
  );
  // Tag as brand-kit owned (KDL-192/197 ownership contract)
  await prisma.media.update({
    where: { id: mediaRecord.id },
    data: { owner_module: OWNER_MODULE },
  });

  // Global admin sidebar/dashboard logo now follows the active project's
  // brand-kit logo — see setGlobalLogo(). This writes to setting-fields
  // (the standalone Application Settings system), not theme-engine, so
  // D-BK-6 ("never write to theme-engine") doesn't apply; best-effort so a
  // setting-fields hiccup never blocks the logo upload itself.
  await setGlobalLogo(mediaRecord.path).catch(() => {});

  // 6. Render 1024 px raster PNG for palette extraction and PDF embedding (§1.3)
  let rasterMediaId = null;
  try {
    let rasterBuf;
    if (isSvgMime(file.mimetype)) {
      rasterBuf = await sharp(logoBuffer, { density: 300 })
        .resize(RASTER_SIZE, RASTER_SIZE, { fit: 'inside', withoutEnlargement: false })
        .png({ compressionLevel: 9 })
        .toBuffer();
    } else {
      rasterBuf = await sharp(logoBuffer)
        .resize(RASTER_SIZE, RASTER_SIZE, { fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toBuffer();
    }

    const rasterFile = {
      buffer: rasterBuf,
      size: rasterBuf.length,
      mimetype: 'image/png',
      originalname: 'logo-raster.png',
    };
    const rasterRecord = await uploadMedia(rasterFile, userId, null, {
      maxBytesOverride: 10 * 1024 * 1024,
      visibility: 'SHARED',
    });
    await prisma.media.update({
      where: { id: rasterRecord.id },
      data: { owner_module: OWNER_MODULE },
    });
    rasterMediaId = rasterRecord.id;
  } catch {
    // Non-fatal — raster generation failure doesn't block the upload
  }

  // 7. Reset kit to draft with new logo, clearing derived fields.
  // Include logo_original_path when an SVG original was stored (newOriginalKey).
  const expiresAt = newOriginalKey
    ? new Date(Date.now() + ORIGINAL_RETENTION_DAYS * 86400_000)
    : null;
  const kit = await prisma.brandKit.upsert({
    where: { project_id: projectId },
    create: {
      project_id: projectId,
      status: 'draft',
      logo_media_id: mediaRecord.id,
      logo_raster_media_id: rasterMediaId,
      logo_original_path: newOriginalKey,
      logo_original_expires_at: expiresAt,
      palette: null,
      contrast_report: null,
      typography: null,
      tone: null,
      inference_source: null,
      fallback_reason: null,
      overridden_fields: [],
      acknowledged_contrast_adjustments: false,
      guidelines_pdf_media_id: null,
    },
    update: {
      status: 'draft',
      logo_media_id: mediaRecord.id,
      logo_raster_media_id: rasterMediaId,
      logo_original_path: newOriginalKey,
      logo_original_expires_at: expiresAt,
      palette: null,
      contrast_report: null,
      typography: null,
      tone: null,
      inference_source: null,
      fallback_reason: null,
      overridden_fields: [],
      acknowledged_contrast_adjustments: false,
      guidelines_pdf_media_id: null,
    },
  });

  return kit;
};

// ─── Palette extraction ───────────────────────────────────────────────────────
// §2 — OKLCH dominant-colour + 10-step ramps + §3 contrast report

export const extractPaletteForKit = async (projectId) => {
  const kit = await getKit(projectId);
  if (!kit.logo_media_id) {
    throw err('Logo must be uploaded before extraction', 409, 'NO_LOGO');
  }
  if (kit.status === 'approved') {
    throw err('Kit is approved. Re-open before modifying.', 409, 'APPROVED_IMMUTABLE');
  }

  // Fetch the raster media record to get the storage path
  const rasterMediaId = kit.logo_raster_media_id ?? kit.logo_media_id;
  const mediaRecord = await prisma.media.findUnique({ where: { id: rasterMediaId } });
  if (!mediaRecord) throw err('Logo media record not found', 404, 'MEDIA_NOT_FOUND');

  // D-BK-3: block unless scan_result is explicitly CLEAN (null = scan still pending).
  // Matches the media module's own gate (media/service.js:348).
  const { requireScan } = await getUploadSettings();
  if (requireScan && mediaRecord.scan_result !== 'CLEAN') {
    throw err('Logo has not passed virus scan', 423, 'SCAN_PENDING');
  }

  const { default: sharp } = await import('sharp');

  // Retrieve the raster buffer from storage via stream → buffer
  const stream = await storageService.getFileStream(mediaRecord.path);
  const fileBuffer = await new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });

  // Downsample to 128×128 for extraction efficiency.
  // ensureAlpha() guarantees a 4-byte RGBA stride for all source formats
  // (JPEG/WebP are 3-channel without it, misaligning the pixel loop in palette.js).
  const thumbBuf = await sharp(fileBuffer)
    .resize(EXTRACT_THUMB_SIZE, EXTRACT_THUMB_SIZE, { fit: 'cover' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const imageData = {
    data: new Uint8Array(thumbBuf.data),
    width: thumbBuf.info.width,
    height: thumbBuf.info.height,
  };

  const palette = extractPalette(imageData);
  const contrastReport = buildContrastReport(palette);

  const updated = await prisma.brandKit.update({
    where: { project_id: projectId },
    data: {
      status: 'extracted',
      palette,
      contrast_report: contrastReport,
    },
  });

  enqueueSiteBuild(projectId);
  return updated;
};

// ─── Inference ────────────────────────────────────────────────────────────────
// Phase 2 (KDL-510): AI-first via POST /api/ai/brand-inference (two-brain
// HIGH → Claude, D-BK-2), metered through the credits reserve → settle hold
// lifecycle at BRAND_INFERENCE_COST. AI failure at any layer degrades to
// inference_source: 'fallback' — never an HTTP error (§4.4/§5). Fallback
// results settle at 0 µc (never meterable, §7). Idempotent re-run allowed:
// a later call upgrades a fallback kit to a real one.

const paletteSummaryFromKit = (kit) => {
  const primary = kit.palette?.colors?.primary;
  const neutral = kit.palette?.colors?.neutral;
  return {
    primaryHex: primary?.hex ?? '#4a4a4a',
    neutralHex: neutral?.hex ?? '#6b6b6b',
    chroma: primary?.oklch?.[1] ?? 0,
    hueName: hueNameFor(primary?.oklch?.[2] ?? null, primary?.oklch?.[1] ?? 0),
  };
};

// Transport failures to ai-services map onto the §4.4 codes the schema already
// persists: not wired → F1_NO_KEY, rejected credentials → F2_AUTH, no/invalid
// response → F3_TIMEOUT.
const localFallback = async (industry, fallbackReason) => {
  const { typography, tone } = await applyFallbackInference(industry);
  return { typography, tone, source: 'fallback', fallbackReason };
};

const runInference = async (kit, { projectId, industry, companyName, tagline, locale }) => {
  let envelope;
  try {
    envelope = await requestBrandInference({
      projectId,
      companyName: companyName?.trim() || `Project ${projectId}`,
      industry: industry?.trim() || 'general',
      ...(tagline ? { tagline } : {}),
      ...(locale ? { locale } : {}),
      paletteSummary: paletteSummaryFromKit(kit),
    });
  } catch (aiErr) {
    const code = aiErr.code === 'AI_AUTH' ? 'F2_AUTH' : 'F3_TIMEOUT';
    return { result: await localFallback(industry, code), actualMc: 0n, usage: null };
  }

  if (envelope.source === 'ai') {
    return {
      result: {
        typography: envelope.typography,
        tone: envelope.tone,
        source: 'ai',
        fallbackReason: null,
      },
      actualMc: BigInt(BRAND_INFERENCE_COST),
      usage: {
        provider: 'anthropic',
        model: envelope.model,
        inputTokens: envelope.usage?.input_tokens ?? 0,
        outputTokens: envelope.usage?.output_tokens ?? 0,
        costUsd: envelope.estimatedCostUsd ?? 0,
      },
    };
  }

  // Endpoint degraded internally (F1..F7) — complete kit, never billable.
  return {
    result: {
      typography: envelope.typography,
      tone: envelope.tone,
      source: 'fallback',
      fallbackReason: envelope.fallbackReason,
    },
    actualMc: 0n,
    usage: null,
  };
};

export const inferBrandKit = async (
  projectId,
  { industry, companyName, tagline, locale, idempotencyKey, userId } = {},
) => {
  const kit = await getKit(projectId);
  if (kit.status === 'draft') {
    throw err('Kit must be extracted before inference', 409, 'NOT_EXTRACTED');
  }
  if (kit.status === 'approved') {
    throw err('Kit is approved. Re-open before modifying.', 409, 'APPROVED_IMMUTABLE');
  }

  let outcome;
  if (!aiServicesConfigured()) {
    // AI path not wired — pure fallback, credits never touched.
    outcome = await localFallback(industry, 'F1_NO_KEY');
  } else {
    try {
      outcome = await withCreditHold(
        {
          projectId,
          actorId: userId ?? null,
          source: 'brand.inference',
          estimateMc: BigInt(BRAND_INFERENCE_COST),
          // X-Idempotency-Key passed verbatim; absent means generate internally.
          idempotencyKey: idempotencyKey ?? randomUUID(),
        },
        () => runInference(kit, { projectId, industry, companyName, tagline, locale }),
      );
    } catch (creditErr) {
      if (creditErr.code === 'INSUFFICIENT_CREDITS') {
        // The budget gate refused the call — degrade, don't error (§4.4 F5).
        outcome = await localFallback(industry, 'F5_BUDGET');
      } else {
        throw creditErr;
      }
    }
  }

  const updated = await prisma.brandKit.update({
    where: { project_id: projectId },
    data: {
      status: 'inferred',
      inference_source: outcome.source,
      fallback_reason: outcome.fallbackReason,
      typography: outcome.typography,
      tone: outcome.tone,
    },
  });

  enqueueSiteBuild(projectId);
  return updated;
};

// ─── PATCH overrides ──────────────────────────────────────────────────────────

const PATCHABLE_FIELDS = new Set(['typography', 'tone', 'palette']);

export const patchKit = async (projectId, overrides) => {
  const kit = await getKit(projectId);
  if (kit.status === 'approved') {
    throw err('Kit is approved. Use /reopen to modify.', 409, 'APPROVED_IMMUTABLE');
  }

  // Whitelist — never spread raw overrides into Prisma; only PATCHABLE_FIELDS may be written.
  const safeData = Object.fromEntries(
    Object.entries(overrides).filter(([k]) => PATCHABLE_FIELDS.has(k)),
  );
  const patchedNames = Object.keys(safeData);
  const overriddenFields = [...new Set([...kit.overridden_fields, ...patchedNames])];

  const updated = await prisma.brandKit.update({
    where: { project_id: projectId },
    data: { ...safeData, overridden_fields: overriddenFields },
  });

  enqueueSiteBuild(projectId);
  return updated;
};

// ─── Approve ──────────────────────────────────────────────────────────────────
// Requires acknowledgment of every contrastReport.adjustments[] entry (§3.3 + D-BK-1).

export const approveKit = async (projectId, { acknowledgedAdjustmentIds = [] } = {}) => {
  const kit = await getKit(projectId);

  if (kit.status !== 'inferred') {
    throw err('Kit must be inferred before approval', 409, 'NOT_INFERRED');
  }

  const adjustments = kit.contrast_report?.adjustments ?? [];
  const requiredIds = adjustments.map((a) => a.id);
  const unacknowledged = requiredIds.filter((id) => !acknowledgedAdjustmentIds.includes(id));
  if (unacknowledged.length > 0) {
    throw err(
      `Must acknowledge all contrast adjustments before approving. Unacknowledged: ${unacknowledged.join(', ')}`,
      409,
      'UNACKNOWLEDGED_CONTRAST',
    );
  }

  const updated = await prisma.brandKit.update({
    where: { project_id: projectId },
    data: {
      status: 'approved',
      acknowledged_contrast_adjustments: true,
      approved_at: new Date(),
    },
  });

  enqueueSiteBuild(projectId);
  return updated;
};

// ─── Reopen (approved → inferred) ────────────────────────────────────────────

export const reopenKit = async (projectId) => {
  const kit = await getKit(projectId);
  if (kit.status !== 'approved') {
    throw err('Only approved kits can be reopened', 409, 'NOT_APPROVED');
  }
  return prisma.brandKit.update({
    where: { project_id: projectId },
    data: {
      status: 'inferred',
      approved_at: null,
      acknowledged_contrast_adjustments: false,
    },
  });
};

// ─── Tokens ───────────────────────────────────────────────────────────────────
// D-BK-6: brand-kit only exposes the payload; orchestrator writes to theme-engine.

export const getTokens = async (projectId, platform = 'webapp') => {
  const kit = await getKit(projectId);
  if (kit.status !== 'approved') {
    throw err('Kit must be approved before tokens are available', 409, 'NOT_APPROVED');
  }

  // Resolve the real Type UUID for ${platform}.brand-kit.
  // theme-engine rejects type_id values that aren't real UUIDs or whose slug
  // doesn't start with `${platform}.` — passing a plain string literal fails.
  const brandKitType = await prisma.type.findFirst({
    where: { slug: `${platform}.brand-kit`, is_active: true },
    select: { id: true },
  });
  if (!brandKitType) {
    throw err(
      `Theme-engine type "${platform}.brand-kit" not found — run the brand-kit seed`,
      409,
      'TYPE_NOT_SEEDED',
    );
  }

  return buildTokenPayload(kit, platform, brandKitType.id);
};

// ─── Brand-guidelines PDF render (KDL-537) ───────────────────────────────────

const GUIDELINES_PDF_ESTIMATE_MC = BigInt(COLLATERAL_EXPORT_COST) * 1_000_000n;

function guidelinesErr(msg, status, code) {
  return Object.assign(new Error(msg), { status, code });
}

export const renderGuidelines = async (projectId, { idempotencyKey, actorId } = {}) => {
  const kit = await getKit(projectId);
  if (kit.status !== 'approved') {
    throw guidelinesErr('Kit must be approved before rendering guidelines', 409, 'NOT_APPROVED');
  }

  // Crash recovery (D-BK-7): prior render already stored — return without re-billing.
  if (kit.guidelines_pdf_media_id) {
    return { renderId: kit.guidelines_pdf_media_id, fileUrl: kit.guidelines_pdf_media_id, bytes: null };
  }

  const iKey = idempotencyKey ?? `brand-kit:guidelines:${projectId}:${randomUUID()}`;

  return withCreditHold(
    {
      projectId,
      actorId: actorId ?? null,
      source: 'brand-kit:guidelines',
      estimateMc: GUIDELINES_PDF_ESTIMATE_MC,
      idempotencyKey: iKey,
    },
    async () => {
      const pdfBuffer = await buildGuidelinesPdf(kit);
      const fileKey = `brand-kit/guidelines/${projectId}/${randomUUID()}.pdf`;
      await storageService.uploadFile(
        { buffer: pdfBuffer, mimetype: 'application/pdf', originalname: 'brand-guidelines.pdf', size: pdfBuffer.length },
        fileKey,
      );
      await prisma.brandKit.update({
        where: { project_id: projectId },
        data: { guidelines_pdf_media_id: fileKey },
      });
      return {
        result: { renderId: fileKey, fileUrl: fileKey, bytes: pdfBuffer.length },
        actualMc: GUIDELINES_PDF_ESTIMATE_MC,
        usage: null,
      };
    },
  );
};

// ─── Cleanup: expired original SVG bytes (D-BK-5) ────────────────────────────
// Called by a scheduled job or the media expiry worker.

export const deleteExpiredOriginals = async () => {
  const expired = await prisma.brandKit.findMany({
    where: {
      logo_original_path: { not: null },
      logo_original_expires_at: { lte: new Date() },
    },
    select: { id: true, project_id: true, logo_original_path: true },
  });

  for (const kit of expired) {
    try {
      await storageService.deleteFile(kit.logo_original_path);
    } catch {
      // Non-fatal if already deleted
    }
    await prisma.brandKit.update({
      where: { id: kit.id },
      data: { logo_original_path: null, logo_original_expires_at: null },
    });
  }

  return expired.length;
};
