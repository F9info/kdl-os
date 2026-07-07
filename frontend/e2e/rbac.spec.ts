/**
 * RBAC end-to-end suite — KDLOS-10 Step 9 (KDL-41).
 *
 * Covers the full dynamic-RBAC flow:
 *  1. Super admin creates a role with a single permission (types:view) via the UI
 *  2. Role is assigned to a fresh test user via the API
 *  3. That user logs in through the UI
 *  4. UI gating: admin-only menu items hidden, visible items accessible
 *  5. API gating: forbidden calls return 403 with { success: false, message: 'Forbidden' }
 *  6. Super admin bypasses all permission checks (incl. roles:delete, granted to no role)
 *  7. Suspended user's still-valid token is rejected with 403 'Account is inactive'
 *  8. Soft-deleted user cannot log in (401, UI stays on /login with an error)
 *
 * Prerequisites: full stack running with the seeded super admin (admin@kdl.com).
 *   docker compose up -d   →  frontend :3001, backend :4000
 * Run standalone:
 *   cd frontend && E2E_BASE_URL=http://localhost:3001 pnpm e2e e2e/rbac.spec.ts
 *
 * Test data is suffixed with a unique run id and cleaned up in afterAll, so the
 * suite is re-runnable against the same database.
 */
import { test, expect, request, type APIRequestContext, type Page } from '@playwright/test'

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000/api'
const ADMIN = { email: 'admin@kdl.com', password: 'Admin@123' }
const PASSWORD = 'E2e@Password123'

const RUN = `${Date.now().toString(36)}-${Math.floor(Math.random() * 10000)}`
const ROLE_NAME = `E2E Viewer ${RUN}`
const VIEWER_EMAIL = `e2e-viewer-${RUN}@e2e.test`
const SUSPENDED_EMAIL = `e2e-suspended-${RUN}@e2e.test`
const DELETED_EMAIL = `e2e-deleted-${RUN}@e2e.test`

