// SVG sanitizer — strips active content from SVG uploads before storage.
// Defense-in-depth for stored-XSS via SVG: removes script/foreignObject elements,
// event-handler attributes, javascript:/data-html URIs, and DTD entity declarations.

const SCRIPT_BLOCKS = /<script\b[\s\S]*?<\/script\s*>/gi;
const SCRIPT_SELF_CLOSED = /<script\b[^>]*\/>/gi;
const FOREIGN_OBJECT_BLOCKS = /<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi;
const FOREIGN_OBJECT_SELF_CLOSED = /<foreignObject\b[^>]*\/>/gi;
// Orphaned open/close tags left by evasion attempts (<scr<script>ipt>)
const SCRIPT_TAG_FRAGMENTS = /<\/?script\b[^>]*>/gi;
const FOREIGN_OBJECT_TAG_FRAGMENTS = /<\/?foreignObject\b[^>]*>/gi;
// on* event handler attributes: onclick="..." / onload='...' / onerror=x
const EVENT_HANDLER_ATTRS = /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
// Any href/xlink:href/src attribute — the VALUE is normalized (entity-decoded,
// whitespace-stripped) before the scheme check so `&#106;avascript:` and
// `java\tscript:` cannot slip past a literal-substring match.
const URI_ATTRS = /\s(?:href|xlink:href|src)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
// DOCTYPE with internal subset (entity expansion / billion laughs)
const DOCTYPE_INTERNAL_SUBSET = /<!DOCTYPE\b[^>[]*\[[\s\S]*?\]\s*>/gi;
const ENTITY_DECLS = /<!ENTITY\b[\s\S]*?>/gi;

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", tab: '\t', newline: '\n' };

const decodeXmlEntities = (value) =>
  value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);?/g, (_, dec) => {
      const code = Number(dec);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);

// Scheme check runs on the DECODED, whitespace-stripped value — this is what the
// browser's XML parser will see, not the raw bytes.
const isDangerousUri = (rawValue) => {
  let v = rawValue.replace(/^["']|["']$/g, '');
  for (let i = 0; i < 3; i++) {
    const before = v;
    v = decodeXmlEntities(v);
    if (v === before) break;
  }
  // Browsers ignore ASCII control chars + whitespace inside scheme names
  v = v.replace(/[\u0000-\u0020\u00a0\ufeff]+/g, '').toLowerCase();
  if (/^(javascript|vbscript|livescript|mocha):/.test(v)) return true;
  // data: URIs are only safe as raster images — nested SVG/html can carry script
  if (v.startsWith('data:')) return !/^data:image\/(png|gif|jpe?g|webp|bmp|avif);/.test(v);
  return false;
};

export const sanitizeSvg = (input) => {
  let svg = Buffer.isBuffer(input) ? input.toString('utf8') : String(input);
  // Iterate until stable: stripping one layer can expose another
  // (e.g. <scr<script>ipt>) — bounded to avoid pathological loops.
  for (let i = 0; i < 10; i++) {
    const before = svg;
    svg = svg
      .replace(DOCTYPE_INTERNAL_SUBSET, '')
      .replace(ENTITY_DECLS, '')
      .replace(SCRIPT_BLOCKS, '')
      .replace(SCRIPT_SELF_CLOSED, '')
      .replace(SCRIPT_TAG_FRAGMENTS, '')
      .replace(FOREIGN_OBJECT_BLOCKS, '')
      .replace(FOREIGN_OBJECT_SELF_CLOSED, '')
      .replace(FOREIGN_OBJECT_TAG_FRAGMENTS, '')
      .replace(EVENT_HANDLER_ATTRS, '')
      .replace(URI_ATTRS, (match, value) => (isDangerousUri(value) ? '' : match));
    if (svg === before) break;
  }
  return Buffer.from(svg, 'utf8');
};

export const isSvgMime = (mime) => mime === 'image/svg+xml';
