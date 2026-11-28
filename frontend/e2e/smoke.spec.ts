// Rewritten for KDL-41: the original scaffold spec targeted routes and copy that
// never existed in this app (/auth/login, "Welcome", "Password reset email sent.").
import { test, expect } from '@playwright/test'
import { ADMIN } from './helpers/credentials'

test.describe('Smoke Tests', () => {
  test('root shows the public website, or the login page on an admin-only install', async ({
    page,
  }) => {
    // With the Frontend module installed "/" is the website's home page; without it "/" sends visitors to sign in.
    await page.goto('/')
    await expect(page).toHaveURL(/\/(login)?$/)
    if (page.url().endsWith('/login')) {
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    } else {
      await expect(page.getByText('Application error')).toHaveCount(0)
      await expect(page.locator('body')).not.toBeEmpty()
    }
  })

  test('seeded super admin can log in and reach the dashboard', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('admin@kdl.com').fill(ADMIN.email)
    await page.getByPlaceholder('••••••••').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    // The seeded admin has must_change_password=true — handle the forced change screen.
    await page.waitForURL(/\/change-password|\/admin\/dashboard/, { timeout: 8000 })
    if (page.url().includes('/change-password')) {
      // getByLabel('New password') is ambiguous — "Confirm new password" contains
      // "new password" as a substring, causing a strict-mode violation. Use explicit
      // autocomplete attributes instead (set on the inputs in change-password/page.tsx).
      await page.locator('input[autocomplete="current-password"]').fill(ADMIN.password)
      await page.locator('input[autocomplete="new-password"]').first().fill(ADMIN.changedPassword)
      await page.locator('input[autocomplete="new-password"]').last().fill(ADMIN.changedPassword)
      await page.getByRole('button', { name: 'Change password' }).click()
    }

    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 })
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('forgot password shows the neutral confirmation', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.getByPlaceholder('you@example.com').fill('admin@kdl.com')
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await expect(
      page.getByText('If an account exists for that address, we have sent a password reset link.')
    ).toBeVisible()
  })
})
