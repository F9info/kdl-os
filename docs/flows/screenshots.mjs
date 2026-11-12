// Captures the real admin screens used by the flow guides (read-only: it only opens pages).
// Run: cd frontend && node ../docs/flows/screenshots.mjs   (stack on http://localhost:3001)
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

// Resolve playwright from the frontend workspace (run this from frontend/).
const { chromium } = await import(
  pathToFileURL(path.join(process.cwd(), 'node_modules/playwright/index.mjs')).href
)

const BASE = process.env.BASE_URL || 'http://localhost:3001'
const EMAIL = process.env.ADMIN_EMAIL || 'admin@kdl.com'
const PASS = process.env.ADMIN_PASSWORD || 'Admin@123'
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'img')

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1360, height: 820 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()

await page.goto(`${BASE}/login`)
await page.waitForLoadState('networkidle')
await page.screenshot({ path: `${OUT}/login.jpg`, type: 'jpeg', quality: 82 })
await page.locator('input[type=email], input[name=email]').first().fill(EMAIL)
await page.locator('input[type=password]').first().fill(PASS)
await page.locator('button[type=submit]').first().click()
await page.waitForURL(/\/admin|\/membership/, { timeout: 30000 })

// The Studio redirects /admin/template-engine to the default project's page: read its id from there.
await page.goto(`${BASE}/admin/template-engine`, { waitUntil: 'networkidle', timeout: 45000 })
const projectId = page.url().match(/projects\/([^/?]+)/)?.[1] ?? null
console.log('project', projectId)

const SHOTS = [
  ['dashboard', '/admin/dashboard'],
  ['modules', '/admin/modules'],
  ['identity', '/admin/settings/identity'],
  ['products', '/admin/settings/products'],
  ['themes', '/admin/theme-engine'],
  ['brands', '/admin/brands'],
  ['landing-pages', '/admin/landing-pages'],
  ['static-website', '/admin/static-website'],
  ['pages', '/admin/pages'],
  ['sections', '/admin/page-builder/section-builder'],
  ['navigation', '/admin/menus'],
  ['layouts', '/admin/layouts'],
  ['website-details', '/admin/website-details'],
  ['color-palette', '/admin/color-palette'],
  ['users', '/admin/users'],
  ['roles', '/admin/roles'],
  ['permissions', '/admin/permissions'],
  ['media', '/admin/media'],
  ['notifications', '/admin/notifications'],
  ['integrations', '/admin/integrations'],
  ['activity-log', '/admin/activity-log'],
  ['documents', '/admin/documents'],
  ['membership', '/admin/membership'],
  ...(projectId
    ? [
        ['studio-overview', `/admin/template-engine/projects/${projectId}/intake`],
        ['studio-palette', `/admin/template-engine/projects/${projectId}/palette`],
        ['studio-website', `/admin/template-engine/projects/${projectId}/website`],
      ]
    : []),
]
let wizardShot = false
for (const [name, url] of SHOTS) {
  try {
    await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForTimeout(1200)
    // First-run setup wizard opens over every page until it is answered: keep one shot of it, then close it.
    const wizard = page.getByRole('dialog')
    if (await wizard.isVisible().catch(() => false)) {
      if (!wizardShot) {
        await page.screenshot({ path: `${OUT}/wizard-1.jpg`, type: 'jpeg', quality: 82 })
        wizardShot = true
      }
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    }
    await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 82 })
    console.log('ok', name, page.url().replace(BASE, ''))
  } catch (e) {
    console.log('FAIL', name, e.message.split('\n')[0])
  }
}
// Modules page with the search box filled: the module cards a guide tells the reader to find.
// First the default view (13 cards; Frontend folds Landing, Website, Forms and the content modules together),
// then "Show internal" (every individual module, e.g. Landing Pages and Templates).
await page.goto(`${BASE}/admin/modules`, { waitUntil: 'networkidle', timeout: 45000 })
await page.keyboard.press('Escape')
const search = async (term, name) => {
  const box = page.getByPlaceholder(/Search modules/)
  await box.fill(term)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 82 })
  console.log('ok modules search', name)
}
for (const t of ['frontend', 'themes', 'page editor', 'membership']) await search(t, `modules-${t.replace(' ', '-')}`)
await page.getByPlaceholder(/Search modules/).fill('')
await page.getByRole('button', { name: 'Show internal' }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/modules-internal.jpg`, type: 'jpeg', quality: 82 })
for (const t of ['landing', 'templates', 'website']) await search(t, `modules-int-${t}`)
await browser.close()
