import { randomUUID } from 'crypto';
import * as storageService from '../../shared/services/storage.service.js';
import { prisma } from '../../config/database.js';
import { getPaginationParams } from '../../shared/utils/pagination.js';

export const uploadMedia = async (file, userId) => {
  const ext = file.originalname.split('.').pop().toLowerCase();
  const objectName = `${userId}/${randomUUID()}.${ext}`;
  await storageService.uploadFile(file, objectName);
  return prisma.media.create({
    data: {
      user_id: userId,
      filename: objectName,
      original_name: file.originalname,
      mime_type: file.mimetype,
      size: file.size,
      bucket: process.env.MINIO_BUCKET,
      path: objectName,
    },
  });
};

export const listMedia = async (userId, query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const [mediaItems, total] = await Promise.all([
    prisma.media.findMany({ where: { user_id: userId }, skip, take: limit, orderBy: { created_at: 'desc' } }),
    prisma.media.count({ where: { user_id: userId } }),
  ]);
  const media = await Promise.all(
    mediaItems.map(async (m) => ({ ...m, url: await storageService.getFileUrl(m.path) }))
  );
  return { media, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

export const getMediaById = async (id, userId) => {
  const record = await prisma.media.findFirst({ where: { id, user_id: userId } });
  if (!record) return null;
  return { ...record, url: await storageService.getFileUrl(record.path) };
};

export const deleteMedia = async (id, userId) => {
  const record = await getMediaById(id, userId);
  if (!record) return null;
  await storageService.deleteFile(record.path);
  await prisma.media.delete({ where: { id } });
  return record;
};
