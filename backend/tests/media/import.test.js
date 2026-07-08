import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdmZip from 'adm-zip';

const { getUploadSettingsMock, uploadMediaMock, ensureFolderPathMock } = vi.hoisted(() => ({
  getUploadSettingsMock: vi.fn(),
  uploadMediaMock: vi.fn(),
  ensureFolderPathMock: vi.fn(),
}));
vi.mock('../../src/modules/media/settings.js', () => ({ getUploadSettings: getUploadSettingsMock }));
vi.mock('../../src/modules/media/service.js', () => ({ uploadMedia: uploadMediaMock }));
vi.mock('../../src/modules/media/file-ops.service.js', () => ({ ensureFolderPath: ensureFolderPathMock }));
vi.mock('../../src/modules/user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));

import { validateZipEntry, importZip, isPrivateAddress, assertSafeUrl, importFromUrl } from '../../src/modules/media/import.service.js';

const SETTINGS = {
  allowedMimes: new Set(['image/png', 'image/jpeg', 'application/pdf']),
  maxFileSizeBytes: 1024,
  maxFileSizeMb: 1,
  maxChunkedSizeBytes: 10 * 1024,
  maxChunkedSizeMb: 10,
};

beforeEach(() => {
  vi.clearAllMocks();
  getUploadSettingsMock.mockResolvedValue(SETTINGS);
  uploadMediaMock.mockImplementation(async (file) => ({ id: `m-${file.originalname}` }));
  ensureFolderPathMock.mockResolvedValue('folder-x');
});

// ─── Zip entry validation ────────────────────────────────────────────────────

describe('validateZipEntry', () => {
  const allowed = SETTINGS.allowedMimes;
  const cap = SETTINGS.maxFileSizeBytes;

  it('accepts a whitelisted file within size cap', () => {
    expect(validateZipEntry({ name: 'photos/cat.png', size: 100, isDirectory: false }, allowed, cap))
      .toEqual({ ok: true, mime: 'image/png' });
  });

  it('rejects path traversal and absolute paths', () => {
    expect(validateZipEntry({ name: '../../etc/passwd.png', size: 10, isDirectory: false }, allowed, cap))
      .toMatchObject({ ok: false, reason: 'unsafe path' });
    expect(validateZipEntry({ name: 'a/../../b.png', size: 10, isDirectory: false }, allowed, cap))
      .toMatchObject({ ok: false, reason: 'unsafe path' });
    expect(validateZipEntry({ name: '/abs/evil.png', size: 10, isDirectory: false }, allowed, cap))
      .toMatchObject({ ok: false, reason: 'unsafe path' });
  });

  it('rejects non-whitelisted extensions (incl. nested zips and executables)', () => {
    expect(validateZipEntry({ name: 'run.exe', size: 10, isDirectory: false }, allowed, cap))
      .toMatchObject({ ok: false, reason: expect.stringContaining('not allowed') });
    expect(validateZipEntry({ name: 'inner.zip', size: 10, isDirectory: false }, allowed, cap))
      .toMatchObject({ ok: false, reason: expect.stringContaining('not allowed') });
    expect(validateZipEntry({ name: 'noext', size: 10, isDirectory: false }, allowed, cap))
      .toMatchObject({ ok: false });
  });

  it('rejects oversize entries', () => {
    expect(validateZipEntry({ name: 'big.png', size: cap + 1, isDirectory: false }, allowed, cap))
      .toMatchObject({ ok: false, reason: 'exceeds max file size' });
  });

  it('silently skips directories, hidden and macOS junk files', () => {
    expect(validateZipEntry({ name: 'photos/', size: 0, isDirectory: true }, allowed, cap))
      .toMatchObject({ ok: false, silent: true });
    expect(validateZipEntry({ name: '__MACOSX/._cat.png', size: 10, isDirectory: false }, allowed, cap))
      .toMatchObject({ ok: false, silent: true });
    expect(validateZipEntry({ name: 'photos/.DS_Store', size: 10, isDirectory: false }, allowed, cap))
      .toMatchObject({ ok: false, silent: true });
  });
});

describe('importZip', () => {
  it('imports valid entries into their folder paths and reports skips', async () => {
    const zip = new AdmZip();
    zip.addFile('cat.png', Buffer.from('PNGDATA'));
    zip.addFile('docs/report.pdf', Buffer.from('PDFDATA'));
    zip.addFile('evil.exe', Buffer.from('MZ'));

    const result = await importZip(zip.toBuffer(), { folder_id: 'root-f' }, 'user-1');

    expect(result.imported.map((i) => i.name).sort()).toEqual(['cat.png', 'report.pdf']);
    expect(result.skipped).toEqual([{ entry: 'evil.exe', reason: expect.stringContaining('not allowed') }]);
    // nested path shaped folders under the target
    expect(ensureFolderPathMock).toHaveBeenCalledWith('root-f', ['docs'], 'user-1', expect.any(Map));
    const pdfCall = uploadMediaMock.mock.calls.find(([f]) => f.originalname === 'report.pdf');
    expect(pdfCall[2]).toBe('folder-x');
    expect(pdfCall[0].mimetype).toBe('application/pdf');
  });

  it('rejects corrupt zip buffers', async () => {
    await expect(importZip(Buffer.from('not a zip'), {}, 'user-1'))
      .rejects.toMatchObject({ status: 422, message: expect.stringContaining('zip') });
  });

  it('rejects zips whose declared uncompressed total exceeds the cap', async () => {
    getUploadSettingsMock.mockResolvedValue({ ...SETTINGS, maxChunkedSizeBytes: 5, maxChunkedSizeMb: 0 });
    const zip = new AdmZip();
    zip.addFile('cat.png', Buffer.from('PNGDATA-LONGER-THAN-5'));
    await expect(importZip(zip.toBuffer(), {}, 'user-1'))
      .rejects.toMatchObject({ status: 422, message: expect.stringContaining('total size') });
  });
});

// ─── URL import ──────────────────────────────────────────────────────────────

describe('isPrivateAddress', () => {
  it('flags loopback, RFC1918, link-local and IPv6 private ranges', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '::1', 'fc00::1', 'fd12::1', 'fe80::1', '::ffff:10.0.0.1', '0.0.0.0']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });
  it('passes public addresses', () => {
    for (const ip of ['8.8.8.8', '172.32.0.1', '93.184.216.34', '2606:4700::1111']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});

const publicLookup = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]);

