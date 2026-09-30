/**
 * Project scope for public detail routes (/sectors/<slug>, /catalog/<slug>, /work/<slug>).
 * Public URLs stay friendly — no `?projectId=` — so the scope comes from a legacy query
 * param if present, else from NEXT_PUBLIC_SITE_PROJECT_ID (written into each generated
 * project site), else unscoped.
 */
export function siteProjectId(fromQuery: string | null): string | null {
  return fromQuery ?? (process.env.NEXT_PUBLIC_SITE_PROJECT_ID || null)
}
