import * as teamService from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';

export const listTeamMembers = async (req, res, next) => {
  try {
    const items = await teamService.listTeamMembers(req.validated.query || {});
    return successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

export const getTeamMember = async (req, res, next) => {
  try {
    const item = await teamService.getTeamMemberById(req.validated.params.id);
    if (!item) return errorResponse(res, 'Team member not found', 404);
    return successResponse(res, { item });
  } catch (err) {
    next(err);
  }
};

export const createTeamMember = async (req, res, next) => {
  try {
    const item = await teamService.createTeamMember(req.validated.body);
    return successResponse(res, { item }, 201);
  } catch (err) {
    next(err);
  }
};

export const updateTeamMember = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const item = await teamService.updateTeamMember(id, req.validated.body);
    if (!item) return errorResponse(res, 'Team member not found', 404);
    return successResponse(res, { item });
  } catch (err) {
    next(err);
  }
};

export const deleteTeamMember = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const deleted = await teamService.deleteTeamMember(id);
    if (!deleted) return errorResponse(res, 'Team member not found', 404);
    return successResponse(res, { message: 'Team member deleted' });
  } catch (err) {
    next(err);
  }
};
