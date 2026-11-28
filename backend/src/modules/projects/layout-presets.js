import { prisma } from '../../config/database.js';
import { getSiteLayout } from './layout.js';

// Layout library (prisma/schema/layout-presets.prisma): named header / footer / top-header layouts per
// project. Which one a page shows is decided here, in one place:
//   1. the layout assigned to the page (when it is PUBLISHED and not deleted),
//   2. else the project's default layout of that kind (PUBLISHED),
//   3. else the project's single SiteLayout selection (sites made before the library keep their look).
// A layout's `variant`/`config` are exactly a SiteLayout slot's, so the public renderer needs no change.

export const KINDS = ['TOP_HEADER', 'HEADER', 'FOOTER'];
const SLOT = { TOP_HEADER: 'topHeader', HEADER: 'header', FOOTER: 'footer' };
const LEGACY_NAME = { TOP_HEADER: 'Default top header', HEADER: 'Default header', FOOTER: 'Default footer' };

const fail = (message, status) => Object.assign(new Error(message), { status });
const notFound = () => fail('Layout not found', 404);

const toSlot = (p) => ({ enabled: true, variant: p.variant, config: p.config ?? {} });

/** Layouts the project already had before the library existed become its first, published defaults. */
async function importLegacy(projectId) {
  if ((await prisma.layoutPreset.count({ where: { project_id: projectId } })) > 0) return;
  const legacy = await getSiteLayout(projectId);
  if (!legacy) return;
  for (const kind of KINDS) {
    const slot = legacy[SLOT[kind]];
    if (!slot?.enabled) continue;
    await prisma.layoutPreset.create({
      data: {
        project_id: projectId,
        kind,
        name: LEGACY_NAME[kind],
        status: 'PUBLISHED',
        is_default: true,
        variant: slot.variant,
        config: slot.config ?? {},
      },
    });
  }
}

const own = async (projectId, id) => {
  const row = await prisma.layoutPreset.findFirst({ where: { id, project_id: projectId, deleted_at: null } });
  if (!row) throw notFound();
  return row;
};

const assignedCount = (id) =>
  prisma.builderPage.count({
    where: { deleted_at: null, OR: [{ header_layout_id: id }, { footer_layout_id: id }] },
  });

export async function listLayouts(projectId, kind) {
  await importLegacy(projectId);
  const items = await prisma.layoutPreset.findMany({
    where: { project_id: projectId, deleted_at: null, ...(kind ? { kind } : {}) },
    orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
  });
  return Promise.all(items.map(async (l) => ({ ...l, pages: await assignedCount(l.id) })));
}

export async function getLayout(projectId, id) {
  const row = await own(projectId, id);
  return { ...row, pages: await assignedCount(id) };
}

export async function createLayout(projectId, input, actorId = null) {
  const project = await prisma.project.findFirst({ where: { id: projectId, deleted_at: null }, select: { id: true } });
  if (!project) throw fail('Project not found', 404);
  return prisma.layoutPreset.create({
    data: {
      project_id: projectId,
      kind: input.kind,
      name: input.name,
      status: input.status ?? 'DRAFT',
      variant: input.variant,
      config: input.config ?? {},
      created_by: actorId,
    },
  });
}

export async function updateLayout(projectId, id, patch) {
  const row = await own(projectId, id);
  if (patch.status === 'DRAFT' && row.is_default) {
    throw fail('The default layout cannot be unpublished. Make another layout the default first.', 409);
  }
  const designChanged =
    (patch.variant !== undefined && patch.variant !== row.variant) ||
    (patch.config !== undefined && JSON.stringify(patch.config) !== JSON.stringify(row.config));
  return prisma.layoutPreset.update({
    where: { id },
    data: {
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.variant !== undefined && { variant: patch.variant }),
      ...(patch.config !== undefined && { config: patch.config }),
      ...(designChanged && { version: { increment: 1 } }),
    },
  });
}

/** A copy is a draft and never the default, so duplicating cannot change what the live site shows. */
export async function duplicateLayout(projectId, id, actorId = null) {
  const row = await own(projectId, id);
  return prisma.layoutPreset.create({
    data: {
      project_id: projectId,
      kind: row.kind,
      name: `${row.name} (copy)`.slice(0, 120),
      status: 'DRAFT',
      variant: row.variant,
      config: row.config ?? {},
      created_by: actorId,
    },
  });
}

