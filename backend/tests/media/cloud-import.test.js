// Phase D8 gate — cloud import: every driver (gdrive/dropbox/onedrive/s3/ftp)
// honors the shared list+download contract against a mocked client, and the
// service layer encrypts credentials, enforces ownership, refreshes OAuth
// tokens on 401, and gates imports on MIME/size settings.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock, uploadMediaMock, getUploadSettingsMock } = vi.hoisted(() => ({
  prismaMock: {
    mediaImportConnection: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
  uploadMediaMock: vi.fn(),
  getUploadSettingsMock: vi.fn(),
}));

vi.mock('../../src/config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../../src/shared/utils/crypto.js', () => ({
  encrypt: vi.fn((s) => `enc:${s}`),
  decrypt: vi.fn((s) => s.replace(/^enc:/, '')),
}));
vi.mock('../../src/modules/media/service.js', () => ({ uploadMedia: uploadMediaMock }));
vi.mock('../../src/modules/media/settings.js', () => ({ getUploadSettings: getUploadSettingsMock }));
vi.mock('../../src/modules/media/import.service.js', () => ({
  EXT_TO_MIME: { jpg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' },
}));
vi.mock('../../src/modules/user-management/shared/activity-logger.js', () => ({
  writeActivityAsync: vi.fn(),
}));

import jwt from 'jsonwebtoken';
import registry, { getImportDriver, IMPORT_PROVIDERS } from '../../src/modules/media/cloud-import/drivers/index.js';
import { buildAuthUrl, verifyState, exchangeCode, refreshTokens } from '../../src/modules/media/cloud-import/oauth.js';
import * as svc from '../../src/modules/media/cloud-import/service.js';

const jsonResponse = (data, { status = 200, headers = {} } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  json: async () => data,
  arrayBuffer: async () => Buffer.from(data ?? '').buffer,
});

const binResponse = (buf, headers = {}) => ({
  ok: true,
  status: 200,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  json: async () => ({}),
  arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
});

beforeEach(() => {
  vi.clearAllMocks();
  getUploadSettingsMock.mockResolvedValue({
    allowedMimes: new Set(['image/jpeg', 'image/png', 'application/pdf']),
    maxFileSizeMb: 1,
    maxFileSizeBytes: 1024 * 1024,
  });
});

// ─── Shared importer contract ────────────────────────────────────────────────

describe('driver registry', () => {
  it('exposes exactly the five D8 providers', () => {
    expect(IMPORT_PROVIDERS.sort()).toEqual(['dropbox', 'ftp', 'gdrive', 'onedrive', 's3']);
  });

  it('every driver implements the same contract surface', () => {
    for (const provider of IMPORT_PROVIDERS) {
      const driver = registry[provider];
      expect(driver.name).toBe(provider);
      expect(['oauth', 'credentials']).toContain(driver.auth);
      expect(typeof driver.list).toBe('function');
      expect(typeof driver.download).toBe('function');
    }
  });

  it('throws 422 on unknown provider', () => {
    expect(() => getImportDriver('gopher')).toThrow(/Unknown import provider/);
  });
});

