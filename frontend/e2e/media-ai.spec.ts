/**
 * Media AI Layer E2E suite — KDL-122 Phase D (D9 consolidated gate)
 *
 * Covers the acceptance checklist from `.agents/MEDIA_DAM_ARCH.md` Phase D9:
 *   1. Analyze image → tags appear (accept suggestion)
 *   2. Natural-language search finds the fixture (semantic mode)
 *   3. Transcribe audio → transcript stored, keyword search finds it
 *   4. AI image op (bg-removal, mocked Replicate driver) → new MediaVersion
 *   5. Cloud import: list + import a file from an S3-compatible bucket (MinIO)
 *   6. Clipboard/webcam-style upload: arbitrary blob lands as a normal media record
 *      (the browser-side MediaRecorder wiring itself is covered by the
 *      CaptureWidgets RTL suite — this proves the upload path server-side)
 *
 * No real AI provider credentials exist in this environment, so vision/whisper/
 * replicate/embeddings are pointed at a local stub server (helpers/ai-stub-server.ts)
 * reachable from the backend container via host.docker.internal. This mirrors
 * how the vitest unit suites mock the same drivers' fetch calls, but proves the
 * real HTTP plumbing (routes → queue → driver → provider → storage) end to end.
 *
 * Prerequisites: an isolated stack with the Phase D8 code, e.g.:
 *   docker compose -p kdl122e2e -f docker-compose.e2e.yml up -d
 *   docker exec <backend-container> node prisma/seed.js
 * Run standalone:
 *   cd frontend && E2E_BASE_URL=http://localhost:13001 E2E_API_URL=http://localhost:14000/api pnpm e2e e2e/media-ai.spec.ts
 */
import { test, expect, request, type APIRequestContext } from '@playwright/test'
import { startAiStub, type AiStub } from './helpers/ai-stub-server'
import { ADMIN } from './helpers/credentials'

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:14000/api'
const RUN = Date.now().toString(36)

// 1×1 red PNG
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg=='
const TINY_PNG = Buffer.from(TINY_PNG_B64, 'base64')

// Minimal 0.1s mono 8000Hz 16-bit PCM WAV (silence)
const TINY_WAV_B64 =
  'UklGRoYGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAATElTVBoAAABJTkZPSVNGVA4AAABMYXZmNjIuMTIuMTAxAGRhdGFABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const TINY_WAV = Buffer.from(TINY_WAV_B64, 'base64')

let api: APIRequestContext
let adminToken: string
let stub: AiStub
const uploadedIds: string[] = []
const providerIds: string[] = []
const connectionIds: string[] = []

async function loginApi(email: string, password: string): Promise<string> {
  const res = await api.post(`${API_URL}/auth/login`, { data: { email, password } })
  return (await res.json()).data?.accessToken as string
}

function headers() {
  return { Authorization: `Bearer ${adminToken}` }
}

async function uploadMedia(buf: Buffer, filename: string, mimeType: string) {
  const res = await api.post(`${API_URL}/media/upload`, {
    headers: headers(),
    multipart: { files: { name: filename, mimeType, buffer: buf } },
  })
  expect(res.status()).toBe(201)
  const media = (await res.json()).data.media[0]
  uploadedIds.push(media.id)
  return media as { id: string; path: string }
}

async function pollJob(
  jobId: string,
  { timeoutMs = 30_000, intervalMs = 500 } = {}
): Promise<{ state: string; result: unknown; failedReason?: string }> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await api.get(`${API_URL}/media/jobs/${jobId}`, { headers: headers() })
    expect(res.status()).toBe(200)
    const { state, result, failedReason } = (await res.json()).data
    if (state === 'completed' || state === 'failed') return { state, result, failedReason }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`Job ${jobId} did not complete within ${timeoutMs}ms`)
}

// Retries an assertion until it stops throwing — for effects that land via an
// async reindex/embed queue job with no job id returned to poll directly.
async function retryUntil<T>(
  fn: () => Promise<T>,
  { timeoutMs = 15_000, intervalMs = 500 } = {}
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  let lastErr: unknown
  while (Date.now() < deadline) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      await new Promise((r) => setTimeout(r, intervalMs))
    }
  }
  throw lastErr
}

