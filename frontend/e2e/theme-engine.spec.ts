/**
 * KDL-178 C2 E2E gate — Theme Engine module (independent grader spec).
 *
 * Drives the ADVANCED editor (the page opens on the Simple view by default, so
 * beforeEach pins `te_view=advanced`).
 *
 * Gate 1: edit a Web App color in the admin UI → Save → GET /tokens?platform=webapp
 *         reflects the new value in BOTH css and json.
 * Gate 2: theme-engine is a core, always-on engine module (PRODUCT_MODES_ARCH §2b:
 *         "do NOT achieve this by unmounting routes"), so the old disable → 404 →
 *         re-enable round trip can no longer happen. The gate now pins the current
 *         contract: the lifecycle API refuses to disable it (409) and the attempt
 *         leaves routes, schema, tokens and the editor page untouched.
 * KDL-631: platform navigation (platform-btn-*) is clickable, every platform renders
 *         an editor with editable inputs, and an edited color survives a reload.
 *
 * Prerequisites: full stack running (frontend :3001, backend :4000), images
 * built from the gate branch, theme-engine seeded + module ENABLED.
 * Run:
 *   cd frontend && E2E_BASE_URL=http://localhost:3001 pnpm e2e e2e/theme-engine.spec.ts
 * (override E2E_API_URL / E2E_ADMIN_PASSWORD when the stack differs from the defaults).
 */
import {
  test,
  expect,
  request,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test'
import { ADMIN } from './helpers/credentials'

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000/api'
const NEW_COLOR = '#0b1c2d'
const EDIT_COLOR = '#1a2b3c'
const THEMES = ['dark', 'light', 'focus']

const PLATFORMS = [
  { id: 'webapp', label: 'Webapp' },
  { id: 'tv', label: 'TV' },
  { id: 'android', label: 'Android Native' },
  { id: 'ios', label: 'iOS Native' },
]

// The slice of GET /theme-engine/schema this spec reads. There is no group.tag and no
// field.effective_value: a group is theme-scoped when its slug ends in a mode id, and
// `value` is already the effective value (`updated_at` is set only when a row is saved).
interface SchemaField {
  id: string
  slug: string
  input_type: string
  value: string
  locked_by: string | null
  updated_at: string | null
}
interface SchemaPane {
  id: string
  type_id: string
  modes: { id: string }[] | null
  groups: { slug: string; fields: SchemaField[] }[]
}

let api: APIRequestContext
let adminToken: string

// Target field + pane state, discovered from the real seeded schema in beforeAll.
let targetPaneId: string
let targetTypeCuid: string
let targetFieldId: string
let targetFieldSlug: string
let targetMode: string | null // theme mode tab that shows the field (null = untagged group)
let expectedCssVar: string
let savedBefore: { field_id: string; value: string }[] // pane rows saved before the run
let paneWritten = false // a UI save happened → afterAll must put the pane back

const authHeaders = () => ({ Authorization: `Bearer ${adminToken}` })

async function getModuleStatus(): Promise<string | null> {
  const res = await api.get(`${API_URL}/modules`, { headers: authHeaders() })
  if (!res.ok()) return null
  const modules: Array<{ slug: string; status: string }> = (await res.json()).data?.modules ?? []
  return modules.find((m) => m.slug === 'theme-engine')?.status ?? null
}

async function ensureEnabled() {
  const status = await getModuleStatus()
  if (status === 'ENABLED') return
  if (status === 'AVAILABLE' || status === null) {
    const r = await api.post(`${API_URL}/modules/theme-engine/install`, {
      headers: authHeaders(),
    })
    expect(r.ok(), `install failed: ${await r.text()}`).toBeTruthy()
  }
  const r = await api.post(`${API_URL}/modules/theme-engine/enable`, { headers: authHeaders() })
  expect(r.ok(), `enable failed: ${await r.text()}`).toBeTruthy()
}

async function fetchSchema(platform: string): Promise<{ schema: SchemaPane[] }> {
  const res = await api.get(`${API_URL}/theme-engine/schema?platform=${platform}`, {
    headers: authHeaders(),
  })
  expect(res.ok(), `schema ${platform} failed: ${res.status()}`).toBeTruthy()
  return (await res.json()).data
}

async function fetchTokens(platform: string) {
  const res = await api.get(`${API_URL}/theme-engine/tokens?platform=${platform}`)
  expect(res.ok(), `tokens ${platform} failed: ${res.status()}`).toBeTruthy()
  return (await res.json()).data
}

// slug {platform}.{pane}.[{theme}.]{section}.{field} → theme-neutral css var --{pane}_{section}_{field}
function cssVarFromSlug(slug: string): string {
  return (
    '--' +
    slug
      .split('.')
      .slice(1)
      .filter((seg, i) => !(i === 1 && THEMES.includes(seg)))
      .map((s) => s.replace(/[^a-z0-9]/gi, '_').toLowerCase())
      .join('_')
  )
}

async function loginUi(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('admin@kdl.com').fill(ADMIN.email)
  await page.getByPlaceholder('••••••••').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard/)
}

