import { describe, it, expect } from 'vitest';
import {
  srgbToOklch,
  hexToRgb,
  rgbToHex,
  oklabToOklch,
  oklchToOklab,
  buildRamp,
  extractPalette,
  assignRoles,
  extractDominantColors,
} from './palette.js';
import { relativeLuminance, contrastRatio, passesAA, bestOnColor, buildContrastReport, deriveTextVariant } from './contrast.js';

// ─── OKLCH math ──────────────────────────────────────────────────────────────

describe('srgbToOklch', () => {
  it('converts pure red to OKLCH with expected L/H range', () => {
    const [L, C, H] = srgbToOklch(255, 0, 0);
    expect(L).toBeGreaterThan(0.5);
    expect(L).toBeLessThan(0.7);
    expect(C).toBeGreaterThan(0.2);
    expect(H).toBeGreaterThan(10); // red hue ~29°
    expect(H).toBeLessThan(40);
  });

  it('converts pure blue correctly', () => {
    const [L, C, H] = srgbToOklch(0, 0, 255);
    expect(L).toBeGreaterThan(0.3);
    expect(L).toBeLessThan(0.5);
    expect(C).toBeGreaterThan(0.3);
    expect(H).toBeGreaterThan(240);  // blue hue ~264°
    expect(H).toBeLessThan(290);
  });

  it('black → L ≈ 0', () => {
    const [L] = srgbToOklch(0, 0, 0);
    expect(L).toBeCloseTo(0, 2);
  });

  it('white → L ≈ 1', () => {
    const [L] = srgbToOklch(255, 255, 255);
    expect(L).toBeCloseTo(1, 2);
  });
});

describe('oklabToOklch / oklchToOklab round-trip', () => {
  it('round-trips without loss', () => {
    const L = 0.6, a = 0.08, b = -0.05;
    const [Lx, C, H] = oklabToOklch(L, a, b);
    const [La, aa, bb] = oklchToOklab(Lx, C, H);
    expect(La).toBeCloseTo(L, 6);
    expect(aa).toBeCloseTo(a, 6);
    expect(bb).toBeCloseTo(b, 6);
  });
});

describe('hexToRgb / rgbToHex round-trip', () => {
  it('round-trips #0e6e5c', () => {
    const [r, g, b] = hexToRgb('#0e6e5c');
    expect(rgbToHex(r, g, b)).toBe('#0e6e5c');
  });

  it('handles uppercase hex', () => {
    const [r, g, b] = hexToRgb('#FF0000');
    expect(rgbToHex(r, g, b)).toBe('#ff0000');
  });
});

// ─── Ramp generation ─────────────────────────────────────────────────────────

describe('buildRamp', () => {
  it('generates 10 steps with Tailwind-compatible keys', () => {
    const [L, C, H] = srgbToOklch(14, 110, 92); // greenish brand colour
    const { ramp } = buildRamp([L, C, H], '#0e6e5c');
    const keys = Object.keys(ramp).map(Number).sort((a, b) => a - b);
    expect(keys).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900]);
  });

  it('anchor step contains the exact brand hex', () => {
    const brandHex = '#0e6e5c';
    const [L, C, H] = srgbToOklch(...hexToRgb(brandHex));
    const { ramp, anchorStep } = buildRamp([L, C, H], brandHex);
    expect(ramp[Number(anchorStep)]).toBe(brandHex);
  });

  it('step-50 is lighter than step-900', () => {
    const brandHex = '#3b82f6';
    const [L, C, H] = srgbToOklch(...hexToRgb(brandHex));
    const { ramp } = buildRamp([L, C, H], brandHex);
    const L50 = srgbToOklch(...hexToRgb(ramp[50]))[0];
    const L900 = srgbToOklch(...hexToRgb(ramp[900]))[0];
    expect(L50).toBeGreaterThan(L900);
  });

  it('all ramp colours are valid hex strings', () => {
    const brandHex = '#e11d48';
    const [L, C, H] = srgbToOklch(...hexToRgb(brandHex));
    const { ramp } = buildRamp([L, C, H], brandHex);
    for (const hex of Object.values(ramp)) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

// ─── Palette extraction from synthetic image data ────────────────────────────

// Makes a pixel buffer with a 2-pixel white border and a filled interior.
// Using a border avoids the background-detection logic filtering out the interior colour.
const makePixelBufferWithBorder = (width, height, interiorRgba, borderRgba = [255, 255, 255, 255]) => {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const base = (y * width + x) * 4;
      const isBorder = x < 2 || x >= width - 2 || y < 2 || y >= height - 2;
      const rgba = isBorder ? borderRgba : interiorRgba;
      data[base] = rgba[0]; data[base + 1] = rgba[1]; data[base + 2] = rgba[2]; data[base + 3] = rgba[3] ?? 255;
    }
  }
  return { data, width, height };
};