async function createAiProvider(
  feature: string,
  driver: string,
  credentials: Record<string, unknown>,
  config: Record<string, unknown> = {}
) {
  const res = await api.post(`${API_URL}/media/ai/providers`, {
    headers: headers(),
    data: { feature, driver, name: `e2e-${feature}-${RUN}`, credentials, config, is_active: true },
  })
  expect(res.status(), await res.text()).toBe(201)
  const item = (await res.json()).data.item
  providerIds.push(item.id)
  return item
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  stub = await startAiStub()
  api = await request.newContext({ timeout: 20_000 })
  adminToken = await loginApi(ADMIN.email, ADMIN.password)

  await createAiProvider(
    'vision',
    'openrouter-vision',
    { api_key: 'stub-key' },
    { base_url: stub.baseUrl }
  )
  await createAiProvider('speech_to_text', 'whisper-local', { endpoint_url: stub.baseUrl })
  await createAiProvider(
    'image_ops',
    'replicate',
    { api_token: 'stub-token' },
    { base_url: stub.baseUrl, poll_interval_ms: 100 }
  )
  await createAiProvider(
    'embeddings',
    'openai-embeddings',
    { api_key: 'stub-key' },
    { base_url: stub.baseUrl }
  )

  // A brand-new MeiliSearch instance has no filterable-attributes configured
  // until the index is created/settings applied at least once — normally a
  // one-time deploy step (baked into the long-running dev stack already).
  const reindexRes = await api.post(`${API_URL}/media/search/reindex`, { headers: headers() })
  expect(reindexRes.status()).toBe(200)
})

test.afterAll(async () => {
  const h = headers()
  for (const id of uploadedIds) {
    await api.delete(`${API_URL}/media/${id}`, { headers: h }).catch(() => {})
  }
  await api.delete(`${API_URL}/media/trash/purge`, { headers: h }).catch(() => {})
  for (const id of connectionIds) {
    await api.delete(`${API_URL}/media/import/connections/${id}`, { headers: h }).catch(() => {})
  }
  for (const id of providerIds) {
    await api.delete(`${API_URL}/media/ai/providers/${id}`, { headers: h }).catch(() => {})
  }
  await stub.close()
  await api.dispose()
})

