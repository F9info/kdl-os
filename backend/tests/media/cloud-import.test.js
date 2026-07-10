// Phase D8 gate: importer contract mocked — no test ever touches network,
// AWS, an FTP server, or a real Google/Dropbox/Microsoft OAuth endpoint.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { prismaMock, uploadMediaMock, s3SendMock, ftpMocks } = vi.hoisted(() => ({
  prismaMock: {
    mediaImportConnection: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
  uploadMediaMock: vi.fn(),
  s3SendMock: vi.fn(),
  ftpMocks: {
    access: vi.fn(),
    list: vi.fn(),
    downloadTo: vi.fn(),
    close: vi.fn(),
  },
}));

vi.mock('../../src/config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../../src/modules/media/service.js', () => ({ uploadMedia: uploadMediaMock }));
vi.mock('../../src/modules/user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));
// Simple, deterministic, round-trippable stand-in for AES-GCM — same technique
// ai-provider.test.js uses so tests don't depend on APP_ENCRYPTION_KEY.
vi.mock('../../src/shared/utils/crypto.js', () => ({
  encrypt: (s) => Buffer.from(String(s)).toString('base64'),
  decrypt: (s) => Buffer.from(String(s), 'base64').toString('utf8'),
}));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({ send: s3SendMock })),
  ListObjectsV2Command: vi.fn((i) => ({ _type: 'ListObjectsV2', ...i })),
  GetObjectCommand: vi.fn((i) => ({ _type: 'GetObject', ...i })),
}));
vi.mock('basic-ftp', () => ({
  Client: vi.fn(() => ftpMocks),
  FileType: { Unknown: 0, File: 1, Directory: 2, SymbolicLink: 3 },
}));

const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64');

import registry, { getImportDriver, OAUTH_PROVIDERS, MANUAL_PROVIDERS } from '../../src/modules/media/import/drivers/index.js';
import * as svc from '../../src/modules/media/import/cloud-import.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Driver registry contract ────────────────────────────────────────────────

describe('import driver registry contract', () => {
  it('exports all 5 v1 providers with the required shape', () => {
    expect(Object.keys(registry).sort()).toEqual(['dropbox', 'ftp', 'google-drive', 'onedrive', 's3']);
    for (const [name, d] of Object.entries(registry)) {
      expect(d.provider, `${name}.provider`).toBe(name);
      expect(typeof d.oauth, `${name}.oauth`).toBe('boolean');
      expect(d.credentialsSchema, `${name}.credentialsSchema`).toBeDefined();
      expect(typeof d.isAppConfigured, `${name}.isAppConfigured`).toBe('function');
      expect(typeof d.list, `${name}.list`).toBe('function');
      expect(typeof d.download, `${name}.download`).toBe('function');
      if (d.oauth) {
        expect(typeof d.getAuthUrl, `${name}.getAuthUrl`).toBe('function');
        expect(typeof d.exchangeCode, `${name}.exchangeCode`).toBe('function');
      }
    }
  });

  it('splits oauth vs manual providers correctly', () => {
    expect(OAUTH_PROVIDERS.sort()).toEqual(['dropbox', 'google-drive', 'onedrive']);
    expect(MANUAL_PROVIDERS.sort()).toEqual(['ftp', 's3']);
  });

  it('getImportDriver throws for unknown provider', () => {
    expect(() => getImportDriver('nope')).toThrow('Unknown import provider');
  });

  it('manual driver credential schemas reject empty objects', () => {
    expect(registry.s3.credentialsSchema.safeParse({}).success).toBe(false);
    expect(registry.ftp.credentialsSchema.safeParse({}).success).toBe(false);
  });
});

// ─── OAuth drivers: HTTP calls (fetch mocked) ────────────────────────────────

