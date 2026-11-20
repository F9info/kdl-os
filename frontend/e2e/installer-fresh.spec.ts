/**
 * The first-run installer, end to end, on an EMPTY database (the only state in which it exists).
 *
 * It needs a stack nobody has installed yet. Without E2E_FRESH_INSTALL it is skipped, so the normal e2e run against
 * an installed stack is unaffected.
 *
 *   E2E_FRESH_INSTALL=1 E2E_BASE_URL=http://localhost:3800 \
 *     pnpm e2e e2e/installer-fresh.spec.ts
 *
 * Afterwards the stack has the admin created here (asha@acme.test); run e2e/platform-sweep.spec.ts against it with
 * E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD set to that admin.
 */
import { test, expect } from '@playwright/test'

export const INSTALLED_ADMIN = {
  name: 'Asha Rao',
  email: 'asha@acme.test',
  password: 'correct horse battery 9',
}
// A 1x1 PNG: the wizard only checks the bytes are a real image.
const LOGO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==',
  'base64'
)

test.skip(!process.env.E2E_FRESH_INSTALL, 'needs an empty database')
test.describe.configure({ mode: 'serial' })

test('every step, then launch, then sign in as the new admin', async ({ page }) => {
  test.setTimeout(8 * 60_000)
  await page.goto('/install')

  // 1 company
  await expect(page.getByText('Step 1 of 7')).toBeVisible()
  await page.setInputFiles('input[aria-label="Company logo file"]', {
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: LOGO,
  })
  await page.getByLabel('Company name').fill('Acme Robotics')
  await page.getByLabel(/^Phone/).fill('+91 98765 43210')
  await page.waitForTimeout(1500) // upload
  await page.getByRole('button', { name: 'Next' }).click()

  // 2 application type
  await expect(page.getByText('Step 2 of 7')).toBeVisible()
  await page.getByRole('radio', { name: /^Admin \+ Frontend/ }).click()
  await page.getByRole('button', { name: 'Next' }).click()

  // 3 database
  await expect(page.getByText('Step 3 of 7')).toBeVisible()
  await page.waitForSelector('button:not([disabled]):has-text("Next")')
  await page.getByRole('button', { name: 'Next' }).click()

  // 4 admin: a weak password is refused before anything is saved
  await expect(page.getByText('Step 4 of 7')).toBeVisible()
  await page.getByLabel(/^Name/).fill(INSTALLED_ADMIN.name)
  await page.getByLabel(/^Email/).fill(INSTALLED_ADMIN.email)
  await page.getByLabel(/^Password/).fill('short')
  await page.getByLabel(/^Confirm password/).fill('short')
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Step 4 of 7')).toBeVisible()
  await page.getByLabel(/^Password/).fill(INSTALLED_ADMIN.password)
  await page.getByLabel(/^Confirm password/).fill(INSTALLED_ADMIN.password)
  await page.getByRole('button', { name: 'Next' }).click()

  // 5 core install
  await expect(page.getByText('Step 5 of 7')).toBeVisible()
  await page.getByRole('button', { name: /Run core installation/ }).click()
  await expect(page.getByText('Core installation is complete')).toBeVisible({ timeout: 240_000 })
  await page.getByRole('button', { name: 'Next' }).click()

  // 6 modules: core listed, sample website on by default
  await expect(page.getByText('Step 6 of 7')).toBeVisible()
  await expect(page.getByText('Core, always on')).toBeVisible()
  await expect(page.getByLabel('Start with a sample website')).toBeChecked()
  await page.reload() // the server remembers where the wizard was
  await expect(page.getByText('Step 6 of 7')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Next' }).click()

  // 7 launch
  await expect(page.getByText('Step 7 of 7')).toBeVisible()
  await page.getByRole('button', { name: /Launch KDL OS/ }).click()
  await expect(page.getByText('Your workspace is ready')).toBeVisible({ timeout: 290_000 })
  await expect(page.getByText(/Modules enabled/)).toBeVisible()
  await page.getByRole('button', { name: /Sign in to admin/ }).click()
  await page.waitForURL(/\/login/)
  await page.waitForLoadState('networkidle') // the form must be hydrated before it is typed into

  await page.getByLabel(/^Email/).fill(INSTALLED_ADMIN.email)
  await page.locator('input[type=password]').fill(INSTALLED_ADMIN.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/admin\//, { timeout: 30_000 })
})

test('afterwards the installer is closed', async ({ request }) => {
  const res = await request.get('/api/install/status')
  expect((await res.json()).data.installed).toBe(true)
  // Once complete, launching again and every write are refused.
  const again = await request.post('/api/install/complete')
  expect(again.status()).toBe(409)
  const write = await request.put('/api/install/company', {
    data: { name: 'Other', logo_path: 'identity/a-1.png' },
  })
  expect(write.status()).toBe(409)
})
