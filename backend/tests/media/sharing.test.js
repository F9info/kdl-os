import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

// ─── Mocks ───────────────────────────────────────────────────────────────────
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    mediaShare: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    media: { findUnique: vi.fn() },
    mediaFolder: { findUnique: vi.fn() },
  },
}));

vi.mock('../../src/shared/services/storage.service.js', () => ({
  getFileUrl: vi.fn().mockResolvedValue('https://cdn/file.png'),
}));

import { prisma } from '../../src/config/database.js';
import {
  createShare, revokeShare, listShares, resolveShare,
} from '../../src/modules/media/sharing.service.js';

const SHARE = {
  id: 'sh001',
  token: 'tok123',
  media_id: 'med001',
  folder_id: null,
  password_hash: null,
  expires_at: null,
  max_downloads: null,
  download_count: 0,
  revoked: false,
  created_by: 'user1',
};

const MEDIA = { id: 'med001', bucket: 'media', path: 'uploads/img.png', deleted_at: null };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.mediaShare.create.mockResolvedValue(SHARE);
  prisma.mediaShare.findUnique.mockResolvedValue(SHARE);
  prisma.mediaShare.update.mockImplementation(({ data }) =>
    Promise.resolve({ ...SHARE, ...data }));
  prisma.mediaShare.findMany.mockResolvedValue([SHARE]);
  prisma.media.findUnique.mockResolvedValue(MEDIA);
});

describe('createShare', () => {
  it('creates a share with a token', async () => {
    const share = await createShare({ media_id: 'med001' }, 'user1');
    expect(prisma.mediaShare.create).toHaveBeenCalledOnce();
    const call = prisma.mediaShare.create.mock.calls[0][0].data;
    expect(typeof call.token).toBe('string');
    expect(call.token.length).toBeGreaterThan(0);
    expect(share).toMatchObject(SHARE);
  });

  it('hashes the password — does not store plaintext', async () => {
    await createShare({ media_id: 'med001', password: 'secret' }, 'user1');
    const call = prisma.mediaShare.create.mock.calls[0][0].data;
    expect(call.password_hash).not.toBe('secret');
    expect(call.password_hash).toBeTruthy();
    const ok = await bcrypt.compare('secret', call.password_hash);
    expect(ok).toBe(true);
  });

  it('throws 400 when neither media_id nor folder_id given', async () => {
    await expect(createShare({}, 'user1')).rejects.toMatchObject({ status: 400 });
  });
});

describe('revokeShare', () => {
  it('revokes the share', async () => {
    await revokeShare('sh001', 'user1');
    expect(prisma.mediaShare.update).toHaveBeenCalledWith({
      where: { id: 'sh001' },
      data: { revoked: true },
    });
  });

  it('throws 403 when actor is not the creator', async () => {
    await expect(revokeShare('sh001', 'otherUser')).rejects.toMatchObject({ status: 403 });
  });

  it('throws 404 when share not found', async () => {
    prisma.mediaShare.findUnique.mockResolvedValue(null);
    await expect(revokeShare('sh001', 'user1')).rejects.toMatchObject({ status: 404 });
  });
});

describe('resolveShare — guard combos', () => {
  it('resolves a valid public share and increments download_count', async () => {
    const result = await resolveShare('tok123');
    expect(prisma.mediaShare.update).toHaveBeenCalledWith({
      where: { id: 'sh001' },
      data: { download_count: { increment: 1 } },
    });
    expect(result.type).toBe('media');
    expect(result.media.id).toBe('med001');
  });

  it('throws 410 for revoked share', async () => {
    prisma.mediaShare.findUnique.mockResolvedValue({ ...SHARE, revoked: true });
    await expect(resolveShare('tok123')).rejects.toMatchObject({ status: 410 });
  });

  it('throws 410 for expired share (expires_at in the past)', async () => {
    prisma.mediaShare.findUnique.mockResolvedValue({
      ...SHARE,
      expires_at: new Date(Date.now() - 1000),
    });
    await expect(resolveShare('tok123')).rejects.toMatchObject({ status: 410 });
  });

  it('throws 410 when max_downloads reached', async () => {
    prisma.mediaShare.findUnique.mockResolvedValue({
      ...SHARE,
      max_downloads: 5,
      download_count: 5,
    });
    await expect(resolveShare('tok123')).rejects.toMatchObject({ status: 410 });
  });

  it('throws 401 when password required but not provided', async () => {
    const hash = await bcrypt.hash('secret', 10);
    prisma.mediaShare.findUnique.mockResolvedValue({ ...SHARE, password_hash: hash });
    await expect(resolveShare('tok123', undefined)).rejects.toMatchObject({ status: 401 });
  });

  it('throws 403 for wrong password', async () => {
    const hash = await bcrypt.hash('secret', 10);
    prisma.mediaShare.findUnique.mockResolvedValue({ ...SHARE, password_hash: hash });
    await expect(resolveShare('tok123', 'wrong')).rejects.toMatchObject({ status: 403 });
  });

  it('resolves successfully with correct password', async () => {
    const hash = await bcrypt.hash('secret', 10);
    prisma.mediaShare.findUnique.mockResolvedValue({ ...SHARE, password_hash: hash });
    const result = await resolveShare('tok123', 'secret');
    expect(result.type).toBe('media');
  });

  it('throws 410 for unknown token', async () => {
    prisma.mediaShare.findUnique.mockResolvedValue(null);
    await expect(resolveShare('unknownToken')).rejects.toMatchObject({ status: 410 });
  });
});
