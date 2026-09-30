import type { Data } from '@puckeditor/core'
import api from '@/lib/axios'
import { emptyData } from './puck.config'

/**
 * Backend persistence layer for the Page Builder.
 * Replaces the localStorage POC — pages now survive container restarts.
 *
 * Routes (all behind authenticate + RBAC):
 *   listPages()     -> GET  /page-builder
 *   getPage(id)     -> GET  /page-builder/:id
 *   createPage(...) -> POST /page-builder
 *   savePage(...)   -> PUT  /page-builder/:id  (publishes on save)
 *   deletePage(id)  -> DELETE /page-builder/:id
 */

export interface PageRecord {
  id: string
  slug: string
  title: string
  data: Data
  status: 'DRAFT' | 'PUBLISHED'
  updatedAt: string
  projectId: string | null
}

type ListItem = Omit<PageRecord, 'data' | 'projectId'> & {
  updated_at: string
  project_id: string | null
}

function toRecord(raw: ListItem & { data?: Data }): PageRecord {
  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    data: raw.data ?? ({ ...emptyData, root: { props: { title: raw.title } } } as Data),
    status: raw.status,
    updatedAt: raw.updated_at,
    projectId: raw.project_id ?? null,
  }
}

export async function listPages(): Promise<PageRecord[]> {
  const res = await api.get('/page-builder')
  const items: ListItem[] = res.data.data.items ?? []
  return items.map((item) => toRecord(item))
}

export async function getPage(id: string): Promise<PageRecord | undefined> {
  try {
    const res = await api.get(`/page-builder/${id}`)
    const raw = res.data.data.page
    return raw ? toRecord(raw) : undefined
  } catch {
    return undefined
  }
}

export async function createPage(title: string): Promise<PageRecord> {
  const slug =
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'page'
  const uniqueSlug = `${slug}-${Date.now().toString(36)}`
  const data: Data = { ...emptyData, root: { props: { title } } }
  const res = await api.post('/page-builder', { title, slug: uniqueSlug, data })
  return toRecord(res.data.data.page)
}

export async function savePage(id: string, data: Data): Promise<void> {
  const title = (data.root?.props?.title as string) || undefined
  await api.put(`/page-builder/${id}`, {
    ...(title ? { title } : {}),
    data,
    status: 'PUBLISHED',
  })
}

export async function deletePage(id: string): Promise<void> {
  await api.delete(`/page-builder/${id}`)
}

export async function getPageBySlug(slug: string): Promise<PageRecord | undefined> {
  try {
    const res = await api.get(`/page-builder/public/${slug}`)
    const raw = res.data.data.page
    return raw ? toRecord(raw) : undefined
  } catch {
    return undefined
  }
}
