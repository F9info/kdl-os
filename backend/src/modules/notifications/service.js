import { prisma } from '../../config/database.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';

export const listNotificationss = async () => {
  // TODO: implement
  return [];
};

export const createNotifications = async (data, actorId) => {
  // TODO: implement
  writeActivityAsync({
    actor: actorId,
    module: 'user-management/notifications',
    action: 'created',
    description: `Notifications created`,
  });
};
