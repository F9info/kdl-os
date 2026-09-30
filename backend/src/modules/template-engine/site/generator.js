// Generates a standalone Next.js app for a project into
// <SITES_DIR>/<project-slug>/ (default: frontend/projects/). Content
// (site.json, menus.json, pages/*.json) is rewritten from the DB on every
// build; the app shell in ./templates is copied verbatim. Friendly URLs:
// every page is served at /<slugified-title> (Home at /), never /p/te-<id>.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../../../config/database.js';
import { slugify } from '../../../shared/utils/slug.js';
import { getCompanyInfo } from '../../brand-kit/contact-fields.js';

const TEMPLATES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'templates');
const MARKER = '.kdl-site.json';
const RESERVED = new Set(['api', '_next', 'static']);

export const sitesDir = () =>
  path.resolve(process.env.SITES_DIR || path.join(process.cwd(), '..', 'frontend', 'projects'));

// ─── pure: DB rows → site model ──────────────────────────────────────────────

const isHome = (p) => /^home$/i.test(p.title.trim()) || /(^|-)home$/.test(p.slug);

/** Friendly, unique route per page. Home → '' (root). */
export function assignRoutes(pages) {
  const used = new Set(['']);
  let homeTaken = false;
  return pages.map((p) => {
    if (isHome(p) && !homeTaken) {
      homeTaken = true;
      return { ...p, route: '' };
    }
    let base = slugify(p.title) || 'page';
    if (RESERVED.has(base)) base = `${base}-page`;
    let route = base;
    for (let n = 2; used.has(route); n += 1) route = `${base}-${n}`;
    used.add(route);
    return { ...p, route };
  });
}

function menuTree(items, hrefFor) {
  const nodes = new Map(
    items.filter((i) => i.is_active).map((i) => [i.id, { i, children: [] }])
  );
  const roots = [];
  for (const n of nodes.values()) {
    const parent = n.i.parent_id && nodes.get(n.i.parent_id);
    (parent ? parent.children : roots).push(n);
  }
  const out = (list) =>
    list
      .sort((a, b) => a.i.order - b.i.order)
      .map(({ i, children }) => ({
        label: i.label,
        href: i.no_page ? null : hrefFor(i),
        newTab: i.open_in_new_tab,
        children: out(children),
      }));
  return out(roots);
}

// Brand values end up in generated CSS/HTML — allowlist, never trust.
const HEX = /^#[0-9a-fA-F]{3,8}$/;
const FONT = /^[A-Za-z0-9 _-]{1,60}$/;
const safe = (re, v, fallback) => (typeof v === 'string' && re.test(v.trim()) ? v.trim() : fallback);

