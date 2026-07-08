// Driver contract tests (KDL-119 A7).
// Each driver is tested with mocked underlying SDKs so tests never touch network.
// Asserts: put/get/delete/deleteMany/presign/copy/ensureBucket surface + error shapes.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { minioMethods, s3SendMock, presignMock } = vi.hoisted(() => {
  // Set env before any driver module runs (static const BUCKET = process.env.MINIO_BUCKET)
  process.env.MINIO_BUCKET = process.env.MINIO_BUCKET || 'kdl-media';
  process.env.S3_BUCKET = process.env.S3_BUCKET || 'kdl-media';
  process.env.MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
  process.env.MINIO_PORT = process.env.MINIO_PORT || '9000';
  process.env.MINIO_PUBLIC_ENDPOINT = process.env.MINIO_PUBLIC_ENDPOINT || 'localhost';
  process.env.MINIO_PUBLIC_PORT = process.env.MINIO_PUBLIC_PORT || '9000';
  return {
    minioMethods: {
      putObject: vi.fn(), getObject: vi.fn(), removeObject: vi.fn(),
      presignedGetObject: vi.fn(), copyObject: vi.fn(), bucketExists: vi.fn(), makeBucket: vi.fn(),
    },
    s3SendMock: vi.fn(),
    presignMock: vi.fn(),
  };
});

// ─── MinIO driver ────────────────────────────────────────────────────────────
vi.mock('minio', () => ({
  Client: vi.fn(() => minioMethods),
}));

// ─── S3 driver ───────────────────────────────────────────────────────────────
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({ send: s3SendMock })),
  PutObjectCommand: vi.fn((i) => ({ _type: 'PutObject', ...i })),
  GetObjectCommand: vi.fn((i) => ({ _type: 'GetObject', ...i })),
  DeleteObjectCommand: vi.fn((i) => ({ _type: 'DeleteObject', ...i })),
  DeleteObjectsCommand: vi.fn((i) => ({ _type: 'DeleteObjects', ...i })),
  CopyObjectCommand: vi.fn((i) => ({ _type: 'CopyObject', ...i })),
  CreateBucketCommand: vi.fn((i) => ({ _type: 'CreateBucket', ...i })),
  HeadBucketCommand: vi.fn((i) => ({ _type: 'HeadBucket', ...i })),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: presignMock,
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────
import { minioDriver } from '../../src/shared/services/storage/drivers/minio.driver.js';
import { makeS3Driver } from '../../src/shared/services/storage/drivers/s3.driver.js';

const FILE = { buffer: Buffer.from('data'), size: 4, mimetype: 'image/jpeg' };
const KEY = 'user1/abc.jpg';
const BUCKET = 'kdl-media'; // matches what vi.hoisted set above

beforeEach(() => {
  vi.clearAllMocks();
  // Default minio happy path
  Object.values(minioMethods).forEach((m) => m.mockResolvedValue(undefined));
  minioMethods.presignedGetObject.mockResolvedValue('https://minio/signed');
  minioMethods.bucketExists.mockResolvedValue(true);

  // Default S3 happy path
  s3SendMock.mockResolvedValue({});
  presignMock.mockResolvedValue('https://s3/signed');
});