describe('gdrive driver', () => {
  const creds = { access_token: 'tok' };

  it('list maps files/folders and filters Google-native docs', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      nextPageToken: 'page2',
      files: [
        { id: 'f1', name: 'Photos', mimeType: 'application/vnd.google-apps.folder' },
        { id: 'f2', name: 'cat.jpg', mimeType: 'image/jpeg', size: '123' },
        { id: 'f3', name: 'Doc', mimeType: 'application/vnd.google-apps.document' },
      ],
    }));
    const out = await registry.gdrive.list(creds, {}, { fetchImpl });
    expect(out).toEqual({
      entries: [
        { id: 'f1', name: 'Photos', size: null, mime: null, is_folder: true },
        { id: 'f2', name: 'cat.jpg', size: 123, mime: 'image/jpeg', is_folder: false },
      ],
      cursor: 'page2',
    });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
  });

  it('download returns buffer+name+mime and rejects Google-native files', async () => {
    const buf = Buffer.from('JPEGDATA');
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'f2', name: 'cat.jpg', mimeType: 'image/jpeg' }))
      .mockResolvedValueOnce(binResponse(buf));
    const out = await registry.gdrive.download(creds, 'f2', { fetchImpl });
    expect(out.name).toBe('cat.jpg');
    expect(out.mime).toBe('image/jpeg');
    expect(Buffer.from(out.buffer).toString()).toBe('JPEGDATA');
    expect(out.size).toBe(buf.length);

    const nativeFetch = vi.fn().mockResolvedValue(
      jsonResponse({ id: 'f3', name: 'Doc', mimeType: 'application/vnd.google-apps.document' }),
    );
    await expect(registry.gdrive.download(creds, 'f3', { fetchImpl: nativeFetch }))
      .rejects.toMatchObject({ status: 422 });
  });

  it('surfaces provider 401 as { status: 401 }', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, { status: 401 }));
    await expect(registry.gdrive.list(creds, {}, { fetchImpl })).rejects.toMatchObject({ status: 401 });
  });
});

describe('dropbox driver', () => {
  const creds = { access_token: 'dbx' };

  it('list maps entries and exposes cursor only when has_more', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      entries: [
        { '.tag': 'folder', path_lower: '/photos', name: 'Photos' },
        { '.tag': 'file', path_lower: '/cat.jpg', name: 'cat.jpg', size: 5 },
      ],
      cursor: 'c1',
      has_more: false,
    }));
    const out = await registry.dropbox.list(creds, { path: '' }, { fetchImpl });
    expect(out).toEqual({
      entries: [
        { id: '/photos', name: 'Photos', size: null, mime: null, is_folder: true },
        { id: '/cat.jpg', name: 'cat.jpg', size: 5, mime: null, is_folder: false },
      ],
      cursor: null,
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toMatch(/list_folder$/);
    expect(JSON.parse(init.body)).toEqual({ path: '' });
  });

  it('list with cursor calls list_folder/continue', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ entries: [], cursor: 'c2', has_more: true }));
    const out = await registry.dropbox.list(creds, { cursor: 'c1' }, { fetchImpl });
    expect(fetchImpl.mock.calls[0][0]).toMatch(/list_folder\/continue$/);
    expect(out.cursor).toBe('c2');
  });

  it('download returns buffer and name from dropbox-api-result header', async () => {
    const buf = Buffer.from('DATA');
    const fetchImpl = vi.fn().mockResolvedValue(
      binResponse(buf, { 'dropbox-api-result': JSON.stringify({ name: 'cat.jpg' }) }),
    );
    const out = await registry.dropbox.download(creds, '/cat.jpg', { fetchImpl });
    expect(out).toMatchObject({ name: 'cat.jpg', mime: null, size: 4 });
  });
});

describe('onedrive driver', () => {
  const creds = { access_token: 'od' };

  it('list maps Graph items; cursor is @odata.nextLink passed back verbatim', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      value: [
        { id: 'i1', name: 'Photos', folder: { childCount: 2 } },
        { id: 'i2', name: 'cat.jpg', size: 9, file: { mimeType: 'image/jpeg' } },
      ],
      '@odata.nextLink': 'https://graph.microsoft.com/next',
    }));
    const out = await registry.onedrive.list(creds, {}, { fetchImpl });
    expect(out.entries).toEqual([
      { id: 'i1', name: 'Photos', size: null, mime: null, is_folder: true },
      { id: 'i2', name: 'cat.jpg', size: 9, mime: 'image/jpeg', is_folder: false },
    ]);
    expect(out.cursor).toBe('https://graph.microsoft.com/next');

    await registry.onedrive.list(creds, { cursor: out.cursor }, { fetchImpl });
    expect(fetchImpl.mock.calls[1][0]).toBe('https://graph.microsoft.com/next');
  });

  it('download fetches metadata then content', async () => {
    const buf = Buffer.from('ODDATA');
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'i2', name: 'cat.jpg', file: { mimeType: 'image/jpeg' } }))
      .mockResolvedValueOnce(binResponse(buf));
    const out = await registry.onedrive.download(creds, 'i2', { fetchImpl });
    expect(out).toMatchObject({ name: 'cat.jpg', mime: 'image/jpeg', size: buf.length });
  });

  it('surfaces provider 401 as { status: 401 }', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, { status: 401 }));
    await expect(registry.onedrive.download(creds, 'i2', { fetchImpl })).rejects.toMatchObject({ status: 401 });
  });
});

