import { Router } from 'express';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { recordProject } from '../../middleware/content-project.js';
import {
  editionSchemas,
  speakerSchemas,
  sessionSchemas,
  sponsorSchemas,
  teamSchemas,
  proposalSchemas,
} from './devfest.schema.js';
import { handlersFor, proposalHandlers } from './devfest.controller.js';
import { KINDS } from './devfest.service.js';

// Admin routes for DevFest content, mounted at /api/gdg/devfest after authenticate + contentProject.
// /editions, /speakers, /sessions, /sponsors, /team — each with list, get, create, update, delete.

const SCHEMAS = {
  editions: editionSchemas,
  speakers: speakerSchemas,
  sessions: sessionSchemas,
  sponsors: sponsorSchemas,
  team: teamSchemas,
};

function crudRouter(kind) {
  const r = Router();
  const s = SCHEMAS[kind];
  const h = handlersFor(kind);
  r.param('id', recordProject(KINDS[kind].model));
  r.get('/', requirePermission('gdg', 'view'), validate(s.list), h.list);
  r.get('/:id', requirePermission('gdg', 'view'), validate(s.get), h.get);
  r.post('/', requirePermission('gdg', 'add'), validate(s.create), h.create);
  r.patch('/:id', requirePermission('gdg', 'edit'), validate(s.update), h.update);
  r.delete('/:id', requirePermission('gdg', 'delete'), validate(s.remove), h.remove);
  return r;
}

const router = Router();
for (const kind of Object.keys(SCHEMAS)) router.use(`/${kind}`, crudRouter(kind));

// Talk proposals from the call for speakers form: review, accept (adds speaker + session), delete.
const proposals = Router();
proposals.param('id', recordProject('devfestProposal'));
proposals.get('/', requirePermission('gdg', 'view'), validate(proposalSchemas.list), proposalHandlers.list);
proposals.get('/:id', requirePermission('gdg', 'view'), validate(proposalSchemas.get), proposalHandlers.get);
proposals.patch('/:id', requirePermission('gdg', 'edit'), validate(proposalSchemas.update), proposalHandlers.update);
proposals.post('/:id/accept', requirePermission('gdg', 'add'), validate(proposalSchemas.accept), proposalHandlers.accept);
proposals.delete('/:id', requirePermission('gdg', 'delete'), validate(proposalSchemas.remove), proposalHandlers.remove);
router.use('/proposals', proposals);

export default router;
