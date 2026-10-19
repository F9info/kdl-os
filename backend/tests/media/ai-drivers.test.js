import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import registry, { getDriver, driversForFeature, FEATURES } from '../../src/modules/media/ai/drivers/index.js';

const FEATURE_KEYS = Object.keys(FEATURES);

describe('AI driver registry contract', () => {
  it('exports all 6 drivers', () => {
    expect(Object.keys(registry).sort()).toEqual(
      ['gemini', 'openai-embeddings', 'openai-whisper-api', 'openrouter-vision', 'replicate', 'whisper-local'],
    );
  });

  it('each driver has required exports and its feature methods', () => {
    for (const [name, d] of Object.entries(registry)) {
      expect(d.driver, `${name}.driver`).toBe(name);
      expect(Array.isArray(d.features) && d.features.length > 0, `${name}.features`).toBe(true);
      expect(d.credentialsSchema, `${name}.credentialsSchema`).toBeDefined();
      expect(d.configSchema, `${name}.configSchema`).toBeDefined();
      for (const feature of d.features) {
        expect(FEATURE_KEYS, `${name} feature ${feature} known`).toContain(feature);
        expect(typeof d[FEATURES[feature]], `${name}.${FEATURES[feature]}`).toBe('function');
      }
    }
  });

  it('credential schemas reject empty objects', () => {
    for (const [name, d] of Object.entries(registry)) {
      expect(d.credentialsSchema.safeParse({}).success, `${name} empty creds`).toBe(false);
    }
  });

  it('config schemas accept empty objects (all-optional with defaults)', () => {
    for (const [name, d] of Object.entries(registry)) {
      expect(d.configSchema.safeParse({}).success, `${name} empty config`).toBe(true);
    }
  });

  it('getDriver returns driver / throws for unknown', () => {
    expect(getDriver('replicate').driver).toBe('replicate');
    expect(() => getDriver('nope')).toThrow('Unknown AI provider driver');
    expect(() => getDriver('')).toThrow('Unknown AI provider driver');
  });

  it('driversForFeature maps every feature to at least one driver', () => {
    expect(driversForFeature('vision').map((d) => d.driver).sort()).toEqual(['gemini', 'openrouter-vision']);
    expect(driversForFeature('image_ops').map((d) => d.driver)).toEqual(['replicate']);
    expect(driversForFeature('speech_to_text').map((d) => d.driver).sort())
      .toEqual(['openai-whisper-api', 'whisper-local']);
    expect(driversForFeature('embeddings').map((d) => d.driver).sort()).toEqual(['gemini', 'openai-embeddings']);
  });
});

