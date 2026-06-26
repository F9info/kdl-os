import { prisma } from '../../config/database.js';

export const listSettings = (isAdmin) =>
  prisma.appSetting.findMany({
    where: isAdmin ? {} : { is_public: true },
    orderBy: { key: 'asc' },
  });

export const getSettingByKey = (key) =>
  prisma.appSetting.findUnique({ where: { key } });

export const createSetting = (data) =>
  prisma.appSetting.create({ data });

export const updateSetting = (key, value) =>
  prisma.appSetting.update({ where: { key }, data: { value } });

export const deleteSetting = (key) =>
  prisma.appSetting.delete({ where: { key } });
