import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ seedCmsSamples: vi.fn(), createStarterSite: vi.fn() }));
vi.mock('./pages.js', () => ({ seedCmsSamples: h.seedCmsSamples }));
vi.mock('../projects/onboarding.js', () => ({
  createStarterSite: h.createStarterSite,
  ONBOARDING_KEY: 'onboarding.frontend',
}));

const { default: seed } = await import('./seed.js');
const txWith = (value) => ({
  appSetting: { findUnique: vi.fn().mockResolvedValue(value === undefined ? null : { value }) },
});

beforeEach(() => {
  vi.clearAllMocks();
  h.createStarterSite.mockResolvedValue({ created: ['home'], skipped: [] });
});

describe('CMS install seed: the demo website is optional', () => {
  it.each([
    ['not answered yet', undefined],
    ['answered "no"', 'no'],
  ])('%s: installs empty. No placeholder rows, no pages, nothing recorded', async (_n, answer) => {
    const tx = txWith(answer);
    await seed(tx);
    expect(h.seedCmsSamples).not.toHaveBeenCalled();
    expect(h.createStarterSite).not.toHaveBeenCalled();
  });

  it('answered "yes" in the wizard: seeds the sample rows and creates the starter site with CMS pages', async () => {
    const tx = txWith('yes');
    await seed(tx);
    expect(tx.appSetting.findUnique).toHaveBeenCalledWith({ where: { key: 'onboarding.frontend' } });
    expect(h.seedCmsSamples).toHaveBeenCalledWith(tx);
    expect(h.createStarterSite).toHaveBeenCalledWith(tx, null, { withCms: true });
  });

  it('with "yes" but no default project yet it does not fail the install', async () => {
    h.createStarterSite.mockRejectedValue(
      Object.assign(new Error('Default project not found'), { status: 409 })
    );
    await expect(seed(txWith('yes'))).resolves.toBeUndefined();
  });

  it('any other error still fails the install (nothing half-created)', async () => {
    h.createStarterSite.mockRejectedValue(new Error('db down'));
    await expect(seed(txWith('yes'))).rejects.toThrow('db down');
  });
});
