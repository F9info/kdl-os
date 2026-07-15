/**
 * KDL-178 C2 E2E gate — Template Engine module (independent grader spec).
 *
 * Gate 1: edit a Web App color in the admin UI → Save → GET /tokens?platform=webapp
 *         reflects the new value in BOTH css and json.
 * Gate 2: disable the template-engine module → routes 404 → re-enable →
 *         schema + tokens byte-identical to the pre-disable snapshot
 *         (cascade-clean round-trip; row-orphan SQL check runs outside this spec).
 *
 * Prerequisites: full stack running (frontend :3001, backend :4000), images
 * built from the gate branch, template-engine seeded + module ENABLED.
 * Run:
 *   cd frontend && E2E_BASE_URL=http://localhost:3001 pnpm e2e e2e/template-engine.spec.ts
 */
import { test, expect, request, type APIRequestContext } from '@playwright/test'

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000/api'
const ADMIN = { email: 'admin@kdl.com', password: 'Admin@123' }
const NEW_COLOR = '#0b1c2d'

let api: APIRequestContext
let adminToken: string

// Target field discovered from the real seeded schema in beforeAll.
let targetPaneId: string
let targetTypeCuid: string
let targetFieldId: string
let targetFieldSlug: string
let targetOriginalValue: string
let expectedCssVar: string

const authHeaders = () => ({ Authorization: `Bearer ${adminToken}` })

async function getModuleStatus(): Promise<string | null> {
  const res = await api.get(`${API_URL}/modules`, { headers: authHeaders() })
  if (!res.ok()) return null
  const modules: Array<{ slug: string; status: string }> =
    (await res.json()).data?.modules ?? []
  return modules.find((m) => m.slug === 'template-engine')?.status ?? null
}

async function ensureEnabled() {
  const status = await getModuleStatus()
  if (status === 'ENABLED') return
  if (status === 'AVAILABLE' || status === null) {
    const r = await api.post(`${API_URL}/modules/template-engine/install`, { headers: authHeaders() })
    expect(r.ok(), `install failed: ${await r.text()}`).toBeTruthy()
  }
  const r = await api.post(`${API_URL}/modules/template-engine/enable`, { headers: authHeaders() })
  expect(r.ok(), `enable failed: ${await r.text()}`).toBeTruthy()
}

async function fetchSchema(platform: string) {
  const res = await api.get(`${API_URL}/template-engine/schema?platform=${platform}`, {
    headers: authHeaders(),
  })
  expect(res.ok(), `schema ${platform} failed: ${res.status()}`).toBeTruthy()
  return (await res.json()).data
}

async function fetchTokens(platform: string, expectOk = true) {
  const res = await api.get(`${API_URL}/template-engine/tokens?platform=${platform}`)
  if (!expectOk) return res
  expect(res.ok(), `tokens ${platform} failed: ${res.status()}`).toBeTruthy()
  return (await res.json()).data
}

// slug {platform}.{rest...} → css var --{rest joined by _, non-alnum → _}
function cssVarFromSlug(slug: string): string {
  // KDL-209 contract: compileTokens strips theme tags from the var name and
  // scopes the declaration under a theme selector block instead.
  const THEME_TAGS = new Set(['dark', 'light', 'focus'])
  return (
    '--' +
    slug
      .split('.')
      .slice(1)
      .filter((s) => !THEME_TAGS.has(s))
      .map((s) => s.replace(/[^a-z0-9]/gi, '_').toLowerCase())
      .join('_')
  )
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
  await ensureEnabled()

  // Pick a real color field from the webapp schema: prefer an untagged group
  // (always visible regardless of theme/device toggles).
  const schemaData = await fetchSchema('webapp')
  const panes: any[] = schemaData.schema ?? schemaData
  expect(Array.isArray(panes), `schema payload not an array: ${JSON.stringify(schemaData).slice(0, 200)}`).toBeTruthy()
  outer: for (const pane of panes) {
    for (const group of pane.groups ?? []) {
      if (group.tag) continue
      for (const field of group.fields ?? []) {
        if (field.input_type === 'color') {
          targetPaneId = pane.id
          targetTypeCuid = pane.type_id
          targetFieldId = field.id
          targetFieldSlug = field.slug
          targetOriginalValue = field.effective_value ?? field.value
          break outer
        }
      }
    }
  }
  expect(targetFieldId, 'no untagged color field found in webapp schema').toBeTruthy()
  expectedCssVar = cssVarFromSlug(targetFieldSlug)
  expect(targetOriginalValue).not.toBe(NEW_COLOR)
})

