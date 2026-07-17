/**
 * NOTIFICATIONS_ARCH Step 7 E2E gate — KDL-107
 *
 * Scenario A (standalone):
 *   install + enable notifications module → broadcast to all →
 *   bell badge appears for second user (non-super-admin) →
 *   mark read → preferences opt-out suppresses next broadcast.
 *
 * Scenario B (with integrations + mailhog — skipped when unavailable):
 *   EMAIL channel → dispatchMessage → activity log status SENT.
 *
 * Prerequisites: full stack running (frontend :3001, backend :4000).
 *   docker compose up -d
 * Run standalone:
 *   cd frontend && E2E_BASE_URL=http://localhost:3001 pnpm e2e e2e/notifications.spec.ts
 */
import { test, expect, request, type APIRequestContext, type Page } from '@playwright/test'
import { ADMIN } from './helpers/credentials'

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000/api'
const MAILHOG_URL = process.env.E2E_MAILHOG_URL ?? 'http://localhost:8025'

const RUN_ID = Date.now().toString(36)
const MEMBER_EMAIL = `e2e-notif-${RUN_ID}@test.local`
const MEMBER_PASSWORD = 'Member@123456'

let api: APIRequestContext
let adminToken: string
let memberToken: string
let memberId: string
let e2eProviderId: string | null = null

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` })

async function getModuleStatus(slug: string): Promise<string | null> {
  const res = await api.get(`${API_URL}/modules`, { headers: authHeaders(adminToken) })
  if (!res.ok()) return null
  const modules: Array<{ slug: string; status: string }> =
    (await res.json()).data?.modules ?? []
  return modules.find((m) => m.slug === slug)?.status ?? null
}

async function ensureNotificationsUninstalled() {
  const status = await getModuleStatus('notifications')
  if (status === null || status === 'AVAILABLE') return
  if (status === 'ENABLED') {
    await api.post(`${API_URL}/modules/notifications/disable`, { headers: authHeaders(adminToken) })
  }
  await api.delete(`${API_URL}/modules/notifications`, { headers: authHeaders(adminToken) })
}

async function loginUi(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByPlaceholder('admin@kdl.com').fill(email)
  await page.getByPlaceholder('••••••••').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15_000 })
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  api = await request.newContext()

  // Login as admin
  const loginRes = await api.post(`${API_URL}/auth/login`, {
    data: { email: ADMIN.email, password: ADMIN.password },
  })
  expect(loginRes.ok(), 'seeded super-admin must be able to log in').toBeTruthy()
  adminToken = (await loginRes.json()).data.accessToken

  // Create a non-admin member for bell-badge scenario
  const createRes = await api.post(`${API_URL}/users`, {
    headers: authHeaders(adminToken),
    data: { email: MEMBER_EMAIL, password: MEMBER_PASSWORD, name: 'E2E Member' },
  })
  expect(createRes.status(), await createRes.text()).toBe(201)
  const createBody = await createRes.json()
  memberId = (createBody.data.user ?? createBody.data).id

  // Login as member
  const memberLogin = await api.post(`${API_URL}/auth/login`, {
    data: { email: MEMBER_EMAIL, password: MEMBER_PASSWORD },
  })
  expect(memberLogin.ok(), 'created member must be able to log in').toBeTruthy()
  memberToken = (await memberLogin.json()).data.accessToken

  await ensureNotificationsUninstalled()
})

test.afterAll(async () => {
  await ensureNotificationsUninstalled()
  // Remove the EMAIL provider this run created (if any)
  if (e2eProviderId) {
    await api.delete(`${API_URL}/integrations/providers/${e2eProviderId}`, {
      headers: authHeaders(adminToken),
    })
  }
  // Remove test member
  if (memberId) {
    await api.delete(`${API_URL}/users/${memberId}`, { headers: authHeaders(adminToken) })
  }
  await api.dispose()
})

// ─── Module lifecycle ────────────────────────────────────────────────────────

test('1. install notifications module — status becomes INSTALLED', async () => {
  const res = await api.post(`${API_URL}/modules/notifications/install`, {
    headers: authHeaders(adminToken),
  })
  expect(res.status(), await res.text()).toBe(201)
  const body = await res.json()
  expect(body.data.module.slug).toBe('notifications')
  expect(body.data.module.status).toBe('INSTALLED')
})

test('2. enable notifications module — status becomes ENABLED', async () => {
  const res = await api.post(`${API_URL}/modules/notifications/enable`, {
    headers: authHeaders(adminToken),
  })
  expect(res.status(), await res.text()).toBe(200)
  expect((await res.json()).data.module.status).toBe('ENABLED')
})

test('3. unread-count returns 0 for member before any broadcast', async () => {
  const res = await api.get(`${API_URL}/notifications/unread-count`, {
    headers: authHeaders(memberToken),
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  expect((await res.json()).data.count).toBe(0)
})

// ─── Broadcast + bell badge ──────────────────────────────────────────────────

test('4. admin broadcasts inline notification to all users', async () => {
  const res = await api.post(`${API_URL}/notifications/broadcast`, {
    headers: authHeaders(adminToken),
    data: {
      to: { all: true },
      inline: { title: 'E2E Broadcast', body: `Hello from E2E run ${RUN_ID}` },
      channels: ['IN_APP'],
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  const body = await res.json()
  // Small batches processed inline (returns {sent}); large batches queued (returns {batch_id})
  expect(body.data.sent !== undefined || body.data.batch_id !== undefined).toBeTruthy()
})

test('5. member unread-count rises to 1 after broadcast', async ({ page: _ }) => {
  // Allow up to 5s for the BullMQ worker to process the batch
  let count = 0
  for (let i = 0; i < 10; i++) {
    const res = await api.get(`${API_URL}/notifications/unread-count`, {
      headers: authHeaders(memberToken),
    })
    count = (await res.json()).data?.count ?? 0
    if (count >= 1) break
    await new Promise((r) => setTimeout(r, 500))
  }
  expect(count).toBeGreaterThanOrEqual(1)
})

test('6. member sees unread badge in TopBar (UI)', async ({ page }) => {
  await loginUi(page, MEMBER_EMAIL, MEMBER_PASSWORD)
  // Bell badge should show a count > 0
  const badge = page.locator('[data-testid="notification-bell-badge"]')
  await expect(badge).toBeVisible({ timeout: 10_000 })
  const text = await badge.textContent()
  expect(Number(text)).toBeGreaterThanOrEqual(1)
})

test('7. member clicks notification — bell dropdown opens', async ({ page }) => {
  await loginUi(page, MEMBER_EMAIL, MEMBER_PASSWORD)
  await page.locator('[data-testid="notification-bell"]').click()
  await expect(page.locator('[data-testid="notification-dropdown"]')).toBeVisible()
  // Broadcast message should appear
  await expect(page.getByText('E2E Broadcast')).toBeVisible()
})

// ─── Mark read ───────────────────────────────────────────────────────────────

test('8. mark-all-read via API — unread-count drops to 0', async () => {
  const res = await api.post(`${API_URL}/notifications/read-all`, {
    headers: authHeaders(memberToken),
  })
  expect(res.ok(), await res.text()).toBeTruthy()

  const countRes = await api.get(`${API_URL}/notifications/unread-count`, {
    headers: authHeaders(memberToken),
  })
  expect((await countRes.json()).data.count).toBe(0)
})

test('9. badge disappears after mark-all-read (UI)', async ({ page }) => {
  await loginUi(page, MEMBER_EMAIL, MEMBER_PASSWORD)
  // Badge element should be gone or show 0
  const badge = page.locator('[data-testid="notification-bell-badge"]')
  await expect(badge).toBeHidden({ timeout: 5_000 }).catch(async () => {
    // Acceptable: badge visible but count is 0
    expect(Number(await badge.textContent())).toBe(0)
  })
})

// ─── Preferences opt-out suppresses next broadcast ──────────────────────────

test('10. member opts out of IN_APP for system category', async () => {
  // Inline broadcasts are attributed to the 'system' category, so opting the
  // member out of system/IN_APP must suppress the next inline broadcast.
  const catRes = await api.get(`${API_URL}/notifications/categories`, {
    headers: authHeaders(adminToken),
  })
  expect(catRes.ok(), await catRes.text()).toBeTruthy()
  const categories: Array<{ id: string; slug: string }> =
    (await catRes.json()).data?.categories ?? []
  const systemCat = categories.find((c) => c.slug === 'system')
  expect(systemCat, 'system category must exist').toBeTruthy()

  const prefRes = await api.put(`${API_URL}/notifications/preferences`, {
    headers: authHeaders(memberToken),
    data: {
      preferences: [{ category_id: systemCat!.id, channel: 'IN_APP', enabled: false }],
    },
  })
  expect(prefRes.ok(), await prefRes.text()).toBeTruthy()
})

test('11. broadcast after opt-out — member receives nothing', async () => {
  const beforeRes = await api.get(`${API_URL}/notifications/unread-count`, {
    headers: authHeaders(memberToken),
  })
  const before = (await beforeRes.json()).data?.count ?? 0

  const res = await api.post(`${API_URL}/notifications/broadcast`, {
    headers: authHeaders(adminToken),
    data: {
      to: { all: true },
      inline: { title: 'Opted-out broadcast', body: `Suppressed broadcast ${RUN_ID}` },
      channels: ['IN_APP'],
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()

  // Allow time in case the batch was queued rather than processed inline
  await new Promise((r) => setTimeout(r, 3000))

  const afterRes = await api.get(`${API_URL}/notifications/unread-count`, {
    headers: authHeaders(memberToken),
  })
  const after = (await afterRes.json()).data?.count ?? 0

  expect(after, 'opted-out member must not receive the broadcast').toBe(before)
})

// ─── Integrations + mailhog EMAIL channel (conditional) ─────────────────────

test('12. EMAIL channel — dispatchMessage logs SENT via mailhog (conditional)', async () => {
  // Requires the integrations module (installed by its own E2E or manually) and
  // mailhog. Skips — with the reason in the report — when either is absent.
  let intStatus = await getModuleStatus('integrations')
  if (intStatus === 'INSTALLED') {
    await api.post(`${API_URL}/modules/integrations/enable`, { headers: authHeaders(adminToken) })
    intStatus = await getModuleStatus('integrations')
  }
  test.skip(intStatus !== 'ENABLED', `integrations module not enabled (status: ${intStatus})`)

  const mailhogCheck = await api.get(`${MAILHOG_URL}/api/v2/messages?limit=1`).catch(() => null)
  test.skip(!mailhogCheck?.ok(), 'mailhog HTTP API not reachable on :8025')

  // Ensure an active default EMAIL provider pointing at mailhog exists
  const provRes = await api.get(`${API_URL}/integrations/providers`, {
    headers: authHeaders(adminToken),
  })
  expect(provRes.ok(), await provRes.text()).toBeTruthy()
  const providers: Array<{ id: string; channel: string; is_active: boolean }> =
    (await provRes.json()).data?.items ?? []
  if (!providers.some((p) => p.channel === 'EMAIL' && p.is_active)) {
    const createRes = await api.post(`${API_URL}/integrations/providers`, {
      headers: authHeaders(adminToken),
      data: {
        channel: 'EMAIL',
        driver: 'smtp',
        name: `E2E Mailhog ${RUN_ID}`,
        credentials: { host: 'mailhog', port: 1025, user: 'mailhog', pass: 'mailhog' },
        config: { from: 'e2e@kdl.local' },
        is_active: true,
        is_default: true,
      },
    })
    expect(createRes.ok(), await createRes.text()).toBeTruthy()
    e2eProviderId = (await createRes.json()).data?.item?.id ?? null
  }

  // Inline broadcasts carry no email body — the EMAIL channel needs a template.
  // Use the seeded system.broadcast template (email_subject: {{title}}).
  const res = await api.post(`${API_URL}/notifications/broadcast`, {
    headers: authHeaders(adminToken),
    data: {
      to: { all: true },
      template: 'system.broadcast',
      data: { title: `Email E2E ${RUN_ID}`, message: `Email broadcast ${RUN_ID}` },
      channels: ['EMAIL'],
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()

  // Poll the integration log until this run's EMAIL entry reaches SENT
  // (notifications worker → dispatchMessage → integrations worker → mailhog)
  let sentLog: { status: string } | undefined
  for (let i = 0; i < 30; i++) {
    const logRes = await api.get(
      `${API_URL}/integrations/logs?channel=EMAIL&source=notifications&limit=50`,
      { headers: authHeaders(adminToken) },
    )
    expect(logRes.ok(), await logRes.text()).toBeTruthy()
    const logs: Array<{ channel: string; status: string; subject?: string | null }> =
      (await logRes.json()).data?.logs ?? []
    sentLog = logs.find(
      (l) => l.status === 'SENT' && (l.subject ?? '').includes(RUN_ID),
    )
    if (sentLog) break
    await new Promise((r) => setTimeout(r, 1000))
  }
  expect(sentLog, `integration log must show a SENT EMAIL entry for run ${RUN_ID}`).toBeTruthy()
})

// ─── Module disabled = zero footprint ────────────────────────────────────────

test('13. bell not rendered when notifications module is disabled', async ({ page }) => {
  // Disable module
  await api.post(`${API_URL}/modules/notifications/disable`, { headers: authHeaders(adminToken) })

  await loginUi(page, MEMBER_EMAIL, MEMBER_PASSWORD)
  // Bell element must not be in the DOM
  await expect(page.locator('[data-testid="notification-bell"]')).toBeHidden()
})
