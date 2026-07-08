import { z } from 'zod';

const credentialsSchema = z.object({
  api_key: z.string().min(1),
});

const configSchema = z.object({
  model: z.string().min(1).optional().default('whisper-1'),
  base_url: z.string().url().optional().default('https://api.openai.com/v1'),
});

export default {
  driver: 'openai-whisper-api',
  features: ['speech_to_text'],
  credentialsSchema,
  configSchema,

  /**
   * Transcribe an audio Buffer via the OpenAI audio API.
   * Returns { text, segments, language } (verbose_json shape).
   */
  async transcribe({ credentials, config = {}, audio, filename = 'audio.wav', language }) {
    const cfg = configSchema.parse(config);
    const form = new FormData();
    form.append('file', new Blob([audio]), filename);
    form.append('model', cfg.model);
    form.append('response_format', 'verbose_json');
    if (language) form.append('language', language);

    const res = await fetch(`${cfg.base_url}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${credentials.api_key}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`openai-whisper-api request failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    return { text: data.text ?? '', segments: data.segments ?? [], language: data.language ?? language ?? null };
  },
};
