import { prisma } from '../../config/database.js';

export const listComments = async (mediaId) => {
  return prisma.mediaComment.findMany({
    where: { media_id: mediaId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { created_at: 'asc' },
  });
};

export const createComment = async (mediaId, userId, body) => {
  return prisma.mediaComment.create({
    data: { media_id: mediaId, user_id: userId, body },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
};

export const deleteComment = async (id, userId) => {
  const comment = await prisma.mediaComment.findUnique({ where: { id } });
  if (!comment) throw Object.assign(new Error('Not found'), { status: 404 });
  if (comment.user_id !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });
  return prisma.mediaComment.delete({ where: { id } });
};
