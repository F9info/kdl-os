import { Router } from 'express';
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

const router = Router();

// Public read for the website blocks: visible events, organizers and chapter facts. Read only.
router.get('/public', validate(projectQuerySchema), getPublicFeed);

router.use(authenticate);
router.use(contentProject());
router.param('id', recordProject('chapterEvent'));

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