describe('oauth driver HTTP calls (fetch mocked)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('google-drive: exchangeCode posts form body and returns tokens', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'a', refresh_token: 'r' }) });
    const out = await registry['google-drive'].exchangeCode({ code: 'c', redirectUri: 'https://cb' });
    expect(out).toEqual({ access_token: 'a', refresh_token: 'r' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(init.body.toString()).toContain('code=c');
  });

  it('google-drive: exchangeCode throws when no refresh_token returned', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'a' }) });
    await expect(registry['google-drive'].exchangeCode({ code: 'c', redirectUri: 'https://cb' }))
      .rejects.toThrow('did not return a refresh_token');
  });

  it('google-drive: list refreshes token then lists files, mapping folders', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'fresh' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            { id: 'f1', name: 'Docs', mimeType: 'application/vnd.google-apps.folder' },
            { id: 'f2', name: 'a.png', mimeType: 'image/png', size: '100' },
          ],
          nextPageToken: 'p2',
        }),
      });
    const out = await registry['google-drive'].list({ credentials: { access_token: 'x', refresh_token: 'rt' }, folderId: null, cursor: null });
    expect(out.items).toEqual([
      { id: 'f1', name: 'Docs', mimeType: 'application/vnd.google-apps.folder', size: null, isFolder: true },
      { id: 'f2', name: 'a.png', mimeType: 'image/png', size: 100, isFolder: false },
    ]);
    expect(out.nextCursor).toBe('p2');
  });

  it('google-drive: download rejects native Google Docs types', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'fresh' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'Doc', mimeType: 'application/vnd.google-apps.document' }) });
    await expect(registry['google-drive'].download({ credentials: { refresh_token: 'rt' }, fileId: 'f1' }))
      .rejects.toMatchObject({ status: 422 });
  });

  it('dropbox: list_folder maps entries and continue cursor', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'fresh' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: [
            { '.tag': 'folder', name: 'Photos', path_lower: '/photos' },
            { '.tag': 'file', name: 'a.jpg', path_lower: '/a.jpg', size: 42 },
          ],
          has_more: true,
          cursor: 'cur1',
        }),
      });
    const out = await registry.dropbox.list({ credentials: { refresh_token: 'rt' }, folderId: '', cursor: null });
    expect(out.items).toEqual([
      { id: '/photos', name: 'Photos', mimeType: null, size: null, isFolder: true },
      { id: '/a.jpg', name: 'a.jpg', mimeType: null, size: 42, isFolder: false },
    ]);
    expect(out.nextCursor).toBe('cur1');
  });

  it('dropbox: download reads Dropbox-API-Result header for filename', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'fresh' }) })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: (h) => (h === 'dropbox-api-result' ? JSON.stringify({ name: 'a.jpg' }) : null) },
        arrayBuffer: async () => Buffer.from('data'),
      });
    const out = await registry.dropbox.download({ credentials: { refresh_token: 'rt' }, fileId: '/a.jpg' });
    expect(out.filename).toBe('a.jpg');
    expect(out.buffer).toEqual(Buffer.from('data'));
  });

  it('onedrive: list maps folder/file items via graph', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'fresh' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [{ id: 'i1', name: 'Sub', folder: {} }, { id: 'i2', name: 'b.pdf', file: { mimeType: 'application/pdf' }, size: 10 }] }),
      });
    const out = await registry.onedrive.list({ credentials: { refresh_token: 'rt' }, folderId: null, cursor: null });
    expect(out.items).toEqual([
      { id: 'i1', name: 'Sub', mimeType: null, size: null, isFolder: true },
      { id: 'i2', name: 'b.pdf', mimeType: 'application/pdf', size: 10, isFolder: false },
    ]);
  });
});

// ─── S3 driver (AWS SDK mocked) ───────────────────────────────────────────────

describe('s3 driver (SDK mocked)', () => {
  const creds = { access_key_id: 'ak', secret_access_key: 'sk', bucket: 'b' };

  it('list maps CommonPrefixes to folders and Contents to files', async () => {
    s3SendMock.mockResolvedValueOnce({
      CommonPrefixes: [{ Prefix: 'photos/' }],
      Contents: [{ Key: 'a.png', Size: 10 }],
      IsTruncated: true,
      NextContinuationToken: 'tok2',
    });
    const out = await registry.s3.list({ credentials: creds, folderId: '', cursor: null });
    expect(out.items).toEqual([
      { id: 'photos/', name: 'photos', mimeType: null, size: null, isFolder: true },
      { id: 'a.png', name: 'a.png', mimeType: null, size: 10, isFolder: false },
    ]);
    expect(out.nextCursor).toBe('tok2');
  });

  it('download streams the object body into a buffer', async () => {
    const { Readable } = await import('node:stream');
    s3SendMock.mockResolvedValueOnce({ Body: Readable.from([Buffer.from('hello')]), ContentType: 'text/plain' });
    const out = await registry.s3.download({ credentials: creds, fileId: 'a.txt' });
    expect(out.buffer).toEqual(Buffer.from('hello'));
    expect(out.filename).toBe('a.txt');
    expect(out.mimeType).toBe('text/plain');
  });
});

