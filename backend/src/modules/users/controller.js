import * as userService from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';

export const listUsers = async (req, res, next) => {
  try {
    const result = await userService.listUsers(req.validated.query || {});
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.validated.params.id);
    if (!user) return errorResponse(res, 'User not found', 404);
    return successResponse(res, { user });
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const exists = await userService.getUserById(id);
    if (!exists) return errorResponse(res, 'User not found', 404);
    if (req.user.role === 'ADMIN') {
      if (req.validated.body.role === 'SUPER_ADMIN') {
        return errorResponse(res, 'ADMIN cannot assign SUPER_ADMIN role', 403);
      }
      if (exists.role === 'SUPER_ADMIN') {
        return errorResponse(res, 'ADMIN cannot modify SUPER_ADMIN users', 403);
      }
    }
    const user = await userService.updateUser(id, req.validated.body);
    return successResponse(res, { user });
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const exists = await userService.getUserById(id);
    if (!exists) return errorResponse(res, 'User not found', 404);
    if (req.user.role !== 'SUPER_ADMIN' && exists.role === 'SUPER_ADMIN') {
      return errorResponse(res, 'Cannot delete SUPER_ADMIN user', 403);
    }
    const user = await userService.softDeleteUser(id);
    return successResponse(res, { user });
  } catch (err) {
    next(err);
  }
};