describe('s3 driver', () => {
  const creds = { access_key_id: 'k', secret_access_key: 's', bucket: 'b' };

  it('list maps CommonPrefixes to folders and Contents to files', async () => {
    const send = vi.fn().mockResolvedValue({
      CommonPrefixes: [{ Prefix: 'photos/' }],
      Contents: [
        { Key: 'docs/' }, // prefix placeholder object — dropped
        { Key: 'cat.jpg', Size: 7 },
      ],
      NextContinuationToken: 'tok2',
    });
    const out = await registry.s3.list(creds, {}, { clientFactory: () => ({ send }) });
    expect(out.entries).toEqual([
      { id: 'photos/', name: 'photos', size: null, mime: null, is_folder: true },
      { id: 'cat.jpg', name: 'cat.jpg', size: 7, mime: null, is_folder: false },
    ]);
    expect(out.cursor).toBe('tok2');
    // folder path gets a trailing-slash prefix + delimiter listing
    await registry.s3.list(creds, { path: 'photos' }, { clientFactory: () => ({ send }) });
    expect(send.mock.calls[1][0].input).toMatchObject({ Bucket: 'b', Prefix: 'photos/', Delimiter: '/' });
  });

  it('download returns buffer, treats octet-stream as unknown mime', async () => {
    const buf = Buffer.from('S3DATA');
    const send = vi.fn().mockResolvedValue({
      Body: { transformToByteArray: async () => new Uint8Array(buf) },
      ContentType: 'application/octet-stream',
    });
    const out = await registry.s3.download(creds, 'photos/cat.jpg', { clientFactory: () => ({ send }) });
    expect(out).toMatchObject({ name: 'cat.jpg', mime: null, size: buf.length });
    expect(Buffer.from(out.buffer).toString()).toBe('S3DATA');
  });
});

describe('ftp driver', () => {
  const creds = { host: 'ftp.example.com', user: 'u', password: 'p' };

  it('list maps directory listing and always closes the client', async () => {
    const client = {
      list: vi.fn().mockResolvedValue([
        { name: 'photos', isDirectory: true },
        { name: 'cat.jpg', isDirectory: false, size: 11 },
      ]),
      close: vi.fn(),
    };
    const out = await registry.ftp.list(creds, { path: '/pub' }, { clientFactory: () => client });
    expect(out).toEqual({
      entries: [
        { id: '/pub/photos', name: 'photos', size: null, mime: null, is_folder: true },
        { id: '/pub/cat.jpg', name: 'cat.jpg', size: 11, mime: null, is_folder: false },
      ],
      cursor: null,
    });
    expect(client.close).toHaveBeenCalled();
  });

  it('download streams into a buffer and closes even on failure', async () => {
    const client = {
      downloadTo: vi.fn(async (sink) => {
        sink.write(Buffer.from('FTP'));
        sink.write(Buffer.from('DATA'));
      }),
      close: vi.fn(),
    };
    const out = await registry.ftp.download(creds, '/pub/cat.jpg', { clientFactory: () => client });
    expect(out).toMatchObject({ name: 'cat.jpg', size: 7 });
    expect(Buffer.from(out.buffer).toString()).toBe('FTPDATA');
    expect(client.close).toHaveBeenCalled();

    const failing = { downloadTo: vi.fn().mockRejectedValue(new Error('boom')), close: vi.fn() };
    await expect(registry.ftp.download(creds, '/x', { clientFactory: () => failing })).rejects.toThrow('boom');
    expect(failing.close).toHaveBeenCalled();
  });
});

