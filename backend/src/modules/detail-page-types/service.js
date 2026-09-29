import { listDetailPageTypes } from '../../shared/detail-pages/registry.js';

export async function getDetailPageTypesForProject(projectId) {
  const results = [];
  for (const [typeKey, type] of listDetailPageTypes()) {
    const entities = await type.listEntities(projectId);
    const withPage = entities.find((e) => e.detail_page_id);
    const listHref = type.adminListPath(projectId);
    results.push({
      typeKey,
      label: type.label,
      navParentLabel: type.navParentLabel,
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
