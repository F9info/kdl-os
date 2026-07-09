import * as cloudImportService from './service.js';
import { successResponse } from '../../../shared/utils/response.js';

export const listImportProviders = async (req, res, next) => {
  try {
    return successResponse(res, cloudImportService.listImportProviders());
  } catch (err) {
    next(err);
  }
};

export const listImportConnections = async (req, res, next) => {
  try {
    const connections = await cloudImportService.listConnections(req.user.id);
    return successResponse(res, connections);
  } catch (err) {
    next(err);
  }
};

export const createImportConnection = async (req, res, next) => {
  try {
    const connection = await cloudImportService.createConnection(req.user.id, req.validated.body);
    return successResponse(res, connection, 201);
  } catch (err) {
    next(err);
  }
};

export const deleteImportConnection = async (req, res, next) => {
  try {
    await cloudImportService.deleteConnection(req.user.id, req.validated.params.id);
    return successResponse(res, { deleted: true });
  } catch (err) {
    next(err);
  }
};

export const getImportOAuthUrl = async (req, res, next) => {
  try {
    const { provider } = req.validated.params;
    const { redirect_uri } = req.validated.body;
    const result = cloudImportService.getAuthUrl(provider, req.user.id, redirect_uri);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const completeImportOAuth = async (req, res, next) => {
  try {
    const { provider } = req.validated.params;
    const connection = await cloudImportService.completeOAuth(req.user.id, provider, req.validated.body);
    return successResponse(res, connection, 201);
  } catch (err) {
    next(err);
  }
};

export const browseImportConnection = async (req, res, next) => {
  try {
    const { path, cursor } = req.validated.query ?? {};
    const result = await cloudImportService.browseConnection(req.user.id, req.validated.params.id, { path, cursor });
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const importFromConnection = async (req, res, next) => {
  try {
    const result = await cloudImportService.importFiles(req.user.id, req.validated.params.id, req.validated.body);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};
