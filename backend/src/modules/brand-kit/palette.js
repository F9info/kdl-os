// OKLCH palette extraction — pure local compute, no AI, no external calls.
// sRGB ↔ OKLab ↔ OKLCH per the Björn Ottosson formulation used in CSS Color 4.
//
// Key decisions (§2 of BRAND-KIT SPEC v1):
//  - All clustering and ramping in OKLab/OKLCH for perceptual uniformity
//  - Gamut-mapping via chroma-reduction at constant L+H (never channel clamp)
//  - k-means++ with fixed seed for determinism (same logo → same palette always)
//  - 10-step Tailwind-compatible ramps (keys 50,100,200,…,900)

// ─── sRGB ↔ Linear sRGB ─────────────────────────────────────────────────────

const linearize = (c) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

const delinearize = (c) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

// ─── Linear sRGB ↔ OKLab ────────────────────────────────────────────────────
// Uses the matrices from https://bottosson.github.io/posts/oklab/

const linearToOklab = (r, g, b) => {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const lp = Math.cbrt(l);
  const mp = Math.cbrt(m);
  const sp = Math.cbrt(s);
  return [
    0.2104542553 * lp + 0.7936177850 * mp - 0.0040720468 * sp,
    1.9779984951 * lp - 2.4285922050 * mp + 0.4505937099 * sp,
    0.0259040371 * lp + 0.7827717662 * mp - 0.8086757660 * sp,
  ];
};

const oklabToLinear = (L, a, b) => {
  const lp = L + 0.3963377774 * a + 0.2158037573 * b;
  const mp = L - 0.1055613458 * a - 0.0638541728 * b;
  const sp = L - 0.0894841775 * a - 1.2914855480 * b;
  return [
    +4.0767416621 * lp ** 3 - 3.3077115913 * mp ** 3 + 0.2309699292 * sp ** 3,
    -1.2684380046 * lp ** 3 + 2.6097574011 * mp ** 3 - 0.3413193965 * sp ** 3,
    -0.0041960863 * lp ** 3 - 0.7034186147 * mp ** 3 + 1.7076147010 * sp ** 3,
  ];
};

// ─── OKLab ↔ OKLCH ──────────────────────────────────────────────────────────

export const oklabToOklch = (L, a, b) => {
  const C = Math.sqrt(a * a + b * b);
  const H = (Math.atan2(b, a) * 180) / Math.PI;
  return [L, C, H < 0 ? H + 360 : H];
};

export const oklchToOklab = (L, C, H) => {
  const hRad = (H * Math.PI) / 180;
  return [L, C * Math.cos(hRad), C * Math.sin(hRad)];
};

// ─── sRGB ↔ OKLCH ───────────────────────────────────────────────────────────

export const srgbToOklch = (r, g, b) => {
  const [L, a, ob] = linearToOklab(linearize(r / 255), linearize(g / 255), linearize(b / 255));
  return oklabToOklch(L, a, ob);
};

const oklchToSrgb255 = (L, C, H) => {
  const [la, a, b] = oklchToOklab(L, C, H);
  const [lr, lg, lb] = oklabToLinear(la, a, b);
  return [
    Math.round(Math.min(255, Math.max(0, delinearize(lr) * 255))),
    Math.round(Math.min(255, Math.max(0, delinearize(lg) * 255))),
    Math.round(Math.min(255, Math.max(0, delinearize(lb) * 255))),
  ];
};

// ─── Gamut mapping ───────────────────────────────────────────────────────────
// Reduce chroma at constant L and H until all sRGB channels are in [0,1].
// Binary search, ≤ 20 iterations. Never clamp per-channel (preserves hue).

const isInGamut = (lr, lg, lb) => lr >= 0 && lr <= 1 && lg >= 0 && lg <= 1 && lb >= 0 && lb <= 1;

const oklchToGamutSrgb = (L, C, H) => {
  const [la, a, b] = oklchToOklab(L, C, H);
  const [lr, lg, lb] = oklabToLinear(la, a, b);
  if (isInGamut(lr, lg, lb)) {
    return oklchToSrgb255(L, C, H);
  }
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const [lla, aa, bb] = oklchToOklab(L, mid, H);
    const [llr, llg, llb] = oklabToLinear(lla, aa, bb);
    if (isInGamut(llr, llg, llb)) lo = mid;
    else hi = mid;
  }
  return oklchToSrgb255(L, (lo + hi) / 2, H);
};

