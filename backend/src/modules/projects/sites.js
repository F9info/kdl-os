// A project's default site is its main website. Created by the add_sites migration for existing
// projects, and here (lazily) for everything made afterwards.
export const DEFAULT_SITE_SLUG = 'main';

/**
 * Id of the project's default site, creating it when missing. `client` is a Prisma client or a
 * transaction. Returns null when there is no project (pages outside any project have no site).
 */
export async function ensureDefaultSite(client, projectId) {
  if (!projectId) return null;
  const find = () =>
    client.site.findFirst({ where: { project_id: projectId, is_default: true, deleted_at: null }, select: { id: true } });
  const existing = await find();
  if (existing) return existing.id;
  const project = await client.project.findFirst({ where: { id: projectId }, select: { name: true } });
  if (!project) return null;
  try {
    const site = await client.site.create({
      data: { project_id: projectId, type: 'WEBSITE', slug: DEFAULT_SITE_SLUG, name: project.name, is_default: true },
      select: { id: true },
    });
    return site.id;
  } catch (err) {
    // Another request created it first (unique project_id + slug): use theirs.
    if (err.code === 'P2002') return (await find())?.id ?? null;
    throw err;
  }
}

// ── Public routing ───────────────────────────────────────────────────────────

/** "Blog.Example.com:3001" -> "blog.example.com" (hosts are matched case-insensitively, port ignored). */
export const normalizeHost = (host) =>
  String(host ?? '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');

/**
 * Which site a public request is for, in this order:
 *   1. a site whose `domain` equals the request host,
 *   2. the site named by `siteSlug` inside `projectId`,
 *   3. the project's default site.
 * Returns { projectId, siteId, isDefault } (siteId is null when the project has no site row yet),
 * or null when nothing matches (unknown `siteSlug`, or no project to fall back to).
 * `client` is a Prisma client; `projectId` is the caller's fallback project (the default project).
 */
export async function resolvePublicSite(client, { host, siteSlug, projectId } = {}) {
  const hostname = normalizeHost(host);
  if (hostname) {
    const byDomain = await client.site.findFirst({
      where: { domain: hostname, deleted_at: null },
      select: { id: true, project_id: true, is_default: true },
    });
    if (byDomain) return { projectId: byDomain.project_id, siteId: byDomain.id, isDefault: byDomain.is_default };
  }
  if (!projectId) return null;
  if (siteSlug) {
    const bySlug = await client.site.findFirst({
      where: { project_id: projectId, slug: siteSlug, deleted_at: null },
      select: { id: true, is_default: true },
    });
    return bySlug ? { projectId, siteId: bySlug.id, isDefault: bySlug.is_default } : null;
  }
  const fallback = await client.site.findFirst({
    where: { project_id: projectId, is_default: true, deleted_at: null },
    select: { id: true },
  });
  return { projectId, siteId: fallback?.id ?? null, isDefault: true };
}
