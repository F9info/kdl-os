import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../orchestrator/brain-router.js', () => ({ brainRouter: vi.fn() }));
vi.mock('../governance/audit-logger.js', () => ({ auditLogger: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../governance/compliance.js', () => ({ scrubInput: (s) => s }));

import { brainRouter } from '../orchestrator/brain-router.js';
import { auditLogger } from '../governance/audit-logger.js';
import { generateWebsiteCopy } from './website-copy.js';

const VALID_JSON = JSON.stringify({
  hero: [
    {
      badge: 'Central AC',
      headline: 'Cool comfort, engineered precisely.',
      subheadline: 'Centralized air-conditioning sized and installed by our own engineers.',
      ctaLabel: 'Get a Quote',
    },
    {
      badge: 'Electrical',
      headline: 'Electrical systems, engineered to last.',
      subheadline: 'Wiring, panels and switchgear installed and serviced by our own in-house team.',
      ctaLabel: 'Get a Quote',
    },
    {
      badge: '24/7 Service',
      headline: 'One team, every callout.',
      subheadline: 'A single accountable service team for every system we install, day or night.',
      ctaLabel: 'Book Service',
    },
  ],
  about: {
    eyebrow: 'About Us',
    heading: 'Two decades of engineered comfort',
    paragraph: 'We design, supply and install HVAC and electrical systems for homes and businesses across the region, backed by our own in-house service team.',
  },
});

describe('generateWebsiteCopy', () => {
  const routerMock = vi.mocked(brainRouter);

  beforeEach(() => {
    routerMock.mockReset();
  });

  it('returns a valid envelope on a clean model response', async () => {
    routerMock.mockResolvedValue({
      model: 'claude-opus-5',
      content: VALID_JSON,
      usage: { input_tokens: 300, output_tokens: 150 },
    });

    const envelope = await generateWebsiteCopy({
      projectId: 'proj-1',
      companyName: 'Acme HVAC',
      businessDescription: 'We install and service air conditioning and electrical systems.',
    });

    expect(envelope.success).toBe(true);
    expect(envelope.copy.hero).toHaveLength(3);
    expect(envelope.copy.hero[0].headline).toBe('Cool comfort, engineered precisely.');
    expect(envelope.copy.hero[2].ctaLabel).toBe('Book Service');
    expect(envelope.copy.about.paragraph).toContain('in-house service team');
    expect(envelope.model).toBe('claude-opus-5');
    expect(routerMock).toHaveBeenCalledWith(
      expect.any(Array),
      'HIGH',
      expect.objectContaining({ max_tokens: expect.any(Number) }),
    );
    expect(vi.mocked(auditLogger)).toHaveBeenCalledWith(
      expect.objectContaining({ cost_estimate: expect.any(Number) }),
    );
    const auditedCost = vi.mocked(auditLogger).mock.calls[0][0].cost_estimate;
    expect(auditedCost).toBeGreaterThan(0);
  });

  it('retries once on schema-invalid output, then succeeds', async () => {
    routerMock
      .mockResolvedValueOnce({ model: 'claude-opus-5', content: '{"hero": {}}', usage: { input_tokens: 300, output_tokens: 50 } })
      .mockResolvedValueOnce({ model: 'claude-opus-5', content: VALID_JSON, usage: { input_tokens: 350, output_tokens: 150 } });

    const envelope = await generateWebsiteCopy({
      projectId: 'proj-1',
      companyName: 'Acme HVAC',
      businessDescription: 'We install and service air conditioning and electrical systems.',
    });

    expect(envelope.success).toBe(true);
    expect(routerMock).toHaveBeenCalledTimes(2);
  });

  it('reports failure (no throw) when the repair attempt also fails', async () => {
    routerMock.mockResolvedValue({ model: 'claude-opus-5', content: 'not json', usage: { input_tokens: 300, output_tokens: 10 } });

    const envelope = await generateWebsiteCopy({
      projectId: 'proj-1',
      companyName: 'Acme HVAC',
      businessDescription: 'We install and service air conditioning and electrical systems.',
    });

    expect(envelope.success).toBe(false);
    expect(routerMock).toHaveBeenCalledTimes(2);
  });

  it('reports failure when the model call itself throws', async () => {
    routerMock.mockRejectedValue(new Error('transport down'));

    const envelope = await generateWebsiteCopy({
      projectId: 'proj-1',
      companyName: 'Acme HVAC',
      businessDescription: 'We install and service air conditioning and electrical systems.',
    });

    expect(envelope.success).toBe(false);
  });
});