// ─── Hex helpers ─────────────────────────────────────────────────────────────

export const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

// ─── ΔE_OK (OKLab Euclidean distance) ───────────────────────────────────────

const deltaEOK = (L1, a1, b1, L2, a2, b2) =>
  Math.sqrt((L1 - L2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);

// ─── k-means++ seeded clustering ─────────────────────────────────────────────

// Deterministic PRNG (mulberry32) so same logo always produces same palette.
const makePrng = (seed) => {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const PRNG_SEED = 0xdeadbeef; // fixed seed for determinism

const kMeansPlusPlus = (points, k, rand) => {
  const n = points.length;
  const centers = [points[Math.floor(rand() * n)]];
  while (centers.length < k) {
    const dists = points.map((p) => {
      let minD = Infinity;
      for (const c of centers) {
        const d = deltaEOK(p[0], p[1], p[2], c[0], c[1], c[2]);
        if (d < minD) minD = d;
      }
      return minD * minD;
    });
    const total = dists.reduce((s, d) => s + d, 0);
    let pick = rand() * total;
    for (let i = 0; i < n; i++) {
      pick -= dists[i];
      if (pick <= 0) { centers.push(points[i]); break; }
    }
    if (centers.length < k) centers.push(points[Math.floor(rand() * n)]);
  }
  return centers;
};

const kMeans = (labPoints, weights, k, maxIter = 30) => {
  const rand = makePrng(PRNG_SEED);
  let centers = kMeansPlusPlus(labPoints, k, rand);
  let assignments = new Array(labPoints.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < labPoints.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = deltaEOK(labPoints[i][0], labPoints[i][1], labPoints[i][2],
          centers[c][0], centers[c][1], centers[c][2]);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (assignments[i] !== best) { assignments[i] = best; changed = true; }
    }
    if (!changed) break;

    const newCenters = Array.from({ length: k }, () => [0, 0, 0]);
    const totWeights = new Array(k).fill(0);
    for (let i = 0; i < labPoints.length; i++) {
      const c = assignments[i];
      const w = weights[i];
      newCenters[c][0] += labPoints[i][0] * w;
      newCenters[c][1] += labPoints[i][1] * w;
      newCenters[c][2] += labPoints[i][2] * w;
      totWeights[c] += w;
    }
    for (let c = 0; c < k; c++) {
      if (totWeights[c] > 0) {
        centers[c] = newCenters[c].map((v) => v / totWeights[c]);
      }
    }
  }

  const clusterWeights = new Array(k).fill(0);
  for (let i = 0; i < labPoints.length; i++) clusterWeights[assignments[i]] += weights[i];
  return centers.map((c, i) => ({ lab: c, weight: clusterWeights[i] }));
};

// ─── Dominant-colour extraction ───────────────────────────────────────────────
// Input: raw pixel buffer {data: Uint8Array RGBA, width, height}

export const extractDominantColors = (imageData) => {
  const { data, width, height } = imageData;
  const pixCount = width * height;
  const labPoints = [];
  const weights = [];
  const totalWeight = { v: 0 };

  // Sample border to detect solid background (§2.2 background detection)
  const borderSamples = [];
  for (let x = 0; x < width; x++) {
    const idx0 = x * 4;
    const idx1 = ((height - 1) * width + x) * 4;
    borderSamples.push([data[idx0], data[idx0 + 1], data[idx0 + 2]]);
    borderSamples.push([data[idx1], data[idx1 + 1], data[idx1 + 2]]);
  }
  for (let y = 1; y < height - 1; y++) {
    const idx0 = y * width * 4;
    const idx1 = (y * width + width - 1) * 4;
    borderSamples.push([data[idx0], data[idx0 + 1], data[idx0 + 2]]);
    borderSamples.push([data[idx1], data[idx1 + 1], data[idx1 + 2]]);
  }
  let bgLab = null;
  if (borderSamples.length > 0) {
    const meanR = borderSamples.reduce((s, p) => s + p[0], 0) / borderSamples.length;
    const meanG = borderSamples.reduce((s, p) => s + p[1], 0) / borderSamples.length;
    const meanB = borderSamples.reduce((s, p) => s + p[2], 0) / borderSamples.length;
    const withinThreshold = borderSamples.filter((p) => {
      const [L1, a1, b1] = linearToOklab(linearize(p[0] / 255), linearize(p[1] / 255), linearize(p[2] / 255));
      const [L2, a2, b2] = linearToOklab(linearize(meanR / 255), linearize(meanG / 255), linearize(meanB / 255));
      return deltaEOK(L1, a1, b1, L2, a2, b2) < 0.03;
    });
    if (withinThreshold.length / borderSamples.length >= 0.8) {
      bgLab = linearToOklab(linearize(meanR / 255), linearize(meanG / 255), linearize(meanB / 255));
    }
  }

  for (let i = 0; i < pixCount; i++) {
    const base = i * 4;
    const alpha = data[base + 3] / 255;
    if (alpha < 0.125) continue;
    const r = data[base] / 255, g = data[base + 1] / 255, b = data[base + 2] / 255;
    const lab = linearToOklab(linearize(r), linearize(g), linearize(b));
    if (bgLab && deltaEOK(lab[0], lab[1], lab[2], bgLab[0], bgLab[1], bgLab[2]) < 0.05) continue;
    labPoints.push(lab);
    weights.push(alpha);
    totalWeight.v += alpha;
  }

  if (labPoints.length === 0) return [];

  const K = 8;
  const clusters = kMeans(labPoints, weights, K);
  const totalW = clusters.reduce((s, c) => s + c.weight, 0);

  // Prune < 2% weight clusters
  let alive = clusters.filter((c) => c.weight / totalW >= 0.02);

  // Merge near-identical hues (ΔE_OK < 0.07)
  let merged = true;
  let maxIter = 50;
  while (merged && maxIter-- > 0) {
    merged = false;
    outer: for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const d = deltaEOK(alive[i].lab[0], alive[i].lab[1], alive[i].lab[2],
          alive[j].lab[0], alive[j].lab[1], alive[j].lab[2]);
        if (d < 0.07) {
          const wSum = alive[i].weight + alive[j].weight;
          alive[i] = {
            lab: alive[i].lab.map((v, k) => (v * alive[i].weight + alive[j].lab[k] * alive[j].weight) / wSum),
            weight: wSum,
          };
          alive.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }

  return alive.map((c) => {
    const lch = oklabToOklch(c.lab[0], c.lab[1], c.lab[2]);
    const [r, g, b] = oklchToGamutSrgb(lch[0], lch[1], lch[2]);
    return { lab: c.lab, lch, hex: rgbToHex(r, g, b), weight: c.weight, totalWeight: totalW };
  });
};

// ─── Role assignment ─────────────────────────────────────────────────────────

const CHROMA_NEUTRAL_THRESHOLD = 0.03;
const HUE_DIFF_MIN = 30; // degrees

export const assignRoles = (clusters) => {
  const totalW = clusters[0]?.totalWeight ?? clusters.reduce((s, c) => s + c.weight, 0);

  const chromatic = clusters
    .filter((c) => c.lch[1] >= CHROMA_NEUTRAL_THRESHOLD)
    .sort((a, b) => b.weight - a.weight);
  const neutrals = clusters
    .filter((c) => c.lch[1] < CHROMA_NEUTRAL_THRESHOLD)
    .sort((a, b) => b.weight - a.weight);

  const primary = chromatic[0] ?? null;

  let secondary = null;
  if (primary) {
    for (const c of chromatic.slice(1)) {
      const hueDiff = Math.abs(c.lch[2] - primary.lch[2]);
      const normalised = hueDiff > 180 ? 360 - hueDiff : hueDiff;
      if (normalised > HUE_DIFF_MIN) { secondary = c; break; }
    }
  }

  const accented = primary
    ? chromatic.filter((c) => c !== primary && c !== secondary).sort((a, b) => b.lch[1] - a.lch[1])
    : [];
  const accent = accented[0] ?? null;

  let neutral = neutrals[0] ?? null;
  if (!neutral && primary) {
    // Derive neutral from primary at near-zero chroma
    const [L, , H] = primary.lch;
    const [r, g, b] = oklchToGamutSrgb(L, 0.01, H);
    const lab = linearToOklab(linearize(r / 255), linearize(g / 255), linearize(b / 255));
    const lch = oklabToOklch(lab[0], lab[1], lab[2]);
    neutral = { lab, lch, hex: rgbToHex(r, g, b), weight: 0, totalWeight: totalW };
  }

  const paletteConfidence = primary
    ? chromatic.length >= 2 ? 'high' : 'medium'
    : 'low';

  return { primary, secondary, accent, neutral, paletteConfidence, totalW };
};

// ─── 10-step OKLCH ramp ──────────────────────────────────────────────────────
// Lightness targets (step 50 → step 900, 10 values)
const RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const RAMP_L     = [0.97, 0.93, 0.85, 0.76, 0.66, 0.57, 0.48, 0.39, 0.31, 0.23];

// Bell-profile chroma scale — peaks at 1.0 in the centre, tapers to 0.25 at edges
const chromaBell = (idx, peakIdx) => {
  const half = (RAMP_L.length - 1) / 2;
  const dist = Math.abs(idx - peakIdx) / half;
  return 0.25 + 0.75 * Math.max(0, 1 - dist);
};

export const buildRamp = (lch, brandHex) => {
  const [, brandC, brandH] = lch;
  const [brandR, brandG, brandB] = hexToRgb(brandHex);
  const brandL = srgbToOklch(brandR, brandG, brandB)[0];

  // Find ramp step whose L target is nearest to the brand's actual L
  let anchorIdx = 0;
  let minLDiff = Infinity;
  for (let i = 0; i < RAMP_L.length; i++) {
    const d = Math.abs(RAMP_L[i] - brandL);
    if (d < minLDiff) { minLDiff = d; anchorIdx = i; }
  }

  const result = {};
  for (let i = 0; i < RAMP_STEPS.length; i++) {
    const step = RAMP_STEPS[i];
    if (i === anchorIdx) {
      // Anchor step: use the exact brand hex verbatim
      result[step] = brandHex;
    } else {
      const L = RAMP_L[i];
      const C = brandC * chromaBell(i, anchorIdx);
      const [r, g, b] = oklchToGamutSrgb(L, C, brandH);
      result[step] = rgbToHex(r, g, b);
    }
  }

  return { ramp: result, anchorStep: String(RAMP_STEPS[anchorIdx]) };
};

// ─── Full palette extraction ─────────────────────────────────────────────────
// input: { data, width, height } — raw RGBA pixel buffer (from sharp)

export const extractPalette = (imageData) => {
  const clusters = extractDominantColors(imageData);
  const { primary, secondary, accent, neutral, paletteConfidence } = assignRoles(clusters);

  const buildEntry = (cluster) => {
    if (!cluster) return null;
    const { ramp, anchorStep } = buildRamp(cluster.lch, cluster.hex);
    const [L, C, H] = cluster.lch;
    return {
      hex: cluster.hex,
      oklch: [Math.round(L * 1000) / 1000, Math.round(C * 1000) / 1000, Math.round(H * 10) / 10],
      confidence: Math.round((cluster.weight / cluster.totalWeight) * 100) / 100,
      ramp,
      anchorStep,
    };
  };

  return {
    schemaVersion: 1,
    colors: {
      primary: buildEntry(primary),
      secondary: buildEntry(secondary),
      accent: buildEntry(accent),
      neutral: buildEntry(neutral),
    },
    paletteConfidence,
  };
};

// ─── Hue naming ──────────────────────────────────────────────────────────────
// Fixed 24-sector OKLCH hue-wheel lookup (BRAND_KIT_AI_ARCH §7): the human-
// readable hue name fed to AI inference as palette context. Deterministic and
// local — never model-generated. Sector anchors follow OKLCH hue angles
// (h≈29 red, h≈110 yellow, h≈142 green, h≈264 blue), not HSL ones.

const HUE_SECTORS = [
  'rose', 'red', 'red', 'orange', 'orange', 'amber',
  'yellow', 'yellow-green', 'lime', 'green', 'green', 'teal',
  'teal', 'cyan', 'sky blue', 'azure', 'blue', 'blue',
  'indigo', 'violet', 'purple', 'magenta', 'pink', 'rose',
];

const NEUTRAL_CHROMA_FLOOR = 0.02;

export const hueNameFor = (hueDegrees, chroma = null) => {
  if (chroma !== null && chroma < NEUTRAL_CHROMA_FLOOR) return 'neutral gray';
  if (typeof hueDegrees !== 'number' || !Number.isFinite(hueDegrees)) return 'neutral gray';
  const h = ((hueDegrees % 360) + 360) % 360;
  return HUE_SECTORS[Math.floor(h / 15)];
};