const makeResponse = ({ status = 200, headers = {}, chunks = [Buffer.from('PNG')] } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  body: (async function* () { for (const c of chunks) yield c; })(),
});

describe('assertSafeUrl', () => {
  it('rejects non-http schemes and local hostnames', async () => {
    await expect(assertSafeUrl('ftp://example.com/f.png', { lookup: publicLookup })).rejects.toMatchObject({ status: 422 });
    await expect(assertSafeUrl('file:///etc/passwd', { lookup: publicLookup })).rejects.toMatchObject({ status: 422 });
    await expect(assertSafeUrl('http://localhost/f.png', { lookup: publicLookup })).rejects.toMatchObject({ status: 422 });
    await expect(assertSafeUrl('not a url', { lookup: publicLookup })).rejects.toMatchObject({ status: 422 });
  });

  it('rejects hosts resolving to private addresses', async () => {
    const privateLookup = vi.fn(async () => [{ address: '10.0.0.5', family: 4 }]);
    await expect(assertSafeUrl('http://internal.example.com/f.png', { lookup: privateLookup }))
      .rejects.toMatchObject({ status: 422, message: 'URL host is not allowed' });
  });
});

describe('importFromUrl caps', () => {
  it('rejects disallowed content-type', async () => {
    const fetchImpl = vi.fn(async () => makeResponse({ headers: { 'content-type': 'application/x-msdownload' } }));
    await expect(importFromUrl('https://example.com/f.exe', {}, 'user-1', { fetchImpl, lookup: publicLookup }))
      .rejects.toMatchObject({ status: 422, message: expect.stringContaining('not allowed') });
  });

  it('rejects oversize via content-length header before reading the body', async () => {
    const fetchImpl = vi.fn(async () => makeResponse({
      headers: { 'content-type': 'image/png', 'content-length': String(SETTINGS.maxFileSizeBytes + 1) },
    }));
    await expect(importFromUrl('https://example.com/big.png', {}, 'user-1', { fetchImpl, lookup: publicLookup }))
      .rejects.toMatchObject({ status: 422, message: expect.stringContaining('max size') });
    expect(uploadMediaMock).not.toHaveBeenCalled();
  });

  it('enforces the cap while streaming when content-length lies', async () => {
    const big = Buffer.alloc(600);
    const fetchImpl = vi.fn(async () => makeResponse({
      headers: { 'content-type': 'image/png', 'content-length': '10' },
      chunks: [big, big], // 1200 > 1024 cap
    }));
    await expect(importFromUrl('https://example.com/liar.png', {}, 'user-1', { fetchImpl, lookup: publicLookup }))
      .rejects.toMatchObject({ status: 422, message: expect.stringContaining('max size') });
    expect(uploadMediaMock).not.toHaveBeenCalled();
  });

  it('re-guards every redirect hop (public → private is blocked)', async () => {
    const lookup = vi.fn(async (host) => [{ address: host === 'evil.example.com' ? '169.254.169.254' : '93.184.216.34', family: 4 }]);
    const fetchImpl = vi.fn(async () => makeResponse({ status: 302, headers: { location: 'http://evil.example.com/meta' } }));
    await expect(importFromUrl('https://example.com/redir', {}, 'user-1', { fetchImpl, lookup }))
      .rejects.toMatchObject({ status: 422, message: 'URL host is not allowed' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('imports a valid file through the upload pipeline', async () => {
    const fetchImpl = vi.fn(async () => makeResponse({
      headers: { 'content-type': 'image/png', 'content-disposition': 'attachment; filename="hero.png"' },
      chunks: [Buffer.from('PNG'), Buffer.from('DATA')],
    }));
    const media = await importFromUrl('https://example.com/dl?id=1', { folder_id: 'f1' }, 'user-1', { fetchImpl, lookup: publicLookup });
    expect(media).toEqual({ id: 'm-hero.png' });
    const [file, userId, folderId] = uploadMediaMock.mock.calls[0];
    expect(file.buffer.toString()).toBe('PNGDATA');
    expect(file.mimetype).toBe('image/png');
    expect(userId).toBe('user-1');
    expect(folderId).toBe('f1');
  });
});
