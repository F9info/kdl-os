import OpenAI, { toFile } from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.BACKEND_URL ?? 'http://localhost:4000',
    'X-Title': 'KDL AI Services',
  },
});

const MODEL = process.env.OPENROUTER_DEFAULT_MODEL ?? 'moonshot-ai/moonshot-v1-32k';
const COST_PER_TOKEN = 0.000002;

export async function openrouterBrain(messages, options = {}) {
  const userMessages = Array.isArray(messages)
    ? messages
    : [{ role: 'user', content: String(messages) }];

  const allMessages = options.system
    ? [{ role: 'system', content: options.system }, ...userMessages]
    : userMessages;

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: options.max_tokens ?? 4096,
    messages: allMessages,
  });

  const choice = response.choices[0];
  const usage = response.usage;
  const totalTokens = (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0);

  return {
    content: choice?.message?.content ?? '',
    usage: {
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
    },
    cost: totalTokens * COST_PER_TOKEN,
    model: response.model ?? MODEL,
  };
}

const WHISPER_MODEL = process.env.OPENROUTER_WHISPER_MODEL ?? 'openai/whisper-1';
const WHISPER_COST_PER_MINUTE = 0.006;

export async function openrouterTranscribe(audioBuffer, filename, options = {}) {
  const file = await toFile(audioBuffer, filename);

  const response = await client.audio.transcriptions.create({
    model: WHISPER_MODEL,
    file,
    response_format: 'verbose_json',
    ...(options.language ? { language: options.language } : {}),
  });

  const durationSeconds = response.duration ?? 0;

  return {
    text: response.text ?? '',
    language: response.language ?? options.language ?? null,
    duration: durationSeconds,
    cost: (durationSeconds / 60) * WHISPER_COST_PER_MINUTE,
    model: WHISPER_MODEL,
  };
}

export async function openrouterEmbed(text) {
  const response = await client.embeddings.create({
    model: 'openai/text-embedding-3-small',
    input: typeof text === 'string' ? text : text.join(' '),
  });
  return response.data[0]?.embedding ?? [];
}
