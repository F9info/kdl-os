// Print geometry constants — COLLATERAL_SPEC.md §4.
// All dimensions in mm. Points = mm * (72 / 25.4).

export const MM_TO_PT = 72 / 25.4;

// Trim sizes, bleed, and safe zones per artifact type.
export const GEOMETRY = {
  VISITING_CARD: {
    trimW: 88.9,
    trimH: 50.8,
    bleed: 3,
    safeZone: 4,
    cornerRadius: 0,      // default; 3mm optional
    sides: 2,
    dpi: 300,
  },
  LETTERHEAD: {
    A4: { trimW: 210, trimH: 297, bleed: 0, safeZone: 12.7, sides: 1, dpi: 300 },
    US_LETTER: { trimW: 215.9, trimH: 279.4, bleed: 0, safeZone: 12.7, sides: 1, dpi: 300 },
  },
  TSHIRT: {
    FRONT_A4:  { trimW: 210, trimH: 297, bleed: 0, safeZone: 5, dpi: 300 },
    FRONT_A3:  { trimW: 297, trimH: 420, bleed: 0, safeZone: 5, dpi: 300 },
    BACK_A3:   { trimW: 297, trimH: 420, bleed: 0, safeZone: 5, dpi: 300 },
    LEFT_CHEST: { trimW: 100, trimH: 100, bleed: 0, safeZone: 5, dpi: 300 },
  },
  ID_CARD: {
    trimW: 85.6,
    trimH: 53.98,
    bleed: 2,
    safeZone: 3,
    cornerRadius: 3.18,
    sides: 2,
    dpi: 300,
  },
};

// Returns the full-bleed page size in points for PDF @page box.
export function pageBoxPt(trimW, trimH, bleed) {
  return {
    width:  (trimW + 2 * bleed) * MM_TO_PT,
    height: (trimH + 2 * bleed) * MM_TO_PT,
  };
}

// Returns safe content area inside trim (excluding bleed and safe zone).
export function safeAreaMm(trimW, trimH, safeZone) {
  return {
    x: safeZone,
    y: safeZone,
    w: trimW - 2 * safeZone,
    h: trimH - 2 * safeZone,
  };
}
