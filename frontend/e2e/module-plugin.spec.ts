/**
 * MODULE_PLUGIN_ARCH Step 8 E2E gate — KDL-83
 *
 * Scenario: install example module → enable → nav item appears → page loads
 *           → disable → nav gone + API 404.
 *
 * Prerequisites: full stack running (frontend :3001, backend :4000).
 *   docker compose up -d
 * Run standalone:
 *   cd frontend && E2E_BASE_URL=http://localhost:3001 pnpm e2e e2e/module-plugin.spec.ts
 */
import { test, expect, request, type APIRequestContext } from '@playwright/test'
import { ADMIN } from './helpers/credentials'

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000/api'

let api: APIRequestContext
let adminToken: string

const authHeaders = () => ({ Authorization: `Bearer ${adminToken}` })

async function getExampleStatus(): Promise<string | null> {
  const res = await api.get(`${API_URL}/modules`, { headers: authHeaders() })
  if (!res.ok()) return null
  const modules: Array<{ slug: string; status: string }> =
    (await res.json()).data?.modules ?? []
  return modules.find((m) => m.slug === 'example')?.status ?? null
}

async function ensureExampleUninstalled() {
  const status = await getExampleStatus()
  if (status === null || status === 'AVAILABLE') return
  if (status === 'ENABLED') {
    await api.post(`${API_URL}/modules/example/disable`, { headers: authHeaders() })
  }
  await api.delete(`${API_URL}/modules/example`, { headers: authHeaders() })
}

async function loginUi(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByPlaceholder('admin@kdl.com').fill(ADMIN.email)
  await page.getByPlaceholder('••••••••').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard/)
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  api = await request.newContext()
  const login = await api.post(`${API_URL}/auth/login`, {
    data: { email: ADMIN.email, password: ADMIN.password },
  })
  expect(login.ok(), 'seeded super admin must be able to log in').toBeTruthy()
  adminToken = (await login.json()).data.accessToken
  await ensureExampleUninstalled()
})

test.afterAll(async () => {
  await ensureExampleUninstalled()
  await api.dispose()
})

test('1. install example module — status becomes INSTALLED', async () => {
  const res = await api.post(`${API_URL}/modules/example/install`, {
    headers: authHeaders(),
  })
  expect(res.status(), await res.text()).toBe(201)
  const body = await res.json()
  expect(body.data.module.slug).toBe('example')
  expect(body.data.module.status).toBe('INSTALLED')
})

test('2. enable example module — status becomes ENABLED', async () => {
  const res = await api.post(`${API_URL}/modules/example/enable`, {
    headers: authHeaders(),
  })
  expect(res.status(), await res.text()).toBe(200)
  expect((await res.json()).data.module.status).toBe('ENABLED')
})

test('3. nav item appears and page loads after enable', async ({ page }) => {
  // Fresh login — module is already ENABLED, so modules/enabled returns it immediately.
  // Wait for modules/enabled before asserting the sidebar.
  const modulesResponsePromise = page.waitForResponse(
    (r) => r.url().includes('/modules/enabled') && r.request().method() === 'GET',
  )
  await loginUi(page)
  await modulesResponsePromise

  // Sidebar must show the Example nav link.
  await expect(page.getByRole('link', { name: 'Example' })).toBeVisible({ timeout: 10_000 })

  // Navigate to the page and confirm it renders correctly.
  await page.goto('/admin/example')
  await expect(page.getByRole('heading', { name: 'Example' })).toBeVisible()
})

test('4. disable example module — status becomes DISABLED', async () => {
  const res = await api.post(`${API_URL}/modules/example/disable`, {
    headers: authHeaders(),
  })
  expect(res.status(), await res.text()).toBe(200)
  expect((await res.json()).data.module.status).toBe('DISABLED')
})

test('5. nav item gone + API 404 after disable', async ({ page }) => {
  // Fresh login — module is now DISABLED, so modules/enabled no longer returns it.
  const modulesResponsePromise = page.waitForResponse(
    (r) => r.url().includes('/modules/enabled') && r.request().method() === 'GET',
  )
  await loginUi(page)
  await modulesResponsePromise
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('link', { name: 'Example' })).toHaveCount(0)

  // Module gate must return 404 for disabled module.
  const apiRes = await api.get(`${API_URL}/example`, { headers: authHeaders() })
  expect(apiRes.status()).toBe(404)
})
