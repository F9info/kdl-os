import { z } from 'zod';

const credentialsSchema = z.object({
  api_key: z.string().min(1),
});

// base_url configurable so any OpenAI-compatible endpoint (e.g. OpenRouter) works.
const configSchema = z.object({
  model: z.string().min(1).optional().default('text-embedding-3-small'),
  base_url: z.string().url().optional().default('https://api.openai.com/v1'),
});

export default {
  driver: 'openai-embeddings',
  features: ['embeddings'],
  credentialsSchema,
  configSchema,

  /**
   * Embed an array of texts via the OpenAI-compatible /embeddings API.
   * Returns number[][] — one vector per input text, input order preserved.
   */
  async embed({ credentials, config = {}, texts }) {
    const cfg = configSchema.parse(config);
    const res = await fetch(`${cfg.base_url}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: cfg.model, input: texts }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`openai-embeddings request failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    // API may return out of order — sort by index to be safe.
    return (data.data ?? [])
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  },
};
