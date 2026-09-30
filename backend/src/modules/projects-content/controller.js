import * as service from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';

export const listCaseStudies = async (req, res, next) => {
  try {
    const items = await service.listCaseStudies(req.validated.query || {});
    return successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

export const getCaseStudy = async (req, res, next) => {
  try {
    const item = await service.getCaseStudyById(req.validated.params.id);
    if (!item) return errorResponse(res, 'Case study not found', 404);
    return successResponse(res, { item });
  } catch (err) {
    next(err);
  }
};

export const createCaseStudy = async (req, res, next) => {
  try {
    const item = await service.createCaseStudy(req.validated.body);
    return successResponse(res, { item }, 201);
  } catch (err) {
    next(err);
  }
};

export const updateCaseStudy = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const item = await service.updateCaseStudy(id, req.validated.body);
    if (!item) return errorResponse(res, 'Case study not found', 404);
    return successResponse(res, { item });
  } catch (err) {
    next(err);
  }
};

export const deleteCaseStudy = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const deleted = await service.deleteCaseStudy(id);
    if (!deleted) return errorResponse(res, 'Case study not found', 404);
    return successResponse(res, { message: 'Case study deleted' });
  } catch (err) {
    next(err);
  }
};
