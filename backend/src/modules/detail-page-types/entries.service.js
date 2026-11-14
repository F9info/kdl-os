// DB-defined Details Page types (Blog, Service, ...) and their entries. Mirrors
// what sectors/work do in code, but data-driven: a type row + a provider in the
// shared registry make Layout Settings, nav-sync and the public route work with
// no per-type code. Every entry's page is bound to the type's ONE shared
// DetailPageTemplate, so editing any entry's sections edits them for all.
import { friendlyLinksFor } from '../../shared/page-routes-db.js';
import { prisma } from '../../config/database.js';
import { deletePage } from '../page-builder/service.js';
import { withServiceSections } from '../../shared/detail-pages/service-sections.js';
import { DETAIL_PREFIX_RESERVED } from '../../shared/reserved-segments.js';
import { siteChrome } from '../sectors/service.js';
import { createDetailPageInstance } from '../../shared/detail-pages/templates.js';
import { getDetailPageType, registerDetailPageTypeProvider } from '../../shared/detail-pages/registry.js';

export const slugify = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Top-level site routes a public /<prefix>/<slug> must never shadow.
export const RESERVED_PREFIXES = DETAIL_PREFIX_RESERVED; // shared/reserved-segments.js

// BuilderPage.slug is unique per project and soft-deleted pages keep theirs, so a re-created
// type/entry (same name after a delete) needs the next free suffix.
async function pageSlugFor(projectId, typeKey, slug) {
  const base = `${typeKey}-detail-${projectId}-${slug}`;
  let candidate = base;
  for (let n = 2; await prisma.builderPage.findFirst({ where: { slug: candidate, project_id: projectId }, select: { id: true } }); n += 1) {
    candidate = `${base}-${n}`;
  }
  return candidate;
}

// The one place an entry's own fields enter the shared template (same contract
// as sectors' resolveSectorBindings): pure, never mutates `templateData`.
export function resolveEntryBindings(templateData, entry) {
  const data = JSON.parse(JSON.stringify(templateData));
  if (data.root?.props) data.root.props.title = entry.name;
  for (const block of data.content ?? []) {
    if (block.type === 'ConstructionInnerBanner') {
      block.props.imageAlt = entry.name;
      block.props.subtitle = entry.description || block.props.subtitle;
      block.props.backgroundImage = entry.image || block.props.backgroundImage;
    } else if (block.type === 'Text' && block.props?.id?.endsWith('-body')) {
      block.props.text = entry.body || entry.description || block.props.text;
    }
  }
  return data;
}

// Inverse of resolveEntryBindings: a Section Builder save on an entry's page
// carries that entry's own copy in the bound props. Move any edited bound prop
// onto the entry (its own content) and reset it to the template's value, so
// the shared layout only ever changes structurally.
export function splitEntryEdits(templateData, entry, incoming) {
  const resolved = resolveEntryBindings(templateData, entry);
  const data = JSON.parse(JSON.stringify(incoming));
  const entityPatch = {};
  const take = (cur, res, tpl, field, set) => {
    if (cur !== undefined && cur !== res) entityPatch[field] = cur;
    set(tpl);
  };
  if (data.root?.props) {
    take(data.root.props.title, resolved.root?.props?.title, templateData.root?.props?.title, 'title', (v) => {
      data.root.props.title = v;
    });
  }
  const byId = (d) => new Map((d.content ?? []).map((b) => [b.props?.id, b]));
  const tpl = byId(templateData);
  const res = byId(resolved);
  for (const block of data.content ?? []) {
    const t = tpl.get(block.props?.id)?.props;
    const r = res.get(block.props?.id)?.props;
    if (!t) continue;
    const bind = (prop, field) => take(block.props[prop], r[prop], t[prop], field, (v) => { block.props[prop] = v; });
    if (block.type === 'ConstructionInnerBanner') {
      bind('subtitle', 'description');
      bind('backgroundImage', 'image');
      block.props.imageAlt = t.imageAlt;
    } else if (block.type === 'Text' && block.props.id.endsWith('-body')) {
      bind('text', 'body');
    }
  }
  return { entityPatch, data };
}

