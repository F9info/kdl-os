// Section schema metadata (T7.1): per block type, each field's kind, editor tab and allowed values.
// The file is generated from the block library and committed with the frontend
// (frontend/src/frontend/blocks/section-schemas.json). Same sharing pattern as numbered-families.js.
import fs from 'node:fs';
import path from 'node:path';

const FILE_REL = 'src/frontend/blocks/section-schemas.json';

function load() {
  const dirs = [process.env.FRONTEND_SRC_DIR, path.resolve(process.cwd(), '..', 'frontend')].filter(Boolean);
  for (const d of dirs) {
    try {
      return JSON.parse(fs.readFileSync(path.join(d, FILE_REL), 'utf8'));
    } catch {
      /* try next location */
    }
  }
  return null; // frontend source not available here: callers skip schema checks rather than guess
}

let cached;
/** { [blockType]: { label, fields: { [prop]: { kind, tab, options?, hidden? } } } }, or null when unavailable. */
export const getSectionSchemas = () => (cached === undefined ? (cached = load()) : cached);
