import { z } from 'zod';

const credentialsSchema = z.object({
  api_key: z.string().min(1),
});

const configSchema = z.object({
  model: z.string().min(1).optional().default('qwen/qwen2.5-vl-72b-instruct'),
  base_url: z.string().url().optional().default('https://openrouter.ai/api/v1'),
});

export default {
  driver: 'openrouter-vision',
  features: ['vision'],
  credentialsSchema,
  configSchema,

  /**
   * Send an image + instruction prompt to an OpenRouter vision model.
   * `image` is a Buffer; returns the raw model text (caller parses structure).
   */
  async analyzeImage({ credentials, config = {}, image, mimeType, prompt }) {
    const cfg = configSchema.parse(config);
    const res = await fetch(`${cfg.base_url}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${image.toString('base64')}` },
              },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`openrouter-vision request failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('openrouter-vision returned no content');
    return { text, model: data.model ?? cfg.model };
  },
};
