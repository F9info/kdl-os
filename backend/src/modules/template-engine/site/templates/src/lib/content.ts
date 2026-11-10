import fs from 'node:fs'
import path from 'node:path'

const root = path.join(process.cwd(), 'content')
const read = <T>(f: string): T => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'))

export interface Seo {
  title?: string
  description?: string
  og_image?: string
  canonical?: string
  noindex?: boolean
}

export interface PageContent {
  route: string
  slug: string
  projectId: string
  title: string
  seo?: Seo | null
  data: never
  /** Landing pages only: the company details (logo, name, phone, colours) baked in at export time. */
  identity?: Record<string, string>
}

export function getPage(route: string): PageContent | null {
  const file = path.join(root, 'pages', `${route || 'index'}.json`)
  // route comes from the URL: only plain slugs may touch the filesystem
  if (!/^[a-z0-9-]*$/.test(route) || !fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

/** Friendly route for an admin page slug (`te-…-about`), or null. */
export function routeForSlug(slug: string): string | null {
  const r = read<{ bySlug: Record<string, string> }>('routes.json').bySlug[slug]
  return r === undefined ? null : r
}

/** Every friendly route that has a page ('' is Home). Used to pre-render the static export. */
export function listRoutes(): string[] {
  const dir = path.join(root, 'pages')
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .map((r) => (r === 'index' ? '' : r))
}

/** Page-level SEO for Next metadata: the page's own title, description, share image, canonical and noindex. */
export function seoMetadata(page: PageContent | null, fallbackTitle: string) {
  const seo = page?.seo ?? {}
  const title = seo.title || page?.title || fallbackTitle
  // Only addresses a browser can fetch from the exported folder: absolute, or from the site root.
  const image = seo.og_image && /^(https?:\/\/|\/)/.test(seo.og_image) ? seo.og_image : undefined
  const siteUrl = read<{ siteUrl?: string | null }>('site.json').siteUrl
  const path = page?.route ? `/${page.route}` : '/'
  const canonical = seo.canonical || (siteUrl ? `${siteUrl}${path}` : undefined)
  return {
    title,
    ...(seo.description && { description: seo.description }),
    ...(canonical && { alternates: { canonical } }),
    ...(seo.noindex && { robots: { index: false, follow: false } }),
    openGraph: { title, ...(seo.description && { description: seo.description }), ...(image && { images: [image] }) },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, ...(seo.description && { description: seo.description }) },
  }
}
