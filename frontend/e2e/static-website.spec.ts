/**
 * Convert to Static Website: one click prepares the project folder, builds the static site in the
 * backend and offers the zip. Real stack, headless.
 *
 *   cd frontend && E2E_BASE_URL=http://localhost:3001 E2E_ADMIN_PASSWORD=... \
 *     pnpm e2e e2e/static-website.spec.ts
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { ADMIN } from './helpers/credentials'

test.setTimeout(900_000)

test('convert to a static website in one click, then download it', async ({ page, request }) => {
  const login = await request.post('/api/auth/login', {
    data: { email: ADMIN.email, password: ADMIN.password },
  })
  expect(login.ok()).toBe(true)
  const { data } = await login.json()
  const token = data.accessToken ?? data.tokens?.accessToken
  const projects = await (
    await request.get('/api/projects', { headers: { authorization: `Bearer ${token}` } })
  ).json()
  const list = projects.data.items ?? projects.data
  const projectId: string = list[0].id

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByPlaceholder('admin@kdl.com').fill(ADMIN.email)
  await page.getByPlaceholder('••••••••').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard/)

  await page.goto(`/admin/static-website?projectId=${projectId}`)
  // First-run wizard (shown while Identity is incomplete) covers the page; dismiss it if present.
  const later = page.getByRole('button', { name: 'Ask me later' })
  await later.waitFor({ timeout: 5000 }).then(
    () => later.click(),
    () => {}
  )
  await expect(page.getByRole('heading', { name: 'Convert to Static Website' })).toBeVisible()

  // A bad Web app address is rejected on the spot, before anything is prepared or built.
  await page.getByText('Forms on the static website').click()
  await page.getByLabel(/Web app address/).fill('not a url')
  await page.getByTestId('convert-static').click()
  await expect(page.getByTestId('api-base-error')).toContainText('full address')
  await page.getByLabel(/Web app address/).fill('')

  // One click: prepare the latest content, then build.
  await page.getByTestId('convert-static').click()
  await expect(page.getByTestId('static-state')).toHaveText('running', { timeout: 120_000 })
  // Not offered while it runs, even if an earlier conversion left a result behind.
  await expect(page.getByTestId('download-static')).toHaveCount(0)
  await expect(page.getByTestId('convert-static')).toContainText('Convert again', {
    timeout: 800_000,
  })
  await expect(page.getByTestId('static-state')).toHaveText('done')

  // The result names the folder on the host and offers the same files as a zip.
  await expect(page.getByTestId('static-folder')).toContainText('frontend/projects/')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-static').click(),
  ])
  const file = await download.path()
  expect(fs.statSync(file).size).toBeGreaterThan(10_000)

  expect(errors).toEqual([])
})
