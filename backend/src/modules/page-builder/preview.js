import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { workingData } from './versions.js';

// Signed preview links (T6.3): a link that shows a page's current WORKING copy (unpublished draft
// included) to someone without a login. Stateless: the token is a short-lived JWT, so there is
// nothing to store. It only ever grants read access to that one page, until it expires.

export const DEFAULT_TTL_HOURS = 24;
export const MAX_TTL_HOURS = 24 * 7;
const AUDIENCE = 'page-preview';

// Own secret derived from JWT_SECRET: a preview token can never be used as a login token, and a
// login token is never accepted here (different key and audience).
const secret = () =>
  createHash('sha256')
    .update(`page-preview:${process.env.JWT_SECRET ?? ''}`)
    .digest('hex');

export const previewLinkSchema = z.object({
  ttl_hours: z.number().int().min(1).max(MAX_TTL_HOURS).default(DEFAULT_TTL_HOURS),
});

const notFound = () => Object.assign(new Error('Page not found'), { status: 404 });

export function signPreviewToken(pageId, ttlHours = DEFAULT_TTL_HOURS) {
  return jwt.sign({}, secret(), {
    algorithm: 'HS256',
    subject: pageId,
    audience: AUDIENCE,
    expiresIn: `${ttlHours}h`,
  });
}

/** The page id a valid, unexpired token was issued for; null for anything else. */
export function verifyPreviewToken(token) {
  try {
    return jwt.verify(token, secret(), { algorithms: ['HS256'], audience: AUDIENCE }).sub ?? null;
  } catch {
    return null;
  }
}

/** Creates a link for an existing page. Returns { token, expires_at }. */
export async function createPreviewLink(pageId, ttlHours = DEFAULT_TTL_HOURS) {
  const page = await prisma.builderPage.findFirst({
    where: { id: pageId, deleted_at: null },
    select: { id: true },
  });
  if (!page) throw notFound();
  const token = signPreviewToken(pageId, ttlHours);
  const { exp } = jwt.decode(token);
  return { token, expires_at: new Date(exp * 1000).toISOString() };
}

/**
 * The page behind a token, shaped like a public page but with the working copy (unpublished draft
 * if there is one) as `data`. Draft pages work too. 404 for a bad, expired or deleted-page token,
 * with the same answer for each so tokens cannot be probed.
 */
export async function getPreviewPage(token) {
  const pageId = verifyPreviewToken(token);
  if (!pageId) throw notFound();
  const page = await prisma.builderPage.findFirst({
    where: { id: pageId, deleted_at: null },
    select: {
      slug: true,
      title: true,
      data: true,
      draft_data: true,
      seo: true,
      project_id: true,
      site_id: true,
      status: true,
    },
  });
  if (!page) throw notFound();
  const { draft_data: _draft, ...rest } = page;
  return { ...rest, data: workingData(page) };
}
