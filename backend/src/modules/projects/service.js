import { prisma } from '../../config/database.js';

// Default starter credit grant for new projects: 100 credits (100_000_000 µc).
// Covers: brand.inference (≤10 cr) + guidelines PDF (5 cr) + ≥15 collateral renders @ 5 cr each.
// Exported so tests can assert headroom arithmetic without re-implementing the constant.
export const DEFAULT_SEED_MC = 100_000_000n;

// Resolves starter credit balance in µc (1 credit = 1_000_000 µc).
// Priority: PROJECT_STARTER_CREDITS env var → credits.new_project_seed_mc app setting → 100 credits.
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
    const v = row ? BigInt(row.value) : DEFAULT_SEED_MC;
    return v > 0n ? v : 0n;
  } catch {
    return DEFAULT_SEED_MC;
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

// Returns only the fields needed for access-control checks.
// Used by the requireProject shared middleware; not intended for API responses.
export async function getProjectForAccessCheck(id) {
  const project = await prisma.project.findFirst({
    where: { id, deleted_at: null },
    select: {
      id: true,
      created_by: true,
      is_shared: true,
      members: { select: { user_id: true, role: true } },
    },
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

    // Grant the creator an owner-role membership row so ownership and membership
    // stay in sync and the membership model can be the single access-control source.
    if (actorId) {
      await tx.projectMember.create({
        data: { project_id: proj.id, user_id: actorId, role: 'owner' },
      });
    }

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