test.afterAll(async () => {
  // Restore the edited field to its original value via the API (real Type cuid).
  if (targetTypeCuid && targetFieldId && targetOriginalValue) {
    await api.post(`${API_URL}/template-engine/values`, {
      headers: authHeaders(),
      data: {
        platform: 'webapp',
        type_id: targetTypeCuid,
        values: [{ field_id: targetFieldId, value: targetOriginalValue }],
      },
    })
  }
  await ensureEnabled()
  await api.dispose()
})

test('Gate 1 — admin UI edit → Save → /tokens reflects new value (css + json)', async ({ page }) => {
  await loginUi(page)
  await page.goto('/admin/template-engine')

  // Step 1: platform-picker landing screen — pick Webapp to enter the editor.
  await page.getByTestId('landing-card-webapp').click()
  await page.getByTestId('landing-subcard-webapp-frontend').click()

  // Pane sidebar must render from the REAL API payload.
  await expect(
    page.getByTestId(`pane-btn-${targetPaneId}`),
    'pane sidebar did not render from the real /schema payload',
  ).toBeVisible({ timeout: 15_000 })
  await page.getByTestId(`pane-btn-${targetPaneId}`).click()

  // The target field is dark-tagged; the pane's "Editing values for" mode
  // tabs only mount the selected theme's rows, so switch to Dark first.
  await page.getByTestId('mode-tab-dark').click()

  const fieldRow = page.getByTestId(`field-row-${targetFieldId}`)
  await expect(fieldRow, `field row ${targetFieldSlug} not rendered`).toBeVisible({ timeout: 10_000 })

  const colorInput = fieldRow.locator('input[type="color"]')
  await expect(colorInput).toBeVisible()
  await colorInput.fill(NEW_COLOR)
  await colorInput.dispatchEvent('change')

  const saveBtn = page.getByTestId('btn-save')
  await expect(saveBtn, 'Save did not enable after edit (dirty tracking broken)').toBeEnabled()

  const [saveResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/template-engine/values') && r.request().method() === 'POST'),
    saveBtn.click(),
  ])
  expect(
    saveResponse.status(),
    `POST /values returned ${saveResponse.status()}: ${await saveResponse.text()}`,
  ).toBe(200)

  // Round-trip: public tokens endpoint must reflect the new value in css AND json.
  const tokens = await fetchTokens('webapp')
  expect(tokens.css, `css missing ${expectedCssVar}: ${NEW_COLOR}`).toContain(`${expectedCssVar}: ${NEW_COLOR}`)
  expect(JSON.stringify(tokens.json)).toContain(NEW_COLOR)
})

test('Gate 2 — disable → routes 404 → re-enable → schema/tokens identical, cascade-clean', async ({ page }) => {
  // Pre-disable snapshot across all 4 platforms + tokens.
  const platforms = ['webapp', 'tv', 'android', 'ios']
  const schemaBefore: Record<string, string> = {}
  for (const p of platforms) schemaBefore[p] = JSON.stringify(await fetchSchema(p))
  const tokensBefore = JSON.stringify(await fetchTokens('webapp'))

  // Disable.
  const dis = await api.post(`${API_URL}/modules/template-engine/disable`, { headers: authHeaders() })
  expect(dis.ok(), `disable failed: ${await dis.text()}`).toBeTruthy()

  // All module routes must 404 while disabled — including the public tokens route.
  const schemaRes = await api.get(`${API_URL}/template-engine/schema?platform=webapp`, { headers: authHeaders() })
  expect(schemaRes.status(), 'schema must 404 while disabled').toBe(404)
  const tokensRes = await fetchTokens('webapp', false)
  expect(tokensRes.status(), 'public tokens must 404 while disabled').toBe(404)

  // UI: module page must not render the landing screen while disabled.
  await loginUi(page)
  await page.goto('/admin/template-engine')
  await expect(page.getByTestId('template-engine-landing')).not.toBeVisible({ timeout: 10_000 })

  // Re-enable.
  const en = await api.post(`${API_URL}/modules/template-engine/enable`, { headers: authHeaders() })
  expect(en.ok(), `enable failed: ${await en.text()}`).toBeTruthy()

  // Round-trip clean: schema and tokens byte-identical — nothing orphaned, nothing lost.
  for (const p of platforms) {
    expect(JSON.stringify(await fetchSchema(p)), `schema ${p} changed across disable/enable`).toBe(schemaBefore[p])
  }
  expect(JSON.stringify(await fetchTokens('webapp')), 'tokens changed across disable/enable').toBe(tokensBefore)

  // UI back.
  await page.goto('/admin/template-engine')
  await page.getByTestId('landing-card-webapp').click()
  await page.getByTestId('landing-subcard-webapp-frontend').click()
  await expect(page.getByTestId('template-engine-page')).toBeVisible({ timeout: 15_000 })
})