// ─── FTP driver (basic-ftp mocked) ────────────────────────────────────────────

describe('ftp driver (basic-ftp mocked)', () => {
  const creds = { host: 'h', user: 'u', password: 'p' };

  it('list maps FileInfo entries, skipping unknown types', async () => {
    ftpMocks.list.mockResolvedValueOnce([
      { name: 'sub', type: 2, size: 0 },
      { name: 'a.txt', type: 1, size: 5 },
      { name: 'weird', type: 0, size: 0 },
    ]);
    const out = await registry.ftp.list({ credentials: creds, folderId: '/' });
    expect(out.items).toEqual([
      { id: '/sub', name: 'sub', mimeType: null, size: null, isFolder: true },
      { id: '/a.txt', name: 'a.txt', mimeType: null, size: 5, isFolder: false },
    ]);
    expect(ftpMocks.access).toHaveBeenCalledWith(expect.objectContaining({ host: 'h', user: 'u' }));
    expect(ftpMocks.close).toHaveBeenCalled();
  });

  it('download writes into an in-memory buffer (never touches disk)', async () => {
    ftpMocks.downloadTo.mockImplementationOnce(async (writable) => {
      writable.write(Buffer.from('ftp-data'));
      writable.end();
    });
    const out = await registry.ftp.download({ credentials: creds, fileId: '/a.txt' });
    expect(out.buffer).toEqual(Buffer.from('ftp-data'));
    expect(out.filename).toBe('a.txt');
  });

  it('closes the client even when access() throws', async () => {
    ftpMocks.access.mockRejectedValueOnce(new Error('econnrefused'));
    await expect(registry.ftp.list({ credentials: creds, folderId: '/' })).rejects.toThrow('econnrefused');
    expect(ftpMocks.close).toHaveBeenCalled();
  });
});

// ─── cloud-import.service.js ──────────────────────────────────────────────────

describe('getProviderStatus', () => {
  const savedEnv = { ...process.env };
  afterEach(() => { process.env = { ...savedEnv }; });

  it('flags oauth providers as unconfigured when env is unset, manual providers always configured', () => {
    delete process.env.GOOGLE_DRIVE_CLIENT_ID;
    delete process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const statuses = svc.getProviderStatus();
    expect(statuses.find((s) => s.provider === 'google-drive')).toEqual({ provider: 'google-drive', oauth: true, configured: false });
    expect(statuses.find((s) => s.provider === 's3')).toEqual({ provider: 's3', oauth: false, configured: true });
    expect(statuses.find((s) => s.provider === 'ftp')).toEqual({ provider: 'ftp', oauth: false, configured: true });
  });

  it('flags an oauth provider configured once its client id/secret env vars are set', () => {
    process.env.DROPBOX_CLIENT_ID = 'id';
    process.env.DROPBOX_CLIENT_SECRET = 'secret';
    expect(svc.getProviderStatus().find((s) => s.provider === 'dropbox').configured).toBe(true);
  });
});

