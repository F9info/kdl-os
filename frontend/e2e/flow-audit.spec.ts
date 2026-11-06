/**
 * Admin flow + CMS flow audit (headless, real stack). Walks every sidebar page on desktop and
 * mobile, then the CMS flow (pages list -> new page -> editor -> public site), and records console
 * errors, failed API calls (status >= 400 other than expected 401/403/404 probes) and page errors.
 *
 *   cd frontend && E2E_BASE_URL=http://localhost:3001 E2E_ADMIN_PASSWORD=... pnpm e2e e2e/flow-audit.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import { ADMIN } from './helpers/credentials'

test.setTimeout(900_000)
const OUT = process.env.AUDIT_OUT ?? '/tmp/flow-audit.json'
type Issue = { where: string; kind: string; detail: string }
const issues: Issue[] = []
const seen: string[] = []

// SSE: the per-user cap is 3 live streams (design), so a second browser session on the same account
// (a developer's own tabs) makes /notifications/stream answer 429. Not an app defect.
const KNOWN_HTTP = [/\/api\/notifications\/stream\?/]
const IGNORE = [
  /Failed to load resource: the server responded with a status of 429/i,
  /fonts\.googleapis|rsms\.me|fonts\.gstatic/i,
  /Content Security Policy/i,
  /favicon/i,
]

function watch(page: Page, tag: () => string) {
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (IGNORE.some((r) => r.test(t))) return
    issues.push({ where: tag(), kind: 'console', detail: t.slice(0, 220) })
  })
  page.on('pageerror', (e) =>
    issues.push({ where: tag(), kind: 'pageerror', detail: e.message.slice(0, 220) })
  )
  page.on('response', (r) => {
    const u = r.url()
    if (!u.includes('/api/') || r.status() < 400) return
    if (r.status() === 429 && KNOWN_HTTP.some((re) => re.test(u))) return
    issues.push({
      where: tag(),
      kind: `http ${r.status()}`,
      detail: `${r.request().method()} ${u.replace(/^https?:\/\/[^/]+/, '').slice(0, 160)}`,
    })
  })
}

async function login_(page: Page) {
  return login(page)
}
async function login(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByPlaceholder('admin@kdl.com').fill(ADMIN.email)
  await page.getByPlaceholder('••••••••').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard/)
  const later = page.getByRole('button', { name: 'Ask me later' })
  await later.waitFor({ timeout: 4000 }).then(
    () => later.click(),
    () => {}
  )
}

async function visit(page: Page, href: string, label: string) {
  seen.push(`${label} ${href}`)
  const before = issues.length
  const resp = await page.goto(href, { waitUntil: 'domcontentloaded' }).catch((e) => {
    issues.push({ where: `${label} ${href}`, kind: 'goto', detail: String(e).slice(0, 160) })
    return null
  })
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  if (resp && resp.status() >= 400)
    issues.push({ where: `${label} ${href}`, kind: `page ${resp.status()}`, detail: '' })
  const body =
    (await page
      .locator('body')
      .innerText()
      .catch(() => '')) || ''
  if (
    /Application error|Something went wrong|Module not available|Unexpected Application Error/i.test(
      body
    )
  )
    issues.push({
      where: `${label} ${href}`,
      kind: 'error-screen',
      detail: body.slice(0, 120).replace(/\s+/g, ' '),
    })
  if (body.trim().length < 20) issues.push({ where: `${label} ${href}`, kind: 'blank', detail: '' })
  const overflow = await page
    .evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    .catch(() => 0)
  if (overflow > 4 && label === 'mobile')
    issues.push({ where: `${label} ${href}`, kind: 'h-scroll', detail: `${overflow}px` })
  return issues.length - before
}

test('admin flow: every sidebar page, desktop + mobile', async ({ browser }) => {
  let cur = 'login'
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await desktop.newPage()
  watch(page, () => cur)
  await login(page)
  // Group children only render while the group is open: expand everything first.
  for (let pass = 0; pass < 4; pass++) {
    const closed = page.locator('aside button[aria-expanded="false"]')
    const n = await closed.count()
    if (n === 0) break
    for (let i = n - 1; i >= 0; i--)
      await closed
        .nth(i)
        .click({ timeout: 2000 })
        .catch(() => {})
  }
  const hrefs = await page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll('aside a[href^="/admin"]')].map((a) =>
        (a as HTMLAnchorElement).getAttribute('href')!
      )
    ),
  ])
  seen.push(`discovered ${hrefs.length} sidebar links`)
  for (const h of hrefs) {
    cur = `desktop ${h}`
    await visit(page, h, 'desktop')
  }
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const mp = await mobile.newPage()
  watch(mp, () => cur)
  await login(mp)
  for (const h of hrefs) {
    cur = `mobile ${h}`
    await visit(mp, h, 'mobile')
  }
  fs.writeFileSync(OUT, JSON.stringify({ seen, issues }, null, 2))
  await desktop.close()
  await mobile.close()
})

test('cms flow: create page -> editor -> publish -> public site -> unpublish -> delete', async ({
  browser,
  request,
}) => {
  const slug = `audit-cms-${Date.now()}`
  const headline = `Audit headline ${slug}`
  const login = await request.post('/api/auth/login', {
    data: { email: ADMIN.email, password: ADMIN.password },
  })
  expect(login.ok()).toBe(true)
  const { data: auth } = await login.json()
  const headers = { authorization: `Bearer ${auth.accessToken ?? auth.tokens?.accessToken}` }

  const projects = await (await request.get('/api/projects', { headers })).json()
  const projectId: string = (projects.data.items ?? projects.data)[0].id

  const created = await request.post('/api/page-builder', {
    headers,
    data: {
      title: 'Audit CMS page',
      slug,
      data: {
        root: { props: {} },
        content: [
          { type: 'Heading', props: { id: 'h1', text: headline, level: 1, align: 'left' } },
          {
            type: 'Text',
            props: {
              id: 't1',
              text: 'Body from the CMS flow audit.',
              align: 'left',
              variant: 'body',
              muted: false,
            },
          },
        ],
      },
    },
  })
  expect(created.ok(), await created.text()).toBe(true)
  const page = (await created.json()).data
  const id: string = page.id ?? page.page?.id
  expect(id).toBeTruthy()

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const ui = await ctx.newPage()
  let cur = 'cms'
  watch(ui, () => cur)
  try {
    // Unpublished: public URL must not leak the draft.
    const draft = await request.get(`/api/page-builder/public/${slug}`)
    expect(draft.status(), 'draft is not public').toBe(404)

    await login_(ui)
    // The Pages screen is the website stage (engine-assembled pages only): it must load and list the
    // site's pages with working Edit links (API-created pages are intentionally not listed there).
    cur = 'cms pages screen'
    await visit(ui, '/admin/pages', 'desktop')
    await expect(ui.getByRole('link', { name: 'Edit' }).first()).toBeVisible({ timeout: 15_000 })

    // Editor opens it and renders the heading.
    cur = 'cms editor'
    await visit(ui, `/admin/template-engine/edit/${id}?projectId=${projectId}`, 'desktop')
    await expect(ui.getByText(headline).first()).toBeVisible({ timeout: 30_000 })

    // Publish -> public API and public site render.
    const pub = await request.post(`/api/page-builder/${id}/publish`, { headers })
    expect(pub.ok(), await pub.text()).toBe(true)
    const apiPublic = await request.get(`/api/page-builder/public/${slug}`)
    expect(apiPublic.status()).toBe(200)

    cur = 'cms public site'
    const resp = await ui.goto(`/p/${slug}`, { waitUntil: 'domcontentloaded' })
    expect(resp?.status()).toBeLessThan(400)
    await expect(ui.getByText(headline).first()).toBeVisible({ timeout: 20_000 })
    await ui.screenshot({ path: '/tmp/cms-public.png', fullPage: false })

    // Unpublish -> gone again.
    const unpub = await request.post(`/api/page-builder/${id}/unpublish`, { headers })
    expect(unpub.ok()).toBe(true)
    expect((await request.get(`/api/page-builder/public/${slug}`)).status()).toBe(404)
  } finally {
    await request.delete(`/api/page-builder/${id}`, { headers }).catch(() => {})
    await ctx.close()
    fs.writeFileSync(OUT.replace('.json', '-cms.json'), JSON.stringify({ issues }, null, 2))
  }
})
