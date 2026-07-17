import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function assertNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(
    serious,
    `A11y serious/critical violations on ${label}:\n` +
      serious
        .map((v) => `  [${v.impact}] ${v.id}: ${v.description}\n    Nodes: ${v.nodes.map((n) => n.html).join(', ')}`)
        .join('\n'),
  ).toHaveLength(0);
}

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('admin@kdl.com').fill('admin@kdl.com');
  await page.getByPlaceholder('••••••••').fill('Admin@123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15_000 });
}

test.describe('A11y smoke — WCAG 2.2 AA', () => {
  test('login page', async ({ page }) => {
    await page.goto('/login');
    await assertNoSeriousViolations(page, '/login');
  });

  test('forgot-password form', async ({ page }) => {
    await page.goto('/forgot-password');
    await assertNoSeriousViolations(page, '/forgot-password');
  });

  test('dashboard', async ({ page }) => {
    await loginAsAdmin(page);
    await assertNoSeriousViolations(page, '/admin/dashboard');
  });

  test('users list', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    await assertNoSeriousViolations(page, '/admin/users');
  });
});
