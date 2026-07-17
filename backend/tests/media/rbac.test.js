import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('../../src/modules/user-management/shared/permission-resolver.js', () => ({
  resolvePermissions: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock('../../src/modules/user-management/shared/activity-logger.js', () => ({
  getClientIp: vi.fn(() => '10.0.0.1'),
  writeActivityAsync: vi.fn(),
}));

import { resolvePermissions } from '../../src/modules/user-management/shared/permission-resolver.js';
import { requirePermission, loadPermissions } from '../../src/middleware/permission.js';
import { manifestSchema } from '../../src/shared/modules/manifest-schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function mockReq(overrides = {}) {
  return { user: { id: 'u1' }, headers: {}, ip: '10.0.0.1', ...overrides };
}

function mockRes() {
  const res = { statusCode: 200, jsonBody: null };
  res.status = vi.fn((code) => { res.statusCode = code; return res; });
  res.json = vi.fn((body) => { res.jsonBody = body; return res; });
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// KDL-MEDIA-12 gate: a role with only view + upload sees just the library +
// upload; every other feature is hidden in UI and 403 from the API.
describe('media module.json — granular per-feature permissions (KDL-MEDIA-12)', () => {
  const manifestPath = join(__dirname, '../../src/modules/media/module.json');
  const manifest = manifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));
  const mediaEntry = manifest.permissions.find((p) => (typeof p === 'string' ? p : p.name) === 'media');

  const REQUIRED_FEATURES = [
    'approve', 'share',
    'upload', 'download', 'preview', 'edit-image',
    'folders', 'collections', 'tags', 'favorites',
    'metadata-edit', 'custom-fields', 'visibility-toggle',
    'soft-delete', 'trash-view', 'restore', 'purge',
    'cloud-import', 'ai-providers', 'capture',
  ];

  it('registers every required per-feature action via the manifest, not a seeder', () => {
    expect(mediaEntry).toBeTruthy();
    for (const action of REQUIRED_FEATURES) {
      expect(mediaEntry.actions).toContain(action);
    }
  });

  it('AI Providers nav entry requires the ai-providers permission, not generic edit', () => {
    const aiNav = manifest.nav.find((n) => n.path === '/admin/media/ai');
    expect(aiNav.permission).toBe('media:ai-providers');
  });
});

describe('requirePermission — media per-feature route guards', () => {
  const VIEW_UPLOAD_ONLY = { bypass: false, permissions: ['media:view', 'media:upload'] };

  it('a view+upload-only role passes the library and upload guards', async () => {
    resolvePermissions.mockResolvedValue(VIEW_UPLOAD_ONLY);
    for (const action of ['view', 'upload']) {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();
      await requirePermission('media', action)(req, res, next);
      expect(next).toHaveBeenCalled();
    }
  });

  it('a view+upload-only role is 403d on every other feature (edit-image, folders, share, approve, ...)', async () => {
    resolvePermissions.mockResolvedValue(VIEW_UPLOAD_ONLY);
    const gatedActions = [
      'approve', 'share',
      'edit-image', 'folders', 'collections', 'tags', 'favorites',
      'metadata-edit', 'custom-fields', 'visibility-toggle', 'soft-delete',
      'trash-view', 'restore', 'purge', 'cloud-import', 'ai-providers', 'preview',
    ];
    for (const action of gatedActions) {
      const res = mockRes();
      const next = vi.fn();
      await requirePermission('media', action)(mockReq(), res, next);
      expect(res.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    }
  });

  it('granting edit-image unblocks the edit-image guard without granting others', async () => {
    resolvePermissions.mockResolvedValue({
      bypass: false,
      permissions: ['media:view', 'media:upload', 'media:edit-image'],
    });

    const okRes = mockRes();
    const okNext = vi.fn();
    await requirePermission('media', 'edit-image')(mockReq(), okRes, okNext);
    expect(okNext).toHaveBeenCalled();

    const stillBlockedRes = mockRes();
    const stillBlockedNext = vi.fn();
    await requirePermission('media', 'share')(mockReq(), stillBlockedRes, stillBlockedNext);
    expect(stillBlockedRes.statusCode).toBe(403);
    expect(stillBlockedNext).not.toHaveBeenCalled();
  });

  it('granting media:share unblocks share routes but not approve', async () => {
    resolvePermissions.mockResolvedValue({
      bypass: false,
      permissions: ['media:view', 'media:share'],
    });

    const shareRes = mockRes();
    const shareNext = vi.fn();
    await requirePermission('media', 'share')(mockReq(), shareRes, shareNext);
    expect(shareNext).toHaveBeenCalled();

    const approveRes = mockRes();
    const approveNext = vi.fn();
    await requirePermission('media', 'approve')(mockReq(), approveRes, approveNext);
    expect(approveRes.statusCode).toBe(403);
    expect(approveNext).not.toHaveBeenCalled();
  });

  it('granting media:approve unblocks workflow transition but not share routes', async () => {
    resolvePermissions.mockResolvedValue({
      bypass: false,
      permissions: ['media:view', 'media:approve'],
    });

    const approveRes = mockRes();
    const approveNext = vi.fn();
    await requirePermission('media', 'approve')(mockReq(), approveRes, approveNext);
    expect(approveNext).toHaveBeenCalled();

    const shareRes = mockRes();
    const shareNext = vi.fn();
    await requirePermission('media', 'share')(mockReq(), shareRes, shareNext);
    expect(shareRes.statusCode).toBe(403);
    expect(shareNext).not.toHaveBeenCalled();
  });

  it('Super Admin bypass reaches every media feature', async () => {
    resolvePermissions.mockResolvedValue({ bypass: true, permissions: [] });
    for (const action of ['view', 'upload', 'edit-image', 'purge', 'ai-providers', 'capture']) {
      const res = mockRes();
      const next = vi.fn();
      await requirePermission('media', action)(mockReq(), res, next);
      expect(next).toHaveBeenCalled();
    }
  });
});

// KDL-242: loadPermissions — populates req.userPermissions without gating so
// transitionWorkflow() in the service can be the single per-transition authority.
describe('loadPermissions — workflow route permission loader (KDL-242)', () => {
  it('sets req.userPermissions and calls next for a user with media:edit only', async () => {
    const perms = { bypass: false, permissions: ['media:edit'] };
    resolvePermissions.mockResolvedValue(perms);
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    await loadPermissions()(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userPermissions).toEqual(perms);
    expect(res.statusCode).toBe(200);
  });

  it('sets req.userPermissions and calls next for a user with no media permissions', async () => {
    const perms = { bypass: false, permissions: [] };
    resolvePermissions.mockResolvedValue(perms);
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    await loadPermissions()(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userPermissions).toEqual(perms);
  });

  it('returns 401 when req.user is absent', async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();
    const next = vi.fn();
    await loadPermissions()(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets req.userPermissions and calls next for a superAdmin bypass', async () => {
    resolvePermissions.mockResolvedValue({ bypass: true, permissions: [] });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    await loadPermissions()(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userPermissions.bypass).toBe(true);
  });
});
