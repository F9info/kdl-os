// HTML-escape utility for zone content — COLLATERAL_SPEC.md §11.
// All user-supplied text (contact fields, letter body, ID holder data) MUST
// be escaped before embedding into any HTML template or PDF text layer.
// This is the single hardened boundary; no raw HTML injection into print templates.

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#x60;',
};

export function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"'`]/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

// Escape all string values in a zone-content object recursively.
export function escapeZoneContent(obj) {
  if (obj == null) return obj;
  if (typeof obj === 'string') return escapeHtml(obj);
  if (Array.isArray(obj)) return obj.map(escapeZoneContent);
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = escapeZoneContent(v);
    }
    return out;
  }
  return obj;
}
