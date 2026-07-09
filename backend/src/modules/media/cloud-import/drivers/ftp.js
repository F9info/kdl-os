// FTP import driver (basic-ftp, plain creds). Same contract as gdrive.js.
// File ids are absolute remote paths. Connections are opened per call and always
// closed — FTP control sockets are stateful and must not be pooled across users.
// `deps.clientFactory(creds)` is injectable for tests
// (must return { list, downloadTo, close }).

import { Writable } from 'node:stream';

const makeClient = async (creds, deps = {}) => {
  if (deps.clientFactory) return deps.clientFactory(creds);
  const { Client } = await import('basic-ftp');
  const client = new Client(30_000);
  await client.access({
    host: creds.host,
    port: creds.port ?? 21,
    user: creds.user,
    password: creds.password,
    secure: !!creds.secure, // FTPS (explicit TLS)
  });
  return client;
};

const joinPath = (dir, name) => `${String(dir || '/').replace(/\/$/, '')}/${name}`;

export default {
  name: 'ftp',
  auth: 'credentials',

  async list(creds, { path } = {}, deps = {}) {
    const client = await makeClient(creds, deps);
    try {
      const dir = path || '/';
      const listing = await client.list(dir);
      const entries = listing.map((f) => ({
        id: joinPath(dir, f.name),
        name: f.name,
        size: f.isDirectory ? null : f.size ?? null,
        mime: null, // resolved from extension at import time
        is_folder: !!f.isDirectory,
      }));
      return { entries, cursor: null }; // FTP LIST is not paginated
    } finally {
      client.close();
    }
  },

  async download(creds, remotePath, deps = {}) {
    const client = await makeClient(creds, deps);
    try {
      const chunks = [];
      const sink = new Writable({
        write(chunk, _enc, cb) { chunks.push(chunk); cb(); },
      });
      await client.downloadTo(sink, remotePath);
      const buffer = Buffer.concat(chunks);
      return { buffer, name: String(remotePath).split('/').pop(), mime: null, size: buffer.length };
    } finally {
      client.close();
    }
  },
};