/** Open the target field's pane and theme-mode tab (the editor only shows the ACTIVE mode's groups). */
async function showTargetField(page: Page): Promise<Locator> {
  const paneBtn = page.getByTestId(`pane-btn-${targetPaneId}`)
  await expect(paneBtn, 'pane sidebar did not render from the real /schema payload').toBeVisible({
    timeout: 15_000,
  })
  await paneBtn.click()
  if (targetMode) await page.getByTestId(`mode-tab-${targetMode}`).click()

  const fieldRow = page.getByTestId(`field-row-${targetFieldId}`)
  await expect(fieldRow, `field row ${targetFieldSlug} not rendered`).toBeVisible({
    timeout: 10_000,
  })
  return fieldRow
}

/** Edit the target field's color input, assert Save enables, click it and expect POST /values → 200. */
async function editAndSave(page: Page, color: string) {
  const colorInput = (await showTargetField(page)).locator('input[type="color"]')
  await expect(colorInput).toBeVisible()
  await colorInput.fill(color)

  const saveBtn = page.getByTestId('btn-save')
  await expect(saveBtn, 'Save did not enable after edit (dirty tracking broken)').toBeEnabled()

  paneWritten = true
  const [saveResponse] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/theme-engine/values') && r.request().method() === 'POST'
    ),
    saveBtn.click(),
  ])
  expect(
    saveResponse.status(),
    `POST /values returned ${saveResponse.status()}: ${await saveResponse.text()}`
  ).toBe(200)
}

// The editor's Save posts the WHOLE pane (every field of both themes), so one UI save leaves a
// saved row behind for every field of it. Put the pane back exactly as found: reset drops all
// saved rows (scoped to this one Type — only webapp.branding setting_values are deleted), then
// the rows that existed before the run are saved again.
async function restoreTargetPane() {
  const body = { platform: 'webapp', type_id: targetTypeCuid }
  const reset = await api.post(`${API_URL}/theme-engine/reset`, {
    headers: authHeaders(),
    data: body,
  })
  expect(reset.ok(), `pane reset failed: ${await reset.text()}`).toBeTruthy()
  if (!savedBefore.length) return
  const resave = await api.post(`${API_URL}/theme-engine/values`, {
    headers: authHeaders(),
    data: { ...body, values: savedBefore },
  })
  expect(
    resave.ok(),
    `re-saving the pane's original rows failed (${await resave.text()}); they were: ${JSON.stringify(savedBefore)}`
  ).toBeTruthy()
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  api = await request.newContext()
  const login = await api.post(`${API_URL}/auth/login`, {
    data: { email: ADMIN.email, password: ADMIN.password },
  })
  expect(login.ok(), 'seeded super admin must be able to log in').toBeTruthy()
  adminToken = (await login.json()).data.accessToken
  await ensureEnabled()

  // Pick a real color field of the Web App 'branding' pane. Plain /tokens?platform=webapp compiles
  // untagged + dark groups into :root and json (light lands in [data-theme="light"] only), so only
  // those qualify. Prefer a field nobody has saved yet: the run never starts from a custom value.
  const pane = (await fetchSchema('webapp')).schema.find((p) => p.id === 'branding')
  if (!pane) throw new Error("webapp schema has no 'branding' pane")
  const candidates = pane.groups.flatMap((group) => {
    const last = group.slug.split('.').pop() ?? ''
    const mode = pane.modes?.some((m) => m.id === last) ? last : null
    return mode === null || mode === 'dark'
      ? group.fields
          .filter((f) => f.input_type === 'color' && !f.locked_by)
          .map((field) => ({ field, mode }))
      : []
  })
  const target = candidates.find((c) => !c.field.updated_at) ?? candidates[0]
  if (!target) throw new Error('no editable dark/untagged color field in the webapp branding pane')

  targetPaneId = pane.id
  targetTypeCuid = pane.type_id
  targetFieldId = target.field.id
  targetFieldSlug = target.field.slug
  targetMode = target.mode
  expectedCssVar = cssVarFromSlug(targetFieldSlug)
  const fields = pane.groups.flatMap((g) => g.fields)
  savedBefore = fields.filter((f) => f.updated_at).map((f) => ({ field_id: f.id, value: f.value }))

  // An aborted earlier run leaves its test colors saved: never adopt them as the "original" state.
  const leftovers = fields.filter((f) => [NEW_COLOR, EDIT_COLOR].includes(f.value.toLowerCase()))
  expect(
    leftovers.map((f) => f.slug),
    'webapp branding pane holds test colors from an aborted run: reset it before re-running'
  ).toEqual([])
})

test.afterAll(async () => {
  try {
    if (paneWritten) await restoreTargetPane()
  } finally {
    // Safety net: should the disable attempt in Gate 2 ever succeed, put the module back.
    await ensureEnabled()
    await api.dispose()
  }
})

// These gates drive the Advanced editor (Save button, pane list). The page
// opens on the Simple view by default, so pin the saved view preference.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('te_view', 'advanced')
    } catch {
      /* storage unavailable: the default view is used */
    }
  })
})