export function buildSiteModel({ project, kit, company, pages, menus }) {
  const routed = assignRoutes(pages);
  const byId = new Map(routed.map((p) => [p.id, p.route]));
  const bySlug = new Map(routed.map((p) => [p.slug, p.route]));
  const toHref = (route) => (route ? `/${route}` : '/');
  const hrefFor = (i) => {
    if (i.page_id && byId.has(i.page_id)) return toHref(byId.get(i.page_id));
    const m = /^\/p\/([^/?#]+)/.exec(i.url ?? '');
    if (m && bySlug.has(m[1])) return toHref(bySlug.get(m[1]));
    return i.url || '#';
  };
  const menuOf = (key) => {
    const m = menus.find((x) => x.key === key);
    return m ? menuTree(m.items, hrefFor) : [];
  };
  return {
    site: {
      projectId: project.id,
      slug: project.slug,
      name: company?.company_name || project.name,
      company: company ?? {},
      colors: {
        primary: safe(HEX, kit?.palette?.colors?.primary?.hex, '#1d4ed8'),
        secondary: safe(HEX, kit?.palette?.colors?.secondary?.hex, '#0f172a'),
      },
      fonts: {
        heading: safe(FONT, kit?.typography?.heading?.family, 'Inter'),
        body: safe(FONT, kit?.typography?.body?.family, 'Inter'),
      },
      generatedAt: new Date().toISOString(),
    },
    menus: { header: menuOf('header'), footer: menuOf('footer') },
    pages: routed.map((p) => ({
      file: p.route === '' ? 'index' : p.route,
      json: { route: p.route, slug: p.slug, projectId: project.id, title: p.title, status: p.status, data: p.data },
    })),
  };
}

// ─── DB → input ──────────────────────────────────────────────────────────────

export async function collectSiteInput(projectId) {
  const project = await prisma.project.findFirst({ where: { id: projectId, deleted_at: null } });
  if (!project) throw Object.assign(new Error('Project not found'), { status: 404 });
  const [kit, company, rows, menus] = await Promise.all([
    prisma.brandKit.findUnique({ where: { project_id: projectId } }),
    getCompanyInfo(projectId),
    prisma.builderPage.findMany({
      where: { project_id: projectId, deleted_at: null },
      orderBy: { created_at: 'asc' },
    }),
    prisma.menu.findMany({
      where: { project_id: projectId, key: { in: ['header', 'footer'] } },
      include: { items: true },
    }),
  ]);
  // Detail pages read their layout from the shared template (see page-builder getPage).
  const tplIds = [...new Set(rows.map((r) => r.template_id).filter(Boolean))];
  const tpls = tplIds.length
    ? await prisma.detailPageTemplate.findMany({ where: { id: { in: tplIds } } })
    : [];
  const tplData = new Map(tpls.map((t) => [t.id, t.data]));
  const pages = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    status: r.status,
    data: (r.template_id && tplData.get(r.template_id)) || r.data,
  }));
  return { project, kit, company, pages, menus };
}

