import { prisma } from '../config/database.js';
import { assignRoutes, routeResolver, rewritePageLinks } from './page-routes.js';

/**
 * Rewrites the `/p/<slug>` links saved inside a page (or its layout) to the routes the site really serves,
 * for one project: the same function the site generator uses, fed by the project's pages. Unknown slugs stay as written.
 * `prismaClient` can be a test double.
 */
export async function friendlyLinksFor(projectId, value, prismaClient = prisma) {
  if (!projectId || value == null) return value;
  const pages = await prismaClient.builderPage.findMany({
    where: { project_id: projectId, deleted_at: null },
    select: { id: true, slug: true, title: true, route_key: true, status: true, template_id: true },
    orderBy: { created_at: 'asc' },
  });
  return rewritePageLinks(value, routeResolver(assignRoutes(pages)));
}