let api: APIRequestContext
let adminToken: string
let typesViewPermissionId: string
let roleId: string
let viewerUserId: string
let suspendedUserId: string
let deletedUserId: string

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` })

async function loginApi(email: string, password: string) {
  const res = await api.post(`${API_URL}/auth/login`, { data: { email, password } })
  return res
}

async function loginUi(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByPlaceholder('admin@kdl.com').fill(email)
  await page.getByPlaceholder('••••••••').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

async function createUser(body: Record<string, unknown>): Promise<string> {
  const res = await api.post(`${API_URL}/users`, {
    headers: authHeaders(adminToken),
    data: body,
  })
  expect(res.status(), await res.text()).toBe(201)
  const { data } = await res.json()
  return (data.user ?? data).id
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  api = await request.newContext()

  const login = await loginApi(ADMIN.email, ADMIN.password)
  expect(login.ok(), 'seeded super admin must be able to log in').toBeTruthy()
  adminToken = (await login.json()).data.accessToken

  const matrixRes = await api.get(`${API_URL}/permissions/matrix`, {
    headers: authHeaders(adminToken),
  })
  expect(matrixRes.ok()).toBeTruthy()
  const matrixData = (await matrixRes.json()).data
  const matrix = (matrixData.matrix ?? matrixData) as Array<{
    name: string
    actions: Record<string, string | null>
  }>
  const typesModule = matrix.find((m) => m.name === 'types')
  expect(typesModule, 'seeded "types" permission module must exist').toBeTruthy()
  typesViewPermissionId = typesModule!.actions.view!
  expect(typesViewPermissionId).toBeTruthy()
})

test.afterAll(async () => {
  // Best-effort cleanup so the suite is re-runnable.
  for (const id of [viewerUserId, suspendedUserId, deletedUserId]) {
    if (id) {
      await api
        .delete(`${API_URL}/users/${id}`, { headers: authHeaders(adminToken) })
        .catch(() => {})
    }
  }
  if (roleId) {
    await api
      .delete(`${API_URL}/roles/${roleId}`, { headers: authHeaders(adminToken) })
      .catch(() => {})
  }
  await api.dispose()
})

test('1. super admin creates a role with only types:view via the UI', async ({ page }) => {
  await loginUi(page, ADMIN.email, ADMIN.password)
  await expect(page).toHaveURL(/\/admin\/dashboard/)

  await page.goto('/admin/roles')
  await page.getByRole('button', { name: 'Create role' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByPlaceholder('e.g. Content Editor').fill(ROLE_NAME)
  // Cell checkbox aria-label is "<module label> <action>".
  await dialog.getByRole('checkbox', { name: 'Types view', exact: true }).check()
  await dialog.getByRole('button', { name: 'Create role' }).click()
  await expect(dialog).toBeHidden()

  // New role visible in the roles table.
  await expect(page.getByText(ROLE_NAME)).toBeVisible()

  // Resolve the role id via the API and confirm exactly one permission.
  const listRes = await api.get(`${API_URL}/roles?limit=100`, {
    headers: authHeaders(adminToken),
  })
  expect(listRes.ok()).toBeTruthy()
  const listData = (await listRes.json()).data
  const roles = (listData.roles ?? listData) as Array<{
    id: string
    name: string
    permission_count?: number
  }>
  const created = roles.find((r) => r.name === ROLE_NAME)
  expect(created, 'role created through the UI must be returned by GET /roles').toBeTruthy()
  roleId = created!.id
  if (created!.permission_count !== undefined) {
    expect(created!.permission_count).toBe(1)
  }
})

test('2. role is assigned to a fresh test user', async () => {
  viewerUserId = await createUser({
    name: 'E2E Viewer',
    email: VIEWER_EMAIL,
    password: PASSWORD,
  })

  const res = await api.patch(`${API_URL}/users/${viewerUserId}`, {
    headers: authHeaders(adminToken),
    data: { role_ids: [roleId] },
  })
  expect(res.status(), await res.text()).toBe(200)

  // Resolved permissions for that user are exactly types:view, no bypass.
  const viewerLogin = await loginApi(VIEWER_EMAIL, PASSWORD)
  expect(viewerLogin.ok()).toBeTruthy()
  const viewerToken = (await viewerLogin.json()).data.accessToken
  const permsRes = await api.get(`${API_URL}/auth/me/permissions`, {
    headers: authHeaders(viewerToken),
  })
  expect(permsRes.ok()).toBeTruthy()
  const perms = (await permsRes.json()).data
  expect(perms.bypass).toBe(false)
  expect(perms.permissions).toEqual(['types:view'])
})

test('3+4. limited user logs in; restricted menu hidden, visible items accessible', async ({
  page,
}) => {
  await loginUi(page, VIEWER_EMAIL, PASSWORD)
  await expect(page).toHaveURL(/\/admin\/dashboard/)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  const sidebar = page.locator('aside')
  // Visible + accessible for everyone.
  await expect(sidebar.getByRole('link', { name: 'Dashboard' })).toBeVisible()
  // Admin-only entries must be hidden for the limited user.
  await expect(sidebar.getByRole('link', { name: 'Users' })).toHaveCount(0)
  await expect(sidebar.getByRole('link', { name: 'Media' })).toHaveCount(0)
  await expect(sidebar.getByText('Access Control')).toHaveCount(0)
  await expect(sidebar.getByRole('link', { name: 'Roles' })).toHaveCount(0)
  await expect(sidebar.getByRole('link', { name: 'Permissions' })).toHaveCount(0)
  await expect(sidebar.getByRole('link', { name: 'Activity Log' })).toHaveCount(0)
  // Viewer has types:view — "Application Settings" group shows with only Types visible.
  await expect(sidebar.getByText('Application Settings')).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Categories' })).toHaveCount(0)
  await expect(sidebar.getByRole('link', { name: 'Fields' })).toHaveCount(0)

  // The one visible item actually navigates.
  await sidebar.getByRole('link', { name: 'Dashboard' }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard/)
})

test('4b. non-super-admin with types:view can access the PermissionGuard-protected types page', async ({
  page,
}) => {
  await loginUi(page, VIEWER_EMAIL, PASSWORD)
  await expect(page).toHaveURL(/\/admin\/dashboard/)

  // Navigate directly to the types admin page (guarded by PermissionGuard permission="types:view").
  await page.goto('/admin/settings/types')

  // The page content must render — not a "Permission Denied" screen.
  await expect(page.getByRole('heading', { name: /types/i })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Permission Denied')).toHaveCount(0)
})

test('5. API gating: allowed call 200, forbidden calls 403 with correct error shape', async () => {
  const viewerLogin = await loginApi(VIEWER_EMAIL, PASSWORD)
  const viewerToken = (await viewerLogin.json()).data.accessToken
  const headers = authHeaders(viewerToken)

  // Granted: types:view.
  const allowed = await api.get(`${API_URL}/types`, { headers })
  expect(allowed.status(), await allowed.text()).toBe(200)

  // Forbidden: write on the same module, plus other modules entirely.
  const forbidden = [
    api.post(`${API_URL}/types`, { headers, data: { name: `E2E Nope ${RUN}` } }),
    api.get(`${API_URL}/users`, { headers }),
    api.get(`${API_URL}/roles`, { headers }),
    api.delete(`${API_URL}/roles/${roleId}`, { headers }),
  ]
  for (const req of forbidden) {
    const res = await req
    expect(res.status()).toBe(403)
    const body = await res.json()
    expect(body).toMatchObject({ success: false, message: 'Forbidden' })
  }

  // The forbidden delete must not have removed the role.
  const stillThere = await api.get(`${API_URL}/roles/${roleId}`, {
    headers: authHeaders(adminToken),
  })
  expect(stillThere.status()).toBe(200)
})

test('6. super admin bypasses all permission checks', async () => {
  const headers = authHeaders(adminToken)

  const permsRes = await api.get(`${API_URL}/auth/me/permissions`, { headers })
  expect((await permsRes.json()).data.bypass).toBe(true)

  for (const url of [
    `${API_URL}/users`,
    `${API_URL}/roles`,
    `${API_URL}/permissions/matrix`,
    `${API_URL}/types`,
  ]) {
    const res = await api.get(url, { headers })
    expect(res.status(), `super admin GET ${url}`).toBe(200)
  }

  // roles:delete is granted to NO seeded role — only the super-admin bypass
  // allows it. Create a throwaway role and delete it.
  const createRes = await api.post(`${API_URL}/roles`, {
    headers,
    data: { name: `E2E Bypass ${RUN}`, permission_ids: [] },
  })
  expect(createRes.status(), await createRes.text()).toBe(201)
  const createData = (await createRes.json()).data
  const tempRoleId = (createData.role ?? createData).id
  const delRes = await api.delete(`${API_URL}/roles/${tempRoleId}`, { headers })
  expect(delRes.status(), await delRes.text()).toBe(200)
})

test('7. suspended user cannot authenticate — valid token rejected with 403', async () => {
  suspendedUserId = await createUser({
    name: 'E2E Suspended',
    email: SUSPENDED_EMAIL,
    password: PASSWORD,
  })

  // Obtain a token while the account is still active.
  const login = await loginApi(SUSPENDED_EMAIL, PASSWORD)
  expect(login.ok()).toBeTruthy()
  const token = (await login.json()).data.accessToken

  // Token works before suspension…
  const before = await api.get(`${API_URL}/auth/me/permissions`, {
    headers: authHeaders(token),
  })
  expect(before.status()).toBe(200)

  // …suspend the user…
  const suspend = await api.patch(`${API_URL}/users/${suspendedUserId}`, {
    headers: authHeaders(adminToken),
    data: { status: 'SUSPENDED' },
  })
  expect(suspend.status(), await suspend.text()).toBe(200)

  // …and the same (still cryptographically valid) token now gets 403.
  const after = await api.get(`${API_URL}/auth/me/permissions`, {
    headers: authHeaders(token),
  })
  expect(after.status()).toBe(403)
  expect(await after.json()).toMatchObject({ success: false, message: 'Account is inactive' })

  // Fresh login is refused too (credentials-neutral 401).
  const relogin = await loginApi(SUSPENDED_EMAIL, PASSWORD)
  expect(relogin.status()).toBe(401)
})

test('8. soft-deleted user cannot log in', async ({ page }) => {
  deletedUserId = await createUser({
    name: 'E2E Deleted',
    email: DELETED_EMAIL,
    password: PASSWORD,
  })

  const del = await api.delete(`${API_URL}/users/${deletedUserId}`, {
    headers: authHeaders(adminToken),
  })
  expect(del.status(), await del.text()).toBe(200)

  // API: login refused.
  const login = await loginApi(DELETED_EMAIL, PASSWORD)
  expect(login.status()).toBe(401)
  expect(await login.json()).toMatchObject({ success: false, message: 'Invalid credentials' })

  // UI: the login POST comes back 401 and the user stays on /login.
  await page.goto('/login')
  await page.getByPlaceholder('admin@kdl.com').fill(DELETED_EMAIL)
  await page.getByPlaceholder('••••••••').fill(PASSWORD)
  const loginResponse = page.waitForResponse(
    (r) => r.url().includes('/auth/login') && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Sign in' }).click()
  expect((await loginResponse).status()).toBe(401)
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})
