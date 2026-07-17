/**
 * INTEGRATIONS_ARCH Step 8 E2E gate — KDL-97
 *
 * Scenario: install + enable integrations module → add SMTP provider (mailhog)
 *           via UI → set as default EMAIL provider → test-send → log status SENT
 *           → mailhog received it → disable module → password reset email still
 *           delivers via direct SMTP fallback (not via the integrations worker).
 *
 * Prerequisites: full stack + mailhog running (frontend :3001, backend :4000,
 * mailhog SMTP :1025 / HTTP API :8025). The docker backend routes direct SMTP
 * to mailhog (SMTP_HOST=mailhog in docker-compose.yml) — no real email is ever
 * sent from this suite.
 *   docker compose up -d
 * Run standalone:
 *   cd frontend && E2E_BASE_URL=http://localhost:3001 pnpm e2e e2e/integrations.spec.ts
 */
import { test, expect, request, type APIRequestContext, type Page, type Locator } from '@playwright/test'
import { ADMIN } from './helpers/credentials'

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000/api'
const MAILHOG_URL = process.env.E2E_MAILHOG_URL ?? 'http://localhost:8025'

const RUN_ID = Date.now().toString(36)
const PROVIDER_NAME = 'Mailhog E2E'
const TEST_RECIPIENT = `e2e-${RUN_ID}@test.local`
const TEST_SUBJECT = `KDL E2E test-send ${RUN_ID}`

let api: APIRequestContext
let adminToken: string
let testLogId: string
let logsTotalBeforeFallback: number

const authHeaders = () => ({ Authorization: `Bearer ${adminToken}` })

async function getModuleStatus(): Promise<string | null> {
  const res = await api.get(`${API_URL}/modules`, { headers: authHeaders() })
  if (!res.ok()) return null
  const modules: Array<{ slug: string; status: string }> =
    (await res.json()).data?.modules ?? []
  return modules.find((m) => m.slug === 'integrations')?.status ?? null
}

async function deleteTestProviders() {
  // Only reachable while the module is ENABLED (module gate 404s otherwise).
  const res = await api.get(`${API_URL}/integrations/providers`, { headers: authHeaders() })
  if (!res.ok()) return
  const items: Array<{ id: string; name: string }> = (await res.json()).data?.items ?? []
  for (const p of items.filter((p) => p.name === PROVIDER_NAME)) {
    await api.delete(`${API_URL}/integrations/providers/${p.id}`, { headers: authHeaders() })
  }
}

async function ensureModuleUninstalled() {
  const status = await getModuleStatus()
  if (status === null || status === 'AVAILABLE') return
  if (status === 'ENABLED') {
    await deleteTestProviders()
    await api.post(`${API_URL}/modules/integrations/disable`, { headers: authHeaders() })
  }
  await api.delete(`${API_URL}/modules/integrations`, { headers: authHeaders() })
}

async function getLogsTotal(): Promise<number> {
  const res = await api.get(`${API_URL}/integrations/logs?limit=1`, { headers: authHeaders() })
  expect(res.ok(), await res.text()).toBeTruthy()
  return (await res.json()).data.pagination.total
}

interface MailhogMessage {
  Content: { Headers: Record<string, string[]> }
  Raw: { To: string[] }
}

async function mailhogMessages(): Promise<MailhogMessage[]> {
  const res = await api.get(`${MAILHOG_URL}/api/v2/messages?limit=200`)
  expect(res.ok(), 'mailhog HTTP API must be reachable on :8025').toBeTruthy()
  return (await res.json()).items ?? []
}

async function countMailhogTo(recipient: string): Promise<number> {
  const msgs = await mailhogMessages()
  return msgs.filter((m) => m.Raw.To.some((t) => t.includes(recipient))).length
}

async function loginUi(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('admin@kdl.com').fill(ADMIN.email)
  await page.getByPlaceholder('••••••••').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard/)
}

// FormField renders <div><Label/><Input/></div> without htmlFor — locate the
// wrapper by its direct-child label text, then take its input/textarea.
function fieldInput(scope: Locator, label: string): Locator {
  return scope
    .locator(`div:has(> label:has-text("${label}"))`)
    .locator('input, textarea')
    .first()
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  api = await request.newContext()
  const login = await api.post(`${API_URL}/auth/login`, {
    data: { email: ADMIN.email, password: ADMIN.password },
  })
  expect(login.ok(), 'seeded super admin must be able to log in').toBeTruthy()
  adminToken = (await login.json()).data.accessToken
  await ensureModuleUninstalled()
})

test.afterAll(async () => {
  // Restore pre-test state: module may be ENABLED (happy path) or anything
  // else after a mid-run failure.
  const status = await getModuleStatus()
  if (status === 'DISABLED' || status === 'INSTALLED') {
    await api.post(`${API_URL}/modules/integrations/enable`, { headers: authHeaders() })
  }
  await ensureModuleUninstalled()
  await api.dispose()
})

test('1. install + enable integrations module via API', async () => {
  const install = await api.post(`${API_URL}/modules/integrations/install`, {
    headers: authHeaders(),
  })
  expect(install.status(), await install.text()).toBe(201)
  expect((await install.json()).data.module.status).toBe('INSTALLED')

  const enable = await api.post(`${API_URL}/modules/integrations/enable`, {
    headers: authHeaders(),
  })
  expect(enable.status(), await enable.text()).toBe(200)
  expect((await enable.json()).data.module.status).toBe('ENABLED')
})

