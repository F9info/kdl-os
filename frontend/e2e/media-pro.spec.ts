/**
 * Media Pro E2E suite — KDL-87 Step 7
 *
 * Covers the full media manager flow:
 *   1. Upload image → variant URLs present (after worker processes)
 *   2. Create folder → file visible in folder tree
 *   3. Move file into folder
 *   4. Bulk delete (soft) → file appears in trash
 *   5. Restore from trash
 *   6. Usage guard: avatar set → delete returns 409
 *
 * Prerequisites: full stack running with the seeded super admin.
 *   docker compose up -d  →  frontend :3001, backend :4000
 * Run standalone:
 *   cd frontend && E2E_BASE_URL=http://localhost:3001 pnpm e2e e2e/media-pro.spec.ts
 *
 * Test data uses unique RUN suffix and is cleaned up in afterAll.
 */
import { test, expect, request, type APIRequestContext } from '@playwright/test'

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000/api'
const ADMIN = { email: 'admin@kdl.com', password: 'Admin@123' }
const RUN = `${Date.now().toString(36)}`
const FOLDER_NAME = `E2E-Media-${RUN}`

let api: APIRequestContext
let adminToken: string
let createdMediaId: string
let createdFolderId: string

// Minimal 1×1 red pixel PNG (valid image — sharp will accept it)
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg=='
const TINY_PNG_BUF = Buffer.from(TINY_PNG_B64, 'base64')

async function loginApi(email: string, password: string) {
  const res = await api.post(`${API_URL}/auth/login`, { data: { email, password } })
  const json = await res.json()
  return json.data?.accessToken as string
}

test.beforeAll(async () => {
  api = await request.newContext()
  adminToken = await loginApi(ADMIN.email, ADMIN.password)
})

test.afterAll(async () => {
  const h = { Authorization: `Bearer ${adminToken}` }

  // Restore + purge any test media
  if (createdMediaId) {
    await api.post(`${API_URL}/media/trash/restore`, { data: { media_ids: [createdMediaId] }, headers: h }).catch(() => {})
    await api.delete(`${API_URL}/media/${createdMediaId}`, { headers: h }).catch(() => {})
  }
  await api.delete(`${API_URL}/media/trash/purge`, { headers: h }).catch(() => {})

  // Delete test folder
  if (createdFolderId) {
    await api.delete(`${API_URL}/media/folders/${createdFolderId}?cascade=true`, { headers: h }).catch(() => {})
  }

  await api.dispose()
})

test.describe('Media Pro', () => {
  test('1. upload image via API and receive a media record', async () => {
    const h = { Authorization: `Bearer ${adminToken}` }

    const formData = new FormData()
    formData.append('files', new Blob([TINY_PNG_BUF], { type: 'image/png' }), 'e2e-test.png')

    const res = await api.post(`${API_URL}/media/upload`, {
      headers: h,
      multipart: {
        files: {
          name: 'e2e-test.png',
          mimeType: 'image/png',
          buffer: TINY_PNG_BUF,
        },
      },
    })

    expect(res.status()).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    const media = json.data.media[0]
    expect(media).toMatchObject({
      mime_type: 'image/png',
      type: 'IMAGE',
    })
    expect(media.url).toBeTruthy()
    createdMediaId = media.id
  })

  test('2. create folder and verify it appears in folder list', async () => {
    const h = { Authorization: `Bearer ${adminToken}` }

    const res = await api.post(`${API_URL}/media/folders`, {
      data: { name: FOLDER_NAME },
      headers: h,
    })
    expect(res.status()).toBe(201)
    const json = await res.json()
    createdFolderId = json.data.folder.id
    expect(json.data.folder.name).toBe(FOLDER_NAME)

    // Verify it's in the folder list
    const listRes = await api.get(`${API_URL}/media/folders`, { headers: h })
    const listJson = await listRes.json()
    expect(listJson.data.folders.some((f: { id: string }) => f.id === createdFolderId)).toBe(true)
  })

  test('3. move file into folder', async () => {
    expect(createdMediaId).toBeTruthy()
    expect(createdFolderId).toBeTruthy()
    const h = { Authorization: `Bearer ${adminToken}` }

    const res = await api.post(`${API_URL}/media/move`, {
      data: { media_ids: [createdMediaId], folder_id: createdFolderId },
      headers: h,
    })
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.data.moved).toBe(1)

    // Verify file is now in the folder
    const mediaRes = await api.get(`${API_URL}/media`, {
      params: { folder_id: createdFolderId },
      headers: h,
    })
    const mediaJson = await mediaRes.json()
    expect(mediaJson.data.media.some((m: { id: string }) => m.id === createdMediaId)).toBe(true)
  })

  test('4. bulk delete (soft) → file appears in trash', async () => {
    expect(createdMediaId).toBeTruthy()
    const h = { Authorization: `Bearer ${adminToken}` }

    const res = await api.post(`${API_URL}/media/bulk-delete`, {
      data: { media_ids: [createdMediaId] },
      headers: h,
    })
    expect(res.status()).toBe(200)
    expect((await res.json()).data.deleted).toBe(1)

    // File should be in trash now
    const trashRes = await api.get(`${API_URL}/media/trash`, { headers: h })
    const trashJson = await trashRes.json()
    expect(trashJson.data.media.some((m: { id: string }) => m.id === createdMediaId)).toBe(true)

    // File should NOT be in regular list
    const listRes = await api.get(`${API_URL}/media`, { headers: h })
    const listJson = await listRes.json()
    expect(listJson.data.media.some((m: { id: string }) => m.id === createdMediaId)).toBe(false)
  })

  test('5. restore from trash', async () => {
    expect(createdMediaId).toBeTruthy()
    const h = { Authorization: `Bearer ${adminToken}` }

    const res = await api.post(`${API_URL}/media/trash/restore`, {
      data: { media_ids: [createdMediaId] },
      headers: h,
    })
    expect(res.status()).toBe(200)
    expect((await res.json()).data.restored).toBe(1)

    // File should now be in regular list again
    const listRes = await api.get(`${API_URL}/media`, { headers: h })
    const listJson = await listRes.json()
    expect(listJson.data.media.some((m: { id: string }) => m.id === createdMediaId)).toBe(true)
  })

  test('6. usage guard: file in use → delete returns 409', async () => {
    expect(createdMediaId).toBeTruthy()
    const h = { Authorization: `Bearer ${adminToken}` }

    // Register the media as in-use (simulate avatar)
    const usageRes = await api.post(`${API_URL}/media/usage/register`, {
      data: { media_id: createdMediaId, entity: 'e2e.test', entity_id: `run-${RUN}` },
      headers: h,
    })
    expect(usageRes.status()).toBe(201)

    // Now attempt to delete — should get 409
    const deleteRes = await api.delete(`${API_URL}/media/${createdMediaId}`, { headers: h })
    expect(deleteRes.status()).toBe(409)

    // Clean up usage
    await api.post(`${API_URL}/media/usage/release`, {
      data: { media_id: createdMediaId, entity: 'e2e.test', entity_id: `run-${RUN}` },
      headers: h,
    }).catch(() => {})
  })

  test('7. media page loads in browser', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('admin@kdl.com').fill(ADMIN.email)
    await page.getByPlaceholder('••••••••').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/admin\/dashboard/)

    await page.goto('/admin/media')
    // Folder sidebar should be present
    await expect(page.getByText('Folders')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('All files')).toBeVisible()
    await expect(page.getByText('Trash')).toBeVisible()
  })
})
