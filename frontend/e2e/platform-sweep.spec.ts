/**
 * Platform sweep on an INSTALLED stack: the dashboard's platform status, the main admin screens, the demo landing
 * pages and the installer being closed. Read-only: it changes nothing.
 *
 *   E2E_BASE_URL=http://localhost:3001 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... pnpm e2e e2e/platform-sweep.spec.ts
 *
 * Landing-page checks run only when the four demo pages exist (a stack installed with sample content).
 */
import { test, expect, type Page } from '@playwright/test'
import { ADMIN } from './helpers/credentials'

async function login(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByLabel(/^Email/).fill(ADMIN.email)
  await page.locator('input[type=password]').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/admin\//, { timeout: 30_000 })
}

test('the installer is closed on an installed stack', async ({ request, page }) => {
  expect((await (await request.get('/api/install/status')).json()).data.installed).toBe(true)
  await page.goto('/install')
  await expect(page).toHaveURL(/\/login/)
})

test('the dashboard shows the platform status', async ({ page }) => {
  await login(page)
  await page.goto('/admin/dashboard')
  const platform = page.getByTestId('platform-status')
  await expect(platform).toBeVisible({ timeout: 20_000 })
  await expect(platform.getByText(/of \d+ enabled/)).toBeVisible()
  await expect(platform.getByText(/of \d+ ran/)).toBeVisible()
  await expect(platform.getByRole('alert')).toHaveCount(0) // no failed seeder
})

test('the main admin screens open', async ({ page }) => {
  await login(page)
  for (const [path, heading] of [
    ['/admin/modules', /Modules/],
    ['/admin/users', /Users/],
    ['/admin/pages', /Pages/],
    ['/admin/settings', /Settings/],
    ['/admin/media', /Media/],
  ] as const) {
    const res = await page.goto(path)
    expect(res?.status(), path).toBeLessThan(400)
    await expect(page.locator('body'), path).toContainText(heading)
  }
})

test.describe('demo landing pages', () => {
  const KEYS = ['business', 'saas', 'agency', 'startup']

  test('each renders with its own header look and a working menu link', async ({
    page,
    request,
  }) => {
    const present = await Promise.all(
      KEYS.map(async (k) => (await request.get(`/p/${k}`)).status() === 200)
    )
    test.skip(
      present.some((p) => !p),
      'demo landing pages are not installed on this stack'
    )

    const looks = new Set<string>()
    for (const k of KEYS) {
      await page.goto(`/p/${k}`, { waitUntil: 'networkidle' })
      const header = page.locator('header').first()
      looks.add(await header.evaluate((el) => `${el.className}|${el.firstElementChild?.className}`))
      const link = header.locator('nav a').first()
      await expect(link, `${k} header menu`).toBeVisible()
      const href = (await link.getAttribute('href')) ?? ''
      expect(href, `${k} header link`).toMatch(/^#.+/) // resolved to a section, never a dead "#"
      await link.click()
      await expect(page.locator(`[id="${href.slice(1)}"]`), `${k} anchor target`).toHaveCount(1)
    }
    expect(looks.size).toBe(4)
  })
})
