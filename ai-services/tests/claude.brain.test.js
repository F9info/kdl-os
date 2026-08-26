import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const createMock = vi.hoisted(() => vi.fn());
const streamMock = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: { create: createMock, stream: streamMock },
  })),
}));

import {
  claudeBrain,
  claudeBrainStream,
  claudeModel,
  textBlock,
  imageBlock,
} from '../src/brains/claude.js';

const apiResponse = {
  content: [{ type: 'text', text: 'hello' }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 10, output_tokens: 5 },
  model: 'claude-opus-5',
};

describe('claudeBrain input normalisation (KDL-484)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMock.mockResolvedValue(apiResponse);
    streamMock.mockReturnValue({ on: vi.fn() });
  });

  it('wraps a flat string as a single user message (existing callers)', async () => {
    await claudeBrain('summarise this');
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'summarise this' }],
      }),
    );
  });

  it('passes a messages array through untouched', async () => {
    const messages = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'continue' },
    ];
    await claudeBrain(messages);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ messages }),
    );
  });

  it('wraps a content-block array (text + image) as one user message', async () => {
    const blocks = [
      textBlock('What tone does this logo convey?'),
      imageBlock('aGVsbG8=', 'image/png'),
    ];
    await claudeBrain(blocks);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: blocks }],
      }),
    );
  });

  it('passes through a messages array whose content is itself blocks', async () => {
    const messages = [
      {
        role: 'user',
        content: [textBlock('describe'), imageBlock('aGVsbG8=')],
      },
    ];
    await claudeBrain(messages);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ messages }),
    );
  });

  it('still stringifies non-string, non-array input', async () => {
    await claudeBrain(42);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: '42' }],
      }),
    );
  });

  it('forwards system and max_tokens options unchanged', async () => {
    await claudeBrain('prompt', { system: 'be terse', max_tokens: 128 });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ system: 'be terse', max_tokens: 128 }),
    );
  });

  it('returns the same envelope shape as before (plus stop_reason, KDL-511)', async () => {
    const result = await claudeBrain('prompt');
    expect(result).toEqual({
      content: 'hello',
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
      model: 'claude-opus-5',
      cost: null,
    });
  });

  it('claudeBrainStream applies the same normalisation to content blocks', async () => {
    const blocks = [textBlock('t'), imageBlock('aGVsbG8=', 'image/webp')];
    await claudeBrainStream(blocks);
    expect(streamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: blocks }],
      }),
    );
  });
});

describe('model configuration (KDL-511)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMock.mockResolvedValue(apiResponse);
    streamMock.mockReturnValue({ on: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to claude-opus-5 (D-BK-2: HIGH path is not cost-optimised)', async () => {
    vi.stubEnv('CLAUDE_DEFAULT_MODEL', '');
    expect(claudeModel()).toBe('claude-opus-5');
    await claudeBrain('prompt');
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-opus-5' }),
    );
  });

  it('honours the CLAUDE_DEFAULT_MODEL env override in both entry points', async () => {
    vi.stubEnv('CLAUDE_DEFAULT_MODEL', 'claude-sonnet-5');
    await claudeBrain('prompt');
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-5' }),
    );
    await claudeBrainStream('prompt');
    expect(streamMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-5' }),
    );
  });
});

describe('response extraction (KDL-511)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('still returns the text when a non-text block leads the content array', async () => {
    createMock.mockResolvedValue({
      ...apiResponse,
      content: [
        { type: 'thinking', thinking: 'let me reason', signature: 'sig' },
        { type: 'text', text: 'the actual answer' },
      ],
    });
    const result = await claudeBrain('prompt');
    expect(result.content).toBe('the actual answer');
  });

  it('concatenates multiple text blocks around a tool_use block', async () => {
    createMock.mockResolvedValue({
      ...apiResponse,
      content: [
        { type: 'text', text: 'part one, ' },
        { type: 'tool_use', id: 't1', name: 'lookup', input: {} },
        { type: 'text', text: 'part two' },
      ],
    });
    const result = await claudeBrain('prompt');
    expect(result.content).toBe('part one, part two');
  });

  it('surfaces stop_reason so a refusal is distinguishable from an empty answer', async () => {
    createMock.mockResolvedValue({
      ...apiResponse,
      content: [],
      stop_reason: 'refusal',
    });
    const result = await claudeBrain('prompt');
    expect(result.content).toBe('');
    expect(result.stop_reason).toBe('refusal');
  });
});

describe('content block helpers', () => {
  it('textBlock builds an Anthropic text block', () => {
    expect(textBlock('hi')).toEqual({ type: 'text', text: 'hi' });
  });

  it('imageBlock builds a base64 image block, defaulting to image/png', () => {
    expect(imageBlock('aGVsbG8=')).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' },
    });
    expect(imageBlock('aGVsbG8=', 'image/webp').source.media_type).toBe(
      'image/webp',
    );
  });
});
