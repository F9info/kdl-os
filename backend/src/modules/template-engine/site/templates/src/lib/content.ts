import fs from 'node:fs'
import path from 'node:path'

const root = path.join(process.cwd(), 'content')
const read = <T>(f: string): T => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'))

export interface PageContent {
  route: string
  slug: string
  projectId: string
  title: string
  data: never
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
