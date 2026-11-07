import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { contentProject, recordProject } from '../../middleware/content-project.js';
import { publicOnlyActive } from '../../middleware/public-only-active.js';
import {
  listTeamMembersSchema,
  getTeamMemberSchema,
  createTeamMemberSchema,
  updateTeamMemberSchema,
  deleteTeamMemberSchema,
} from './schema.js';
import {
  listTeamMembers,
  getTeamMember,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
} from './controller.js';

const router = Router();

// Public read of active members (consumed by page-builder blocks like
// ConstructionFounderProfile, on both the editor canvas and /p/[slug]).
router.get('/public', validate(listTeamMembersSchema), publicOnlyActive, listTeamMembers);

// Admin CRUD — authenticated + RBAC-gated.
router.use(authenticate);
// Project isolation: the project a request names, and the project of the row addressed by :id.
router.use(contentProject());
router.param('id', recordProject('teamMember'));
router.get('/', requirePermission('team', 'view'), validate(listTeamMembersSchema), listTeamMembers);
router.get('/:id', requirePermission('team', 'view'), validate(getTeamMemberSchema), getTeamMember);
router.post('/', requirePermission('team', 'add'), validate(createTeamMemberSchema), createTeamMember);
router.patch(
  '/:id',
  requirePermission('team', 'edit'),
  validate(updateTeamMemberSchema),
  updateTeamMember
);
router.delete(
  '/:id',
  requirePermission('team', 'delete'),
  validate(deleteTeamMemberSchema),
  deleteTeamMember
);

export default router;
