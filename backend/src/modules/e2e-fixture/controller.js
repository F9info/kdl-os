import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { createE2eFixtureSchema } from './schema.js';
import { listE2eFixtures, createE2eFixture } from './service.js';

export const getAll = async (req, res, next) => {
  try {
    const items = await listE2eFixtures();
    successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

export const postCreate = async (req, res, next) => {
  try {
    const data = createE2eFixtureSchema.parse(req.body);
    const item = await createE2eFixture(data, req.user?.id);
    successResponse(res, { item }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
