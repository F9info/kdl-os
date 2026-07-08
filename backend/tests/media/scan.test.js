import { describe, it, expect, vi, beforeEach } from 'vitest';

const { scanBufferMock, isConfiguredMock, notifyMock } = vi.hoisted(() => ({
  scanBufferMock: vi.fn(),
  isConfiguredMock: vi.fn(),
  notifyMock: vi.fn(),
}));

vi.mock('../../src/modules/media/clamd-client.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isClamdConfigured: isConfiguredMock, scanBuffer: scanBufferMock };
});
vi.mock('../../src/modules/media/media-search.service.js', () => ({ enqueueReindex: vi.fn() }));
vi.mock('../../src/modules/notifications/service.js', () => ({ notify: notifyMock }));
vi.mock('../../src/config/minio.js', () => ({
  minio: {
    getObject: vi.fn(async () => (async function* () { yield EICAR_BUFFER; })()),
  },
}));
vi.mock('../../src/config/database.js', () => ({
  prisma: { media: { findFirst: vi.fn(), update: vi.fn() } },
}));

import { prisma } from '../../src/config/database.js';
import { enqueueReindex } from '../../src/modules/media/media-search.service.js';
import { parseClamdResponse } from '../../src/modules/media/clamd-client.js';
import { scanMediaById, quarantineMedia, markScanSkipped } from '../../src/modules/media/scan.service.js';

// Standard EICAR test string — harmless by definition, detected by every AV engine.
const EICAR_BUFFER = Buffer.from(
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
);
const EICAR_SIGNATURE = 'Win.Test.EICAR_HDB-1';

const MEDIA = { id: 'm1', path: 'u1/evil.pdf', original_name: 'evil.pdf', deleted_at: null };

beforeEach(() => {
  vi.clearAllMocks();
  isConfiguredMock.mockReturnValue(true);
  prisma.media.update.mockResolvedValue({});
});

describe('parseClamdResponse (clamd wire protocol)', () => {
  it('parses OK reply as CLEAN', () => {
    expect(parseClamdResponse('stream: OK\0')).toEqual({ status: 'CLEAN', signature: null });
  });

  it('parses EICAR FOUND reply as INFECTED with signature', () => {
    expect(parseClamdResponse(`stream: ${EICAR_SIGNATURE} FOUND\0`)).toEqual({
      status: 'INFECTED',
      signature: EICAR_SIGNATURE,
    });
  });

  it('throws on garbage reply', () => {
    expect(() => parseClamdResponse('INSTREAM size limit exceeded ERROR')).toThrow(/unexpected response/);
  });
});

describe('scanMediaById', () => {
  it('EICAR fixture → INFECTED → quarantined (soft-delete + flag + reindex removal + admin notify)', async () => {
    prisma.media.findFirst.mockResolvedValue(MEDIA);
    scanBufferMock.mockImplementation(async (buffer) => {
      // The mock clamd behaves like the real one: EICAR bytes come back FOUND
      expect(buffer.equals(EICAR_BUFFER)).toBe(true);
      return { status: 'INFECTED', signature: EICAR_SIGNATURE };
    });

    const result = await scanMediaById('m1');

    expect(result).toBe('INFECTED');
    expect(prisma.media.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: expect.objectContaining({
        deleted_at: expect.any(Date),
        scanned_at: expect.any(Date),
        scan_result: 'INFECTED',
      }),
    });
    expect(enqueueReindex).toHaveBeenCalledWith('m1', 'remove');
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({
      to: { role_slug: 'admin' },
      channels: ['IN_APP'],
      inline: expect.objectContaining({ body: expect.stringContaining(EICAR_SIGNATURE) }),
    }));
  });

  it('clean file → scan_result CLEAN, no quarantine', async () => {
    prisma.media.findFirst.mockResolvedValue(MEDIA);
    scanBufferMock.mockResolvedValue({ status: 'CLEAN', signature: null });

    const result = await scanMediaById('m1');

    expect(result).toBe('CLEAN');
    expect(prisma.media.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: expect.objectContaining({ scan_result: 'CLEAN', scanned_at: expect.any(Date) }),
    });
    expect(enqueueReindex).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('clamd unconfigured → SKIPPED, never touches storage', async () => {
    isConfiguredMock.mockReturnValue(false);
    prisma.media.findFirst.mockResolvedValue(MEDIA);

    const result = await scanMediaById('m1');

    expect(result).toBe('SKIPPED');
    expect(scanBufferMock).not.toHaveBeenCalled();
    expect(prisma.media.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: expect.objectContaining({ scan_result: 'SKIPPED' }),
    });
  });

  it('returns null when media row is gone (deleted while queued)', async () => {
    prisma.media.findFirst.mockResolvedValue(null);
    expect(await scanMediaById('gone')).toBeNull();
    expect(scanBufferMock).not.toHaveBeenCalled();
  });

  it('clamd connection error propagates (BullMQ retries handle it)', async () => {
    prisma.media.findFirst.mockResolvedValue(MEDIA);
    scanBufferMock.mockRejectedValue(new Error('clamd timeout after 30000ms'));
    await expect(scanMediaById('m1')).rejects.toThrow(/timeout/);
  });
});

describe('quarantineMedia', () => {
  it('still quarantines when the notifications module is broken', async () => {
    notifyMock.mockRejectedValue(new Error('notifications table missing'));

    await quarantineMedia(MEDIA, EICAR_SIGNATURE); // must not throw

    expect(prisma.media.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ scan_result: 'INFECTED' }),
    }));
  });
});

describe('markScanSkipped', () => {
  it('swallows update failure for media deleted mid-flight', async () => {
    prisma.media.update.mockRejectedValue(new Error('Record not found'));
    await expect(markScanSkipped('gone', 'test')).resolves.toBeUndefined();
  });
});
