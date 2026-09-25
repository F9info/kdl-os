// Template-engine credit costs, in CREDITS (not µc — the documented
// invariant is 1 credit = 1,000,000 µc, per projects/service.js and how
// COLLATERAL_EXPORT_COST/GUIDELINES_PDF_ESTIMATE_MC are actually consumed:
// `BigInt(cost) * 1_000_000n`). Callers must apply that × 1,000,000
// conversion at the withCreditHold call site — see service.js's
// generateWebsiteCopy(). (brand-kit's BRAND_INFERENCE_COST skips this
// conversion at its call site, which is a separate, pre-existing bug —
// out of scope here; don't copy that call-site pattern into new code.)
export const WEBSITE_COPY_GENERATION_COST = 15; // AI copy pass (Hero + About)