test.describe('Phase D9 — AI layer E2E', () => {
  let imageId: string
  let imagePath: string

  test('1. analyze image → tags appear (accept suggestion)', async () => {
    const media = await uploadMedia(TINY_PNG, `e2e-analyze-${RUN}.png`, 'image/png')
    imageId = media.id
    imagePath = media.path

    const analyzeRes = await api.post(`${API_URL}/media/${imageId}/analyze`, { headers: headers() })
    expect(analyzeRes.status()).toBe(202)
    const { job_id } = (await analyzeRes.json()).data
    const { state, failedReason } = await pollJob(job_id)
    expect(state, failedReason).toBe('completed')

    const suggestionsRes = await api.get(`${API_URL}/media/${imageId}/suggestions`, {
      headers: headers(),
    })
    const suggestions = (await suggestionsRes.json()).data.items as { id: string; type: string }[]
    const tagsSuggestion = suggestions.find((s) => s.type === 'TAGS')
    expect(tagsSuggestion).toBeTruthy()

    const acceptRes = await api.post(`${API_URL}/media/suggestions/${tagsSuggestion!.id}/accept`, {
      headers: headers(),
    })
    expect(acceptRes.status()).toBe(200)

    const mediaRes = await api.get(`${API_URL}/media/${imageId}`, { headers: headers() })
    const tags = (await mediaRes.json()).data.media.tags as string[]
    expect(tags).toContain('e2e-stub-tag')
  })

  test('2. natural-language search finds the analyzed fixture (semantic mode)', async () => {
    expect(imageId).toBeTruthy()
    await retryUntil(async () => {
      const res = await api.get(`${API_URL}/media/search`, {
        headers: headers(),
        params: { mode: 'semantic', q: 'a small red square image' },
      })
      expect(res.status()).toBe(200)
      const media = (await res.json()).data.media as { id: string }[]
      expect(media.some((m) => m.id === imageId)).toBe(true)
    })
  })

  test('3. transcribe audio → transcript stored, keyword search finds it', async () => {
    const media = await uploadMedia(TINY_WAV, `e2e-transcribe-${RUN}.wav`, 'audio/wav')

    const transcribeRes = await api.post(`${API_URL}/media/${media.id}/transcribe`, {
      headers: headers(),
    })
    expect(transcribeRes.status()).toBe(202)
    const { job_id } = (await transcribeRes.json()).data
    const { state, failedReason } = await pollJob(job_id)
    expect(state, failedReason).toBe('completed')

    const transcriptRes = await api.get(`${API_URL}/media/${media.id}/transcript`, {
      headers: headers(),
    })
    expect(transcriptRes.status()).toBe(200)
    const transcript = (await transcriptRes.json()).data
    expect(transcript.text).toContain('e2e stub transcript sentence')

    await retryUntil(async () => {
      const res = await api.get(`${API_URL}/media/search`, {
        headers: headers(),
        params: { q: 'stub transcript' },
      })
      expect(res.status()).toBe(200)
      const hits = (await res.json()).data.hits as { id: string }[]
      expect(hits.some((h) => h.id === media.id)).toBe(true)
    })
  })

  test('4. AI image op (mocked replicate driver) → new media version', async () => {
    expect(imageId).toBeTruthy()
    const beforeRes = await api.get(`${API_URL}/media/${imageId}/versions`, { headers: headers() })
    const beforeCount = ((await beforeRes.json()).data.versions as unknown[]).length

    const opRes = await api.post(`${API_URL}/media/${imageId}/ai-image-op`, {
      headers: headers(),
      data: { op: 'bg-removal' },
    })
    expect(opRes.status()).toBe(202)
    const { job_id } = (await opRes.json()).data
    const { state, failedReason } = await pollJob(job_id)
    expect(state, failedReason).toBe('completed')

    const afterRes = await api.get(`${API_URL}/media/${imageId}/versions`, { headers: headers() })
    const versions = (await afterRes.json()).data.versions as { note: string }[]
    expect(versions.length).toBe(beforeCount + 1)
    expect(versions[0]?.note).toContain('bg-removal')
  })

  test('5. cloud import: list + import a file from an S3-compatible bucket (MinIO)', async () => {
    expect(imagePath).toBeTruthy()
    const folderPrefix = imagePath.slice(0, imagePath.lastIndexOf('/') + 1)

    const connRes = await api.post(`${API_URL}/media/import/connections`, {
      headers: headers(),
      data: {
        provider: 's3',
        label: `e2e-s3-${RUN}`,
        credentials: {
          access_key_id: 'minioadmin',
          secret_access_key: 'minioadmin',
          bucket: 'kdl-media',
          region: 'us-east-1',
          endpoint: 'http://minio:9000',
        },
      },
    })
    expect(connRes.status(), await connRes.text()).toBe(201)
    const connection = (await connRes.json()).data.item
    connectionIds.push(connection.id)

    const listRes = await api.get(`${API_URL}/media/import/connections/${connection.id}/files`, {
      headers: headers(),
      params: { folder_id: folderPrefix },
    })
    expect(listRes.status(), await listRes.text()).toBe(200)
    const items = (await listRes.json()).data.items as { id: string; isFolder: boolean }[]
    const fixtureFile = items.find((i) => !i.isFolder && i.id === imagePath)
    expect(fixtureFile).toBeTruthy()

    const importRes = await api.post(
      `${API_URL}/media/import/connections/${connection.id}/import`,
      {
        headers: headers(),
        data: { file_ids: [imagePath] },
      }
    )
    expect(importRes.status(), await importRes.text()).toBe(200)
    const result = (await importRes.json()).data as {
      imported: { id: string }[]
      skipped: unknown[]
    }
    expect(result.skipped).toEqual([])
    expect(result.imported.length).toBe(1)
    uploadedIds.push(result.imported[0]!.id)
  })

  test('6. clipboard/webcam-style upload: arbitrary blob lands as a normal media record', async () => {
    // The frontend CaptureWidgets (webcam/screen/voice) and useClipboardPaste hook
    // both resolve to a plain File/Blob handed to the exact same upload mutation —
    // this proves that path server-side; browser-level MediaRecorder wiring is the
    // CaptureWidgets RTL suite's job (D8 gate).
    const blob = Buffer.from('fake-webm-bytes-from-mediarecorder')
    const media = await uploadMedia(blob, `webcam-${RUN}.webm`, 'video/webm')
    expect(media.id).toBeTruthy()

    const getRes = await api.get(`${API_URL}/media/${media.id}`, { headers: headers() })
    expect(getRes.status()).toBe(200)
    expect((await getRes.json()).data.media.type).toBe('VIDEO')
  })
})
