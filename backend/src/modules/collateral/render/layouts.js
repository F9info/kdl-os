// Artifact layout builders — deterministic from (spec, brandKit).
// Returns a `layout` object suitable for pdf.buildPdf() or docx.buildDocx().
// All coordinates in mm from top-left corner of the bleed box.
// COLLATERAL_SPEC.md §4, §6.

import { escapeHtml } from './escape.js';

// ── Visiting Card ──────────────────────────────────────────────────────────

// §4.1: 88.9 × 50.8 mm, 3 mm bleed, 4 mm safe zone.
export function visitingCardLayout(spec, brandKit) {
  const bg       = spec.bgColor    ?? brandKit?.palette?.primary?.[0] ?? '#ffffff';
  const textColor = spec.textColor ?? brandKit?.palette?.onSurface     ?? '#000000';
  const bleed    = 3;
  const safe     = 4;

  const company  = brandKit?.company ?? {};
  const name     = spec.holderName  ?? '';
  const title    = spec.holderTitle ?? '';

  return {
    trimW: 88.9, trimH: 50.8, bleed, safeZone: safe,
    sides: 2,
    pages: [
      // Front: logo + name/title
      {
        bg,
        logoRect: { x: safe, y: safe, w: 20, h: 10 },
        texts: [
          { text: name,  x: safe, y: 18, size: 9,  color: textColor, bold: true },
          { text: title, x: safe, y: 26, size: 7,  color: textColor },
        ],
      },
      // Back: contact block + tagline + GSTIN
      {
        bg,
        texts: [
          { text: company.displayName ?? company.legalName ?? '', x: safe, y: safe + 2, size: 8, color: textColor, bold: true },
          { text: (company.addressLines ?? []).join(', '),        x: safe, y: safe + 10, size: 6.5, color: textColor, maxW: 80 },
          { text: company.phone   ?? '', x: safe, y: safe + 22, size: 6.5, color: textColor },
          { text: company.email   ?? '', x: safe, y: safe + 28, size: 6.5, color: textColor },
          { text: company.website ?? '', x: safe, y: safe + 34, size: 6.5, color: textColor },
          { text: company.gstin   ? `GSTIN: ${company.gstin}` : '', x: safe, y: safe + 40, size: 5.5, color: textColor },
          { text: company.tagline ?? '', x: safe, y: 44,         size: 5.5, color: textColor },
        ],
      },
    ],
  };
}

// ── Letterhead ─────────────────────────────────────────────────────────────

// §4.2: A4 210×297 or US Letter 215.9×279.4 mm.
export function letterheadLayout(spec, brandKit, variant = 'A4') {
  const dims = variant === 'US_LETTER'
    ? { trimW: 215.9, trimH: 279.4 }
    : { trimW: 210,   trimH: 297 };
  const bg       = '#ffffff';
  const textColor = spec.textColor ?? brandKit?.palette?.onSurface ?? '#000000';
  const accentColor = brandKit?.palette?.primary?.[5] ?? '#333333';
  const company   = brandKit?.company ?? {};
  const margin    = 12.7;
  const headerH   = 35;

  return {
    ...dims, bleed: 0, safeZone: margin,
    sides: 1,
    pages: [
      {
        bg,
        // Header accent band.
        logoRect: { x: margin, y: margin, w: 30, h: 15 },
        texts: [
          // Company name in header.
          { text: company.displayName ?? company.legalName ?? '', x: margin + 35, y: margin + 5, size: 12, color: accentColor, bold: true },
          { text: company.tagline ?? '', x: margin + 35, y: margin + 16, size: 7.5, color: textColor },
          // Footer.
          { text: [company.phone, company.email, company.website].filter(Boolean).join('   |   '), x: margin, y: dims.trimH - margin - 10, size: 7, color: textColor },
          { text: (company.addressLines ?? []).join(', '), x: margin, y: dims.trimH - margin - 5, size: 7, color: textColor },
        ],
      },
    ],
  };
}

// ── T-shirt Print ──────────────────────────────────────────────────────────

