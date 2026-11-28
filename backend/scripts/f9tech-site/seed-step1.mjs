// Step 1 of the f9tech.com migration: brand identity, website palette, navigation, media library.
// Everything lives in ./data/*.json and is written through the public admin API (no DB access).
// Idempotent: identity/theme are overwritten with the same values, menus are rebuilt, media is
// skipped when assets-map.json already lists the file.
//
//   API_URL=http://localhost:10102 SEED_EMAIL=... SEED_PASSWORD=... \
//   F9_REACT_DIR=/path/to/f9tech_react node scripts/f9tech-site/seed-step1.mjs [--skip-media] [--dry-run]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const API = (process.env.API_URL ?? 'http://localhost:10102').replace(/\/$/, '');
const REACT = process.env.F9_REACT_DIR;
const DRY = process.argv.includes('--dry-run');
const read = (f) => JSON.parse(fs.readFileSync(path.join(here, 'data', f), 'utf8'));
const mapFile = path.join(here, 'data', 'assets-map.json');

if (!process.env.SEED_EMAIL || !process.env.SEED_PASSWORD) throw new Error('Set SEED_EMAIL and SEED_PASSWORD');

let token = '';
let projectId = '';
async function call(method, url, body, isForm) {
  const res = await fetch(API + url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}), ...(projectId ? { 'X-Project-Id': projectId } : {}) },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${json.message ?? ''}`);
  return json.data ?? json;
}
const log = (...a) => console.log('[step1]', ...a);

async function login() {
  const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.SEED_EMAIL, password: process.env.SEED_PASSWORD }) });
  const j = await res.json();
  token = j.data?.accessToken ?? j.data?.token;
  if (!token) throw new Error('Login failed');
  const projects = await call('GET', '/api/projects');
  projectId = (projects.find((p) => p.is_default) ?? projects[0]).id;
  log('project', projectId);
}

const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}
async function uploadFile(abs) {
  const buf = fs.readFileSync(abs);
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: MIME[path.extname(abs).toLowerCase()] }), path.basename(abs));
  const r = await call('POST', '/api/media/upload/single', fd, true);
  const m = r.media?.[0] ?? r.media ?? r;
  return { id: m.id, path: m.path };
}
async function media() {
  if (!REACT) throw new Error('Set F9_REACT_DIR');
  const map = fs.existsSync(mapFile) ? JSON.parse(fs.readFileSync(mapFile, 'utf8')) : {};
  const files = [...walk(path.join(REACT, 'src', 'images')), path.join(REACT, 'src', 'logo.svg'), ...walk(path.join(REACT, 'public'))]
    .filter((f) => MIME[path.extname(f).toLowerCase()] && fs.existsSync(f));
  let n = 0;
  for (const f of files) {
    const key = path.relative(REACT, f);
    if (map[key]) continue;
    if (DRY) { n++; continue; }
    try { map[key] = await uploadFile(f); n++; } catch (e) { log('upload failed', key, e.message); }
    fs.writeFileSync(mapFile, JSON.stringify(map, null, 2));
  }
  log(`media: ${n} uploaded, ${Object.keys(map).length} total mapped`);
  return map;
}

async function identity(map) {
  const d = read('identity.json');
  const { logo_source, _note, ...fields } = d;
  fields.copyright = fields.copyright.replace('{year}', String(new Date().getFullYear()));
  const logo = map?.[logo_source];
  if (logo) Object.assign(fields, { logo_light: logo.path, company_logo_light: logo.path });
  if (DRY) return log('identity (dry)', Object.keys(fields));
  await call('PUT', '/api/identity', fields);
  log('identity saved');
}

async function palette() {
  const p = read('palette.json');
  const schema = await call('GET', `/api/theme-engine/schema?platform=${p.platform}`);
  const pane = (schema.schema ?? []).find((x) => x.id === 'branding');
  if (!pane) throw new Error('Branding pane not found');
  const prefix = `${p.platform}.branding.${p.mode}.`;
  const fields = [];
  (function collect(n) {
    if (Array.isArray(n)) return n.forEach(collect);
    if (!n || typeof n !== 'object') return;
    if (n.slug?.startsWith(prefix) && n.input_type) fields.push(n);
    Object.values(n).forEach(collect);
  })(pane);
  if (!fields.length) throw new Error(`No branding fields found for ${prefix}`);
  const values = fields.map((f) => {
    const key = f.slug.slice(prefix.length);
    return { field_id: f.id, value: p.quick[key] ?? f.value ?? '' };
  });
  if (DRY) return log('palette (dry)', values.length, 'fields');
  // The Brand Kit locks the website colours while a template run owns them; taking over is what the admin's "Take over to edit" button does.
  await call('POST', '/api/theme-engine/locks/release', { platform: p.platform }).catch(() => {});
  await call('POST', '/api/theme-engine/values', { platform: p.platform, type_id: pane.type_id, values });
  log('palette saved', Object.keys(p.quick).length, 'colours');
}

async function menus() {
  const data = read('menus.json');
  const { items: existing } = await call('GET', '/api/menus');
  const pages = await call('GET', '/api/page-builder?limit=200').catch(() => ({ items: [] }));
  const bySlug = new Map((pages.items ?? pages ?? []).map((p) => [p.slug, p.id]));
  for (const key of ['header', 'footer']) {
    let menu = existing.find((m) => m.key === key);
    if (!menu) menu = await call('POST', '/api/menus/ensure', { project_id: projectId, key, name: key === 'header' ? 'Header Navigation' : 'Footer Navigation' });
    if (DRY) { log(`menu ${key} (dry)`, data[key].length); continue; }
    // Rebuild: remove every top-level item (children go with them), then add the new tree.
    const full = await call('GET', `/api/menus/${menu.id}`);
    for (const it of full.menu?.items ?? full.items ?? []) await call('DELETE', `/api/menus/items/${it.id}`);
    const add = async (item, parent_id, order) => {
      const body = {
        label: item.label,
        order,
        parent_id,
        ...(item.external
          ? { link_type: 'external', url: item.url, open_in_new_tab: true }
          : bySlug.get(item.page)
            ? { link_type: 'page', page_id: bySlug.get(item.page), url: item.url }
            : { link_type: 'custom', url: item.url, no_page: true }),
      };
      const res = await call('POST', `/api/menus/${menu.id}/items`, body);
      const created = res.item ?? res.menuItem ?? res;
      for (const [i, c] of (item.children ?? []).entries()) await add(c, created.id, i);
    };
    for (const [i, it] of data[key].entries()) await add(it, null, i);
    log(`menu ${key} rebuilt`, data[key].length, 'top-level items');
  }
  await call('PUT', '/api/menus/options', { footer_same_as_header: false });
}

await login();
const map = process.argv.includes('--skip-media') ? (fs.existsSync(mapFile) ? JSON.parse(fs.readFileSync(mapFile, 'utf8')) : {}) : await media();
await identity(map);
await palette();
await menus();
log('done');
