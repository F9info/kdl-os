// Local HTML-entity decoder for AI-generated prose fields (KDL-538).
//
// Covers the entity set that matters for real client names and brand copy.
// Does NOT pull in any new dependency.
//
// Double-escaping (&amp;amp; → &amp; → &) is resolved with a bounded pass
// loop (max 3 passes, stops early on convergence).

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

// Matches named entities we care about, decimal numeric (&#38;), and hex
// numeric (&#x26;) forms.  Bare ampersands not part of a valid entity are
// left untouched because the regex anchors at the semicolon.
const ENTITY_RE = /&(?:(amp|lt|gt|quot|apos|nbsp);|#([0-9]{1,6});|#x([0-9a-fA-F]{1,6});)/gi;

function onePass(str) {
  return str.replace(ENTITY_RE, (_match, named, decimal, hex) => {
    if (named) return NAMED_ENTITIES[named.toLowerCase()];
    if (decimal) {
      const cp = parseInt(decimal, 10);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : _match;
    }
    if (hex) {
      const cp = parseInt(hex, 16);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : _match;
    }
    return _match;
  });
}

/**
 * Decode HTML entities in a prose string.
 * Runs up to MAX_PASSES decoding passes to resolve double-escaping
 * (e.g. &amp;amp; → &amp; → &).  Stops early when the string stabilises.
 */
export function decodeHtmlEntities(str) {
  if (typeof str !== 'string') return str;
  const MAX_PASSES = 3;
  let cur = str;
  for (let i = 0; i < MAX_PASSES; i++) {
    const next = onePass(cur);
    if (next === cur) break;
    cur = next;
  }
  return cur;
}
