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
