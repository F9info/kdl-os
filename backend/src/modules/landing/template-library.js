// The landing template library, in the database (T10). The code constants in templates.js are only the SEED:
// a built-in is inserted when its key is missing from the table and never touched again, so a template a user
// edited, duplicated or deleted stays exactly as they left it.
import { prisma } from '../../config/database.js';
import { LANDING_TEMPLATES, formSlugFor } from './templates.js';

const SLUG_TOKEN = '__slug__';
const httpError = (status, message) => Object.assign(new Error(message), { status });

const PUBLIC = { key: true, name: true, description: true, builtin: true, has_form: true };
const KIND = 'LANDING';

// jsonb stores object keys in its own order, so compare bodies with sorted keys.
const canon = (v) =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)))
      : x
  );

/**
 * Inserts the built-in templates that are missing (any state: a deleted built-in is not resurrected). A built-in
 * that is still there gets its body brought up to date when the code's version changed: built-ins cannot be
 * edited in the admin (only renamed, duplicated or deleted), so a different body can only mean a newer release.
 * The user's name for it, copies made from it, and "Save as template" entries are never touched.
 */
export async function ensureBuiltinTemplates(client = prisma) {
  const rows = await client.template.findMany({
    where: { kind: KIND, builtin: true },
    select: { key: true, data: true, deleted_at: true },
  });
  const have = new Map(rows.map((r) => [r.key, r]));
  for (const [key, t] of Object.entries(LANDING_TEMPLATES)) {
    const body = t.body(SLUG_TOKEN);
    const row = have.get(key);
    if (row) {
      if (!row.deleted_at && canon(row.data) !== canon(body)) {
        await client.template.update({
          where: { key },
          data: { data: body, description: t.description, has_form: !!t.hasForm },
        });
      }
      continue;
    }
    // upsert with an empty update: a concurrent request inserting the same key is not an error and changes nothing.
    await client.template.upsert({
      where: { key },
      update: {},
      create: { key, kind: KIND, name: t.name, description: t.description, data: body, has_form: !!t.hasForm, builtin: true },
    });
  }
}

export async function listLibraryTemplates(client = prisma) {
  await ensureBuiltinTemplates(client);
  return client.template.findMany({
    where: { kind: KIND, deleted_at: null },
    orderBy: [{ builtin: 'desc' }, { created_at: 'asc' }],
    select: PUBLIC,
  });
}

export async function getLibraryTemplate(key, client = prisma) {
  await ensureBuiltinTemplates(client);
  const row = await client.template.findFirst({ where: { key, kind: KIND, deleted_at: null } });
  if (!row) throw httpError(404, 'Unknown template');
  return row;
}

// Puck needs a unique id on every block; the page's own slug replaces the token (form slug, ids).
export const buildLandingData = (template, slug, title) => ({
  root: { props: { title } },
  content: JSON.parse(JSON.stringify(template.data).replaceAll(SLUG_TOKEN, slug)).map((b, i) => ({
    ...b,
    props: { ...b.props, id: `${slug}-${b.type}-${i}` },
  })),
  zones: {},
});

const newKey = (name) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'template'}-${Math.random().toString(36).slice(2, 7)}`;

export async function duplicateTemplate(key, { name }, actorId, client = prisma) {
  const src = await getLibraryTemplate(key, client);
  const copyName = name?.trim() || `${src.name} (copy)`;
  return client.template.create({
    data: { key: newKey(copyName), kind: KIND, name: copyName, description: src.description, data: src.data, has_form: src.has_form, builtin: false, created_by: actorId },
    select: PUBLIC,
  });
}

export async function updateTemplate(key, { name, description }, client = prisma) {
  const row = await getLibraryTemplate(key, client);
  return client.template.update({
    where: { id: row.id },
    data: { ...(name !== undefined && { name }), ...(description !== undefined && { description }) },
    select: PUBLIC,
  });
}

export async function deleteTemplate(key, client = prisma) {
  const row = await getLibraryTemplate(key, client);
  await client.template.update({ where: { id: row.id }, data: { deleted_at: new Date() } });
}

/**
 * "Save as template": the body of an existing landing page of this project becomes a library entry. The page's
 * own slug is turned back into the token so the template can be used for any slug.
 */
export async function templateFromPage(pageId, { name, description = '' }, actorId, projectId, client = prisma) {
  const page = await client.builderPage.findFirst({
    where: { id: pageId, project_id: projectId, deleted_at: null, site: { type: 'LANDING' } },
    select: { slug: true, data: true },
  });
  if (!page) throw httpError(404, 'Landing page not found');
  const content = Array.isArray(page.data?.content) ? page.data.content : [];
  const form = formSlugFor(page.slug);
  const data = content.map((b) => ({
    ...b,
    props: {
      ...b.props,
      id: String(b.props?.id ?? '').replace(page.slug, SLUG_TOKEN),
      ...(b.props?.formSlug === form && { formSlug: formSlugFor(SLUG_TOKEN) }),
    },
  }));
  return client.template.create({
    data: {
      key: newKey(name), kind: KIND, name, description, data,
      has_form: content.some((b) => b.type === 'LandingForm' && b.props?.formSlug === form),
      builtin: false, created_by: actorId,
    },
    select: PUBLIC,
  });
}
