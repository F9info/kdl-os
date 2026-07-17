// Rewritten for KDL-41: the original scaffold spec targeted routes and copy that
// never existed in this app (/auth/login, "Welcome", "Password reset email sent.").
import { test, expect } from '@playwright/test'
import { ADMIN } from './helpers/credentials'

test.describe('Smoke Tests', () => {
  test('root redirects to the login page', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })

  test('seeded super admin can log in and reach the dashboard', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('admin@kdl.com').fill(ADMIN.email)
    await page.getByPlaceholder('••••••••').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    // The seeded admin has must_change_password=true — handle the forced change screen.
    await page.waitForURL(/\/change-password|\/admin\/dashboard/, { timeout: 8000 })
    if (page.url().includes('/change-password')) {
      await page.getByLabel('Current password').fill(ADMIN.password)
      await page.getByLabel('New password').fill(ADMIN.changedPassword)
      await page.getByLabel('Confirm new password').fill(ADMIN.changedPassword)
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
