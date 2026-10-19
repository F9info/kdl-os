import { z } from 'zod';

const credentialsSchema = z.object({
  api_key: z.string().min(1),
});

const configSchema = z.object({
  vision_model: z.string().min(1).optional().default('gemini-2.5-flash'),
  embeddings_model: z.string().min(1).optional().default('text-embedding-004'),
  base_url: z.string().url().optional().default('https://generativelanguage.googleapis.com/v1beta'),
});

export default {
  driver: 'gemini',
  features: ['vision', 'embeddings'],
  credentialsSchema,
  configSchema,

  async analyzeImage({ credentials, config = {}, image, mimeType, prompt }) {
    const cfg = configSchema.parse(config);
    const url = `${cfg.base_url}/models/${cfg.vision_model}:generateContent?key=${credentials.api_key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: image.toString('base64') } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`gemini request failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('gemini returned no content');
    return { text, model: cfg.vision_model };
  },

  async embed({ credentials, config = {}, texts }) {
    const cfg = configSchema.parse(config);
    const model = `models/${cfg.embeddings_model}`;
    const url = `${cfg.base_url}/models/${cfg.embeddings_model}:batchEmbedContents?key=${credentials.api_key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model,
          content: { parts: [{ text }] },
        })),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`gemini request failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    const embeddings = data?.embeddings;
    if (!embeddings?.length) throw new Error('gemini returned no embeddings');
    return embeddings.map((e) => e.values);
  },
};
