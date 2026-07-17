/**
 * Media Processing E2E suite — KDL-121 Phase C (C8 gate)
 *
 * Covers:
 *   1. Edit image (grayscale) → new MediaVersion created
 *   2. Merge 2 PDFs → new Media record created
 *   3. Trim video fixture → new MediaVersion created
 *   4. Audio waveform → job completes with peaks data
 *
 * Prerequisites: full docker stack running (frontend :3001, backend :4000,
 *   Redis, MinIO, processing worker active).
 *   docker compose up -d
 * Run standalone:
 *   cd frontend && E2E_BASE_URL=http://localhost:3001 pnpm e2e e2e/media-processing.spec.ts
 */
import { test, expect, request, type APIRequestContext } from '@playwright/test'
import { ADMIN } from './helpers/credentials'

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000/api'
const RUN = Date.now().toString(36)

// ─── Fixture buffers ─────────────────────────────────────────────────────────

// 64×64 solid red PNG — large enough for libvips inside Docker
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAYElEQVR4nO3PwQkAIBDAMAX3H/lwCB9BaCZo96y/HR3wqgGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQHtAgK6AfwYG1VIAAAAAElFTkSuQmCC'
const TINY_PNG = Buffer.from(TINY_PNG_B64, 'base64')

// Minimal valid PDF-1.4 (single blank page, readable by pdf-lib)
function makePdf(title: string): Buffer {
  const objs = [
    '1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj\n',
    '2 0 obj<</Type /Pages /Kids [3 0 R] /Count 1>>endobj\n',
    `3 0 obj<</Type /Page /MediaBox [0 0 612 792] /Parent 2 0 R /Resources <<>> /Contents 4 0 R>>endobj\n`,
    '4 0 obj<</Length 0>>\nstream\nendstream\nendobj\n',
  ]
  const lines: string[] = ['%PDF-1.4\n']
  const offsets: number[] = []
  let pos = lines[0]!.length
  for (const obj of objs) {
    offsets.push(pos)
    lines.push(obj)
    pos += obj.length
  }
  const xrefPos = pos
  lines.push('xref\n', '0 5\n', '0000000000 65535 f \n')
  for (const off of offsets) lines.push(off.toString().padStart(10, '0') + ' 00000 n \n')
  lines.push(`trailer<</Size 5 /Root 1 0 R /Info<</Title (${title})>>>>\n`)
  lines.push(`startxref\n${xrefPos}\n%%EOF\n`)
  return Buffer.from(lines.join(''))
}

// Minimal 2-second 32×32 H.264 MP4 (generated via ffmpeg -f lavfi)
const TINY_MP4_B64 =
  'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAt9tZGF0AAACrQYF//+p3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NSByMzIyMiBiMzU2MDVhIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyNSAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTEgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD00MCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAAAVZYiEABb//vfTP8yy7JokteOHv7f/AAAACUGaIWxBX/7W4AAAAzJtb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAH0AABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAACXHRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAH0AAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAIAAAACAAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAAAAQAAB9AAAAAAAAEAAAAAAdRtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAAEAAAACAAFXEAAAAAAAtaGRscgAAAAAAAAAAdmlkZQAAAAAAAAAAAAAAAFZpZGVvSGFuZGxlcgAAAAF/bWluZgAAABR2bWhkAAAAAQAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAABP3N0YmwAAAC/c3RzZAAAAAAAAAABAAAAr2F2YzEAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAIAAgAEgAAABIAAAAAAAAAAEVTGF2YzYyLjI4LjEwMSBsaWJ4MjY0AAAAAAAAAAAAAAAY//8AAAA1YXZjQwFkAAr/4QAYZ2QACqzZSWwEQAAAAwBAAAADAIPEiWWAAQAGaOvjyyLA/fj4AAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAAAtcAAAAAAAAABhzdHRzAAAAAAAAAAEAAAACAABAAAAAABRzdHNzAAAAAAAAAAEAAAABAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAACAAAAAQAAABxzdHN6AAAAAAAAAAAAAAACAAACygAAAA0AAAAUc3RjbwAAAAAAAAABAAAAMAAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNjIuMTIuMTAx'
const TINY_MP4 = Buffer.from(TINY_MP4_B64, 'base64')

// Minimal 0.1s mono 8000Hz 16-bit PCM WAV (silence) — ffmpeg can extract waveform
const TINY_WAV_B64 =
  'UklGRoYGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAATElTVBoAAABJTkZPSVNGVA4AAABMYXZmNjIuMTIuMTAxAGRhdGFABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=='
const TINY_WAV = Buffer.from(TINY_WAV_B64, 'base64')

// ─── Helpers ─────────────────────────────────────────────────────────────────

let api: APIRequestContext
let adminToken: string
const uploadedIds: string[] = []

async function loginApi(email: string, password: string): Promise<string> {
  const res = await api.post(`${API_URL}/auth/login`, { data: { email, password } })
  return (await res.json()).data?.accessToken as string
}

function headers() {
  return { Authorization: `Bearer ${adminToken}` }
}

async function uploadMedia(
  buf: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const res = await api.post(`${API_URL}/media/upload`, {
    headers: headers(),
    multipart: { files: { name: filename, mimeType, buffer: buf } },
  })
  expect(res.status()).toBe(201)
  const json = await res.json()
  const id = json.data.media[0].id as string
  uploadedIds.push(id)
  return id
}