const toEntity = (e) => ({
  id: e.id,
  name: e.title,
  slug: e.slug,
  description: e.description,
  body: e.body,
  image: e.image,
  detail_page_id: e.detail_page_id,
});

const toConfig = (t) => ({
  label: t.label,
  deletable: true,
  navParentLabel: t.nav_parent_label,
  listEntities: async (projectId) =>
    (
      await prisma.detailPageEntry.findMany({
        where: { project_id: projectId, type_key: t.type_key, is_active: true },
        orderBy: [{ order: 'asc' }, { created_at: 'asc' }],
      })
    ).map(toEntity),
  publicPathFor: (e) => `/${t.slug_prefix}/${e.slug}`,
  adminListPath: (projectId) => `/admin/${slugify(t.label)}?projectId=${projectId}`,
  resolveEntityBindings: resolveEntryBindings,
  splitEntityEdits: splitEntryEdits,
  updateEntity: (projectId, id, patch) => updateEntry(projectId, id, patch),
});

registerDetailPageTypeProvider(async (projectId) =>
  (await prisma.detailPageType.findMany({ where: { project_id: projectId }, orderBy: { created_at: 'asc' } })).map(
    (t) => [t.type_key, toConfig(t)]
  )
);

async function starterContent(type, entry) {
  const { topBar, header, footer } = await siteChrome(type.project_id);
  const k = type.type_key;
  const page = {
    root: { props: { title: entry.title } },
    zones: {},
    content: [
      ...(topBar ? [topBar] : []),
      ...(header ? [header] : []),
      {
        type: 'ConstructionInnerBanner',
        props: {
          id: `${k}-banner`,
          variant: '1',
          visible: true,
          homeHref: '/',
          imageAlt: entry.title,
          subtitle: entry.description ?? '',
          backgroundImage: entry.image ?? '',
        },
      },
      {
        type: 'Text',
        props: { id: `${k}-body`, variant: '3', text: entry.body ?? entry.description ?? '', align: 'left', muted: false },
      },
      ...(footer ? [footer] : []),
    ],
  };
  // The service type gets the service sections too (stats, what is included, process, FAQ, call to action).
  return k === 'service' ? withServiceSections(page, k) : page;
}

// Only these columns are ever written from request input (never project_id, type_key, detail_page_id...).
const ENTRY_FIELDS = ['title', 'slug', 'description', 'body', 'image', 'order', 'is_active', 'seo_title', 'seo_description'];
const pickEntryFields = (input) => Object.fromEntries(ENTRY_FIELDS.filter((k) => input?.[k] !== undefined).map((k) => [k, input[k]]));

export async function createEntry(projectId, typeKey, input, actorId) {
  const type = await prisma.detailPageType.findUnique({
    where: { project_id_type_key: { project_id: projectId, type_key: typeKey } },
  });
  if (!type) return null;
  const count = await prisma.detailPageEntry.count({ where: { project_id: projectId, type_key: typeKey } });
  let slug = input.slug;
  if (!slug) {
    const base = slugify(input.title) || `page${count + 1}`;
    slug = base;
    for (let n = 2; await prisma.detailPageEntry.findFirst({ where: { project_id: projectId, type_key: typeKey, slug } }); n += 1) {
      slug = `${base}-${n}`;
    }
  }
  const entry = await prisma.detailPageEntry.create({
    data: {
      ...pickEntryFields(input),
      slug,
      project_id: projectId,
      type_key: typeKey,
      order: input.order ?? count,
    },
  });
  const page = await createDetailPageInstance(
    {
      projectId,
      typeKey,
      entityId: entry.id,
      title: entry.title,
      slug: await pageSlugFor(projectId, typeKey, entry.slug),
      seedContentFn: () => starterContent(type, entry),
    },
    actorId
  );
  return prisma.detailPageEntry.update({ where: { id: entry.id }, data: { detail_page_id: page.id } });
}

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';