// ─────────────────────────────────────────────────────────────────────────────
describe('minio driver contract', () => {
  it('put: calls putObject with bucket + key + buffer', async () => {
    await minioDriver.put(FILE, KEY);
    expect(minioMethods.putObject).toHaveBeenCalledWith(BUCKET, KEY, FILE.buffer, FILE.size, { 'Content-Type': FILE.mimetype });
  });

  it('get: returns stream from getObject', async () => {
    const fakeStream = { pipe: vi.fn() };
    minioMethods.getObject.mockResolvedValue(fakeStream);
    const result = await minioDriver.get(KEY);
    expect(minioMethods.getObject).toHaveBeenCalledWith(BUCKET, KEY);
    expect(result).toBe(fakeStream);
  });

  it('delete: calls removeObject', async () => {
    await minioDriver.delete(KEY);
    expect(minioMethods.removeObject).toHaveBeenCalledWith(BUCKET, KEY);
  });

  it('deleteMany: removes each object', async () => {
    await minioDriver.deleteMany(['a.jpg', 'b.jpg']);
    expect(minioMethods.removeObject).toHaveBeenCalledTimes(2);
  });

  it('presign: generates URL against public client', async () => {
    minioMethods.presignedGetObject.mockResolvedValue('https://localhost:9002/signed');
    const url = await minioDriver.presign(KEY, 3600);
    expect(url).toContain('/signed');
    expect(minioMethods.presignedGetObject).toHaveBeenCalledWith(BUCKET, KEY, 3600);
  });

  it('copy: calls copyObject with src/dest', async () => {
    await minioDriver.copy('src.jpg', 'dest.jpg');
    expect(minioMethods.copyObject).toHaveBeenCalledWith(BUCKET, 'dest.jpg', `/${BUCKET}/src.jpg`);
  });

  it('ensureBucket: skips creation when bucket exists', async () => {
    await minioDriver.ensureBucket();
    expect(minioMethods.makeBucket).not.toHaveBeenCalled();
  });

  it('ensureBucket: creates bucket when absent', async () => {
    minioMethods.bucketExists.mockResolvedValue(false);
    await minioDriver.ensureBucket();
    expect(minioMethods.makeBucket).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('s3 driver contract', () => {
  const driver = makeS3Driver();

  it('put: sends PutObjectCommand', async () => {
    await driver.put(FILE, KEY);
    expect(s3SendMock).toHaveBeenCalledWith(expect.objectContaining({ _type: 'PutObject', Key: KEY }));
  });

  it('get: sends GetObjectCommand and returns Body', async () => {
    const body = { read: vi.fn() };
    s3SendMock.mockResolvedValue({ Body: body });
    const result = await driver.get(KEY);
    expect(s3SendMock).toHaveBeenCalledWith(expect.objectContaining({ _type: 'GetObject', Key: KEY }));
    expect(result).toBe(body);
  });

  it('delete: sends DeleteObjectCommand', async () => {
    await driver.delete(KEY);
    expect(s3SendMock).toHaveBeenCalledWith(expect.objectContaining({ _type: 'DeleteObject', Key: KEY }));
  });

  it('deleteMany: sends DeleteObjectsCommand with all keys', async () => {
    await driver.deleteMany(['a.jpg', 'b.jpg']);
    expect(s3SendMock).toHaveBeenCalledWith(expect.objectContaining({
      _type: 'DeleteObjects',
      Delete: { Objects: [{ Key: 'a.jpg' }, { Key: 'b.jpg' }], Quiet: true },
    }));
  });

  it('deleteMany: no-op for empty list', async () => {
    await driver.deleteMany([]);
    expect(s3SendMock).not.toHaveBeenCalled();
  });

  it('presign: calls getSignedUrl and returns URL', async () => {
    presignMock.mockResolvedValue('https://bucket.s3.amazonaws.com/signed');
    const url = await driver.presign(KEY, 900);
    expect(url).toContain('signed');
    expect(presignMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ _type: 'GetObject', Key: KEY }), { expiresIn: 900 });
  });

  it('copy: sends CopyObjectCommand', async () => {
    await driver.copy('src.jpg', 'dest.jpg');
    expect(s3SendMock).toHaveBeenCalledWith(expect.objectContaining({
      _type: 'CopyObject',
      CopySource: `${BUCKET}/src.jpg`,
      Key: 'dest.jpg',
    }));
  });

  it('ensureBucket: skips creation when HeadBucket succeeds', async () => {
    s3SendMock.mockResolvedValue({});
    await driver.ensureBucket();
    expect(s3SendMock).toHaveBeenCalledWith(expect.objectContaining({ _type: 'HeadBucket' }));
    const calls = s3SendMock.mock.calls.map(([c]) => c._type);
    expect(calls).not.toContain('CreateBucket');
  });

  it('ensureBucket: creates bucket on 404', async () => {
    const notFound = Object.assign(new Error('Not found'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } });
    s3SendMock.mockRejectedValueOnce(notFound).mockResolvedValue({});
    await driver.ensureBucket();
    const calls = s3SendMock.mock.calls.map(([c]) => c._type);
    expect(calls).toContain('CreateBucket');
  });

  it('ensureBucket: rethrows non-404 errors', async () => {
    const err = Object.assign(new Error('Access denied'), { name: 'AccessDenied', $metadata: { httpStatusCode: 403 } });
    s3SendMock.mockRejectedValue(err);
    await expect(driver.ensureBucket()).rejects.toThrow('Access denied');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('r2 driver (s3 + custom endpoint)', () => {
  const r2Driver = makeS3Driver({ endpoint: 'https://account.r2.cloudflarestorage.com' });

  it('puts to R2 endpoint', async () => {
    await r2Driver.put(FILE, KEY);
    expect(s3SendMock).toHaveBeenCalledWith(expect.objectContaining({ _type: 'PutObject' }));
  });
});
