// Brand-kit credit costs (µc = micro-credits).
// Callers that trigger metered operations must call reserveCredits() from
// the credits service with these amounts before executing the operation.
// See KDL-505 for the collateral export consumer following the same pattern.
export const BRAND_INFERENCE_COST = 10;  // AI inference pass (Phase 2+)
export const COLLATERAL_EXPORT_COST = 5; // PDF/collateral export
