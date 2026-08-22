import { prisma } from '../../config/database.js';

// Resolves starter credit balance in µc (1 credit = 1_000_000 µc).
// Priority: PROJECT_STARTER_CREDITS env var → credits.new_project_seed_mc app setting → 10 credits.
async function getSeedMc() {
  const envVal = process.env.PROJECT_STARTER_CREDITS;
  if (envVal !== undefined && envVal !== '') {
    try {
      const parsed = BigInt(envVal.trim());
      return parsed > 0n ? parsed : 0n;
    } catch {
      // Invalid value — fall through to app setting
    }
  }
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: 'credits.new_project_seed_mc' } });
    const v = row ? BigInt(row.value) : 10_000_000n;
    return v > 0n ? v : 0n;
  } catch {
    return 10_000_000n;
  }
}

export async function listProjects() {
  return prisma.project.findMany({
    where: { deleted_at: null },
    orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
    select: { id: true, name: true, slug: true, is_default: true },
  });
}

export async function getProject(id) {
  const project = await prisma.project.findFirst({
    where: { id, deleted_at: null },
    select: { id: true, name: true, slug: true, is_default: true },
  });
  if (!project) {
    const err = new Error('Project not found');
    err.status = 404;
    throw err;
  }
  return project;
}

export async function createProject({ name, slug, is_default, actorId }) {
  const existing = await prisma.project.findUnique({ where: { slug } });
  if (existing) {
    const err = new Error(`A project with slug "${slug}" already exists`);
    err.status = 409;
    throw err;
  }

  // Resolve seed amount before opening the transaction so the DB query
  // does not hold the transaction open longer than needed.
  const seedMc = await getSeedMc();

  const project = await prisma.$transaction(async (tx) => {
    if (is_default) {
      await tx.project.updateMany({ where: { is_default: true }, data: { is_default: false } });
    }
    const proj = await tx.project.create({
      data: { name, slug, is_default: is_default ?? false, created_by: actorId ?? null },
      select: { id: true, name: true, slug: true, is_default: true },
    });

    // Seed credits atomically so a project can never exist with no balance.
    if (seedMc > 0n) {
      await tx.creditBalance.create({ data: { project_id: proj.id, balance_mc: seedMc } });
      await tx.creditLedgerEntry.create({
        data: {
          project_id: proj.id,
          entry_type: 'GRANT',
          amount_mc: seedMc,
          balance_after_mc: seedMc,
          source: 'system',
          reason: 'new_project_seed',
          idempotency_key: `new_project_seed:${proj.id}`,
          actor_id: actorId ?? null,
        },
      });
    }

    return proj;
  });

  return project;
}

export async function updateProject(id, { name, slug, is_default }) {
  const existing = await prisma.project.findFirst({ where: { id, deleted_at: null } });
  if (!existing) {
    const err = new Error('Project not found');
    err.status = 404;
    throw err;
  }

  if (slug && slug !== existing.slug) {
    const conflict = await prisma.project.findUnique({ where: { slug } });
    if (conflict) {
      const err = new Error(`A project with slug "${slug}" already exists`);
      err.status = 409;
      throw err;
    }
  }

  return prisma.$transaction(async (tx) => {
    if (is_default === true) {
      await tx.project.updateMany({ where: { is_default: true }, data: { is_default: false } });
    }
    return tx.project.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(is_default !== undefined && { is_default }),
      },
      select: { id: true, name: true, slug: true, is_default: true },
    });
  });
}

export async function deleteProject(id) {
  const existing = await prisma.project.findFirst({ where: { id, deleted_at: null } });
  if (!existing) {
    const err = new Error('Project not found');
    err.status = 404;
    throw err;
  }
  if (existing.is_default) {
    const err = new Error('Cannot delete the default project');
    err.status = 409;
    throw err;
  }
  await prisma.project.update({ where: { id }, data: { deleted_at: new Date() } });
}
