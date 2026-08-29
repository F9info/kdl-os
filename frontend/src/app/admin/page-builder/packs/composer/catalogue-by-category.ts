import { ATOM_CATALOGUE, type AtomDefinition } from './atoms'

/**
 * Phase 1: every category gets the same universal atom set. Phase 2+ adds
 * richer, category-specific catalogues here (e.g. a 'medical-nav-hero' entry
 * with logo/nav/search/social atoms) without touching the composer engine —
 * this is the one seam that changes.
 */
export function atomCatalogueFor(_categoryKey: string): AtomDefinition[] {
  return ATOM_CATALOGUE
}
