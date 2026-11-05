import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

const h = vi.hoisted(() => ({ prisma: { builderPage: { findFirst: vi.fn() } } }));
vi.mock('../../config/database.js', () => ({ prisma: h.prisma }));
vi.mock('../../shared/frontend-revalidate.js', () => ({ revalidatePublicPages: vi.fn() }));
vi.mock('../template-engine/site/queue.js', () => ({ enqueueSiteBuild: vi.fn() }));
vi.mock('../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));

const { signPreviewToken, verifyPreviewToken, createPreviewLink, getPreviewPage, previewLinkSchema } =
  await import('./preview.js');

const LIVE = { content: [{ type: 'Hero', props: { id: 'a', title: 'Live' } }] };
const DRAFT = { content: [{ type: 'Hero', props: { id: 'a', title: 'Draft' } }] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('JWT_SECRET', 'x'.repeat(40));
});
afterEach(() => vi.unstubAllEnvs());

describe('preview token', () => {
  it('round trips the page id', () => {
    expect(verifyPreviewToken(signPreviewToken('pg1'))).toBe('pg1');
  });

  it('expires', () => {
    vi.useFakeTimers();
    const token = signPreviewToken('pg1', 1);
    vi.advanceTimersByTime(59 * 60 * 1000);
    expect(verifyPreviewToken(token)).toBe('pg1');
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(verifyPreviewToken(token)).toBeNull();
    vi.useRealTimers();
  });

  it('rejects garbage, tampering, and a different secret', () => {
    expect(verifyPreviewToken('nope')).toBeNull();
    expect(verifyPreviewToken('')).toBeNull();
    const token = signPreviewToken('pg1');
    const [a, b, c] = token.split('.');
    expect(verifyPreviewToken(`${a}.${b}.${c.slice(0, -2)}xx`)).toBeNull();
    vi.stubEnv('JWT_SECRET', 'y'.repeat(40));
    expect(verifyPreviewToken(token)).toBeNull();
  });

  it('a login (access) token signed with JWT_SECRET is NOT accepted as a preview token', () => {
    const access = jwt.sign({ sub: 'pg1', type: 'access' }, 'x'.repeat(40), { expiresIn: '1h' });
    expect(verifyPreviewToken(access)).toBeNull();
  });

  it('a token with another audience or an unsigned (alg none) token is rejected', () => {
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(
      JSON.stringify({ sub: 'pg1', aud: 'page-preview' })
    ).toString('base64url')}.`;
    expect(verifyPreviewToken(none)).toBeNull();
  });
});

describe('previewLinkSchema', () => {
  it('defaults to 24 hours, caps at 7 days, needs whole hours', () => {
    expect(previewLinkSchema.parse({}).ttl_hours).toBe(24);
    expect(previewLinkSchema.safeParse({ ttl_hours: 168 }).success).toBe(true);
    expect(previewLinkSchema.safeParse({ ttl_hours: 169 }).success).toBe(false);
    expect(previewLinkSchema.safeParse({ ttl_hours: 0 }).success).toBe(false);
    expect(previewLinkSchema.safeParse({ ttl_hours: 1.5 }).success).toBe(false);
  });
});

describe('createPreviewLink', () => {
  it('returns a verifiable token and its expiry', async () => {
    h.prisma.builderPage.findFirst.mockResolvedValue({ id: 'pg1' });
    const r = await createPreviewLink('pg1', 2);
    expect(verifyPreviewToken(r.token)).toBe('pg1');
    const hours = (new Date(r.expires_at) - Date.now()) / 3600000;
    expect(hours).toBeGreaterThan(1.9);
    expect(hours).toBeLessThanOrEqual(2);
    expect(h.prisma.builderPage.findFirst.mock.calls[0][0].where).toEqual({ id: 'pg1', deleted_at: null });
  });

  it('404 for a missing or deleted page', async () => {
    h.prisma.builderPage.findFirst.mockResolvedValue(null);
    await expect(createPreviewLink('x')).rejects.toMatchObject({ status: 404 });
  });
});

describe('getPreviewPage', () => {
  const row = (over = {}) => ({
    slug: 's',
    title: 'T',
    data: LIVE,
    draft_data: null,
    seo: null,
    project_id: 'p',
    site_id: 'st',
    status: 'PUBLISHED',
    ...over,
  });

  it('shows the unpublished draft, not the live content', async () => {
    h.prisma.builderPage.findFirst.mockResolvedValue(row({ draft_data: DRAFT }));
    const page = await getPreviewPage(signPreviewToken('pg1'));
    expect(page.data.content[0].props.title).toBe('Draft');
    expect(page).not.toHaveProperty('draft_data');
  });

  it('works for a page that was never published', async () => {
    h.prisma.builderPage.findFirst.mockResolvedValue(row({ status: 'DRAFT' }));
    expect((await getPreviewPage(signPreviewToken('pg1'))).status).toBe('DRAFT');
  });

  it('a bad, expired or deleted-page token all give the same 404', async () => {
    await expect(getPreviewPage('garbage')).rejects.toMatchObject({ status: 404, message: 'Page not found' });
    h.prisma.builderPage.findFirst.mockResolvedValue(null);
    await expect(getPreviewPage(signPreviewToken('gone'))).rejects.toMatchObject({
      status: 404,
      message: 'Page not found',
    });
    expect(h.prisma.builderPage.findFirst).toHaveBeenCalledTimes(1); // the bad token never reached the database
  });
});
