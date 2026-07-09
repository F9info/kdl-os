import { z } from 'zod';

// S3 and FTP are the two `credentials`-auth providers; OAuth providers
// (gdrive/dropbox/onedrive) get their tokens via the OAuth flow instead.
const s3Credentials = z.object({
  access_key_id: z.string().min(1),
  secret_access_key: z.string().min(1),
  bucket: z.string().min(1),
  region: z.string().optional(),
  endpoint: z.string().url().optional(),
});

const ftpCredentials = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).optional(),
  user: z.string().min(1),
  password: z.string(),
  secure: z.boolean().optional(),
});

export const createConnectionSchema = z.object({
  body: z.discriminatedUnion('provider', [
    z.object({ provider: z.literal('s3'), label: z.string().max(100).optional(), credentials: s3Credentials }),
    z.object({ provider: z.literal('ftp'), label: z.string().max(100).optional(), credentials: ftpCredentials }),
  ]),
});

export const connectionIdSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const oauthProviderSchema = z.object({
  params: z.object({ provider: z.enum(['gdrive', 'dropbox', 'onedrive']) }),
  body: z.object({ redirect_uri: z.string().url() }),
});

export const oauthCallbackSchema = z.object({
  params: z.object({ provider: z.enum(['gdrive', 'dropbox', 'onedrive']) }),
  body: z.object({
    code: z.string().min(1),
    state: z.string().min(1),
    redirect_uri: z.string().url(),
    label: z.string().max(100).optional(),
  }),
});

export const browseConnectionSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({
    path: z.string().optional(),
    cursor: z.string().optional(),
  }).optional(),
});

export const importFilesSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    files: z.array(z.string().min(1)).min(1).max(100),
    folder_id: z.string().nullable().optional(),
  }),
});
