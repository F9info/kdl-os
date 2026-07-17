import { prisma } from '../../config/database.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';

export const listPages = async () => {
  return prisma.builderPage.findMany({
    where: { deleted_at: null },
    orderBy: { updated_at: 'desc' },
    select: { id: true, slug: true, title: true, status: true, updated_at: true },
  });
};

export const getPage = async (id) => {
  return prisma.builderPage.findFirst({ where: { id, deleted_at: null } });
};

export const getPublishedBySlug = async (slug) => {
  return prisma.builderPage.findFirst({
    where: { slug, status: 'PUBLISHED', deleted_at: null },
    select: { slug: true, title: true, data: true },
  });
};

export const createPage = async ({ title, slug, data }, actorId) => {
  const page = await prisma.builderPage.create({
    data: {
      title,
      slug,
      status: 'DRAFT',
      data: data ?? { root: { props: { title } }, content: [], zones: {} },
      created_by: actorId,
    },
  });
  writeActivityAsync({
    actor: actorId,
    module: 'page-builder',
    action: 'created',
    subject_type: 'BuilderPage',
    subject_id: page.id,
    description: `Page "${page.title}" created`,
  });
  return page;
};

export const updatePage = async (id, patch, actorId) => {
  const page = await prisma.builderPage.update({ where: { id }, data: patch });
  writeActivityAsync({
    actor: actorId,
    module: 'page-builder',
    action: patch.status === 'PUBLISHED' ? 'published' : 'updated',
    subject_type: 'BuilderPage',
    subject_id: page.id,
    description: `Page "${page.title}" ${patch.status === 'PUBLISHED' ? 'published' : 'updated'}`,
  });
  return page;
};

export const deletePage = async (id, actorId) => {
  const page = await prisma.builderPage.update({
    where: { id },
    data: { deleted_at: new Date() },
  });
  writeActivityAsync({
    actor: actorId,
    module: 'page-builder',
    action: 'deleted',
    subject_type: 'BuilderPage',
    subject_id: id,
    description: `Page "${page.title}" deleted`,
  });
  return page;
};
