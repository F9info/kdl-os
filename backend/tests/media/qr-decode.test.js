import { describe, it, expect, vi, beforeEach } from 'vitest';
import QRCode from 'qrcode';
import sharp from 'sharp';

const { prismaMock, minioMock, reindexMock } = vi.hoisted(() => ({
  prismaMock: { media: { findUnique: vi.fn(), update: vi.fn() } },
  minioMock: { getObject: vi.fn() },
  reindexMock: vi.fn(),
}));

vi.mock('../../src/config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../../src/config/minio.js', () => ({ minio: minioMock }));
vi.mock('../../src/modules/media/media-search.service.js', async (importOriginal) => ({
  ...(await importOriginal()),
  enqueueReindex: reindexMock,
}));
// runQrDecodeJob also fires enqueueEmbed via a dynamic import of media-semantic.service.js,
// which statically imports ai-provider.service.js (crypto-backed) — mock it out (mirrors
// ocr.test.js) so this suite never depends on APP_ENCRYPTION_KEY being set in the test env.
vi.mock('../../src/modules/media/ai/ai-provider.service.js', () => ({ getActiveProvider: vi.fn() }));

const { runQrDecodeJob, isQrDecodeSupported } = await import('../../src/modules/media/qr.service.js');
const { buildMediaDoc } = await import('../../src/modules/media/media-search.service.js');

async function* fakeStream(buf) {
  yield buf;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.media.update.mockResolvedValue({});
});

describe('isQrDecodeSupported', () => {
  it('accepts raster images, rejects everything else', () => {
    expect(isQrDecodeSupported('image/png')).toBe(true);
    expect(isQrDecodeSupported('image/jpeg')).toBe(true);
    expect(isQrDecodeSupported('application/pdf')).toBe(false);
    expect(isQrDecodeSupported('video/mp4')).toBe(false);
  });
});

describe('runQrDecodeJob', () => {
  it('throws 422 for unsupported mime type', async () => {
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm1', mime_type: 'video/mp4', path: 'p' });
    await expect(runQrDecodeJob({ mediaId: 'm1' })).rejects.toMatchObject({ status: 422 });
  });

  it('decodes an embedded QR code from a fixture image via the real zxing pipeline', async () => {
    const fixture = await QRCode.toBuffer('KDL-133-fixture-value', { type: 'png', margin: 2, width: 300 });
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm1', mime_type: 'image/png', path: 'u/qr.png' });
    minioMock.getObject.mockResolvedValue(fakeStream(fixture));

    const result = await runQrDecodeJob({ mediaId: 'm1' });

    expect(result.barcodes).toEqual([{ value: 'KDL-133-fixture-value', format: expect.any(String) }]);
    expect(prismaMock.media.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { barcodes: [{ value: 'KDL-133-fixture-value', format: expect.any(String) }] },
    });
    expect(reindexMock).toHaveBeenCalledWith('m1');
  });

  it('stores null when no barcode is found in the image', async () => {
    const plain = await sharp({ create: { width: 100, height: 100, channels: 3, background: { r: 200, g: 200, b: 200 } } })
      .png()
      .toBuffer();
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm2', mime_type: 'image/png', path: 'u/blank.png' });
    minioMock.getObject.mockResolvedValue(fakeStream(plain));

    const result = await runQrDecodeJob({ mediaId: 'm2' });

    expect(result.barcodes).toEqual([]);
    expect(prismaMock.media.update).toHaveBeenCalledWith({ where: { id: 'm2' }, data: { barcodes: null } });
  });
});

describe('D7 gate — search hits decoded barcode content', () => {
  it('buildMediaDoc exposes barcodes so Meili (searchableAttributes includes barcodes) matches it', async () => {
    const doc = await buildMediaDoc({
      id: 'm1',
      original_name: 'poster.png',
      mime_type: 'image/png',
      type: 'IMAGE',
      user_id: 'u1',
      size: 1,
      barcodes: [{ value: 'KDL-133-fixture-value', format: 'QR_CODE' }],
      tags: [],
      meta_values: [],
      folder: null,
      user: null,
      created_at: new Date('2026-07-09T00:00:00Z'),
      updated_at: new Date('2026-07-09T00:00:00Z'),
    });
    expect(doc.barcodes).toBe('KDL-133-fixture-value');

    const src = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('../../src/modules/media/media-search.service.js', import.meta.url), 'utf8'));
    expect(src).toMatch(/searchableAttributes:[^\]]*'barcodes'/s);
  });
});
