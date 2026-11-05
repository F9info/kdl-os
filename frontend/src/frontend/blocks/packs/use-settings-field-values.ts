import { useQuery } from '@tanstack/react-query'
import { siteProjectId } from '@/lib/site-project'

/**
 * Reads plain-text Settings→Fields values by slug, for the small set of
 * page-builder blocks (ConstructionAboutSplit, ConstructionMissionVision,
 * ConstructionTaglineStrip) whose copy is simple, non-relational website
 * text (Vision/Mission/About/tagline) rather than reusable structured
 * content (which get their own module — see Team/FAQ/Projects Content).
 *
 * Project-scoped when a project is known: a project's own override (set via
 * Settings → Fields `?projectId=`) wins, otherwise it inherits the global
 * value. `projectId` comes from the block's Puck metadata, falling back to the
 * generated site's NEXT_PUBLIC_SITE_PROJECT_ID. One `GET
 * /api/setting-fields/public/values`, not one call per slug.
 *
 * A slug with no field row, or an empty value, is simply absent from the
 * returned map — callers fall back to their own static prop in that case,
 * same "DB wins once it has content" pattern as the other modules.
 */
export function useSettingsFieldValues(slugs: string[], projectId?: string | null) {
  const key = slugs.slice().sort().join(',')
  const scope = siteProjectId(projectId ?? null)
  const { data } = useQuery({
    queryKey: ['settings-field-values-public', key, scope],
    queryFn: () =>
      fetch(
        `/api/setting-fields/public/values?slugs=${encodeURIComponent(key)}${scope ? `&project_id=${encodeURIComponent(scope)}` : ''}`
      )
        .then((r) => r.json())
        .then((json) => (json?.data?.values ?? {}) as Record<string, string>),
    enabled: slugs.length > 0,
  })
  return data ?? {}
}