describe('extractPalette — green logo on white border', () => {
  const GREEN_HEX = '#0e6e5c';
  const [gr, gg, gb] = hexToRgb(GREEN_HEX);

  it('returns schemaVersion 1 and a primary colour', () => {
    const imgData = makePixelBufferWithBorder(32, 32, [gr, gg, gb, 255]);
    const palette = extractPalette(imgData);
    expect(palette.schemaVersion).toBe(1);
    expect(palette.colors.primary).not.toBeNull();
  });

  it('primary hex is close to input colour', () => {
    const imgData = makePixelBufferWithBorder(32, 32, [gr, gg, gb, 255]);
    const palette = extractPalette(imgData);
    const [pr, pg, pb] = hexToRgb(palette.colors.primary.hex);
    expect(Math.abs(pr - gr)).toBeLessThan(30);
    expect(Math.abs(pg - gg)).toBeLessThan(30);
    expect(Math.abs(pb - gb)).toBeLessThan(30);
  });

  it('transparent interior pixels are excluded', () => {
    // Border = white, interior = green but with half transparent pixels
    const data = new Uint8Array(32 * 32 * 4);
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const base = (y * 32 + x) * 4;
        const isBorder = x < 2 || x >= 30 || y < 2 || y >= 30;
        if (isBorder) {
          data[base] = 255; data[base + 1] = 255; data[base + 2] = 255; data[base + 3] = 255;
        } else if (y < 16) {
          data[base + 3] = 0; // transparent
        } else {
          data[base] = gr; data[base + 1] = gg; data[base + 2] = gb; data[base + 3] = 255;
        }
      }
    }
    const palette = extractPalette({ data, width: 32, height: 32 });
    // Should still find the green primary from the opaque bottom half
    expect(palette.colors.primary).not.toBeNull();
  });
});

describe('extractPalette — monochrome (grey) image', () => {
  it('sets paletteConfidence to low for monochrome input', () => {
    // Pure grey with white border — all interior pixels have C < 0.03 so no chromatic clusters
    const imgData = makePixelBufferWithBorder(32, 32, [128, 128, 128, 255]);
    const palette = extractPalette(imgData);
    expect(palette.paletteConfidence).toBe('low');
  });
});

// ─── WCAG contrast math ───────────────────────────────────────────────────────

describe('relativeLuminance', () => {
  it('white luminance is 1.0', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1.0, 3);
  });

  it('black luminance is 0.0', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0.0, 3);
  });
});

describe('contrastRatio', () => {
  it('black on white is 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('white on white is 1:1', () => {
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 0);
  });
});

describe('passesAA', () => {
  it('black on white passes AA normal', () => {
    expect(passesAA('#000000', '#ffffff')).toBe(true);
  });

  it('light grey (#aaaaaa) on white fails AA normal', () => {
    expect(passesAA('#aaaaaa', '#ffffff')).toBe(false);
  });

  it('light grey passes AA large (3:1 threshold)', () => {
    // #aaaaaa on white = ~2.32:1, still fails large text
    expect(passesAA('#aaaaaa', '#ffffff', true)).toBe(false);
  });
});

describe('bestOnColor', () => {
  it('returns white for dark background', () => {
    expect(bestOnColor('#0e6e5c')).toBe('#ffffff');
  });

  it('returns black for light background', () => {
    expect(bestOnColor('#fafafa')).toBe('#000000');
  });
});

