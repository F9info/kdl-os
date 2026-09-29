import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
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
router.get('/public', validate(listTeamMembersSchema), listTeamMembers);

// Admin CRUD — authenticated + RBAC-gated.
router.use(authenticate);
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
