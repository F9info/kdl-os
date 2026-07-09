// Dropbox import driver (HTTP API v2, OAuth per user). Same contract as gdrive.js.
// File ids are Dropbox lowercase paths (path_lower) — stable and human-legible.

const API = 'https://api.dropboxapi.com/2';
const CONTENT = 'https://content.dropboxapi.com/2';

const dbxFetch = async (url, creds, init, { fetchImpl = fetch } = {}) => {
  const res = await fetchImpl(url, {
    ...init,
    headers: { Authorization: `Bearer ${creds.access_token}`, ...init.headers },
  });
  if (res.status === 401) {
    throw Object.assign(new Error('Dropbox authorization expired'), { status: 401 });
  }
  if (!res.ok) {
    throw Object.assign(new Error(`Dropbox error (HTTP ${res.status})`), { status: 502 });
  }
  return res;
};

const toEntry = (e) => ({
  id: e.path_lower ?? e.id,
  name: e.name,
  size: e['.tag'] === 'file' ? e.size ?? null : null,
  mime: null, // Dropbox does not return MIME — resolved from extension at import time
  is_folder: e['.tag'] === 'folder',
});

export default {
  name: 'dropbox',
  auth: 'oauth',

  async list(creds, { path, cursor } = {}, deps = {}) {
    const url = cursor ? `${API}/files/list_folder/continue` : `${API}/files/list_folder`;
    const body = cursor ? { cursor } : { path: path || '' };

    const res = await dbxFetch(url, creds, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, deps);
    const data = await res.json();

    return {
      entries: (data.entries ?? []).map(toEntry),
      cursor: data.has_more ? data.cursor : null,
    };
  },

  async download(creds, filePath, deps = {}) {
    const res = await dbxFetch(`${CONTENT}/files/download`, creds, {
      method: 'POST',
      headers: { 'Dropbox-API-Arg': JSON.stringify({ path: filePath }) },
    }, deps);

    let name = String(filePath).split('/').pop();
    const apiResult = res.headers.get('dropbox-api-result');
    if (apiResult) {
      try { name = JSON.parse(apiResult).name ?? name; } catch { /* keep path basename */ }
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, name, mime: null, size: buffer.length };
  },
};
