import { z } from 'zod';

// Self-hosted OpenAI-compatible whisper server (e.g. faster-whisper-server, speaches).
// No API key required by default — endpoint URL is the "credential" (may embed a token).
const credentialsSchema = z.object({
  endpoint_url: z.string().url(),
  api_key: z.string().optional(),
});

const configSchema = z.object({
  model: z.string().min(1).optional().default('Systran/faster-whisper-small'),
});

export default {
  driver: 'whisper-local',
  features: ['speech_to_text'],
  credentialsSchema,
  configSchema,

  /**
   * Transcribe an audio Buffer via a local OpenAI-compatible whisper endpoint.
   * Returns { text, segments, language } (segments verbose_json shape).
   */
  async transcribe({ credentials, config = {}, audio, filename = 'audio.wav', language }) {
    const cfg = configSchema.parse(config);
    const form = new FormData();
    form.append('file', new Blob([audio]), filename);
    form.append('model', cfg.model);
    form.append('response_format', 'verbose_json');
    if (language) form.append('language', language);

    const headers = {};
    if (credentials.api_key) headers.Authorization = `Bearer ${credentials.api_key}`;

    const res = await fetch(`${credentials.endpoint_url.replace(/\/$/, '')}/v1/audio/transcriptions`, {
      method: 'POST',
      headers,
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`whisper-local request failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    return { text: data.text ?? '', segments: data.segments ?? [], language: data.language ?? language ?? null };
  },
};
