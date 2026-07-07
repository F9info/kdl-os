import { prisma } from '../../config/database.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';

export const listIntegrationss = async () => {
  // TODO: implement
  return [];
};

export const createIntegrations = async (data, actorId) => {
  // TODO: implement
  writeActivityAsync({
    actor: actorId,
    module: 'user-management/integrations',
    action: 'created',
    description: `Integrations created`,
  });
};
