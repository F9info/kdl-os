import { describe, it, expect } from 'vitest';
import { readdir, readFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = join(__dirname, '../src/modules');
const FRONTEND_APP_DIR = join(__dirname, '../../frontend/src/app');

describe('module nav paths', () => {
  it('every declared nav path has a matching frontend page.tsx', async () => {
    const entries = await readdir(MODULES_DIR, { withFileTypes: true });
    const broken = [];

    for (const entry of entries.filter((e) => e.isDirectory())) {
      let manifest;
      try {
        const raw = await readFile(join(MODULES_DIR, entry.name, 'module.json'), 'utf8');
        manifest = JSON.parse(raw);
      } catch {
        continue; // directory has no module.json
      }

      for (const navItem of manifest.nav ?? []) {
        // navItem.path is absolute, e.g. /admin/template-engine
        const pagePath = join(FRONTEND_APP_DIR, navItem.path.replace(/^\//, ''), 'page.tsx');
        try {
          await access(pagePath);
        } catch {
          broken.push(`${entry.name}: ${navItem.path} (expected ${pagePath})`);
        }
      }
    }

    expect(
      broken,
      `Sidebar nav paths with no matching frontend page:\n${broken.join('\n')}`
    ).toHaveLength(0);
  });
});
