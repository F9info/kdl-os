import { getDetailPageTypesForProject } from './service.js';
import { successResponse } from '../../shared/utils/response.js';

export const getDetailPageTypes = async (req, res, next) => {
  try {
    const items = await getDetailPageTypesForProject(req.query.project_id);
    return successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};