// ─── OAuth helper ────────────────────────────────────────────────────────────

describe('oauth', () => {
  beforeEach(() => {
    process.env.GDRIVE_CLIENT_ID = 'cid';
    process.env.GDRIVE_CLIENT_SECRET = 'csec';
  });

  it('buildAuthUrl embeds a state JWT bound to user+provider; verifyState round-trips', () => {
    const { url, state } = buildAuthUrl('gdrive', 'user-1', 'https://app/cb');
    expect(url).toContain('accounts.google.com');
    expect(url).toContain(`state=${encodeURIComponent(state)}`);
    expect(verifyState(state, 'user-1', 'gdrive')).toMatchObject({ sub: 'user-1', provider: 'gdrive' });
    expect(() => verifyState(state, 'user-2', 'gdrive')).toThrow(/does not match/);
    expect(() => verifyState(state, 'user-1', 'dropbox')).toThrow(/does not match/);
    expect(() => verifyState('garbage', 'user-1', 'gdrive')).toThrow(/Invalid or expired/);
  });

  it('rejects a JWT minted for another purpose', () => {
    const forged = jwt.sign({ sub: 'user-1', provider: 'gdrive', purpose: 'other' }, process.env.JWT_SECRET);
    expect(() => verifyState(forged, 'user-1', 'gdrive')).toThrow(/does not match/);
  });

  it('exchangeCode posts the code and normalizes tokens', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      access_token: 'at', refresh_token: 'rt', expires_in: 3600,
    }));
    const tokens = await exchangeCode('gdrive', 'the-code', 'https://app/cb', { fetchImpl });
    expect(tokens).toMatchObject({ access_token: 'at', refresh_token: 'rt' });
    expect(tokens.expires_at).toBeTypeOf('number');
    const body = fetchImpl.mock.calls[0][1].body;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('the-code');
  });

  it('refreshTokens keeps the old refresh_token when the provider omits it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ access_token: 'new-at', expires_in: 60 }));
    const out = await refreshTokens('gdrive', { access_token: 'old', refresh_token: 'rt' }, { fetchImpl });
    expect(out).toMatchObject({ access_token: 'new-at', refresh_token: 'rt' });
  });

  it('refreshTokens 401s when there is no refresh_token', async () => {
    await expect(refreshTokens('gdrive', { access_token: 'old' }, {})).rejects.toMatchObject({ status: 401 });
  });
});

// ─── Service layer ───────────────────────────────────────────────────────────

const CONN_ROW = (over = {}) => ({
  id: 'conn-1',
  user_id: 'user-1',
  provider: 's3',
  label: 'my bucket',
  credentials: `enc:${JSON.stringify({ access_key_id: 'k', secret_access_key: 's', bucket: 'b' })}`,
  ...over,
});

