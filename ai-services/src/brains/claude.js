import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function claudeBrain(messages, options = {}) {
  const normalised = Array.isArray(messages)
    ? messages
    : [{ role: 'user', content: String(messages) }];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: options.max_tokens ?? 4096,
    ...(options.system ? { system: options.system } : {}),
    messages: normalised,
  });

  return {
    content: response.content[0]?.text ?? '',
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
    model: response.model,
    cost: null,
  };
}

export async function claudeBrainStream(messages, options = {}) {
  const normalised = Array.isArray(messages)
    ? messages
    : [{ role: 'user', content: String(messages) }];

  return client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: options.max_tokens ?? 4096,
    ...(options.system ? { system: options.system } : {}),
    messages: normalised,
  });
}
