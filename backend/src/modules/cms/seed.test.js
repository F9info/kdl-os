import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ seedCmsSamples: vi.fn(), createStarterSite: vi.fn(), saveChoice: vi.fn() }));
vi.mock('./pages.js', () => ({ seedCmsSamples: h.seedCmsSamples }));
vi.mock('../projects/onboarding.js', () => ({
  createStarterSite: h.createStarterSite,
  saveChoice: h.saveChoice,
}));

const { default: seed } = await import('./seed.js');
const tx = { tx: true };

beforeEach(() => {
  vi.clearAllMocks();
  h.createStarterSite.mockResolvedValue({ created: ['home'], skipped: [] });
});

describe('CMS install seed generates the demo website', () => {
  it('seeds samples, creates the starter site with the CMS pages, and records the answer "yes"', async () => {
    await seed(tx);
    expect(h.seedCmsSamples).toHaveBeenCalledWith(tx);
    expect(h.createStarterSite).toHaveBeenCalledWith(tx, null, { withCms: true });
    expect(h.saveChoice).toHaveBeenCalledWith('yes', tx);
  });

  it('with no default project it does not fail the install and records nothing', async () => {
    h.createStarterSite.mockRejectedValue(
      Object.assign(new Error('Default project not found'), { status: 409 })
    );
    await expect(seed(tx)).resolves.toBeUndefined();
    expect(h.saveChoice).not.toHaveBeenCalled();
  });

  it('any other error still fails the install (nothing half-created)', async () => {
    h.createStarterSite.mockRejectedValue(new Error('db down'));
    await expect(seed(tx)).rejects.toThrow('db down');
  });
});
