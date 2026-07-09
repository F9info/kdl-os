// OneDrive import driver (Microsoft Graph v1.0, OAuth per user). Same contract as gdrive.js.
// The list cursor is Graph's @odata.nextLink (a full URL) passed back verbatim.

const API = 'https://graph.microsoft.com/v1.0';

const graphFetch = async (url, creds, { fetchImpl = fetch } = {}) => {
  const res = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${creds.access_token}` },
  });
  if (res.status === 401) {
    throw Object.assign(new Error('OneDrive authorization expired'), { status: 401 });
  }
  if (!res.ok) {
    throw Object.assign(new Error(`OneDrive error (HTTP ${res.status})`), { status: 502 });
  }
  return res;
};

export default {
  name: 'onedrive',
  auth: 'oauth',

  async list(creds, { path, cursor } = {}, deps = {}) {
    const base = path
      ? `${API}/me/drive/items/${encodeURIComponent(path)}/children`
      : `${API}/me/drive/root/children`;
    const url = cursor || `${base}?$select=id,name,size,file,folder&$top=100`;

    const res = await graphFetch(url, creds, deps);
    const data = await res.json();

    const entries = (data.value ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      size: item.folder ? null : item.size ?? null,
      mime: item.file?.mimeType ?? null,
      is_folder: !!item.folder,
    }));

    return { entries, cursor: data['@odata.nextLink'] ?? null };
  },

  async download(creds, fileId, deps = {}) {
    const id = encodeURIComponent(fileId);
    const metaRes = await graphFetch(`${API}/me/drive/items/${id}?$select=id,name,size,file`, creds, deps);
    const meta = await metaRes.json();

    // fetch follows Graph's 302 to the pre-authenticated download URL
    const res = await graphFetch(`${API}/me/drive/items/${id}/content`, creds, deps);
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, name: meta.name, mime: meta.file?.mimeType ?? null, size: buffer.length };
  },
};
