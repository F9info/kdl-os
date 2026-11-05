import { prisma } from '../../config/database.js';

// Header/footer design picked on the Layout page, stored once per project (site_layouts) so every
// device and teammate sees the same choice. API shape -> column.
const SLOTS = { topHeader: 'top_header', header: 'header', footer: 'footer' };

const notFound = () => Object.assign(new Error('Project not found'), { status: 404 });

/** { topHeader?, header?, footer? } of {enabled, variant}, or null when nothing was saved yet. */
export async function getSiteLayout(projectId) {
  const row = await prisma.siteLayout.findUnique({ where: { project_id: projectId } });
  if (!row) return null;
  const layout = {};
  for (const [key, col] of Object.entries(SLOTS)) {
    if (row[col] && Object.keys(row[col]).length > 0) layout[key] = row[col];
  }
  return Object.keys(layout).length > 0 ? layout : null;
}

/** Saves the slots present in `patch`; other slots keep their stored value. */
export async function saveSiteLayout(projectId, patch) {
  const project = await prisma.project.findFirst({ where: { id: projectId, deleted_at: null }, select: { id: true } });
  if (!project) throw notFound();
  const data = {};
  for (const [key, col] of Object.entries(SLOTS)) if (patch[key]) data[col] = patch[key];
  await prisma.siteLayout.upsert({
    where: { project_id: projectId },
    update: data,
    create: { project_id: projectId, ...data },
  });
  return getSiteLayout(projectId);
}
