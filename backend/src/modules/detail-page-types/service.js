import { prisma } from '../../config/database.js';
import { listDetailPageTypesForProject } from '../../shared/detail-pages/registry.js';

export async function getDetailPageTypesForProject(projectId) {
  const results = [];
  // Menu items are the source of truth for DB-defined types: a layout is listed only while a
  // menu item still links to one of its pages (no orphans from deleted/never-linked types).
  const linkedPageIds = new Set(
    (
      await prisma.menuItem.findMany({
        where: { page_id: { not: null }, menu: { project_id: projectId } },
        select: { page_id: true },
      })
    ).map((i) => i.page_id)
  );
  for (const [typeKey, type] of await listDetailPageTypesForProject(projectId)) {
    const entities = await type.listEntities(projectId);
    if (type.deletable && !entities.some((e) => linkedPageIds.has(e.detail_page_id))) continue;
    const withPage = entities.find((e) => e.detail_page_id);
    const listHref = type.adminListPath(projectId);
    results.push({
      typeKey,
      label: type.label,
      navParentLabel: type.navParentLabel,
      deletable: !!type.deletable,
      count: entities.length,
      sectionHref: withPage
        ? `/admin/template-engine/edit/${withPage.detail_page_id}?projectId=${projectId}`
        : listHref,
      listHref,
      // Only entries with a real page can become a real nav link — the sync
      // step (NavigationStep) needs exactly these three fields per entity.
      entities: entities
        .filter((e) => e.detail_page_id)
        .map((e) => ({
          id: e.id,
          name: e.name,
          detail_page_id: e.detail_page_id,
          publicPath: type.publicPathFor(e),
        })),
    });
  }
  return results;
}
