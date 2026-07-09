import { prisma } from '../../config/database.js';

const TRANSITIONS = {
  DRAFT:     { REVIEW: 'edit' },
  REVIEW:    { APPROVED: 'approve', REJECTED: 'approve' },
  REJECTED:  { DRAFT: 'edit', REVIEW: 'edit' },
  APPROVED:  { PUBLISHED: 'publish' },
  PUBLISHED: { ARCHIVED: 'publish', EXPIRED: 'edit' },
  EXPIRED:   { ARCHIVED: 'publish' },
  ARCHIVED:  {},
};

export const transitionWorkflow = async (mediaId, toStatus, userId, userPermissions) => {
  const media = await prisma.media.findUnique({ where: { id: mediaId, deleted_at: null } });
  if (!media) throw Object.assign(new Error('Not found'), { status: 404 });

  const allowed = TRANSITIONS[media.workflow_status] ?? {};
  const requiredAction = allowed[toStatus];
  if (!requiredAction) {
    throw Object.assign(new Error('Invalid transition: ' + media.workflow_status + ' → ' + toStatus), { status: 422 });
  }

  // userPermissions is a Set of "module:action" strings
  if (!userPermissions.has('media:' + requiredAction)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }

  const data = { workflow_status: toStatus };
  if (toStatus === 'PUBLISHED') data.published_at = new Date();

  return prisma.media.update({ where: { id: mediaId }, data });
};

// Check whether a user can access a media item (workflow gating)
// Returns false if workflow_enabled and status is non-accessible for the user's permissions
export const canAccess = (media, workflowEnabled, userPermissions, isSuperAdmin) => {
  if (!workflowEnabled) return true;
  if (isSuperAdmin) return true;
  const accessible = ['PUBLISHED', 'APPROVED'];
  if (userPermissions.has('media:approve') || userPermissions.has('media:publish') || userPermissions.has('media:edit')) return true;
  return accessible.includes(media.workflow_status);
};

// Daily expiry job: mark PUBLISHED media with expires_at in the past as EXPIRED
export const runExpiryJob = async () => {
  const now = new Date();
  const result = await prisma.media.updateMany({
    where: { workflow_status: 'PUBLISHED', expires_at: { lte: now }, deleted_at: null },
    data: { workflow_status: 'EXPIRED' },
  });
  return result.count;
};
