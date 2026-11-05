import { prisma } from '../../config/database.js';
import { SITE_IDENTITY_KEYS } from './schema.js';
import { resolveAssetUrls } from '../identity/service.js';

// Per-site overrides of the project's Application Identity (T5.5): a landing page can carry its own
// name, logo, favicon, colours and description. A missing or empty key inherits the project value.

const notFound = () => Object.assign(new Error('Site not found'), { status: 404 });

const findSite = async (projectId, siteId) => {
  const site = await prisma.site.findFirst({
    where: { id: siteId, project_id: projectId, deleted_at: null },
    select: { id: true, identity_overrides: true },
  });
  if (!site) throw notFound();
  return site;
};

// Only whitelisted keys with a non-empty string survive.
const clean = (raw) =>
  Object.fromEntries(
    SITE_IDENTITY_KEYS.filter((k) => typeof raw?.[k] === 'string' && raw[k].trim() !== '').map((k) => [
      k,
      raw[k].trim(),
    ])
  );

/** Stored overrides as-is (storage paths for assets), {} when none. Used by the admin form. */
export const getSiteIdentity = async (projectId, siteId) =>
  clean((await findSite(projectId, siteId)).identity_overrides);

/**
 * Applies `patch` (validated by siteIdentitySchema): a non-empty value sets the override, an empty
 * string removes it (inherit again), keys not in the patch keep their value.
 */
export async function saveSiteIdentity(projectId, siteId, patch) {
  const site = await findSite(projectId, siteId);
  const next = { ...clean(site.identity_overrides) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === '') delete next[key];
    else next[key] = value;
  }
  await prisma.site.update({
    where: { id: siteId },
    data: { identity_overrides: Object.keys(next).length ? next : null },
  });
  return next;
}

/** What a public page needs: the site's overrides with logo/favicon resolved to fresh URLs; null when none. */
export async function getPublicSiteIdentity(siteId) {
  if (!siteId) return null;
  const site = await prisma.site.findFirst({
    where: { id: siteId, deleted_at: null },
    select: { identity_overrides: true },
  });
  const overrides = clean(site?.identity_overrides);
  return Object.keys(overrides).length ? resolveAssetUrls(overrides) : null;
}
