import { prisma } from '../../config/database.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';

export const listExamples = async () => {
  // TODO: implement
  return [];
};

export const createExample = async (data, actorId) => {
  // TODO: implement
  writeActivityAsync({
    actor: actorId,
    module: 'user-management/example',
    action: 'created',
    description: `Example created`,
  });
};