describe('driver HTTP calls (fetch mocked)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('openrouter-vision.analyzeImage posts data-uri image and returns text', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ model: 'test-model', choices: [{ message: { content: 'a red bicycle' } }] }),
    });
    const d = getDriver('openrouter-vision');
    const out = await d.analyzeImage({
      credentials: { api_key: 'k' },
      config: {},
      image: Buffer.from('img'),
      mimeType: 'image/png',
      prompt: 'describe',
    });
    expect(out.text).toBe('a red bicycle');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer k');
    const body = JSON.parse(init.body);
    expect(body.messages[0].content[1].image_url.url).toMatch(/^data:image\/png;base64,/);
  });

  it('openrouter-vision throws on non-ok response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'unauthorized' });
    const d = getDriver('openrouter-vision');
    await expect(d.analyzeImage({
      credentials: { api_key: 'bad' }, image: Buffer.from('x'), mimeType: 'image/png', prompt: 'p',
    })).rejects.toThrow('openrouter-vision request failed (401)');
  });

  it('replicate.runImageOp creates a prediction and polls to success', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'p1', status: 'processing' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'p1', status: 'succeeded', output: ['https://out/img.png'] }) });
    const d = getDriver('replicate');
    const out = await d.runImageOp({
      credentials: { api_token: 't' },
      config: { poll_interval_ms: 100 },
      op: 'upscale',
      input: { image: 'https://in/img.png', scale: 2 },
    });
    expect(out).toEqual({ outputUrl: 'https://out/img.png', predictionId: 'p1' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.replicate.com/v1/models/nightmareai/real-esrgan/predictions');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.replicate.com/v1/predictions/p1');
  });

  it('replicate rejects unsupported op and failed prediction', async () => {
    const d = getDriver('replicate');
    await expect(d.runImageOp({ credentials: { api_token: 't' }, op: 'face-swap', input: {} }))
      .rejects.toThrow('unsupported image op');
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'p2', status: 'failed', error: 'NSFW' }) });
    await expect(d.runImageOp({ credentials: { api_token: 't' }, op: 'enhance', input: {} }))
      .rejects.toThrow('replicate prediction failed: NSFW');
  });

  it('whisper drivers post multipart and return transcript shape', async () => {
    const verbose = { text: 'hello world', segments: [{ id: 0, start: 0, end: 1, text: 'hello world' }], language: 'en' };
    for (const [name, credentials] of [
      ['whisper-local', { endpoint_url: 'http://whisper:8000' }],
      ['openai-whisper-api', { api_key: 'sk-x' }],
    ]) {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => verbose });
      const d = getDriver(name);
      const out = await d.transcribe({ credentials, audio: Buffer.from('wav'), filename: 'a.wav' });
      expect(out.text, name).toBe('hello world');
      expect(out.segments, name).toHaveLength(1);
      expect(out.language, name).toBe('en');
      const [url, init] = fetchMock.mock.calls.at(-1);
      expect(url, name).toContain('/audio/transcriptions');
      expect(init.body, name).toBeInstanceOf(FormData);
    }
  });

  it('gemini.analyzeImage sends inline_data and returns text', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'a blue car' }] } }],
      }),
    });
    const d = getDriver('gemini');
    const out = await d.analyzeImage({
      credentials: { api_key: 'gk' },
      config: {},
      image: Buffer.from('imgdata'),
      mimeType: 'image/jpeg',
      prompt: 'what is this?',
    });
    expect(out.text).toBe('a blue car');
    expect(out.model).toBe('gemini-2.5-flash');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('gemini-2.5-flash:generateContent');
    // Gemini uses key= query param, not Authorization header
    expect(init.headers['Authorization']).toBeUndefined();
    const body = JSON.parse(init.body);
    expect(body.contents[0].parts[1].inline_data.mime_type).toBe('image/jpeg');
    expect(body.contents[0].parts[1].inline_data.data).toBe(Buffer.from('imgdata').toString('base64'));
  });

  it('gemini.analyzeImage throws on non-2xx response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, text: async () => 'forbidden' });
    const d = getDriver('gemini');
    await expect(d.analyzeImage({
      credentials: { api_key: 'bad' }, image: Buffer.from('x'), mimeType: 'image/png', prompt: 'p',
    })).rejects.toThrow('gemini request failed (403)');
  });

  it('gemini.embed sends batchEmbedContents and returns vectors', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        embeddings: [{ values: [0.1, 0.2, 0.3] }, { values: [0.4, 0.5, 0.6] }],
      }),
    });
    const d = getDriver('gemini');
    const out = await d.embed({
      credentials: { api_key: 'gk' },
      config: {},
      texts: ['hello', 'world'],
    });
    expect(out).toEqual([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('text-embedding-004:batchEmbedContents');
    const body = JSON.parse(init.body);
    expect(body.requests).toHaveLength(2);
    expect(body.requests[0].content.parts[0].text).toBe('hello');
    expect(body.requests[1].content.parts[0].text).toBe('world');
  });

  it('gemini.embed throws on non-2xx response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'quota exceeded' });
    const d = getDriver('gemini');
    await expect(d.embed({
      credentials: { api_key: 'bad' }, texts: ['test'],
    })).rejects.toThrow('gemini request failed (429)');
  });
});
