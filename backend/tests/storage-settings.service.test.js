// Storage-settings service unit tests (KDL-236).
// Covers: getStorageSettings, updateStorageSettings, testStorageConnection.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock, encryptMock, decryptMock, invalidateCacheMock, invalidateDriverMock, makeDriverMock } = vi.hoisted(() => ({
  prismaMock: { appSetting: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() } },
  encryptMock: vi.fn((v) => `enc:${v}`),
  decryptMock: vi.fn((v) => v.replace(/^enc:/, '')),
  invalidateCacheMock: vi.fn(),
  invalidateDriverMock: vi.fn(),
  makeDriverMock: vi.fn(),
}));

vi.mock('../src/config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../src/shared/utils/crypto.js', () => ({ encrypt: encryptMock, decrypt: decryptMock }));
vi.mock('../src/shared/services/storage/config.js', () => ({ invalidateStorageCache: invalidateCacheMock }));
vi.mock('../src/shared/services/storage/index.js', () => ({
  invalidateDriverCache: invalidateDriverMock,
  makeDriver: makeDriverMock,
}));

import {
  getStorageSettings,
  updateStorageSettings,
  testStorageConnection,
} from '../src/modules/storage-settings/service.js';

const ROWS = [
  { key: 'storage.provider', value: 'spaces' },
  { key: 'storage.region', value: 'nyc3' },
  { key: 'storage.bucket', value: 'my-bucket' },
  { key: 'storage.access_key', value: 'enc:AKID' },
  { key: 'storage.secret_key', value: 'enc:SECRET' },
];

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.appSetting.findMany.mockResolvedValue(ROWS);
  prismaMock.appSetting.upsert.mockResolvedValue({});
  prismaMock.appSetting.deleteMany.mockResolvedValue({});
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getStorageSettings', () => {
  it('returns masked secrets and isConfigured=true when rows present', async () => {
    const result = await getStorageSettings();
    expect(result.provider).toBe('spaces');
    expect(result.region).toBe('nyc3');
    expect(result.bucket).toBe('my-bucket');
    expect(result.isConfigured).toBe(true);
    // Secrets are masked, not plain
    expect(result.accessKey).toMatch(/\*/);
    expect(result.secretKey).toMatch(/\*/);
  });

  it('returns isConfigured=false when no rows stored', async () => {
    prismaMock.appSetting.findMany.mockResolvedValue([]);
    const result = await getStorageSettings();
    expect(result.isConfigured).toBe(false);
    expect(result.provider).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('updateStorageSettings', () => {
  it('upserts plain fields and encrypts secrets', async () => {
    await updateStorageSettings({
      provider: 's3',
      bucket: 'new-bucket',
      accessKey: 'NEWKEY',
      secretKey: 'NEWSECRET',
    });
    expect(prismaMock.appSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'storage.provider' }, create: expect.objectContaining({ value: 's3' }) }),
    );
    expect(encryptMock).toHaveBeenCalledWith('NEWKEY');
    expect(encryptMock).toHaveBeenCalledWith('NEWSECRET');
    expect(invalidateCacheMock).toHaveBeenCalled();
    expect(invalidateDriverMock).toHaveBeenCalled();
  });

  it('deletes key from DB when value is null', async () => {
    await updateStorageSettings({ endpoint: null });
    expect(prismaMock.appSetting.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'storage.endpoint' } }),
    );
  });

  it('does not encrypt when secret is null', async () => {
    await updateStorageSettings({ accessKey: null });
    expect(encryptMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('testStorageConnection', () => {
  it('calls ensureBucket on driver and returns ok=true', async () => {
    const ensureBucket = vi.fn().mockResolvedValue(undefined);
    makeDriverMock.mockReturnValue({ ensureBucket });
    const result = await testStorageConnection({});
    expect(ensureBucket).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.provider).toBe('spaces');
  });

  it('throws 400 when no provider configured', async () => {
    prismaMock.appSetting.findMany.mockResolvedValue([]);
    await expect(testStorageConnection({})).rejects.toMatchObject({ status: 400 });
  });

  it('throws 422 when ensureBucket fails', async () => {
    makeDriverMock.mockReturnValue({
      ensureBucket: vi.fn().mockRejectedValue(new Error('auth failed')),
    });
    await expect(testStorageConnection({})).rejects.toMatchObject({ status: 422 });
  });

  it('overrides saved config with data passed in', async () => {
    const ensureBucket = vi.fn().mockResolvedValue(undefined);
    makeDriverMock.mockReturnValue({ ensureBucket });
    const result = await testStorageConnection({ provider: 'local' });
    expect(makeDriverMock).toHaveBeenCalledWith(expect.objectContaining({ provider: 'local' }));
    expect(result.ok).toBe(true);
  });

  it('throws 400 on invalid config (makeDriver throws)', async () => {
    makeDriverMock.mockImplementation(() => { throw new Error('Unknown provider'); });
    await expect(testStorageConnection({})).rejects.toMatchObject({ status: 400 });
  });
});
