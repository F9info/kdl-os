import { z } from 'zod';

// Stored (post-exchange) credentials shape — never what the user submits directly.
const credentialsSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
});

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const GOOGLE_DOC_PREFIX = 'application/vnd.google-apps';

const appConfigured = () => Boolean(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET);

export default {
  provider: 'google-drive',
  oauth: true,
  credentialsSchema,

  isAppConfigured: appConfigured,

  getAuthUrl({ redirectUri, state }) {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_DRIVE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri }) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_DRIVE_CLIENT_ID,
        client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`google-drive token exchange failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    if (!data.refresh_token) {
      throw new Error('google-drive did not return a refresh_token — revoke prior access and reconnect with consent');
    }
    return { access_token: data.access_token, refresh_token: data.refresh_token };
  },

  // Access tokens are short-lived; refresh up front on every call rather than
  // tracking expiry — one extra request, no stale-token retries to write.
  async _freshAccessToken(credentials) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_DRIVE_CLIENT_ID,
        client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
        refresh_token: credentials.refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) throw new Error(`google-drive token refresh failed (${res.status})`);
    const data = await res.json();
    return data.access_token;
  },

  async list({ credentials, folderId, cursor }) {
    const token = await this._freshAccessToken(credentials);
    const q = `'${folderId || 'root'}' in parents and trashed = false`;
    const params = new URLSearchParams({
      q,
      fields: 'nextPageToken, files(id, name, mimeType, size)',
      pageSize: '100',
    });
    if (cursor) params.set('pageToken', cursor);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`google-drive list failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    return {
      items: (data.files ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size ? Number(f.size) : null,
        isFolder: f.mimeType === FOLDER_MIME,
      })),
      nextCursor: data.nextPageToken ?? null,
    };
  },

  async download({ credentials, fileId }) {
    const token = await this._freshAccessToken(credentials);
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!metaRes.ok) throw new Error(`google-drive metadata fetch failed (${metaRes.status})`);
    const meta = await metaRes.json();
    if (meta.mimeType?.startsWith(GOOGLE_DOC_PREFIX)) {
      throw Object.assign(new Error('Google Docs/Sheets/Slides files must be exported first — not supported for direct import'), { status: 422 });
    }

    const fileRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!fileRes.ok) throw new Error(`google-drive download failed (${fileRes.status})`);
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    return { buffer, filename: meta.name, mimeType: meta.mimeType };
  },
};
