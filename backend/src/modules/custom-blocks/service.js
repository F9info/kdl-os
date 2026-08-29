import { prisma } from '../../config/database.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';

const NOT_FOUND = () => Object.assign(new Error('Custom block not found'), { status: 404 });

export const listCustomBlocks = async (projectId, categoryKey) => {
  return prisma.customBlockTemplate.findMany({
    where: { project_id: projectId, category_key: categoryKey, deleted_at: null },
    orderBy: { created_at: 'asc' },
  });
};

// No single project to scope by (legacy Page Builder has no project
// context) — scopes to every project the caller can access instead of
// removing scoping entirely, so one tenant's blocks are never listed for
// another. `projectIds: null` means "no restriction" (super-admin bypass,
// set by scopeProjectForList in routes.js); an empty array correctly
// yields zero rows rather than skipping the filter.
export const listCustomBlocksForAccessibleProjects = async (projectIds, categoryKey) => {
  if (Array.isArray(projectIds) && projectIds.length === 0) return [];
  return prisma.customBlockTemplate.findMany({
    where: {
      ...(projectIds ? { project_id: { in: projectIds } } : {}),
      category_key: categoryKey,
      deleted_at: null,
    },
    orderBy: { created_at: 'asc' },
  });
};

export const getCustomBlock = async (id, projectId) => {
  return prisma.customBlockTemplate.findFirst({
    where: { id, project_id: projectId, deleted_at: null },
  });
};

export const createCustomBlock = async (data, actorId) => {
  const block = await prisma.customBlockTemplate.create({
    data: {
      project_id: data.projectId,
      category_key: data.categoryKey,
      name: data.name,
      description: data.description ?? null,
      status: data.status ?? 'DRAFT',
      config: data.config,
      created_by: actorId,
    },
  });
  writeActivityAsync({
    actor: actorId,
    module: 'custom-blocks',
    action: 'created',
    subject_type: 'CustomBlockTemplate',
    subject_id: block.id,
    description: `Custom block "${block.name}" created`,
  });
  return block;
};

// `projectId` here is the caller's already-access-checked project (from the
// requireProject middleware) — scoping the update by both id AND project_id
// means an id belonging to a different project simply matches zero rows
// (Prisma throws P2025, caught by the caller as a 404) instead of silently
// mutating another project's data (KDL security review finding).
export const updateCustomBlock = async (id, projectId, patch, actorId) => {
  const data = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.config !== undefined) data.config = patch.config;
  const { count } = await prisma.customBlockTemplate.updateMany({
    where: { id, project_id: projectId, deleted_at: null },
    data,
  });
  if (count === 0) throw NOT_FOUND();
  const block = await prisma.customBlockTemplate.findFirst({ where: { id } });
  writeActivityAsync({
    actor: actorId,
    module: 'custom-blocks',
    action: 'updated',
    subject_type: 'CustomBlockTemplate',
    subject_id: block.id,
    description: `Custom block "${block.name}" updated`,
  });
  return block;
};

export const duplicateCustomBlock = async (id, projectId, actorId) => {
  const src = await prisma.customBlockTemplate.findFirst({
    where: { id, project_id: projectId, deleted_at: null },
  });
  if (!src) throw NOT_FOUND();
  const copy = await prisma.customBlockTemplate.create({
    data: {
      project_id: src.project_id,
      category_key: src.category_key,
      name: `${src.name} Copy`,
      description: src.description,
      status: 'DRAFT',
      is_default: false,
      config: src.config,
      created_by: actorId,
    },
  });
  writeActivityAsync({
    actor: actorId,
    module: 'custom-blocks',
    action: 'duplicated',
    subject_type: 'CustomBlockTemplate',
    subject_id: copy.id,
    description: `Custom block "${src.name}" duplicated as "${copy.name}"`,
  });
  return copy;
};

export const setDefaultCustomBlock = async (id, projectId, actorId) => {
  const block = await prisma.customBlockTemplate.findFirst({
    where: { id, project_id: projectId, deleted_at: null },
  });
  if (!block) throw NOT_FOUND();
  await prisma.customBlockTemplate.updateMany({
    where: { project_id: block.project_id, category_key: block.category_key, is_default: true },
    data: { is_default: false },
  });
  const updated = await prisma.customBlockTemplate.update({
    where: { id },
    data: { is_default: true },
  });
  writeActivityAsync({
    actor: actorId,
    module: 'custom-blocks',
    action: 'set_default',
    subject_type: 'CustomBlockTemplate',
    subject_id: id,
    description: `Custom block "${updated.name}" set as default`,
  });
  return updated;
};

export const deleteCustomBlock = async (id, projectId, actorId) => {
  const { count } = await prisma.customBlockTemplate.updateMany({
    where: { id, project_id: projectId, deleted_at: null },
    data: { deleted_at: new Date() },
  });
  if (count === 0) throw NOT_FOUND();
  writeActivityAsync({
    actor: actorId,
    module: 'custom-blocks',
    action: 'deleted',
    subject_type: 'CustomBlockTemplate',
    subject_id: id,
    description: `Custom block deleted`,
  });
};
