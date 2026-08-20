// Brand-guidelines PDF builder (KDL-537).
// Builds a 4-page A4 PDF: cover, OKLCH palette, typography/tone, WCAG AA report.
// Reuses buildPdf from the collateral render pipeline — no second render path.

import { buildPdf } from '../collateral/render/pdf.js';

// A4 — same geometry as LETTERHEAD in collateral/render/geometry.js.
const A4_W  = 210;
const A4_H  = 297;
const SAFE  = 12.7;
const INNER_W = A4_W - 2 * SAFE;

const HEADING = { size: 20, bold: true, color: '#111111' };
const SUB     = { size: 9,  color: '#666666' };
const LABEL   = { size: 10, bold: true, color: '#333333' };
const BODY    = { size: 9,  color: '#555555' };

function text(t, x, y, extra = {}) {
  return { text: String(t ?? ''), x, y, ...extra };
}

function paletteRows(palette) {
  const out = [];
  const colors = palette?.colors ?? {};
  let y = 55;
  for (const [name, entry] of Object.entries(colors)) {
    if (!entry) continue;
    const hex    = entry.hex ?? '#cccccc';
    const [l, c, h] = entry.oklch ?? [0, 0, 0];
    const row = `${name.toUpperCase().padEnd(10)}  ${hex}  OKLCH(${(l ?? 0).toFixed(2)} ${(c ?? 0).toFixed(3)} ${Math.round(h ?? 0)}°)`;
    out.push(text(row, SAFE, y, { size: 9, color: '#222222' }));
    y += 11;

    // Ramp steps
    const ramp = entry.ramp ?? {};
    const steps = Object.entries(ramp).map(([step, hx]) => `${step}:${hx}`).join('  ');
    if (steps) {
      out.push(text(steps, SAFE + 4, y, { size: 7, color: '#888888', maxW: INNER_W - 4 }));
      y += 10;
    }
  }
  return out;
}

function contrastRows(report) {
  const out = [];
  const pairs = report?.pairs ?? report?.results ?? report?.adjustments ?? [];
  let y = 50;
  for (const pair of pairs) {
    const fg    = pair.fg ?? pair.foreground ?? pair.color ?? '?';
    const bg    = pair.bg ?? pair.background ?? pair.surface ?? '?';
    const ratio = typeof pair.ratio === 'number' ? pair.ratio.toFixed(2) : '?';
    const aa    = pair.wcag_aa ?? pair.aa ?? pair.AA ?? '?';
    const pass  = aa === true || aa === 'pass' || aa === 'PASS' || aa === 'AA';
    const color = pass ? '#006b40' : '#b00020';
    out.push(text(
      `${fg} on ${bg}  ·  ratio ${ratio}  ·  AA: ${pass ? 'PASS' : 'FAIL'}`,
      SAFE, y, { size: 8, color },
    ));
    y += 10;
    if (y > A4_H - SAFE - 10) break;
  }
  if (pairs.length === 0) {
    out.push(text('No contrast data recorded for this kit.', SAFE, 55, SUB));
  }
  return out;
}

function typographyRows(typography, tone) {
  const rows = [];
  const add = (label, val, y) => {
    rows.push(text(label, SAFE, y, LABEL));
    rows.push(text(val, SAFE + 4, y + 12, { ...BODY, maxW: INNER_W - 4 }));
  };

  let y = 50;
  if (typography && typeof typography === 'object') {
    const keys = Object.keys(typography);
    for (const k of keys.slice(0, 6)) {
      add(k, JSON.stringify(typography[k]), y);
      y += 30;
    }
  } else if (typography) {
    add('Typography', String(typography), y);
    y += 30;
  } else {
    rows.push(text('No typography data recorded for this kit.', SAFE, y, SUB));
    y += 15;
  }

  if (tone && typeof tone === 'object') {
    const keys = Object.keys(tone);
    for (const k of keys.slice(0, 4)) {
      add(k, JSON.stringify(tone[k]), y);
      y += 30;
    }
  } else if (tone) {
    add('Brand tone', String(tone), y);
  } else {
    rows.push(text('No tone data recorded for this kit.', SAFE, y + 5, SUB));
  }

  return rows;
}

export async function buildGuidelinesPdf(kit) {
  const palette   = kit.palette        ?? {};
  const contrast  = kit.contrast_report ?? {};
  const typo      = kit.typography     ?? null;
  const tone      = kit.tone           ?? null;
  const approvedOn = kit.approved_at
    ? new Date(kit.approved_at).toISOString().slice(0, 10)
    : 'Not yet approved';

  const pages = [
    // ── Page 1: Cover ──────────────────────────────────────────────────────────
    {
      bg: '#ffffff',
      texts: [
        text('BRAND GUIDELINES', SAFE, 40, HEADING),
        text(`Project ID: ${kit.project_id}`, SAFE, 68, { size: 10, color: '#444444' }),
        text(`Approved: ${approvedOn}`, SAFE, 80, { size: 10, color: '#444444' }),
        text(`Schema version: ${kit.schema_version ?? 1}`, SAFE, 92, { size: 10, color: '#888888' }),
        text('Logo', SAFE, 120, LABEL),
      ],
      logoRect: { x: SAFE, y: 132, w: 60, h: 40 },
    },

    // ── Page 2: Colour palette ────────────────────────────────────────────────
    {
      bg: '#ffffff',
      texts: [
        text('COLOUR PALETTE', SAFE, 25, HEADING),
        text('OKLCH-derived brand colours with 900-step ramps', SAFE, 42, SUB),
        ...paletteRows(palette),
      ],
    },

    // ── Page 3: Typography + tone ─────────────────────────────────────────────
    {
      bg: '#ffffff',
      texts: [
        text('TYPOGRAPHY & TONE', SAFE, 25, HEADING),
        text('Inferred from brand-kit AI pass (KDL-510)', SAFE, 42, SUB),
        ...typographyRows(typo, tone),
      ],
    },

    // ── Page 4: Contrast / WCAG AA report ────────────────────────────────────
    {
      bg: '#ffffff',
      texts: [
        text('CONTRAST REPORT — WCAG AA', SAFE, 25, HEADING),
        text('Colour pairs and AA pass/fail status', SAFE, 42, SUB),
        ...contrastRows(contrast),
      ],
    },
  ];

  return Buffer.from(
    await buildPdf({ trimW: A4_W, trimH: A4_H, bleed: 0, safeZone: SAFE, printMarks: false, pages }),
  );
}
