// Step 3 of the f9tech.com migration: the project's header/footer layout (Frontend > Layouts).
// Selects the "F9 Tech" design for header and footer and saves its settings (data/layout.json) with the
// layout, so every page shares one source. Links, contact details, logo and copyright are not stored here:
// the blocks read them live from Navigation and Identity.
//
//   API_URL=http://localhost:10102 SEED_EMAIL=... SEED_PASSWORD=... node scripts/f9tech-site/seed-step3.mjs [--dry-run]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const API = (process.env.API_URL ?? 'http://localhost:10102').replace(/\/$/, '');
const DRY = process.argv.includes('--dry-run');
const L = JSON.parse(fs.readFileSync(path.join(here, 'data', 'layout.json'), 'utf8'));
if (!process.env.SEED_EMAIL || !process.env.SEED_PASSWORD) throw new Error('Set SEED_EMAIL and SEED_PASSWORD');

const img = (v) => (typeof v === 'string' && v.startsWith('@img:') ? '/seed/f9tech/' + v.slice(5).replace(/^src\/images\//, '').replace(/^src\//, '') : v);
let token = '';
async function call(method, url, body) {
  const res = await fetch(API + url, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${json.message ?? JSON.stringify(json.errors ?? '')}`);
  return json.data ?? json;
}

const login = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.SEED_EMAIL, password: process.env.SEED_PASSWORD }) });
token = (await login.json()).data?.accessToken;
if (!token) throw new Error('Login failed');
const projects = await call('GET', '/api/projects');
const project = projects.find((p) => p.is_default) ?? projects[0];
const identity = (await (await fetch(`${API}/api/app-config`)).json()).data.identity;

const f = L.footer;
const header = { ctaLast: L.header.ctaLast };
const footer = {
  bottomMenuLabel: f.bottomMenuLabel,
  socials: f.socials.map((s) => [s.label, s.href ?? identity[s.identityKey] ?? '', img(s.icon)]).filter((r) => r[1]).map((r) => r.join(' | ')).join('\n'),
  partnerLogos: f.partnerLogos.map((p) => [p.name, img(p.image), p.href].join(' | ')).join('\n'),
  badges: f.badges.map((b) => [img(b.image), b.href].join(' | ')).join('\n'),
  bottomLinks: f.bottomLinks.map((b) => [b.label, b.href].join(' | ')).join('\n'),
  decoImage: img(f.decoImage),
};
const body = {
  topHeader: { enabled: false, variant: '1' },
  header: { enabled: true, variant: 'f9', config: header },
  footer: { enabled: true, variant: 'f9', config: footer },
};
if (DRY) { console.log('[step3] (dry)', JSON.stringify(body).slice(0, 300)); process.exit(0); }
const saved = await call('PUT', `/api/projects/${project.id}/layout`, body);
console.log('[step3] layout saved:', Object.fromEntries(Object.entries(saved.layout ?? saved).map(([k, v]) => [k, `${v.enabled ? 'on' : 'off'} ${v.variant}`])));
