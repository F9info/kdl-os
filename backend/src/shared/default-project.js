/**
 * The default project's id, or null. ONE definition for the whole backend: the project flagged
 * `is_default` (what the admin UI's own default-project lookup uses), else the one whose slug is
 * 'default' (installs that seeded it before the flag was relied on). Skips soft-deleted projects.
 * `client` is a Prisma client or a transaction; without one the shared client is used (loaded on
 * demand, so callers that always pass a client never need a database connection to import this).
 */
export async function getDefaultProjectId(client) {
  const db = client ?? (await import('../config/database.js')).prisma;
  const where = { deleted_at: null };
  const project =
    (await db.project.findFirst({ where: { ...where, is_default: true }, select: { id: true } })) ??
    (await db.project.findFirst({ where: { ...where, slug: 'default' }, select: { id: true } }));
  return project?.id ?? null;
}
