import { describe, it, expect, vi, beforeEach } from 'vitest';

const claudeBrainMock = vi.hoisted(() => vi.fn());
const openrouterBrainMock = vi.hoisted(() => vi.fn());
const checkBudgetMock = vi.hoisted(() => vi.fn());
const recordSpendMock = vi.hoisted(() => vi.fn());
const auditLoggerMock = vi.hoisted(() => vi.fn());

vi.mock('../src/brains/claude.js', async (importOriginal) => ({
  ...(await importOriginal()),
  claudeBrain: claudeBrainMock,
}));
vi.mock('../src/brains/openrouter.js', () => ({
  openrouterBrain: openrouterBrainMock,
}));
vi.mock('../src/orchestrator/budget-tracker.js', () => ({
  checkBudget: checkBudgetMock,
  recordSpend: recordSpendMock,
}));
vi.mock('../src/governance/audit-logger.js', () => ({
  auditLogger: auditLoggerMock,
}));
vi.mock('../src/knowledge/retrieve.js', () => ({
  retrieveChunks: vi.fn().mockResolvedValue([]),
}));
vi.mock('../src/orchestrator/context-manager.js', () => ({
  addMessage: vi.fn().mockResolvedValue(undefined),
  getContext: vi.fn().mockResolvedValue([]),
}));
vi.mock('../src/memory/short-term.js', () => ({
  getMemory: vi.fn().mockResolvedValue(null),
  setMemory: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/memory/long-term.js', () => ({
  searchMemory: vi.fn().mockResolvedValue([]),
}));

import { brainRouter } from '../src/orchestrator/brain-router.js';
import { textBlock, imageBlock } from '../src/brains/claude.js';
import { ragChain } from '../src/chains/rag-chain.js';
import { NonDeterministicWorkflow } from '../src/workflows/non-deterministic.js';
import { BaseAgent } from '../src/agents/base.js';

const claudeResponse = {
  content: 'claude says',
  usage: { input_tokens: 10, output_tokens: 5 },
  model: 'claude-sonnet-4-6',
  cost: null,
};

const openrouterResponse = {
  content: 'openrouter says',
  usage: { input_tokens: 8, output_tokens: 4 },
  model: 'moonshot-ai/moonshot-v1-32k',
  cost: 0.000024,
};

beforeEach(() => {
  vi.clearAllMocks();
  claudeBrainMock.mockResolvedValue(claudeResponse);
  openrouterBrainMock.mockResolvedValue(openrouterResponse);
  checkBudgetMock.mockResolvedValue(true);
  auditLoggerMock.mockResolvedValue(undefined);
});

describe('brainRouter routing contract (KDL-488)', () => {
  it('routes HIGH priority to claudeBrain with the payload untouched', async () => {
    const result = await brainRouter('do the thing', 'HIGH', { sessionId: 's1' });
    expect(claudeBrainMock).toHaveBeenCalledWith('do the thing', { sessionId: 's1' });
    expect(openrouterBrainMock).not.toHaveBeenCalled();
    expect(result).toEqual(claudeResponse);
  });

  it('routes MEDIUM priority to openrouterBrain with the payload untouched', async () => {
    const result = await brainRouter('cheap task', 'MEDIUM', { sessionId: 's2' });
    expect(openrouterBrainMock).toHaveBeenCalledWith('cheap task', { sessionId: 's2' });
    expect(claudeBrainMock).not.toHaveBeenCalled();
    expect(result).toEqual(openrouterResponse);
    expect(recordSpendMock).toHaveBeenCalledWith(openrouterResponse.cost);
  });

  it('returns BUDGET_EXHAUSTED without calling any brain when budget is spent', async () => {
    checkBudgetMock.mockResolvedValue(false);
    const result = await brainRouter('cheap task', 'LOW');
    expect(result.error).toBe('BUDGET_EXHAUSTED');
    expect(claudeBrainMock).not.toHaveBeenCalled();
    expect(openrouterBrainMock).not.toHaveBeenCalled();
  });

  it('forces the Claude path for a content-block array with an image, at any priority', async () => {
    const blocks = [textBlock('tone of this logo?'), imageBlock('aGVsbG8=')];
    const result = await brainRouter(blocks, 'MEDIUM', { sessionId: 'brand' });
    expect(claudeBrainMock).toHaveBeenCalledWith(blocks, { sessionId: 'brand' });
    expect(openrouterBrainMock).not.toHaveBeenCalled();
    expect(checkBudgetMock).not.toHaveBeenCalled();
    expect(result).toEqual(claudeResponse);
  });

  it('forces the Claude path for a messages array whose content contains an image block', async () => {
    const messages = [
      { role: 'user', content: [textBlock('describe'), imageBlock('aGVsbG8=')] },
    ];
    await brainRouter(messages, 'LOW');
    expect(claudeBrainMock).toHaveBeenCalledWith(messages, {});
    expect(openrouterBrainMock).not.toHaveBeenCalled();
  });

  it('does NOT force Claude for text-only content blocks or plain messages arrays', async () => {
    await brainRouter([textBlock('just text')], 'MEDIUM');
    await brainRouter([{ role: 'user', content: 'plain' }], 'MEDIUM');
    expect(openrouterBrainMock).toHaveBeenCalledTimes(2);
    expect(claudeBrainMock).not.toHaveBeenCalled();
  });

  it('survives an auditLogger failure and still returns the brain response', async () => {
    auditLoggerMock.mockRejectedValue(new Error('audit db down'));
    const result = await brainRouter('task', 'HIGH');
    expect(result).toEqual(claudeResponse);
  });
});

