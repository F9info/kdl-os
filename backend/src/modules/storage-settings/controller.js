import { successResponse, errorResponse } from '../../shared/utils/response.js';
import {
  getStorageSettings,
  updateStorageSettings,
  testStorageConnection,
} from './service.js';

export const getSettings = async (req, res, next) => {
  try {
    const data = await getStorageSettings();
    return successResponse(res, data);
  } catch (err) {
    next(err);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const data = await updateStorageSettings(req.body);
    return successResponse(res, data);
  } catch (err) {
    next(err);
  }
};

export const testConnection = async (req, res, next) => {
  try {
    const data = await testStorageConnection(req.body || {});
    return successResponse(res, data);
  } catch (err) {
    next(err);
  }
};
