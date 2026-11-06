import { getDetailPageTypesForProject } from './service.js';
import { convertLegacyDetailGroups, createType, deleteType, createEntry, listEntries, updateEntry, deleteEntry, getPublicEntry } from './entries.service.js';
import { addDetailTypeToHeaderMenu } from '../menus/service.js';
import { getSiteLayout } from '../projects/layout.js';
import { getDefaultProjectId } from '../../shared/default-project.js';
import { prisma } from '../../config/database.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';

const duplicate = (err) => err?.code === 'P2002';

export const getDetailPageTypes = async (req, res, next) => {
  try {
    const items = await getDetailPageTypesForProject(req.query.project_id);
    return successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

export const postType = async (req, res, next) => {
  try {
    const { project_id, ...input } = req.validated.body;
    const type = await createType(project_id, input, req.user.id);
    await addDetailTypeToHeaderMenu(project_id, type);
    return successResponse(res, type, 201);
  } catch (err) {
    if (duplicate(err)) return errorResponse(res, 'A detail page type with that name or URL prefix already exists', 409);
    next(err);
  }
};

export const removeType = async (req, res, next) => {
  try {
    const ok = await deleteType(req.query.project_id, req.params.typeKey, req.user.id);
    return ok ? successResponse(res, { deleted: true }) : errorResponse(res, 'Type not found', 404);
  } catch (err) {
    next(err);
  }
};

export const postEntry = async (req, res, next) => {
  try {
    const { project_id, ...input } = req.validated.body;
    const entry = await createEntry(project_id, req.params.typeKey, input, req.user.id);
    return entry ? successResponse(res, entry, 201) : errorResponse(res, 'Type not found', 404);
  } catch (err) {
    if (duplicate(err)) return errorResponse(res, 'An entry with that slug already exists', 409);
    next(err);
  }
};

export const patchEntry = async (req, res, next) => {
  try {
    const { project_id, ...data } = req.validated.body;
    const entry = await updateEntry(project_id, req.params.id, data);
    return entry ? successResponse(res, entry) : errorResponse(res, 'Entry not found', 404);
  } catch (err) {
    if (duplicate(err)) return errorResponse(res, 'An entry with that slug already exists', 409);
    next(err);
  }
};

export const removeEntry = async (req, res, next) => {
  try {
    const ok = await deleteEntry(req.query.project_id, req.params.id, req.user.id);
    return ok ? successResponse(res, { deleted: true }) : errorResponse(res, 'Entry not found', 404);
  } catch (err) {
    next(err);
  }
};

export const getPublic = async (req, res, next) => {
  try {
    const projectId = req.query.project_id ?? (await getDefaultProjectId(prisma));
    const result = projectId && (await getPublicEntry(projectId, req.params.prefix, req.params.slug));
    if (!result) return errorResponse(res, 'Not found', 404);
    // Same as a /p/<slug> page: the saved header/footer layout rides along so the detail page
    // looks like the rest of the site instead of the template's own default header.
    const layout = result.page ? await getSiteLayout(projectId) : null;
    return successResponse(res, { ...result, page: result.page && { ...result.page, layout, project_id: projectId } });
  } catch (err) {
    next(err);
  }
};

export const getEntries = async (req, res, next) => {
  try {
    const result = await listEntries(req.query.project_id, req.params.typeKey);
    return result ? successResponse(res, result) : errorResponse(res, 'Type not found', 404);
  } catch (err) {
    next(err);
  }
};

// Explicit, write-gated migration of legacy "<X> Detail" page groups into layouts (was a side
// effect of the list GET). Idempotent.
export const postConvertLegacy = async (req, res, next) => {
  try {
    await convertLegacyDetailGroups(req.validated.body.project_id, req.user.id);
    return successResponse(res, { converted: true });
  } catch (err) {
    next(err);
  }
};
