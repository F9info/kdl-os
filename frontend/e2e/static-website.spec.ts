/**
 * T8.2 - Static website page: prepare the project folder, build the static site in the backend,
 * download the zip. Real stack, headless.
 *
 *   cd frontend && E2E_BASE_URL=http://localhost:3001 E2E_ADMIN_PASSWORD=... \
 *     pnpm e2e e2e/static-website.spec.ts
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { ADMIN } from './helpers/credentials'

test.setTimeout(900_000)

test('prepare, build and download the static site', async ({ page, request }) => {
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
  await expect(page.getByRole('heading', { name: 'Static website' })).toBeVisible()

  await page.getByTestId('prepare-static').click()
  await expect(page.getByTestId('static-ready')).toBeVisible({ timeout: 60_000 })

  await page.getByTestId('build-static').click()
  await expect(page.getByTestId('static-state')).toHaveText(/running|done/)
  await expect(page.getByTestId('static-state')).toHaveText('done', { timeout: 800_000 })

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-static').click(),
  ])
  const file = await download.path()
  expect(fs.statSync(file).size).toBeGreaterThan(10_000)

  // A bad backend address is rejected without starting a build.
  await page.getByLabel(/Backend address/).fill('not a url')
  await page.getByTestId('build-static').click()
  await expect(page.getByText('apiBase must be a full URL')).toBeVisible()

  expect(errors).toEqual([])
})
