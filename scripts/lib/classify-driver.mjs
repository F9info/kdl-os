/**
 * classify-driver.mjs — pure driver-body classification logic (KDL-536).
 *
 * Extracted from status-rollup.mjs so the classifier can be unit-tested without
 * executing the top-level script (which calls the Paperclip API and reads the FS).
 */

/** Drivers that make no downstream call by design — pure local aggregates. */
export const NO_DOWNSTREAM_BY_DESIGN = new Set(['preflight', 'export']);

/** Strip JS block and line comments so they cannot influence classification. */
export function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** Brace-matching extraction of `const <varName> = { ... }` body. */
export function extractObjectBody(src, varName) {
  const start = src.search(new RegExp(`const\\s+${varName}\\s*=\\s*\\{`));
  if (start < 0) return null;
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

/**
 * Classify a single driver body string.
 *
 * @param {string} body - The driver object source (result of extractObjectBody).
 * @param {{ stage: string, upstreamSymbols?: Set<string>, noDownstreamByDesign?: Set<string> }} opts
 * @returns {{ status: string, evidence: string }}
 */
export function classifyDriverBody(body, { stage, upstreamSymbols = new Set(), noDownstreamByDesign = NO_DOWNSTREAM_BY_DESIGN } = {}) {
  const callsUpstream =
    /\bfetch\s*\(/.test(body) ||
    /\baxios\b/.test(body) ||
    [...upstreamSymbols].some((sym) => new RegExp(`\\b${sym}\\b`).test(body));

  // Key off the error-code string, not the helper function name, so a helper rename
  // cannot silently regress this check (KDL-536: notBuilt() → namedErr(..., 'UPSTREAM_NOT_BUILT')).
  if (/['"]UPSTREAM_NOT_BUILT['"]/.test(body)) {
    return { status: 'UPSTREAM_NOT_BUILT', evidence: "throws with error code 'UPSTREAM_NOT_BUILT' (503 stub)" };
  }
  if (callsUpstream) {
    return { status: 'REAL', evidence: 'calls an upstream module' };
  }
  if (noDownstreamByDesign.has(stage)) {
    return { status: 'REAL', evidence: 'pure local aggregate — no downstream call by design' };
  }
  return { status: 'NO_DOWNSTREAM', evidence: 'resolves without calling its upstream module — silent no-op' };
}
