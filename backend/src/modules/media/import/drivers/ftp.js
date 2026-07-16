import { z } from 'zod';
import { Writable } from 'node:stream';
import { Client, FileType } from 'basic-ftp';
import { assertNotSSRF } from '../../../../shared/utils/ssrf-guard.js';

const credentialsSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).optional().default(21),
  user: z.string().min(1),
  password: z.string().min(1),
  secure: z.boolean().optional().default(false),
});

const withClient = async (credentials, fn) => {
  await assertNotSSRF(credentials.host);
  const client = new Client();
  try {
    await client.access({
      host: credentials.host,
      port: credentials.port || 21,
      user: credentials.user,
      password: credentials.password,
      secure: Boolean(credentials.secure),
    });
    return await fn(client);
  } finally {
    client.close();
  }
};

const joinPath = (dir, name) => `${(dir || '/').replace(/\/$/, '')}/${name}`;

export default {
  provider: 'ftp',
  oauth: false,
  credentialsSchema,

  isAppConfigured: () => true,

  async list({ credentials, folderId }) {
    const path = folderId || '/';
    const entries = await withClient(credentials, (client) => client.list(path));
    return {
      items: entries
        .filter((e) => e.type === FileType.File || e.type === FileType.Directory)
        .map((e) => ({
          id: joinPath(path, e.name),
          name: e.name,
          mimeType: null,
          size: e.type === FileType.File ? e.size : null,
          isFolder: e.type === FileType.Directory,
        })),
      nextCursor: null, // FTP LIST has no pagination protocol
    };
  },

  async download({ credentials, fileId }) {
    const chunks = [];
    const collector = new Writable({
      write(chunk, _enc, cb) { chunks.push(chunk); cb(); },
    });
    await withClient(credentials, (client) => client.downloadTo(collector, fileId));
    return { buffer: Buffer.concat(chunks), filename: fileId.split('/').pop(), mimeType: null };
  },
};
