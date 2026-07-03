import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/brains/openrouter.js', () => ({
  openrouterTranscribe: vi.fn(),
}));

vi.mock('../src/governance/compliance.js', () => ({
  scrubInput: vi.fn((text) => text),
}));

vi.mock('../src/governance/audit-logger.js', () => ({
  auditLogger: vi.fn(),
}));

vi.mock('../src/orchestrator/budget-tracker.js', () => ({
  checkBudget: vi.fn(),
  recordSpend: vi.fn(),
}));

import { openrouterTranscribe } from '../src/brains/openrouter.js';
import { scrubInput } from '../src/governance/compliance.js';
import { auditLogger } from '../src/governance/audit-logger.js';
import { checkBudget, recordSpend } from '../src/orchestrator/budget-tracker.js';
import { transcribeController } from '../src/controllers/transcribe.js';

const openrouterMock = vi.mocked(openrouterTranscribe, { deep: true });
const complianceMock = vi.mocked(scrubInput, { deep: true });
const auditMock = vi.mocked(auditLogger, { deep: true });
const budgetMockCheck = vi.mocked(checkBudget, { deep: true });
const budgetMockRecord = vi.mocked(recordSpend, { deep: true });

function mockRes() {
  const res = { statusCode: 200, jsonBody: null };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body) => {
    res.jsonBody = body;
    return res;
  });
  return res;
}

function audioBase64(bytes = 100) {
  return Buffer.alloc(bytes).toString('base64');
}

describe('transcribe controller regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    budgetMockCheck.mockResolvedValue(true);
  });

  it('rejects non-base64 audio', async () => {
    const req = { body: { audio: 'not base64!', filename: 'audio.webm' } };
    const res = mockRes();
    await transcribeController(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody.success).toBe(false);
    expect(res.jsonBody.errors).toHaveProperty('audio');
  });

  it('rejects unsupported file formats', async () => {
    const req = { body: { audio: audioBase64(), filename: 'audio.exe' } };
    const res = mockRes();
    await transcribeController(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody.errors).toHaveProperty('filename');
  });

  it('rejects audio larger than 7MB (KDL-5 budget guard)', async () => {
    const req = { body: { audio: audioBase64(8 * 1024 * 1024), filename: 'audio.webm' } };
    const res = mockRes();
    await transcribeController(req, res);

    expect(res.statusCode).toBe(413);
    expect(res.jsonBody.message).toMatch(/7MB/i);
  });

  it('returns 503 when daily budget is exhausted', async () => {
    budgetMockCheck.mockResolvedValue(false);
    const req = { body: { audio: audioBase64(), filename: 'audio.webm' } };
    const res = mockRes();
    await transcribeController(req, res);

    expect(res.statusCode).toBe(503);
  });

  it('transcribes, scrubs output, records spend and audits the call (KDL-5)', async () => {
    openrouterMock.mockResolvedValue({
      text: ' hello email@test.com ',
      language: 'en',
      duration: 60,
      cost: 0.006,
      model: 'openai/whisper-1',
    });
    complianceMock.mockReturnValue('scrubbed text');

    const req = { body: { audio: audioBase64(), filename: 'audio.webm' } };
    const res = mockRes();
    await transcribeController(req, res);

    expect(openrouterMock).toHaveBeenCalledWith(
      expect.any(Buffer),
      'audio.webm',
      { language: undefined }
    );
    expect(complianceMock).toHaveBeenCalledWith(' hello email@test.com ');
    expect(budgetMockRecord).toHaveBeenCalledWith(0.006);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'openai/whisper-1',
        cost_estimate: 0.006,
      })
    );
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody.data.transcript).toBe('scrubbed text');
  });
});
