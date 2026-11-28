// Step 2 of the f9tech.com migration: pages. Every page is data/pages/<key>.json (blocks + props) wrapped
// with the shared header and footer blocks (data/layout.json) and written through the page-builder API.
// Image tokens "@img:src/images/x.svg" become "/seed/f9tech/x.svg" (files in frontend/public/seed/f9tech).
// Idempotent: a page is matched by slug, its content replaced, then published. The starter demo pages that
// are not part of f9tech.com are unpublished (not deleted).
//
//   API_URL=http://localhost:10102 SEED_EMAIL=... SEED_PASSWORD=... node scripts/f9tech-site/seed-step2.mjs [--dry-run]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const API = (process.env.API_URL ?? 'http://localhost:10102').replace(/\/$/, '');
const DRY = process.argv.includes('--dry-run');
const read = (f) => JSON.parse(fs.readFileSync(path.join(here, 'data', f), 'utf8'));
if (!process.env.SEED_EMAIL || !process.env.SEED_PASSWORD) throw new Error('Set SEED_EMAIL and SEED_PASSWORD');

let token = '';
let projectId = '';
async function call(method, url, body) {
  const res = await fetch(API + url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(projectId ? { 'X-Project-Id': projectId } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${json.message ?? ''}`);
  return json.data ?? json;
}
const log = (...a) => console.log('[step2]', ...a);

const img = (v) => (typeof v === 'string' && v.startsWith('@img:') ? '/seed/f9tech/' + v.slice(5).replace(/^src\/images\//, '').replace(/^src\//, '') : v);
const deep = (o) => (typeof o === 'string' ? img(o) : Array.isArray(o) ? o.map(deep) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, deep(v)])) : o);
// A list prop is one string; its image tokens sit inside the lines.
const tokens = (s) => (typeof s === 'string' ? s.replace(/@img:[^\s|;]+/g, (m) => img(m)) : s);

async function login() {
  const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.SEED_EMAIL, password: process.env.SEED_PASSWORD }) });
  token = (await res.json()).data?.accessToken;
  if (!token) throw new Error('Login failed');
  const projects = await call('GET', '/api/projects');
  projectId = (projects.find((p) => p.is_default) ?? projects[0]).id;
}

function layoutBlocks(identity) {
  const L = read('layout.json');
  const f = L.footer;
  const socials = f.socials.map((s) => [s.label, s.href ?? identity[s.identityKey] ?? '', img(s.icon)]).filter((r) => r[1]).map((r) => r.join(' | ')).join('\n');
  const header = { type: 'F9Header', props: { id: 'f9-header', logoUrl: '', ctaLast: L.header.ctaLast, links: '' } };
  const footer = {
    type: 'F9Footer',
    props: {
      id: 'f9-footer', logoUrl: '', bottomMenuLabel: f.bottomMenuLabel, socials,
      partnerLogos: f.partnerLogos.map((p) => [p.name, img(p.image), p.href].join(' | ')).join('\n'),
      badges: f.badges.map((b) => [img(b.image), b.href].join(' | ')).join('\n'),
      bottomLinks: f.bottomLinks.map((b) => [b.label, b.href].join(' | ')).join('\n'),
      decoImage: img(f.decoImage),
    },
  };
  return { header, footer, L };
}

function pageData(key, page, header, footer) {
  const body = page.blocks.map((b, i) => ({ type: b.type, props: { id: `${key}-${i}-${b.type}`, ...Object.fromEntries(Object.entries(b.props).map(([k, v]) => [k, tokens(v)])) } }));
  return { root: { props: { title: page.title } }, content: [{ ...header, props: { ...header.props, id: `${key}-header` } }, ...body, { ...footer, props: { ...footer.props, id: `${key}-footer` } }], zones: {} };
}

async function main() {
  await login();
  const identity = (await (await fetch(`${API}/api/app-config`)).json()).data.identity;
  const { header, footer, L } = layoutBlocks(identity);
  // Forms first: a Contact block points at its form by slug.
  const forms = (await call('GET', '/api/forms')).items ?? [];
  for (const form of read('forms.json').forms) {
    if (forms.some((f) => f.slug === form.slug)) continue;
    if (DRY) { log(`form ${form.slug} (dry)`); continue; }
    await call('POST', '/api/forms', form);
    log(`form ${form.slug} created`);
  }
  const existing = (await call('GET', '/api/page-builder?limit=200')).items;
  const bySlug = new Map(existing.map((p) => [p.slug, p]));
  for (const key of L.pages.order) {
    const page = read(`pages/${key}.json`);
    const data = pageData(key, page, header, footer);
    if (DRY) { log(`${key} (dry)`, data.content.length, 'blocks'); continue; }
    let rec = bySlug.get(key);
    const adminTitle = L.pages.titles?.[key] ?? page.title;
    if (!rec) rec = await call('POST', '/api/page-builder', { title: adminTitle, slug: key, data });
    const id = (rec.page ?? rec).id;
    await call('PUT', `/api/page-builder/${id}`, { data, seo: { title: page.title, ...(page.description ? { description: page.description } : {}) } }).catch((e) => log('seo/update note', key, e.message));
    await call('POST', `/api/page-builder/${id}/publish`, { data, force: true });
    log(`${key} published`);
  }
  for (const slug of L.pages.unpublishDemoSlugs) {
    const rec = bySlug.get(slug);
    if (!rec || rec.status !== 'PUBLISHED' || DRY) continue;
    await call('POST', `/api/page-builder/${rec.id}/unpublish`, {});
    log(`${slug} unpublished`);
  }
  log('done');
}
await main();
