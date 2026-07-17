import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { ADMIN } from './helpers/credentials'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function assertNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  )
  expect(
    serious,
    `A11y serious/critical violations on ${label}:\n` +
      serious
        .map(
          (v) =>
            `  [${v.impact}] ${v.id}: ${v.description}\n    Nodes: ${v.nodes.map((n) => n.html).join(', ')}`
        )
        .join('\n')
  ).toHaveLength(0)
}

test.describe('A11y smoke — WCAG 2.2 AA', () => {
  // Handle must_change_password on the seeded admin once per suite.
  // Tests that need auth use changedPassword directly so each test is
  // independent of ordering and there are no double-click races.
  test.beforeAll(async ({ browser }, testInfo) => {
    // Inherit baseURL from playwright config (not set on manually created contexts)
    const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL })
    const page = await context.newPage()
    try {
      await page.goto('/login')
      await page.getByPlaceholder('admin@kdl.com').fill(ADMIN.email)
      await page.getByPlaceholder('••••••••').fill(ADMIN.password)
      // Fire click and wait for navigation simultaneously so waitForURL
      // registers before the click resolves (avoids the current-URL race).
      // Use 'commit' so the promise resolves on URL change; Next.js SPA
      // router.push does not fire a 'load' event on client-side navigation.
      await Promise.all([
        page.waitForURL(/\/change-password|\/admin\/dashboard/, {
          timeout: 20_000,
          waitUntil: 'commit',
        }),
        page.getByRole('button', { name: 'Sign in' }).click(),
      ])
      if (page.url().includes('/change-password')) {
        await page.locator('input[autocomplete="current-password"]').fill(ADMIN.password)
        await page.locator('input[autocomplete="new-password"]').first().fill(ADMIN.changedPassword)
        await page.locator('input[autocomplete="new-password"]').last().fill(ADMIN.changedPassword)
        await page.getByRole('button', { name: 'Change password' }).click()
        await page.waitForURL(/\/admin\/dashboard/, { timeout: 20_000, waitUntil: 'commit' })
      }
      // else: password already changed (re-run against same DB) — done.
    } finally {
      await context.close()
    }
  })

  async function loginAsAdmin(page: Page) {
    await page.goto('/login')
    await page.getByPlaceholder('admin@kdl.com').fill(ADMIN.email)
    await page.getByPlaceholder('••••••••').fill(ADMIN.changedPassword)
    await Promise.all([
      page.waitForURL(/\/admin\/dashboard/, { timeout: 20_000, waitUntil: 'commit' }),
      page.getByRole('button', { name: 'Sign in' }).click(),
    ])
  }

  test('login page', async ({ page }) => {
    await page.goto('/login')
    await assertNoSeriousViolations(page, '/login')
  })

  test('forgot-password form', async ({ page }) => {
    await page.goto('/forgot-password')
    await assertNoSeriousViolations(page, '/forgot-password')
  })

  test('dashboard', async ({ page }) => {
    await loginAsAdmin(page)
    await assertNoSeriousViolations(page, '/admin/dashboard')
  })

  test('users list', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')
    await assertNoSeriousViolations(page, '/admin/users')
  })
})
