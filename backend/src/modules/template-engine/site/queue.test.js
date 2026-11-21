import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirst = vi.fn();
const siteExists = vi.fn();
const buildSite = vi.fn(async () => ({ slug: 'default', pages: 5 }));
vi.mock('../../../config/database.js', () => ({ prisma: { project: { findFirst } } }));
vi.mock('./generator.js', () => ({ buildSite, siteExists, listGeneratedProjectIds: vi.fn(async () => []) }));
vi.mock('../../../shared/default-project.js', () => ({ getDefaultProjectId: vi.fn(async () => 'p1') }));
vi.mock('../../../shared/utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { processSiteBuild } = await import('./queue.js');

beforeEach(() => {
  vi.clearAllMocks();
  findFirst.mockResolvedValue({ id: 'p1', slug: 'default' });
});

describe('site-build job', () => {
  it('rebuilds a site that already has a generated folder', async () => {
    siteExists.mockResolvedValue(true);
    expect(await processSiteBuild({ projectId: 'p1' })).toBe('default');
    expect(buildSite).toHaveBeenCalledWith('p1');
  });

  it('skips an edit-triggered build when the project has no generated site yet', async () => {
    siteExists.mockResolvedValue(false);
    expect(await processSiteBuild({ projectId: 'p1' })).toBe('skipped');
    expect(buildSite).not.toHaveBeenCalled();
  });

  it('creates the first site when the job is the installer\'s initial build', async () => {
    siteExists.mockResolvedValue(false);
    expect(await processSiteBuild({ projectId: 'p1', initial: true })).toBe('default');
    expect(buildSite).toHaveBeenCalledWith('p1');
  });

  it('the installer\'s job without a projectId builds the default project', async () => {
    siteExists.mockResolvedValue(false);
    expect(await processSiteBuild({ projectId: null, initial: true })).toBe('default');
    expect(buildSite).toHaveBeenCalledWith('p1');
  });

  it('skips a deleted or unknown project', async () => {
    findFirst.mockResolvedValue(null);
    expect(await processSiteBuild({ projectId: 'gone', initial: true })).toBe('skipped');
    expect(buildSite).not.toHaveBeenCalled();
  });
});
