import { z } from 'zod';

const credentialsSchema = z.object({
  api_token: z.string().min(1),
});

// Default model per op — overridable via config.models.<op>
const DEFAULT_MODELS = {
  'bg-removal': '851-labs/background-remover',
  upscale: 'nightmareai/real-esrgan',
  enhance: 'tencentarc/gfpgan',
  'object-removal': 'allenhooo/lama',
};

const configSchema = z.object({
  base_url: z.string().url().optional().default('https://api.replicate.com/v1'),
  models: z.record(z.string()).optional().default({}),
  poll_interval_ms: z.coerce.number().int().min(100).optional().default(2000),
  timeout_ms: z.coerce.number().int().min(1000).optional().default(300_000),
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default {
  driver: 'replicate',
  features: ['image_ops'],
  credentialsSchema,
  configSchema,
  ops: Object.keys(DEFAULT_MODELS),

  /**
   * Run an AI image op on Replicate: create a prediction, poll until it settles.
   * `input` is the replicate model input object (image url + op params).
   * Returns { outputUrl } — first output artifact URL.
   */
  async runImageOp({ credentials, config = {}, op, input }) {
    const cfg = configSchema.parse(config);
    const model = cfg.models[op] ?? DEFAULT_MODELS[op];
    if (!model) throw new Error(`replicate: unsupported image op "${op}"`);

    const headers = {
      Authorization: `Bearer ${credentials.api_token}`,
      'Content-Type': 'application/json',
    };
    const createRes = await fetch(`${cfg.base_url}/models/${model}/predictions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ input }),
    });
    if (!createRes.ok) {
      const body = await createRes.text().catch(() => '');
      throw new Error(`replicate create failed (${createRes.status}): ${body.slice(0, 300)}`);
    }
    let prediction = await createRes.json();

    const deadline = Date.now() + cfg.timeout_ms;
    while (prediction.status === 'starting' || prediction.status === 'processing') {
      if (Date.now() > deadline) throw new Error(`replicate prediction timed out (op ${op})`);
      await sleep(cfg.poll_interval_ms);
      const pollRes = await fetch(`${cfg.base_url}/predictions/${prediction.id}`, { headers });
      if (!pollRes.ok) throw new Error(`replicate poll failed (${pollRes.status})`);
      prediction = await pollRes.json();
    }

    if (prediction.status !== 'succeeded') {
      throw new Error(`replicate prediction ${prediction.status}: ${prediction.error ?? 'unknown error'}`);
    }
    const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    if (!outputUrl) throw new Error('replicate prediction succeeded but returned no output');
    return { outputUrl, predictionId: prediction.id };
  },
};
