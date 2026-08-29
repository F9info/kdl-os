import { prisma } from '../../config/database.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';

export const listCustomBlocks = async (projectId, categoryKey) => {
  return prisma.customBlockTemplate.findMany({
    where: { project_id: projectId, category_key: categoryKey, deleted_at: null },
    orderBy: { created_at: 'asc' },
  });
};

export const getCustomBlock = async (id) => {
  return prisma.customBlockTemplate.findFirst({ where: { id, deleted_at: null } });
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

export const updateCustomBlock = async (id, patch, actorId) => {
  const data = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.config !== undefined) data.config = patch.config;
  const block = await prisma.customBlockTemplate.update({ where: { id }, data });
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

export const duplicateCustomBlock = async (id, actorId) => {
  const src = await prisma.customBlockTemplate.findFirst({ where: { id, deleted_at: null } });
  if (!src) throw Object.assign(new Error('Custom block not found'), { status: 404 });
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

export const setDefaultCustomBlock = async (id, actorId) => {
  const block = await prisma.customBlockTemplate.findFirst({ where: { id, deleted_at: null } });
  if (!block) throw Object.assign(new Error('Custom block not found'), { status: 404 });
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

export const deleteCustomBlock = async (id, actorId) => {
  const block = await prisma.customBlockTemplate.update({
    where: { id },
    data: { deleted_at: new Date() },
  });
  writeActivityAsync({
    actor: actorId,
    module: 'custom-blocks',
    action: 'deleted',
    subject_type: 'CustomBlockTemplate',
    subject_id: id,
    description: `Custom block "${block.name}" deleted`,
  });
  return block;
};