// The two placeholder entries every new type starts with. They carry a bundled photo
// (frontend/public/seed/demologo) so the banner is never an empty box; the owner replaces it per entry.
export const SAMPLE_ENTRY_IMAGE = '/seed/demologo/hero.jpg';
export const sampleEntries = (base) =>
  [1, 2].map((n) => ({
    title: `Sample ${base} ${n}`,
    slug: `page${n}`,
    description: `Sample ${base} ${n} summary.`,
    body: LOREM,
    image: SAMPLE_ENTRY_IMAGE,
  }));

// Creating a type also seeds two dummy entries so it shows up in Layout
// Settings with a working pill + numbered links immediately.
export async function createType(projectId, { name, label, nav_parent_label, slug_prefix }, actorId) {
  const base = name.trim().replace(/\s+detail$/i, '');
  const typeKey = slugify(base);
  const prefix = slug_prefix || typeKey;
  if (!typeKey || RESERVED_PREFIXES.has(prefix)) {
    throw Object.assign(new Error(`"${prefix}" is reserved — choose another name`), { status: 409 });
  }
  const type = await prisma.detailPageType.create({
    data: {
      project_id: projectId,
      type_key: typeKey,
      label: label || `${base} Detail`,
      nav_parent_label: nav_parent_label || `${base}s`,
      slug_prefix: prefix,
    },
  });
  try {
    for (const sample of sampleEntries(base)) await createEntry(projectId, typeKey, sample, actorId);
  } catch (err) {
    await deleteType(projectId, typeKey, actorId).catch(() => {}); // no half-built type left behind
    throw err;
  }
  return type;
}

export async function updateEntry(projectId, id, data) {
  const { count } = await prisma.detailPageEntry.updateMany({ where: { id, project_id: projectId }, data: pickEntryFields(data) });
  if (!count) return null;
  const entry = await prisma.detailPageEntry.findUnique({ where: { id } });
  if (data.title && entry.detail_page_id) {
    await prisma.builderPage.updateMany({ where: { id: entry.detail_page_id, project_id: projectId }, data: { title: data.title } }).catch(() => {});
  }
  return entry;
}

