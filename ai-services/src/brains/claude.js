import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Normalise caller input into an Anthropic messages array. Accepts:
 * - a flat string (existing callers): wrapped as a single user message
 * - an array of messages ({ role, content }): passed through untouched
 * - an array of content blocks ({ type: 'text' | 'image' | ... }, no role):
 *   wrapped as the content of a single user message (KDL-484, multimodal)
 */
function normaliseMessages(messages) {
  if (Array.isArray(messages)) {
    const isContentBlockArray =
      messages.length > 0 &&
      messages.every(
        (item) =>
          item &&
          typeof item === 'object' &&
          typeof item.type === 'string' &&
          !('role' in item),
      );
    return isContentBlockArray
      ? [{ role: 'user', content: messages }]
      : messages;
  }
  return [{ role: 'user', content: String(messages) }];
}

/** Build a text content block. */
export function textBlock(text) {
  return { type: 'text', text: String(text) };
}

/**
 * Build a base64 image content block (e.g. the normalized PNG raster from
 * brand-kit logo intake). `data` must be base64 without a data: URL prefix.
 */
export function imageBlock(data, mediaType = 'image/png') {
  return {
    type: 'image',
    source: { type: 'base64', media_type: mediaType, data },
  };
}

export async function claudeBrain(messages, options = {}) {
  const normalised = normaliseMessages(messages);

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
  const normalised = normaliseMessages(messages);

  return client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: options.max_tokens ?? 4096,
    ...(options.system ? { system: options.system } : {}),
    messages: normalised,
  });
}