describe('connection CRUD', () => {
  it('createManualConnection validates credentials against the driver schema and encrypts them before storing', async () => {
    prismaMock.mediaImportConnection.create.mockResolvedValue({ id: 'c1', provider: 's3', label: 'My bucket' });
    const out = await svc.createManualConnection('u1', {
      provider: 's3', label: 'My bucket',
      credentials: { access_key_id: 'ak', secret_access_key: 'sk', bucket: 'b' },
    });
    expect(out.id).toBe('c1');
    const call = prismaMock.mediaImportConnection.create.mock.calls[0][0];
    expect(call.data.user_id).toBe('u1');
    expect(call.data.credentials).not.toContain('sk'); // "encrypted" (base64) — not plaintext in the stored blob
  });

  it('createManualConnection rejects invalid credentials with 422', async () => {
    await expect(svc.createManualConnection('u1', { provider: 's3', label: 'x', credentials: {} }))
      .rejects.toMatchObject({ status: 422 });
    expect(prismaMock.mediaImportConnection.create).not.toHaveBeenCalled();
  });

  it('createManualConnection rejects an oauth provider name with 422', async () => {
    await expect(svc.createManualConnection('u1', { provider: 'google-drive', label: 'x', credentials: {} }))
      .rejects.toMatchObject({ status: 422 });
  });

  it('deleteConnection 404s when the connection is not owned by the user', async () => {
    prismaMock.mediaImportConnection.findFirst.mockResolvedValue(null);
    await expect(svc.deleteConnection('u1', 'c404')).rejects.toMatchObject({ status: 404 });
    expect(prismaMock.mediaImportConnection.delete).not.toHaveBeenCalled();
  });

  it('deleteConnection removes an owned connection', async () => {
    prismaMock.mediaImportConnection.findFirst.mockResolvedValue({ id: 'c1' });
    prismaMock.mediaImportConnection.delete.mockResolvedValue({});
    await svc.deleteConnection('u1', 'c1');
    expect(prismaMock.mediaImportConnection.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });
});

describe('OAuth start/callback — AI-Rules-style: unconfigured provider → 501', () => {
  const savedEnv = { ...process.env };
  afterEach(() => { process.env = { ...savedEnv }; });

  it('startOAuth 501s when the provider app client is not configured', () => {
    delete process.env.GOOGLE_DRIVE_CLIENT_ID;
    delete process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    expect(() => svc.startOAuth('u1', 'google-drive')).toThrow(expect.objectContaining({ status: 501 }));
  });

  it('startOAuth 422s for a non-oauth provider', () => {
    expect(() => svc.startOAuth('u1', 's3')).toThrow(expect.objectContaining({ status: 422 }));
  });

  it('startOAuth returns a provider auth url embedding a signed state bound to a fresh nonce', () => {
    process.env.GOOGLE_DRIVE_CLIENT_ID = 'id';
    process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'secret';
    const { url, nonce } = svc.startOAuth('u1', 'google-drive');
    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('state=');
    expect(typeof nonce).toBe('string');
    expect(nonce.length).toBeGreaterThan(10);
  });

  it('completeOAuth rejects a state signed for a different provider', async () => {
    process.env.DROPBOX_CLIENT_ID = 'id';
    process.env.DROPBOX_CLIENT_SECRET = 'secret';
    const state = enc({ userId: 'u1', provider: 'onedrive', nonce: 'n1', ts: Date.now() });
    await expect(svc.completeOAuth('dropbox', { code: 'c', state, nonce: 'n1' })).rejects.toMatchObject({ status: 422 });
  });

  it('completeOAuth rejects an expired state', async () => {
    process.env.DROPBOX_CLIENT_ID = 'id';
    process.env.DROPBOX_CLIENT_SECRET = 'secret';
    const state = enc({ userId: 'u1', provider: 'dropbox', nonce: 'n1', ts: Date.now() - 11 * 60 * 1000 });
    await expect(svc.completeOAuth('dropbox', { code: 'c', state, nonce: 'n1' })).rejects.toMatchObject({ status: 422 });
  });

  // OAuth login-CSRF (RFC 6749 §10.12): an attacker who calls startOAuth as
  // themselves gets a validly-encrypted state for their own userId. Without a
  // session-bound nonce check, tricking a victim into completing the provider
  // consent would link the victim's cloud credentials to the attacker's account.
  it('completeOAuth rejects a validly-encrypted state when the nonce does not match the session cookie', async () => {
    process.env.DROPBOX_CLIENT_ID = 'id';
    process.env.DROPBOX_CLIENT_SECRET = 'secret';
    const state = enc({ userId: 'attacker', provider: 'dropbox', nonce: 'attackers-nonce', ts: Date.now() });
    await expect(svc.completeOAuth('dropbox', { code: 'c', state, nonce: 'victims-cookie-nonce' }))
      .rejects.toMatchObject({ status: 422 });
    expect(prismaMock.mediaImportConnection.create).not.toHaveBeenCalled();
  });

  it('completeOAuth rejects a state when no session cookie nonce is provided at all', async () => {
    process.env.DROPBOX_CLIENT_ID = 'id';
    process.env.DROPBOX_CLIENT_SECRET = 'secret';
    const state = enc({ userId: 'u1', provider: 'dropbox', nonce: 'n1', ts: Date.now() });
    await expect(svc.completeOAuth('dropbox', { code: 'c', state, nonce: undefined }))
      .rejects.toMatchObject({ status: 422 });
  });

  it('completeOAuth exchanges the code and creates an encrypted connection when the nonce matches', async () => {
    process.env.DROPBOX_CLIENT_ID = 'id';
    process.env.DROPBOX_CLIENT_SECRET = 'secret';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'a', refresh_token: 'r' }) }));
    prismaMock.mediaImportConnection.create.mockResolvedValue({ id: 'c1', provider: 'dropbox', label: 'dropbox (connected)' });

    const state = enc({ userId: 'u1', provider: 'dropbox', nonce: 'n1', ts: Date.now() });
    const out = await svc.completeOAuth('dropbox', { code: 'c', state, nonce: 'n1' });
    expect(out.userId).toBe('u1');
    expect(out.connection.id).toBe('c1');
    vi.unstubAllGlobals();
  });
});