test('2. add SMTP provider (mailhog) via UI and set as default EMAIL provider', async ({ page }) => {
  await loginUi(page)
  await page.goto('/admin/integrations')
  await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible()

  await page.getByRole('button', { name: 'Add Provider' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Add Provider')).toBeVisible()

  // Channel defaults to EMAIL and driver to smtp — fill the smtp fields.
  await fieldInput(dialog, 'Display Name').fill(PROVIDER_NAME)
  await fieldInput(dialog, 'SMTP Host').fill('mailhog')
  await fieldInput(dialog, 'SMTP Port').fill('1025')
  // mailhog needs no auth, but the smtp driver requires non-empty user/pass —
  // mailhog accepts (and ignores) any credentials.
  await fieldInput(dialog, 'Username').fill('mailhog')
  await fieldInput(dialog, 'Password').fill('mailhog')
  await fieldInput(dialog, 'From Address').fill('e2e@kdl-test.local')

  await dialog.locator('#toggle-is_active').click()
  await dialog.locator('#toggle-is_default').click()

  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Provider card shows the name plus Active + Default badges.
  const card = page.locator('div.rounded-lg.border', { hasText: PROVIDER_NAME }).first()
  await expect(card).toBeVisible()
  await expect(card.getByText('Active', { exact: true })).toBeVisible()
  await expect(card.getByText('Default', { exact: true })).toBeVisible()
})

test('3. test-send via UI → log entry reaches status SENT', async ({ page }) => {
  await loginUi(page)
  await page.goto('/admin/integrations')

  const card = page.locator('div.rounded-lg.border', { hasText: PROVIDER_NAME }).first()
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Test send' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(`Test Send — ${PROVIDER_NAME}`)).toBeVisible()
  await fieldInput(dialog, 'Recipient').fill(TEST_RECIPIENT)
  await fieldInput(dialog, 'Subject').fill(TEST_SUBJECT)
  await fieldInput(dialog, 'Message').fill('Hello from the KDL-97 Playwright gate.')
  await dialog.getByRole('button', { name: 'Send Test' }).click()

  await expect(dialog.getByText('Sent successfully')).toBeVisible({ timeout: 15_000 })
  const logLink = dialog.locator('a[href*="/admin/integrations/logs?id="]')
  testLogId = (await logLink.textContent())?.trim() ?? ''
  expect(testLogId, 'test-send dialog must expose the log id').not.toBe('')

  // Worker processes the queued job asynchronously — poll until SENT.
  await expect
    .poll(
      async () => {
        const res = await api.get(`${API_URL}/integrations/logs?source=test&limit=20`, {
          headers: authHeaders(),
        })
        if (!res.ok()) return 'logs-unavailable'
        const logs: Array<{ id: string; status: string; error: string | null }> =
          (await res.json()).data.logs ?? []
        const entry = logs.find((l) => l.id === testLogId)
        return entry ? `${entry.status}${entry.error ? `:${entry.error}` : ''}` : 'log-missing'
      },
      { timeout: 30_000, message: `log ${testLogId} must reach status SENT` },
    )
    .toBe('SENT')
})

test('4. mailhog received the test message', async () => {
  await expect
    .poll(async () => countMailhogTo(TEST_RECIPIENT), {
      timeout: 15_000,
      message: `mailhog must hold a message addressed to ${TEST_RECIPIENT}`,
    })
    .toBeGreaterThan(0)

  const msgs = await mailhogMessages()
  const msg = msgs.find((m) => m.Raw.To.some((t) => t.includes(TEST_RECIPIENT)))
  expect(msg?.Content.Headers.Subject?.[0]).toBe(TEST_SUBJECT)
})

test('5. disable module → integrations API is gated', async () => {
  logsTotalBeforeFallback = await getLogsTotal()

  const res = await api.post(`${API_URL}/modules/integrations/disable`, {
    headers: authHeaders(),
  })
  expect(res.status(), await res.text()).toBe(200)
  expect((await res.json()).data.module.status).toBe('DISABLED')

  const gated = await api.get(`${API_URL}/integrations/providers`, { headers: authHeaders() })
  expect(gated.status()).toBe(404)
})

test('6. password reset email still delivers via direct SMTP fallback', async () => {
  const before = await countMailhogTo(ADMIN.email)

  const res = await api.post(`${API_URL}/auth/forgot-password`, {
    data: { email: ADMIN.email },
  })
  expect(res.ok(), await res.text()).toBeTruthy()

  // Email queue worker → sendEmail → module DISABLED → direct nodemailer SMTP
  // (mailhog). Poll until the reset mail lands.
  await expect
    .poll(async () => countMailhogTo(ADMIN.email), {
      timeout: 20_000,
      message: 'password reset email must arrive in mailhog via direct SMTP',
    })
    .toBeGreaterThan(before)
})

test('7. fallback did not go through the integrations worker', async () => {
  // Re-enable to reach the logs API; the fallback send must not have created
  // any new IntegrationLog rows (dispatchMessage throws before logging when
  // the module is disabled, so email.service falls back to direct SMTP).
  const res = await api.post(`${API_URL}/modules/integrations/enable`, {
    headers: authHeaders(),
  })
  expect(res.status(), await res.text()).toBe(200)

  expect(await getLogsTotal()).toBe(logsTotalBeforeFallback)
})