async function pollJob(
  jobId: string,
  { timeoutMs = 30_000, intervalMs = 500 } = {},
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

// ─── Suite ───────────────────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  api = await request.newContext({ timeout: 15_000 })
  adminToken = await loginApi(ADMIN.email, ADMIN.password)
})

test.afterAll(async () => {
  const h = headers()
  // Soft-delete all test media, then purge
  if (uploadedIds.length) {
    await api
      .post(`${API_URL}/media/bulk-delete`, { data: { media_ids: uploadedIds }, headers: h })
      .catch(() => {})
  }
  await api.delete(`${API_URL}/media/trash/purge`, { headers: h }).catch(() => {})
  await api.dispose()
})

test.describe('C8 — Processing Studio E2E', () => {
  // ── 1. Edit image → new version ──────────────────────────────────────────
  test('1. grayscale image edit creates a new MediaVersion', async () => {
    const mediaId = await uploadMedia(TINY_PNG, `e2e-img-${RUN}.png`, 'image/png')

    const editRes = await api.post(`${API_URL}/media/${mediaId}/edit`, {
      headers: headers(),
      data: { ops: [{ op: 'grayscale' }], note: `E2E ${RUN}` },
    })
    expect(editRes.status()).toBe(202)
    const { job_id } = (await editRes.json()).data
    expect(job_id).toBeTruthy()

    const { state, failedReason } = await pollJob(job_id)
    expect(state, `job failed: ${failedReason}`).toBe('completed')

    const versRes = await api.get(`${API_URL}/media/${mediaId}/versions`, {
      headers: headers(),
    })
    expect(versRes.status()).toBe(200)
    const { versions } = (await versRes.json()).data
    expect(versions.length).toBeGreaterThanOrEqual(1)
    expect(versions[0]).toMatchObject({ version: 1, media_id: mediaId })
    expect(versions[0].url).toBeTruthy()
  })

  // ── 2. Merge 2 PDFs → new Media record ───────────────────────────────────
  test('2. merge two PDFs creates a new media record', async () => {
    const pdf1Id = await uploadMedia(makePdf(`E2E-PDF-A-${RUN}`), `e2e-pdf-a-${RUN}.pdf`, 'application/pdf')
    const pdf2Id = await uploadMedia(makePdf(`E2E-PDF-B-${RUN}`), `e2e-pdf-b-${RUN}.pdf`, 'application/pdf')

    const mergeRes = await api.post(`${API_URL}/media/pdf-merge`, {
      headers: headers(),
      data: { op: 'merge', ids: [pdf1Id, pdf2Id], name: `merged-${RUN}.pdf` },
    })
    expect(mergeRes.status()).toBe(202)
    const { job_id } = (await mergeRes.json()).data
    expect(job_id).toBeTruthy()

    const { state, result, failedReason } = await pollJob(job_id)
    expect(state, `merge job failed: ${failedReason}`).toBe('completed')

    // Result contains the new media id
    const mergedId = (result as { media_id?: string })?.media_id
    expect(mergedId).toBeTruthy()
    uploadedIds.push(mergedId!)

    // Verify it's retrievable
    const getRes = await api.get(`${API_URL}/media/${mergedId}`, { headers: headers() })
    expect(getRes.status()).toBe(200)
    const media = (await getRes.json()).data.media
    expect(media.mime_type).toBe('application/pdf')
  })

  // ── 3. Trim video → new version ───────────────────────────────────────────
  test('3. trim video creates a new MediaVersion', async () => {
    const mediaId = await uploadMedia(TINY_MP4, `e2e-vid-${RUN}.mp4`, 'video/mp4')

    const trimRes = await api.post(`${API_URL}/media/${mediaId}/video-op`, {
      headers: headers(),
      data: { op: 'trim', start: 0, end: 1 },
    })
    expect(trimRes.status()).toBe(202)
    const { job_id } = (await trimRes.json()).data
    expect(job_id).toBeTruthy()

    const { state, failedReason } = await pollJob(job_id, { timeoutMs: 45_000 })
    expect(state, `trim job failed: ${failedReason}`).toBe('completed')

    const versRes = await api.get(`${API_URL}/media/${mediaId}/versions`, {
      headers: headers(),
    })
    expect(versRes.status()).toBe(200)
    const { versions } = (await versRes.json()).data
    expect(versions.length).toBeGreaterThanOrEqual(1)
    expect(versions[0].url).toBeTruthy()
  })

  // ── 4. Audio waveform → peaks data ────────────────────────────────────────
  test('4. audio waveform job returns peaks array', async () => {
    const mediaId = await uploadMedia(TINY_WAV, `e2e-audio-${RUN}.wav`, 'audio/wav')

    const waveRes = await api.post(`${API_URL}/media/${mediaId}/audio-op`, {
      headers: headers(),
      data: { op: 'waveform' },
    })
    expect(waveRes.status()).toBe(202)
    const { job_id } = (await waveRes.json()).data
    expect(job_id).toBeTruthy()

    const { state, result, failedReason } = await pollJob(job_id, { timeoutMs: 30_000 })
    expect(state, `waveform job failed: ${failedReason}`).toBe('completed')

    const r = result as { peaks?: number[]; waveformUrl?: string }
    expect(Array.isArray(r?.peaks)).toBe(true)
    expect((r.peaks as number[]).length).toBeGreaterThan(0)
  })
})
