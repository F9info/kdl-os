import api from '@/lib/axios'
import type { ComposedBlockConfig } from './render-composed-block'

export interface CustomBlockRecord {
  id: string
  projectId: string
  categoryKey: string
  name: string
  description: string | null
  status: 'DRAFT' | 'PUBLISHED'
  isDefault: boolean
  config: ComposedBlockConfig
  updatedAt: string
}

// The four id-addressed mutation routes (update/duplicate/set-default/delete)
// carry no projectId in their body or query — the backend's requireProject
// middleware reads it from this header instead (same convention as
// frontend/src/hooks/useTemplateEngine.ts's projectScope()), and the service
// layer scopes the mutation by {id, project_id} together so a mismatched id
// 404s instead of touching another project's row.
function projectScope(projectId: string) {
  return { headers: { 'X-Project-Id': projectId } }
}

function toRecord(raw: {
  id: string
  project_id: string
  category_key: string
  name: string
  description: string | null
  status: 'DRAFT' | 'PUBLISHED'
  is_default: boolean
  config: ComposedBlockConfig
  updated_at: string
}): CustomBlockRecord {
  return {
    id: raw.id,
    projectId: raw.project_id,
    categoryKey: raw.category_key,
    name: raw.name,
    description: raw.description,
    status: raw.status,
    isDefault: raw.is_default,
    config: raw.config,
    updatedAt: raw.updated_at,
  }
}

// projectId omitted -> lists across every project (the legacy Page Builder
// editor has no project context; see backend's requireProjectIfPresent).
export async function listCustomBlocks(
  projectId: string | undefined,
  categoryKey: string
): Promise<CustomBlockRecord[]> {
  const res = await api.get('/custom-blocks', {
    params: { ...(projectId ? { projectId } : {}), category: categoryKey },
  })
  const items = res.data.data.items ?? []
  return items.map(toRecord)
}

// Resolves the org-wide default project's id — new custom blocks save here
// when no project context is available (the legacy Page Builder editor's
// "Create new" flow). `GET /projects` orders is_default first, and that
// project is seeded with is_shared=true, so every authenticated user
// already has implicit access to it via requireProject's is_shared check.
// Looked up by the `is_default` flag rather than a hardcoded id, since the
// project's cuid differs per environment/seed run.
export async function getDefaultProjectId(): Promise<string> {
  const res = await api.get('/projects')
  const items: { id: string; is_default: boolean }[] = res.data.data ?? []
  const found = items.find((p) => p.is_default) ?? items[0]
  if (!found) throw new Error('No default project found')
  return found.id
}

export interface BrandDefaults {
  logoUrl: string
  companyName: string
  /** CSV of the site's currently-selected navigation pages (Studio's
   *  Navigation step), e.g. "Home, About, Services, Products" — empty when
   *  the WEBSITE stage hasn't seeded pages yet. */
  navigationItems: string
  primaryColor: string
  secondaryColor: string
  /** Type scale's "H1 (Title)" row's font family (Theme Engine's Typography
   *  settings) — falls back to '' (caller keeps the atom's own default). */
  headingFamily: string
  /** Type scale's "Body" row's font family. */
  bodyFamily: string
}

interface TypeScaleRow {
  name?: string
  family?: string
}

function parseTypeScale(raw: unknown): TypeScaleRow[] {
  if (typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// The single global brand's logo, company name, live navigation, colour
// palette and typography — this KDL instance has no per-project brand (see
// "no projects concept" removal), so a single combined fetch covers every
// project. Used to prefill a freshly-dropped atom (Logo/Navigation/Heading/
// Paragraph/Button/Badge) instead of static placeholders; callers only apply
// a field if the atom is still untouched, since a custom block built here
// can be reused on a different site later — "dynamic on drop", not a live
// binding (see backend's patchComposerLogos for the one atom type, Logo,
// that DOES stay live after insertion via the WEBSITE stage re-sync).
export async function getBrandDefaults(projectId: string): Promise<BrandDefaults> {
  const [logoRes, nameRes, runsRes, kitRes, scaleRes] = await Promise.all([
    api.get('/setting-fields/value/logo').catch(() => null),
    api.get('/setting-fields/value/brand-profile-company-name').catch(() => null),
    api.get('/template-engine/runs', { params: { projectId } }).catch(() => null),
    api.get(`/brand-kit/${projectId}`).catch(() => null),
    api
      .get('/setting-fields/value/webapp.typography.desktop.typography_scale.typography_scale')
      .catch(() => null),
  ])

  const websiteStage = runsRes?.data?.data?.[0]?.stages?.find(
    (s: { stage: string }) => s.stage === 'WEBSITE'
  )
  const pageKeyToTitle = websiteStage?.outputRef?.pageKeyToTitle as
    Record<string, string> | undefined

  const colors = kitRes?.data?.data?.palette?.colors
  const scale = parseTypeScale(scaleRes?.data?.data?.field?.value)
  const headingRow = scale.find((r) => r.name?.startsWith('H1'))
  const bodyRow = scale.find((r) => r.name === 'Body' || r.name === 'Paragraph')

  return {
    logoUrl: logoRes?.data?.data?.field?.value_url ?? '',
    companyName: nameRes?.data?.data?.field?.value ?? '',
    navigationItems: pageKeyToTitle ? Object.values(pageKeyToTitle).join(', ') : '',
    primaryColor: colors?.primary?.hex ?? '',
    secondaryColor: colors?.secondary?.hex ?? '',
    headingFamily: headingRow?.family ?? '',
    bodyFamily: bodyRow?.family ?? '',
  }
}

export async function createCustomBlock(input: {
  projectId: string
  categoryKey: string
  name: string
  description?: string
  status: 'DRAFT' | 'PUBLISHED'
  config: ComposedBlockConfig
}): Promise<CustomBlockRecord> {
  const res = await api.post('/custom-blocks', input)
  return toRecord(res.data.data.block)
}

export async function updateCustomBlock(
  id: string,
  projectId: string,
  patch: Partial<{
    name: string
    description: string
    status: 'DRAFT' | 'PUBLISHED'
    config: ComposedBlockConfig
  }>
): Promise<CustomBlockRecord> {
  const res = await api.put(`/custom-blocks/${id}`, patch, projectScope(projectId))
  return toRecord(res.data.data.block)
}

export async function duplicateCustomBlock(
  id: string,
  projectId: string
): Promise<CustomBlockRecord> {
  const res = await api.post(`/custom-blocks/${id}/duplicate`, undefined, projectScope(projectId))
  return toRecord(res.data.data.block)
}

export async function setDefaultCustomBlock(
  id: string,
  projectId: string
): Promise<CustomBlockRecord> {
  const res = await api.post(`/custom-blocks/${id}/set-default`, undefined, projectScope(projectId))
  return toRecord(res.data.data.block)
}

export async function deleteCustomBlock(id: string, projectId: string): Promise<void> {
  await api.delete(`/custom-blocks/${id}`, projectScope(projectId))
}
