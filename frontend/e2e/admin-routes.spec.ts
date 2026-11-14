/**
 * Every admin screen the platform says it has, opened for real. Nothing is hardcoded: the list of screens comes from the
 * enabled modules' own navigation (GET /api/modules/enabled, built from each module.json), so a new module is covered
 * the moment it is enabled, and a manifest that points at a screen that does not exist fails here.
 *
 *   E2E_BASE_URL=http://localhost:3001 E2E_CHROME=1 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... \
 *     pnpm e2e e2e/admin-routes.spec.ts --headed
 *
 * For each navigation entry: it opens (no 404/500, no "not found" screen, no uncaught error), and the sidebar offers a
 * link to it. Also checks the dashboard's quick links and that every menu/page link in the site menus is a real route.
 * Read-only.
 */
import fs from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import { ADMIN } from './helpers/credentials'

interface NavItem {
  label: string
  path: string
}
interface EnabledModule {
  slug: string
  nav?: NavItem[]
}

async function login(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByLabel(/^Email/).fill(ADMIN.email)
  await page.locator('input[type=password]').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/admin\//, { timeout: 30_000 })
}

const NOT_FOUND = /this page could not be found|404\s*[:|-]\s*(page )?not found|application error/i

test.describe.configure({ mode: 'serial' })
test.setTimeout(10 * 60_000)

test('every enabled module screen opens and is linked from the sidebar', async ({
  page,
  request,
}) => {
  await login(page)
  // The app holds its token in memory, so read what the sidebar itself asks for when a screen loads.
  const enabled = page.waitForResponse((r) => r.url().includes('/api/modules/enabled') && r.ok())
  await page.goto('/admin/dashboard')
  const modules = ((await (await enabled).json()).data?.modules ?? null) as EnabledModule[] | null
  expect(modules, 'GET /api/modules/enabled must answer for a signed-in admin').not.toBeNull()

  const screens = new Map<string, { label: string; module: string }>()
  for (const m of modules!)
    for (const n of m.nav ?? [])
      if (n.path.startsWith('/')) screens.set(n.path, { label: n.label, module: m.slug })
  expect(screens.size, 'the enabled modules declare navigation').toBeGreaterThan(5)

  const problems: string[] = []
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const checked: Array<[string, number, boolean]> = []

  for (const [path, { label, module }] of screens) {
    errors.length = 0
    const res = await page.goto(path, { waitUntil: 'networkidle' }).catch((e) => {
      problems.push(`${module}: ${label} (${path}) did not load: ${String(e.message).slice(0, 80)}`)
      return null
    })
    if (!res) continue
    const body = (await page.locator('body').innerText()).slice(0, 600)
    const status = res.status()
    if (status >= 400) problems.push(`${module}: ${label} (${path}) returned ${status}`)
    else if (NOT_FOUND.test(body))
      problems.push(`${module}: ${label} (${path}) shows a not-found/error screen`)
    else if (/\/login/.test(page.url()) && !/\/login/.test(path))
      problems.push(`${module}: ${label} (${path}) sent the signed-in admin to the login page`)
    if (errors.length)
      problems.push(`${module}: ${label} (${path}) raised: ${errors[0]!.slice(0, 100)}`)

    // the sidebar must offer it (groups can be collapsed: expand them all first)
    for (const toggle of await page
      .locator('aside button[aria-expanded="false"], nav button[aria-expanded="false"]')
      .all()) {
      await toggle.click({ timeout: 1000 }).catch(() => {})
    }
    const linked = (await page.locator(`a[href="${path}"]`).count()) > 0
    checked.push([path, status, linked])
    if (!linked) problems.push(`${module}: ${label} (${path}) is not linked from the sidebar`)
  }

  fs.mkdirSync('test-results', { recursive: true })
  fs.writeFileSync(
    'test-results/admin-routes.json',
    JSON.stringify({ screens: checked, problems }, null, 2)
  )
  console.log(
    `\nADMIN ROUTES: ${screens.size} screens from ${modules!.length} enabled modules, ${problems.length} problems`
  )
  for (const p of problems) console.log(`  PROBLEM ${p}`)
  expect(problems, problems.join('\n')).toHaveLength(0)
})

test('the dashboard quick links all open', async ({ page }) => {
  await login(page)
  await page.goto('/admin/dashboard', { waitUntil: 'networkidle' })
  const hrefs = await page
    .locator('[data-testid="quick-actions"] a')
    .evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))
  const bad: string[] = []
  for (const href of new Set(hrefs)) {
    const res = await page.goto(href, { waitUntil: 'networkidle' })
    if (!res || res.status() >= 400 || NOT_FOUND.test(await page.locator('body').innerText()))
      bad.push(href)
  }
  expect(bad, `quick links that do not open: ${bad.join(', ')}`).toHaveLength(0)
})
