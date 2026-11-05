import type { Data } from '@puckeditor/core'
import api from '@/lib/axios'
import { emptyData } from '@/frontend/blocks/puck.config'
import type { SiteLayoutValue } from '@/lib/apply-site-layout'
import type { PageSeo, PublicSeoDefaults } from '@/lib/seo'

// The page as the site and the editor both see it, and the PUBLIC page fetchers (no login). The admin
// editor's own calls (list, save, publish, versions, ...) are in app/admin/page-builder/store.ts.

export interface PageRecord {
  id: string
  slug: string
  title: string
  data: Data
  status: 'DRAFT' | 'PUBLISHED'
  updatedAt: string
  projectId: string | null
  /** Public pages only: the project's saved header/footer layout (T4.2), if any. */
  layout?: SiteLayoutValue | null
  /** Public pages only: the site's identity overrides (T5.5), if any. */
  identity?: Record<string, string> | null
  /** The page's own SEO (T6.1); on public pages image paths are already URLs. */
  seo?: PageSeo | null
  /** Public pages only: site-wide SEO defaults. */
  seoDefaults?: PublicSeoDefaults | null
  /** Editor only (T6.2): edits not published yet, and the live version number (null = not live). */
  hasUnpublishedChanges?: boolean
  liveVersion?: number | null
}

export type ListItem = Omit<
  PageRecord,
  | 'data'
  | 'projectId'
  | 'layout'
  | 'identity'
  | 'seo'
  | 'seoDefaults'
  | 'hasUnpublishedChanges'
  | 'liveVersion'
> & {
  has_unpublished_changes?: boolean
  live_version?: number | null
  seo?: PageSeo | null
  seoDefaults?: PublicSeoDefaults | null
  layout?: SiteLayoutValue | null
  identity?: Record<string, string> | null
  updated_at: string
  project_id: string | null
}

export function toRecord(raw: ListItem & { data?: Data }): PageRecord {
  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    data: raw.data ?? ({ ...emptyData, root: { props: { title: raw.title } } } as Data),
    status: raw.status,
    updatedAt: raw.updated_at,
    projectId: raw.project_id ?? null,
    layout: raw.layout ?? null,
    identity: raw.identity ?? null,
    seo: raw.seo ?? null,
    seoDefaults: raw.seoDefaults ?? null,
    hasUnpublishedChanges: raw.has_unpublished_changes ?? false,
    liveVersion: raw.live_version ?? null,
  }
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

/** Clean public URLs: key "home" is "/", any other key is "/<key>" (see backend getPublishedBySiteKey). */
export async function getPageBySiteKey(key: string): Promise<PageRecord | undefined> {
  try {
    const res = await api.get(`/page-builder/public/site/${encodeURIComponent(key)}`)
    const raw = res.data.data.page
    return raw ? toRecord(raw) : undefined
  } catch {
    return undefined
  }
}

/** The page behind a preview token (public, no login). Undefined when the link is invalid or expired. */
export async function getPageByPreviewToken(token: string): Promise<PageRecord | undefined> {
  try {
    const res = await api.get(`/page-builder/public/preview/${encodeURIComponent(token)}`)
    const raw = res.data.data.page
    return raw ? toRecord(raw) : undefined
  } catch {
    return undefined
  }
}
