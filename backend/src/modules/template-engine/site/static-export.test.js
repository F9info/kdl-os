import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

vi.mock('../../../config/database.js', () => ({ prisma: {} }));

import { writeSite, buildSiteModel } from './generator.js';

// T8.1: a generated site can be built as plain static files (npm run build:static -> ./out).
describe('static export support in generated sites', () => {
  let dir;
  let site;
  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kdl-static-'));
    process.env.SITES_DIR = dir;
    const model = buildSiteModel({
      project: { id: 'p1', name: 'Demo', slug: 'demo' },
      kit: null,
      company: {},
      pages: [{ id: 'a', title: 'Home', slug: 'te-p1-home', data: { content: [], root: {} } }],
      menus: [],
    });
    await writeSite(model);
    site = path.join(dir, model.site.slug);
  });
  afterAll(async () => {
    delete process.env.SITES_DIR;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('adds a build:static script and the script itself', async () => {
    const pkg = JSON.parse(await fs.readFile(path.join(site, 'package.json'), 'utf8'));
    expect(pkg.scripts['build:static']).toBe('node scripts/build-static.mjs');
    await expect(fs.access(path.join(site, 'scripts', 'build-static.mjs'))).resolves.toBeUndefined();
  });

  it('keeps normal dev/start behaviour: export mode only when STATIC_EXPORT=1', async () => {
    const cfg = await fs.readFile(path.join(site, 'next.config.mjs'), 'utf8');
    expect(cfg).toContain("process.env.STATIC_EXPORT === '1'");
    expect(cfg).toContain("output: 'export'");
    expect(cfg).toContain('rewrites');
  });

  it('can pre-render every page route', async () => {
    const page = await fs.readFile(path.join(site, 'src', 'app', '[prefix]', 'page.tsx'), 'utf8');
    expect(page).toContain('generateStaticParams');
  });
});