// §4.3: DTG or screen-print art, transparent background.
export function tshirtLayout(spec, brandKit, variant = 'FRONT_A4') {
  const dims = {
    FRONT_A4:   { trimW: 210, trimH: 297 },
    FRONT_A3:   { trimW: 297, trimH: 420 },
    BACK_A3:    { trimW: 297, trimH: 420 },
    LEFT_CHEST: { trimW: 100, trimH: 100 },
  }[variant] ?? { trimW: 210, trimH: 297 };

  const textColor = spec.textColor ?? brandKit?.palette?.onSurface ?? '#000000';
  const printPath = spec.printPath ?? 'dtg';
  const safe = 5;

  return {
    ...dims, bleed: 0, safeZone: safe,
    sides: 1,
    pages: [
      {
        bg: null, // transparent
        logoRect: {
          x: dims.trimW / 2 - 20,
          y: dims.trimH / 2 - 25,
          w: 40, h: 30,
        },
        texts: [
          { text: brandKit?.company?.displayName ?? '', x: dims.trimW / 2 - 30, y: dims.trimH / 2 + 10, size: 14, color: textColor, bold: true },
          { text: brandKit?.company?.tagline ?? '',     x: dims.trimW / 2 - 30, y: dims.trimH / 2 + 22, size: 9,  color: textColor },
          // Placement info at bottom for screen-print sheet.
          ...(printPath === 'screenprint' ? [
            { text: `Print area: ${dims.trimW}×${dims.trimH}mm`, x: safe, y: dims.trimH - safe - 8, size: 6, color: '#888888' },
          ] : []),
        ],
      },
    ],
  };
}

// ── ID Card ────────────────────────────────────────────────────────────────

// §4.4: CR80 85.6 × 53.98 mm, 2 mm bleed, 3 mm safe zone.
export function idCardLayout(spec, brandKit) {
  const bg       = spec.bgColor    ?? brandKit?.palette?.primary?.[0] ?? '#ffffff';
  const textColor = spec.textColor ?? brandKit?.palette?.onSurface    ?? '#000000';
  const bleed    = 2;
  const safe     = 3;
  const company  = brandKit?.company ?? {};

  return {
    trimW: 85.6, trimH: 53.98, bleed, safeZone: safe,
    sides: 2,
    pages: [
      // Front: photo zone, name, ID no., role, logo.
      {
        bg,
        logoRect: { x: safe, y: safe, w: 16, h: 8 },
        // Photo placeholder zone (min 25×32 mm, §4.4).
        texts: [
          { text: '[ PHOTO ]', x: safe, y: safe + 12, size: 7, color: '#888888' },
          { text: escapeHtml(spec.holderName ?? ''),  x: safe + 28, y: safe + 12, size: 8,  color: textColor, bold: true },
          { text: escapeHtml(spec.holderRole ?? ''),  x: safe + 28, y: safe + 20, size: 6.5, color: textColor },
          { text: escapeHtml(spec.idNumber   ?? ''),  x: safe + 28, y: safe + 27, size: 6,   color: textColor },
          { text: company.legalName ?? '',            x: safe + 28, y: safe + 34, size: 5.5, color: textColor },
        ],
      },
      // Back: contact, barcode/QR zone, magstripe keep-out.
      {
        bg,
        texts: [
          { text: company.displayName ?? company.legalName ?? '', x: safe, y: safe + 2, size: 7, color: textColor, bold: true },
          { text: company.email   ?? '', x: safe, y: safe + 10, size: 5.5, color: textColor },
          { text: company.phone   ?? '', x: safe, y: safe + 16, size: 5.5, color: textColor },
          { text: company.website ?? '', x: safe, y: safe + 22, size: 5.5, color: textColor },
          { text: '[ QR / BARCODE ]', x: safe, y: safe + 30, size: 5.5, color: '#888888' },
          // Magstripe keep-out documentation (no encoding in v1).
          { text: 'Magstripe zone (keep out)', x: safe, y: 46, size: 4.5, color: '#aaaaaa' },
        ],
      },
    ],
  };
}

// Dispatcher: returns the layout for a given artifact type and variant.
export function buildLayout(asset, brandKit) {
  const spec    = asset.spec ?? {};
  const variant = spec.variant ?? null;

  switch (asset.type) {
    case 'VISITING_CARD':
      return visitingCardLayout(spec, brandKit);
    case 'LETTERHEAD':
      return letterheadLayout(spec, brandKit, variant ?? 'A4');
    case 'TSHIRT':
      return tshirtLayout(spec, brandKit, variant ?? 'FRONT_A4');
    case 'ID_CARD':
      return idCardLayout(spec, brandKit);
    default:
      throw Object.assign(new Error(`Unknown artifact type: ${asset.type}`), { status: 400 });
  }
}
