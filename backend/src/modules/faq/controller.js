import * as faqService from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';

export const listFaqs = async (req, res, next) => {
  try {
    const items = await faqService.listFaqs(req.validated.query || {});
    return successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

export const getFaq = async (req, res, next) => {
  try {
    const item = await faqService.getFaqById(req.validated.params.id);
    if (!item) return errorResponse(res, 'FAQ not found', 404);
    return successResponse(res, { item });
  } catch (err) {
    next(err);
  }
};

export const createFaq = async (req, res, next) => {
  try {
    const item = await faqService.createFaq(req.validated.body);
    return successResponse(res, { item }, 201);
  } catch (err) {
    next(err);
  }
};

export const updateFaq = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const item = await faqService.updateFaq(id, req.validated.body);
    if (!item) return errorResponse(res, 'FAQ not found', 404);
    return successResponse(res, { item });
  } catch (err) {
    next(err);
  }
};

export const deleteFaq = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const deleted = await faqService.deleteFaq(id);
    if (!deleted) return errorResponse(res, 'FAQ not found', 404);
    return successResponse(res, { message: 'FAQ deleted' });
  } catch (err) {
    next(err);
  }
};
