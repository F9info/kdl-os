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
//
// Below buildTokenPayload, buildThemeColors / buildThemeColorValues /
// buildButtonColorValues derive the Theme Engine's own *semantic* colour fields
// (branding + primary-button text) from the approved palette. Same rule: they are
// pure — the template-engine approval driver is what writes them.

import { contrastRatio, passesAA, deriveTextVariant, bestOnColor } from './contrast.js';

const PLATFORM_DEFAULT = 'webapp';

const assertExtracted = (palette) => {
  if (!palette?.colors) {
    throw Object.assign(new Error('Palette not extracted'), { status: 409, code: 'NOT_EXTRACTED' });
  }
};

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

  assertExtracted(palette);

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

// ─── Brand → semantic theme colours ──────────────────────────────────────────
// Tailwind's primary / secondary / accent / highlight / background / title / body
// classes read the Theme Engine's branding fields, not --brand-kit-*, so these are
// what actually carry an approved brand into the page-builder blocks.

// Theme Engine defaults (theme-engine/schema/index.js, 'branding' pane): what a
// role the brand does not have falls back to.
const THEME_DEFAULTS = {
  light: { primary: '#2119B3', background: '#f2f2f7', text: '#1d1d21', link: '#0a66f0' },
  dark: { primary: '#7468F3', background: '#1e1e20', text: '#f2f2f5', link: '#4f8ef7' },
};

// Neutral-ramp step behind each mode's surface, titles and body text.
const NEUTRAL_STEPS = {
  light: { background: '50', text: '900', body: '700' },
  dark: { background: '900', text: '50', body: '300' },
};

// Dark mode: when the brand colour itself does not read on the dark surface, its
// ramp step is picked from these, in this order.
const DARK_STEPS = ['300', '400', '500'];

const asHex = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : null);

// The palette is user-editable (PATCH /brand-kit), so only trust valid '#rrggbb' steps.
const cleanRamp = (entry) =>
  Object.fromEntries(Object.entries(entry?.ramp ?? {}).filter(([, v]) => asHex(v)));

// Dark-mode colour for a role: the first of ramp 300/400/500 with AA contrast
// (>= 4.5:1) on the dark surface, else the lightest ramp step, else the brand hex.
// A brand colour that already reads on the dark surface is kept as is — otherwise a
// light brand (yellow, anchored at ramp 200) would be darkened to a muddy 300.
const darkVariant = (entry, surface) => {
  const brand = asHex(entry?.hex);
  if (brand && passesAA(brand, surface)) return brand;
  const ramp = cleanRamp(entry);
  const lightest = Object.keys(ramp).sort((a, b) => a - b)[0];
  return DARK_STEPS.map((step) => ramp[step]).find((h) => h && passesAA(h, surface)) ?? ramp[lightest] ?? brand;
};

// `hex` as text on `surface`: itself when it already has AA contrast, else the
// '<role>-text' variant the user acknowledged at approval (D-BK-1) if that still
// reads on this surface, else the nearest ramp step that does.
const readableOn = (hex, surface, mode, ramp, adjustments) => {
  if (passesAA(hex, surface)) return hex;
  const acknowledged = adjustments.find((a) => a.id === `primary-on-${mode}`)?.derived;
  return asHex(acknowledged) && passesAA(acknowledged, surface)
    ? acknowledged
    : deriveTextVariant(hex, surface, ramp);
};

const buildModeColors = (mode, { primary, secondary, accent, neutral }, adjustments) => {
  const defaults = THEME_DEFAULTS[mode];
  const steps = NEUTRAL_STEPS[mode];
  const neutralRamp = cleanRamp(neutral);
  const background = neutralRamp[steps.background] ?? defaults.background;
  const text = neutralRamp[steps.text] ?? defaults.text;

  // Light keeps the brand's own hex; dark takes the ramp step that reads on `background`.
  const role = (entry) => (mode === 'light' ? asHex(entry?.hex) : darkVariant(entry, background));
  const brandPrimary = role(primary);
  const p = brandPrimary ?? defaults.primary;
  const s = role(secondary) ?? p;
  const a = role(accent) ?? s;

  return {
    primary: p,
    secondary: s,
    accent: a,
    highlight: p, // the pack blocks' emphasis colour follows the brand's main colour
    background,
    text,
    body: neutralRamp[steps.body] ?? text,
    link: brandPrimary ? readableOn(p, background, mode, cleanRamp(primary), adjustments) : defaults.link,
  };
};

// → { light, dark }, each { primary, secondary, accent, highlight, background, text, body, link }
// (all '#rrggbb'). A role the palette lacks falls back (secondary → primary, accent →
// secondary, primary / neutral → Theme Engine defaults), so it never throws on a thin palette —
// only on no palette at all.
export const buildThemeColors = (kit) => {
  assertExtracted(kit.palette);
  const adjustments = kit.contrast_report?.adjustments ?? [];
  return {
    light: buildModeColors('light', kit.palette.colors, adjustments),
    dark: buildModeColors('dark', kit.palette.colors, adjustments),
  };
};

// Theme Engine field slug = {platform}.{pane}.{mode}.{section}.{field}, section / field
// lowercased with non-alphanumerics → '_' (theme-engine/seed.js). Each pane is its own Type,
// so each needs its own upsertValues call.
const themeValuesFor = (pane, fields) => (colors, platform = PLATFORM_DEFAULT) =>
  ['light', 'dark'].flatMap((mode) =>
    fields.map(([path, pick]) => ({
      slug: `${platform}.${pane}.${mode}.${path}`,
      value: pick(colors[mode]),
    })),
  );

// Primary-button label: white or near-black #111111 (softer than pure black), whichever reads
// better on `bg`. On the mid-tones where neither reaches AA (4.5:1) — about 3% of brand colours —
// it is bestOnColor's pure white / black instead, which always does.
const onColor = (bg) => {
  const label = contrastRatio('#ffffff', bg) >= contrastRatio('#111111', bg) ? '#ffffff' : '#111111';
  return passesAA(label, bg) ? label : bestOnColor(bg);
};

// buildThemeColors() output → values for the `${platform}.branding` Type.
export const buildThemeColorValues = themeValuesFor('branding', [
  ['brand_colors.primary_color', (c) => c.primary],
  ['brand_colors.secondary_color', (c) => c.secondary],
  ['brand_colors.accent_color', (c) => c.accent],
  ['brand_colors.highlight_color', (c) => c.highlight],
  ['brand_colors.titles_text_color', (c) => c.text],
  ['brand_colors.body_text_color', (c) => c.body ?? c.text],
  ['surfaces.background_color', (c) => c.background],
  ['text_interaction.text_primary', (c) => c.text],
  ['text_interaction.link_color', (c) => c.link ?? c.primary],
]);

// buildThemeColors() output → values for the `${platform}.buttons` Type, so the
// primary button label stays readable on the brand's primary (Tailwind primary-foreground).
// Known gap: the label is chosen against the resting colour only. The hover colour
// (buttons.<mode>.primary_button.hover_color, and Text & Interaction > Hover Color) keeps the
// Theme Engine's stock blue, so a branded <Button> turns blue on hover under that label.
// Deriving a hover that keeps the label readable is a follow-up, not part of this write.
export const buildButtonColorValues = themeValuesFor('buttons', [
  ['primary_button.text_color', (c) => onColor(c.primary)],
]);
