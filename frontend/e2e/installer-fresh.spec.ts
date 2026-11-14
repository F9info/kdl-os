/**
 * The first-run installer, end to end, on an EMPTY database (the only state in which it exists).
 *
 * It needs a stack nobody has installed yet, plus the setup token the backend prints in its log
 * (`docker compose logs backend | grep "SETUP TOKEN"`, or `npm run install:token`). Without both it is skipped, so the
 * normal e2e run against an installed stack is unaffected.
 *
 *   E2E_FRESH_INSTALL=1 E2E_SETUP_TOKEN=<token> E2E_BASE_URL=http://localhost:3800 \
 *     pnpm e2e e2e/installer-fresh.spec.ts
 *
 * Afterwards the stack has the admin created here (asha@acme.test); run e2e/platform-sweep.spec.ts against it with
 * E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD set to that admin.
 */
import { test, expect } from '@playwright/test'

const TOKEN = process.env.E2E_SETUP_TOKEN ?? ''
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

test.skip(!process.env.E2E_FRESH_INSTALL || !TOKEN, 'needs an empty database and E2E_SETUP_TOKEN')
test.describe.configure({ mode: 'serial' })

test('the installer rejects a wrong setup token', async ({ page }) => {
  await page.goto('/install')
  await page.getByLabel('Setup token').fill('definitely-not-the-token')
  await page
    .getByRole('button', { name: /continue|open|unlock|verify|next/i })
    .first()
    .click()
  await expect(page.getByRole('alert').first()).toBeVisible()
  await expect(page).toHaveURL(/\/install/) // not thrown to /login
})

test('every step, then launch, then sign in as the new admin', async ({ page }) => {
  test.setTimeout(8 * 60_000)
  await page.goto('/install')
  await page.getByLabel('Setup token').fill(TOKEN)
  await page
    .getByRole('button', { name: /continue|open|unlock|verify|next/i })
    .first()
    .click()

  // 1 database
  await expect(page.getByText('Step 1 of 7')).toBeVisible()
  await page.waitForSelector('button:not([disabled]):has-text("Next")')
  await page.getByRole('button', { name: 'Next' }).click()

  // 2 company
  await expect(page.getByText('Step 2 of 7')).toBeVisible()
  await page.setInputFiles('input[aria-label="Company logo file"]', {
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: LOGO,
  })
  await page.getByLabel('Company name').fill('Acme Robotics')
  await page.getByLabel(/^Phone/).fill('+91 98765 43210')
  await page.waitForTimeout(1500) // upload
  await page.getByRole('button', { name: 'Next' }).click()

  // 3 admin: a weak password is refused before anything is saved
  await expect(page.getByText('Step 3 of 7')).toBeVisible()
  await page.getByLabel(/^Name/).fill(INSTALLED_ADMIN.name)
  await page.getByLabel(/^Email/).fill(INSTALLED_ADMIN.email)
  await page.getByLabel(/^Password/).fill('short')
  await page.getByLabel(/^Confirm password/).fill('short')
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Step 3 of 7')).toBeVisible()
  await page.getByLabel(/^Password/).fill(INSTALLED_ADMIN.password)
  await page.getByLabel(/^Confirm password/).fill(INSTALLED_ADMIN.password)
  await page.getByRole('button', { name: 'Next' }).click()

  // 4 core install
  await expect(page.getByText('Step 4 of 7')).toBeVisible()
  await page.getByRole('button', { name: /Run core installation/ }).click()
  await expect(page.getByText('Core installation is complete')).toBeVisible({ timeout: 240_000 })
  await page.getByRole('button', { name: 'Next' }).click()

  // 5 application type
  await expect(page.getByText('Step 5 of 7')).toBeVisible()
  await page.getByRole('radio', { name: /^Admin \+ Frontend/ }).click()
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
  // The setup token is deleted on success, so launching again is refused at the token check; any write is refused as complete.
  const again = await request.post('/api/install/complete', { headers: { 'x-setup-token': TOKEN } })
  expect([401, 409]).toContain(again.status())
  const write = await request.put('/api/install/company', {
    headers: { 'x-setup-token': TOKEN },
    data: { name: 'Other', logo_path: 'identity/a-1.png' },
  })
  expect(write.status()).toBe(409)
})
