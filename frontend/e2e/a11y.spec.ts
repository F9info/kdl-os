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

async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('admin@kdl.com').fill(ADMIN.email)
  await page.getByPlaceholder('••••••••').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  // Seeded admin has must_change_password=true on first login → handle redirect.
  // On subsequent calls (password already changed) login goes directly to dashboard.
  await page.waitForURL(/\/change-password|\/admin\/dashboard|\/login/, { timeout: 15_000 })
  if (page.url().includes('/change-password')) {
    await page.locator('input[autocomplete="current-password"]').fill(ADMIN.password)
    await page.locator('input[autocomplete="new-password"]').first().fill(ADMIN.changedPassword)
    await page.locator('input[autocomplete="new-password"]').last().fill(ADMIN.changedPassword)
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15_000 })
  } else if (page.url().includes('/login')) {
    // Password was already changed by an earlier test — use the new password.
    await page.getByPlaceholder('••••••••').fill(ADMIN.changedPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15_000 })
  }
}

test.describe('A11y smoke — WCAG 2.2 AA', () => {
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
