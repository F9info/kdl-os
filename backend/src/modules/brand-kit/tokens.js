// Token payload builder for brand-kit → theme-engine hand-off.
//
// Decision D-BK-6: brand-kit NEVER writes theme tokens itself.
// This module shapes the payload for GET /api/brand-kit/:projectId/tokens
// so the orchestrator (KDL-453) can forward it verbatim to
// POST /api/theme-engine/values.
//
// The output matches the postValuesBodySchema in theme-engine/schema.js:
//   { platform, type_id, values: [{ slug, value }] }
//
// Values use `slug` (not `field_id`) — theme-engine resolves `field_id` by UUID
// while `slug` is the human-readable key both services share.  The caller
// (service.js:getTokens) resolves type_id to the real UUID for the
// ${platform}.brand-kit Type.

const PLATFORM_DEFAULT = 'webapp';

// Map OKLCH ramp to theme-engine CSS variable slugs.
// Naming: brand-kit-{role}-{step} — prefixed to avoid collisions with
// manually-created theme fields.

const rampToValues = (role, ramp, adjustments = []) => {
  // Use a Map so that a colour that fails AA on both light and dark surfaces
  // doesn't emit two brand-kit-{role}-text entries — last one wins.
  const bySlug = new Map(
    Object.entries(ramp).map(([step, hex]) => [`brand-kit-${role}-${step}`, hex]),
  );

  for (const adj of adjustments) {
    if (adj.tokenName === `${role}-text`) {
      bySlug.set(`brand-kit-${role}-text`, adj.derived);
    }
  }

  return [...bySlug.entries()].map(([slug, value]) => ({ slug, value }));
};

export const buildTokenPayload = (kit, platform = PLATFORM_DEFAULT, typeId) => {
  const palette = kit.palette;
  const contrastReport = kit.contrast_report ?? { adjustments: [] };
  const adjustments = contrastReport.adjustments ?? [];

  if (!palette?.colors) {
    throw Object.assign(new Error('Palette not extracted'), { status: 409, code: 'NOT_EXTRACTED' });
  }

  const values = [];
  const { primary, secondary, accent, neutral } = palette.colors;

  if (primary?.ramp) values.push(...rampToValues('primary', primary.ramp, adjustments));
  if (secondary?.ramp) values.push(...rampToValues('secondary', secondary.ramp, adjustments));
  if (accent?.ramp) values.push(...rampToValues('accent', accent.ramp, adjustments));
  if (neutral?.ramp) values.push(...rampToValues('neutral', neutral.ramp, adjustments));

  // Brand hex values as direct tokens
  if (primary?.hex) values.push({ slug: 'brand-kit-primary-hex', value: primary.hex });
  if (secondary?.hex) values.push({ slug: 'brand-kit-secondary-hex', value: secondary.hex });
  if (accent?.hex) values.push({ slug: 'brand-kit-accent-hex', value: accent.hex });
  if (neutral?.hex) values.push({ slug: 'brand-kit-neutral-hex', value: neutral.hex });

  // Typography tokens (populated by Phase 2 AI inference)
  if (kit.typography) {
    const { heading, body } = kit.typography;
    if (heading?.family) values.push({ slug: 'brand-kit-font-heading', value: heading.family });
    if (body?.family) values.push({ slug: 'brand-kit-font-body', value: body.family });
    if (kit.typography.scaleRatio) {
      values.push({ slug: 'brand-kit-type-scale-ratio', value: String(kit.typography.scaleRatio) });
    }
  }

  return {
    platform,
    type_id: typeId,
    values,
  };
};