describe('listRemoteFiles / importRemoteFiles', () => {
  it('listRemoteFiles decrypts the owned connection and delegates to the driver', async () => {
    prismaMock.mediaImportConnection.findFirst.mockResolvedValue({
      id: 'c1', user_id: 'u1', provider: 's3',
      credentials: enc({ access_key_id: 'ak', secret_access_key: 'sk', bucket: 'b' }),
    });
    s3SendMock.mockResolvedValueOnce({ CommonPrefixes: [], Contents: [], IsTruncated: false });
    const out = await svc.listRemoteFiles('u1', 'c1', { folderId: '', cursor: null });
    expect(out.items).toEqual([]);
  });

  it('listRemoteFiles 404s for a connection not owned by the caller', async () => {
    prismaMock.mediaImportConnection.findFirst.mockResolvedValue(null);
    await expect(svc.listRemoteFiles('u1', 'c404', {})).rejects.toMatchObject({ status: 404 });
  });

  it('importRemoteFiles downloads each file and uploads it via the normal media pipeline', async () => {
    prismaMock.mediaImportConnection.findFirst.mockResolvedValue({
      id: 'c1', user_id: 'u1', provider: 's3',
      credentials: enc({ access_key_id: 'ak', secret_access_key: 'sk', bucket: 'b' }),
    });
    const { Readable } = await import('node:stream');
    s3SendMock
      .mockResolvedValueOnce({ Body: Readable.from([Buffer.from('img')]), ContentType: 'image/png' })
      .mockRejectedValueOnce(new Error('not found'));
    uploadMediaMock.mockResolvedValueOnce({ id: 'm1' });

    const out = await svc.importRemoteFiles('u1', 'c1', { fileIds: ['a.png', 'missing.png'], folderId: 'f1' });
    expect(out.imported).toEqual([{ id: 'm1', name: 'a.png' }]);
    expect(out.skipped).toEqual([{ file_id: 'missing.png', reason: 'not found' }]);
    expect(uploadMediaMock).toHaveBeenCalledWith(
      expect.objectContaining({ mimetype: 'image/png', originalname: 'a.png' }),
      'u1',
      'f1',
    );
  });

  it('importRemoteFiles guesses mime from filename when the driver reports none', async () => {
    prismaMock.mediaImportConnection.findFirst.mockResolvedValue({
      id: 'c1', user_id: 'u1', provider: 'ftp',
      credentials: enc({ host: 'h', user: 'u', password: 'p' }),
    });
    ftpMocks.downloadTo.mockImplementationOnce(async (writable) => {
      writable.write(Buffer.from('pdf-bytes'));
      writable.end();
    });
    uploadMediaMock.mockResolvedValueOnce({ id: 'm2' });

    const out = await svc.importRemoteFiles('u1', 'c1', { fileIds: ['/doc.pdf'], folderId: null });
    expect(out.imported).toEqual([{ id: 'm2', name: 'doc.pdf' }]);
    expect(uploadMediaMock).toHaveBeenCalledWith(
      expect.objectContaining({ mimetype: 'application/pdf' }),
      'u1',
      null,
    );
  });
});
