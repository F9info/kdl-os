// Local stand-in for the external AI provider APIs (OpenRouter vision,
// OpenAI-compatible whisper, Replicate, OpenAI-compatible embeddings) used by
// the D9 E2E gate — no real API keys are available in this environment, and
// the backend runs in a container, so the stub must be reachable from inside
// Docker via `host.docker.internal`.
import http from 'node:http'
import type { AddressInfo } from 'node:net'

// 1×1 red PNG — returned as the "output" of a mocked Replicate bg-removal run.
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg=='
const TINY_PNG = Buffer.from(TINY_PNG_B64, 'base64')

export interface AiStub {
  port: number
  baseUrl: string // host.docker.internal — for provider config reachable from the backend container
  hostBaseUrl: string // localhost — for asserting from the test process itself
  close: () => Promise<void>
}

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export async function startAiStub(): Promise<AiStub> {
  let resolvedPort = 0
  const server = http.createServer(async (req, res) => {
    const url = req.url ?? ''

    // openrouter-vision: POST /chat/completions
    if (url === '/chat/completions' && req.method === 'POST') {
      const analysis = {
        tags: ['e2e-stub-tag', 'red-square'],
        title: 'E2E stub title',
        description: 'A tiny red square used for the D9 E2E gate.',
        alt_text: 'red square',
        seo_keywords: ['e2e', 'stub'],
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        model: 'stub-vision',
        choices: [{ message: { content: JSON.stringify(analysis) } }],
      }))
      return
    }

    // whisper-local / openai-whisper-api: POST /v1/audio/transcriptions
    if (url === '/v1/audio/transcriptions' && req.method === 'POST') {
      await readBody(req)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        text: 'e2e stub transcript sentence',
        segments: [{ id: 0, start: 0, end: 1.2, text: 'e2e stub transcript sentence' }],
        language: 'en',
      }))
      return
    }

    // replicate: POST /models/:owner/:model/predictions — return "succeeded" immediately
    // so the driver's polling loop never runs (status is checked once, right after create).
    if (/^\/models\/.+\/predictions$/.test(url) && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        id: 'e2e-stub-prediction',
        status: 'succeeded',
        output: [`http://host.docker.internal:${resolvedPort}/output.png`],
      }))
      return
    }

    // openai-embeddings: POST /embeddings — same fixed vector for every input,
    // which trivially makes every embedded doc the semantic-search "closest match".
    if (url === '/embeddings' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
      const inputs: string[] = Array.isArray(body.input) ? body.input : [body.input]
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        data: inputs.map((_, index) => ({ index, embedding: [0.1, 0.2, 0.3] })),
      }))
      return
    }

    if (url === '/output.png' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'image/png' })
      res.end(TINY_PNG)
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: `ai-stub: no handler for ${req.method} ${url}` }))
  })

  await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve))
  resolvedPort = (server.address() as AddressInfo).port

  return {
    port: resolvedPort,
    baseUrl: `http://host.docker.internal:${resolvedPort}`,
    hostBaseUrl: `http://localhost:${resolvedPort}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}
