/**
 * T1.3 — Admin "Application Identity" page.
 *
 * Real: login, auth, permissions, admin shell + sidebar (served by the running backend).
 * Mocked (page.route): GET/PUT /api/identity and POST /api/identity/upload — the real
 * identity endpoints are covered by backend/src/modules/identity/identity.test.js, and the
 * running Docker backend image predates the identity module. No database writes happen.
 *
 * Run (headless):
 *   cd frontend && E2E_BASE_URL=http://localhost:3200 pnpm e2e e2e/identity-settings.spec.ts
 */
import { test, expect, type Page, type Locator } from '@playwright/test'
import { ADMIN } from './helpers/credentials'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==',
  'base64'
)

const EMPTY = {
  app_name: '',
  app_title: '',
  description: '',
  logo_light: '',
  logo_dark: '',
  favicon: '',
  brand_primary: '',
  brand_secondary: '',
  contact_email: '',
  contact_phone: '',
  contact_address: '',
  copyright: '',
  social_facebook: '',
  social_x: '',
  social_instagram: '',
  social_linkedin: '',
  social_youtube: '',
}

interface Mock {
  state: Record<string, string>
  puts: Record<string, string>[]
  failNextPut: boolean
}

async function installMocks(page: Page, initial: Record<string, string> = {}): Promise<Mock> {
  const mock: Mock = { state: { ...EMPTY, ...initial }, puts: [], failNextPut: false }
  const resolved = () => ({
    logo_light: mock.state.logo_light ? '/__e2e/logo.png' : '',
    logo_dark: mock.state.logo_dark ? '/__e2e/logo.png' : '',
    favicon: mock.state.favicon ? '/__e2e/logo.png' : '',
  })
  // Same as clicking "Ask me later" on the first-run onboarding dialog: client-only, no server write.
  await page.addInitScript(() => sessionStorage.setItem('kdl_frontend_onboarding_later', '1'))
  await page.route('**/__e2e/logo.png', (r) => r.fulfill({ contentType: 'image/png', body: PNG }))
  await page.route('**/api/identity', async (route) => {
    const req = route.request()
    if (req.method() === 'PUT') {
      const body = req.postDataJSON() as Record<string, string>
      mock.puts.push(body)
      if (mock.failNextPut) {
        mock.failNextPut = false
        return route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Validation failed',
            errors: {
              fieldErrors: {
                logo_light: ['Must be empty, a storage path, a /path, or an http(s) URL'],
              },
            },
          }),
        })
      }
      mock.state = { ...mock.state, ...body }
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { identity: mock.state, resolved: resolved() } }),
    })
  })
  await page.route('**/api/identity/upload', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { path: 'settings/e2e-logo.png', url: '/__e2e/logo.png' },
      }),
    })
  )
  return mock
}

async function loginUi(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle') // dev server: let React hydrate before the form is used
  await page.getByPlaceholder('admin@kdl.com').fill(ADMIN.email)
  await page.getByPlaceholder('••••••••').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard/)
}

// FormField renders <div><Label/><Input/></div>; locate the wrapper by its direct-child label.
const field = (scope: Page | Locator, label: string) =>
  scope
    .locator(`div:has(> label:has-text("${label}"))`)
    .locator('input:not([type="color"]):not([type="file"]), textarea')
    .first()

const errors: string[] = []
const failed: string[] = []
test.beforeEach(({ page }) => {
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('requestfailed', (r) => failed.push(`${r.method()} ${r.url()} ${r.failure()?.errorText}`))
})
test.afterAll(() => {
  console.log(
    `console errors: ${errors.length}\n${errors.join('\n')}\nfailed requests: ${failed.length}\n${failed.join('\n')}`
  )
})

for (const vp of [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 375, height: 812 },
]) {
  test.describe(`identity page — ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test('loads, edits, saves, and persists across reload', async ({ page }) => {
      const mock = await installMocks(page, { app_name: 'Acme', brand_primary: '#112233' })
      await loginUi(page)
      await page.goto('/admin/settings/identity')

      await expect(page.getByRole('heading', { name: 'Application Identity' })).toBeVisible()
      await expect(field(page, 'Application name')).toHaveValue('Acme')
      await expect(field(page, 'Primary brand color')).toHaveValue('#112233')

      await field(page, 'Application name').fill('Acme Corp')
      await field(page, 'Contact email').fill('hi@acme.com')
      await page.getByRole('button', { name: 'Save identity' }).click()

      await expect(page.getByText('Identity saved')).toBeVisible()
      expect(mock.puts).toHaveLength(1)
      expect(mock.puts[0]).toMatchObject({ app_name: 'Acme Corp', contact_email: 'hi@acme.com' })

      await page.reload()
      await expect(field(page, 'Application name')).toHaveValue('Acme Corp')
      await expect(field(page, 'Contact email')).toHaveValue('hi@acme.com')
      await page.screenshot({ path: `test-results/identity-${vp.name}.png`, fullPage: true })
    })

    test('blocks invalid email and hex color client-side without calling the API', async ({
      page,
    }) => {
      const mock = await installMocks(page)
      await loginUi(page)
      await page.goto('/admin/settings/identity')

      await field(page, 'Contact email').fill('nope')
      await field(page, 'Primary brand color').fill('red')
      await page.getByRole('button', { name: 'Save identity' }).click()

      await expect(page.getByText('Enter a valid email.')).toBeVisible()
      await expect(page.getByText('Use a hex color like #1a2b3c.')).toBeVisible()
      expect(mock.puts).toHaveLength(0)
    })

    test('shows server-side field errors from a 422', async ({ page }) => {
      const mock = await installMocks(page)
      mock.failNextPut = true
      await loginUi(page)
      await page.goto('/admin/settings/identity')

      await field(page, 'Application name').fill('X')
      await page.getByRole('button', { name: 'Save identity' }).click()
      await expect(
        page.getByText('Must be empty, a storage path, a /path, or an http(s) URL')
      ).toBeVisible()
      await expect(page.getByText('Some fields are invalid.')).toBeVisible()
    })

    test('uploads a logo, previews it, saves the storage path, and removes it', async ({
      page,
    }) => {
      const mock = await installMocks(page)
      await loginUi(page)
      await page.goto('/admin/settings/identity')

      await page
        .getByTestId('upload-logo_light')
        .setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG })
      await expect(page.getByAltText('Logo (light background) preview')).toBeVisible()

      await page.getByRole('button', { name: 'Save identity' }).click()
      await expect(page.getByText('Identity saved')).toBeVisible()
      expect(mock.puts[0]?.logo_light).toBe('settings/e2e-logo.png')

      await page.getByRole('button', { name: 'Remove' }).first().click()
      await expect(page.getByAltText('Logo (light background) preview')).toHaveCount(0)
      await page.getByRole('button', { name: 'Save identity' }).click()
      await expect.poll(() => mock.puts.at(-1)?.logo_light).toBe('')
    })

    test('has no horizontal scroll and the Identity nav entry exists', async ({ page }) => {
      await installMocks(page)
      await loginUi(page)
      await page.goto('/admin/settings/identity')
      await expect(page.getByRole('heading', { name: 'Application Identity' })).toBeVisible()

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      )
      expect(overflow).toBeLessThanOrEqual(0)
      await expect(page.getByRole('button', { name: 'Save identity' })).toBeVisible()
      // Sidebar link is in the DOM (collapsed drawer on mobile, so only assert presence).
      await expect(page.locator('a[href="/admin/settings/identity"]').first()).toHaveCount(1)
    })
  })
}