// "<X> Detail" is a LAYOUT, not a page. Older projects hold it as plain pages titled "<X> Detail"
// (no shared template). Convert each such group — only if a menu item links to it — into a real
// type: shared layout + two slugged entries, the menu item re-linked to the first entry, the
// legacy pages soft-deleted. Idempotent: once converted, no legacy pages remain.
export async function convertLegacyDetailGroups(projectId, actorId) {
  if (!projectId) return;
  const pages = await prisma.builderPage.findMany({
    where: { project_id: projectId, deleted_at: null, template_id: null, title: { endsWith: 'detail', mode: 'insensitive' } },
    orderBy: { created_at: 'asc' },
  });
  const groups = new Map();
  for (const p of pages) {
    if (!/\sdetail$/i.test(p.title.trim())) continue;
    const k = p.title.trim().toLowerCase();
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  for (const group of groups.values()) {
    const label = group[0].title.trim();
    const ids = group.map((p) => p.id);
    const items = await prisma.menuItem.findMany({
      where: { menu: { project_id: projectId }, OR: [{ page_id: { in: ids } }, { url: { in: group.map((p) => `/p/${p.slug}`) } }] },
    });
    if (!items.length) continue; // not a menu-linked layout: leave alone
    const typeKey = slugify(label.replace(/\s+detail$/i, ''));
    if (!typeKey || getDetailPageType(typeKey)) continue;
    try {
      const type =
        (await prisma.detailPageType.findUnique({ where: { project_id_type_key: { project_id: projectId, type_key: typeKey } } })) ??
        (await createType(projectId, { name: label }, actorId));
      const first = await prisma.detailPageEntry.findFirst({
        where: { project_id: projectId, type_key: typeKey },
        orderBy: [{ order: 'asc' }, { created_at: 'asc' }],
      });
      if (!first?.detail_page_id) continue;
      await prisma.menuItem.updateMany({
        where: { id: { in: items.map((i) => i.id) } },
        data: { page_id: first.detail_page_id, url: `/${type.slug_prefix}/${first.slug}`, link_type: 'page' },
      });
      for (const id of ids) await deletePage(id, actorId).catch(() => {});
    } catch {
      /* leave the legacy group as is — never break the listing */
    }
  }
}

// Admin table: every entry of a type (active or not) with its page link.
export async function listEntries(projectId, typeKey) {
  const type = await prisma.detailPageType.findUnique({
    where: { project_id_type_key: { project_id: projectId, type_key: typeKey } },
  });
  if (!type) return null;
  const items = await prisma.detailPageEntry.findMany({
    where: { project_id: projectId, type_key: typeKey },
    orderBy: [{ order: 'asc' }, { created_at: 'asc' }],
  });
  return {
    type: { typeKey, label: type.label, slugPrefix: type.slug_prefix },
    items: items.map((e) => ({ ...e, public_path: `/${type.slug_prefix}/${e.slug}` })),
  };
}

export async function deleteEntry(projectId, id, actorId) {
  const entry = await prisma.detailPageEntry.findFirst({ where: { id, project_id: projectId } });
  if (!entry) return false;
  await prisma.detailPageEntry.delete({ where: { id } });
  if (entry.detail_page_id) await deletePage(entry.detail_page_id, actorId).catch(() => {});
  return true;
}

export async function deleteType(projectId, typeKey, actorId) {
  const entries = await prisma.detailPageEntry.findMany({ where: { project_id: projectId, type_key: typeKey } });
  for (const e of entries) await deleteEntry(projectId, e.id, actorId);
  await prisma.detailPageTemplate.deleteMany({ where: { project_id: projectId, type_key: typeKey } });
  const { count } = await prisma.detailPageType.deleteMany({ where: { project_id: projectId, type_key: typeKey } });
  return count > 0;
}

// Public read for the generic /<slug_prefix>/<slug> route — same shape as
// getPublicSectorBySlug: { entry, page } with the template resolved for this entry.
export async function getPublicEntry(projectId, prefix, slug) {
  const type = await prisma.detailPageType.findFirst({ where: { project_id: projectId, slug_prefix: prefix } });
  if (!type) return null;
  const entry = await prisma.detailPageEntry.findFirst({
    where: { project_id: projectId, type_key: type.type_key, slug, is_active: true },
  });
  if (!entry) return null;
  const row = entry.detail_page_id
    ? await prisma.builderPage.findFirst({
        where: { id: entry.detail_page_id, status: 'PUBLISHED', deleted_at: null },
        select: { data: true, title: true, template_id: true },
      })
    : null;
  if (!row) return { entry, page: null };
  let data = row.data;
  if (row.template_id) {
    const template = await prisma.detailPageTemplate.findUnique({ where: { id: row.template_id } });
    if (template) data = resolveEntryBindings(template.data, toEntity(entry));
  }
  // Links inside the page are saved as /p/<slug>; give them the routes the site actually serves (shared/page-routes.js).
  return { entry, page: { data: await friendlyLinksFor(projectId, await withLiveChrome(projectId, data)), title: row.title } };
}

// A detail page holds a copy of the site's top bar / header / footer made when it was created, so
// it drifts from the site (older ones never had the top bar). Show the site's current ones instead.
const CHROME_TYPES = ['ConstructionTopBar', 'ConstructionHeader', 'ConstructionFooter'];
async function withLiveChrome(projectId, data) {
  const { topBar, header, footer } = await siteChrome(projectId);
  if (!header || !Array.isArray(data?.content)) return data;
  const body = data.content.filter((b) => !CHROME_TYPES.includes(b.type));
  return { ...data, content: [...(topBar ? [topBar] : []), header, ...body, ...(footer ? [footer] : [])] };
}
