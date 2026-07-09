import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    media: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/config/database.js';
import {
  transitionWorkflow, canAccess, runExpiryJob,
} from '../../src/modules/media/workflow.service.js';

const makeMedia = (status) => ({
  id: 'med001',
  workflow_status: status,
  deleted_at: null,
});

const makePerms = (...actions) => new Set(actions.map((a) => `media:${a}`));

beforeEach(() => {
  vi.clearAllMocks();
  prisma.media.update.mockImplementation(({ data }) =>
    Promise.resolve({ ...makeMedia('DRAFT'), ...data }));
});

describe('transitionWorkflow — transition matrix', () => {
  it('DRAFT → REVIEW succeeds with media:edit permission', async () => {
    prisma.media.findUnique.mockResolvedValue(makeMedia('DRAFT'));
    const result = await transitionWorkflow('med001', 'REVIEW', 'user1', makePerms('edit'));
    expect(result.workflow_status).toBe('REVIEW');
  });

  it('REVIEW → APPROVED succeeds with media:approve permission', async () => {
    prisma.media.findUnique.mockResolvedValue(makeMedia('REVIEW'));
    const result = await transitionWorkflow('med001', 'APPROVED', 'user1', makePerms('approve'));
    expect(result.workflow_status).toBe('APPROVED');
  });

  it('REVIEW → REJECTED succeeds with media:approve permission', async () => {
    prisma.media.findUnique.mockResolvedValue(makeMedia('REVIEW'));
    const result = await transitionWorkflow('med001', 'REJECTED', 'user1', makePerms('approve'));
    expect(result.workflow_status).toBe('REJECTED');
  });

  it('APPROVED → PUBLISHED succeeds with media:publish and sets published_at', async () => {
    prisma.media.findUnique.mockResolvedValue(makeMedia('APPROVED'));
    await transitionWorkflow('med001', 'PUBLISHED', 'user1', makePerms('publish'));
    const updateCall = prisma.media.update.mock.calls[0][0];
    expect(updateCall.data.workflow_status).toBe('PUBLISHED');
    expect(updateCall.data.published_at).toBeInstanceOf(Date);
  });

  it('REVIEW → PUBLISHED throws 422 (invalid transition — must go through APPROVED)', async () => {
    prisma.media.findUnique.mockResolvedValue(makeMedia('REVIEW'));
    await expect(transitionWorkflow('med001', 'PUBLISHED', 'user1', makePerms('publish', 'approve')))
      .rejects.toMatchObject({ status: 422 });
  });

  it('ARCHIVED → DRAFT throws 422 (no transitions from ARCHIVED)', async () => {
    prisma.media.findUnique.mockResolvedValue(makeMedia('ARCHIVED'));
    await expect(transitionWorkflow('med001', 'DRAFT', 'user1', makePerms('edit', 'approve', 'publish')))
      .rejects.toMatchObject({ status: 422 });
  });

  it('throws 403 when user lacks required permission', async () => {
    prisma.media.findUnique.mockResolvedValue(makeMedia('DRAFT'));
    // Only has view, not edit
    await expect(transitionWorkflow('med001', 'REVIEW', 'user1', makePerms('view')))
      .rejects.toMatchObject({ status: 403 });
  });

  it('throws 404 when media not found', async () => {
    prisma.media.findUnique.mockResolvedValue(null);
    await expect(transitionWorkflow('med001', 'REVIEW', 'user1', makePerms('edit')))
      .rejects.toMatchObject({ status: 404 });
  });
});

describe('canAccess — gating logic', () => {
  it('returns true when workflow is disabled regardless of status', () => {
    const media = makeMedia('DRAFT');
    expect(canAccess(media, false, new Set(), false)).toBe(true);
  });

  it('returns true for superAdmin regardless of status', () => {
    const media = makeMedia('DRAFT');
    expect(canAccess(media, true, new Set(), true)).toBe(true);
  });

  it('returns true for PUBLISHED status without special perms', () => {
    const media = makeMedia('PUBLISHED');
    expect(canAccess(media, true, new Set(), false)).toBe(true);
  });

  it('returns true for APPROVED status without special perms', () => {
    const media = makeMedia('APPROVED');
    expect(canAccess(media, true, new Set(), false)).toBe(true);
  });

  it('returns false for DRAFT status without privileged perms', () => {
    const media = makeMedia('DRAFT');
    expect(canAccess(media, true, new Set(['media:view']), false)).toBe(false);
  });

  it('returns true for DRAFT when user has media:edit', () => {
    const media = makeMedia('DRAFT');
    expect(canAccess(media, true, new Set(['media:edit']), false)).toBe(true);
  });

  it('returns true for REVIEW when user has media:approve', () => {
    const media = makeMedia('REVIEW');
    expect(canAccess(media, true, new Set(['media:approve']), false)).toBe(true);
  });
});

describe('runExpiryJob', () => {
  it('updates PUBLISHED media past expires_at to EXPIRED', async () => {
    prisma.media.updateMany.mockResolvedValue({ count: 3 });
    const count = await runExpiryJob();
    expect(count).toBe(3);
    expect(prisma.media.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workflow_status: 'PUBLISHED',
          expires_at: expect.anything(),
          deleted_at: null,
        }),
        data: { workflow_status: 'EXPIRED' },
      }),
    );
  });

  it('returns 0 when no expired items found', async () => {
    prisma.media.updateMany.mockResolvedValue({ count: 0 });
    expect(await runExpiryJob()).toBe(0);
  });
});
