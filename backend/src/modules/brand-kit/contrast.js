// WCAG 2.1 AA contrast checking and derived -text variant generation.
// Decision D-BK-1: never mutate the stored brand colour; emit a derived
// `*-text` variant (nearest passing ramp step) when the brand colour fails AA.
//
// §3.1: AA = 4.5:1 normal text, 3:1 large text/UI components.
// For any opaque background, black or white text always achieves AA — so
// on-ramp text is guaranteed by choosing the better of the two.

import { hexToRgb, srgbToOklch, rgbToHex } from './palette.js';

// ─── WCAG relative luminance ─────────────────────────────────────────────────

const linearizeWcag = (c8) => {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

export const relativeLuminance = (hex) => {
  const [r, g, b] = hexToRgb(hex);
  const R = linearizeWcag(r);
  const G = linearizeWcag(g);
  const B = linearizeWcag(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

export const contrastRatio = (hex1, hex2) => {
  const L1 = relativeLuminance(hex1);
  const L2 = relativeLuminance(hex2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
};

export const passesAA = (fgHex, bgHex, largeText = false) =>
  contrastRatio(fgHex, bgHex) >= (largeText ? 3 : 4.5);

// ─── Best on-colour text (black or white) ────────────────────────────────────
// Always picks the option with higher contrast — guaranteed to pass AA (§3.1).

export const bestOnColor = (bgHex) => {
  const rW = contrastRatio('#ffffff', bgHex);
  const rB = contrastRatio('#000000', bgHex);
  return rW >= rB ? '#ffffff' : '#000000';
};

// ─── Derive -text variant ────────────────────────────────────────────────────
// Finds the nearest ramp step (same hue family) that passes AA on the given
// background, without touching the stored brand colour.

export const deriveTextVariant = (brandHex, bgHex, ramp) => {
  // Walk ramp steps ordered by OKLCH L distance from the brand colour
  const [brandL] = srgbToOklch(...hexToRgb(brandHex));
  const steps = Object.entries(ramp)
    .map(([step, hex]) => {
      const [L] = srgbToOklch(...hexToRgb(hex));
      return { step, hex, lDist: Math.abs(L - brandL) };
    })
    .sort((a, b) => a.lDist - b.lDist);

  for (const { hex } of steps) {
    if (passesAA(hex, bgHex)) return hex;
  }
  // Last resort: black or white (always passes)
  return bestOnColor(bgHex);
};

// ─── Full contrast report ────────────────────────────────────────────────────
// Checks every colour/ramp combination that can appear as text-on-background.
// Returns: { pairs, adjustments, schemaVersion }
//   pairs:       all checked {fg, bg, ratio, passNormal, passLarge, onColor}
//   adjustments: pairs where brand colour fails AA as text → derived -text variant

const LIGHT_SURFACE = '#fafafa'; // neutral-50 equivalent
const DARK_SURFACE  = '#111827'; // neutral-900 equivalent

export const buildContrastReport = (palette) => {
  const pairs = [];
  const adjustments = [];

  const { primary, secondary, accent, neutral } = palette.colors;

  const roles = [
    { role: 'primary',   entry: primary },
    { role: 'secondary', entry: secondary },
    { role: 'accent',    entry: accent },
    { role: 'neutral',   entry: neutral },
  ].filter((r) => r.entry);

  for (const { role, entry } of roles) {
    const { hex, ramp } = entry;

    // 1. On-colour text for every ramp step (always passes, no adjustment needed)
    for (const [step, stepHex] of Object.entries(ramp)) {
      const onColor = bestOnColor(stepHex);
      const ratio = contrastRatio(onColor, stepHex);
      pairs.push({
        id: `on-${role}-${step}`,
        fg: onColor,
        bg: stepHex,
        ratio: Math.round(ratio * 100) / 100,
        passNormal: passesAA(onColor, stepHex),
        passLarge: passesAA(onColor, stepHex, true),
        context: `on-${role}-${step}`,
      });
    }

    // 2. Brand colour as text on light and dark surfaces
    for (const [surfaceName, surface] of [['light', LIGHT_SURFACE], ['dark', DARK_SURFACE]]) {
      const ratio = contrastRatio(hex, surface);
      const pass = passesAA(hex, surface);
      pairs.push({
        id: `${role}-on-${surfaceName}`,
        fg: hex,
        bg: surface,
        ratio: Math.round(ratio * 100) / 100,
        passNormal: pass,
        passLarge: passesAA(hex, surface, true),
        context: `${role} as text on ${surfaceName} surface`,
      });
      if (!pass && ramp) {
        const textVariant = deriveTextVariant(hex, surface, ramp);
        adjustments.push({
          id: `${role}-on-${surfaceName}`,
          original: hex,
          derived: textVariant,
          tokenName: `${role}-text`,
          surface,
          surfaceName,
          ratio: Math.round(ratio * 100) / 100,
          reason: `${role} (${hex}) fails WCAG AA (${Math.round(ratio * 100) / 100}:1) on ${surfaceName} surface — ${textVariant} is the nearest passing ramp step`,
        });
      }
    }
  }

  return {
    schemaVersion: 1,
    pairs,
    adjustments,
    allPairsPass: adjustments.length === 0,
  };
};