describe('existing brainRouter callers keep their contract (KDL-488)', () => {
  it('ragChain sends a role/content messages array with system + sessionId options', async () => {
    const result = await ragChain('what is KDL?', 'sess-9', 'MEDIUM');
    expect(openrouterBrainMock).toHaveBeenCalledTimes(1);
    const [messages, options] = openrouterBrainMock.mock.calls[0];
    expect(messages).toEqual([{ role: 'user', content: 'what is KDL?' }]);
    expect(options.sessionId).toBe('sess-9');
    expect(options.system).toContain('KDL Starter Kit');
    expect(result).toEqual(openrouterResponse);
  });

  it('ragChain at HIGH priority reaches claudeBrain with the same shape', async () => {
    await ragChain('what is KDL?', 'sess-9', 'HIGH');
    const [messages] = claudeBrainMock.mock.calls[0];
    expect(messages).toEqual([{ role: 'user', content: 'what is KDL?' }]);
    expect(openrouterBrainMock).not.toHaveBeenCalled();
  });

  it('NonDeterministicWorkflow._nextStep sends a flat string prompt at HIGH priority', async () => {
    claudeBrainMock.mockResolvedValue({ ...claudeResponse, content: '1' });
    const wf = new NonDeterministicWorkflow({
      name: 'wf',
      steps: [{ name: 'a', fn: async () => 'ra' }, { name: 'b', fn: async () => 'rb' }],
      sessionId: 'wf-sess',
    });
    const next = await wf._nextStep({ currentStep: 0, results: [] }, 'ra');
    expect(next).toBe(1);
    const [prompt, options] = claudeBrainMock.mock.calls[0];
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('Reply with ONLY a step index number');
    expect(options).toEqual({ sessionId: 'wf-sess' });
  });

  it('BaseAgent.run sends a flat string prompt at its default MEDIUM priority', async () => {
    openrouterBrainMock.mockResolvedValue({ ...openrouterResponse, content: 'task complete' });
    const agent = new BaseAgent({ sessionId: 'agent-sess' });
    const { result, iterations } = await agent.run('sort the files');
    expect(iterations).toBe(1);
    expect(result).toBe('task complete');
    const [prompt, options] = openrouterBrainMock.mock.calls[0];
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('Task: sort the files');
    expect(options).toEqual({ sessionId: 'agent-sess' });
  });

  it('BaseAgent.run surfaces the BUDGET_EXHAUSTED error envelope unchanged', async () => {
    checkBudgetMock.mockResolvedValue(false);
    const agent = new BaseAgent({ sessionId: 'agent-sess' });
    const result = await agent.run('anything');
    expect(result).toEqual({ error: 'BUDGET_EXHAUSTED', iterations: 1 });
  });
});
