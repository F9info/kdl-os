import { describe, it, expect, vi, beforeEach } from 'vitest';

const checkPage = vi.fn();
const publish = vi.fn();
vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../page-builder/service.js', () => ({ checkPage: (...a) => checkPage(...a), publish: (...a) => publish(...a) }));
const { checkLaunch, launchProject } = await import('./launch.js');
const { launchSchema } = await import('./schema.js');

const pages = [
  { id: 'a', slug: 'home', title: 'Home', status: 'DRAFT' },
  { id: 'b', slug: 'about', title: 'About', status: 'PUBLISHED' },
];
const client = (found = pages, project = { id: 'p1', config: {} }) => ({
  project: { findFirst: vi.fn(async () => project) },
  builderPage: { findMany: vi.fn(async () => found) },
  $executeRaw: vi.fn(async () => 1),
});
const ok = { errors: 0, warnings: 0, can_publish: true, issues: [] };
const bad = { errors: 1, warnings: 0, can_publish: false, issues: [{ code: 'X' }] };

beforeEach(() => {
  vi.clearAllMocks();
  checkPage.mockResolvedValue(ok);
  publish.mockResolvedValue({});
});

describe('project launch (T13)', () => {
  it('only looks at pages that would go live (drafts and pages with pending edits)', async () => {
    const c = client();
    await checkLaunch('p1', c);
    expect(c.builderPage.findMany.mock.calls[0][0].where).toMatchObject({
      project_id: 'p1',
      deleted_at: null,
      OR: [{ status: 'DRAFT' }, { draft_data: { not: null } }],
    });
  });

  it('a missing project is a 404', async () => {
    await expect(checkLaunch('x', client([], null))).rejects.toMatchObject({ status: 404 });
  });

  it('refuses to launch while a page has a blocking problem, and publishes nothing', async () => {
    checkPage.mockResolvedValueOnce(bad);
    await expect(launchProject('p1', 'u', {}, client())).rejects.toMatchObject({ status: 422, errors: { code: 'LAUNCH_NOT_READY' } });
    expect(publish).not.toHaveBeenCalled();
  });

  it('publishes every pending page, then records the launch and marks the project active', async () => {
    const c = client();
    const r = await launchProject('p1', 'u', {}, c);
    expect(publish).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ published: 2, launch: { by: 'u', published: 2 } });
    expect(c.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('force publishes despite problems', async () => {
    checkPage.mockResolvedValue(bad);
    await launchProject('p1', 'u', { force: true }, client());
    expect(publish).toHaveBeenCalledWith('a', { force: true }, 'u');
  });

  it('a page that fails to publish is reported, the others still go out, and no launch is recorded', async () => {
    publish.mockRejectedValueOnce(new Error('boom'));
    const c = client();
    await expect(launchProject('p1', 'u', {}, c)).rejects.toMatchObject({
      status: 500,
      errors: { code: 'LAUNCH_PARTIAL', published: ['b'], failed: [{ id: 'a', message: 'boom' }] },
    });
    expect(c.$executeRaw).not.toHaveBeenCalled();
  });

  it('the launch request accepts an empty body or { force }', () => {
    expect(launchSchema.safeParse({ params: { id: 'p' }, body: { force: true } }).success).toBe(true);
    expect(launchSchema.safeParse({ params: { id: 'p' }, body: { force: 'y' } }).success).toBe(false);
  });
});
