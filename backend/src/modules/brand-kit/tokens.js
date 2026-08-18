// Token payload builder for brand-kit → theme-engine hand-off.
//
// Decision D-BK-6: brand-kit NEVER writes theme tokens itself.
// This module shapes the payload for GET /api/brand-kit/:projectId/tokens
// so the orchestrator (KDL-453) can forward it verbatim to
// POST /api/theme-engine/values.
//
// The output matches the postValuesBodySchema in theme-engine/schema.js:
//   { platform, type_id, values: [{ field_id, value }] }
//
// field_id conventions follow the theme-engine's existing SettingField slugs.
// If the slug does not yet exist in the DB the orchestrator's POST will 422 —
// that is intentional: brand-kit outputs tokens, theme-engine owns the schema.

const PLATFORM_DEFAULT = 'webapp';

// Map OKLCH ramp to theme-engine CSS variable slugs.
// Naming: brand-kit-{role}-{step} — prefixed to avoid collisions with
// manually-created theme fields.

const rampToValues = (role, ramp, adjustments = []) => {
  const values = Object.entries(ramp).map(([step, hex]) => ({
    field_id: `brand-kit-${role}-${step}`,
    value: hex,
  }));

  // Emit derived -text variant when contrast report has an adjustment for this role
  for (const adj of adjustments) {
    if (adj.tokenName === `${role}-text`) {
      values.push({ field_id: `brand-kit-${role}-text`, value: adj.derived });
    }
  }

  return values;
};

export const buildTokenPayload = (kit, platform = PLATFORM_DEFAULT) => {
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
  if (primary?.hex) values.push({ field_id: 'brand-kit-primary-hex', value: primary.hex });
  if (secondary?.hex) values.push({ field_id: 'brand-kit-secondary-hex', value: secondary.hex });
  if (accent?.hex) values.push({ field_id: 'brand-kit-accent-hex', value: accent.hex });
  if (neutral?.hex) values.push({ field_id: 'brand-kit-neutral-hex', value: neutral.hex });

  // Typography tokens (populated by Phase 2 AI inference)
  if (kit.typography) {
    const { heading, body } = kit.typography;
    if (heading?.family) values.push({ field_id: 'brand-kit-font-heading', value: heading.family });
    if (body?.family) values.push({ field_id: 'brand-kit-font-body', value: body.family });
    if (kit.typography.scaleRatio) {
      values.push({ field_id: 'brand-kit-type-scale-ratio', value: String(kit.typography.scaleRatio) });
    }
  }

  // type_id: the theme-engine type that owns brand-kit setting fields.
  // Convention: 'brand-kit' — orchestrator must ensure this type exists.
  return {
    platform,
    type_id: 'brand-kit',
    values,
  };
};
