/**
 * Media Share + Capture regression — KDL-148 (re-verification pass)
 *
 * The first KDL-148 fix (7f83729 / 3199c61) covered upload/link resolution and
 * the wired-in ImageEditorDialog crop UI. Re-verifying against the live stack
 * with a real browser turned up two more real, previously-unfixed bugs in the
 * same module, both covered here:
 *
 *   1. The "Share / copy link" feature (ShareDialog.tsx) was fully built —
 *      backend routes, `resolveShare()`, QR/embed — but never rendered
 *      anywhere in the UI, and the frontend had no page for the link it
 *      would have generated (`<origin>/share/:token`), so a copied link
 *      404'd for anyone who opened it. Fixed by wiring a "Share / copy link"
 *      button into the DetailDrawer and adding `app/share/[token]/page.tsx`.
 *
 *   2. Screen recording still got stuck on "Recording…" when stopped via the
 *      browser's native "Stop sharing" bar — the `ended` fix from 7f83729 was
 *      only applied to `capture/ScreenCapture.tsx` (used by the "Capture"
 *      button's dialog), not the separate, also-reachable toolbar
 *      `ScreenCaptureButton` in `CaptureWidgets.tsx`, which has its own
 *      duplicate getDisplayMedia implementation.
 *
 * Run standalone:
 *   cd frontend && E2E_BASE_URL=http://localhost:3000 pnpm e2e e2e/media-share-and-capture.spec.ts
 */
import { test, expect, request, type APIRequestContext } from '@playwright/test'

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000/api'
const ADMIN = { email: 'admin@kdl.com', password: 'Admin@123' }
const RUN = `${Date.now().toString(36)}`

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg=='
const TINY_PNG_BUF = Buffer.from(TINY_PNG_B64, 'base64')

let api: APIRequestContext
let adminToken: string

async function loginApi(email: string, password: string) {
  const res = await api.post(`${API_URL}/auth/login`, { data: { email, password } })
  const json = await res.json()
  return json.data?.accessToken as string
}

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByPlaceholder('admin@kdl.com').fill(ADMIN.email)
  await page.getByPlaceholder('••••••••').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard/)
}

test.beforeAll(async () => {
  api = await request.newContext()
  adminToken = await loginApi(ADMIN.email, ADMIN.password)
})

test.afterAll(async () => {
  await api.dispose()
})

test.describe('Media Share + Capture (KDL-148 re-verification)', () => {
  test('Share / copy link: button is wired up and the copied link resolves anonymously', async ({ page, browser }) => {
    let mediaId: string | undefined
    try {
      await login(page)
      await page.goto('/admin/media')
      await expect(page.getByText('All files')).toBeVisible({ timeout: 10_000 })

      const fileName = `e2e-share-${RUN}.png`
      const uploadResponse = page.waitForResponse(
        (res) => res.url().includes('/media/upload') && res.request().method() === 'POST',
      )
      await page.locator('input[type="file"]').first().setInputFiles({
        name: fileName,
        mimeType: 'image/png',
        buffer: TINY_PNG_BUF,
      })
      const uploadRes = await uploadResponse
      const uploadJson = await uploadRes.json()
      mediaId = uploadJson?.data?.media?.[0]?.id

      const gridImg = page.locator(`img[alt="${fileName}"]`).first()
      await expect(gridImg).toBeVisible({ timeout: 10_000 })
      const gridItem = gridImg.locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]')
      await gridItem.hover()
      await gridItem.getByRole('button').first().click()

      // The Share button + dialog must actually be reachable from the drawer.
      const shareButton = page.getByRole('button', { name: 'Share / copy link' })
      await expect(shareButton).toBeVisible({ timeout: 10_000 })
      await shareButton.click()
      await expect(page.getByRole('heading', { name: /^Share/ })).toBeVisible()

      await page.getByRole('button', { name: 'New share link' }).click()
      const createResponse = page.waitForResponse(
        (res) => res.url().includes('/shares') && res.request().method() === 'POST',
      )
      await page.getByRole('button', { name: 'Create link' }).click()
      const createRes = await createResponse
      expect(createRes.status()).toBe(201)
      const createJson = await createRes.json()
      // createShareLink responds via successResponse(res, share, 201) — the
      // share record is `data` itself (flat), not `data.share`.
      const token = createJson?.data?.token as string
      expect(token).toBeTruthy()

      // Visit the copied link as a totally separate, unauthenticated browser
      // context — this is the actual external-recipient scenario the feature
      // exists for. Before the fix this 404'd (no frontend route existed).
      const anonContext = await browser.newContext()
      const anonPage = await anonContext.newPage()
      const resp = await anonPage.goto(`/share/${token}`, { waitUntil: 'networkidle' })
      expect(resp?.status()).toBe(200)

      const sharedImg = anonPage.locator('img').first()
      await expect(sharedImg).toBeVisible({ timeout: 10_000 })
      await expect(async () => {
        const ok = await sharedImg.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
        expect(ok).toBe(true)
      }).toPass({ timeout: 10_000 })

      await anonContext.close()
    } finally {
      if (mediaId) {
        await api.delete(`${API_URL}/media/${mediaId}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        }).catch(() => {})
      }
    }
  })

  test('Screen recording (toolbar button) recovers when the browser ends the track natively', async ({ page }) => {
    // Grant camera/mic permissions defensively; the fake-device Chromium flags
    // (set in playwright.config.ts launchOptions below) make getDisplayMedia
    // resolve without a real picker.
    await login(page)
    await page.goto('/admin/media')
    await expect(page.getByText('All files')).toBeVisible({ timeout: 10_000 })

    await page.getByTitle('Record screen').click()
    await page.getByRole('button', { name: /^start$/i }).click()
    await expect(page.getByRole('button', { name: /^stop$/i })).toBeVisible({ timeout: 10_000 })

    // Simulate the browser's own "Stop sharing" bar ending the track, instead
    // of clicking our Stop button — this is exactly the KDL-148 regression:
    // without an `ended` listener, the widget is stuck showing "Stop" forever.
    await page.evaluate(() => {
      document.querySelectorAll('video').forEach((v) => {
        const stream = v.srcObject as MediaStream | null
        stream?.getTracks().forEach((t) => t.dispatchEvent(new Event('ended')))
      })
    })

    // Recorder.onstop should fire, transitioning the widget out of the
    // recording state into the "preview" / "Use recording" state.
    await expect(page.getByRole('button', { name: /use recording/i })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: /^stop$/i })).toHaveCount(0)
  })
})
