// Blocks that used to keep repeating items in numbered flat props (faq1Question, faq2Question…)
// now keep them in one array prop (faqs: [{ question, answer }]). The table lives with the editor
// (frontend/.../packs/numbered-families.json) so frontend and backend share one definition.
// normalizeData() converts any page data still using the old shape — called on every page write
// (seeders, API, imports) and by scripts/migrate-numbered-families.js.
import fs from 'node:fs';
import path from 'node:path';

const TABLE_REL = 'src/app/admin/page-builder/packs/numbered-families.json';

function loadTable() {
  const dirs = [process.env.FRONTEND_SRC_DIR, path.resolve(process.cwd(), '..', 'frontend')].filter(Boolean);
  for (const d of dirs) {
    try {
      return JSON.parse(fs.readFileSync(path.join(d, TABLE_REL), 'utf8'));
    } catch {
      /* try next location */
    }
  }
  return {};
}

let table;
const families = () => (table ??= loadTable());

const slotRe = (prefix) => new RegExp(`^${prefix}(\\d+)([A-Za-z]*)$`);
/** faq1Question → "question"; logo1 → "value". */
export const itemKey = (suffix) => (suffix ? suffix.charAt(0).toLowerCase() + suffix.slice(1) : 'value');
const isEmptyRow = (row) => Object.values(row).every((v) => v === '' || v == null);

/** Returns props with every numbered family of `type` folded into its array prop (new object only if changed). */
export function normalizeBlockProps(type, props) {
  const fams = families()[type];
  if (!fams || !props || typeof props !== 'object') return props;
  let out = props;
  for (const { prefix, prop } of fams) {
    const re = slotRe(prefix);
    const keys = Object.keys(out).filter((k) => re.test(k));
    if (!keys.length) continue;
    const slots = new Map();
    for (const k of keys) {
      const m = re.exec(k);
      const n = Number(m[1]);
      slots.set(n, { ...slots.get(n), [itemKey(m[2])]: out[k] });
    }
    const ordered = [...slots.entries()].sort(([a], [b]) => a - b);
    let rows;
    if (Array.isArray(out[prop])) {
      // overrides on top of an existing array (e.g. a sector's content over the shared template): slot n edits row n-1
      rows = out[prop].map((r) => ({ ...r }));
      for (const [n, row] of ordered) {
        for (let i = rows.length; i < n; i += 1) rows[i] = {};
        rows[n - 1] = { ...rows[n - 1], ...row };
      }
    } else {
      rows = ordered.map(([, row]) => row).filter((row) => !isEmptyRow(row));
    }
    out = { ...out, [prop]: rows };
    for (const k of keys) delete out[k];
  }
  return out;
}

const mapBlocks = (blocks) => {
  if (!Array.isArray(blocks)) return blocks;
  let changed = false;
  const next = blocks.map((b) => {
    const props = normalizeBlockProps(b?.type, b?.props);
    if (props === b?.props) return b;
    changed = true;
    return { ...b, props };
  });
  return changed ? next : blocks;
};

/** Puck data ({ content, zones }) with all numbered families converted. Same object back if nothing changed. */
export function normalizeData(data) {
  if (!data || typeof data !== 'object') return data;
  const content = mapBlocks(data.content);
  let zones = data.zones;
  if (zones && typeof zones === 'object') {
    let zChanged = false;
    const z = {};
    for (const [k, v] of Object.entries(zones)) {
      z[k] = mapBlocks(v);
      if (z[k] !== v) zChanged = true;
    }
    if (zChanged) zones = z;
  }
  return content === data.content && zones === data.zones ? data : { ...data, content, zones };
}
