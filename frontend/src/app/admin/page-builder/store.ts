import type { Data } from '@puckeditor/core'
import { emptyData } from './puck.config'

/**
 * POC persistence layer for the Page Builder.
 *
 * For the proof-of-concept this reads/writes the browser (localStorage) so the
 * builder is fully functional with no backend. To promote to production, swap
 * the four functions below for calls to `api` (lib/axios) against the
 * `page-builder` backend module — the data shape (Puck `Data`) is unchanged.
 *
 *   listPages()     -> GET  /page-builder
 *   getPage(id)     -> GET  /page-builder/:id
 *   savePage(...)   -> PUT  /page-builder/:id
 *   createPage(...) -> POST /page-builder
 */

export interface PageRecord {
  id: string
  slug: string
  title: string
  data: Data
  updatedAt: string
}

const KEY = 'kdl:page-builder:pages'

function readAll(): PageRecord[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || '[]') as PageRecord[]
  } catch {
    return []
  }
}

function writeAll(pages: PageRecord[]) {
  window.localStorage.setItem(KEY, JSON.stringify(pages))
}

export function listPages(): PageRecord[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getPage(id: string): PageRecord | undefined {
  return readAll().find((p) => p.id === id)
}

export function getPageBySlug(slug: string): PageRecord | undefined {
  return readAll().find((p) => p.slug === slug)
}

export function createPage(title: string): PageRecord {
  const id = crypto.randomUUID()
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || id.slice(0, 8)
  const record: PageRecord = {
    id,
    slug,
    title,
    data: { ...emptyData, root: { props: { title } } },
    updatedAt: new Date().toISOString(),
  }
  writeAll([record, ...readAll()])
  return record
}

export function savePage(id: string, data: Data) {
  const pages = readAll()
  const idx = pages.findIndex((p) => p.id === id)
  if (idx === -1) return
  pages[idx] = {
    ...pages[idx],
    data,
    title: (data.root?.props?.title as string) || pages[idx].title,
    updatedAt: new Date().toISOString(),
  }
  writeAll(pages)
}

export function deletePage(id: string) {
  writeAll(readAll().filter((p) => p.id !== id))
}
