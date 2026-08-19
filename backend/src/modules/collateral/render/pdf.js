// PDF render engine — uses pdf-lib for vector-accurate, deterministic output.
// COLLATERAL_SPEC.md §6: vector text/logo preserved, 300 DPI raster floor.
// All dates/random are excluded from PDF metadata → byte-stable for caching.

import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { MM_TO_PT, pageBoxPt, safeAreaMm } from './geometry.js';
import { escapeHtml } from './escape.js';

// Hex "#rrggbb" → pdf-lib rgb(r,g,b) (0–1 range).
function hexToRgb(hex) {
  const c = (hex ?? '#000000').replace('#', '');
  return rgb(
    parseInt(c.slice(0, 2), 16) / 255,
    parseInt(c.slice(2, 4), 16) / 255,
    parseInt(c.slice(4, 6), 16) / 255,
  );
}

// Draw crop marks at corners for PDF_PRINT output.
// markLen = 5mm, gap = 2mm from trim corner.
async function drawCropMarks(page, bleedMm, trimW, trimH) {
  const bleed = bleedMm * MM_TO_PT;
  const w = trimW * MM_TO_PT;
  const h = trimH * MM_TO_PT;
  const markLen = 5 * MM_TO_PT;
  const gap = 2 * MM_TO_PT;
  const pageH = (trimH + 2 * bleedMm) * MM_TO_PT;
  const marks = [
    // Top-left corner
    { x1: bleed - gap - markLen, y1: pageH - bleed, x2: bleed - gap,          y2: pageH - bleed },
    { x1: bleed,                 y1: pageH - bleed + gap,                      x2: bleed,        y2: pageH - bleed + gap + markLen },
    // Top-right
    { x1: bleed + w + gap,       y1: pageH - bleed, x2: bleed + w + gap + markLen, y2: pageH - bleed },
    { x1: bleed + w,             y1: pageH - bleed + gap,                      x2: bleed + w,    y2: pageH - bleed + gap + markLen },
    // Bottom-left
    { x1: bleed - gap - markLen, y1: bleed,         x2: bleed - gap,          y2: bleed },
    { x1: bleed,                 y1: bleed - gap - markLen,                    x2: bleed,        y2: bleed - gap },
    // Bottom-right
    { x1: bleed + w + gap,       y1: bleed,         x2: bleed + w + gap + markLen, y2: bleed },
    { x1: bleed + w,             y1: bleed - gap - markLen,                    x2: bleed + w,    y2: bleed - gap },
  ];
  for (const m of marks) {
    page.drawLine({
      start: { x: m.x1, y: m.y1 },
      end:   { x: m.x2, y: m.y2 },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    });
  }
}

// Build a minimal one-page or two-page PDF for a collateral artifact.
// layout: { trimW, trimH, bleed, safeZone, sides, printMarks, pages: [{ bg, logo, texts }] }
// texts: [{ text, x, y, size, color, font }] — all in mm relative to top-left inside bleed.
export async function buildPdf(layout) {
  const doc = await PDFDocument.create();

  // Strip all metadata for byte-stability.
  doc.setTitle('');
  doc.setAuthor('');
  doc.setCreator('kdl-collateral');
  doc.setProducer('');
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));

  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const { trimW, trimH, bleed = 0, safeZone = 0, printMarks = false } = layout;
  const box = pageBoxPt(trimW, trimH, bleed);
  const bleedPt = bleed * MM_TO_PT;

  for (const pageLayout of layout.pages) {
    const page = doc.addPage([box.width, box.height]);
    const pageH = box.height;

    // Background fill
    if (pageLayout.bg) {
      page.drawRectangle({
        x: 0, y: 0,
        width: box.width, height: box.height,
        color: hexToRgb(pageLayout.bg),
      });
    }

    if (printMarks && bleed > 0) {
      await drawCropMarks(page, bleed, trimW, trimH);
    }

    // Texts — coordinates in mm from top-left corner of bleed box.
    for (const t of pageLayout.texts ?? []) {
      const font = t.bold ? helveticaBold : helvetica;
      const size = (t.size ?? 10);
      const xPt = bleedPt + (t.x ?? 0) * MM_TO_PT;
      // pdf-lib origin is bottom-left; invert y.
      const yPt = pageH - bleedPt - (t.y ?? 0) * MM_TO_PT - size;
      page.drawText(escapeHtml(t.text ?? ''), {
        x: xPt, y: yPt,
        size,
        font,
        color: hexToRgb(t.color ?? '#000000'),
        maxWidth: t.maxW ? t.maxW * MM_TO_PT : undefined,
        lineHeight: size * 1.3,
        wordBreaks: [' '],
      });
    }

    // Logo placeholder rect (actual logo embed requires image fetch — wired in service).
    if (pageLayout.logoRect) {
      const lr = pageLayout.logoRect;
      page.drawRectangle({
        x: bleedPt + lr.x * MM_TO_PT,
        y: pageH - bleedPt - lr.y * MM_TO_PT - lr.h * MM_TO_PT,
        width: lr.w * MM_TO_PT,
        height: lr.h * MM_TO_PT,
        borderColor: hexToRgb('#cccccc'),
        borderWidth: 0.5,
      });
    }
  }

  return doc.save();
}
