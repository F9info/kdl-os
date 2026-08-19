// Versioned Claude price table (KDL-471 §7 / OQ-D delta, CEO ruling on KDL-451).
//
// claudeBrain returns cost: null (subscription transport), so brand-inference
// computes estimatedCostUsd itself from returned token usage. The OQ-D delta is
// binding: the table is a single versioned config module and every metering
// record stamps PRICE_TABLE_VERSION, so historical rows stay auditable after a
// price change. Bump the version on ANY rate edit — never mutate in place.
//
// Unknown model ids are priced by tier prefix, defaulting to the flagship rate:
// over-estimating an unknown model is auditable and correctable via the version
// stamp; under-billing silently is not.

export const PRICE_TABLE_VERSION = 'pt-2026-08-19.1';

// USD per million tokens, { in, out }.
const USD_PER_MTOK = {
  'claude-fable-5': { in: 10, out: 50 },
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-opus-4-7': { in: 5, out: 25 },
  'claude-opus-4-6': { in: 5, out: 25 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
};

// Tier fallbacks for ids not in the exact table (e.g. a newer opus release
// before this table is updated). Flagship rate when even the tier is unknown.
const TIER_RATES = [
  { prefix: 'claude-haiku', rate: { in: 1, out: 5 } },
  { prefix: 'claude-sonnet', rate: { in: 3, out: 15 } },
  { prefix: 'claude-opus', rate: { in: 10, out: 50 } },
];
const FLAGSHIP_RATE = { in: 10, out: 50 };

export function rateFor(model) {
  if (model && USD_PER_MTOK[model]) return USD_PER_MTOK[model];
  const tier = TIER_RATES.find((t) => model?.startsWith(t.prefix));
  return tier ? tier.rate : FLAGSHIP_RATE;
}

/** usage: { input_tokens, output_tokens } (brainRouter shape). Returns USD. */
export function estimateCostUsd(model, usage) {
  const rate = rateFor(model);
  const inTok = usage?.input_tokens ?? 0;
  const outTok = usage?.output_tokens ?? 0;
  const usd = (inTok * rate.in + outTok * rate.out) / 1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
}