describe('service: connections', () => {
  it('createConnection encrypts credentials and never selects them back', async () => {
    prismaMock.mediaImportConnection.create.mockResolvedValue({ id: 'conn-1', provider: 's3', label: 'b' });
    await svc.createConnection('user-1', {
      provider: 's3',
      label: 'b',
      credentials: { access_key_id: 'k', secret_access_key: 's', bucket: 'b' },
    });
    const arg = prismaMock.mediaImportConnection.create.mock.calls[0][0];
    expect(arg.data.credentials).toBe(`enc:${JSON.stringify({ access_key_id: 'k', secret_access_key: 's', bucket: 'b' })}`);
    expect(arg.select).not.toHaveProperty('credentials');
  });

  it('createConnection rejects OAuth providers (422)', async () => {
    await expect(svc.createConnection('user-1', { provider: 'gdrive', credentials: {} }))
      .rejects.toMatchObject({ status: 422 });
  });

  it('deleteConnection 404s on another user\'s connection', async () => {
    prismaMock.mediaImportConnection.findUnique.mockResolvedValue(CONN_ROW({ user_id: 'someone-else' }));
    await expect(svc.deleteConnection('user-1', 'conn-1')).rejects.toMatchObject({ status: 404 });
    expect(prismaMock.mediaImportConnection.delete).not.toHaveBeenCalled();
  });

  it('browseConnection decrypts creds and delegates to the driver', async () => {
    prismaMock.mediaImportConnection.findUnique.mockResolvedValue(CONN_ROW());
    const send = vi.fn().mockResolvedValue({ Contents: [{ Key: 'cat.jpg', Size: 1 }] });
    const out = await svc.browseConnection('user-1', 'conn-1', {}, { clientFactory: () => ({ send }) });
    expect(out.entries).toHaveLength(1);
    expect(send.mock.calls[0][0].input.Bucket).toBe('b');
  });
});

describe('service: OAuth refresh-and-retry', () => {
  beforeEach(() => {
    process.env.GDRIVE_CLIENT_ID = 'cid';
    process.env.GDRIVE_CLIENT_SECRET = 'csec';
  });

  it('on 401 refreshes tokens, persists them encrypted, and retries once', async () => {
    prismaMock.mediaImportConnection.findUnique.mockResolvedValue(CONN_ROW({
      provider: 'gdrive',
      credentials: `enc:${JSON.stringify({ access_token: 'stale', refresh_token: 'rt' })}`,
    }));
    prismaMock.mediaImportConnection.update.mockResolvedValue({});
    const fetchImpl = vi.fn()
      // 1st drive list -> 401
      .mockResolvedValueOnce(jsonResponse({}, { status: 401 }))
      // token refresh
      .mockResolvedValueOnce(jsonResponse({ access_token: 'fresh', expires_in: 60 }))
      // retried drive list
      .mockResolvedValueOnce(jsonResponse({ files: [{ id: 'f1', name: 'cat.jpg', mimeType: 'image/jpeg' }] }));

    const out = await svc.browseConnection('user-1', 'conn-1', {}, { fetchImpl });
    expect(out.entries).toEqual([{ id: 'f1', name: 'cat.jpg', size: null, mime: 'image/jpeg', is_folder: false }]);
    const persisted = JSON.parse(
      prismaMock.mediaImportConnection.update.mock.calls[0][0].data.credentials.replace(/^enc:/, ''),
    );
    expect(persisted).toMatchObject({ access_token: 'fresh', refresh_token: 'rt' });
    expect(fetchImpl.mock.calls[2][1].headers.Authorization).toBe('Bearer fresh');
  });

  it('does not attempt refresh for credential providers', async () => {
    prismaMock.mediaImportConnection.findUnique.mockResolvedValue(CONN_ROW());
    const send = vi.fn().mockRejectedValue(Object.assign(new Error('denied'), { status: 401 }));
    await expect(svc.browseConnection('user-1', 'conn-1', {}, { clientFactory: () => ({ send }) }))
      .rejects.toMatchObject({ status: 401 });
    expect(prismaMock.mediaImportConnection.update).not.toHaveBeenCalled();
  });
});

