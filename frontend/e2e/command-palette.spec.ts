// KDL-292 — command palette (Cmd/Ctrl-K) + keyboard-shortcut layer smoke test.
import { test, expect } from '@playwright/test';

test.describe('Command palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('admin@kdl.com').fill('admin@kdl.com');
    await page.getByPlaceholder('••••••••').fill('Admin@123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test('Cmd/Ctrl-K opens the palette, fuzzy search navigates, Escape closes', async ({ page }) => {
    await page.keyboard.press('ControlOrMeta+k');

    const dialog = page.getByRole('dialog', { name: 'Command palette' });
    await expect(dialog).toBeVisible();

    await page.getByPlaceholder('Search pages and actions…').fill('usr');
    await page.getByRole('option', { name: 'Users' }).click();

    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(dialog).not.toBeVisible();

    await page.keyboard.press('ControlOrMeta+k');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('? opens the shortcuts help dialog', async ({ page }) => {
    await page.keyboard.press('?');

    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Open command palette')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