export async function setDefaultLayout(projectId, id) {
  const row = await own(projectId, id);
  if (row.status !== 'PUBLISHED') throw fail('Publish the layout before making it the default.', 409);
  return prisma.$transaction(async (tx) => {
    await tx.layoutPreset.updateMany({
      where: { project_id: projectId, kind: row.kind, is_default: true, NOT: { id } },
      data: { is_default: false },
    });
    return tx.layoutPreset.update({ where: { id }, data: { is_default: true } });
  });
}

/** Deleting a layout that pages use needs `force`; those pages then fall back to the default. */
export async function deleteLayout(projectId, id, { force = false } = {}) {
  const row = await own(projectId, id);
  if (row.is_default) throw fail('The default layout cannot be deleted. Make another layout the default first.', 409);
  const pages = await assignedCount(id);
  if (pages > 0 && !force) {
    throw Object.assign(fail(`${pages} page${pages === 1 ? ' uses' : 's use'} this layout. Delete anyway to use the default instead.`, 409), { pages });
  }
  await prisma.$transaction([
    prisma.builderPage.updateMany({ where: { header_layout_id: id }, data: { header_layout_id: null } }),
    prisma.builderPage.updateMany({ where: { footer_layout_id: id }, data: { footer_layout_id: null } }),
    prisma.layoutPreset.update({ where: { id }, data: { deleted_at: new Date(), is_default: false } }),
  ]);
  return { deleted: true, pages };
}

/** A page may only point at a layout of its own project and of the right kind. */
export async function assertAssignable(projectId, layoutId, kind) {
  if (!layoutId) return;
  const row = await prisma.layoutPreset.findFirst({
    where: { id: layoutId, project_id: projectId, kind, deleted_at: null },
    select: { id: true },
  });
  if (!row) throw fail(`That ${kind.toLowerCase().replace('_', ' ')} layout does not exist in this project.`, 422);
}

/** The header/footer a page shows, in the same shape as getSiteLayout (null when nothing is chosen anywhere). */
export async function resolveLayoutForPage(page) {
  const projectId = page?.project_id;
  if (!projectId) return null;
  const legacy = await getSiteLayout(projectId);
  const ids = [page.header_layout_id, page.footer_layout_id].filter(Boolean);
  const live = { project_id: projectId, status: 'PUBLISHED', deleted_at: null };
  const [assigned, defaults] = await Promise.all([
    ids.length ? prisma.layoutPreset.findMany({ where: { ...live, id: { in: ids } } }) : [],
    prisma.layoutPreset.findMany({ where: { ...live, is_default: true } }),
  ]);
  const chosen = { TOP_HEADER: null, HEADER: page.header_layout_id, FOOTER: page.footer_layout_id };
  const layout = { ...(legacy ?? {}) };
  for (const kind of KINDS) {
    // The on/off switch of the Layout page is a master switch: a slot switched off there stays off for every
    // page, whatever layouts exist.
    if (legacy?.[SLOT[kind]]?.enabled === false) continue;
    const pick = assigned.find((a) => a.id === chosen[kind] && a.kind === kind) ?? defaults.find((d) => d.kind === kind);
    if (pick) layout[SLOT[kind]] = toSlot(pick);
  }
  return Object.keys(layout).length > 0 ? layout : null;
}

/**
 * The Layout page saves one design per slot. That design is the project's default layout of that kind, so it
 * is written to the library too: the existing default is changed (version up when the design changed), or a
 * published default is created when there is none. A slot switched off is left alone (see resolveLayoutForPage).
 */
export async function syncDefaultsFromSelection(projectId, patch) {
  for (const kind of KINDS) {
    const slot = patch?.[SLOT[kind]];
    if (!slot?.enabled || !slot.variant) continue;
    const config = slot.config ?? {};
    const current = await prisma.layoutPreset.findFirst({
      where: { project_id: projectId, kind, is_default: true, deleted_at: null },
    });
    if (!current) {
      await prisma.layoutPreset.create({
        data: { project_id: projectId, kind, name: LEGACY_NAME[kind], status: 'PUBLISHED', is_default: true, variant: slot.variant, config },
      });
      continue;
    }
    const changed = current.variant !== slot.variant || JSON.stringify(current.config ?? {}) !== JSON.stringify(config);
    if (changed) {
      await prisma.layoutPreset.update({
        where: { id: current.id },
        data: { variant: slot.variant, config, version: { increment: 1 } },
      });
    }
  }
}
