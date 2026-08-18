import { test, expect } from '@playwright/test'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3101'
const CREDS = { email: 'admin@kdl.com', password: 'Admin@123' }

test('debug: login and check URL', async ({ page }) => {
  // Listen for console errors
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(`PAGE ERROR: ${err.message}`))

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })

  await page.screenshot({ path: '/tmp/kdl440/debug-login.png' })

  await page.getByPlaceholder('admin@kdl.com').fill(CREDS.email)
  await page.getByPlaceholder('••••••••').fill(CREDS.password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  // Wait a bit for redirect
  await page.waitForTimeout(5000)

  const url = page.url()
  const title = await page.title()
  const bodyText = await page.textContent('body').catch(() => 'N/A')

  await page.screenshot({ path: '/tmp/kdl440/debug-after-login.png', fullPage: true })

  console.log(`URL after login: ${url}`)
  console.log(`Page title: ${title}`)
  console.log(`Body first 500: ${bodyText?.slice(0, 500)}`)
  console.log(`Console errors: ${JSON.stringify(errors.slice(0, 5))}`)

  // Just report state, don't assert
  expect(url).toBeTruthy()
})
