import { z } from 'zod';

const credentialsSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
});

const appConfigured = () => Boolean(process.env.DROPBOX_CLIENT_ID && process.env.DROPBOX_CLIENT_SECRET);

export default {
  provider: 'dropbox',
  oauth: true,
  credentialsSchema,

  isAppConfigured: appConfigured,

  getAuthUrl({ redirectUri, state }) {
    const params = new URLSearchParams({
      client_id: process.env.DROPBOX_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      token_access_type: 'offline',
      state,
    });
    return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri }) {
    const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: process.env.DROPBOX_CLIENT_ID,
        client_secret: process.env.DROPBOX_CLIENT_SECRET,
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`dropbox token exchange failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    if (!data.refresh_token) throw new Error('dropbox did not return a refresh_token');
    return { access_token: data.access_token, refresh_token: data.refresh_token };
  },

  async _freshAccessToken(credentials) {
    const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: credentials.refresh_token,
        client_id: process.env.DROPBOX_CLIENT_ID,
        client_secret: process.env.DROPBOX_CLIENT_SECRET,
      }),
    });
    if (!res.ok) throw new Error(`dropbox token refresh failed (${res.status})`);
    const data = await res.json();
    return data.access_token;
  },

  async list({ credentials, folderId, cursor }) {
    const token = await this._freshAccessToken(credentials);
    const url = cursor
      ? 'https://api.dropboxapi.com/2/files/list_folder/continue'
      : 'https://api.dropboxapi.com/2/files/list_folder';
    const body = cursor ? { cursor } : { path: folderId || '', limit: 100 };
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`dropbox list failed (${res.status}): ${errBody.slice(0, 300)}`);
    }
    const data = await res.json();
    return {
      items: (data.entries ?? []).map((e) => ({
        id: e.path_lower,
        name: e.name,
        mimeType: null,
        size: typeof e.size === 'number' ? e.size : null,
        isFolder: e['.tag'] === 'folder',
      })),
      nextCursor: data.has_more ? data.cursor : null,
    };
  },

  async download({ credentials, fileId }) {
    const token = await this._freshAccessToken(credentials);
    const res = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path: fileId }),
      },
    });
    if (!res.ok) throw new Error(`dropbox download failed (${res.status})`);
    const resultHeader = res.headers.get('dropbox-api-result');
    const meta = resultHeader ? JSON.parse(resultHeader) : {};
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, filename: meta.name ?? fileId.split('/').pop(), mimeType: null };
  },
};
