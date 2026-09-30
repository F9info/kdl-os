// Generic "Details Page type" registry — lets any module with a list of
// entities (each auto-generating a real page-builder page, e.g. sectors,
// work) plug into the Web App wizard's nav-sync/layout-pill UI without that
// UI hardcoding a per-module block. See
// docs/superpowers/specs/2026-09-28-details-page-shared-layout-design.md.
const registry = new Map();

/**
 * @param {string} typeKey - unique registry key, e.g. "sectors"
 * @param {{
 *   label: string,                          // e.g. "Sector detail"
 *   navParentLabel: string,                  // top-level nav item entries nest under, e.g. "Sectors"
 *   listEntities: (projectId) => Promise<Array<{ id, name, slug, detail_page_id }>>,
 *   publicPathFor: (entity) => string,       // e.g. (s) => `/sectors/${s.slug}`
 *   adminListPath: (projectId) => string,    // e.g. `/admin/sectors?projectId=${id}`
 *   resolveEntityBindings?: (templateData, entity) => object,
 *     // Optional — only for types whose entities share one live
 *     // DetailPageTemplate (see detail-pages.prisma). Given the template's
 *     // raw Puck `data` and one entity record, returns a NEW data object
 *     // with that entity's own name/description/image swapped into the
 *     // known bindable spots (e.g. the banner's title/subtitle/image) —
 *     // called by this type's own public route, never by page-builder
 *     // itself, which stays entity-agnostic. Omit for a type whose
 *     // entities' page content is genuinely bespoke per entity (not a
 *     // shared structure), e.g. `work` — see the design doc.
 * }} config
 */
export function registerDetailPageType(typeKey, config) {
  registry.set(typeKey, config);
}

export function getDetailPageType(typeKey) {
  return registry.get(typeKey);
}

export function listDetailPageTypes() {
  return [...registry.entries()];
}
