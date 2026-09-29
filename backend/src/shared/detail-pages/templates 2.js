// Shared helpers for the always-live Details Page template — get-or-create
// the one DetailPageTemplate row per (project, type), and create a new
// entity's page bound to it. See
// docs/superpowers/specs/2026-09-28-details-page-shared-layout-design.md.
import { prisma } from '../../config/database.js';
import { createPage, updatePage } from '../../modules/page-builder/service.js';

export async function ensureDetailPageTemplate(projectId, typeKey, seedContentFn) {
  const existing = await prisma.detailPageTemplate.findUnique({
    where: { project_id_type_key: { project_id: projectId, type_key: typeKey } },
  });
  if (existing) return existing;
  const data = await seedContentFn();
  return prisma.detailPageTemplate.create({
    data: { project_id: projectId, type_key: typeKey, data },
  });
}

// Creates a real BuilderPage bound to the type's shared template — its
// `data` column gets a snapshot of the template purely as a harmless
// fallback (never read again once `template_id` is set; both the editor
// and the public route substitute the template's live `data` instead).
export async function createDetailPageInstance(
  { projectId, typeKey, entityId, title, slug, seedContentFn },
  actorId
) {
  const template = await ensureDetailPageTemplate(projectId, typeKey, seedContentFn);
  const page = await createPage({ title, slug, data: template.data, project_id: projectId }, actorId);
  return updatePage(page.id, { status: 'PUBLISHED', template_id: template.id, entity_id: entityId }, actorId);
}
