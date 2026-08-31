import { prisma } from '../../config/database.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';

export const listE2eFixtures = async () => {
  // TODO: implement
  return [];
};

export const createE2eFixture = async (data, actorId) => {
  // TODO: implement
  writeActivityAsync({
    actor: actorId,
    module: 'user-management/e2e-fixture',
    action: 'created',
    description: `E2E Fixture created`,
  });
};