test('Gate 1 — admin UI edit → Save → /tokens reflects new value (css + json)', async ({
  page,
}) => {
  await loginUi(page)
  await page.goto('/admin/theme-engine')
  await editAndSave(page, NEW_COLOR)

  // Round-trip: public tokens endpoint must reflect the new value in css AND json.
  const tokens = await fetchTokens('webapp')
  expect(tokens.css, `css missing ${expectedCssVar}: ${NEW_COLOR}`).toContain(
    `${expectedCssVar}: ${NEW_COLOR}`
  )
  expect(JSON.stringify(tokens.json)).toContain(NEW_COLOR)
})

test('Gate 2 — core module: disable refused → routes mounted, schema/tokens/UI unchanged', async ({
  page,
}) => {
  // Pre-attempt snapshot across all 4 platforms + tokens.
  const schemaBefore: Record<string, string> = {}
  for (const { id } of PLATFORMS) schemaBefore[id] = JSON.stringify(await fetchSchema(id))
  const tokensBefore = JSON.stringify(await fetchTokens('webapp'))

  // theme-engine is the always-on engine layer (core): the lifecycle API must refuse to disable it.
  const dis = await api.post(`${API_URL}/modules/theme-engine/disable`, {
    headers: authHeaders(),
  })
  expect(dis.status(), `core module must refuse disable: ${await dis.text()}`).toBe(409)
  expect(await getModuleStatus(), 'theme-engine must stay ENABLED').toBe('ENABLED')

  // Routes stay mounted (fetchSchema / fetchTokens fail on a 404) and nothing changed:
  // schema and tokens byte-identical to the pre-attempt snapshot.
  for (const { id } of PLATFORMS) {
    expect(
      JSON.stringify(await fetchSchema(id)),
      `schema ${id} changed by the disable attempt`
    ).toBe(schemaBefore[id])
  }
  expect(JSON.stringify(await fetchTokens('webapp')), 'tokens changed by the disable attempt').toBe(
    tokensBefore
  )

  // UI: the editor page still renders.
  await loginUi(page)
  await page.goto('/admin/theme-engine')
  await expect(page.getByTestId('theme-engine-page')).toBeVisible({ timeout: 15_000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// KDL-631: blanket pointer-events-none removed — platform navigation must work
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true when no ancestor of `locator` carries pointer-events:none (own or inherited). */
async function noPointerBlockingAncestor(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => {
    let node: Element | null = el.parentElement
    while (node) {
      const style = window.getComputedStyle(node)
      if (style.pointerEvents === 'none') return false
      node = node.parentElement
    }
    return true
  })
}

test.describe('KDL-631 — platform navigation clickable with template-engine enabled', () => {
  test.describe.configure({ mode: 'serial' })

  test('platform buttons have no pointer-events-none ancestor (blanket wrapper gone)', async ({
    page,
  }) => {
    await loginUi(page)
    await page.goto('/admin/theme-engine')
    await expect(page.getByTestId('platform-bar')).toBeVisible({ timeout: 15_000 })

    for (const { id, label } of PLATFORMS) {
      const button = page.getByTestId(`platform-btn-${id}`)
      await expect(button).toBeVisible()
      const clean = await noPointerBlockingAncestor(button)
      expect(clean, `An ancestor of the ${label} platform button carries pointer-events:none`).toBe(
        true
      )
    }
  })

  for (const { id, label } of PLATFORMS) {
    test(`${label} — platform button click → editor renders with ≥1 editable input`, async ({
      page,
    }) => {
      const platformRowIds = new Set(
        (await fetchSchema(id)).schema.flatMap((p) =>
          p.groups.flatMap((g) => g.fields.map((f) => `field-row-${f.id}`))
        )
      )
      await loginUi(page)
      await page.goto('/admin/theme-engine')

      await page.getByTestId(`platform-btn-${id}`).click()
      await expect(page.getByTestId('theme-engine-page')).toBeVisible({ timeout: 15_000 })

      // At least one input or button inside the field area (editor loaded real schema).
      const fieldInputs = page.locator(
        '[data-testid^="field-row-"] input, [data-testid^="field-row-"] select, [data-testid^="field-row-"] button'
      )
      await expect(fieldInputs.first()).toBeVisible({ timeout: 15_000 })
      const count = await fieldInputs.count()
      expect(count, `${label} editor rendered 0 editable inputs`).toBeGreaterThan(0)

      // ...and the rows are THIS platform's (an inert button would leave the default Web App editor).
      const firstRow = await page
        .locator('[data-testid^="field-row-"]')
        .first()
        .getAttribute('data-testid')
      expect(
        platformRowIds.has(firstRow ?? ''),
        `${label} editor shows another platform's fields`
      ).toBe(true)
    })
  }

  test('Webapp — edit one color, save, reload, value persisted', async ({ page }) => {
    await loginUi(page)
    await page.goto('/admin/theme-engine')
    await editAndSave(page, EDIT_COLOR)

    // Reload and assert value persisted (the mode tab is not persisted: showTargetField picks it again).
    await page.reload()
    const reloadedInput = (await showTargetField(page)).locator('input[type="color"]')
    await expect(reloadedInput).toHaveValue(EDIT_COLOR)
  })
})
