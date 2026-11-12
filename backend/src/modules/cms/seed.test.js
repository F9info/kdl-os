import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ seedCmsSamples: vi.fn(), createStarterSite: vi.fn(), seedDemoLandingPages: vi.fn() }));
vi.mock('./pages.js', () => ({ seedCmsSamples: h.seedCmsSamples }));
vi.mock('../landing/demo.js', () => ({ seedDemoLandingPages: h.seedDemoLandingPages }));
vi.mock('../projects/onboarding.js', () => ({
  createStarterSite: h.createStarterSite,
  ONBOARDING_KEY: 'onboarding.frontend',
}));

const { default: seed } = await import('./seed.js');
const txWith = (value) => ({
  appSetting: {
    findUnique: vi.fn().mockResolvedValue(value === undefined ? null : { value }),
    upsert: vi.fn().mockResolvedValue({}),
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  h.createStarterSite.mockResolvedValue({ created: ['home'], skipped: [] });
  h.seedDemoLandingPages.mockResolvedValue({ created: ['business', 'saas', 'agency', 'startup'], skipped: [] });
});

describe('CMS install seed: Frontend ships a ready demo', () => {
  it('answered "no" in the wizard: installs empty, nothing created, nothing recorded', async () => {
    const tx = txWith('no');
    await seed(tx);
    expect(h.seedCmsSamples).not.toHaveBeenCalled();
    expect(h.createStarterSite).not.toHaveBeenCalled();
    expect(h.seedDemoLandingPages).not.toHaveBeenCalled();
    expect(tx.appSetting.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ['not answered yet', undefined],
    ['answered "yes"', 'yes'],
  ])('%s: creates the sample rows, the starter site and the four landing pages', async (_n, answer) => {
    const tx = txWith(answer);
    await seed(tx);
    expect(tx.appSetting.findUnique).toHaveBeenCalledWith({ where: { key: 'onboarding.frontend' } });
    expect(h.seedCmsSamples).toHaveBeenCalledWith(tx);
    expect(h.createStarterSite).toHaveBeenCalledWith(tx, null, { withCms: true });
    expect(h.seedDemoLandingPages).toHaveBeenCalledWith(tx, null);
  });

  it('stores a summary of what was created for the "Frontend installed" screen', async () => {
    const tx = txWith(undefined);
    await seed(tx);
    const call = tx.appSetting.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ key: 'frontend.demo_summary' });
    const stored = JSON.parse(call.create.value);
    expect(stored.website.created).toEqual(['home']);
    expect(stored.landing.created).toHaveLength(4);
  });

  it('with no default project yet it does not fail the install', async () => {
    h.createStarterSite.mockRejectedValue(
      Object.assign(new Error('Default project not found'), { status: 409 })
    );
    await expect(seed(txWith(undefined))).resolves.toBeUndefined();
  });

  it('any other error still fails the install (nothing half-created)', async () => {
    h.createStarterSite.mockRejectedValue(new Error('db down'));
    await expect(seed(txWith(undefined))).rejects.toThrow('db down');
  });
});
