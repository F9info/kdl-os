// Google Drive import driver (Drive REST v3, OAuth per user).
//
// Importer contract (shared by all cloud-import drivers):
//   list(creds, { path, cursor }, deps)  -> { entries: [{ id, name, size, mime, is_folder }], cursor }
//   download(creds, fileId, deps)        -> { buffer, name, mime, size }
// `deps.fetchImpl` is injectable for tests. A 401 from the provider surfaces as
// an error with { status: 401 } so the service layer can refresh tokens and retry.

const API = 'https://www.googleapis.com/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

const driveFetch = async (url, creds, { fetchImpl = fetch } = {}) => {
  const res = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${creds.access_token}` },
  });
  if (res.status === 401) {
    throw Object.assign(new Error('Google Drive authorization expired'), { status: 401 });
  }
  if (!res.ok) {
    throw Object.assign(new Error(`Google Drive error (HTTP ${res.status})`), { status: 502 });
  }
  return res;
};

export default {
  name: 'gdrive',
  auth: 'oauth',

  async list(creds, { path, cursor } = {}, deps = {}) {
    const parent = path || 'root';
    const params = new URLSearchParams({
      q: `'${parent.replace(/'/g, "\\'")}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,size)',
      pageSize: '100',
    });
    if (cursor) params.set('pageToken', cursor);

    const res = await driveFetch(`${API}/files?${params}`, creds, deps);
    const data = await res.json();

    const entries = (data.files ?? [])
      // Google-native docs (Docs/Sheets/Slides) have no binary content to import.
      .filter((f) => f.mimeType === FOLDER_MIME || !f.mimeType?.startsWith('application/vnd.google-apps'))
      .map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size != null ? Number(f.size) : null,
        mime: f.mimeType === FOLDER_MIME ? null : f.mimeType ?? null,
        is_folder: f.mimeType === FOLDER_MIME,
      }));

    return { entries, cursor: data.nextPageToken ?? null };
  },

  async download(creds, fileId, deps = {}) {
    const id = encodeURIComponent(fileId);
    const metaRes = await driveFetch(`${API}/files/${id}?fields=id,name,mimeType,size`, creds, deps);
    const meta = await metaRes.json();
    if (meta.mimeType?.startsWith('application/vnd.google-apps')) {
      throw Object.assign(new Error('Google-native files cannot be imported'), { status: 422 });
    }

    const res = await driveFetch(`${API}/files/${id}?alt=media`, creds, deps);
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, name: meta.name, mime: meta.mimeType ?? null, size: buffer.length };
  },
};