// ─── fs ──────────────────────────────────────────────────────────────────────

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  for (const e of await fs.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

// ─── admin-frontend code the generated app renders with ─────────────────────
// The generated site renders pages with the SAME Puck config, components,
// Tailwind config and theme CSS as the admin's /p/<slug> — copied (import
// closure) from the admin frontend so both look identical.

export const frontendDir = () =>
  path.resolve(process.env.FRONTEND_SRC_DIR || path.join(process.cwd(), '..', 'frontend'));

// Root layout + Puck config, plus the admin's public detail routes (/work/<slug>,
// /catalog/<slug>, /sectors/<slug>) that block links such as "See Our Work" point at.
const ROOT_FILES = [
  'src/app/layout.tsx',
  'src/app/admin/page-builder/puck.config.tsx',
  'src/app/work/[slug]/page.tsx',
  'src/app/catalog/[slug]/page.tsx',
  'src/app/sectors/[slug]/page.tsx',
];
const CONFIG_FILES = ['tailwind.config.ts', 'postcss.config.js'];
const IMPORT_RE =
  /(?:import|export)\s+(?:[^'"()]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const EXTS = ['', '.ts', '.tsx', '.js', '.jsx', '.css', '/index.ts', '/index.tsx'];

const isFile = (f) => fs.stat(f).then((s) => s.isFile(), () => false);

async function resolveLocal(fe, spec, from) {
  const base = spec.startsWith('@/')
    ? path.join(fe, 'src', spec.slice(2))
    : path.resolve(path.dirname(from), spec);
  for (const e of EXTS) if (await isFile(base + e)) return base + e;
  return null;
}

const pkgName = (spec) =>
  spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];

/** Import closure of ROOT_FILES → { files: absolute paths, packages: Set }. */
export async function collectFrontendClosure(fe = frontendDir()) {
  const files = new Set();
  const packages = new Set();
  const stack = [...ROOT_FILES.map((f) => path.join(fe, f)), ...CONFIG_FILES.map((f) => path.join(fe, f))];
  for (let guard = 0; stack.length && guard < 5000; guard += 1) {
    const f = stack.pop();
    if (files.has(f)) continue;
    files.add(f);
    if (f.endsWith('.css')) continue;
    for (const m of (await fs.readFile(f, 'utf8')).matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2];
      if (spec.startsWith('.') || spec.startsWith('@/')) {
        const r = await resolveLocal(fe, spec, f);
        if (r) stack.push(r);
      } else if (!spec.startsWith('node:')) {
        packages.add(pkgName(spec));
      }
    }
  }
  return { files: [...files], packages };
}

async function copyFrontendCode(root, fe = frontendDir()) {
  const { files, packages } = await collectFrontendClosure(fe);
  for (const f of files) {
    const dest = path.join(root, path.relative(fe, f));
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(f, dest);
  }
  // tailwind/postcss are used by config files, not always imported.
  for (const p of ['tailwindcss', 'postcss', 'autoprefixer', 'typescript', 'next', 'react', 'react-dom']) packages.add(p);
  const fePkg = JSON.parse(await fs.readFile(path.join(fe, 'package.json'), 'utf8'));
  const versions = { ...fePkg.devDependencies, ...fePkg.dependencies };
  const deps = {};
  for (const p of [...packages].sort()) if (versions[p]) deps[p] = versions[p];
  for (const p of ['@types/node', '@types/react', '@types/react-dom']) deps[p] = versions[p] ?? 'latest';
  return deps;
}

const writeJson = (file, obj) => fs.writeFile(file, `${JSON.stringify(obj, null, 2)}\n`);

export async function writeSite(model) {
  const root = path.resolve(sitesDir(), model.site.slug);
  if (!root.startsWith(sitesDir() + path.sep)) throw new Error('Unsafe site path');
  await fs.rm(path.join(root, 'src'), { recursive: true, force: true }); // managed dir
  await copyDir(TEMPLATES_DIR, root);
  const deps = await copyFrontendCode(root);
  await fs.mkdir(path.join(root, 'content', 'pages'), { recursive: true });

  await writeJson(path.join(root, 'package.json'), {
    name: `site-${model.site.slug}`,
    private: true,
    scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
    dependencies: deps,
  });
  await writeJson(path.join(root, 'content', 'site.json'), model.site);
  await writeJson(path.join(root, 'content', 'menus.json'), model.menus);
  await writeJson(path.join(root, 'content', 'routes.json'), {
    bySlug: Object.fromEntries(model.pages.map((p) => [p.json.slug, p.json.route])),
  });

  const keep = new Set(model.pages.map((p) => `${p.file}.json`));
  for (const f of await fs.readdir(path.join(root, 'content', 'pages'))) {
    if (!keep.has(f)) await fs.rm(path.join(root, 'content', 'pages', f));
  }
  for (const p of model.pages) {
    await writeJson(path.join(root, 'content', 'pages', `${p.file}.json`), p.json);
  }
  // Public detail routes read their project scope from here, not from ?projectId=.
  await fs.writeFile(
    path.join(root, '.env.local'),
    `NEXT_PUBLIC_SITE_PROJECT_ID=${model.site.projectId}\n`
  );
  await writeJson(path.join(root, MARKER), {
    projectId: model.site.projectId,
    generatedAt: model.site.generatedAt,
  });
  return { slug: model.site.slug, dir: root, pages: model.pages.length };
}

export async function buildSite(projectId) {
  return writeSite(buildSiteModel(await collectSiteInput(projectId)));
}

/** projectIds of every site folder that has been generated (marker present). */
export async function listGeneratedProjectIds() {
  let dirs = [];
  try {
    dirs = await fs.readdir(sitesDir(), { withFileTypes: true });
  } catch {
    return [];
  }
  const ids = [];
  for (const d of dirs.filter((e) => e.isDirectory())) {
    try {
      ids.push(JSON.parse(await fs.readFile(path.join(sitesDir(), d.name, MARKER), 'utf8')).projectId);
    } catch {
      /* not a generated site */
    }
  }
  return ids;
}

export const siteExists = async (slug) =>
  fs.access(path.join(sitesDir(), slug, MARKER)).then(() => true, () => false);
