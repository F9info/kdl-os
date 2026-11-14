/**
 * Link, slug and route integrity of a RUNNING stack, read-only. Nothing is hardcoded: the pages to visit come from the
 * site itself (the home page's links, then every page those lead to) and from the API (sitemap, public menus), and each
 * link is judged by what it points at.
 *
 *   E2E_BASE_URL=http://localhost:8080 E2E_CHROME=1 pnpm e2e e2e/link-integrity.spec.ts --headed
 *
 * Checks, for every page reached:
 *   - it opens (HTTP < 400) and is not a "page not found" screen
 *   - every internal link opens; no link is a bare "#" or a legacy /p/<slug> address; "#section" links land on an element
 *     that exists on that page; mailto: and tel: links are well formed
 *   - no link or image points at localhost or at a placeholder domain
 *   - every sitemap address opens, and every public menu link is a real, opening route
 * Findings are printed as a table and written to test-results/link-integrity.json; hard failures fail the run.
 */
import fs from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

const MAX_PAGES = Number(process.env.E2E_CRAWL_MAX ?? 80)
const PLACEHOLDER = /(^|\.)example\.(com|org)$|yourdomain|yourbrand|yourcompany/i

type Finding = { severity: 'error' | 'warn'; page: string; what: string; detail: string }
const findings: Finding[] = []
const flag = (severity: Finding['severity'], page: string, what: string, detail: string) =>
  findings.push({ severity, page, what, detail })

const isNotFoundScreen = (text: string) =>
  /this page could not be found|404\s*[:|-]?\s*(page )?not found/i.test(text)

async function collect(page: Page) {
  return page.evaluate(() => ({
    links: Array.from(document.querySelectorAll('a[href]')).map((a) => ({
      href: (a as HTMLAnchorElement).getAttribute('href') ?? '',
      text: (a.textContent ?? '').trim().slice(0, 40),
      visible: !!(a as HTMLElement).offsetParent || getComputedStyle(a).position === 'fixed',
    })),
    images: Array.from(document.images).map((i) => ({
      src: i.currentSrc || i.src,
      ok: i.complete && i.naturalWidth > 0,
    })),
    ids: Array.from(document.querySelectorAll('[id]')).map((e) => e.id),
    text: document.body.innerText.slice(0, 400),
  }))
}

