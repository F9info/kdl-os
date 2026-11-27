import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { errorResponse } from '../../shared/utils/response.js';
import { MAX_PHOTO_BYTES } from './images.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { contentProject, recordProject } from '../../middleware/content-project.js';
import {
  listEventsSchema,
  getEventSchema,
  createEventSchema,
  updateEventSchema,
  deleteEventSchema,
  projectQuerySchema,
  saveSyncSchema,
} from './schema.js';
import {
  getPublicFeed,
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  getSync,
  saveSync,
  runSync,
} from './controller.js';
import { getPublic as getPublicDevfest, submitProposal, getImage } from './devfest.controller.js';
import { publicDevfestSchema, publicProposalSchema, imageParamSchema } from './devfest.schema.js';
import devfestRouter from './devfest.routes.js';

const router = Router();

// Public read for the website blocks: visible events, organizers and chapter facts. Read only.
router.get('/public', validate(projectQuerySchema), getPublicFeed);
// Public read of one DevFest edition (the current one, or ?year=) with its visible content.
router.get('/devfest/public', validate(publicDevfestSchema), getPublicDevfest);
// Public: the call for speakers form. Rate limited per IP.
const proposalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many proposals from here. Try again in a few minutes.' },
});
// A proposal comes as JSON, or as multipart form data ("data" = the JSON, "photo" = one image).
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 2, fieldSize: 64 * 1024 },
  fileFilter: (_req, file, cb) =>
    /^image\/(jpeg|png|webp)$/.test(file.mimetype)
      ? cb(null, true)
      : cb(Object.assign(new Error('Use a JPG, PNG or WebP photo.'), { status: 415 })),
});
const takePhoto = (req, res, next) => {
  if (!req.is('multipart/form-data')) return next();
  return photoUpload.single('photo')(req, res, (err) => {
    if (err) {
      const big = err.code === 'LIMIT_FILE_SIZE';
      return errorResponse(res, big ? 'The photo must be 5 MB or smaller.' : err.message, big ? 413 : err.status || 400);
    }
    try {
      req.body = JSON.parse(req.body?.data ?? '{}');
    } catch {
      return errorResponse(res, 'The form could not be read. Please try again.', 400);
    }
    return next();
  });
};
router.post('/devfest/proposals/public', proposalLimiter, takePhoto, validate(publicProposalSchema), submitProposal);
// Public: stored DevFest images (speaker photos, sponsor logos) at a permanent address.
router.get('/public/images/:name', validate(imageParamSchema), getImage);

router.use(authenticate);
router.use(contentProject());
router.param('id', recordProject('chapterEvent'));

// DevFest editions, speakers, sessions, sponsors and team (their own :id checks live in that router).
router.use('/devfest', devfestRouter);

// Chapter sync settings and a manual "Sync now" (mounted before /:id).
router.get('/sync', requirePermission('gdg', 'view'), validate(projectQuerySchema), getSync);
router.put('/sync', requirePermission('gdg', 'edit'), validate(saveSyncSchema), saveSync);
router.post('/sync/run', requirePermission('gdg', 'edit'), validate(projectQuerySchema), runSync);

router.get('/events', requirePermission('gdg', 'view'), validate(listEventsSchema), listEvents);
router.get('/events/:id', requirePermission('gdg', 'view'), validate(getEventSchema), getEvent);
router.post('/events', requirePermission('gdg', 'add'), validate(createEventSchema), createEvent);
router.patch('/events/:id', requirePermission('gdg', 'edit'), validate(updateEventSchema), updateEvent);
router.delete('/events/:id', requirePermission('gdg', 'delete'), validate(deleteEventSchema), deleteEvent);

export default router;
