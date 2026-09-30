import { useQuery } from '@tanstack/react-query'

/**
 * Reads plain-text Settings→Fields values by slug, for the small set of
 * page-builder blocks (ConstructionAboutSplit, ConstructionMissionVision,
 * ConstructionTaglineStrip) whose copy is simple, non-relational website
 * text (Vision/Mission/About/tagline) rather than reusable structured
 * content (which get their own module — see Team/FAQ/Projects Content).
 *
 * Global, not project-scoped — `setting-fields` has no per-project concept
 * (unlike the Team/FAQ/Projects Content modules), so this reads the same
 * values across every project on this install. One process-wide `GET
 * /api/setting-fields/public/values`, not one call per slug.
 *
 * A slug with no field row, or an empty value, is simply absent from the
 * returned map — callers fall back to their own static prop in that case,
 * same "DB wins once it has content" pattern as the other modules.
 */
export function useSettingsFieldValues(slugs: string[]) {
  const key = slugs.slice().sort().join(',')
  const { data } = useQuery({
    queryKey: ['settings-field-values-public', key],
    queryFn: () =>
      fetch(`/api/setting-fields/public/values?slugs=${encodeURIComponent(key)}`)
        .then((r) => r.json())
        .then((json) => (json?.data?.values ?? {}) as Record<string, string>),
    enabled: slugs.length > 0,
  })
  return data ?? {}
}