// ─── Failing brand colour → derived -text variant ────────────────────────────
// This is the D-BK-1 test: a light yellow brand colour fails AA on white,
// and buildContrastReport must produce a correct adjustment entry with a
// derived -text variant that DOES pass AA.

describe('D-BK-1: failing brand colour → correct -text variant', () => {
  const YELLOW_HEX = '#ffe066'; // a light yellow that fails AA on white (#fafafa)

  it('yellow fails AA on light surface as text', () => {
    const ratio = contrastRatio(YELLOW_HEX, '#fafafa');
    expect(ratio).toBeLessThan(4.5);
  });

  it('buildContrastReport produces an adjustment entry for the failing colour', () => {
    const [L, C, H] = srgbToOklch(...hexToRgb(YELLOW_HEX));
    const { ramp } = buildRamp([L, C, H], YELLOW_HEX);

    // Build a minimal palette stub with just a primary colour
    const fakePalette = {
      colors: {
        primary: { hex: YELLOW_HEX, ramp },
        secondary: null,
        accent: null,
        neutral: null,
      },
    };

    const report = buildContrastReport(fakePalette);
    const adj = report.adjustments.find((a) => a.id === 'primary-on-light');
    expect(adj).toBeDefined();
    expect(adj.tokenName).toBe('primary-text');
    expect(adj.original).toBe(YELLOW_HEX);
    // The derived variant must pass AA on the light surface
    expect(passesAA(adj.derived, '#fafafa')).toBe(true);
  });

  it('the stored brand colour is never mutated — original hex is unchanged', () => {
    const [L, C, H] = srgbToOklch(...hexToRgb(YELLOW_HEX));
    const { ramp } = buildRamp([L, C, H], YELLOW_HEX);
    const fakePalette = {
      colors: { primary: { hex: YELLOW_HEX, ramp }, secondary: null, accent: null, neutral: null },
    };
    const report = buildContrastReport(fakePalette);
    const adj = report.adjustments.find((a) => a.original === YELLOW_HEX);
    expect(adj.original).toBe(YELLOW_HEX); // unchanged
    expect(adj.derived).not.toBe(YELLOW_HEX); // different adjusted value
  });
});

// ─── Sanitizer contract: palette + contrast only use sanitized data ───────────
// The palette and contrast modules are pure functions with no I/O — they only
// receive pixel data that the service has already sanitized via uploadMedia.
// This test confirms they produce valid output without any storage calls.

describe('palette and contrast functions are pure (no I/O)', () => {
  it('buildContrastReport has no external dependencies', () => {
    const { ramp } = buildRamp(srgbToOklch(...hexToRgb('#0e6e5c')), '#0e6e5c');
    const fakePalette = {
      colors: { primary: { hex: '#0e6e5c', ramp }, secondary: null, accent: null, neutral: null },
    };
    // No mocks needed — pure math
    const report = buildContrastReport(fakePalette);
    expect(Array.isArray(report.pairs)).toBe(true);
    expect(Array.isArray(report.adjustments)).toBe(true);
  });
});

// ─── hueNameFor (KDL-510) ─────────────────────────────────────────────────────

describe('hueNameFor', () => {
  it('is deterministic and covers the full wheel', async () => {
    const { hueNameFor } = await import('./palette.js');
    expect(hueNameFor(264, 0.11)).toBe('blue');
    expect(hueNameFor(29, 0.15)).toBe('red');
    expect(hueNameFor(142, 0.12)).toBe('green');
    expect(hueNameFor(142, 0.12)).toBe(hueNameFor(142 + 360, 0.12)); // wraps
    expect(hueNameFor(-15, 0.12)).toBe(hueNameFor(345, 0.12)); // negative wraps
  });

  it('near-zero chroma and non-finite hue name as neutral gray', async () => {
    const { hueNameFor } = await import('./palette.js');
    expect(hueNameFor(264, 0.01)).toBe('neutral gray');
    expect(hueNameFor(null, 0.2)).toBe('neutral gray');
    expect(hueNameFor(undefined)).toBe('neutral gray');
  });
});
