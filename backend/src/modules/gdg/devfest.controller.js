import * as service from './devfest.service.js';
import * as cfp from './devfest-cfp.service.js';
import { readImage } from './images.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { getDefaultProjectId } from '../../shared/default-project.js';

const notFound = (kind) => `${service.KINDS[kind].label} not found`;

// A known error (bad edition, duplicate slug or year) answers with its own status; anything else is a 500.
const known = (res, next, err) => (err?.status ? errorResponse(res, err.message, err.status) : next(err));

export const getPublic = async (req, res, next) => {
  try {
    const projectId = req.validated.query.project_id ?? (await getDefaultProjectId());
    if (!projectId) return errorResponse(res, 'Project not found', 404);
    return successResponse(res, await service.getPublicDevfest(projectId, req.validated.query.year));
  } catch (err) {
    next(err);
  }
};

/** list / get / create / update / remove handlers for one kind ('editions', 'speakers', ...). */
export function handlersFor(kind) {
  return {
    list: async (req, res, next) => {
      try {
        const q = req.validated.query;
        const items = await service.list(kind, { ...q, project_id: q.project_id ?? req.projectId });
        return successResponse(res, { items });
      } catch (err) {
        next(err);
      }
    },
    get: async (req, res, next) => {
      try {
        const item = await service.get(kind, req.validated.params.id);
        if (!item) return errorResponse(res, notFound(kind), 404);
        return successResponse(res, { item });
      } catch (err) {
        next(err);
      }
    },
    create: async (req, res, next) => {
      try {
        const body = { ...req.validated.body, project_id: req.validated.body.project_id ?? req.projectId };
        const item = await service.create(kind, body, req.user?.id);
        return successResponse(res, { item }, 201);
      } catch (err) {
        known(res, next, err);
      }
    },
    update: async (req, res, next) => {
      try {
        const item = await service.update(kind, req.validated.params.id, req.validated.body, req.user?.id);
        if (!item) return errorResponse(res, notFound(kind), 404);
        return successResponse(res, { item });
      } catch (err) {
        known(res, next, err);
      }
    },
    remove: async (req, res, next) => {
      try {
        const deleted = await service.remove(kind, req.validated.params.id, req.user?.id);
        if (!deleted) return errorResponse(res, notFound(kind), 404);
        return successResponse(res, { message: `${service.KINDS[kind].label} deleted` });
      } catch (err) {
        next(err);
      }
    },
  };
}

// ─── Call for speakers ───────────────────────────────────────────────────────

export const submitProposal = async (req, res, next) => {
  try {
    const body = req.validated.body;
    const projectId = body.project_id ?? (await getDefaultProjectId());
    if (!projectId) return errorResponse(res, 'Project not found', 404);
    await cfp.submitProposal(projectId, body, req.file);
    // The same answer for saved and trapped submissions, so bots learn nothing.
    return successResponse(res, { message: 'Thanks! Your proposal is in.' }, 201);
  } catch (err) {
    known(res, next, err);
  }
};

const proposalNotFound = (res) => errorResponse(res, 'Proposal not found', 404);

export const proposalHandlers = {
  list: async (req, res, next) => {
    try {
      const q = req.validated.query;
      const items = await cfp.listProposals({ ...q, project_id: q.project_id ?? req.projectId });
      return successResponse(res, { items });
    } catch (err) {
      next(err);
    }
  },
  get: async (req, res, next) => {
    try {
      const item = await cfp.getProposal(req.validated.params.id);
      return item ? successResponse(res, { item }) : proposalNotFound(res);
    } catch (err) {
      next(err);
    }
  },
  update: async (req, res, next) => {
    try {
      const item = await cfp.updateProposal(req.validated.params.id, req.validated.body, req.user?.id);
      return item ? successResponse(res, { item }) : proposalNotFound(res);
    } catch (err) {
      known(res, next, err);
    }
  },
  remove: async (req, res, next) => {
    try {
      const done = await cfp.removeProposal(req.validated.params.id, req.user?.id);
      return done ? successResponse(res, { message: 'Proposal deleted' }) : proposalNotFound(res);
    } catch (err) {
      next(err);
    }
  },
  accept: async (req, res, next) => {
    try {
      const item = await cfp.acceptProposal(req.validated.params.id, req.user?.id);
      return item ? successResponse(res, { item }) : proposalNotFound(res);
    } catch (err) {
      known(res, next, err);
    }
  },
};

/** A stored DevFest image (speaker photo, sponsor logo...). Public, cached for a year: names never change. */
export const getImage = async (req, res, next) => {
  try {
    const img = await readImage(req.validated.params.name);
    if (!img) return errorResponse(res, 'Image not found', 404);
    img.stream.on('error', () => (res.headersSent ? res.end() : errorResponse(res, 'Image not found', 404)));
    res.set({
      'Content-Type': img.type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    img.stream.pipe(res);
  } catch (err) {
    if (err?.code === 'ENOENT' || err?.code === 'NoSuchKey' || err?.code === 'NotFound') {
      return errorResponse(res, 'Image not found', 404);
    }
    next(err);
  }
};
