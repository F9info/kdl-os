// Preflight checks — COLLATERAL_SPEC.md §8.
// All named codes are contract strings; exact spelling is enforced by test.

export const PREFLIGHT_CODES = {
  BRANDKIT_MISSING_FIELD: 'BRANDKIT_MISSING_FIELD',
  LOGO_BELOW_MIN_WIDTH: 'LOGO_BELOW_MIN_WIDTH',
  CONTRAST_FAIL_SMALL_PRINT: 'CONTRAST_FAIL_SMALL_PRINT',
  SPOTCOLOR_LIMIT_EXCEEDED: 'SPOTCOLOR_LIMIT_EXCEEDED',
  GEOMETRY_OUT_OF_BOUNDS: 'GEOMETRY_OUT_OF_BOUNDS',
  FONT_NOT_ALLOWLISTED: 'FONT_NOT_ALLOWLISTED',
  CREDITS_INSUFFICIENT: 'CREDITS_INSUFFICIENT',
};

// WCAG 2.1 relative luminance from sRGB hex.
function hexToLuminance(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const linearize = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function contrastRatio(hex1, hex2) {
  const l1 = hexToLuminance(hex1);
  const l2 = hexToLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Screen-print max spot colours (default 4, spec §4.3).
const MAX_SPOT_COLORS = 4;

// Minimum WCAG contrast for small print (AA large = 3:1, AA small = 4.5:1).
// Collateral uses the stricter small-print threshold.
const MIN_CONTRAST_SMALL_PRINT = 4.5;

// Font allowlist check — delegates to theme-engine allowlist (spec §3 / §11).
// In Phase 1, fonts from brand-kit are assumed allowlisted if they resolved through
// brand-kit's font pipeline. This stub trusts the fontUrl pattern.
function isFontAllowlisted(fontUrl) {
  if (!fontUrl) return true; // system fonts have no URL — allowed by default
  // Phase 1: accept storage-served URLs and well-known CDN patterns.
  return (
    fontUrl.startsWith('/api/') ||
    fontUrl.includes('fonts.googleapis.com') ||
    fontUrl.includes('fonts.gstatic.com') ||
    fontUrl.startsWith('http://localhost') ||
    fontUrl.startsWith('https://')
  );
}

// Resolves brand-kit required fields. Returns list of missing field paths.
function checkBrandKitFields(brandKit) {
  const missing = [];
  if (!brandKit) { missing.push('brandKit'); return missing; }
  if (!brandKit.logo?.primaryUrl) missing.push('logo.primaryUrl');
  if (typeof brandKit.logo?.minWidthMm !== 'number') missing.push('logo.minWidthMm');
  if (!brandKit.palette?.primary?.length) missing.push('palette.primary');
  if (!brandKit.palette?.onSurface) missing.push('palette.onSurface');
  if (!brandKit.typography?.heading) missing.push('typography.heading');
  if (!brandKit.typography?.body) missing.push('typography.body');
  if (!brandKit.company?.legalName) missing.push('company.legalName');
  return missing;
}

// Artifact geometry safe-zone check (spec §4).
// Returns true if any zone coordinate exceeds the safe area.
function geometryOutOfBounds(spec, artifactType) {
  const zones = spec.zones ?? [];
  // Geometry limits per type (trim - 2*bleed - safe zone).
  const limits = {
    VISITING_CARD: { w: 88.9, h: 50.8, bleed: 3, safe: 4 },
    LETTERHEAD:    { w: 210,  h: 297,  bleed: 0, safe: 12.7 },
    TSHIRT:        { w: 210,  h: 297,  bleed: 0, safe: 5 },
    ID_CARD:       { w: 85.6, h: 53.98, bleed: 2, safe: 3 },
  };
  const lim = limits[artifactType];
  if (!lim) return false;
  const maxW = lim.w - 2 * lim.safe;
  const maxH = lim.h - 2 * lim.safe;
  for (const zone of zones) {
    if ((zone.x ?? 0) < 0 || (zone.y ?? 0) < 0) return true;
    if (((zone.x ?? 0) + (zone.w ?? 0)) > maxW) return true;
    if (((zone.y ?? 0) + (zone.h ?? 0)) > maxH) return true;
  }
  return false;
}

// Returns { ok: boolean, issues: [{ code, message }] }
export function runPreflight({ asset, brandKit, creditsOk = true }) {
  const issues = [];

  // §8 BRANDKIT_MISSING_FIELD
  const missingFields = checkBrandKitFields(brandKit);
  if (missingFields.length > 0) {
    issues.push({
      code: PREFLIGHT_CODES.BRANDKIT_MISSING_FIELD,
      message: `Required brand-kit field(s) missing: ${missingFields.join(', ')}`,
    });
  }

  if (brandKit) {
    // §8 LOGO_BELOW_MIN_WIDTH
    const minWidthMm = brandKit.logo?.minWidthMm ?? 0;
    const specLogoWidthMm = asset.spec?.logoWidthMm;
    if (specLogoWidthMm !== undefined && specLogoWidthMm < minWidthMm) {
      issues.push({
        code: PREFLIGHT_CODES.LOGO_BELOW_MIN_WIDTH,
        message: `Logo width ${specLogoWidthMm}mm is below brand-kit minimum ${minWidthMm}mm`,
      });
    }

    // §8 CONTRAST_FAIL_SMALL_PRINT
    const textColor = asset.spec?.textColor ?? brandKit.palette?.onSurface;
    const bgColor = asset.spec?.bgColor ?? brandKit.palette?.primary?.[0];
    if (textColor && bgColor) {
      try {
        const ratio = contrastRatio(textColor, bgColor);
        if (ratio < MIN_CONTRAST_SMALL_PRINT) {
          issues.push({
            code: PREFLIGHT_CODES.CONTRAST_FAIL_SMALL_PRINT,
            message: `Text/background contrast ratio ${ratio.toFixed(2)} is below WCAG AA minimum ${MIN_CONTRAST_SMALL_PRINT} for small print`,
          });
        }
      } catch {
        // Non-hex color — skip contrast check
      }
    }

    // §8 SPOTCOLOR_LIMIT_EXCEEDED (screen-print path only)
    if (asset.type === 'TSHIRT' && asset.spec?.printPath === 'screenprint') {
      const spotColors = asset.spec?.spotColors ?? [];
      if (spotColors.length > MAX_SPOT_COLORS) {
        issues.push({
          code: PREFLIGHT_CODES.SPOTCOLOR_LIMIT_EXCEEDED,
          message: `Screen-print spot colour count ${spotColors.length} exceeds maximum ${MAX_SPOT_COLORS}`,
        });
      }
    }

    // §8 FONT_NOT_ALLOWLISTED
    const headingUrl = brandKit.typography?.heading?.fileUrl;
    const bodyUrl = brandKit.typography?.body?.fileUrl;
    if (headingUrl && !isFontAllowlisted(headingUrl)) {
      issues.push({
        code: PREFLIGHT_CODES.FONT_NOT_ALLOWLISTED,
        message: `Heading font URL is not in the theme-engine allowlist: ${headingUrl}`,
      });
    }
    if (bodyUrl && !isFontAllowlisted(bodyUrl)) {
      issues.push({
        code: PREFLIGHT_CODES.FONT_NOT_ALLOWLISTED,
        message: `Body font URL is not in the theme-engine allowlist: ${bodyUrl}`,
      });
    }
  }

  // §8 GEOMETRY_OUT_OF_BOUNDS
  if (geometryOutOfBounds(asset.spec ?? {}, asset.type)) {
    issues.push({
      code: PREFLIGHT_CODES.GEOMETRY_OUT_OF_BOUNDS,
      message: 'Zone content crosses safe zone or extends into bleed unintentionally',
    });
  }

  // §8 CREDITS_INSUFFICIENT — supplied by the caller after checking credits balance.
  if (!creditsOk) {
    issues.push({
      code: PREFLIGHT_CODES.CREDITS_INSUFFICIENT,
      message: 'Insufficient credits to complete render',
    });
  }

  return { ok: issues.length === 0, issues };
}
