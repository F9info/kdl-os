// T14: what only a static export needs on top of the site model: search-engine files and a separate content
// folder. The export's pages come from a published-only model, so they are written to `content-export/`, which
// scripts/build-static.mjs swaps in for `content/` inside its throw-away build copy. The live site folder
// (dev/start, shows drafts) keeps its own `content/`.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Origin of the address the site will be hosted at ("https://example.com"), or null when empty or not http(s). */
export function normalizeSiteUrl(value) {
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.username || u.password) return null;
    return u.origin;
  } catch {
    return null;
  }
}

/**
 * robots.txt always; sitemap.xml only with a site address (a sitemap needs absolute URLs). Pages marked
 * "noindex" stay out of the sitemap.
 */
export function seoFiles(model, siteUrl) {
  const origin = normalizeSiteUrl(siteUrl);
  const robots = `User-agent: *\nAllow: /\n${origin ? `Sitemap: ${origin}/sitemap.xml\n` : ''}`;
  if (!origin) return { robots, sitemap: null };
  const urls = model.pages
    .filter((p) => !p.json.seo?.noindex)
    .map((p) => `  <url><loc>${xml(`${origin}${p.json.route ? `/${p.json.route}` : '/'}`)}</loc></url>`);
  return {
    robots,
    sitemap: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
  };
}

const ASSET_KEYS = ['logo_light', 'logo_dark', 'favicon', 'company_logo_light', 'company_logo_dark'];
const isStoragePath = (v) => typeof v === 'string' && v !== '' && !/^https?:\/\//i.test(v) && !v.startsWith('/');

/**
 * The identity a landing page shows (logo, company name, phone, email, address, brand colours): the project's
 * Application Identity with the landing site's own overrides on top (an empty override never wins), the same
 * merge the live page does. Logos are stored files that only a presigned, expiring link can reach, so each is
 * copied into the folder (static-assets/media) and the identity points at that copy.
 * `readAsset(storagePath)` returns a Buffer or null.
 */
export async function bakeIdentity(root, identity, overrides, readAsset) {
  const merged = { ...identity };
  for (const [k, v] of Object.entries(overrides ?? {})) if (typeof v === 'string' && v.trim()) merged[k] = v;
  if (overrides?.logo_light?.trim() && !overrides?.logo_dark?.trim()) delete merged.logo_dark;
  for (const k of ASSET_KEYS) {
    if (!isStoragePath(merged[k])) continue;
    const buf = await readAsset(merged[k]).catch(() => null);
    if (!buf) {
      merged[k] = '';
      continue;
    }
    const ext = path.extname(merged[k]).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.png';
    const name = `${createHash('sha1').update(merged[k]).digest('hex').slice(0, 16)}${ext}`;
    await fs.mkdir(path.join(root, 'static-assets', 'media'), { recursive: true });
    await fs.writeFile(path.join(root, 'static-assets', 'media', name), buf);
    merged[k] = `/media/${name}`;
  }
  return merged;
}

/**
 * Writes content-export/ and the SEO files into a site folder. `root` is that folder. `opts.identity` is the
 * Application Identity (stored values) and `opts.readAsset` reads a stored file; landing pages need both.
 */
export async function writeExportContent(root, model, siteUrl, { identity = {}, readAsset = async () => null } = {}) {
  const dir = path.join(root, 'content-export');
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(path.join(dir, 'pages'), { recursive: true });
  const json = (f, o) => fs.writeFile(path.join(dir, f), `${JSON.stringify(o, null, 2)}\n`);
  await json('site.json', { ...model.site, siteUrl: normalizeSiteUrl(siteUrl) });
  await json('menus.json', model.menus);
  await json('routes.json', { bySlug: Object.fromEntries(model.pages.map((p) => [p.json.slug, p.json.route])) });
  for (const p of model.pages) {
    if (!p.json.landing) {
      await json(path.join('pages', `${p.file}.json`), p.json);
      continue;
    }
    const { identityOverrides, ...rest } = p.json;
    await json(path.join('pages', `${p.file}.json`), { ...rest, identity: await bakeIdentity(root, identity, identityOverrides, readAsset) });
  }
  const { robots, sitemap } = seoFiles(model, siteUrl);
  const assets = path.join(root, 'static-assets');
  await fs.mkdir(assets, { recursive: true });
  await fs.writeFile(path.join(assets, 'robots.txt'), robots);
  if (sitemap) await fs.writeFile(path.join(assets, 'sitemap.xml'), sitemap);
  else await fs.rm(path.join(assets, 'sitemap.xml'), { force: true });
}
