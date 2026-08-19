import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Single source of truth for the Claude model id (KDL-511). D-BK-2 (KDL-483)
 * binds the HIGH/quality path to the flagship tier, so the default is
 * claude-opus-5 — do not downgrade it for cost without a ruling. Read at call
 * time so a config change does not require a module reload.
 */
export function claudeModel() {
  return process.env.CLAUDE_DEFAULT_MODEL || 'claude-opus-5';
}

/**
 * `response.content` is a heterogeneous block array (text, thinking,
 * tool_use). Indexing `[0]` silently yields '' whenever a non-text block
 * leads, so concatenate every text block instead (KDL-511).
 */
function extractText(content) {
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => block?.type === 'text')
    .map((block) => block.text)
    .join('');
}

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

  const params = {
    model: claudeModel(),
    max_tokens: options.max_tokens ?? 4096,
    ...(options.system ? { system: options.system } : {}),
    messages: normalised,
  };

  // Caller-supplied AbortSignal (KDL-510 §4.4 F3 — brand inference bounds the
  // call at 20 s). SDK request option, not a message param.
  const response = options.signal
    ? await client.messages.create(params, { signal: options.signal })
    : await client.messages.create(params);

  return {
    content: extractText(response.content),
    // 'refusal' (HTTP 200, empty/partial content) and 'max_tokens' must be
    // distinguishable from a genuine empty answer by callers (KDL-510).
    stop_reason: response.stop_reason ?? null,
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
    model: claudeModel(),
    max_tokens: options.max_tokens ?? 4096,
    ...(options.system ? { system: options.system } : {}),
    messages: normalised,
  });
}
