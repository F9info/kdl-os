import { z } from 'zod';

const credentialsSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
});

const tenant = () => process.env.ONEDRIVE_TENANT || 'common';
const appConfigured = () => Boolean(process.env.ONEDRIVE_CLIENT_ID && process.env.ONEDRIVE_CLIENT_SECRET);

export default {
  provider: 'onedrive',
  oauth: true,
  credentialsSchema,

  isAppConfigured: appConfigured,

  getAuthUrl({ redirectUri, state }) {
    const params = new URLSearchParams({
      client_id: process.env.ONEDRIVE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      response_mode: 'query',
      scope: 'offline_access Files.Read',
      state,
    });
    return `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/authorize?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri }) {
    const res = await fetch(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.ONEDRIVE_CLIENT_ID,
        client_secret: process.env.ONEDRIVE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'offline_access Files.Read',
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`onedrive token exchange failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    if (!data.refresh_token) throw new Error('onedrive did not return a refresh_token');
    return { access_token: data.access_token, refresh_token: data.refresh_token };
  },

  async _freshAccessToken(credentials) {
    const res = await fetch(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.ONEDRIVE_CLIENT_ID,
        client_secret: process.env.ONEDRIVE_CLIENT_SECRET,
        refresh_token: credentials.refresh_token,
        grant_type: 'refresh_token',
        scope: 'offline_access Files.Read',
      }),
    });
    if (!res.ok) throw new Error(`onedrive token refresh failed (${res.status})`);
    const data = await res.json();
    return data.access_token;
  },

  async list({ credentials, folderId, cursor }) {
    const token = await this._freshAccessToken(credentials);
    const base = folderId
      ? `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`
      : 'https://graph.microsoft.com/v1.0/me/drive/root/children';
    const url = cursor || `${base}?$top=100&$select=id,name,size,folder,file`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`onedrive list failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    return {
      items: (data.value ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.file?.mimeType ?? null,
        size: typeof f.size === 'number' ? f.size : null,
        isFolder: Boolean(f.folder),
      })),
      nextCursor: data['@odata.nextLink'] ?? null,
    };
  },

  async download({ credentials, fileId }) {
    const token = await this._freshAccessToken(credentials);
    const metaRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}?$select=name,file`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!metaRes.ok) throw new Error(`onedrive metadata fetch failed (${metaRes.status})`);
    const meta = await metaRes.json();

    const fileRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!fileRes.ok) throw new Error(`onedrive download failed (${fileRes.status})`);
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    return { buffer, filename: meta.name, mimeType: meta.file?.mimeType ?? null };
  },
};
