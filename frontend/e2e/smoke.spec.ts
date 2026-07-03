import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('should navigate to the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('KDL Starter Kit');
  });

  test('should allow a user to log in', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@kdl.com');
    await page.fill('input[name="password"]', 'Admin@123');
    await page.click('button[type="submit"]');
    // Assuming successful login redirects to the dashboard or shows a welcome message
    await expect(page.url()).toContain('/dashboard'); 
    await expect(page.locator('text="Welcome"')).toBeVisible(); // Replace with actual welcome text or element
  });

  test('should allow a user to reset password', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await page.fill('input[name="email"]', 'admin@kdl.com'); // Use a valid email for testing
    await page.click('button[type="submit"]');
    await expect(page.locator('text="Password reset email sent."')).toBeVisible(); // Replace with actual success message
  });
});