describe('service: importFiles', () => {
  const s3deps = (objects) => ({
    clientFactory: () => ({
      send: vi.fn(async (cmd) => {
        const key = cmd.input.Key;
        const obj = objects[key];
        if (!obj) throw new Error(`missing ${key}`);
        return {
          Body: { transformToByteArray: async () => new Uint8Array(obj.buf) },
          ContentType: obj.mime,
        };
      }),
    }),
  });

  beforeEach(() => {
    prismaMock.mediaImportConnection.findUnique.mockResolvedValue(CONN_ROW());
  });

  it('imports allowed files via uploadMedia and reports skipped with reasons', async () => {
    uploadMediaMock.mockResolvedValue({ id: 'media-1' });
    const deps = s3deps({
      'cat.jpg': { buf: Buffer.from('ok'), mime: 'image/jpeg' },
      'virus.exe': { buf: Buffer.from('mz'), mime: 'application/x-msdownload' },
      'huge.png': { buf: Buffer.alloc(2 * 1024 * 1024), mime: 'image/png' },
      'noext': { buf: Buffer.from('??'), mime: null },
    });

    const out = await svc.importFiles('user-1', 'conn-1', {
      files: ['cat.jpg', 'virus.exe', 'huge.png', 'noext', 'gone.jpg'],
      folder_id: 'folder-9',
    }, deps);

    expect(out.imported).toEqual([{ id: 'media-1', name: 'cat.jpg' }]);
    expect(uploadMediaMock).toHaveBeenCalledTimes(1);
    const file = uploadMediaMock.mock.calls[0][0];
    expect(file).toMatchObject({ mimetype: 'image/jpeg', originalname: 'cat.jpg' });
    expect(uploadMediaMock.mock.calls[0][1]).toBe('user-1');
    expect(uploadMediaMock.mock.calls[0][2]).toBe('folder-9');

    expect(out.skipped).toEqual([
      { file: 'virus.exe', reason: expect.stringMatching(/not allowed/) },
      { file: 'huge.png', reason: expect.stringMatching(/max size/) },
      { file: 'noext', reason: expect.stringMatching(/not allowed/) },
      { file: 'gone.jpg', reason: expect.stringMatching(/missing gone.jpg/) },
    ]);
  });

  it('falls back to extension MIME when the provider gives none', async () => {
    uploadMediaMock.mockResolvedValue({ id: 'media-2' });
    const deps = s3deps({ 'scan.pdf': { buf: Buffer.from('%PDF'), mime: null } });
    const out = await svc.importFiles('user-1', 'conn-1', { files: ['scan.pdf'] }, deps);
    expect(out.imported).toHaveLength(1);
    expect(uploadMediaMock.mock.calls[0][0].mimetype).toBe('application/pdf');
  });

  it('an uploadMedia failure skips that file but continues the batch', async () => {
    uploadMediaMock
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValueOnce({ id: 'media-3' });
    const deps = s3deps({
      'a.jpg': { buf: Buffer.from('a'), mime: 'image/jpeg' },
      'b.jpg': { buf: Buffer.from('b'), mime: 'image/jpeg' },
    });
    const out = await svc.importFiles('user-1', 'conn-1', { files: ['a.jpg', 'b.jpg'] }, deps);
    expect(out.imported).toEqual([{ id: 'media-3', name: 'b.jpg' }]);
    expect(out.skipped).toEqual([{ file: 'a.jpg', reason: 'disk full' }]);
  });

  it('404s when the connection belongs to another user', async () => {
    prismaMock.mediaImportConnection.findUnique.mockResolvedValue(CONN_ROW({ user_id: 'other' }));
    await expect(svc.importFiles('user-1', 'conn-1', { files: ['x'] }, {}))
      .rejects.toMatchObject({ status: 404 });
  });
});

describe('service: providers list', () => {
  it('marks OAuth providers unconfigured without env creds, credential providers always available', () => {
    delete process.env.DROPBOX_CLIENT_ID;
    delete process.env.DROPBOX_CLIENT_SECRET;
    const providers = Object.fromEntries(svc.listImportProviders().map((p) => [p.provider, p]));
    expect(providers.s3).toMatchObject({ auth: 'credentials', configured: true });
    expect(providers.ftp).toMatchObject({ auth: 'credentials', configured: true });
    expect(providers.dropbox).toMatchObject({ auth: 'oauth', configured: false });
  });
});
