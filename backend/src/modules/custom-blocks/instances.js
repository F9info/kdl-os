import { isDeepStrictEqual } from 'node:util';
import { prisma } from '../../config/database.js';
import { updatePage } from '../page-builder/service.js';
import { workingData } from '../page-builder/versions.js';

// Linked custom sections (T7.1). A page block made from a saved section carries
//   props.templateId       the section it came from
//   props.templateVersion  the section version its config was copied from
//   props.templateDetached true once someone customised it on that page (then it is no longer updated)
// `config` stays on the block so rendering never needs a lookup. "Update instances" copies the
// section's latest config into every linked, non-detached block.

const BLOCK = 'CustomComposedBlock';
const notFound = (what) => Object.assign(new Error(`${what} not found`), { status: 404 });

/** Blocks of `data.content` that are linked to `templateId`. */
export const linkedBlocks = (data, templateId) =>
  (Array.isArray(data?.content) ? data.content : []).filter(
    (b) => b?.type === BLOCK && b.props?.templateId === templateId
  );

/** Classification of one linked block against the section's current version. */
export const blockState = (block, version) =>
  block.props.templateDetached === true
    ? 'detached'
    : (block.props.templateVersion ?? 0) < version
      ? 'outdated'
      : 'current';

/** Pure: content with every linked, non-detached block re-pointed at the section's latest config. */
export function relinkContent(content, template) {
  let changed = 0;
  const next = content.map((b) => {
    if (b?.type !== BLOCK || b.props?.templateId !== template.id || b.props.templateDetached === true)
      return b;
    if (b.props.templateVersion === template.version && isDeepStrictEqual(b.props.config, template.config))
      return b;
    changed += 1;
    return { ...b, props: { ...b.props, config: template.config, templateVersion: template.version } };
  });
  return { content: next, changed };
}

const getTemplate = async (id, projectId) => {
  const template = await prisma.customBlockTemplate.findFirst({
    where: { id, project_id: projectId, deleted_at: null },
  });
  if (!template) throw notFound('Section');
  return template;
};

// Pages whose JSON mentions the section. jsonb prints `"key": "value"` with a space after the colon.
const candidatePages = (template) => {
  const needle = `%"templateId": "${template.id.replace(/[%_\\"]/g, '')}"%`;
  return prisma.$queryRaw`
    SELECT id FROM builder_pages
    WHERE deleted_at IS NULL AND project_id = ${template.project_id} AND template_id IS NULL
      AND (data::text LIKE ${needle} OR draft_data::text LIKE ${needle})`;
};

/** Where a section is used, and which of those uses are behind its current version. */
export async function listInstances(templateId, projectId) {
  const template = await getTemplate(templateId, projectId);
  const rows = await candidatePages(template);
  if (rows.length === 0) return { version: template.version, pages: [] };
  const pages = await prisma.builderPage.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    select: { id: true, title: true, slug: true, status: true, data: true, draft_data: true },
    orderBy: { title: 'asc' },
  });
  return {
    version: template.version,
    pages: pages
      .map((p) => {
        const states = linkedBlocks(workingData(p), templateId).map((b) => blockState(b, template.version));
        return {
          id: p.id,
          title: p.title,
          slug: p.slug,
          status: p.status,
          blocks: states.length,
          outdated: states.filter((s) => s === 'outdated').length,
          detached: states.filter((s) => s === 'detached').length,
        };
      })
      .filter((p) => p.blocks > 0),
  };
}

/**
 * Brings linked blocks up to the section's latest version. `pageIds` limits it to some pages
 * (default: every page that uses the section). Goes through updatePage, so a published page gets a
 * DRAFT change (visitors keep the live version until the page is published again).
 */
export async function updateInstances(templateId, projectId, pageIds, actorId) {
  const template = await getTemplate(templateId, projectId);
  const { pages } = await listInstances(templateId, projectId);
  const targets = pages.filter((p) => !pageIds || pageIds.includes(p.id));
  const updated = [];
  for (const target of targets) {
    const page = await prisma.builderPage.findFirst({ where: { id: target.id, deleted_at: null } });
    if (!page) continue;
    const data = workingData(page);
    const { content, changed } = relinkContent(data.content ?? [], template);
    if (changed === 0) continue;
    await updatePage(page.id, { data: { ...data, content } }, actorId);
    updated.push({ id: page.id, title: page.title, status: page.status, blocks: changed });
  }
  return {
    version: template.version,
    updated,
    needsPublish: updated.filter((p) => p.status === 'PUBLISHED').length,
  };
}
