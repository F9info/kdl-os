import { describe, it, expect, vi } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The closure scan only reads files; keep the generator's database import out of the way.
vi.mock('../../../config/database.js', () => ({ prisma: {} }));

const { collectFrontendClosure } = await import('./generator.js');

// The generator copies the import closure of the public website code into every generated site.
// Admin code must never end up there (it would ship the admin UI inside a customer's site), and
// the paths it names must exist in the real frontend (a rename there breaks generation).
const FE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  '..',
  'frontend'
);
const present = existsSync(path.join(FE, 'src', 'frontend', 'blocks', 'puck.config.tsx'));

describe.skipIf(!present)('generated site code = the public website area only', () => {
  it('resolves every root file and pulls in the block library', async () => {
    const { files } = await collectFrontendClosure(FE);
    const rel = files.map((f) => path.relative(FE, f).split(path.sep).join('/'));
    expect(rel).toEqual(
      expect.arrayContaining([
        'src/app/layout.tsx',
        'src/frontend/blocks/puck.config.tsx',
        'src/frontend/lib/header-overlay.ts',
        'src/app/(site)/[prefix]/[slug]/page.tsx',
      ])
    );
    expect(rel.length).toBeGreaterThan(30);
  });

  it('contains NO admin code (no src/admin, no app/admin routes)', async () => {
    const { files } = await collectFrontendClosure(FE);
    const admin = files
      .map((f) => path.relative(FE, f).split(path.sep).join('/'))
      .filter((f) => f.startsWith('src/admin/') || f.startsWith('src/app/admin/'));
    expect(admin).toEqual([]);
  });
});