test.describe('link integrity', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(10 * 60_000)

  test('every page, link, anchor, menu and sitemap address is real', async ({
    page,
    request,
    baseURL,
  }) => {
    const origin = new URL(baseURL!).origin
    const toVisit: string[] = ['/']
    const seen = new Set<string>()
    const opened = new Map<string, number>()
    const checkedTargets = new Map<string, number>()

    // 1. crawl: start from "/" and follow every internal link
    while (toVisit.length && seen.size < MAX_PAGES) {
      const path = toVisit.shift()!
      if (seen.has(path)) continue
      seen.add(path)
      const res = await page.goto(path, { waitUntil: 'networkidle' }).catch((e) => {
        flag('error', path, 'page did not load', String(e.message).slice(0, 120))
        return null
      })
      if (!res) continue
      opened.set(path, res.status())
      const data = await collect(page)
      if (res.status() >= 400) flag('error', path, 'page returned an error', String(res.status()))
      if (isNotFoundScreen(data.text))
        flag('error', path, 'shows a "not found" screen', data.text.slice(0, 60))

      for (const img of data.images) {
        if (!img.ok && img.src) flag('warn', path, 'image did not load', img.src.slice(0, 120))
        if (/\/\/localhost[:/]/.test(img.src) && !img.src.startsWith(origin))
          flag('warn', path, 'image points at localhost', img.src.slice(0, 120))
      }

      for (const { href, text } of data.links) {
        const label = `"${text || href}" -> ${href}`
        if (href === '#' || href === '') {
          flag('error', path, 'dead link (bare "#")', label)
          continue
        }
        if (href.startsWith('#')) {
          if (!data.ids.includes(href.slice(1)))
            flag('error', path, 'anchor has no target on this page', label)
          continue
        }
        if (href.startsWith('mailto:')) {
          const addr = href.slice(7).split('?')[0]!
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr))
            flag('error', path, 'malformed mailto', label)
          else if (PLACEHOLDER.test(addr.split('@')[1]!))
            flag('warn', path, 'placeholder email address', label)
          continue
        }
        if (href.startsWith('tel:')) {
          if (!/^tel:\+?[\d\s().-]{5,}$/.test(href)) flag('error', path, 'malformed tel', label)
          continue
        }
        if (/^javascript:/i.test(href)) {
          flag('error', path, 'javascript: link', label)
          continue
        }
        let url: URL
        try {
          url = new URL(href, origin + path)
        } catch {
          flag('error', path, 'unparseable link', label)
          continue
        }
        if (url.origin !== origin) {
          if (/localhost|127\.0\.0\.1/.test(url.hostname))
            flag('error', path, 'link points at localhost', label)
          else if (PLACEHOLDER.test(url.hostname))
            flag('warn', path, 'placeholder web address', label)
          continue // other sites are not ours to crawl
        }
        if (/^\/p\//.test(url.pathname))
          flag('error', path, 'legacy /p/<slug> address (should be the clean route)', label)
        const target = url.pathname + url.search
        if (
          /^\/(admin|login|register|forgot-password|reset-password|change-password|membership\/(login|signup|account))/.test(
            url.pathname
          )
        ) {
          checkedTargets.set(target, 0)
          continue // the admin app: checked by its own request below, not crawled as the website
        }
        if (url.hash) {
          const id = url.hash.slice(1)
          if (url.pathname === path && !data.ids.includes(id))
            flag('error', path, 'anchor has no target on this page', label)
        }
        if (!seen.has(url.pathname) && !toVisit.includes(url.pathname)) toVisit.push(url.pathname)
      }
    }
    if (toVisit.length)
      flag('warn', '(crawl)', `stopped at ${MAX_PAGES} pages`, `${toVisit.length} more not visited`)

    // 2. links to the app itself (login, admin ...) must at least answer
    for (const target of checkedTargets.keys()) {
      const r = await request.get(target, { maxRedirects: 0 }).catch(() => null)
      if (!r || r.status() >= 400)
        flag(
          'error',
          '(site links)',
          'app link does not answer',
          `${target} -> ${r?.status() ?? 'no response'}`
        )
    }

    // 3. sitemap: every address it lists must open, and be linked or at least reachable
    const sm = await request.get('/api/page-builder/public/sitemap')
    if (sm.ok()) {
      const entries = ((await sm.json()).data?.entries ?? []) as { path: string }[]
      for (const e of entries) {
        const r = await request.get(e.path)
        if (r.status() >= 400)
          flag('error', '(sitemap)', 'sitemap address does not open', `${e.path} -> ${r.status()}`)
        else if (!seen.has(e.path))
          flag('warn', '(sitemap)', 'listed in the sitemap but no page links to it', e.path)
      }
    } else flag('warn', '(sitemap)', 'sitemap endpoint not available', String(sm.status()))

    // 4. public menus: every link is a real route that opens (no legacy /p/ addresses, no empty ones)
    for (const key of ['header', 'footer']) {
      const m = await request.get(`/api/menus/public?key=${key}`).catch(() => null)
      if (!m?.ok()) {
        flag('warn', '(menus)', `public ${key} menu not readable`, String(m?.status()))
        continue
      }
      const items = ((await m.json()).data?.menu?.items ?? []) as {
        label: string
        url?: string
        children?: unknown[]
      }[]
      const walk = async (list: typeof items) => {
        for (const it of list) {
          if (it.url && !it.url.startsWith('http') && !it.url.startsWith('#')) {
            if (/^\/p\//.test(it.url))
              flag(
                'error',
                `(${key} menu)`,
                'menu link uses the legacy /p/ address',
                `${it.label} -> ${it.url}`
              )
            const r = await request.get(it.url)
            if (r.status() >= 400)
              flag(
                'error',
                `(${key} menu)`,
                'menu link does not open',
                `${it.label} -> ${it.url} (${r.status()})`
              )
          }
          if (it.children?.length) await walk(it.children as typeof items)
        }
      }
      await walk(items)
    }

    // report
    const errors = findings.filter((f) => f.severity === 'error')
    const warns = findings.filter((f) => f.severity === 'warn')
    fs.mkdirSync('test-results', { recursive: true })
    fs.writeFileSync(
      'test-results/link-integrity.json',
      JSON.stringify({ pages: [...opened], findings }, null, 2)
    )
    console.log(
      `\nLINK INTEGRITY: ${opened.size} pages opened, ${errors.length} errors, ${warns.length} warnings`
    )
    for (const f of findings.slice(0, 80))
      console.log(`  ${f.severity.toUpperCase().padEnd(5)} ${f.page}  ${f.what}  ${f.detail}`)
    expect(errors, errors.map((f) => `${f.page}: ${f.what} ${f.detail}`).join('\n')).toHaveLength(0)
  })
})