// ── Gate 3 (KDL-211) — Typography: edit H1 size + family in the admin UI →
//    Save → reload → every real <h1> in the app renders with the new values.
//    The admin app consumes the `webapp_admin` platform's tokens; its desktop
//    Typography Scale drives :root (no @media), so run at a ≥1440px viewport.
const TYPO_H1_SIZE = 57 // deliberately absurd so a match can't be a default
const TYPO_H1_FAMILY = 'Montserrat' // in the schema's base FONTS choice list

test('Gate 3 — typography edit → Save → reload → h1 size/family obey tokens', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })

  // Locate the desktop Typography Scale field in the REAL webapp_admin schema.
  const schemaData = await fetchSchema('webapp_admin')
  const panes: any[] = schemaData.schema ?? schemaData
  const typoPane = panes.find((p) => p.id === 'typography')
  expect(typoPane, 'webapp_admin schema has no typography pane').toBeTruthy()
  // The device tag lives in the group slug suffix (…typography_scale.desktop),
  // not a `tag` key — see the seeded slugs from schema/index.js sections.
  let typoField: any
  for (const group of typoPane.groups ?? []) {
    if (!String(group.slug ?? '').endsWith('.desktop')) continue
    typoField = (group.fields ?? []).find((f: any) => f.input_type === 'typo_table')
    if (typoField) break
  }
  expect(typoField, 'no desktop typo_table field in webapp_admin typography pane').toBeTruthy()
  const originalTypoValue: string = typoField.effective_value ?? typoField.value
  const originalRows = JSON.parse(originalTypoValue)
  expect(originalRows[0]?.name, 'first Typography Scale row must be H1').toMatch(/^H1/i)

  try {
    // UI: landing → Webapp → Admin → Typography pane → desktop tab.
    await loginUi(page)
    await page.goto('/admin/template-engine')
    await page.getByTestId('landing-card-webapp').click()
    await page.getByTestId('landing-subcard-webapp-admin').click()
    await page.getByTestId('pane-btn-typography').click()
    await page.getByTestId('device-tab-desktop').click()

    const fieldRow = page.getByTestId(`field-row-${typoField.id}`)
    await expect(fieldRow, 'Typography Scale field row not rendered').toBeVisible({ timeout: 10_000 })

    // Row 0 = H1: first number input is Size, the 2nd select is Family
    // (1st is the size unit) — see TypographyTableControl column order.
    const h1Row = fieldRow.locator('tbody tr').first()
    await h1Row.locator('input[type="number"]').first().fill(String(TYPO_H1_SIZE))
    await h1Row.locator('select').nth(1).selectOption(TYPO_H1_FAMILY)

    const saveBtn = page.getByTestId('btn-save')
    await expect(saveBtn, 'Save did not enable after typography edit').toBeEnabled()
    const [saveResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/template-engine/values') && r.request().method() === 'POST'),
      saveBtn.click(),
    ])
    expect(saveResponse.status(), `POST /values returned ${saveResponse.status()}`).toBe(200)

    // Tokens endpoint must emit the per-row vars with the new values.
    const tokens = await fetchTokens('webapp_admin')
    expect(tokens.css).toContain(`_h1_title_size: ${TYPO_H1_SIZE}px`)
    expect(tokens.css).toContain(`_h1_title_family: ${TYPO_H1_FAMILY}`)

    // Hard reload onto a page with a real <h1> — computed style must obey.
    await page.goto('/admin/dashboard')
    // Provider injected compiled tokens (<style> is never "visible" — wait
    // for attachment, not visibility).
    await page.waitForSelector('#te-tokens', { state: 'attached' })
    const h1 = page.locator('h1').first()
    await expect(h1).toBeVisible({ timeout: 10_000 })
    await expect
      .poll(async () => h1.evaluate((el) => getComputedStyle(el).fontSize), {
        message: 'h1 font-size did not follow the Typography Scale token',
      })
      .toBe(`${TYPO_H1_SIZE}px`)
    expect(await h1.evaluate((el) => getComputedStyle(el).fontFamily)).toContain(TYPO_H1_FAMILY)
  } finally {
    // Restore the original Typography Scale rows.
    await api.post(`${API_URL}/template-engine/values`, {
      headers: authHeaders(),
      data: {
        platform: 'webapp_admin',
        type_id: typoPane.type_id,
        values: [{ field_id: typoField.id, value: originalTypoValue }],
      },
    })
  }
})
