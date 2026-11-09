import type { Data } from '@puckeditor/core'
import api from '@/lib/axios'
import { toRecord, type ListItem, type PageRecord } from '@/frontend/pages/page-record'
import { emptyData } from '../../../frontend/blocks/puck.config'
import type { PageSeo } from '@/lib/seo'

// Re-exported so editor code keeps one import for the page record.
export type { PageRecord }

/**
 * Backend persistence layer for the Page Builder.
 * Replaces the localStorage POC — pages now survive container restarts.
 *
 * Routes (all behind authenticate + RBAC):
 *   listPages()     -> GET  /page-builder
 *   getPage(id)     -> GET  /page-builder/:id
 *   createPage(...) -> POST /page-builder
 *   publishPage(...) -> POST /page-builder/:id/publish (saves the content and makes it live)
 *   deletePage(id)  -> DELETE /page-builder/:id
 */

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

/** Autosave: data only. On a live page this only changes the draft, visitors see it after Publish. */
/** T11: a copy of the page (draft, same project, free slug). */
export async function duplicatePage(id: string): Promise<PageRecord> {
  const res = await api.post(`/page-builder/${id}/duplicate`, {})
  return toRecord(res.data.data.page)
}

/** T11: save the page's content as a reusable layout. */
export async function saveAsLayout(id: string, name: string): Promise<void> {
  await api.post('/page-builder/layouts', { page_id: id, name })
}

export async function autosavePage(id: string, data: Data): Promise<void> {
  await api.put(`/page-builder/${id}`, { data })
}

/**
 * Saves the content and makes it live as a new version. `force` = "publish anyway": skip the
 * pre-publish check errors (the server otherwise answers 422 with the issues).
 */
export async function publishPage(id: string, data: Data, force = false): Promise<void> {
  const title = (data.root?.props?.title as string) || undefined
  await api.post(`/page-builder/${id}/publish`, {
    ...(title ? { title } : {}),
    data,
    ...(force ? { force } : {}),
  })
}

export interface PageIssue {
  severity: 'error' | 'warning'
  code: string
  message: string
  block_id: string | null
  block_type: string | null
}

export interface PageChecks {
  issues: PageIssue[]
  errors: number
  warnings: number
  can_publish: boolean
}

/** Pre-publish checks of the content the editor is about to publish (not just the last autosave). */
export async function checkPage(id: string, data: Data): Promise<PageChecks> {
  const title = (data.root?.props?.title as string) || undefined
  return (await api.post(`/page-builder/${id}/checks`, { ...(title ? { title } : {}), data })).data
    .data
}

/** The issues a failed publish (422 PUBLISH_VALIDATION_FAILED) carries, else null. */
export function issuesFromPublishError(err: unknown): PageIssue[] | null {
  const body = (
    err as {
      response?: { status?: number; data?: { errors?: { code?: string; issues?: PageIssue[] } } }
    }
  )?.response
  return body?.status === 422 && body.data?.errors?.code === 'PUBLISH_VALIDATION_FAILED'
    ? (body.data.errors.issues ?? [])
    : null
}

export async function unpublishPage(id: string): Promise<void> {
  await api.post(`/page-builder/${id}/unpublish`)
}

export interface PageVersionInfo {
  id: string
  version: number
  title: string
  note: string | null
  created_at: string
  is_live: boolean
}

export async function listPageVersions(id: string): Promise<PageVersionInfo[]> {
  return (await api.get(`/page-builder/${id}/versions`)).data.data.versions
}

/** Publishes an older version's content as a new version. */
export async function restorePageVersion(id: string, versionId: string): Promise<void> {
  await api.post(`/page-builder/${id}/versions/${versionId}/restore`)
}

export async function deletePage(id: string): Promise<void> {
  await api.delete(`/page-builder/${id}`)
}

/** Saves the page's own SEO; an empty object clears it. Leaves content, title and status alone. */
export async function savePageSeo(id: string, seo: PageSeo): Promise<void> {
  await api.put(`/page-builder/${id}`, { seo })
}

export interface PreviewLink {
  token: string
  expires_at: string
}

/** A signed link to this page's working copy (unpublished draft included) for people without a login. */
export async function createPreviewLink(id: string, ttlHours: number): Promise<PreviewLink> {
  return (await api.post(`/page-builder/${id}/preview-link`, { ttl_hours: ttlHours })).data.data
}
