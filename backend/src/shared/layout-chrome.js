// Which blocks are the site's header and footer. The list lives with the editor
// (frontend/src/frontend/blocks/layout-chrome.json) so the editor, the publish checks and the page scaffold
// share one definition. Read the same way as numbered-families.json.
import fs from 'node:fs';
import path from 'node:path';

const TABLE_REL = 'src/frontend/blocks/layout-chrome.json';

function load() {
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
const chrome = () => (table ??= load());

/** Blocks the Layout page manages (top bar, header, footer): not part of a page's own content. */
export const layoutBlockTypes = () => new Set([...(chrome().start ?? []), ...(chrome().end ?? [])]);

/** The chrome blocks a new page copies from a page that already has them. */
export const scaffoldChromeTypes = () => chrome().scaffold ?? [];
