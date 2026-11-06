/**
 * T7.4 - the five product scenarios (docs/planning/03-user-flows.md) against the REAL stack.
 *
 *   A Admin only   B Website only   C Landing only   D Website + Landing   E Full platform
 *
 * For each scenario the saved product selection is applied through the real API
 * (PUT /api/modules/products), then the admin sidebar is checked in a real browser.
 * The original selection is restored afterwards. Nothing is deleted: turning a product
 * off never removes data or switches modules off.
 *
 * Also measures the first-publish path (TTHW): from a signed-in admin to a new page that
 * visitors can open, and prints the timings.
 *
 * Run (headless), against the Docker app:
 *   cd frontend && E2E_BASE_URL=http://localhost:3001 E2E_ADMIN_PASSWORD=... \
 *     pnpm e2e e2e/product-scenarios.spec.ts
 */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { ADMIN } from './helpers/credentials'

test.describe.configure({ mode: 'serial' })

let api: APIRequestContext
let token = ''
let original: string[] = []

async function selectProducts(products: string[]) {
  const res = await api.put('/api/modules/products', {
    headers: { authorization: `Bearer ${token}` },
    data: { products },
  })
  expect(res.ok(), await res.text()).toBe(true)
}

async function loginUi(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByPlaceholder('admin@kdl.com').fill(ADMIN.email)
  await page.getByPlaceholder('••••••••').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard/)
}

const sidebar = (page: Page) => page.locator('aside').first()

test.beforeAll(async ({ playwright, baseURL }) => {
  api = await playwright.request.newContext({ baseURL })
  const login = await api.post('/api/auth/login', {
    data: { email: ADMIN.email, password: ADMIN.password },
  })
  expect(login.ok(), 'admin login').toBe(true)
  token = (await login.json()).data.accessToken
  const graph = await api.get('/api/modules/graph', {
    headers: { authorization: `Bearer ${token}` },
  })
  const g = (await graph.json()).data as { selected: string[]; inferred?: string[] }
  // `selected` also lists products that are only inferred; restore just what was saved.
  original = g.selected.filter((p) => !(g.inferred ?? []).includes(p))
})

test.afterAll(async () => {
  if (original.length) await selectProducts(original)
  await api.dispose()
})

const SCENARIOS: { name: string; products: string[]; siteNav: boolean }[] = [
  { name: 'A Admin only', products: ['admin'], siteNav: false },
  { name: 'B Website only', products: ['admin', 'website'], siteNav: true },
  { name: 'C Landing only', products: ['admin', 'landing'], siteNav: true },
  { name: 'D Website + Landing', products: ['admin', 'website', 'landing'], siteNav: true },
  { name: 'E Full platform', products: ['admin', 'website', 'landing'], siteNav: true },
]

for (const s of SCENARIOS) {
  test(`scenario ${s.name}`, async ({ page }) => {
    await selectProducts(s.products)
    await loginUi(page)
    const nav = sidebar(page)
    // Admin is always there.
    for (const label of ['Dashboard', 'Users', 'Settings']) {
      await expect(nav.getByText(label, { exact: true }).first()).toBeVisible()
    }
    // Content (the website/landing area) shows only when a public product is on.
    const content = nav.getByText('Frontend', { exact: true })
    if (s.siteNav) await expect(content.first()).toBeVisible()
    else await expect(content).toHaveCount(0)

    // The saved selection is what was applied (the Products page may still show a product as On
    // when all of its modules happen to be enabled; only the saved selection hides navigation).
    const graph = await api.get('/api/modules/graph', {
      headers: { authorization: `Bearer ${token}` },
    })
    const g = (await graph.json()).data as { selected: string[]; inferred?: string[] }
    const stored = g.selected.filter((p) => !(g.inferred ?? []).includes(p))
    expect(stored.sort()).toEqual([...s.products].sort())

    // Settings > Products never offers Admin as a card.
    await page.goto('/admin/settings/products')
    await expect(page.getByTestId('product-website')).toBeVisible()
    await expect(page.getByTestId('product-admin')).toHaveCount(0)

    // The public site keeps working in every scenario.
    const home = await page.request.get('/')
    expect(home.status()).toBe(200)
  })
}

test('TTHW: first page from signed-in admin to live in the browser', async ({ page }) => {
  await selectProducts(['admin', 'website', 'landing'])
  const slug = `e2e-first-page-${Date.now().toString(36)}`
  const auth = { authorization: `Bearer ${token}` }
  const t0 = Date.now()

  const created = await api.post('/api/page-builder', {
    headers: auth,
    data: {
      title: 'E2E first page',
      slug,
      data: {
        root: { props: { title: 'E2E first page' } },
        content: [{ type: 'Heading', props: { id: 'h1', text: 'Hello from the first page' } }],
      },
    },
  })
  expect(created.ok(), await created.text()).toBe(true)
  const id = (await created.json()).data.page.id
  const tCreated = Date.now() - t0

  try {
    const published = await api.post(`/api/page-builder/${id}/publish`, {
      headers: auth,
      data: { force: true },
    })
    expect(published.ok(), await published.text()).toBe(true)
    const tPublished = Date.now() - t0

    const res = await page.goto(`/p/${slug}`)
    expect(res?.status()).toBe(200)
    const tLive = Date.now() - t0

    console.log(
      `TTHW first page: created ${tCreated} ms, published ${tPublished} ms, visible to a visitor ${tLive} ms`
    )
    expect(tLive).toBeLessThan(10_000)
  } finally {
    await api.delete(`/api/page-builder/${id}`, { headers: auth })
  }
})
